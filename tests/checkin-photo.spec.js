import { test, expect } from '@playwright/test';

const nav = (page, name) => page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name, exact: true });
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

test('client adds an optional progress photo to a check-in and the coach sees it in review', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore demo', exact: true }).click(); // shown as "Skip for now"
  await expect(nav(page, 'Home')).toBeVisible();
  await page.locator('.home-essentials button').filter({ hasText: 'Check-in' }).click();
  await page.getByRole('button', { name: /Start check-in|Edit today’s check-in/ }).click();
  const form = page.getByRole('dialog', { name: 'Your check-in' });
  for (const input of await form.locator('input[type="number"][required]').all()) await input.fill('80');
  await form.locator('summary', { hasText: 'Add progress photos' }).click();
  await expect(form.locator('summary', { hasText: 'Add progress photos' })).toContainText('Optional');
  await form.getByLabel('Add progress photos').setInputFiles({ name: 'front.png', mimeType: 'image/png', buffer: png });
  await expect(form.locator('.checkin-photo-disclosure .checkin-photos img')).toHaveCount(1);
  await form.getByRole('button', { name: 'Remove front.png' }).click();
  await expect(form.locator('.checkin-photo-disclosure .checkin-photos img')).toHaveCount(0);
  await form.getByLabel('Add progress photos').setInputFiles({ name: 'front.png', mimeType: 'image/png', buffer: png });
  await expect(form.locator('.checkin-photo-disclosure .checkin-photos img')).toHaveCount(1);
  await form.getByRole('button', { name: /Send/ }).click();
  await expect(form).toHaveCount(0);

  await page.getByLabel('Workspace role').selectOption('coach');
  await nav(page, 'Clients').click();
  await page.locator('.client-card').filter({ hasText: 'Jordan Williams' }).click();
  await page.getByRole('tab', { name: 'Check-ins' }).or(page.getByRole('button', { name: 'Check-ins', exact: true })).first().click();
  await page.locator('.checkin-summary').first().click();
  const review = page.getByRole('dialog', { name: /check-in ·/ });
  await expect(review.locator('.checkin-review-answer.photos h3')).toHaveText('Progress photos');
  await expect(review.locator('.checkin-review-answer.photos img')).toHaveCount(1);
});
