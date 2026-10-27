// DevOps owns this local-only runtime. Netlify never imports it.
import { PGlite } from '@electric-sql/pglite';
import { mkdir, readFile, readdir, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { ensureLocalSettings } from './settings.mjs';
export async function openClassroomDatabase(root: string) {
  const settings = await ensureLocalSettings(root);
  const folder = join(root, '.local');
  const lock = join(folder, 'server.lock');
  try {
    const pid = Number(await readFile(lock, 'utf8'));
    let running = false;
    try {
      process.kill(pid, 0);
      running = true;
    } catch {
      /* An old crashed process has exited. */
    }
    if (running)
      throw new Error(
        'Classroom database is already open. Stop the other npm run dev terminal with Ctrl+C.',
      );
    await unlink(lock);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  await writeFile(lock, String(process.pid), { flag: 'wx', mode: 0o600 });
  await mkdir(join(folder, 'database'), { recursive: true });
  const db = new PGlite(join(folder, 'database'));
  try {
    await db.exec(`
      do $$ begin
        if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
        if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
        if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role bypassrls; end if;
      end $$;
      create schema if not exists auth;
      create table if not exists auth.users(id uuid primary key,email text);
    alter table auth.users add column if not exists email_confirmed_at timestamptz default now();
    alter table auth.users add column if not exists is_anonymous boolean default false;
    create table if not exists auth.sessions(id uuid primary key,user_id uuid references auth.users(id) on delete cascade,
      created_at timestamptz default now(),not_after timestamptz);
    create or replace function auth.jwt() returns jsonb language sql stable as
      $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
      create or replace function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to anon,authenticated,service_role;
      create schema if not exists classroom_private;
      create table if not exists classroom_private.migrations(name text primary key,checksum text not null);
    `);
    const folder = join(root, 'backend/database/migrations');
    for (const name of (await readdir(folder)).filter((name) => name.endsWith('.sql')).sort()) {
      const sql = await readFile(join(folder, name), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const applied = await db.query<{
        checksum: string;
      }>('select checksum from classroom_private.migrations where name=$1', [name]);
      if (applied.rows.length) {
        if (applied.rows[0]!.checksum !== checksum)
          throw new Error(
            `Applied migration ${name} changed. Add a new migration; use reset:local only for disposable classroom data.`,
          );
        continue;
      }
      // Schema changes and their checksum commit together. Canonical SQL files
      // may carry an outer transaction for the dashboard installer.
      const statements = sql.replace(/^\s*(?:begin|commit);\s*$/gim, '');
      await db.transaction(async (tx) => {
        await tx.exec(statements);
        await tx.query('insert into classroom_private.migrations(name,checksum) values($1,$2)', [
          name,
          checksum,
        ]);
      });
    }
    for (const account of settings.accounts) {
      await db.query(
        'insert into auth.users(id,email) values($1::uuid,$2) on conflict(id) do nothing',
        [account.id, account.email],
      );
      await db.query(
        'insert into public.staff_users(email,role,active,created_at) values($1,$2,true,$3) on conflict(email) do nothing',
        [account.email, account.role, Date.now()],
      );
    }
    return {
      db,
      settings,
      close: async () => {
        await db.close();
        await unlink(lock).catch(() => {});
      },
    };
  } catch (error) {
    await db.close();
    await unlink(lock).catch(() => {});
    throw error;
  }
}
