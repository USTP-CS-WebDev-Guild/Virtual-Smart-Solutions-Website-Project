import { expect, type Page } from 'playwright/test';
export async function workspaceView(page: Page, view: string) {
  const nav = page.locator('.admin-nav-item[data-view="' + view + '"]');
  const toggle = page.locator('#workspace-menu-toggle');
  const drawer = page.locator('#workspace-navigation');
  const mobile = await toggle.isVisible();
  if (mobile) {
    if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
    await expect(drawer).toHaveAttribute('data-open', 'true');
  }
  await nav.click();
  await expect(page.locator('#' + view + '-view')).toBeVisible();
  await expect(nav).toHaveAttribute('aria-current', 'page');
  if (mobile) {
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(drawer).toBeHidden();
  }
}
export async function settingsGroup(page: Page, name: string) {
  const group = page.locator('[data-settings-group="' + name + '"]');
  if ((await group.getAttribute('open')) === null) await group.locator('summary').click();
}
