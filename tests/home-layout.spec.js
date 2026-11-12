import { test, expect } from '@playwright/test';

const nav = (page, name) => page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name, exact: true });
const state = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('avalen.workspace.v1')));
async function demo(page, role = 'client') {
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore demo', exact: true }).click(); // shown as "Skip for now"
  await expect(nav(page, 'Home')).toBeVisible();
  if (role === 'coach') await page.getByLabel('Workspace role').selectOption('coach');
}
async function failSaves(page) {
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    window.restoreStorage = () => (Storage.prototype.setItem = original);
    Storage.prototype.setItem = function (key, value) {
      if (key === 'avalen.workspace.v1') throw new DOMException('Full', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  });
}

test('client removes and reorders home widgets; a failed save keeps the editor open; reset restores the default', async ({ page }) => {
  await demo(page);
  await expect(page.getByRole('button', { name: 'Open live recovery' })).toBeVisible();
  await page.getByRole('button', { name: 'Customise home' }).click();
  const editor = page.getByRole('dialog', { name: 'Customise home', exact: true });
  await editor.getByRole('button', { name: 'Remove Live recovery' }).click();
  await expect(editor.getByRole('list', { name: 'Not on your home screen' })).toContainText('Live recovery');
  await editor.getByRole('button', { name: 'Move Last night up' }).click();
  await editor.getByRole('button', { name: 'Move Last night up' }).click();
  await expect(editor.getByRole('list', { name: 'On your home screen' }).getByRole('listitem').first()).toContainText('Last night');

  await failSaves(page);
  await editor.getByRole('button', { name: 'Save home' }).click();
  await expect(editor).toBeVisible();
  await expect(editor.getByRole('alert')).toBeVisible();
  await expect(editor.getByRole('list', { name: 'On your home screen' }).getByRole('listitem').first()).toContainText('Last night');
  await page.evaluate(() => window.restoreStorage());
  await editor.getByRole('button', { name: 'Save home' }).click();
  await expect(editor).toHaveCount(0);

  await expect(page.getByRole('button', { name: 'Open live recovery' })).toHaveCount(0);
  const wearable = await page.getByRole('button', { name: /Your wearable readings/ }).boundingBox();
  const session = await page.locator('.home-today-session, .editorial-resume').first().boundingBox();
  expect(wearable.y).toBeLessThan(session.y);
  expect((await state(page)).clients[0].homeLayout.hidden).toEqual(['recovery']);

  await page.getByRole('button', { name: 'Customise home' }).click();
  await page.getByRole('dialog', { name: 'Customise home' }).getByRole('button', { name: /Reset to default/ }).click();
  await expect(page.getByRole('button', { name: 'Open live recovery' })).toBeVisible();
  expect((await state(page)).clients[0].homeLayout).toBeUndefined();
});

test('coach adds, removes and reorders dashboard widgets, including client recovery', async ({ page }) => {
  await demo(page, 'coach');
  const widget = page.getByRole('region', { name: 'Client recovery' });
  await expect(widget.locator('.coach-recovery-row').first()).toContainText('Sophie Williams');
  await page.getByRole('button', { name: 'Customise home' }).click();
  const editor = page.getByRole('dialog', { name: 'Customise home', exact: true });
  await editor.getByRole('button', { name: 'Remove Coaching insights' }).click();
  await editor.getByRole('button', { name: 'Move Client recovery up' }).click();
  await editor.getByRole('button', { name: 'Move Client recovery up' }).click();
  await editor.getByRole('button', { name: 'Save home' }).click();
  await expect(editor).toHaveCount(0);
  await expect(page.locator('.coach-secondary-section summary', { hasText: 'Coaching insights' })).toHaveCount(0);
  const recovery = await widget.boundingBox(), queue = await page.getByRole('region', { name: 'Your review queue' }).boundingBox();
  expect(recovery.y).toBeLessThan(queue.y);
  await page.getByRole('button', { name: 'Customise home' }).click();
  await editor.getByRole('button', { name: 'Add Coaching insights' }).click();
  await editor.getByRole('button', { name: 'Save home' }).click();
  await expect(page.locator('.coach-secondary-section summary', { hasText: 'Coaching insights' })).toBeVisible();
  await widget.locator('.coach-recovery-row').first().click();
  await expect(page.getByRole('heading', { name: 'Sophie Williams' })).toBeVisible();
});
