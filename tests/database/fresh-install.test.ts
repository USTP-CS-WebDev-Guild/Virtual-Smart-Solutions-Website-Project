import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { expect, it } from 'vitest';

it('fresh hosted installer installs permissions atomically and refuses to overwrite an existing app', async () => {
  const db = new PGlite();
  try {
    // Supabase supplies these objects; this fixture supplies only that boundary.
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key,email text);
      alter table auth.users add column email_confirmed_at timestamptz default now();
      alter table auth.users add column is_anonymous boolean default false;
      create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id) on delete cascade,
        created_at timestamptz default now(),not_after timestamptz);
      create function auth.jwt() returns jsonb language sql stable as
        $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to anon,authenticated,service_role;`);
    const installer = await readFile(
      new URL('../../backend/database/INSTALL-FRESH.sql', import.meta.url),
      'utf8',
    );
    await db.exec(installer);
    expect(
      (
        await db.query<{ ready: Record<string, boolean> }>(
          'select public.get_realtime_setup() as ready',
        )
      ).rows[0]!.ready,
    ).toMatchObject({ publication: true, signals: true, triggers: true, rls: true });
    expect(
      (
        await db.query<{ allowed: boolean }>(
          "select has_table_privilege('anon','public.inquiries','select') as allowed",
        )
      ).rows[0]!.allowed,
    ).toBe(false);
    await expect(db.exec(installer)).rejects.toThrow('Existing application database');
    await db.exec('rollback');
    expect((await db.query('select * from public.change_signals')).rows).toHaveLength(3);
  } finally {
    await db.close();
  }
}, 30_000);
