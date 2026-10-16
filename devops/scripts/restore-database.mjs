import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [, , encryptedFile] = process.argv;
const connection = process.env.RESTORE_DATABASE_URL;
if (!encryptedFile || !connection || !process.env.BACKUP_ENCRYPTION_KEY) {
  console.error(
    'Usage: set RESTORE_DATABASE_URL to an empty staging database, then run npm run db:restore -- backup.sql.enc',
  );
  process.exit(2);
}
const prompt = createInterface({ input: stdin, output: stdout });
const answer = await prompt.question(
  'This writes records into the database in RESTORE_DATABASE_URL. Type RESTORE into EMPTY TEST PROJECT to continue: ',
);
prompt.close();
if (answer !== 'RESTORE into EMPTY TEST PROJECT') {
  console.error('Restore cancelled.');
  process.exit(1);
}
const work = mkdtempSync(join(tmpdir(), 'vss-restore-'));
const sqlFile = join(work, 'database.sql');
try {
  const decrypt = spawnSync(
    process.execPath,
    ['devops/scripts/decrypt-backup.mjs', encryptedFile, sqlFile],
    { stdio: 'inherit', env: { ...process.env } },
  );
  if (decrypt.error || decrypt.status !== 0) throw new Error('Backup decryption failed.');
  const psql = spawnSync(
    'psql',
    [connection, '--single-transaction', '-v', 'ON_ERROR_STOP=1', '--file', sqlFile],
    { stdio: 'inherit' },
  );
  if (psql.error || psql.status !== 0) throw new Error('Database restore failed.');
  console.log('Restore completed. Verify the staging database before any production action.');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Restore failed.');
  process.exitCode = 1;
} finally {
  rmSync(work, { recursive: true, force: true });
}
