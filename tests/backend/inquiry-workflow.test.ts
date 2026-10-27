import { PGlite } from '@electric-sql/pglite';
import { beforeAll, afterAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import app from '../../backend/app';
import { createDatabase } from '../../backend/lib/database';
import { submitPublicForm } from '../../frontend/scripts/submission';
import { postgresTransport } from '../helpers/postgres';
import { createTestDatabase } from '../helpers/database';

vi.mock('../../backend/lib/database', () => ({ createDatabase: vi.fn() }));
const base = 'https://website.example';
const ownerHeaders = {
  Authorization: 'Bearer synthetic-owner-token',
  Origin: base,
  'X-Requested-With': 'VSSDashboard',
  'Content-Type': 'application/json',
};
const payload = () => ({
  idempotencyKey: crypto.randomUUID(),
  name: 'Website Test 01',
  email: 'student-test@example.test',
  company: 'Class test',
  phone: '',
  service: 'Not sure yet',
  message: 'Testing a new inquiry submitted through the deployed website.',
  privacyAcknowledged: true,
  website: '',
});
const submit = (body: unknown, ip = '192.0.2.1') =>
  app(
    new Request(base + '/api/inquiries', {
      method: 'POST',
      headers: { Origin: base, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { ip },
  );

describe('form → API → PostgreSQL → owner inbox', () => {
  let database: PGlite;
  let transport: ReturnType<typeof postgresTransport>;
  beforeAll(async () => {
    database = await createTestDatabase();
    await database.exec("insert into auth.users(id,email) values('10000000-0000-4000-8000-000000000001','owner@example.test')");
    await database.query(
      "insert into public.staff_users(email,role,active,created_at) values('owner@example.test','owner',true,0)",
    );
    transport = postgresTransport(database);
  }, 30_000);
  afterAll(async () => {
    await database?.close();
  });
  beforeEach(() => {
    vi.stubEnv('CONTEXT', 'production');
    vi.stubEnv('APP_ORIGIN', base);
    vi.stubEnv('RATE_LIMIT_SECRET', 'test-only-random-secret-at-least-32-characters');
    vi.stubEnv('TEST_EMAIL_MODE', 'capture');
    vi.stubEnv('PUBLIC_TEST_ENVIRONMENT', 'false');
    vi.mocked(createDatabase).mockReturnValue(transport as any);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('confirms a new submission, reads it from the owner inbox, persists a status, converts once, and captures its notice', async () => {
    // Browser transport adds the Origin header; all app routes and SQL are real.
    vi.stubGlobal('fetch', (path: string, init: RequestInit) =>
      app(
        new Request(base + path, {
          ...init,
          headers: { ...init.headers, Origin: base },
        }),
        { ip: '192.0.2.1' },
      ),
    );
    const form = payload();
    const receipt = await submitPublicForm('/api/inquiries', form, 'inquiryId');
    expect(receipt.repeated).toBe(false);
    const retry = await submitPublicForm('/api/inquiries', form, 'inquiryId');
    expect(retry).toEqual({ ...receipt, repeated: true });

    const inbox = await app(new Request(base + '/api/admin/inquiries', { headers: ownerHeaders }));
    expect(inbox.status).toBe(200);
    expect((await inbox.json()).inquiries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: receipt.id, name: 'Website Test 01', status: 'new' }),
      ]),
    );
    const counts = await database.query(
      'select (select count(*)::int from inquiries) as inquiries, (select count(*)::int from inquiry_events) as events, (select count(*)::int from outbox) as notices',
    );
    expect(counts.rows[0]).toEqual({ inquiries: 1, events: 1, notices: 1 });

    const changed = await app(
      new Request(base + '/api/admin/inquiries/' + receipt.id + '/status', {
        method: 'PATCH',
        headers: ownerHeaders,
        body: JSON.stringify({ status: 'in_progress' }),
      }),
    );
    expect(changed.status).toBe(200);
    const reloaded = await app(
      new Request(base + '/api/admin/inquiries', { headers: ownerHeaders }),
    );
    expect((await reloaded.json()).inquiries[0].status).toBe('in_progress');
    for (let attempt = 0; attempt < 2; attempt++) {
      const converted = await app(
        new Request(base + '/api/admin/inquiries/' + receipt.id + '/convert', {
          method: 'POST',
          headers: ownerHeaders,
          body: '{}',
        }),
      );
      expect(converted.status).toBe(200);
    }
    expect(
      (await database.query<{ count: number }>('select count(*)::int as count from clients'))
        .rows[0].count,
    ).toBe(1);
    const clients = await app(new Request(base + '/api/admin/clients', { headers: ownerHeaders }));
    const clientId = (await clients.json()).clients[0].id;
    expect(
      (
        await app(
          new Request(base + '/api/admin/clients/' + clientId + '/status', {
            method: 'PATCH',
            headers: ownerHeaders,
            body: JSON.stringify({ status: 'paused' }),
          }),
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await database.query<{ status: string }>('select status from clients where id=$1::uuid', [
          clientId,
        ])
      ).rows[0]!.status,
    ).toBe('paused');
    const noteKey = crypto.randomUUID();
    for (let i = 0; i < 2; i++) {
      const note = await app(
        new Request(base + '/api/admin/inquiries/' + receipt.id + '/notes', {
          method: 'POST',
          headers: ownerHeaders,
          body: JSON.stringify({
            idempotencyKey: noteKey,
            body: 'Agreed a follow-up on the next business day.',
          }),
        }),
      );
      expect(note.status).toBe(i === 0 ? 201 : 200);
    }
    expect(
      (await database.query<{ count: number }>('select count(*)::int as count from inquiry_notes'))
        .rows[0]!.count,
    ).toBe(1);
    // Manual maintenance is an isolated capture-only staging tool. Production
    // invokes the same service handlers through Netlify's scheduler instead.
    vi.stubEnv('PUBLIC_TEST_ENVIRONMENT', 'true');
    const maintenance = await app(
      new Request(base + '/api/admin/test/run-jobs', {
        method: 'POST',
        headers: ownerHeaders,
        body: '{}',
      }),
    );
    expect(maintenance.status).toBe(200);
    expect((await maintenance.json()).email).toMatchObject({ processed: 1, captured: 1 });
    expect(
      (await database.query<{ delivery_status: string }>('select delivery_status from outbox'))
        .rows[0].delivery_status,
    ).toBe('test_captured');
  });

  it('reports missing configuration as a service failure, not an exhausted visitor quota', async () => {
    vi.stubEnv('RATE_LIMIT_SECRET', '');
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = await submit(payload(), '192.0.2.2');
    expect(response.status).toBe(503);
    expect(response.headers.get('X-Request-ID')).toBeTruthy();
    expect(log.mock.calls.flat().join(' ')).toContain('rate_limit_not_configured');
    const check = await app(
      new Request(base + '/api/admin/submission-checks', { headers: ownerHeaders }),
    );
    const result = await check.json();
    expect(result.ok).toBe(false);
    expect(result.checks[0]).toMatchObject({ ok: false });
    expect(result.checks[0].message).toContain('RATE_LIMIT_SECRET');
    expect(JSON.stringify(result)).not.toContain('synthetic-owner-token');
  });

  it('keeps rate limiting in place with a usable retry interval and separate client buckets', async () => {
    for (let i = 0; i < 5; i++) expect((await submit(payload(), '192.0.2.3')).status).toBe(202);
    const limited = await submit(payload(), '192.0.2.3');
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get('Retry-After'))).toBeGreaterThan(0);
    expect((await submit(payload(), '192.0.2.4')).status).toBe(202);
  });

  it('does not disguise a database rate-limit failure as a visitor quota', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(createDatabase).mockReturnValue({
      ...transport,
      rpc: (name: string, values: Record<string, unknown>) =>
        name === 'consume_rate_limit'
          ? Promise.resolve({ data: null, error: { code: '42883' } })
          : transport.rpc(name, values),
    } as any);
    const response = await submit(payload(), '192.0.2.7');
    expect(response.status).toBe(503);
    expect(response.headers.get('Retry-After')).toBeNull();
  });

  it('does not return a saved receipt for a honeypot submission', async () => {
    const form = { ...payload(), website: 'automatically-filled.example' };
    const response = await submit(form, '192.0.2.5');
    expect(await response.json()).not.toHaveProperty('inquiryId');
    const existing = await database.query(
      'select id from inquiries where idempotency_key=$1::uuid',
      [form.idempotencyKey],
    );
    expect(existing.rows).toHaveLength(0);
  });

  it('returns a privacy receipt linked to a stored record', async () => {
    const privacy = { ...payload(), requestType: 'access' };
    const response = await app(
      new Request(base + '/api/privacy-requests', {
        method: 'POST',
        headers: { Origin: base, 'Content-Type': 'application/json' },
        body: JSON.stringify(privacy),
      }),
      { ip: '192.0.2.6' },
    );
    const result = await response.json();
    expect(response.status).toBe(202);
    expect(result.privacyRequestId).toBe(privacy.idempotencyKey);
    expect(
      (
        await database.query('select id from privacy_requests where id=$1::uuid', [
          result.privacyRequestId,
        ])
      ).rows,
    ).toHaveLength(1);
  });
});
