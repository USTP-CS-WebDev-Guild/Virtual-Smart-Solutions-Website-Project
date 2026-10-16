import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const release = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
).version;
const visibilityHelp =
  'Netlify is blocking public visitors. Open Project configuration > General > Visitor access > Project visibility, make production Public, save, and run this check again.';

export async function inspectPublicDeployment(siteUrl, fetcher = fetch) {
  const origin = new URL(siteUrl).origin;
  if (!/^https:/.test(origin) && !/^http:\/\/(127\.0\.0\.1|localhost)(:|$)/.test(origin))
    throw new Error('Use the HTTPS production site URL.');
  const get = async (path) => {
    let target = new URL(path, origin);
    let response;
    for (let hop = 0; hop < 5; hop++) {
      response = await fetcher(target, {
        redirect: 'manual',
        signal: AbortSignal.timeout(15_000),
        headers: {
          Accept: path.startsWith('/api/') ? 'application/json' : 'text/html',
        },
      });
      if (response.status < 300 || response.status >= 400) break;
      const location = response.headers.get('location');
      if (!location) throw new Error(`${path} redirected without a destination.`);
      const next = new URL(location, target);
      if (
        /edge-access|app\.netlify\.com\/.*login/i.test(next.href) ||
        next.hostname === 'app.netlify.com'
      )
        throw new Error(visibilityHelp);
      if (next.origin !== origin)
        throw new Error(
          `${path} redirects to another origin. Run this check against the final public production URL.`,
        );
      await response.body?.cancel();
      target = next;
    }
    if (!response || (response.status >= 300 && response.status < 400))
      throw new Error(`${path} has too many redirects.`);
    const text = await response.text();
    if (/edge-access\?|<title>Login Redirect<\/title>/i.test(text)) throw new Error(visibilityHelp);
    if (
      response.status === 401 &&
      !response.headers.get('content-type')?.includes('application/json')
    )
      throw new Error(visibilityHelp);
    return { response, text, json: () => JSON.parse(text) };
  };
  const pages = [
    '/',
    '/services/',
    '/portfolio/',
    '/about/',
    '/approach/',
    '/contact/',
    '/privacy/',
    '/admin/',
  ];
  const outcomes = await Promise.allSettled(
    pages.map(async (path) => {
      const result = await get(path);
      if (result.response.status !== 200)
        throw new Error(`${path} returned ${result.response.status}.`);
      if (!result.text.includes(`name="app-release" content="${release}"`))
        throw new Error(`${path} is not the expected release ${release}. Publish the new commit.`);
      if (
        path === '/' &&
        !result.response.headers.get('content-security-policy')?.includes('wss://*.supabase.co')
      )
        throw new Error('The deployed CSP does not allow the Supabase WebSocket connection.');
      return path;
    }),
  );
  const failed = outcomes.filter((result) => result.status === 'rejected');
  if (failed.length)
    throw new Error([...new Set(failed.map((result) => result.reason.message))].join('\n'));
  const checks = [];
  for (const path of [
    '/api/admin/inquiries',
    '/api/admin/clients',
    '/api/admin/privacy-requests',
    '/api/admin/site-content',
  ]) {
    const result = await get(path);
    if (result.response.status !== 401 || result.json().error !== 'staff_access_required')
      throw new Error(
        `${path} returned HTTP ${result.response.status}; expected HTTP 401 staff_access_required. Check the API Function logs and SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY configuration if the response is 503.`,
      );
    checks.push(path);
  }
  const ready = await get('/api/health/ready');
  if (ready.response.status !== 200 || ready.json().status !== 'ready')
    throw new Error('The deployed database readiness check failed.');
  const content = await get('/api/public/content');
  if (content.response.status !== 200 || !Array.isArray(content.json().content?.services))
    throw new Error('The published-content API failed.');
  const config = await get('/api/public/runtime');
  if (config.response.status !== 200)
    throw new Error(
      'Public runtime configuration is missing. Make the PUBLIC_SUPABASE_* values available to Functions, then redeploy.',
    );
  const runtime = config.json();
  if (
    runtime.release !== release ||
    typeof runtime.supabaseUrl !== 'string' ||
    typeof runtime.publishableKey !== 'string' ||
    runtime.publishableKey.startsWith('sb_secret_')
  )
    throw new Error('Public runtime configuration is invalid.');
  return {
    origin,
    runtime,
    publicPages: pages.length,
    protectedApis: checks.length,
  };
}

export async function verifyDeployment(siteUrl, { writeTest = false, log = console.log } = {}) {
  const report = await inspectPublicDeployment(siteUrl);
  log(`PASS ${report.publicPages} public pages open without a hosting login; release ${release}.`);
  log(
    `PASS ${report.protectedApis} private APIs reject anonymous requests; database and content API are ready.`,
  );
  const client = createClient(report.runtime.supabaseUrl, report.runtime.publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  try {
    const { data, error } = await client.from('change_signals').select('*');
    if (error || data?.length !== 1 || data[0]?.scope !== 'public')
      throw new Error(
        'Realtime SELECT permissions are not correct. Apply the new migration; anonymous visitors must see only the public version row.',
      );
    await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () =>
          reject(
            new Error(
              'Realtime did not become ready. Check the publication, project Realtime settings, and network WebSocket access.',
            ),
          ),
        22_000,
      );
      client
        .channel('deployment-check-' + crypto.randomUUID(), {
          config: { postgres_changes_options: { wait: true, timeout: 10_000 } },
        })
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'change_signals' },
          () => {},
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            clearTimeout(timer);
            resolve();
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            clearTimeout(timer);
            reject(new Error('Realtime could not subscribe to the published signal table.'));
          }
        });
    });
    log('PASS anonymous WebSocket subscription is ready; private signal rows stay hidden.');
    if (writeTest) {
      if (report.runtime.testEnvironment !== true)
        throw new Error('--write-test is limited to a marked test deployment.');
      const response = await fetch(new URL('/api/inquiries', report.origin), {
        method: 'POST',
        headers: { Origin: report.origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey: crypto.randomUUID(),
          name: 'Deployment check ' + new Date().toISOString(),
          email: 'deployment-check@example.test',
          company: 'Synthetic deployment verification',
          phone: '',
          service: 'Not sure yet',
          message:
            'Synthetic inquiry created to verify the deployed contact form and live owner inbox.',
          privacyAcknowledged: true,
          website: '',
        }),
        signal: AbortSignal.timeout(20_000),
      });
      const result = await response.json();
      if (!response.ok || !result.ok || !/^[0-9a-f-]{36}$/i.test(result.inquiryId || ''))
        throw new Error(
          `Synthetic inquiry was not confirmed (${response.status}). Reference: ${response.headers.get('X-Request-ID') || 'unavailable'}.`,
        );
      log(
        'PASS synthetic inquiry saved. Open the owner inbox; receipt ' +
          result.inquiryId.slice(0, 8).toUpperCase() +
          '.',
      );
    }
    log(
      'Public deployment checks passed. Verify staff live delivery in the owner workspace before handoff.',
    );
  } finally {
    await client.removeAllChannels();
    client.realtime.disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const url = process.argv.slice(2).find((arg) => !arg.startsWith('--'));
  if (!url) {
    console.error(
      'Usage: npm run verify:deployment -- https://your-site.netlify.app [--write-test]',
    );
    process.exitCode = 2;
  } else {
    try {
      await verifyDeployment(url, {
        writeTest: process.argv.includes('--write-test'),
      });
    } catch (error) {
      console.error(error instanceof Error ? error.message : 'Deployment check failed.');
      process.exitCode = 1;
    }
  }
}
