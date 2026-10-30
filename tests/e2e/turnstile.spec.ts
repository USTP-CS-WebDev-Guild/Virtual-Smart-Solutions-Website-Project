// Provider boundary test: the real built UI and Supabase JS client run in
// Chromium. Only Cloudflare responses and final submission/Auth receipts are
// synthetic. Hosted challenge issuance must also be checked on staging.
import { test, expect, type Page } from 'playwright/test';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { startTestServer } from './server';
let provider: Awaited<ReturnType<typeof startTestServer>>;
const key = '0x4SYNTHETIC_SITEKEY_123456';
test.beforeAll(async () => {
  test.setTimeout(60_000);
  // Exercise the actual production CSP generator, not a looser test policy.
  const fixture = await mkdtemp(join(tmpdir(), 'vss-turnstile-csp-'));
  try {
    await mkdir(join(fixture, 'frontend/public'), { recursive: true }); await mkdir(join(fixture, 'dist'));
    await writeFile(join(fixture, 'frontend/public/_headers'), await readFile(fileURLToPath(new URL('../../frontend/public/_headers', import.meta.url))));
    execFileSync(process.execPath, [fileURLToPath(new URL('../../devops/scripts/security-build.mjs', import.meta.url))], {
      cwd: fixture, env: { ...process.env, PUBLIC_SUPABASE_URL: 'https://example.supabase.co', PUBLIC_TURNSTILE_SITE_KEY: key }, stdio: 'pipe',
    });
    const headers = await readFile(join(fixture, 'dist/_headers'), 'utf8');
    provider = await startTestServer({ captchaSiteKey: key, contentSecurityPolicy: headers.match(/Content-Security-Policy: (.+)/)![1] });
  } finally { await rm(fixture, { recursive: true, force: true }); }
});
test.afterAll(async () => { await provider?.close(); });
const fakeProvider = `(() => {
  const loadedAsync = document.currentScript && (document.currentScript.async || document.currentScript.defer);
  const widgets = new Map(); let serial = 0;
  const issue = (widget) => { widget.token = 'synthetic-' + widget.options.action + '-token-' + (++widget.generation); widget.options.callback(widget.token); };
  window.turnstile = {
    // Preserve the real provider's async/defer ready() restriction. A permissive
    // readiness mock used to hide the production initialization failure.
    ready(callback) { if (loadedAsync) throw new Error('TurnstileError 3857: async/defer ready is unsupported'); callback(); },
    render(element, options) {
      const id = 'widget-' + (++serial); const iframe = document.createElement('iframe');
      iframe.src = 'https://challenges.cloudflare.com/test-widget'; iframe.title = 'Synthetic verification';
      iframe.style.width = options.size === 'flexible' ? '100%' : '150px';
      iframe.style.minWidth = options.size === 'flexible' ? '300px' : '150px';
      iframe.style.height = options.size === 'flexible' ? '65px' : '140px';
      iframe.style.border = '0'; iframe.style.display = 'block'; element.append(iframe);
      const widget = {options, iframe, token: '', generation: 0}; widgets.set(id, widget); queueMicrotask(() => issue(widget)); return id;
    },
    getResponse(id) { return widgets.get(id)?.token || ''; }, isExpired() { return false; },
    reset(id) { const widget = widgets.get(id); widget.token = ''; queueMicrotask(() => issue(widget)); },
    remove(id) { const widget = widgets.get(id); widget?.iframe.remove(); widgets.delete(id); }
  };
})();`;
async function verification(page: Page) {
  await page.route('https://challenges.cloudflare.com/**', (route) => route.fulfill({
    status: 200, contentType: route.request().url().includes('/api.js') ? 'application/javascript' : 'text/html',
    body: route.request().url().includes('/api.js') ? fakeProvider : '<!doctype html><html><body>Verification test</body></html>',
  }));
}
for (const scenario of [
  { path: '/contact/', form: '[data-form="inquiry"]', draft: '[name="name"]' },
  { path: '/privacy/', form: '[data-form="privacy-request"]', draft: '[name="name"]' },
  { path: '/admin/', form: '#staff-login-form', draft: '#staff-email' },
]) {
  test(`${scenario.path} verification fits the form at phone, tablet and desktop widths without losing a draft`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 }); await verification(page);
    await page.goto(provider.base + scenario.path);
    const form = page.locator(scenario.form);
    await form.locator(scenario.draft).fill('visitor@example.test');
    for (const width of [320, 390, 768, 1440, 320]) {
      await page.setViewportSize({ width, height: 800 });
      const container = form.locator('[data-captcha]');
      const compact = (await container.boundingBox())!.width < 300;
      await expect(form.locator('[data-captcha-widget]')).toHaveAttribute('data-captcha-size', compact ? 'compact' : 'flexible');
      await expect(form.locator('[data-captcha-status]')).toHaveText('Verification complete.');
      const frame = form.locator('[data-captcha-widget] iframe'); await expect(frame).toHaveCount(1);
      const bounds = (await container.boundingBox())!; const box = (await frame.boundingBox())!;
      expect(box.width).toBeCloseTo(compact ? 150 : bounds.width, 0);
      expect(box.height).toBe(compact ? 140 : 65);
      expect(box.x).toBeGreaterThanOrEqual(bounds.x);
      expect(box.x + box.width).toBeLessThanOrEqual(Math.min(bounds.x + bounds.width, width) + 1);
      const status = (await form.locator('[data-captcha-status]').boundingBox())!;
      const button = (await form.locator('button[type="submit"]').boundingBox())!;
      expect(status.y).toBeGreaterThanOrEqual(box.y + box.height);
      expect(button.y).toBeGreaterThanOrEqual(status.y + status.height);
      await expect(form.locator(scenario.draft)).toHaveValue('visitor@example.test');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  });
}
test('320px contact form loads Turnstile under the generated CSP and sends a token with its real JSON submission', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 760 }); await verification(page);
  let submitted: any;
  await page.route('**/api/inquiries', async (route) => {
    submitted = route.request().postDataJSON();
    await route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ ok: true, inquiryId: '40000000-0000-4000-8000-000000000001' }) });
  });
  const response = await page.goto(provider.base + '/contact/');
  expect(response?.headers()['content-security-policy']).toContain('https://challenges.cloudflare.com');
  await expect(page.locator('[data-captcha-status]')).toHaveText('Verification complete.');
  const form = page.locator('[data-form="inquiry"]');
  await form.locator('[name="name"]').fill('Synthetic Visitor'); await form.locator('[name="email"]').fill('visitor@example.test');
  await form.locator('[name="service"]').selectOption('Not sure yet'); await form.locator('[name="message"]').fill('Synthetic browser verification inquiry.');
  await form.locator('[name="privacyAcknowledged"]').check(); await form.locator('button[type="submit"]').click();
  await expect(form.locator('.form-status')).toContainText('Reference:');
  expect(submitted.captchaToken).toBe('synthetic-inquiry-token-1');
  await expect(form.locator('[name="name"]')).toHaveValue('');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('privacy retry keeps the visitor draft and receipt key while obtaining a new verification token', async ({ page }) => {
  await verification(page); const submissions: any[] = [];
  await page.route('**/api/privacy-requests', async (route) => {
    submissions.push(route.request().postDataJSON());
    const second = submissions.length === 2;
    await route.fulfill({ status: second ? 202 : 503, contentType: 'application/json', body: JSON.stringify(second ? { ok: true, privacyRequestId: '40000000-0000-4000-8000-000000000002' } : { error: 'verification_unavailable' }) });
  });
  await page.goto(provider.base + '/privacy/'); await expect(page.locator('[data-captcha-status]')).toHaveText('Verification complete.');
  const form = page.locator('[data-form="privacy-request"]');
  await form.locator('[name="name"]').fill('Synthetic Visitor'); await form.locator('[name="email"]').fill('visitor@example.test');
  await form.locator('[name="requestType"]').selectOption('access'); await form.locator('[name="message"]').fill('Synthetic privacy verification request.');
  await form.locator('[name="privacyAcknowledged"]').check(); await form.locator('button[type="submit"]').click();
  await expect(form.locator('.form-status')).toHaveClass(/is-error/); await expect(form.locator('[name="name"]')).toHaveValue('Synthetic Visitor');
  await expect(page.locator('[data-captcha-status]')).toHaveText('Verification complete.'); await form.locator('button[type="submit"]').click();
  await expect(form.locator('.form-status')).toContainText('Reference:');
  expect(submissions.map((item) => item.captchaToken)).toEqual(['synthetic-privacy_request-token-1', 'synthetic-privacy_request-token-2']);
  expect(submissions[0].idempotencyKey).toBe(submissions[1].idempotencyKey);
});
test('owner sign-in forwards the owner_login token through the real Supabase client', async ({ page }) => {
  await verification(page); let credentials: any;
  await page.route('**/supabase/auth/v1/token*', async (route) => {
    credentials = route.request().postDataJSON();
    await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ code: 'invalid_credentials', msg: 'Invalid login credentials' }) });
  });
  await page.goto(provider.base + '/admin/'); await expect(page.locator('[data-captcha-status]')).toHaveText('Verification complete.');
  await page.locator('#staff-email').fill('owner@example.test'); await page.locator('#staff-password').fill('Synthetic-password-only-for-this-test');
  await page.locator('#staff-login-form button[type="submit"]').click();
  await expect.poll(() => credentials?.gotrue_meta_security?.captcha_token).toBe('synthetic-owner_login-token-1');
  await expect(page.locator('#admin-app')).toBeHidden();
});
