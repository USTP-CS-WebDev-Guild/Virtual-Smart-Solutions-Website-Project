import { workspaceView, settingsGroup } from './workspace-helpers';
import { test, expect, type BrowserContext, type WebSocketRoute } from 'playwright/test';
import { startTestServer } from './server';

test.describe.configure({ mode: 'serial' });
let provider: Awaited<ReturnType<typeof startTestServer>>;
test.beforeAll(async () => {
  provider = await startTestServer();
});
test.afterAll(async () => {
  await provider?.close();
});

// Test boundary: Supabase's WS transport is simulated, not its RLS or SQL.
// The production UI uses the real Supabase client and serialized channel frames.
async function realtime(context: BrowserContext) {
  const sockets = new Set<WebSocketRoute>();
  let blocked = false;
  await context.routeWebSocket('**/supabase/realtime/v1/websocket*', (socket: WebSocketRoute) => {
    if (blocked) {
      socket.close({ code: 1001, reason: 'Synthetic offline test' });
      return;
    }
    sockets.add(socket);
    let topic = '';
    let joinRef: string | null = null;
    let token = '';
    let arrayFrames = false;
    let joined = false;
    const send = (
      event: string,
      payload: any,
      ref: string | null = null,
      target = topic,
      joining = joinRef,
    ) =>
      socket.send(
        JSON.stringify(
          arrayFrames
            ? [joining, ref, target, event, payload]
            : { join_ref: joining, ref, topic: target, event, payload },
        ),
      );
    const unsubscribe = provider.subscribe(async (rows) => {
      if (!joined) return;
      const allowed = (await provider.readSignals(token)).map((row) => row.scope);
      for (const row of rows)
        if (allowed.includes(row.scope))
          send('postgres_changes', {
            ids: [1],
            data: {
              schema: 'public',
              table: 'change_signals',
              type: 'UPDATE',
              commit_timestamp: new Date().toISOString(),
              columns: [
                { name: 'scope', type: 'text' },
                { name: 'revision', type: 'int8' },
                { name: 'changed_at', type: 'int8' },
              ],
              record: row,
              old_record: { scope: row.scope },
              errors: null,
            },
          });
    });
    socket.onMessage((raw) => {
      const value = JSON.parse(raw.toString());
      arrayFrames = Array.isArray(value);
      const message = arrayFrames
        ? { join_ref: value[0], ref: value[1], topic: value[2], event: value[3], payload: value[4] }
        : value;
      if (message.event === 'phx_join') {
        topic = message.topic;
        joinRef = message.join_ref;
        token = message.payload.access_token || '';
        joined = true;
        send(
          'phx_reply',
          {
            status: 'ok',
            response: {
              postgres_changes: [
                { id: 1, event: 'UPDATE', schema: 'public', table: 'change_signals' },
              ],
            },
          },
          message.ref,
        );
      } else if (message.event === 'heartbeat' || message.event === 'phx_leave') {
        if (message.event === 'phx_leave') {
          joined = false;
          unsubscribe();
        }
        send(
          'phx_reply',
          { status: 'ok', response: {} },
          message.ref,
          message.topic,
          message.join_ref,
        );
      } else if (message.event === 'access_token') token = message.payload.access_token;
    });
    socket.onClose(() => {
      joined = false;
      unsubscribe();
      sockets.delete(socket);
    });
  });
  return {
    disconnect: () => {
      blocked = true;
      for (const socket of sockets) socket.close({ code: 1001, reason: 'Synthetic offline test' });
    },
    resume: () => {
      blocked = false;
    },
  };
}
async function signIn(page: any, email = 'owner@example.test') {
  await page.goto(provider.base + '/admin/');
  await page.locator('#staff-email').fill(email);
  await page.locator('#staff-password').fill('Synthetic-password-1234');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.locator('#admin-app')).toBeVisible();
  await expect(page.locator('.system-status')).toContainText('Live updates connected');
  await workspaceView(page, 'inquiries');
}

test('a phone submission appears in an already-open owner inbox through a WebSocket event', async ({
  browser,
}) => {
  const ownerContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await realtime(ownerContext);
  const phone = await browser.newContext({
    viewport: { width: 375, height: 900 },
    isMobile: true,
    hasTouch: true,
  });
  await realtime(phone);
  const owner = await ownerContext.newPage();
  const contact = await phone.newPage();
  const errors: string[] = [];
  owner.on('pageerror', (e) => errors.push(e.message));
  contact.on('pageerror', (e) => errors.push(e.message));
  await signIn(owner);
  await workspaceView(owner, 'settings');
  await owner.locator('#verify-live-updates').click();
  await expect(owner.locator('#admin-alert')).toContainText('Live delivery verified');
  await workspaceView(owner, 'inquiries');
  await contact.goto(provider.base + '/contact/');
  await contact.locator('[name="name"]').fill('Phone Live Inquiry');
  await contact.locator('[name="email"]').fill('phone-live@example.test');
  await contact.locator('[name="service"]').selectOption('Not sure yet');
  await contact
    .locator('[name="message"]')
    .fill('Please help coordinate our weekly client appointments.');
  await contact.locator('[name="privacyAcknowledged"]').check();
  const started = Date.now();
  await contact.getByRole('button', { name: 'Send inquiry' }).click();
  await expect(contact.locator('.form-status')).toContainText('Reference:');
  await expect(owner.locator('#inquiry-list')).toContainText('Phone Live Inquiry', {
    timeout: 5000,
  });
  expect(Date.now() - started).toBeLessThan(5000);
  await owner.getByRole('button', { name: /Phone Live Inquiry/ }).click();
  await owner.locator('.detail-status-select').selectOption('in_progress');
  await owner.getByRole('button', { name: 'Save status', exact: true }).click();
  await expect(owner.locator('#metric-progress')).toHaveText('1');
  await owner.locator('[name="note"]').fill('Agreed a weekly handoff and calendar review.');
  await owner.getByRole('button', { name: 'Save note', exact: true }).click();
  await expect(owner.locator('#inquiry-note-list')).toContainText('Agreed a weekly handoff');
  await owner.getByRole('button', { name: 'Convert to client', exact: true }).click();
  await owner.locator('#confirm-accept').click();
  await workspaceView(owner, 'clients');
  await expect(owner.locator('#client-list')).toContainText('Phone Live Inquiry');
  await owner.reload();
  await expect(owner.locator('#admin-app')).toBeVisible();
  await workspaceView(owner, 'clients');
  await expect(owner.locator('#client-list')).toContainText('Phone Live Inquiry');
  expect(await contact.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
    true,
  );
  expect(
    await contact
      .locator('[name="email"]')
      .evaluate((node: Element) => parseFloat(getComputedStyle(node).fontSize)),
  ).toBeGreaterThanOrEqual(16);
  await expect(contact.locator('.skip-link')).toHaveCSS('opacity', '0');
  expect(errors).toEqual([]);
  await owner.screenshot({ path: 'test-results/owner-clients.png', fullPage: true });
  await contact.screenshot({ path: 'test-results/phone-contact.png', fullPage: true });
  await ownerContext.close();
  await phone.close();
});

test('another staff member can add a note without replacing the owner draft; logout closes access', async ({
  browser,
}) => {
  const first = await browser.newContext();
  const second = await browser.newContext();
  await realtime(first);
  await realtime(second);
  const owner = await first.newPage();
  const staff = await second.newPage();
  await signIn(owner);
  await signIn(staff, 'staff@example.test');
  await expect(staff.locator('#content-nav')).toBeHidden();
  await owner.getByRole('button', { name: /Phone Live Inquiry/ }).click();
  await staff.getByRole('button', { name: /Phone Live Inquiry/ }).click();
  await owner.locator('[name="note"]').fill('This draft must survive another staff update.');
  await staff.locator('[name="note"]').fill('Staff completed the calendar access checklist.');
  await staff.getByRole('button', { name: 'Save note', exact: true }).click();
  await expect(owner.locator('#inquiry-note-list')).toContainText(
    'Staff completed the calendar access checklist.',
  );
  await expect(owner.locator('[name="note"]')).toHaveValue(
    'This draft must survive another staff update.',
  );
  await owner.locator('#sign-out').click();
  await owner.locator('#confirm-accept').click();
  await expect(owner.locator('#admin-app')).toBeHidden();
  await expect(owner.locator('#inquiry-list')).toBeEmpty();
  await first.close();
  await second.close();
});

test('published copy reaches an already-open public page without a reload', async ({ browser }) => {
  const context = await browser.newContext();
  await realtime(context);
  const owner = await context.newPage();
  const home = await context.newPage();
  await signIn(owner);
  await home.goto(provider.base + '/');
  await expect(home.locator('html')).toHaveAttribute('data-content-connection', 'live');
  await workspaceView(owner, 'content');
  await settingsGroup(owner, 'home');
  await owner
    .getByLabel('Home page heading', { exact: true })
    .fill('Live published virtual assistant support');
  await owner.locator('#save-site-content').click();
  await expect(owner.locator('#admin-alert')).toContainText('saved and published');
  await expect(home.locator('[data-site-content="homeHeadline"]')).toHaveText(
    'Live published virtual assistant support',
    { timeout: 5000 },
  );
  await context.close();
});

test('production browser receives published packages over Supabase and retains selected context', async ({
  browser,
}) => {
  const context = await browser.newContext();
  await realtime(context);
  const owner = await context.newPage();
  const visitor = await context.newPage();
  await signIn(owner);
  await visitor.goto(provider.base + '/contact/?plan=professional');
  await expect(visitor.locator('[name="requestedPlan"]')).toHaveValue('professional');
  await visitor
    .locator('[name="message"]')
    .fill('Please retain this draft while the package updates.');
  await workspaceView(owner, 'content');
  await owner.locator('[data-editor-tab="plans"]').click();
  await owner
    .locator('#cms-plans [data-catalog-id="professional"]')
    .getByLabel('Displayed price')
    .fill('₱19,000');
  await owner.locator('#save-site-content').click();
  await expect(owner.locator('#admin-alert')).toContainText('saved and published');
  await expect(visitor.locator('[data-plan-summary]')).toContainText('₱19,000', { timeout: 5000 });
  await expect(visitor.locator('[name="message"]')).toHaveValue(
    'Please retain this draft while the package updates.',
  );
  await context.close();
});

test('reconnection catches an inquiry committed while the socket was disconnected', async ({
  browser,
}) => {
  const context = await browser.newContext();
  const wire = await realtime(context);
  const page = await context.newPage();
  await signIn(page);
  wire.disconnect();
  await expect(page.locator('.system-status')).toContainText('Reconnecting');
  const response = await fetch(provider.base + '/api/inquiries', {
    method: 'POST',
    headers: { Origin: provider.base, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idempotencyKey: crypto.randomUUID(),
      name: 'Missed while disconnected',
      email: 'reconnect@example.test',
      company: 'Synthetic reconnect fixture',
      phone: '',
      service: 'Not sure yet',
      message: 'A change committed while this test socket was closed.',
      privacyAcknowledged: true,
      website: '',
    }),
  });
  expect(response.status).toBe(202);
  wire.resume();
  await expect(page.locator('.system-status')).toContainText('Live updates connected', {
    timeout: 10000,
  });
  await expect(page.locator('#inquiry-list')).toContainText('Missed while disconnected');
  await context.close();
});

test('a privacy request arrives live and verified deletion removes linked contact and note data', async ({
  browser,
}) => {
  const context = await browser.newContext();
  await realtime(context);
  const owner = await context.newPage();
  const privacy = await context.newPage();
  await signIn(owner);
  await workspaceView(owner, 'privacy');
  await privacy.goto(provider.base + '/privacy/');
  const form = privacy.locator('[data-form="privacy-request"]');
  await form.locator('[name="name"]').fill('Phone deletion requester');
  await form.locator('[name="email"]').fill('phone-live@example.test');
  await form.locator('[name="requestType"]').selectOption('deletion');
  await form
    .locator('[name="message"]')
    .fill('Please delete my synthetic inquiry and client details.');
  await form.locator('[name="privacyAcknowledged"]').check();
  await form.getByRole('button', { name: 'Submit request' }).click();
  await expect(form.locator('.form-status')).toContainText('Reference:');
  const card = owner
    .locator('.privacy-request-card')
    .filter({ hasText: 'Phone deletion requester' });
  await expect(card).toBeVisible();
  await card.locator('input[type="checkbox"]').check();
  await card.locator('select').selectOption('delete_all_records');
  await card
    .getByLabel('Completion notes')
    .fill('Synthetic requester identity verified against the test fixture.');
  await card.getByRole('button', { name: 'Complete request' }).click();
  await owner.locator('#confirm-accept').click();
  await expect(card).toHaveCount(0);
  await workspaceView(owner, 'inquiries');
  await owner.getByRole('button', { name: /Deleted inquiry/ }).click();
  await expect(owner.locator('#inquiry-note-list')).not.toContainText('calendar access checklist');
  await expect(owner.locator('[name="note"]')).toBeDisabled();
  await workspaceView(owner, 'clients');
  await expect(owner.locator('#client-list')).toContainText('Deleted client');
  await expect(owner.locator('#client-list')).not.toContainText('phone-live@example.test');
  await context.close();
});

for (const width of [320, 390, 768, 1440]) {
  test(`public and signed-out owner pages fit ${width}px without exposing the workspace`, async ({
    browser,
  }) => {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    await realtime(context);
    const page = await context.newPage();
    for (const path of ['/', '/contact/', '/admin/']) {
      await page.goto(provider.base + path);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      if (path === '/') {
        await page.keyboard.press('Tab');
        await expect(page.locator('.skip-link')).toBeFocused();
        await expect(page.locator('.skip-link')).toHaveCSS('opacity', '1');
      }
      if (path === '/admin/') {
        await expect(page.locator('#admin-login')).toBeVisible();
        await expect(page.locator('#admin-app')).toBeHidden();
      }
    }
    await signIn(page);
    for (const view of ['inquiries', 'clients', 'privacy', 'content']) {
      await workspaceView(page, view);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
    if (width === 390)
      await page.screenshot({ path: 'test-results/phone-owner-editor.png', fullPage: true });
    await context.close();
  });
}
