import { randomBytes, scryptSync, createCipheriv } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const [, , inputPath, outputPath] = process.argv;
const passphrase = process.env.BACKUP_ENCRYPTION_KEY;
if (!inputPath || !outputPath || !passphrase || passphrase.length < 24) {
  console.error(
    'Usage: BACKUP_ENCRYPTION_KEY=<long secret> node encrypt-backup.mjs input.sql output.sql.enc',
  );
  process.exit(2);
}
const magic = Buffer.from('STDBK1');
const salt = randomBytes(16);
const iv = randomBytes(12);
const key = scryptSync(passphrase, salt, 32);
const cipher = createCipheriv('aes-256-gcm', key, iv);
cipher.setAAD(magic);
const plaintext = readFileSync(inputPath);
const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
const output = Buffer.concat([magic, salt, iv, cipher.getAuthTag(), ciphertext]);
writeFileSync(outputPath, output, { mode: 0o600 });
