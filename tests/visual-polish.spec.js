import { test, expect } from '@playwright/test';

for (const width of [375, 768, 1440]) {
  test(`both themes and workspaces fit ${width}px`, async ({ page }, testInfo) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Explore demo' }).click();
    const nav = name => page.getByRole('navigation', { name: width > 760 ? 'Workspace navigation' : 'Main navigation' }).getByRole('button', { name, exact: true });
    const fits = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await nav('More').click();
    await page.getByRole('group', { name: 'Colour theme' }).getByRole('button', { name: /^Dark / }).click();
    await nav('Home').click();
    await fits();
    await page.screenshot({ path: testInfo.outputPath('today-dark.png'), fullPage: true, animations: 'disabled' });
    const dark = await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor);
    await nav('More').click();
    await page.getByRole('group', { name: 'Colour theme' }).getByRole('button', { name: /^Light / }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect.poll(() => page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe(dark);
    await fits();
    await page.screenshot({ path: testInfo.outputPath('settings-light.png'), fullPage: true, animations: 'disabled' });
    await page.getByLabel('Workspace role').selectOption('coach');
    await expect(page.getByRole('heading', { name: /Good/ })).toBeVisible();
    await fits();
    await page.screenshot({ path: testInfo.outputPath('coach-light.png'), fullPage: true, animations: 'disabled' });
    for (const section of ['Clients', 'Programs', 'Inbox', 'Business']) {
      await nav(section).click();
      await fits();
    }
    expect(errors).toEqual([]);
  });
}

test('system reduced-motion preference suppresses page animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore demo' }).click();
  const duration = await page.locator('main').evaluate(el => getComputedStyle(el).animationDuration);
  expect(parseFloat(duration)).toBeLessThanOrEqual(0.01);
});
