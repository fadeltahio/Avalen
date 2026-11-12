import { test, expect } from '@playwright/test';

test('unreadable saved data is preserved and can be downloaded', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('avalen.workspace.v1', '{broken-record'));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Your records come first.' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('avalen.workspace.v1'))).toBe('{broken-record');
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download recovery copy' }).click();
  expect((await pending).suggestedFilename()).toBe('avalen-recovery.json');
});

test('dialogs are named and blank names receive inline feedback', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Get Started', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Make it personal.' })).toBeVisible();
  await page.getByLabel('Your name').fill('   ');
  await page.getByLabel('Email', { exact: true }).fill('test@example.com');
  await page.getByLabel('Coach code').fill('00000');
  await page.getByRole('button', { name: 'Join my coach' }).click();
  await expect(page.getByRole('alert')).toContainText('Please enter your name');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Get Started', exact: true })).toBeFocused();
});

test('appearance persists and navigation works without runtime errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore demo' }).click();
  const nav = name => page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name, exact: true });
  await nav('More').click();
  await page.getByRole('button', { name: /Light A clean/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  for (const name of ['Train', 'Nutrition', 'Progress', 'More', 'Home']) {
    await nav(name).click();
    await expect(nav(name)).toHaveAttribute('aria-current', 'page');
  }
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
