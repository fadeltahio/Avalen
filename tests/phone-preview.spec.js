import {test, expect} from '@playwright/test';

test('plain HTTP phone preview loads, logs a meal and keeps it after reload', async ({page, baseURL}) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  // Serve the real app under an insecure origin without requiring a particular Wi-Fi IP.
  await page.route('http://avalen-preview.test/**', async route => {
    const url = new URL(route.request().url());
    const upstream = new URL(baseURL);
    url.host = upstream.host;
    await route.fulfill({response: await page.request.fetch(url.href, {maxRetries: 2})});
  });
  await page.goto('http://avalen-preview.test/');
  expect(await page.evaluate(() => isSecureContext)).toBe(false);
  expect(await page.evaluate(() => typeof crypto.randomUUID)).toBe('undefined');
  await page.getByRole('button', {name: 'Explore demo'}).click();
  await expect(page.getByRole('heading', {name: /Make it count,/})).toBeVisible();
  await page.getByRole('button', {name: 'Open coach meal plan'}).click();
  await expect(page.locator('.nutrition-plan-disclosure')).toHaveAttribute('open');
  await page.getByRole('button', {name: 'Log planned Breakfast', exact: true}).click();
  await page.getByRole('button', {name: 'Log meal', exact: true}).click();
  const snapshot = () => page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('avalen.workspace.v1'));
    return {client: data.activeClientId, log: data.foodLogs.at(-1)};
  });
  const saved = await snapshot();
  expect(saved.log.source).toBe('coach-plan');
  expect(saved.log.id).toMatch(/^[0-9a-f-]{36}$/);
  await page.reload();
  await expect(page.getByRole('button', {name: 'Reload app'})).toHaveCount(0);
  await expect(page.getByRole('navigation', {name: 'Main navigation'})).toBeVisible();
  expect(await snapshot()).toEqual(saved);
  expect(errors).toEqual([]);
});
