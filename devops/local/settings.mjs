import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
export async function ensureLocalSettings(root = process.cwd()) {
  const directory = join(root, '.local');
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const path = join(directory, 'accounts.json');
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const passwords = [];
  const accounts = ['owner', 'staff'].map((role) => {
    const password = randomBytes(18).toString('base64url');
    const salt = randomBytes(16).toString('hex');
    passwords.push({ role, email: role + '@classroom.test', password });
    return {
      id: randomUUID(),
      email: role + '@classroom.test',
      role,
      salt,
      hash: scryptSync(password, salt, 32).toString('hex'),
    };
  });
  const settings = { rateLimitSecret: randomBytes(32).toString('hex'), accounts };
  await writeFile(path, JSON.stringify(settings, null, 2), { flag: 'wx', mode: 0o600 });
  const guide =
    '# Local classroom accounts\n\nThese random accounts work only on this computer in classroom mode.\nThey are not Supabase or production accounts. Do not reuse these passwords.\n\n' +
    passwords
      .map((item) => `## ${item.role}\nEmail: ${item.email}\nPassword: ${item.password}\n`)
      .join('\n') +
    '\nOpen http://127.0.0.1:4321/ and use Owner sign-in in the footer.\n';
  await writeFile(join(directory, 'LOCAL-ACCESS.md'), guide, { flag: 'wx', mode: 0o600 });
  return settings;
}
export function verifyLocalPassword(account, password) {
  if (typeof password !== 'string' || password.length > 200) return false;
  const candidate = scryptSync(password, account.salt, 32);
  return timingSafeEqual(candidate, Buffer.from(account.hash, 'hex'));
}
