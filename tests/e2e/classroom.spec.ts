import { workspaceView, settingsGroup } from './workspace-helpers';
import { test, expect, type Page } from 'playwright/test';
import { cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { spawn, type ChildProcess } from 'node:child_process';
import { startClassroomServer } from '../../devops/local/server';
import { installNavigationObserver, type NavigationSnapshot } from './navigation-observer';

// A real browser against the full classroom runtime. Auth, persistence and
// event delivery are real. One navigation test delays a document request to
// inspect the old page; it does not replace the destination or its content.
// Each scenario creates its own records/contexts and also runs against a fresh
// database when selected alone. Keep one worker (config), but don't skip the
// rest of the file on failure: default mode restarts the worker/runtime instead.
test.describe.configure({ mode: 'default' });
let root: string;
let runtime: Awaited<ReturnType<typeof startClassroomServer>>;
let astro: ChildProcess;
let guide: string;
let output = '';
const base = 'http://127.0.0.1:4321';
const environment = { ...process.env };
const signIn = async (page: Page, role = 'owner') => {
  const email = role + '@classroom.test';
  const password = guide.match(
    new RegExp('Email: ' + email.replace('.', '\\.') + '\\nPassword: (\\S+)'),
  )![1]!;
  await page.goto(base + '/admin/');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.locator('#admin-app')).toBeVisible();
  await expect(page.locator('.system-status')).toContainText('Live updates connected');
  await workspaceView(page, 'inquiries');
};
test.beforeAll(async () => {
  test.setTimeout(60_000);
  root = await mkdtemp(join(tmpdir(), 'student-browser-'));
  await cp(
    new URL('../../backend/database/migrations', import.meta.url),
    join(root, 'backend/database/migrations'),
    { recursive: true },
  );
  runtime = await startClassroomServer(root, 8787, base);
  guide = await readFile(join(root, '.local/LOCAL-ACCESS.md'), 'utf8');
  const require = createRequire(import.meta.url);
  const bin = resolve(dirname(require.resolve('astro/package.json')), 'bin/astro.mjs');
  astro = spawn(
    process.execPath,
    [bin, 'dev', '--ignore-lock', '--host', '127.0.0.1', '--port', '4321'],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PUBLIC_CLASSROOM_MODE: 'true',
        PUBLIC_TEST_ENVIRONMENT: 'true',
        ASTRO_DEV_BACKGROUND: '0',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  astro.stdout?.on('data', (chunk) => {
    output = (output + chunk).slice(-5000);
  });
  astro.stderr?.on('data', (chunk) => {
    output = (output + chunk).slice(-5000);
  });
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    try {
      if ((await fetch(base)).ok) {
        ready = true;
        break;
      }
    } catch {
      /* Starting. */
    }
    if (astro.exitCode !== null) throw new Error('Astro stopped: ' + output);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!ready) throw new Error('Astro did not become ready: ' + output);
});
test.afterAll(async () => {
  if (astro && astro.exitCode === null) {
    const exited = new Promise((resolve) => astro.once('exit', resolve));
    astro.kill('SIGTERM');
    const timer = setTimeout(() => astro.kill('SIGKILL'), 4000);
    await exited;
    clearTimeout(timer);
  }
  await runtime?.close();
  if (root) await rm(root, { recursive: true, force: true });
  for (const key of Object.keys(process.env)) if (!(key in environment)) delete process.env[key];
  Object.assign(process.env, environment);
});

test('fresh classroom starts empty and signed-out phone users cannot reveal the workspace', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.goto(base + '/');
  await expect(page.locator('.brand-name').first()).toHaveText('Virtual Smart Solutions');
  await page.getByRole('link', { name: 'Owner sign-in' }).click();
  await expect(page.locator('#admin-login')).toBeVisible();
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
  await expect(page.locator('#admin-app')).toBeHidden();
  await signIn(page);
  await expect(page.locator('#metric-new')).toHaveText('0');
  expect((await page.request.get(base + '/api/admin/inquiries')).status()).toBe(401);
  await context.close();
});

test('phone inquiry reaches the live owner inbox, then notes and conversion create exactly one client', async ({
  browser,
}) => {
  const ownerContext = await browser.newContext();
  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const owner = await ownerContext.newPage();
  const visitor = await phone.newPage();
  const errors: string[] = [];
  owner.on('pageerror', (error) => errors.push(error.message));
  visitor.on('pageerror', (error) => errors.push(error.message));
  await signIn(owner);
  await visitor.goto(base + '/contact/');
  const form = visitor.locator('[data-form="inquiry"]');
  await form.locator('[name="name"]').fill('Local Phone Contact');
  await form.locator('[name="email"]').fill('phone@example.test');
  await form.locator('[name="service"]').selectOption('Not sure yet');
  await form
    .locator('[name="message"]')
    .fill('Please help coordinate our weekly local test schedule.');
  await form.locator('[name="privacyAcknowledged"]').check();
  await form.getByRole('button', { name: 'Send inquiry' }).click();
  await expect(form.locator('.form-status')).toContainText('Reference:');
  await expect(owner.locator('#inquiry-list')).toContainText('Local Phone Contact', {
    timeout: 5000,
  });
  await owner.getByRole('button', { name: /Local Phone Contact/ }).click();
  await owner.locator('[name="note"]').fill('Discussed the first weekly calendar handoff.');
  await owner.getByRole('button', { name: 'Save note', exact: true }).click();
  await expect(owner.locator('#inquiry-note-list')).toContainText('first weekly');
  await owner.getByRole('button', { name: 'Convert to client', exact: true }).click();
  await owner.locator('#confirm-accept').click();
  await workspaceView(owner, 'clients');
  await expect(owner.locator('#client-list')).toContainText('Local Phone Contact');
  expect(await visitor.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
    true,
  );
  expect(
    await form
      .locator('[name="email"]')
      .evaluate((node) => parseFloat(getComputedStyle(node).fontSize)),
  ).toBeGreaterThanOrEqual(16);
  expect(errors).toEqual([]);
  await visitor.screenshot({
    path: 'test-results/classroom-phone-contact.png',
    fullPage: true,
  });
  await ownerContext.close();
  await phone.close();
});

test('owner publishes to an already-open page and a separate privacy form reaches its own queue', async ({
  browser,
}) => {
  const ownerContext = await browser.newContext();
  const visitorContext = await browser.newContext();
  const owner = await ownerContext.newPage();
  const home = await visitorContext.newPage();
  await signIn(owner);
  await home.goto(base + '/');
  await expect(home.locator('html')).toHaveAttribute('data-content-connection', 'live');
  await workspaceView(owner, 'content');
  await settingsGroup(owner, 'home');
  await owner.getByLabel('Home page heading', { exact: true }).fill('Our student project is live');
  await owner.locator('#save-site-content').click();
  await expect(owner.locator('#admin-alert')).toContainText('saved and published');
  await expect(home.locator('[data-site-content="homeHeadline"]')).toHaveText(
    'Our student project is live',
    { timeout: 5000 },
  );
  await workspaceView(owner, 'privacy');
  await home.goto(base + '/privacy/');
  const form = home.locator('[data-form="privacy-request"]');
  await form.locator('[name="name"]').fill('Local Privacy Requester');
  await form.locator('[name="email"]').fill('privacy@example.test');
  await form.locator('[name="requestType"]').selectOption('export');
  await form.locator('[name="message"]').fill('Please export my synthetic classroom information.');
  await form.locator('[name="privacyAcknowledged"]').check();
  await form.getByRole('button', { name: 'Submit request' }).click();
  await expect(form.locator('.form-status')).toContainText('Reference:');
  await expect(owner.locator('#privacy-queue')).toContainText('Local Privacy Requester', {
    timeout: 5000,
  });
  await ownerContext.close();
  await visitorContext.close();
});

test('package and service links preserve intent and the owner sees the saved package', async ({
  browser,
}) => {
  const ownerContext = await browser.newContext();
  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const owner = await ownerContext.newPage();
  const visitor = await phone.newPage();
  await signIn(owner);
  await visitor.goto(base + '/services/');
  await visitor
    .locator('#bookkeeping')
    .getByRole('link', { name: /Discuss this service/ })
    .click();
  await expect(visitor.locator('[name="service"]')).toHaveValue('Bookkeeping');
  await visitor.goto(base + '/services/#packages');
  await visitor.getByRole('link', { name: /Discuss Professional/ }).click();
  await expect(visitor.locator('[name="requestedPlan"]')).toHaveValue('professional');
  const form = visitor.locator('[data-form="inquiry"]');
  await form.getByLabel('Your name').fill('Package Phone Inquiry');
  await form.getByLabel('Work email').fill('package-phone@example.test');
  await form.locator('[name="service"]').selectOption('Bookkeeping');
  await form
    .locator('[name="message"]')
    .fill('Please discuss the published bookkeeping package with our team.');
  await form.locator('[name="privacyAcknowledged"]').check();
  await form.getByRole('button', { name: 'Send inquiry' }).click();
  await expect(form.locator('.form-status')).toContainText('Reference:');
  await expect(form.locator('[data-plan-summary]')).toContainText('Optional.');
  await expect(owner.locator('#inquiry-list')).toContainText('Package Phone Inquiry', {
    timeout: 5000,
  });
  await owner.getByRole('button', { name: /Package Phone Inquiry/ }).click();
  await expect(owner.locator('#inquiry-detail')).toContainText('Professional');
  await expect(owner.locator('#inquiry-detail')).toContainText('₱18,000');
  await ownerContext.close();
  await phone.close();
});

test('owner catalogs publish live, retain visitor drafts, and require approved client claims', async ({
  browser,
}) => {
  const context = await browser.newContext();
  const owner = await context.newPage();
  const pricing = await context.newPage();
  const work = await context.newPage();
  const about = await context.newPage();
  const contact = await context.newPage();
  await signIn(owner);
  for (const [page, path] of [
    [pricing, '/services/'],
    [work, '/portfolio/'],
    [about, '/about/'],
    [contact, '/contact/?plan=starter'],
  ] as const) {
    await page.goto(base + path);
    await expect(page.locator('html')).toHaveAttribute('data-content-connection', 'live');
  }
  await expect(contact.locator('[name="requestedPlan"]')).toHaveValue('starter');
  await contact.locator('[name="name"]').fill('Keep this unsent visitor draft');
  await workspaceView(owner, 'content');
  await owner.locator('[data-editor-tab="plans"]').click();
  await owner
    .locator('#cms-plans [data-catalog-id="starter"]')
    .getByLabel('Displayed price')
    .fill('₱8,500');
  await owner.locator('[data-editor-tab="portfolio"]').click();
  const entry = owner.locator('#cms-portfolio [data-catalog-id="organized-operations"]');
  await entry.getByLabel('Work title').fill('An approved operations story');
  await entry.getByLabel('Work type').selectOption('case-study');
  await owner.locator('[data-editor-tab="team"]').click();
  await owner
    .locator('#cms-team [data-catalog-id="vanessa"]')
    .getByLabel('Team member role')
    .fill('Founder & Chief Executive Officer');
  await owner.locator('#save-site-content').click();
  await expect(owner.locator('#admin-alert')).toContainText('permission to share');
  await expect(entry.getByLabel('Work title')).toHaveValue('An approved operations story');
  await expect(work.locator('[data-public-portfolio]')).not.toContainText(
    'An approved operations story',
  );
  await entry.getByLabel('Owner has verified').check();
  await owner.locator('[data-editor-tab="plans"]').click();
  await owner.locator('#add-plans').click();
  await owner.locator('#save-site-content').click();
  await expect(owner.locator('#admin-alert')).toContainText('saved and published');
  await expect(pricing.locator('[data-plan-id="starter"]')).toContainText('₱8,500', {
    timeout: 5000,
  });
  await expect(pricing.locator('[data-public-plans]')).not.toContainText('New package');
  await expect(work.locator('[data-public-portfolio]')).toContainText(
    'An approved operations story',
    { timeout: 5000 },
  );
  await expect(work.locator('[data-public-portfolio]')).toContainText('CLIENT CASE STUDY');
  await expect(about.locator('[data-public-team]')).toContainText(
    'Founder & Chief Executive Officer',
    { timeout: 5000 },
  );
  await expect(contact.locator('[data-plan-summary]')).toContainText('₱8,500', {
    timeout: 5000,
  });
  await expect(contact.locator('[name="name"]')).toHaveValue('Keep this unsent visitor draft');
  await expect(contact.locator('[name="requestedPlan"]')).toHaveValue('starter');
  await context.close();
});

test('withdrawing a package requires review without clearing a visitor draft', async ({
  browser,
}) => {
  const context = await browser.newContext();
  const owner = await context.newPage();
  const visitor = await context.newPage();
  await signIn(owner);
  await visitor.goto(base + '/contact/?plan=business');
  await expect(visitor.locator('[name="requestedPlan"]')).toHaveValue('business');
  await visitor.locator('[name="name"]').fill('Keep this when the package changes');
  await workspaceView(owner, 'content');
  await owner.locator('[data-editor-tab="plans"]').click();
  await owner
    .locator('#cms-plans [data-catalog-id="business"]')
    .getByLabel('Publish this package')
    .uncheck();
  await owner.locator('#save-site-content').click();
  await expect(owner.locator('#admin-alert')).toContainText('saved and published');
  await expect(visitor.locator('[data-selection-alert]')).toContainText('no longer available');
  expect(
    await visitor
      .locator('[name="requestedPlan"]')
      .evaluate((node) => (node as HTMLSelectElement).checkValidity()),
  ).toBe(false);
  await owner.locator('[data-editor-tab="settings"]').click();
  await settingsGroup(owner, 'footer');
  await owner
    .getByLabel('Footer tagline', { exact: true })
    .fill('Thoughtful remote support, with a clear next step.');
  await owner.locator('#save-site-content').click();
  await expect(visitor.locator('[data-site-content="footerTagline"]')).toHaveText(
    'Thoughtful remote support, with a clear next step.',
  );
  await expect(visitor.locator('[data-selection-alert]')).toContainText('no longer available');
  await expect(visitor.locator('[name="name"]')).toHaveValue('Keep this when the package changes');
  await visitor.locator('[name="requestedPlan"]').selectOption('starter');
  await expect(visitor.locator('[data-selection-alert]')).toBeHidden();
  expect(
    await visitor
      .locator('[name="requestedPlan"]')
      .evaluate((node) => (node as HTMLSelectElement).checkValidity()),
  ).toBe(true);
  await context.close();
});

test('mobile navigation works with keyboard and public images are available', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  await page.goto(base + '/');
  const toggle = page.getByRole('button', { name: 'Open navigation' });
  await toggle.click();
  await expect(page.locator('#mobile-menu')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(toggle).toBeFocused();
  await expect(page.locator('#mobile-menu')).toBeHidden();
  await toggle.click();
  await page.locator('#mobile-menu').getByRole('link', { name: 'Our work', exact: true }).click();
  await expect(page).toHaveURL(base + '/portfolio/');
  await page.goto(base + '/about/');
  await expect(page.locator('html')).toHaveAttribute('data-site-content-ready', 'true');
  await page.locator('[data-public-team]').scrollIntoViewIfNeeded();
  await expect
    .poll(() =>
      page
        .locator('[data-public-team] img')
        .evaluateAll((nodes) =>
          nodes.every(
            (node) =>
              (node as HTMLImageElement).complete && (node as HTMLImageElement).naturalWidth > 0,
          ),
        ),
    )
    .toBe(true);
  await page.screenshot({
    path: 'test-results/vss-phone-about.png',
    fullPage: true,
  });
  await page.goto(base + '/');
  await page.screenshot({
    path: 'test-results/vss-phone-home.png',
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: 'test-results/vss-desktop-home.png',
    fullPage: true,
  });
  await context.close();
});

for (const width of [320, 390, 768, 1440]) {
  test(`classroom roles and page layout at ${width}px`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
    });
    const page = await context.newPage();
    for (const path of [
      '/',
      '/services/',
      '/portfolio/',
      '/about/',
      '/approach/',
      '/contact/',
      '/privacy/',
      '/admin/',
    ]) {
      await page.goto(base + path);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        path,
      ).toBe(true);
    }
    await signIn(page);
    for (const view of ['inquiries', 'clients', 'privacy', 'content']) {
      await workspaceView(page, view);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        view,
      ).toBe(true);
    }
    for (const section of ['settings', 'services', 'plans', 'portfolio', 'team', 'faqs']) {
      await page.locator(`[data-editor-tab="${section}"]`).click();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        section,
      ).toBe(true);
    }
    if (width === 390)
      await page.screenshot({
        path: 'test-results/classroom-phone-editor.png',
        fullPage: true,
      });
    await page.locator('#sign-out').click();
    await expect(page.locator('#admin-app')).toBeHidden();
    await expect(page.locator('#inquiry-list')).toBeEmpty();
    await signIn(page, 'staff');
    await expect(page.locator('#content-nav')).toBeHidden();
    await expect(page.locator('[data-view="privacy"]')).toBeHidden();
    await context.close();
  });
}

test('enhanced browsing works on a phone and honors motion preferences', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'no-preference',
  });
  const page = await context.newPage();
  await page.goto(base + '/');
  await expect(page.locator('html')).toHaveAttribute('data-site-content-ready', 'true');
  await page.locator('[data-service-choice="data-entry"]').click();
  await expect(page.locator('[data-explorer-panel] [data-active=true] h3')).toHaveText(
    'Data Entry',
  );
  await page.locator('[data-explorer-panel] [data-active=true] a').click();
  await expect(page.locator('[name="service"]')).toHaveValue('Data Entry');
  await page.goto(base + '/portfolio/');
  await expect(page.locator('[data-work-tools]')).toBeVisible();
  await page
    .locator('[data-work-filters]')
    .getByRole('button', { name: 'Bookkeeping', exact: true })
    .click();
  await expect(page.locator('[data-work-id]:not([hidden])')).toHaveCount(1);
  const trigger = page.locator('[data-work-id]:not([hidden]) [data-work-open]');
  await trigger.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(trigger).toBeFocused();
  await page.goto(base + '/services/');
  await page.locator('.vss-comparison > summary').click();
  await expect(page.locator('[data-plan-comparison]')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('[data-faq-search]').fill('xyz-no-results');
  await expect(page.locator('[data-faq-count]')).toHaveText('0 answers found');
  await page.locator('[data-motion-toggle]').click();
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'off');
  await page.reload();
  await expect(page.locator('[data-motion-toggle]')).toHaveAttribute('aria-pressed', 'false');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('[data-motion-toggle]')).toBeDisabled();
  await context.close();
});

test('hero, expertise ticker and team have real ongoing animation with a shared pause control', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'no-preference',
  });
  const page = await context.newPage();
  await page.goto(base + '/');
  await expect(page.locator('.test-environment-banner')).toHaveCount(0);
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'on');
  const hero = page.locator('.vss-card-one');
  await expect
    .poll(() => hero.evaluate((node) => getComputedStyle(node).animationName))
    .toBe('vss-float-left');
  const ticker = page.locator('.vss-ticker-track');
  await page.locator('.vss-ticker-viewport').scrollIntoViewIfNeeded();
  await expect
    .poll(() => ticker.evaluate((node) => getComputedStyle(node).animationPlayState))
    .toBe('running');
  const before = await ticker.evaluate((node) => node.getBoundingClientRect().x);
  await expect
    .poll(() => ticker.evaluate((node) => node.getBoundingClientRect().x))
    .toBeLessThan(before - 3);
  await page.locator('.vss-ticker-heading [data-motion-toggle]').click();
  await expect(page.locator('#footer-motion-toggle')).toHaveText('Resume animations');
  await expect
    .poll(() => ticker.evaluate((node) => getComputedStyle(node).animationName))
    .toBe('none');
  await page.locator('.vss-ticker-heading [data-motion-toggle]').click();
  await page.goto(base + '/about/');
  const portrait = page.locator('.vss-person-image img').first();
  await page.locator('.vss-person-image').first().scrollIntoViewIfNeeded();
  await expect
    .poll(() => portrait.evaluate((node) => getComputedStyle(node).animationName))
    .toBe('vss-team-drift');
  await expect
    .poll(() => portrait.evaluate((node) => getComputedStyle(node).animationPlayState))
    .toBe('running');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect
    .poll(() => portrait.evaluate((node) => getComputedStyle(node).animationName))
    .toBe('none');
  await context.close();
});

test('redesigned navigation, service preview and FAQ motion retain real links and keyboard focus', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'no-preference',
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(base + '/');
  expect(
    await page.locator('.vss-header').evaluate((node) => getComputedStyle(node).backgroundColor),
  ).toBe('rgb(255, 255, 255)');
  // Astro's dev toolbar has headings in its shadow DOM. Check the actual
  // application title instead of selecting toolbar/debug-panel headings too.
  const pageTitle = page.locator('#main .vss-hero h1');
  await expect(pageTitle).toHaveCount(1);
  expect(await pageTitle.evaluate((node) => node.getAnimations().length)).toBe(0);

  await expect(page.locator('[data-service-choice="data-entry"]')).toBeVisible();
  await page.locator('[data-service-choice="data-entry"]').click();
  await expect(page.locator('[data-service-choice="data-entry"]')).toHaveAttribute('aria-pressed', 'true');
  // All service panels stay in the DOM to reserve stable layout space. Check
  // the one active panel and its image, rather than all five retained images.
  const selectedService = page.locator('#main [data-service-explorer] [data-explorer-item][data-active="true"]');
  await expect(selectedService).toHaveCount(1);
  await expect(selectedService).toHaveAttribute('data-explorer-item', 'data-entry');
  await expect(selectedService).toHaveAttribute('aria-hidden', 'false');
  await expect(selectedService).toBeVisible();
  await expect(selectedService.locator('.vss-explorer-image')).toHaveCount(1);
  await expect(selectedService.locator('.vss-explorer-image')).toHaveAttribute(
    'src',
    '/images/service-data.webp',
  );
  const menu = page.getByRole('button', { name: 'Open navigation' });
  await menu.click();
  await expect(page.locator('#mobile-menu')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#mobile-menu')).toBeHidden();
  await expect(menu).toBeFocused();
  await menu.click();
  await page.locator('#mobile-menu a[href="/portfolio/"]').click();
  await expect(page).toHaveURL(base + '/portfolio/');
  await page
    .locator('[data-work-filters]')
    .getByRole('button', { name: 'Bookkeeping', exact: true })
    .click();
  await expect(page.locator('.is-work-featured')).toHaveCount(1);
  await expect(page.locator('.is-work-featured')).toBeVisible();
  await page.goto(base + '/services/');
  const faq = page.locator('.vss-faq').first();
  await faq.locator('summary').click();
  await expect(faq).toHaveAttribute('open', '');
  await faq.locator('summary').click();
  await expect(faq).not.toHaveAttribute('open');
  await page.locator('#footer-motion-toggle').click();
  await page.locator('.vss-header .brand').click();
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'off');
  expect(errors).toEqual([]);
  await context.close();
});

test('compact mobile navigation overlays stable content and stays put while the next document loads', async ({
  browser,
}) => {
  const context = await browser.newContext({ viewport: { width: 811, height: 900 } });
  const page = await context.newPage();
  await page.goto(base + '/');
  await expect(page.locator('html')).toHaveAttribute('data-site-content-ready', 'true');
  await page.evaluate(() => document.fonts.ready);
  const before = await page.locator('#main').boundingBox();
  await page.getByRole('button', { name: 'Open navigation' }).click();
  const menu = page.locator('#mobile-menu');
  await expect(menu).toBeVisible();
  await expect(menu.locator('a[aria-current="page"]')).toHaveText(/Home/);
  await menu.evaluate(async (node) => {
    await Promise.all(node.getAnimations().map((animation) => animation.finished.catch(() => {})));
  });
  const bounds = (await menu.boundingBox())!;
  expect(bounds.width).toBeLessThanOrEqual(420);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(811);
  const after = await page.locator('#main').boundingBox();
  expect(after?.x).toBeCloseTo(before!.x, 1);
  expect(after?.y).toBeCloseTo(before!.y, 1);
  expect(after?.width).toBeCloseTo(before!.width, 1);
  const observations: NavigationSnapshot[] = [];
  await page.exposeBinding('__vssRecordNavigation', (_source, snapshot: NavigationSnapshot) => {
    observations.push(snapshot);
  });
  // Arm before the click: a held navigation can suspend page-side evaluation
  // and animation frames. The observer sends snapshots during native lifecycle
  // events, after app handlers, without requiring another page query later.
  await page.evaluate(installNavigationObserver);
  let release!: () => void;
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  let navigationHeld = false;
  await page.route('**/portfolio/', async (route) => {
    if (route.request().isNavigationRequest()) {
      navigationHeld = true;
      await hold;
    }
    await route.continue();
  });
  try {
    await menu.getByRole('link', { name: 'Our work', exact: true }).click({ noWaitAfter: true });
    await expect.poll(() => navigationHeld, {
      message: 'The actual destination document request must pass through the test gate.',
    }).toBe(true);
  } finally {
    release();
  }
  await expect(page).toHaveURL(base + '/portfolio/');
  // Assert the old document's captured lifecycle states only after releasing
  // navigation. Do not assume when Chromium schedules beforeunload relative to
  // its document request, or wait for page/binding work while that request stalls.
  await expect.poll(() => observations.map((snapshot) => snapshot.phase)).toEqual([
    'click', 'beforeunload',
  ]);
  for (const pending of observations) {
    expect(pending.path).toBe('/');
    expect(pending.defaultPrevented).toBe(false);
    expect(pending.visible).toBe(true);
    expect(pending.inert).toBe(false);
    expect(pending.navigationOpen).toBe('true');
    expect(pending.expanded).toBe('true');
    expect(pending.menu?.x).toBeCloseTo(bounds.x, 1);
    expect(pending.menu?.y).toBeCloseTo(bounds.y, 1);
    expect(pending.menu?.width).toBeCloseTo(bounds.width, 1);
    expect(pending.main?.x).toBeCloseTo(before!.x, 1);
    expect(pending.main?.y).toBeCloseTo(before!.y, 1);
    expect(pending.main?.width).toBeCloseTo(before!.width, 1);
  }
  await expect(page.locator('#mobile-menu')).toBeHidden();
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await expect(page.locator('#mobile-menu a[aria-current="page"]')).toHaveText(/Our work/);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Open navigation' })).toBeFocused();
  await context.close();
});

for (const width of [320, 390, 768, 1440]) {
  test(`service choices keep panel and control geometry stable at ${width}px`, async ({
    browser,
  }) => {
    const context = await browser.newContext({ viewport: { width, height: 950 } });
    const page = await context.newPage();
    await page.goto(base + '/');
    await expect(page.locator('html')).toHaveAttribute('data-site-content-ready', 'true');
    await page.evaluate(() => document.fonts.ready);
    const panel = page.locator('[data-explorer-panel]');
    const choices = page.locator('[data-explorer-choices]');
    await choices.scrollIntoViewIfNeeded();
    const beforePanel = (await panel.boundingBox())!;
    const beforeChoices = (await choices.boundingBox())!;
    const services = await page
      .locator('[data-service-choice]')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-service-choice')));
    for (const id of services) {
      const button = page.locator(`[data-service-choice="${id}"]`);
      await button.click();
      await expect(button).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('[data-explorer-item][data-active="true"]')).toHaveCount(1);
      await expect(page.locator('[data-explorer-item][data-active="true"]')).toHaveAttribute(
        'data-explorer-item',
        id!,
      );
      const nowPanel = (await panel.boundingBox())!;
      const nowChoices = (await choices.boundingBox())!;
      expect(nowPanel.height).toBeCloseTo(beforePanel.height, 1);
      expect(nowPanel.width).toBeCloseTo(beforePanel.width, 1);
      expect(nowChoices.height).toBeCloseTo(beforeChoices.height, 1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
    await context.close();
  });
}

test('owner workspace has a monochrome mobile drawer and preserves an unpublished website edit between screens', async ({
  browser,
}) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await signIn(page);
  await workspaceView(page, 'overview');
  await expect(page.locator('#page-heading')).toHaveText('Overview');
  await expect(page.locator('.admin-sidebar')).toHaveCSS('background-color', 'rgb(23, 24, 27)');
  await expect(page.locator('#workspace-menu-toggle')).toHaveAttribute('aria-expanded', 'false');
  await page.locator('#workspace-menu-toggle').click();
  await expect(page.locator('#workspace-navigation')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#workspace-menu-toggle')).toBeFocused();
  await workspaceView(page, 'content');
  await settingsGroup(page, 'home');
  const title = page.getByLabel('Home page heading', { exact: true });
  await title.fill('Keep this unpublished mobile draft');
  await expect(page.locator('#content-draft-status')).toContainText('unpublished');
  await workspaceView(page, 'clients');
  await workspaceView(page, 'content');
  await expect(title).toHaveValue('Keep this unpublished mobile draft');
  await page.locator('#reload-site-content').click();
  await expect(page.locator('#workspace-confirm')).toBeVisible();
  await page
    .locator('#workspace-confirm')
    .getByRole('button', { name: 'Cancel', exact: true })
    .click();
  await expect(title).toHaveValue('Keep this unpublished mobile draft');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('#sign-out').click();
  await expect(page.locator('#workspace-confirm')).toBeVisible();
  await page.locator('#confirm-accept').click();
  await expect(page.locator('#admin-app')).toBeHidden();
  await expect(page.locator('#cms-settings-fields')).toBeEmpty();
  await context.close();
});

test('hostile stored inquiry text remains literal in the owner inbox', async ({ browser }) => {
  const ownerContext = await browser.newContext();
  const visitorContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const ownerPage = await ownerContext.newPage();
  const visitor = await visitorContext.newPage();
  const hostile = '<img src="x" onerror="window.__vss_xss=true"> SQL text: DROP TABLE staff_users;';
  await signIn(ownerPage);
  await visitor.goto(base + '/contact/');
  await visitor.locator('[name="name"]').fill('Security text regression');
  await visitor.locator('[name="email"]').fill('security-text@example.test');
  await visitor.locator('[name="service"]').selectOption('Not sure yet');
  await visitor.locator('[name="message"]').fill(hostile);
  await visitor.locator('[name="privacyAcknowledged"]').check();
  await visitor.getByRole('button', { name: 'Send inquiry' }).click();
  await expect(visitor.locator('.form-status')).toContainText('Reference:');
  await expect(ownerPage.locator('#inquiry-list')).toContainText('Security text regression');
  await ownerPage.getByRole('button', { name: /Security text regression/ }).click();
  await expect(ownerPage.locator('.detail-message p')).toHaveText(hostile);
  await expect(ownerPage.locator('#inquiry-detail img[src="x"]')).toHaveCount(0);
  expect(await ownerPage.evaluate(() => Boolean((window as any).__vss_xss))).toBe(false);
  await ownerContext.close();
  await visitorContext.close();
});
