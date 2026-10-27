import { existsSync } from 'node:fs';
import { ensureLocalSettings } from '../local/settings.mjs';

let problems = 0;
function check(ok, message) {
  console.log(`${ok ? 'OK' : 'SETUP'} ${message}`);
  if (!ok) problems += 1;
}
function value(name) {
  return (process.env[name] || '').trim();
}
function validUrl(name) {
  try {
    const url = new URL(value(name));
    return (
      ['http:', 'https:'].includes(url.protocol) &&
      !url.username &&
      !url.password &&
      url.pathname === '/' &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}
function privateKey(key) {
  if (key.startsWith('sb_secret_')) return true;
  try {
    return (
      JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role === 'service_role'
    );
  } catch {
    return false;
  }
}
const [major, minor] = process.versions.node.split('.').map(Number);
check(major > 22 || (major === 22 && minor >= 19), 'Node.js 22.19+ is required; Node 24 LTS is recommended.');
check(
  existsSync('node_modules/astro/package.json'),
  'Project dependencies are installed (npm ci).',
);
check(existsSync('.env'), '.env exists (npm run setup).');
if (!process.argv.includes('--cloud')) {
  if (!problems) {
    await ensureLocalSettings();
    console.log('OK Local classroom accounts are ready. No cloud keys needed.');
    console.log('Run npm run dev. Use npm run doctor:cloud only when setting up hosted Supabase.');
  }
  process.exit(problems ? 1 : 0);
}
for (const name of [
  'PUBLIC_SUPABASE_URL',
  'PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
]) {
  check(Boolean(value(name)), `${name} is filled in .env.`);
}
check(
  validUrl('PUBLIC_SUPABASE_URL') && validUrl('SUPABASE_URL'),
  'Supabase URLs are valid project URLs without paths.',
);
check(
  Boolean(value('SUPABASE_URL')) &&
    value('SUPABASE_URL').replace(/\/$/, '') === value('PUBLIC_SUPABASE_URL').replace(/\/$/, ''),
  'Browser and backend use the same TEST Supabase project.',
);
check(
  !privateKey(value('PUBLIC_SUPABASE_ANON_KEY')),
  'The browser key is public, not a service-role/secret key.',
);
check(
  !value('PUBLIC_SUPABASE_ANON_KEY') ||
    value('PUBLIC_SUPABASE_ANON_KEY') !== value('SUPABASE_SERVICE_ROLE_KEY'),
  'Public and private keys are different.',
);
check(validUrl('APP_ORIGIN'), 'APP_ORIGIN is the exact site origin without a path.');
check(
  value('RATE_LIMIT_SECRET').length >= 24 &&
    !/replace|placeholder|example/i.test(value('RATE_LIMIT_SECRET')),
  'RATE_LIMIT_SECRET is a private random value (setup generates one).',
);
check(
  ['true', 'false'].includes(value('PUBLIC_TEST_ENVIRONMENT')),
  'PUBLIC_TEST_ENVIRONMENT is true for student/test sites, false for the approved client site.',
);
check(
  ['capture', 'send'].includes(value('TEST_EMAIL_MODE')),
  'TEST_EMAIL_MODE is capture or send.',
);
if (value('TEST_EMAIL_MODE') === 'send') {
  for (const name of ['RESEND_API_KEY', 'OWNER_NOTIFY_EMAIL', 'RESEND_FROM'])
    check(Boolean(value(name)), `${name} is filled for real email.`);
  console.log('NOTE Verify the approved sender domain in Resend before sending.');
}
console.log(
  problems
    ? `\n${problems} setup item(s) need attention. Frontend-only work still uses npm run dev:frontend.`
    : '\nCloud configuration is present. Run npm run dev:cloud, then complete the test walkthrough in devops/TEST-THE-SYSTEM.md.',
);
console.log(
  'This check does not contact Supabase or print your keys. Account/migration correctness is checked in the walkthrough.',
);
process.exitCode = problems ? 1 : 0;
