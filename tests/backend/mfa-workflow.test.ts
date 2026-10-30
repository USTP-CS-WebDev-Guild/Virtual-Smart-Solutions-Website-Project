import type { PGlite } from '@electric-sql/pglite';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApplication } from '../../backend/app';
import { createTestDatabase } from '../helpers/database';
import { postgresTransport } from '../helpers/postgres';

const base = 'https://website.example';
const owner = '10000000-0000-4000-8000-000000000001';
const staff = '10000000-0000-4000-8000-000000000002';
const ownerSession = '20000000-0000-4000-8000-000000000001';
const staffSession = '20000000-0000-4000-8000-000000000002';
function token(id: string, session: string, aal: string) {
  return 'synthetic.' + Buffer.from(JSON.stringify({ sub: id, session_id: session, aal })).toString('base64url') + '.SYNTHETIC';
}
const ownerPassword = token(owner, ownerSession, 'aal1');
const ownerMfa = token(owner, ownerSession, 'aal2');
const staffMfa = token(staff, staffSession, 'aal2');

describe('staging MFA through the real API and PostgreSQL without build metadata', () => {
  let database: PGlite;
  let transport: ReturnType<typeof postgresTransport>;
  let app: ReturnType<typeof createApplication>;
  let inquiryId: string;
  beforeAll(async () => {
    database = await createTestDatabase();
    await database.query('insert into auth.users(id,email) values($1::uuid,$2),($3::uuid,$4)',
      [owner, 'owner@example.test', staff, 'staff@example.test']);
    await database.exec(`insert into public.staff_users(email,role,active,created_at)
      values('owner@example.test','owner',true,0),('staff@example.test','staff',true,0)`);
    const receipt = await database.query<{ result: { inquiryId: string } }>(
      'select public.submit_inquiry($1::jsonb,$2::bigint) as result',
      [JSON.stringify({ idempotencyKey: crypto.randomUUID(), name: 'MFA protected inquiry',
        email: 'visitor@example.test', company: 'Synthetic', phone: '', service: 'Not sure yet',
        message: 'Synthetic private record for MFA regression.', privacyNoticeVersion: 'SYNTHETIC-2026-10',
        privacyAcknowledged: true, website: '' }), Date.now()]);
    inquiryId = receipt.rows[0]!.result.inquiryId;
  }, 30_000);
  afterAll(async () => { await database?.close(); });
  beforeEach(async () => {
    vi.stubEnv('APP_ENV', 'staging');
    vi.stubEnv('PUBLIC_TEST_ENVIRONMENT', 'true');
    vi.stubEnv('APP_ORIGIN', base);
    vi.stubEnv('NETLIFY', undefined);
    vi.stubEnv('CONTEXT', undefined);
    await database.exec('update app_private.security_settings set enforce_mfa=true; delete from app_private.staff_sessions; delete from auth.sessions');
    await database.query('insert into auth.sessions(id,user_id) values($1::uuid,$2::uuid),($3::uuid,$4::uuid)',
      [ownerSession, owner, staffSession, staff]);
    transport = postgresTransport(database);
    // Only the provider token-validation boundary is synthetic; application
    // routes, account bindings, security policy, session RPC and RLS are real.
    transport.auth.getUser = async (value: string) => {
      const id = value === ownerPassword || value === ownerMfa ? owner : value === staffMfa ? staff : null;
      return id ? { data: { user: { id, email: id === owner ? 'owner@example.test' : 'staff@example.test',
        email_confirmed_at: '2026-01-01T00:00:00Z' } }, error: null }
        : { data: { user: null }, error: new Error('invalid_token') };
    };
    app = createApplication(() => transport as any);
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
  const call = (path: string, bearer = ownerPassword, method = 'GET') => app(new Request(base + path, {
    method, headers: { Authorization: 'Bearer ' + bearer, Origin: base,
      'X-Requested-With': 'VSSDashboard', 'Content-Type': 'application/json' },
    ...(method === 'PATCH' ? { body: JSON.stringify({ status: 'closed' }) } : {}),
  }));
  const signals = (id: string, session: string, aal: string) => database.transaction(async (tx) => {
    await tx.exec('set local role authenticated');
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [id]);
    await tx.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: id, session_id: session, aal })]);
    return (await tx.query<{ scope: string }>('select scope from public.change_signals order by scope')).rows.map(row => row.scope);
  });

  it('returns the enrollment response instead of opening the password-only owner workspace', async () => {
    const response = await call('/api/auth/session');
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ authenticated: false, eligible: true, mfaRequired: true, user: null });
    expect((await database.query('select * from app_private.staff_sessions')).rows).toEqual([]);
    expect(await signals(owner, ownerSession, 'aal1')).toEqual(['public']);
  });
  it.each(['inquiries', 'clients', 'summary', 'privacy-requests', 'site-content'])(
    'denies password-only reads of %s before accessing business records', async (path) => {
      const rpc = vi.spyOn(transport, 'rpc');
      const response = await call('/api/admin/' + path);
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ error: 'mfa_required' });
      expect(response.headers.get('Cache-Control')).toContain('no-store');
      expect(rpc.mock.calls.map(([name]) => name)).toEqual(['get_security_readiness']);
    });
  it('rejects a password-only mutation without changing the inquiry', async () => {
    const response = await call('/api/admin/inquiries/' + inquiryId + '/status', ownerPassword, 'PATCH');
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'mfa_required' });
    expect((await database.query('select status from public.inquiries where id=$1::uuid', [inquiryId])).rows[0]).toEqual({ status: 'new' });
  });
  it('opens the MFA owner inbox and private Realtime signals only after active-session verification', async () => {
    expect(await signals(owner, ownerSession, 'aal2')).toEqual(['public']);
    const response = await call('/api/admin/inquiries', ownerMfa);
    expect(response.status).toBe(200);
    expect((await response.json()).inquiries).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: inquiryId, name: 'MFA protected inquiry' }),
    ]));
    expect(await signals(owner, ownerSession, 'aal2')).toEqual(['owner', 'public', 'staff']);
  });
  it('retains staff role restrictions after MFA', async () => {
    expect((await call('/api/admin/inquiries', staffMfa)).status).toBe(200);
    const denied = await call('/api/admin/privacy-requests', staffMfa);
    expect(denied.status).toBe(403);
    expect(await denied.json()).toEqual({ error: 'owner_access_required' });
    expect(await signals(staff, staffSession, 'aal2')).toEqual(['public', 'staff']);
  });
  it('rejects the MFA token and private signals after its real session is revoked', async () => {
    expect((await call('/api/admin/inquiries', ownerMfa)).status).toBe(200);
    await database.query('delete from auth.sessions where id=$1::uuid', [ownerSession]);
    const response = await call('/api/admin/inquiries', ownerMfa);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'staff_access_required' });
    expect(await signals(owner, ownerSession, 'aal2')).toEqual(['public']);
  });
  it('keeps optional staging access when its database policy is explicitly unarmed', async () => {
    await database.exec('update app_private.security_settings set enforce_mfa=false');
    const response = await call('/api/auth/session');
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ authenticated: true, mfaRequired: false, user: { role: 'owner' } });
  });
  it('fails closed if the database policy lookup fails', async () => {
    const original = transport.rpc.bind(transport);
    vi.spyOn(transport, 'rpc').mockImplementation(async (name, args) => name === 'get_security_readiness'
      ? { data: null, error: new Error('SYNTHETIC policy lookup failure') } as any : original(name, args));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = await call('/api/admin/inquiries', ownerMfa);
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: 'service_unavailable' });
    expect((await database.query('select * from app_private.staff_sessions')).rows).toEqual([]);
  });
});
