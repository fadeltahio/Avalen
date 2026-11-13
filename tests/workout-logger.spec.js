import { test, expect } from '@playwright/test';

async function start(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore demo' }).click();
  await page.getByRole('button', { name: 'View Upper Body A', exact: true }).click();
  await page.getByRole('button', { name: 'Begin Workout', exact: true }).click();
}
const weight = page => page.getByRole('spinbutton', { name: 'Weight (kg)', exact: true });
const reps = page => page.getByRole('spinbutton', { name: 'Reps', exact: true });
const draft = page => page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('avalen.workspace.v1')).drafts)[0]);

test('logger persists unlogged entries and supports corrections without losing set numbers', async ({ page }) => {
  await start(page);
  await weight(page).fill('62.5');
  await reps(page).fill('11');
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.reload();
  await page.getByRole('button', { name: /^Resume workout:/ }).click();
  await expect(weight(page)).toHaveValue('62.5');
  await expect(reps(page)).toHaveValue('11');
  await page.getByRole('button', { name: 'Log set 1', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Log set 2' })).toBeEnabled();
  await expect(page.getByRole('timer')).toBeVisible();
  await page.getByRole('button', { name: 'Edit set 1', exact: true }).click();
  await weight(page).fill('65');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('button', { name: 'Edit set 1', exact: true })).toContainText('65 × 11');
  await page.getByRole('button', { name: 'Skip rest', exact: true }).click();
  await page.getByRole('button', { name: 'Log set 2' }).click();
  await page.getByRole('button', { name: 'Undo set 1', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Edit set 2', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Log set 1' })).toBeEnabled();
  // The logger ignores a second "log" within 400 ms of the last save (double-tap guard).
  await page.waitForTimeout(450);
  await page.getByRole('button', { name: 'Log set 1' }).click();
  await expect(page.getByRole('button', { name: 'Edit set 1', exact: true })).toBeVisible();
  const d = await draft(page);
  expect(d.sets).toHaveLength(2);
  expect(d.sets.map(s => s.set).sort()).toEqual([1, 2]);
});

test('logger input validation, effort controls and duplicate-tap protection', async ({ page }) => {
  await start(page);
  await reps(page).fill('0');
  await expect(page.getByRole('button', { name: 'Log set 1' })).toBeDisabled();
  await expect(page.getByRole('alert')).toContainText('whole number');
  await reps(page).fill('8.5');
  await expect(page.getByRole('button', { name: 'Log set 1' })).toBeDisabled();
  await reps(page).fill('8');
  await weight(page).fill('1001');
  await expect(page.getByRole('button', { name: 'Log set 1' })).toBeDisabled();
  await weight(page).fill('0');
  await page.getByText('How did it feel?', { exact: false }).click();
  await page.getByRole('tab', { name: 'Hard', exact: true }).click();
  expect((await draft(page)).sets).toHaveLength(0);
  await page.getByRole('button', { name: 'Log set 1' }).dblclick();
  await expect.poll(async () => (await draft(page)).sets.length).toBe(1);
  expect((await draft(page)).sets[0]).toMatchObject({ weight: 0, reps: 8, effort: 'Hard' });
});

test('rest survives reload and finishes normally; the logger fits small phones', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.clock.install();
  await start(page);
  await expect(page.getByRole('button', { name: 'Log set 1' })).toBeInViewport();
  const increase = await page.getByRole('button', { name: 'Increase Reps', exact: true }).boundingBox();
  expect(increase.width).toBeGreaterThanOrEqual(44);
  expect(increase.height).toBeGreaterThanOrEqual(44);
  expect(await page.locator('.workout-modal').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.getByRole('button', { name: 'Log set 1' }).click();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.reload();
  await page.getByRole('button', { name: /^Resume workout:/ }).click();
  await expect(page.getByRole('button', { name: 'Log set 2' })).toBeEnabled();
  await page.clock.fastForward(91000);
  await expect(page.getByRole('button', { name: 'Log set 2' })).toBeEnabled();
  await page.getByRole('button', { name: 'Log set 2' }).click();
  await page.getByRole('button', { name: 'Skip rest', exact: true }).click();
  await page.getByRole('button', { name: 'Log set 3' }).click();
  await expect(page.getByText('Exercise complete', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next exercise', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Incline dumbbell press', exact: true })).toBeVisible();
});
