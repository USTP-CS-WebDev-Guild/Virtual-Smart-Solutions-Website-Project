// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMfaFlow } from '../../frontend/scripts/owner/mfa';
let client: any;
let completed = vi.fn(async () => {});
const secret = () => document.querySelector<HTMLInputElement>('#staff-mfa-secret')!;
const code = () => document.querySelector<HTMLInputElement>('#staff-mfa-code')!;
const panel = () => document.querySelector<HTMLElement>('#staff-mfa')!;
beforeEach(()=>{
  document.body.innerHTML=`<form id="staff-login-form"></form><section id="staff-mfa" hidden>
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
    expect(completed).not.toHaveBeenCalled(); code().value='123456';
    document.getElementById('staff-mfa-form')!.dispatchEvent(new Event('submit',{cancelable:true}));
    await vi.waitFor(()=>expect(completed).toHaveBeenCalledOnce());
    expect(panel().hidden).toBe(true); expect(secret().value).toBe(''); expect(code().value).toBe('');
    expect(document.getElementById('staff-mfa-qr')!.hasAttribute('src')).toBe(false);
  });
  it('uses an existing verified factor without replacing it',async()=>{
    client.auth.mfa.listFactors.mockResolvedValue({data:{totp:[{id:'verified-factor',status:'verified'}],all:[]},error:null});
    await createMfaFlow(client,completed).show();
    expect(client.auth.mfa.enroll).not.toHaveBeenCalled(); expect(secret().value).toBe('');
    code().value='654321'; document.getElementById('staff-mfa-form')!.dispatchEvent(new Event('submit'));
    await vi.waitFor(()=>expect(completed).toHaveBeenCalledOnce());
    expect(client.auth.mfa.challengeAndVerify).toHaveBeenCalledWith({factorId:'verified-factor',code:'654321'});
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
});
