import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDatabase } from '../helpers/database';
const owner = '10000000-0000-4000-8000-000000000001';
const session = '20000000-0000-4000-8000-000000000001';
describe('production identity, MFA and revocation in real PostgreSQL', () => {
  let db: PGlite;
  beforeAll(async () => { db = await createTestDatabase(); }, 30000);
  afterAll(async () => { await db?.close(); });
  beforeEach(async () => {
    await db.exec(`delete from public.staff_users; delete from auth.users;
      update app_private.security_settings set enforce_mfa=true;
      insert into auth.users(id,email) values('${owner}','owner@example.test');
      insert into public.staff_users(email,role,created_at) values('owner@example.test','owner',0);
      insert into auth.sessions(id,user_id) values('${session}','${owner}');`);
  });
  const verify = async (aal = 'aal2', now = Date.now(), sid = session) => db.transaction(async (tx) => {
    await tx.exec('set local role service_role');
    return (await tx.query<{ result: any }>('select public.verify_staff_session($1::uuid,$2::uuid,$3,$4::bigint) as result', [owner,sid,aal,now])).rows[0]!.result;
  });
  const signals = async (aal: string, sid = session) => db.transaction(async (tx) => {
    await tx.exec('set local role authenticated');
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [owner]);
    await tx.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: owner, aal, session_id: sid })]);
    return (await tx.query<{ scope: string }>('select scope from public.change_signals order by scope')).rows.map(r => r.scope);
  });
  it('binds explicit staff approval to the verified Auth user ID', async () => {
    expect((await db.query<{ auth_user_id: string }>('select auth_user_id from staff_users')).rows[0]!.auth_user_id).toBe(owner);
  });
  it('prevents password-only access through both server RPC and direct browser RLS', async () => {
    expect((await verify('aal1')).ok).toBe(false);
    expect(await signals('aal1')).toEqual(['public']);
    expect(await signals('aal2')).toEqual(['public']);
    expect((await verify()).ok).toBe(true);
    expect(await signals('aal2')).toEqual(['owner','public','staff']);
  });
  it('blocks an already-issued JWT immediately after the underlying session is removed', async () => {
    expect((await verify()).ok).toBe(true);
    await db.exec(`delete from auth.sessions where id='${session}'`);
    expect((await verify()).ok).toBe(false);
    expect(await signals('aal2')).toEqual(['public']);
    expect((await db.query('select * from app_private.staff_sessions')).rows).toHaveLength(0);
  });
  it('does not reset an idle-expired session when its old token is replayed', async () => {
    const now = Date.now();
    expect((await verify('aal2',now)).ok).toBe(true);
    expect((await verify('aal2',now+15*60000+1)).ok).toBe(false);
    expect((await verify('aal2',now+15*60000+2)).ok).toBe(false);
    const newSession = crypto.randomUUID();
    await db.query('insert into auth.sessions(id,user_id) values($1::uuid,$2::uuid)',[newSession,owner]);
    expect((await verify('aal2',Date.now(),newSession)).ok).toBe(true);
  });
  it('enforces the eight-hour absolute lifetime and provider not_after expiry', async () => {
    await db.exec(`update auth.sessions set created_at=now()-interval '9 hours'`);
    expect((await verify()).ok).toBe(false);
    await db.exec(`update auth.sessions set created_at=now(),not_after=now()-interval '1 minute'`);
    expect((await verify()).ok).toBe(false);
  });
  it('does not transfer a deleted staff identity to a new account with the same email', async () => {
    await db.exec(`delete from auth.users where id='${owner}';
      insert into auth.users(id,email) values('${crypto.randomUUID()}','owner@example.test');`);
    expect((await db.query<{ auth_user_id: null }>('select auth_user_id from staff_users')).rows[0]!.auth_user_id).toBeNull();
    expect(await signals('aal2')).toEqual(['public']);
  });
  it('blocks disabled members even with a valid MFA session', async () => {
    expect((await verify()).ok).toBe(true);
    await db.exec('update staff_users set active=false');
    expect((await verify()).ok).toBe(false);
    expect(await signals('aal2')).toEqual(['public']);
  });
  it('keeps session/policy state and verification RPCs inaccessible to browser roles', async () => {
    for (const role of ['anon','authenticated']) {
      for (const sql of ['select * from app_private.staff_sessions',
        'select * from app_private.security_settings',
        `select public.verify_staff_session('${owner}','${session}','aal2',1)`,
        'select public.get_security_readiness()']) {
        await expect(db.transaction(async tx => { await tx.exec('set local role '+role); await tx.exec(sql); })).rejects.toThrow(/permission denied/);
      }
    }
  });
});
