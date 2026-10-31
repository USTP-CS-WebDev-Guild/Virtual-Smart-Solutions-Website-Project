// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { createMfaFlow } from '../../frontend/scripts/owner/mfa';
let client: any;
let completed = vi.fn(async () => {});
const secret = () => document.querySelector<HTMLInputElement>('#staff-mfa-secret')!;
const code = () => document.querySelector<HTMLInputElement>('#staff-mfa-code')!;
const panel = () => document.querySelector<HTMLElement>('#staff-mfa')!;
beforeEach(()=>{
  document.body.innerHTML=`<form id="staff-login-form"></form><section id="staff-mfa" hidden>
    <h2 id="staff-mfa-heading">Authenticator check</h2>
    <div id="staff-mfa-setup" hidden><img id="staff-mfa-qr"><input id="staff-mfa-secret"></div>
    <form id="staff-mfa-form"><input id="staff-mfa-code"><button id="staff-mfa-verify" disabled>Verify</button></form>
    <button id="staff-mfa-cancel">Cancel</button><p id="staff-mfa-status"></p></section>`;
  completed=vi.fn(async()=>{});
  client={auth:{signOut:vi.fn(async()=>({error:null})),mfa:{
    listFactors:vi.fn(async()=>({data:{totp:[],all:[]},error:null})),
    enroll:vi.fn(async()=>({data:{id:'pending-factor',totp:{secret:'SYNTHETICSETUPKEY',qr_code:'data:image/svg+xml;utf8,%3Csvg%3E%3C/svg%3E'}},error:null})),
    unenroll:vi.fn(async()=>({error:null})),
    challengeAndVerify:vi.fn(async()=>({data:{},error:null})),
  }}};
});
afterEach(()=>document.body.replaceChildren());
describe('staff MFA screen',()=>{
  it('enrolls without opening business data and clears the setup secret after verification',async()=>{
    const flow=createMfaFlow(client,completed); await flow.show();
    expect(panel().hidden).toBe(false); expect(secret().value).toBe('SYNTHETICSETUPKEY');
    expect(document.getElementById('staff-mfa-heading')!.textContent).toBe('Set up your authenticator');
    expect(completed).not.toHaveBeenCalled(); code().value='123456';
    document.getElementById('staff-mfa-form')!.dispatchEvent(new Event('submit',{cancelable:true}));
    await vi.waitFor(()=>expect(completed).toHaveBeenCalledOnce());
    expect(panel().hidden).toBe(true); expect(secret().value).toBe(''); expect(code().value).toBe('');
    expect(document.getElementById('staff-mfa-qr')!.hasAttribute('src')).toBe(false);
  });
  it('uses an existing verified factor without replacing it',async()=>{
    client.auth.mfa.listFactors.mockResolvedValue({data:{totp:[{id:'verified-factor',status:'verified'}],all:[]},error:null});
    const flow=createMfaFlow(client,completed); await flow.show();
    expect(client.auth.mfa.enroll).not.toHaveBeenCalled(); expect(secret().value).toBe('');
    code().value='654321'; document.getElementById('staff-mfa-form')!.dispatchEvent(new Event('submit'));
    await vi.waitFor(()=>expect(completed).toHaveBeenCalledOnce());
    expect(client.auth.mfa.challengeAndVerify).toHaveBeenCalledWith({factorId:'verified-factor',code:'654321'});
    await flow.show();
    expect(client.auth.mfa.enroll).not.toHaveBeenCalled();
    expect(document.querySelector<HTMLElement>('#staff-mfa-setup')!.hidden).toBe(true);
    expect(document.getElementById('staff-mfa-heading')!.textContent).toBe('Enter your sign-in code');
    expect(document.getElementById('staff-mfa-status')!.textContent).toContain('do not need to scan the QR again');
  });
  it('keeps the workspace closed when a code is rejected',async()=>{
    client.auth.mfa.challengeAndVerify.mockResolvedValue({error:{message:'invalid code'}});
    await createMfaFlow(client,completed).show(); code().value='123456';
    document.getElementById('staff-mfa-form')!.dispatchEvent(new Event('submit'));
    await vi.waitFor(()=>expect(document.getElementById('staff-mfa-status')!.textContent).toContain('could not be verified'));
    expect(completed).not.toHaveBeenCalled(); expect(panel().hidden).toBe(false); expect(code().value).toBe('');
  });
  it('cancels only its own unverified enrollment and signs out',async()=>{
    await createMfaFlow(client,completed).show(); document.getElementById('staff-mfa-cancel')!.click();
    await vi.waitFor(()=>expect(client.auth.signOut).toHaveBeenCalledOnce());
    expect(client.auth.mfa.unenroll).toHaveBeenCalledWith({factorId:'pending-factor'});
    expect(secret().value).toBe(''); expect(completed).not.toHaveBeenCalled();
  });
  it('does not put an untrusted setup URL into the document',async()=>{
    client.auth.mfa.enroll.mockResolvedValue({data:{id:'pending',totp:{secret:'SYNTHETIC',qr_code:'javascript:alert(1)'}},error:null});
    await createMfaFlow(client,completed).show();
    expect(document.getElementById('staff-mfa-qr')!.hasAttribute('src')).toBe(false);
    expect(completed).not.toHaveBeenCalled();
    expect(document.querySelector<HTMLButtonElement>('#staff-mfa-verify')!.disabled).toBe(true);
  });
  it('shows a provider-sized SVG returned through the real Supabase client',async()=>{
    // Supabase uses goqrsvg: one rectangle for every module, including white
    // modules. A normal 57x57 matrix already exceeds the old 150KB guard.
    // This is a synthetic image/secret, never a real enrollment or scannable QR.
    const modules = 57;
    const rectangles = Array.from({length:modules * modules},(_,index)=>
      `<rect x="${index % modules * 6}" y="${Math.floor(index / modules) * 6}" width="6" height="6" style="fill:${index % 2 ? 'black' : 'white'};stroke:none" />\n`).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="342" height="342">${rectangles}</svg>`;
    expect(svg.length).toBeGreaterThan(150000);
    const user = {id:'20000000-0000-4000-8000-000000000001',email:'owner@example.test',
      aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},
      created_at:'2026-01-01T00:00:00Z',factors:[]};
    const transport = vi.fn(async(input: RequestInfo | URL, options?: RequestInit)=>{
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
      if(url.pathname === '/auth/v1/user') return Response.json(user);
      if(url.pathname === '/auth/v1/factors' && options?.method === 'POST') {
        return Response.json({id:'20000000-0000-4000-8000-000000000003',type:'totp',
          friendly_name:'VSS workspace',totp:{qr_code:svg,secret:'SYNTHETICSETUPKEY',
            uri:'otpauth://totp/SYNTHETIC?secret=SYNTHETICSETUPKEY'}});
      }
      throw new Error('Unexpected synthetic MFA request');
    });
    const sdk = createClient('https://mfa.example.test','sb_publishable_SYNTHETIC_BROWSER_KEY',{
      auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
      global:{fetch:transport},
    });
    const encode = (value:unknown)=>Buffer.from(JSON.stringify(value)).toString('base64url');
    const accessToken = `${encode({alg:'HS256',typ:'JWT'})}.${encode({sub:user.id,
      exp:Math.floor(Date.now()/1000)+3600,aal:'aal1'})}.SYNTHETIC_SIGNATURE`;
    const signedIn = await sdk.auth.setSession({access_token:accessToken,refresh_token:'SYNTHETIC_REFRESH'});
    expect(signedIn.error).toBeNull();
    await createMfaFlow(sdk,completed).show();
    expect(document.querySelector<HTMLElement>('#staff-mfa-setup')!.hidden).toBe(false);
    const image = document.querySelector<HTMLImageElement>('#staff-mfa-qr')!;
    expect(image.getAttribute('src')?.startsWith('data:image/svg+xml;utf-8,<svg')).toBe(true);
    expect(secret().value).toBe('SYNTHETICSETUPKEY');
    expect(document.querySelector<HTMLButtonElement>('#staff-mfa-verify')!.disabled).toBe(false);
    expect(document.getElementById('staff-mfa-status')!.textContent).toContain('finish setup');
    expect(completed).not.toHaveBeenCalled();
    expect(transport).toHaveBeenCalledTimes(3);
  });
  it('rejects an excessively large setup image before displaying it',async()=>{
    client.auth.mfa.enroll.mockResolvedValue({data:{id:'pending',totp:{secret:'SYNTHETIC',
      qr_code:'data:image/svg+xml;utf8,<svg>'+ ' '.repeat(1000000) +'</svg>'}},error:null});
    await createMfaFlow(client,completed).show();
    expect(document.getElementById('staff-mfa-qr')!.hasAttribute('src')).toBe(false);
    expect(document.querySelector<HTMLElement>('#staff-mfa-setup')!.hidden).toBe(true);
    expect(document.querySelector<HTMLButtonElement>('#staff-mfa-verify')!.disabled).toBe(true);
    expect(completed).not.toHaveBeenCalled();
  });
});
