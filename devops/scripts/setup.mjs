import { readFile, writeFile, access } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { ensureLocalSettings } from '../local/settings.mjs';

// Safe to rerun: an existing .env is never changed.
try {
  await access('.env');
  console.log('.env already exists; your values were kept.');
} catch {
  const example = await readFile('.env.example', 'utf8');
  const configured = example.replace(
    'RATE_LIMIT_SECRET=',
    `RATE_LIMIT_SECRET=${randomBytes(32).toString('base64url')}`,
  );
  await writeFile('.env', configured, { flag: 'wx', mode: 0o600 });
  console.log(
    'Created ignored .env with a random rate-limit secret. No account keys were generated.',
  );
}
await ensureLocalSettings();
console.log('Local configuration ready. npm run dev starts the website and local API without cloud keys.');
console.log('Local logins: npm run accounts. Learning path: START-HERE.md.');
console.log('Cloud deployment later: devops/DEPLOYMENT.md, using your own accounts.');
