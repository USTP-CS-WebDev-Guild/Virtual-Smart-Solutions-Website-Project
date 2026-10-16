import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { exportApplicationSql } from './backup-export.mjs';

const connection = process.env.SUPABASE_DB_URL;
const passphrase = process.env.BACKUP_ENCRYPTION_KEY;
if (!connection || !passphrase || passphrase.length < 24) {
  console.error('Set SUPABASE_DB_URL and BACKUP_ENCRYPTION_KEY in your terminal environment.');
  process.exit(2);
}
const work = mkdtempSync(join(tmpdir(), 'vss-backup-'));
const dump = join(work, 'database.sql');
const encrypted = resolve(
  process.argv[2] || `vss-${new Date().toISOString().replaceAll(':', '-')}.sql.enc`,
);
try {
  writeFileSync(dump, exportApplicationSql(connection, work), { mode: 0o600 });
  const crypt = spawnSync(
    process.execPath,
    ['devops/scripts/encrypt-backup.mjs', dump, encrypted],
    { stdio: 'inherit', env: { ...process.env }, shell: false },
  );
  if (crypt.error || crypt.status !== 0) throw new Error('Backup encryption failed.');
  console.log(`Encrypted schema AND data backup created: ${encrypted}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Backup failed.');
  process.exitCode = 1;
} finally {
  rmSync(work, { recursive: true, force: true });
}
