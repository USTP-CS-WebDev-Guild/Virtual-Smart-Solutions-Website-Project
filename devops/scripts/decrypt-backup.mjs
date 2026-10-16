import { scryptSync, createDecipheriv } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const [, , inputPath, outputPath] = process.argv;
const passphrase = process.env.BACKUP_ENCRYPTION_KEY;
if (!inputPath || !outputPath || !passphrase) {
  console.error(
    'Usage: BACKUP_ENCRYPTION_KEY=<secret> node decrypt-backup.mjs backup.sql.enc backup.sql',
  );
  process.exit(2);
}
const encrypted = readFileSync(inputPath);
const magic = Buffer.from('STDBK1');
if (encrypted.length < 50 || !encrypted.subarray(0, magic.length).equals(magic)) {
  console.error('This file is not a supported VSS Website backup.');
  process.exit(2);
}
const salt = encrypted.subarray(6, 22);
const iv = encrypted.subarray(22, 34);
const tag = encrypted.subarray(34, 50);
const ciphertext = encrypted.subarray(50);
const key = scryptSync(passphrase, salt, 32);
try {
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAAD(magic);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  writeFileSync(outputPath, plaintext, { mode: 0o600, flag: 'wx' });
} catch {
  console.error('Could not decrypt this backup. Check the key and file.');
  process.exit(1);
}
