import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { requestGuard } from '../../backend/security/request-guard';
import { sameOrigin, json } from '../../backend/http/responses';
beforeEach(() => { vi.stubEnv('APP_ENV', 'production'); vi.stubEnv('CONTEXT', 'production'); vi.stubEnv('APP_ORIGIN', 'https://site.example'); });
afterEach(() => vi.unstubAllEnvs());
describe('canonical request boundary', () => {
  it('accepts a configured HTTPS origin and rejects an attacker-controlled target host', () => {
    for (const origin of ['https://site.example', 'https://attacker.example']) {
      const request = new Request(origin + '/api/health/live');
      expect(requestGuard(request, new URL(request.url))?.status ?? 200).toBe(origin.includes('attacker') ? 403 : 200);
    }
  });
  it('fails closed when the production origin is missing', () => {
    vi.stubEnv('APP_ORIGIN', '');
    const request = new Request('https://site.example/api/inquiries', { headers: { Origin: 'https://site.example' } });
    expect(sameOrigin(request)).toBe(false);
    expect(requestGuard(request, new URL(request.url))?.status).toBe(503);
  });
  it.each(['https://site.example/path', 'https://site.example/', 'null', 'https://evil@site.example'])('rejects an invalid serialized Origin: %s', (origin) => {
    expect(sameOrigin(new Request('https://site.example/api/inquiries', { headers: { Origin: origin } }))).toBe(false);
  });
  it.each(['/api/admin/inquiries?status=new&status=closed', '/api/admin/inquiries%2fsecret', '/api//admin/inquiries'])('rejects ambiguous routing: %s', (path) => {
    const request = new Request('https://site.example' + path);
    expect(requestGuard(request, new URL(request.url))?.status).toBe(400);
  });
  it('rejects compressed bodies and conflicting transfer framing', () => {
    for (const headers of [new Headers({ 'Content-Encoding': 'gzip' }), new Headers({ 'Content-Length': '2', 'Transfer-Encoding': 'chunked' })]) {
      const request = new Request('https://site.example/api/inquiries', { method: 'POST', headers });
      expect([400, 415]).toContain(requestGuard(request, new URL(request.url))?.status);
    }
  });
  it('rejects foreign browser fetches while preserving signed service webhooks', () => {
    for (const path of ['/api/inquiries', '/api/webhooks/resend']) {
      const request = new Request('https://site.example' + path, { method: 'POST', headers: { 'Sec-Fetch-Site': 'cross-site' } });
      expect(requestGuard(request, new URL(request.url))?.status ?? 200).toBe(path.includes('webhooks') ? 200 : 403);
    }
  });
  it('disables browser and CDN caching even on errors and private JSON', () => {
    const response = json({ error: 'staff_access_required' }, 401);
    for (const name of ['Cache-Control','CDN-Cache-Control','Netlify-CDN-Cache-Control']) expect(response.headers.get(name)).toBe('no-store');
    expect(response.headers.get('Content-Security-Policy')).toContain("default-src 'none'");
    expect(response.headers.has('Access-Control-Allow-Origin')).toBe(false);
  });
});
