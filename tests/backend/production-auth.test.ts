import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { requireActor, staffAuthentication } from '../../backend/lib/auth';
const id = '10000000-0000-4000-8000-000000000001';
const sessionId = '20000000-0000-4000-8000-000000000001';
function token(aal = 'aal2') {
  return 'header.' + Buffer.from(JSON.stringify({ sub: id, aal, session_id: sessionId,
    user_metadata: { role: 'owner' } })).toString('base64url') + '.verified-by-provider';
}
function fixture(aal = 'aal2') {
  const jwt = token(aal);
  const user = { id, email: 'owner@example.test', email_confirmed_at: '2026-01-01', is_anonymous: false };
  const row = { auth_user_id: id, email: user.email, role: 'staff', active: true };
  const rpc = vi.fn(async () => ({ data: { ok: true } as { ok?: boolean; error?: string }, error: null }));
  const getUser = vi.fn(async (value) => ({ data: { user: value === jwt ? user : null }, error: null }));
  const db = { auth: { getUser }, from: () => ({ select: () => ({ eq: (key: string, value: string) => {
    expect(key).toBe('auth_user_id'); expect(value).toBe(id);
    return { maybeSingle: async () => ({ data: row, error: null }) };
  } }) }), rpc } as any;
  const request = new Request('https://site.example/api/admin/inquiries', { headers: { Authorization: 'Bearer ' + jwt } });
  return { jwt, user, row, rpc, db, getUser, request };
}
beforeEach(() => { vi.stubEnv('APP_ENV', 'production'); });
afterEach(() => vi.unstubAllEnvs());
describe('production staff identity and MFA', () => {
  it('keeps password-only accounts out of business data while allowing authenticator enrollment', async () => {
    const f = fixture('aal1');
    expect(await staffAuthentication(f.request, f.db)).toMatchObject({ actor: null, eligible: true, mfaRequired: true });
    const result = await requireActor(f.request, f.db);
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(403);
    expect(await (result as Response).json()).toEqual({ error: 'mfa_required' });
    expect(f.rpc).not.toHaveBeenCalled();
  });
  it('uses the validated identity, database role and real session rather than a claimed administrator role', async () => {
    const f = fixture();
    expect(await requireActor(f.request, f.db)).toEqual({ email: f.user.email, role: 'staff' });
    expect(f.rpc).toHaveBeenCalledWith('verify_staff_session', expect.objectContaining({ p_user_id: id, p_session_id: sessionId, p_aal: 'aal2' }));
    expect((await requireActor(f.request, f.db, true) as Response).status).toBe(403);
  });
  it('rejects a modified bearer token even when its decoded claims say aal2', async () => {
    const f = fixture();
    const response = await requireActor(new Request(f.request.url, { headers: { Authorization: 'Bearer ' + f.jwt + 'tampered' } }), f.db);
    expect((response as Response).status).toBe(401);
    expect(f.rpc).not.toHaveBeenCalled();
  });
  it('does not let a recreated account inherit the same email membership', async () => {
    const f = fixture(); f.row.auth_user_id = crypto.randomUUID();
    expect((await requireActor(f.request, f.db) as Response).status).toBe(401);
  });
  it.each(['unconfirmed', 'anonymous', 'disabled'])('rejects %s accounts', async (kind) => {
    const f = fixture();
    if (kind === 'unconfirmed') f.user.email_confirmed_at = '';
    if (kind === 'anonymous') f.user.is_anonymous = true;
    if (kind === 'disabled') f.row.active = false;
    expect((await requireActor(f.request, f.db) as Response).status).toBe(401);
  });
  it('rejects a correctly signed token after server-side session revocation or expiry', async () => {
    const f = fixture(); f.rpc.mockResolvedValue({ data: { ok: false }, error: null });
    expect((await requireActor(f.request, f.db) as Response).status).toBe(401);
  });
  it('fails closed if the production database security switch has not been applied', async () => {
    const f = fixture(); f.rpc.mockResolvedValue({ data: { error: 'security_configuration_required' }, error: null });
    await expect(requireActor(f.request, f.db)).rejects.toThrow('security_configuration_required');
  });
  it('keeps a production database protected even if hosting is mislabeled as staging', async () => {
    vi.stubEnv('APP_ENV', 'staging'); vi.stubEnv('NETLIFY', 'true');
    vi.stubEnv('CONTEXT', 'production'); vi.stubEnv('PUBLIC_TEST_ENVIRONMENT', 'true');
    const f = fixture('aal1');
    f.rpc.mockResolvedValue({ data: { enforceMfa: true } as any, error: null });
    expect(await staffAuthentication(f.request, f.db)).toMatchObject({ actor: null, eligible: true, mfaRequired: true });
    expect(f.rpc).toHaveBeenCalledWith('get_security_readiness');
  });
  it('fails closed when the hosted database policy cannot be read', async () => {
    vi.stubEnv('APP_ENV', 'staging'); vi.stubEnv('NETLIFY', 'true');
    vi.stubEnv('CONTEXT', 'production'); vi.stubEnv('PUBLIC_TEST_ENVIRONMENT', 'true');
    const f = fixture();
    f.rpc.mockResolvedValue({ data: null as any, error: { message: 'unavailable' } as any });
    await expect(staffAuthentication(f.request, f.db)).rejects.toThrow('staff_security_policy_unavailable');
  });
});
