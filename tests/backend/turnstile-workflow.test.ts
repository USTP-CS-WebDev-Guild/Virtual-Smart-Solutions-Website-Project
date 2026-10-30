import { PGlite } from '@electric-sql/pglite';
import { beforeAll, afterAll, beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import app from '../../backend/app';
import { createDatabase } from '../../backend/lib/database';
import { createTestDatabase } from '../helpers/database';
import { postgresTransport } from '../helpers/postgres';
vi.mock('../../backend/lib/database', () => ({ createDatabase: vi.fn() }));
const base = 'https://website.example';
let requestNumber = 10;
const submit = (kind: 'inquiries' | 'privacy-requests', captchaToken?: string) => app(new Request(base + '/api/' + kind, {
  method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json' },
  body: JSON.stringify({ idempotencyKey: crypto.randomUUID(), name: 'Synthetic Test', email: crypto.randomUUID() + '@example.test',
    company: 'Synthetic', phone: '', service: 'Not sure yet', requestType: 'access', message: 'Synthetic verification test.',
    privacyAcknowledged: true, website: '', captchaToken }),
}), { ip: '192.0.2.' + requestNumber++ });
describe('Turnstile before a real PostgreSQL commit', () => {
  let db: PGlite;
  beforeAll(async () => { db = await createTestDatabase(); }, 30_000);
  afterAll(async () => { await db?.close(); });
  beforeEach(() => {
    vi.stubEnv('APP_ENV', 'production'); vi.stubEnv('APP_ORIGIN', base); vi.stubEnv('PUBLIC_TEST_ENVIRONMENT', 'false');
    vi.stubEnv('RATE_LIMIT_SECRET', 'SYNTHETIC-rate-limit-secret-at-least-32-characters');
    vi.stubEnv('PUBLIC_TURNSTILE_SITE_KEY', '0x4SYNTHETIC_SITEKEY_123456');
    vi.stubEnv('TURNSTILE_SECRET_KEY', '0x4SYNTHETIC_SECRET_NOT_A_REAL_KEY_12345678');
    vi.mocked(createDatabase).mockReturnValue(postgresTransport(db) as any);
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
  it('rejects missing tokens without creating inquiries, events or outbox rows', async () => {
    const call = vi.fn(); vi.stubGlobal('fetch', call);
    expect((await submit('inquiries')).status).toBe(403); expect(call).not.toHaveBeenCalled();
    const count = await db.query('select (select count(*)::int from inquiries) as inquiries, (select count(*)::int from inquiry_events) as events, (select count(*)::int from outbox) as notices');
    expect(count.rows[0]).toEqual({ inquiries: 0, events: 0, notices: 0 });
  });
  it('commits the inquiry and notification only after the configured-host inquiry check succeeds', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ success: true, hostname: 'website.example', action: 'inquiry' })));
    const response = await submit('inquiries', 'synthetic-token'); expect(response.status).toBe(202);
    const receipt = await response.json(); expect(receipt.ok).toBe(true);
    const count = await db.query('select (select count(*)::int from inquiries) as inquiries, (select count(*)::int from inquiry_events) as events, (select count(*)::int from outbox) as notices');
    expect(count.rows[0]).toEqual({ inquiries: 1, events: 1, notices: 1 });
  });
  it('does not reuse an inquiry or another-host token for privacy requests; correct action saves a separate request', async () => {
    const call = vi.fn(async () => Response.json({ success: true, hostname: 'website.example', action: 'inquiry' }));
    vi.stubGlobal('fetch', call);
    expect((await submit('privacy-requests', 'synthetic-token')).status).toBe(403);
    call.mockImplementation(async () => Response.json({ success: true, hostname: 'attacker.example', action: 'privacy_request' }));
    expect((await submit('privacy-requests', 'synthetic-token')).status).toBe(403);
    expect((await db.query('select count(*)::int as count from privacy_requests')).rows[0]).toEqual({ count: 0 });
    call.mockImplementation(async () => Response.json({ success: true, hostname: 'website.example', action: 'privacy_request' }));
    expect((await submit('privacy-requests', 'synthetic-token')).status).toBe(202);
    expect((await db.query('select count(*)::int as count from privacy_requests')).rows[0]).toEqual({ count: 1 });
  });
});
