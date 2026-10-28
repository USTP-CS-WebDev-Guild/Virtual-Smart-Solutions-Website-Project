import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestServer } from '../e2e/server';

// Exercise the same HTTP adapter used by project.spec.ts without a browser.
// SQL and app guards are real; the Supabase transport is synthetic and local.
describe('browser fixture origin and authorization boundary', () => {
  const originalContext = process.env.CONTEXT;
  const originalNetlify = process.env.NETLIFY;
  let server: Awaited<ReturnType<typeof startTestServer>>;
  let token: string;
  beforeAll(async () => {
    server = await startTestServer({ buildAssets: false });
    const login = await fetch(server.base + '/supabase/auth/v1/token?grant_type=password', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'owner@example.test', password: 'Synthetic-password-1234' }),
    });
    expect(login.status).toBe(200);
    token = (await login.json()).access_token;
  }, 30000);
  afterAll(async () => {
    await server?.close();
    expect(process.env.CONTEXT).toBe(originalContext);
    expect(process.env.NETLIFY).toBe(originalNetlify);
  });

  const probe = (origin: string, marker = true) => fetch(server.base + '/api/admin/test/live-check', {
    method: 'POST', headers: { Authorization: 'Bearer ' + token, Origin: origin,
      ...(marker ? { 'X-Requested-With': 'VSSDashboard' } : {}) },
  });

  it('allows a valid owner metadata probe on the configured loopback origin', async () => {
    const response = await probe(server.base);
    expect(response.status).toBe(200);
    expect((await response.json()).revision).toBeGreaterThan(0);
  });
  it('rejects a foreign-origin owner mutation instead of bypassing CSRF', async () => {
    const response = await probe('https://attacker.example');
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: 'csrf_check_failed' });
  });
  it('rejects a mutation missing the dashboard request marker', async () => {
    const response = await probe(server.base, false);
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: 'csrf_check_failed' });
  });
  it('keeps private records unavailable without authentication', async () => {
    const response = await fetch(server.base + '/api/admin/inquiries');
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'staff_access_required' });
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });
});
