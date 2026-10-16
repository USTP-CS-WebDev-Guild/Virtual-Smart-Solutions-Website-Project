import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDatabase } from '../helpers/database';

const owner = '10000000-0000-4000-8000-000000000001';
const staff = '10000000-0000-4000-8000-000000000002';
const outsider = '10000000-0000-4000-8000-000000000003';
const disabled = '10000000-0000-4000-8000-000000000004';
describe('realtime permissions and transactional signals', () => {
  let db: PGlite;
  beforeAll(async () => {
    db = await createTestDatabase();
    await db.exec(`
      insert into auth.users(id,email) values
      ('${owner}','owner@example.test'),('${staff}','staff@example.test'),
      ('${outsider}','outsider@example.test'),('${disabled}','disabled@example.test');
      insert into public.staff_users(email,role,active,created_at) values
      ('owner@example.test','owner',true,0),('staff@example.test','staff',true,0),('disabled@example.test','owner',false,0);
    `);
  }, 30_000);
  afterAll(async () => {
    await db?.close();
  });
  const asRole = (role: string, id: string | null, sql: string) =>
    db.transaction(async (tx) => {
      await tx.exec('set local role ' + role);
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [id || '']);
      return tx.query<{ scope: string }>(sql);
    });
  it.each([
    ['anon', null, ['public']],
    ['authenticated', outsider, ['public']],
    ['authenticated', disabled, ['public']],
    ['authenticated', staff, ['public', 'staff']],
    ['authenticated', owner, ['owner', 'public', 'staff']],
  ])('restricts signal rows for %s / %s', async (role, id, allowed) => {
    const rows = await asRole(
      role as string,
      id as string | null,
      'select scope from public.change_signals order by scope',
    );
    expect(rows.rows.map((row) => row.scope)).toEqual(allowed);
  });
  it('never grants customer records, staff membership, or notes to browser roles', async () => {
    for (const role of ['anon', 'authenticated']) {
      for (const table of [
        'inquiries',
        'clients',
        'privacy_requests',
        'outbox',
        'inquiry_notes',
        'staff_users',
      ]) {
        await expect(asRole(role, owner, 'select * from public.' + table)).rejects.toThrow(
          /permission denied/,
        );
      }
      for (const verb of [
        "insert into public.change_signals(scope) values('forged')",
        'update public.change_signals set revision=9000',
        'delete from public.change_signals',
      ]) {
        await expect(asRole(role, owner, verb)).rejects.toThrow(/permission denied/);
      }
    }
  });
  it('does not expose server RPCs through the public API roles', async () => {
    for (const role of ['anon', 'authenticated']) {
      await expect(asRole(role, owner, 'select public.get_realtime_setup()')).rejects.toThrow(
        /permission denied/,
      );
      await expect(
        asRole(
          role,
          owner,
          "select public.add_inquiry_note(gen_random_uuid(),gen_random_uuid(),'note','forged@example.test',1)",
        ),
      ).rejects.toThrow(/permission denied/);
    }
  });
  it('streams only version metadata and enables exactly that table in a fresh publication', async () => {
    const columns = await db.query<{ column_name: string }>(
      "select column_name from information_schema.columns where table_schema='public' and table_name='change_signals' order by ordinal_position",
    );
    expect(columns.rows.map((row) => row.column_name)).toEqual(['scope', 'revision', 'changed_at']);
    const publication = await db.query<{ tablename: string }>(
      "select tablename from pg_publication_tables where pubname='supabase_realtime'",
    );
    expect(publication.rows.map((row) => row.tablename)).toEqual(['change_signals']);
    const setup = await db.query<{ setup: Record<string, boolean> }>(
      'select public.get_realtime_setup() as setup',
    );
    expect(Object.values(setup.rows[0]!.setup).every(Boolean)).toBe(true);
    const tables = await db.query<{ relname: string }>(
      "select relname from pg_class join pg_namespace n on n.oid=relnamespace where n.nspname='public' and relkind='r' and not relrowsecurity",
    );
    expect(tables.rows).toEqual([]);
  });
  it('advances the staff signal in the inquiry transaction and rolls it back together', async () => {
    const before = await db.query<{ revision: number }>(
      "select revision from public.change_signals where scope='staff'",
    );
    await expect(
      db.transaction(async (tx) => {
        await tx.query('select public.submit_inquiry($1::jsonb,$2::bigint)', [
          JSON.stringify({
            idempotencyKey: crypto.randomUUID(),
            name: 'Rolled back',
            email: 'rollback@example.test',
            service: 'Not sure yet',
            message: 'A transaction check',
            privacyNoticeVersion: 'test',
          }),
          Date.now(),
        ]);
        const signal = await tx.query<{ revision: number }>(
          "select revision from public.change_signals where scope='staff'",
        );
        expect(Number(signal.rows[0]!.revision)).toBeGreaterThan(Number(before.rows[0]!.revision));
        throw new Error('intentional_rollback');
      }),
    ).rejects.toThrow('intentional_rollback');
    const after = await db.query<{ revision: number }>(
      "select revision from public.change_signals where scope='staff'",
    );
    expect(after.rows[0]!.revision).toBe(before.rows[0]!.revision);
    expect(
      (await db.query("select id from public.inquiries where email='rollback@example.test'")).rows,
    ).toHaveLength(0);
  });
  it('stops authorizing private signals after staff offboarding', async () => {
    await db.query("update public.staff_users set active=false where email='staff@example.test'");
    expect(
      (
        await asRole(
          'authenticated',
          staff,
          'select scope from public.change_signals order by scope',
        )
      ).rows.map((row) => row.scope),
    ).toEqual(['public']);
  });
  it('anonymizes follow-up notes with a verified deletion and prevents reopening deleted records', async () => {
    const now = Date.now();
    const created = await db.query<{ result: { inquiryId: string } }>(
      'select public.submit_inquiry($1::jsonb,$2::bigint) as result',
      [
        JSON.stringify({
          idempotencyKey: crypto.randomUUID(),
          name: 'Delete Fixture',
          email: 'delete-fixture@example.test',
          service: 'Not sure yet',
          message: 'A synthetic deletion test',
          privacyNoticeVersion: 'test',
        }),
        now,
      ],
    );
    const inquiry = created.rows[0]!.result.inquiryId;
    await db.query(
      'select public.add_inquiry_note($1::uuid,$2::uuid,$3::text,$4::text,$5::bigint)',
      [
        crypto.randomUUID(),
        inquiry,
        'Personal context that must be removed.',
        'owner@example.test',
        now,
      ],
    );
    const privacy = crypto.randomUUID();
    await db.query('select public.submit_privacy_request($1::jsonb,$2::bigint)', [
      JSON.stringify({
        idempotencyKey: privacy,
        name: 'Delete Fixture',
        email: 'delete-fixture@example.test',
        requestType: 'deletion',
        message: 'Delete my synthetic records.',
      }),
      now,
    ]);
    await db.query(
      "select public.complete_privacy_request($1::uuid,'owner@example.test','delete_all_records','Synthetic identity verified for the test fixture.',$2::bigint)",
      [privacy, now],
    );
    const notes = await db.query<{
      body: string;
      created_by: string | null;
      anonymized_at: number | null;
    }>('select body,created_by,anonymized_at from public.inquiry_notes where inquiry_id=$1::uuid', [
      inquiry,
    ]);
    expect(notes.rows[0]).toMatchObject({ body: '', created_by: null });
    expect(notes.rows[0]!.anonymized_at).not.toBeNull();
    const converted = await db.query<{ result: { error: string } }>(
      "select public.convert_inquiry($1::uuid,'owner@example.test',$2::bigint) as result",
      [inquiry, now],
    );
    expect(converted.rows[0]!.result.error).toBe('record_anonymized');
    const changed = await db.query<{ result: { error: string } }>(
      "select public.change_inquiry_status($1::uuid,'new','owner@example.test',$2::bigint) as result",
      [inquiry, now],
    );
    expect(changed.rows[0]!.result.error).toBe('record_anonymized');
  });
});
