import { test, expect } from '@playwright/test';

const nav = (page, name) => page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name, exact: true });
const state = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('avalen.workspace.v1')));
async function demo(page, role = 'client') {
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore demo', exact: true }).click(); // shown as "Skip for now"
  await expect(nav(page, 'Home')).toBeVisible();
  if (role === 'coach') await page.getByLabel('Workspace role').selectOption('coach');
}
async function openDevices(page) {
  await nav(page, 'More').click();
  await page.locator('.settings-disclosure > summary').filter({ hasText: 'Connected devices' }).click();
  return page.locator('.wearable-connections');
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

test('coach sees a low-recovery flag, every client’s readout and the client’s sleep and recovery card', async ({ page }) => {
  await demo(page, 'coach');
  const queue = page.locator('.review-queue');
  await expect(queue.locator('.review-queue-item').filter({ hasText: 'Sophie Williams' })).toContainText('Low recovery today');

  await nav(page, 'Clients').click();
  const jordan = page.locator('.client-card').filter({ hasText: 'Jordan Williams' });
  await expect(jordan.locator('.client-wearable')).toContainText('WHOOP');
  await expect(page.locator('.client-card').filter({ hasText: 'Maya Chen' }).locator('.client-wearable')).toContainText('Apple Health');
  await expect(page.locator('.client-card').filter({ hasText: 'Noah Patel' }).locator('.client-wearable')).toHaveCount(0);

  await page.locator('.client-card').filter({ hasText: 'Sophie Williams' }).click();
  const card = page.getByRole('region', { name: 'Sleep and recovery' });
  await expect(card.locator('.wearable-heading')).toContainText('WHOOP');
  await expect(card.locator('.wearable-flag')).toContainText('Recovery 22% · HRV 31 ms');
  await expect(card.locator('.wearable-tile').first()).toContainText('Recovery22%');
  await expect(card.locator('.wearable-tile').nth(2)).toContainText('Strain');
  await expect(card).toContainText('Sample data · demo workspace');
  await card.getByRole('button', { name: /Review plan/ }).click();
  await expect(page.getByRole('tab', { name: 'Plan', selected: true }).or(page.locator('[aria-selected="true"]', { hasText: 'Plan' })).first()).toBeVisible();
});

test('client sees last night on Home, and devices that need an account say where they work', async ({ page }) => {
  await demo(page);
  const home = page.getByRole('button', { name: 'Your wearable readings from WHOOP' });
  await expect(home).toContainText('Recovery');
  await expect(home).toContainText('Sample data · demo workspace');
  const devices = await openDevices(page);
  for (const name of ['WHOOP', 'Google Health', 'Apple Health', 'Health Connect']) await expect(devices.locator('.device-row').filter({ hasText: name })).toBeVisible();
  await expect(devices.locator('.device-row').filter({ hasText: 'WHOOP' })).toContainText('Available in your private coaching workspace');
  await expect(devices.locator('.device-row').filter({ hasText: 'Apple Health' })).toContainText('Syncs automatically from the Avalen iPhone app');
  await expect(devices.getByRole('button', { name: 'Connect', exact: true })).toHaveCount(0);
});

test('a failed manual entry keeps the numbers and shows no success; a retry saves it', async ({ page }) => {
  await demo(page);
  const devices = await openDevices(page);
  await devices.getByRole('button', { name: /Enter readings manually/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Enter readings', exact: true });
  await dialog.getByLabel('Sleep (hours)', { exact: true }).fill('7.5');
  await dialog.getByLabel('HRV (ms)', { exact: true }).fill('52');
  await dialog.getByLabel('Resting heart rate (bpm)', { exact: true }).fill('400');
  await dialog.getByRole('button', { name: 'Save readings', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('200 or less');
  await dialog.getByLabel('Resting heart rate (bpm)', { exact: true }).fill('55');
  await failSaves(page);
  await dialog.getByRole('button', { name: 'Save readings', exact: true }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('alert')).toContainText('couldn’t be saved');
  await expect(dialog.getByLabel('Sleep (hours)', { exact: true })).toHaveValue('7.5');
  await expect(page.getByText('Your readings are saved.')).toHaveCount(0);
  await page.evaluate(() => window.restoreStorage());
  await dialog.getByRole('button', { name: 'Save readings', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText('Your readings are saved.')).toBeVisible();
  const saved = (await state(page)).wearableDays.at(-1);
  expect([saved.provider, saved.metrics.sleepMinutes, saved.metrics.hrvMs, saved.metrics.restingHr]).toEqual(['manual', 450, 52, 55]);
});

test('when the client stops sharing recovery, the coach no longer sees it', async ({ page }) => {
  await demo(page);
  const devices = await openDevices(page);
  const recovery = devices.getByRole('checkbox', { name: /^Recovery/ });
  await expect(recovery).toBeChecked();
  await recovery.uncheck();
  await expect(recovery).not.toBeChecked();
  expect((await state(page)).clients[0].wearables.share).toEqual({ sleep: true, recovery: false, activity: true });

  await page.getByLabel('Workspace role').selectOption('coach');
  await nav(page, 'Clients').click();
  await expect(page.locator('.client-card').filter({ hasText: 'Jordan Williams' }).locator('.client-wearable')).not.toContainText('Recovery');
  await page.locator('.client-card').filter({ hasText: 'Jordan Williams' }).click();
  const card = page.getByRole('region', { name: 'Sleep and recovery' });
  await expect(card.locator('.wearable-tile').first()).not.toContainText('Recovery');
  await expect(card).toContainText('isn’t sharing recovery');
  await expect(card).not.toContainText('HRV');
});
