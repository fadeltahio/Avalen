import { test, expect } from '@playwright/test';
const nav = (page, name) => page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name, exact: true });
async function demo(page) { await page.goto('/'); await page.getByRole('button', { name: 'Explore demo' }).click(); }

test('water additions, custom amounts and undo persist and share with nutrition and habits', async ({ page }) => {
  await demo(page);
  const before = Number(await page.locator('.water-heading b').innerText().then(s => s.replaceAll(',', '')));
  await page.getByRole('button', { name: 'Add 250 ml water' }).click();
  await expect(page.locator('.water-heading b')).toHaveText((before + 250).toLocaleString('en-US'));
  await page.getByRole('button', { name: 'Custom', exact: true }).click();
  await page.getByLabel('Water amount (ml)').fill('375');
  await page.getByRole('button', { name: 'Log water', exact: true }).click();
  await expect(page.locator('.water-heading b')).toHaveText((before + 625).toLocaleString('en-US'));
  await page.reload();
  await expect(page.locator('.water-heading b')).toHaveText((before + 625).toLocaleString('en-US'));
  await page.getByRole('button', { name: /Remove 375 ml drink/ }).click();
  await expect(page.locator('.water-heading b')).toHaveText((before + 250).toLocaleString('en-US'));
  await nav(page, 'Plan').click();
  await page.getByRole('tab', { name: 'Habits', exact: true }).click();
  await expect(page.getByRole('spinbutton', { name: 'Drink water', exact: true })).toHaveValue(String((before + 250) / 1000));
  await page.getByRole('tab', { name: 'Nutrition', exact: true }).click();
  await page.getByRole('tab', { name: 'Water', exact: true }).click();
  await expect(page.locator('.water-heading b')).toHaveText((before + 250).toLocaleString('en-US'));
});

test('coach exercise media plays in the logger, can pause, and falls back when video storage is missing', async ({ page }) => {
  await demo(page);
  // Start a session first: later coach media changes should also reach an existing draft.
  await page.getByRole('button', { name: 'Start Workout', exact: true }).click();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByLabel('Workspace role').selectOption('coach');
  await nav(page, 'Clients').click();
  await page.getByRole('button').filter({ has: page.getByRole('heading', { name: 'Jordan Williams', exact: true }) }).click();
  await page.getByRole('tab', { name: 'Plan', exact: true }).click();
  await page.getByRole('button', { name: 'Edit programme' }).click();
  await page.locator('.exercise-editor summary').first().click();
  await page.getByLabel('Attach exercise photo').first().setInputFiles('src/assets/share-track-dawn-v2.jpg');
  await expect(page.getByText('share-track-dawn-v2.jpg', { exact: true })).toBeVisible();
  await page.getByLabel('Attach demonstration video').first().setInputFiles('tests/fixtures/coach-video.mp4');
  await expect(page.getByText('coach-video.mp4', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Save programme', exact: true }).click();
  await page.getByLabel('Workspace role').selectOption('client');
  await page.getByRole('button', { name: 'Resume workout', exact: true }).click();
  const video = page.locator('.logger-background video');
  await expect(video).toBeVisible();
  await expect.poll(() => video.evaluate(el => el.readyState >= 2 && !el.paused && el.muted && el.loop && el.playsInline)).toBe(true);
  await page.getByRole('button', { name: 'Pause exercise video' }).click();
  await expect.poll(() => video.evaluate(el => el.paused)).toBe(true);
  await page.getByRole('button', { name: 'Unmute exercise video' }).click();
  await expect.poll(() => video.evaluate(el => el.muted)).toBe(false);
  await page.getByRole('button', { name: 'Go to Incline dumbbell press' }).click();
  await expect(video).toHaveCount(0);
  await expect(page.locator('.logger-background img')).toHaveAttribute('src', /incline-dumbbell-press/);
  await page.getByRole('button', { name: 'Close dialog' }).click();
  // Records can survive a media-store loss; the exercise image must still display.
  await page.evaluate(() => { const data = JSON.parse(localStorage.getItem('avalen.workspace.v1')); data.clients.find(c => c.id === data.activeClientId).program.days[0].exercises[0].videoFile.id = 'missing-video'; localStorage.setItem('avalen.workspace.v1', JSON.stringify(data)); });
  await page.reload();
  await page.getByRole('button', { name: 'Resume workout', exact: true }).click();
  await page.getByRole('button', { name: 'Go to Bench press' }).click();
  await expect(page.getByText('Video unavailable · showing exercise image')).toBeVisible();
  await expect.poll(() => page.locator('.logger-background img').evaluate(el => el.complete && el.naturalWidth > 0)).toBe(true);
});

test('water, exercise imagery and the morphing dock fit a 320px phone with reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await demo(page);
  await page.getByRole('button', { name: 'Add 100 ml water' }).click();
  await expect(page.locator('.water-percent')).toHaveText('76%');
  await nav(page, 'Plan').click();
  await expect(nav(page, 'Plan')).toHaveAttribute('aria-current', 'page');
  await expect.poll(() => nav(page, 'Plan').evaluate(el => parseFloat(getComputedStyle(el).transitionDuration))).toBe(0);
  await page.getByRole('tab', { name: 'Training', exact: true }).click();
  await expect(page.locator('.exercise-thumb')).toHaveCount(5);
  await expect.poll(() => page.locator('.exercise-thumb').evaluateAll(images => images.every(i => i.complete && i.naturalWidth > 0))).toBe(true);
  await page.getByRole('button', { name: 'Start Workout', exact: true }).click();
  await page.getByRole('button', { name: 'Log set 1', exact: true }).click();
  await expect(page.locator('.saved-motion')).toContainText('Set saved');
  await expect(page.locator('.saved-morph path')).toHaveCSS('stroke-dashoffset', '0px');
  expect(await page.locator('.workout-modal').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
});
