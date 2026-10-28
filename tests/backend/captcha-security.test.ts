import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { verifyCaptcha } from '../../backend/security/captcha';
const key = 'b1111111-1111-4111-8111-111111111111';
beforeEach(() => { vi.stubEnv('APP_ENV','production'); vi.stubEnv('PUBLIC_HCAPTCHA_SITE_KEY',key); vi.stubEnv('HCAPTCHA_SECRET_KEY','synthetic-private-secret'); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe('server anti-bot verification', () => {
  it('keeps classroom/staging independent of external verification when not enabled', async () => {
    vi.stubEnv('APP_ENV','staging'); vi.stubEnv('PUBLIC_HCAPTCHA_SITE_KEY','');
    const call=vi.fn(); vi.stubGlobal('fetch',call);
    expect(await verifyCaptcha(undefined,'')).toBeNull(); expect(call).not.toHaveBeenCalled();
  });
  it('fails closed with missing production configuration', async () => {
    vi.stubEnv('HCAPTCHA_SECRET_KEY','');
    expect((await verifyCaptcha('token','192.0.2.1'))?.status).toBe(503);
  });
  it('rejects dummy provider keys in production', async () => {
    vi.stubEnv('PUBLIC_HCAPTCHA_SITE_KEY','10000000-ffff-ffff-ffff-000000000001');
    expect((await verifyCaptcha('token','192.0.2.1'))?.status).toBe(503);
  });
  it('rejects missing tokens without making a verification request', async () => {
    const call=vi.fn(); vi.stubGlobal('fetch',call);
    expect((await verifyCaptcha(undefined,'192.0.2.1'))?.status).toBe(403); expect(call).not.toHaveBeenCalled();
  });
  it('checks the token against the expected site key using a bounded HTTPS POST', async () => {
    const call=vi.fn(async (_url, options: RequestInit) => {
      const body=options.body as URLSearchParams;
      expect(body.get('sitekey')).toBe(key); expect(body.get('secret')).toBe('synthetic-private-secret');
      expect(body.get('response')).toBe('synthetic-token'); expect(body.get('remoteip')).toBe('192.0.2.1');
      expect(options.redirect).toBe('error'); expect(options.signal).toBeInstanceOf(AbortSignal);
      return Response.json({success:true});
    }); vi.stubGlobal('fetch',call);
    expect(await verifyCaptcha('synthetic-token','192.0.2.1')).toBeNull();
    expect(call).toHaveBeenCalledWith('https://api.hcaptcha.com/siteverify',expect.anything());
  });
  it.each(['invalid','expired','already-seen'])('rejects %s responses', async () => {
    vi.stubGlobal('fetch',vi.fn(async()=>Response.json({success:false})));
    expect((await verifyCaptcha('synthetic-token','192.0.2.1'))?.status).toBe(403);
  });
  it('returns a retryable outage on a verification service failure', async () => {
    vi.stubGlobal('fetch',vi.fn(async()=>{throw new Error('private provider error');}));
    const response=await verifyCaptcha('synthetic-token','192.0.2.1');
    expect(response?.status).toBe(503); expect(await response?.text()).not.toContain('private provider error');
  });
});
