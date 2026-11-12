import { test, expect } from '@playwright/test';
const nav = (page, name) => page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name, exact: true });
async function coach(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore demo' }).click();
  await page.getByLabel('Workspace role').selectOption('coach');
}
async function clientProfile(page, name) {
  await nav(page, 'Clients').click();
  await page.getByRole('button').filter({ has: page.getByRole('heading', { name, exact: true }) }).click();
}

test('context messages stay with the selected client and removing context preserves draft', async ({ page }) => {
  await coach(page);
  await clientProfile(page, 'Maya Chen');
  await page.getByRole('tab', { name: 'Progress', exact: true }).click();
  await page.getByRole('tab', { name: 'Strength', exact: true }).click();
  await page.getByRole('button', { name: 'Message client', exact: false }).first().click();
  const conversation = page.locator('.conversation-heading');
  await expect(conversation).toContainText('Maya Chen');
  const input = page.getByRole('textbox', { name: /message/i });
  await input.fill('Let’s review your next training block.');
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(input).toHaveValue('Let’s review your next training block.');
  await expect(conversation).toContainText('Maya Chen');
});

test('programme builder blocks invalid durations and fractional set counts', async ({ page }) => {
  await coach(page);
  await clientProfile(page, 'Jordan Williams');
  await page.getByRole('tab', { name: 'Plan', exact: true }).click();
  await page.getByRole('button', { name: 'Edit programme' }).click();
  const save = page.getByRole('button', { name: 'Save programme', exact: true });
  await page.getByLabel('Weeks', { exact: true }).fill('1.5');
  await save.click();
  await expect(page.getByRole('alert').last()).toContainText('Weeks');
  await page.getByLabel('Weeks', { exact: true }).fill('12');
  await page.getByLabel('Estimated minutes').fill('-5');
  await save.click();
  await expect(page.getByRole('alert').last()).toContainText('minutes');
  await page.getByLabel('Estimated minutes').fill('45');
  await page.locator('.exercise-editor summary').first().click();
  await page.getByLabel('Sets', { exact: true }).first().fill('2.5');
  await save.click();
  await expect(page.getByRole('alert').last()).toContainText('sets');
  await page.getByLabel('Sets', { exact: true }).first().fill('3');
  await save.click();
  await expect(page.getByRole('dialog', { name: 'Programme builder' })).toHaveCount(0);
});

test('feed upload preserves text typed during upload and blocks premature publishing', async ({ page }) => {
  await page.addInitScript(() => {
    const original = File.prototype.arrayBuffer;
    File.prototype.arrayBuffer = async function () {
      await new Promise(resolve => { window.releaseUpload = resolve; });
      return original.call(this);
    };
  });
  await coach(page);
  await nav(page, 'Inbox').click();
  await page.getByRole('tab', { name: 'Feed', exact: true }).click();
  await page.getByRole('button', { name: 'New post' }).click();
  await page.getByLabel('Title', { exact: true }).fill('First title');
  await page.getByLabel('Post', { exact: true }).fill('First message');
  await page.getByLabel('Upload a photo or video').setInputFiles('src/assets/share-track-dawn-v2.jpg');
  await expect(page.getByRole('button', { name: 'Saving attachment…' })).toBeDisabled();
  await page.getByLabel('Title', { exact: true }).fill('Updated while uploading');
  await page.getByLabel('Post', { exact: true }).fill('Keep this newly typed message.');
  await expect.poll(() => page.evaluate(() => typeof window.releaseUpload)).toBe('function');
  await page.evaluate(() => window.releaseUpload());
  await page.getByRole('button', { name: 'Publish to members' }).click();
  await expect(page.getByRole('heading', { name: 'Updated while uploading' })).toBeVisible();
  await expect(page.getByText('Keep this newly typed message.')).toBeVisible();
});
