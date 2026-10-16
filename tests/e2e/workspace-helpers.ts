import { expect, type Page } from 'playwright/test';
export async function workspaceView(page: Page, view: string) {
  const nav = page.locator('.admin-nav-item[data-view="' + view + '"]');
  if (!(await nav.isVisible()))
    await page.getByRole('button', { name: 'Open workspace navigation' }).click();
  await nav.click();
  await expect(page.locator('#' + view + '-view')).toBeVisible();
}
export async function settingsGroup(page: Page, name: string) {
  const group = page.locator('[data-settings-group="' + name + '"]');
  if ((await group.getAttribute('open')) === null) await group.locator('summary').click();
}
