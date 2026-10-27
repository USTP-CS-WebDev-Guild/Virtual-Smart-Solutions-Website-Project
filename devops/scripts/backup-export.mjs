import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// Supabase's default dump is schema-only. Export data explicitly, too.
// Keep schema migrations paused during this two-part export.
export function exportApplicationSql(connection, work, run = spawnSync) {
  const schema = join(work, 'schema.sql');
  const data = join(work, 'data.sql');
  for (const [label, file, extra] of [
    ['schema', schema, []],
    // Sessions and staff approvals are deliberately re-established after a
    // restore. Auth user IDs from another Supabase project are not portable.
    ['data', data, ['--data-only', '--use-copy', '--exclude', 'app_private.staff_sessions,public.staff_users']],
  ]) {
    const result = run(
      'supabase',
      [
        'db',
        'dump',
        '--db-url',
        connection,
        '--schema',
        'public,app_private',
        '--file',
        file,
        ...extra,
      ],
      { stdio: 'pipe', encoding: 'utf8' },
    );
    if (result.error || result.status !== 0 || !existsSync(file) || !readFileSync(file).length) {
      throw new Error(
        `Supabase ${label} export failed. Install the Supabase CLI and Docker, or use the GitHub backup runner.`,
      );
    }
  }
  // New target projects can otherwise inherit broader Supabase default grants.
  const preamble = [
    '-- Application schema/data backup; restore into EMPTY Supabase staging first.',
    '-- No live sessions or staff approvals: recreate verified Auth accounts and explicitly bind their new IDs after restore.',
    'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;',
    'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM public, anon, authenticated;',
  ].join('\n');
  return Buffer.concat([
    Buffer.from(preamble + '\n'),
    readFileSync(schema),
    Buffer.from('\n-- APPLICATION DATA\n'),
    readFileSync(data),
  ]);
}
