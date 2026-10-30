import { readFile, writeFile, readdir } from 'node:fs/promises';

// Generate policy for this deployment's one Supabase project. Never trust all
// Supabase tenants or reflect a request Host into a browser security policy.
let connect = "'self'";
const configured = process.env.PUBLIC_SUPABASE_URL;
if (configured) {
  const url = new URL(configured);
  if (url.protocol !== 'https:' || !/^[a-z0-9-]+\.supabase\.co$/.test(url.hostname) ||
      url.pathname !== '/' || url.username || url.password || url.port || url.search || url.hash)
    throw new Error('PUBLIC_SUPABASE_URL must be your clean HTTPS Supabase project origin.');
  connect += ` ${url.origin} wss://${url.hostname}`;
}
const captcha = process.env.PUBLIC_TURNSTILE_SITE_KEY ? ' https://challenges.cloudflare.com' : '';
const policy = `default-src 'self'; script-src 'self'${captcha}; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src ${connect}; frame-src ${captcha.trim() || "'none'"}; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; upgrade-insecure-requests`;
const source = await readFile('frontend/public/_headers', 'utf8');
await writeFile('dist/_headers', source.replace(/Content-Security-Policy: [^\n]+/, 'Content-Security-Policy: ' + policy));
async function inspect(directory) {
  for (const entry of await readdir(directory,{withFileTypes:true})) {
    const file=directory+'/'+entry.name;
    if(entry.isDirectory()) { await inspect(file); continue; }
    if(!/\.(?:js|html|json|css|txt)$/.test(entry.name)) continue;
    const text=await readFile(file,'utf8');
    for(const name of ['SUPABASE_SERVICE_ROLE_KEY','RESEND_API_KEY','RESEND_WEBHOOK_SECRET','TURNSTILE_SECRET_KEY','HCAPTCHA_SECRET_KEY','RATE_LIMIT_SECRET','BACKUP_ENCRYPTION_KEY']) {
      const secret=process.env[name];
      if(secret && secret.length>=16 && text.includes(secret))
        throw new Error(`Private configuration leaked into built asset: ${file}. Value redacted.`);
    }
    if(/sb_secret_[A-Za-z0-9_-]{20,}/.test(text))
      throw new Error(`A possible private key is present in ${file}. Value redacted.`);
  }
}
await inspect('dist');
console.log('Security headers generated for the configured project; private routes remain uncached.');
