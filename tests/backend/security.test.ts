import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
beforeEach(() => vi.stubEnv('APP_ORIGIN', 'https://site.example'));
afterEach(() => vi.unstubAllEnvs());
import { sameOrigin, readJson } from '../../backend/http/responses';

describe('request boundaries', () => {
  it('accepts same-origin browser mutations and rejects foreign origins', () => {
    expect(
      sameOrigin(
        new Request('https://site.example/api/admin/inquiries', {
          headers: { Origin: 'https://site.example' },
        }),
      ),
    ).toBe(true);
    expect(
      sameOrigin(
        new Request('https://site.example/api/admin/inquiries', {
          headers: { Origin: 'https://attacker.example' },
        }),
      ),
    ).toBe(false);
  });
  it('only accepts missing Origin when development context is explicitly enabled', () => {
    const prior = process.env.CONTEXT;
    process.env.CONTEXT = 'dev';
    expect(sameOrigin(new Request('http://127.0.0.1:4321/api/inquiries', { method: 'POST' }))).toBe(
      true,
    );
    process.env.CONTEXT = 'production';
    expect(sameOrigin(new Request('https://site.example/api/inquiries', { method: 'POST' }))).toBe(
      false,
    );
    if (prior === undefined) delete process.env.CONTEXT;
    else process.env.CONTEXT = prior;
  });
  it('rejects malformed and oversized JSON before route handling', async () => {
    const malformed = await readJson(
      new Request('https://site.example', { method: 'POST', body: '{' }),
      100,
    );
    const oversized = await readJson(
      new Request('https://site.example', { method: 'POST', body: '12345' }),
      4,
    );
    expect(malformed).toEqual({ ok: false, status: 400 });
    expect(oversized).toEqual({ ok: false, status: 413 });
  });
});
