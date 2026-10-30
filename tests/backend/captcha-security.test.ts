import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { verifyCaptcha } from '../../backend/security/captcha';
const key = '0x4SYNTHETIC_SITEKEY_123456';
const secret = '0x4SYNTHETIC_SECRET_NOT_A_REAL_KEY_12345678';
const accepted = (extra: Record<string, unknown> = {}) =>
  Response.json({ success: true, hostname: 'website.example', action: 'inquiry', ...extra });
beforeEach(() => {
  vi.stubEnv('APP_ENV', 'production'); vi.stubEnv('APP_ORIGIN', 'https://website.example');
  vi.stubEnv('PUBLIC_TURNSTILE_SITE_KEY', key); vi.stubEnv('TURNSTILE_SECRET_KEY', secret);
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe('server Turnstile verification', () => {
  it('keeps zero-key classroom/staging independent of external verification', async () => {
    vi.stubEnv('APP_ENV', 'staging'); vi.stubEnv('PUBLIC_TURNSTILE_SITE_KEY', ''); vi.stubEnv('TURNSTILE_SECRET_KEY', '');
    const call = vi.fn(); vi.stubGlobal('fetch', call);
    expect(await verifyCaptcha(undefined, '', 'inquiry')).toBeNull(); expect(call).not.toHaveBeenCalled();
  });
  it.each(['PUBLIC_TURNSTILE_SITE_KEY', 'TURNSTILE_SECRET_KEY'])('fails closed when %s is missing, including staging', async (name) => {
    vi.stubEnv('APP_ENV', 'staging'); vi.stubEnv(name, '');
    const call = vi.fn(); vi.stubGlobal('fetch', call);
    expect((await verifyCaptcha('token', '192.0.2.1', 'inquiry'))?.status).toBe(503);
    expect(call).not.toHaveBeenCalled();
  });
  it('requires verification configuration in production even when both keys are absent', async () => {
    vi.stubEnv('PUBLIC_TURNSTILE_SITE_KEY', ''); vi.stubEnv('TURNSTILE_SECRET_KEY', '');
    expect((await verifyCaptcha('token', '', 'inquiry'))?.status).toBe(503);
  });
  it.each(['1x00000000000000000000AA', '2x00000000000000000000AB', '3x00000000000000000000FF', 'b1111111-1111-4111-8111-111111111111'])('rejects test or old-provider site key %s', async (sitekey) => {
    vi.stubEnv('PUBLIC_TURNSTILE_SITE_KEY', sitekey);
    expect((await verifyCaptcha('token', '192.0.2.1', 'inquiry'))?.status).toBe(503);
  });
  it('rejects a provider testing secret in production', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', '1x0000000000000000000000000000000AA');
    expect((await verifyCaptcha('token', '', 'inquiry'))?.status).toBe(503);
  });
  it('requires a trusted configured origin', async () => {
    vi.stubEnv('APP_ORIGIN', '');
    expect((await verifyCaptcha('token', '', 'inquiry'))?.status).toBe(503);
  });
  it.each([undefined, '', 'x'.repeat(2049)])('rejects missing or oversized tokens before contacting the provider', async (token) => {
    const call = vi.fn(); vi.stubGlobal('fetch', call);
    expect((await verifyCaptcha(token, '192.0.2.1', 'inquiry'))?.status).toBe(403);
    expect(call).not.toHaveBeenCalled();
  });
  it('uses a bounded HTTPS POST with the secret and response; it never sends the old sitekey parameter', async () => {
    const call = vi.fn(async (_url, options: RequestInit) => {
      const body = options.body as URLSearchParams;
      expect(body.get('sitekey')).toBeNull(); expect(body.get('secret')).toBe(secret);
      expect(body.get('response')).toBe('synthetic-token'); expect(body.get('remoteip')).toBe('192.0.2.1');
      expect(options.redirect).toBe('error'); expect(options.signal).toBeInstanceOf(AbortSignal);
      return accepted();
    }); vi.stubGlobal('fetch', call);
    expect(await verifyCaptcha('synthetic-token', '192.0.2.1', 'inquiry')).toBeNull();
    expect(call).toHaveBeenCalledWith('https://challenges.cloudflare.com/turnstile/v0/siteverify', expect.anything());
  });
  it('does not forward an unknown or forged IP value to the provider', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_url, options: RequestInit) => {
      expect((options.body as URLSearchParams).has('remoteip')).toBe(false); return accepted();
    }));
    expect(await verifyCaptcha('synthetic-token', 'unknown', 'inquiry')).toBeNull();
  });
  it.each([
    { hostname: 'attacker.example' }, { hostname: 'website.example.attacker.example' },
    { hostname: undefined }, { action: 'owner_login' }, { action: 'privacy_request' }, { action: undefined },
  ])('rejects successful provider responses with the wrong hostname/action: %j', async (extra) => {
    vi.stubGlobal('fetch', vi.fn(async () => accepted(extra)));
    expect((await verifyCaptcha('synthetic-token', '', 'inquiry'))?.status).toBe(403);
  });
  it('accepts a privacy token only on the privacy route', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => accepted({ action: 'privacy_request' })));
    expect(await verifyCaptcha('synthetic-token', '', 'privacy_request')).toBeNull();
  });
  it.each(['invalid-input-response', 'missing-input-response', 'timeout-or-duplicate'])('rejects invalid, expired or replayed tokens (%s)', async (code) => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ success: false, 'error-codes': [code] })));
    expect((await verifyCaptcha('synthetic-token', '', 'inquiry'))?.status).toBe(403);
  });
  it.each(['internal-error', 'invalid-input-secret', 'missing-input-secret', 'bad-request'])('reports retryable provider/configuration failure without leaking %s', async (code) => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ success: false, 'error-codes': [code] })));
    const response = await verifyCaptcha('synthetic-token', '', 'inquiry');
    expect(response?.status).toBe(503); expect(await response?.text()).not.toContain(secret);
  });
  it.each(['http', 'json', 'network'])('fails closed on a provider %s outage', async (mode) => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      if (mode === 'network') throw new Error('private provider error');
      return mode === 'http' ? new Response('Unavailable', { status: 503 }) : new Response('not json');
    }));
    const response = await verifyCaptcha('synthetic-token', '', 'inquiry');
    expect(response?.status).toBe(503); expect(await response?.text()).not.toContain('private provider error');
  });
});
