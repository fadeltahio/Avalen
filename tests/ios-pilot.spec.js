import { test, expect } from '@playwright/test';

// The iPhone app during the pilot hides wearable connections and online payment
// (src/avalen/features.js). These tests load the app as the iPhone app sees itself:
// Capacitor defines window.Capacitor.isNativePlatform() before any app code runs.
const nav = (page, name) => page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name, exact: true });
const UNSUPPORTED = /WHOOP|Google Health|Apple Health|Health Connect|Android|Syncs automatically|Paymob/;

async function demo(page, { iPhone = true, role = 'client' } = {}) {
  if (iPhone) await page.addInitScript(() => { window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'ios' }; });
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore demo', exact: true }).click();
  await expect(nav(page, 'Home')).toBeVisible();
  if (role === 'coach') await page.getByLabel('Workspace role').selectOption('coach');
}
async function addDuePayment(page) {
  await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('avalen.workspace.v1'));
    data.payments.push({ id: 'due-ios', clientId: data.activeClientId || data.clients[0].id, amount: 1500, currency: 'EGP', label: 'Monthly coaching', period: new Date().toISOString().slice(0, 7), dueDate: new Date().toISOString().slice(0, 10), status: 'due', method: null, verified: false, paidAt: null, createdAt: new Date().toISOString() });
    localStorage.setItem('avalen.workspace.v1', JSON.stringify(data));
  });
  await page.reload();
  await expect(nav(page, 'Home')).toBeVisible();
}

test('iPhone client: no wearable connections or sync claims, and readings can still be entered by hand', async ({ page }) => {
  await demo(page);
  const home = page.locator('.wearable-home-connect');
  await expect(home).toContainText('Add sleep & recovery');
  await expect(page.locator('main')).not.toContainText(UNSUPPORTED);

  await nav(page, 'More').click();
  await expect(page.locator('.settings-disclosure > summary').filter({ hasText: 'Connected devices' })).toHaveCount(0);
  await page.locator('.settings-disclosure > summary').filter({ hasText: 'Sleep & recovery' }).click();
  const section = page.locator('.wearable-connections');
  await expect(section.locator('.device-row')).toHaveCount(0);
  await expect(section).not.toContainText(UNSUPPORTED);
  await expect(section.getByText('What your coach sees')).toBeVisible();

  await section.getByRole('button', { name: /Enter readings manually/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Enter readings' });
  await expect(dialog).not.toContainText(UNSUPPORTED);
  await dialog.getByLabel('Sleep (hours)').fill('7.5');
  await dialog.getByLabel('Steps').fill('8200');
  await dialog.getByRole('button', { name: 'Save readings' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(section).toContainText('Your readings are saved.');
  await expect(section).toContainText('Entered manually');
});

test('iPhone client: a payment due shows no checkout, only how to pay the coach', async ({ page }) => {
  await demo(page);
  await addDuePayment(page);
  await nav(page, 'More').click();
  const due = page.locator('.client-pay-due').filter({ hasText: 'Monthly coaching' });
  await expect(due).toBeVisible();
  await expect(due).toContainText('Pay your coach directly. They record your payment here.');
  await expect(due.getByRole('button', { name: /Pay with/ })).toHaveCount(0);
  await expect(page.locator('main')).not.toContainText(/Paymob/);
});

test('iPhone coach: no Paymob connection, no wearable connection prompts, and payments can still be recorded', async ({ page }) => {
  await demo(page, { role: 'coach' });
  await expect(page.locator('main')).not.toContainText(UNSUPPORTED);
  await nav(page, 'Business').click();
  await expect(page.getByRole('heading', { name: 'Business' })).toBeVisible();
  await expect(page.locator('.pay-connect')).toHaveCount(0);
  await expect(page.locator('main')).not.toContainText(/Paymob/);
  await nav(page, 'Clients').click();
  await expect(page.locator('.client-wearable')).toHaveCount(0);
});

test('in a browser (not the iPhone app) the web app is unchanged', async ({ page }) => {
  await demo(page, { iPhone: false });
  await expect(page.getByRole('button', { name: 'Your wearable readings from WHOOP' })).toBeVisible();
  await page.getByLabel('Workspace role').selectOption('coach');
  await nav(page, 'Business').click();
  await expect(page.locator('.pay-connect')).toContainText('Paymob');
});
