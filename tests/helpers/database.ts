import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

export async function createTestDatabase() {
  const db = new PGlite();
  // Supabase-managed objects are fixtures; application migrations stay intact.
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key,email text);
    alter table auth.users add column if not exists email_confirmed_at timestamptz default now();
    alter table auth.users add column if not exists is_anonymous boolean default false;
    create table if not exists auth.sessions(id uuid primary key,user_id uuid references auth.users(id) on delete cascade,
      created_at timestamptz default now(),not_after timestamptz);
    create or replace function auth.jwt() returns jsonb language sql stable as
      $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to anon,authenticated,service_role;
  `);
  const directory = new URL('../../backend/database/migrations/', import.meta.url);
  for (const name of (await readdir(directory)).filter((name) => name.endsWith('.sql')).sort()) {
    await db.exec(await readFile(new URL(name, directory), 'utf8'));
  }
  return db;
}
