import {test, expect} from '@playwright/test';

const KEY = 'avalen.workspace.v1';
const state = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY);
async function demo(page, role='client') {
  await page.goto('/');
  await page.getByRole('button', {name:'Explore demo'}).click();
  if (role==='coach') await page.getByLabel('Workspace role').selectOption('coach');
}
// Two sessions of an exercise no seed uses: 840 kg ten days ago, 350 kg three days ago.
async function logTwoSessions(page, clientId) {
  await page.evaluate(({key, clientId}) => {
    const data = JSON.parse(localStorage.getItem(key));
    const id = clientId || data.activeClientId;
    const ago = days => { const date = new Date(); date.setDate(date.getDate() - days); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; };
    const row = (weight, reps) => ({id: crypto.randomUUID(), exerciseId: 'test-press', name: 'Test press', kind: 'Strength', weight, reps});
    data.sessions.push({id: 'older', clientId: id, date: ago(10), title: 'Test', sets: [row(60, 8), row(60, 6)], prs: []}, {id: 'newer', clientId: id, date: ago(3), title: 'Test', sets: [row(70, 5)], prs: []});
    localStorage.setItem(key, JSON.stringify(data));
  }, {key: KEY, clientId});
  await page.reload();
}
const visit = (page, hash) => page.evaluate(next => { location.hash = next; }, hash);
const noSideScroll = page => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);

test('the mark opens the app and leaves nothing behind', async ({page}) => {
  await page.goto('/');
  await expect(page.locator('#boot')).toHaveCount(0);
  await expect(page.getByRole('button', {name:'Enter Avalen'})).toHaveCount(0);
  await page.getByRole('button', {name:'Explore demo'}).click();
  await expect(page.getByRole('navigation', {name:'Main navigation'})).toBeVisible();
});

test('the ring is whole by the time the mark is fully drawn', async ({page}) => {
  await page.goto('/?preview=splash');
  const ring = await page.evaluate(() => {
    const circle = document.querySelector('#boot circle'), [animation] = circle.getAnimations();
    animation.pause();
    animation.currentTime = 1050;
    return getComputedStyle(circle).strokeDasharray;
  });
  const [dash, gap] = ring.split(/[ ,]+/).map(parseFloat);
  expect(dash).toBeGreaterThanOrEqual(282);
  expect(gap).toBe(0);
});

test('reduced motion shows a still mark and skips the wait', async ({page}) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/');
  await expect(page.locator('#boot')).toHaveCount(0);
  await expect(page.getByRole('button', {name:'Explore demo'})).toBeVisible();
  await page.goto('/?preview=splash');
  const running = await page.evaluate(() => document.querySelector('#boot circle')?.getAnimations().length);
  expect(running).toBe(0);
});

test('a reload in the same session goes straight back to the app', async ({page}) => {
  await demo(page);
  await page.reload();
  await expect(page.locator('#boot')).toHaveCount(0);
  await expect(page.getByRole('button', {name:'Enter Avalen'})).toHaveCount(0);
});

test('the mark never stays over the sign-in screen', async ({page}) => {
  await page.goto('/?connected=1');
  await expect(page.getByText('The account service is unavailable', {exact:false})).toBeVisible();
  await expect(page.locator('#boot')).toHaveCount(0);
});

test('a session opens each exercise in place and returns from its details', async ({page}) => {
  await demo(page);
  await page.getByRole('button', {name:'View Upper Body A', exact:true}).click();
  const row = page.locator('.session-exercise-row').first();
  const details = page.getByRole('button', {name:'Exercise details'}).first();
  await expect(row).toHaveAttribute('aria-expanded', 'false');
  await expect(details).toBeHidden();
  await row.click();
  await expect(row).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.session-exercise-sets').first().locator('li').first()).toBeVisible();
  await details.click();
  await expect(page.locator('.exercise-detail h1')).toBeVisible();
  expect(page.url()).toContain('exercise=');
  await page.getByRole('button', {name:'Back', exact:true}).click();
  await expect(page.locator('.session-detail-exercises')).toBeVisible();
  expect(page.url()).not.toContain('exercise=');
});

for (const width of [320, 390]) test(`the workout button stays on screen at ${width}px`, async ({page}) => {
  await page.setViewportSize({width, height: 640});
  await demo(page);
  await page.getByRole('button', {name:'View Upper Body A', exact:true}).click();
  const start = page.locator('.session-start-bar button');
  await expect(start).toBeVisible();
  const onScreen = async () => { const box = await start.boundingBox(); expect(box.y).toBeGreaterThan(0); expect(box.y + box.height).toBeLessThanOrEqual(640); };
  await onScreen();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await onScreen();
  expect(await noSideScroll(page)).toBe(true);
});

test('the exercise page shows only logged sets and its chart can be scrubbed', async ({page}) => {
  await demo(page);
  await logTwoSessions(page);
  await visit(page, '#/client/progress?exercise=Test%20press');
  const readout = page.locator('.exercise-readout'), bars = page.locator('.volume-plot button');
  await expect(page.getByRole('heading', {name:'Test press'})).toBeVisible();
  await expect(readout).toContainText('Avg volume load');
  await expect(readout).toContainText('595');
  await expect(bars).toHaveCount(2);
  await expect(page.locator('.exercise-records li')).toHaveCount(3);
  await expect(page.locator('.exercise-records li').first()).toContainText('70 kg × 5');
  await bars.first().focus();
  await page.keyboard.press('Enter');
  await expect(readout).toContainText('840');
  await expect(page.locator('.volume-plot')).toHaveClass(/has-pick/);
  await page.keyboard.press('Enter');
  await expect(readout).toContainText('595');
  const box = await page.locator('.volume-plot').boundingBox();
  await page.mouse.move(box.x + box.width * .1, box.y + box.height / 2);
  await page.mouse.down();
  await expect(readout).toContainText('840');
  await page.mouse.move(box.x + box.width * .95, box.y + box.height / 2, {steps: 4});
  await expect(readout).toContainText('350');
  await page.mouse.up();
  await expect(readout).toContainText('350');
  await page.getByRole('button', {name:'Six months'}).click();
  await expect(readout).toContainText('595');
});

test('the section pills follow the page and jump to a section', async ({page}) => {
  await page.setViewportSize({width: 320, height: 640});
  await demo(page);
  await logTwoSessions(page);
  await visit(page, '#/client/progress?exercise=Test%20press');
  await expect(page.getByRole('button', {name:'Progress', exact:true})).toHaveAttribute('aria-current', 'true');
  expect(await noSideScroll(page)).toBe(true);
  await page.getByRole('button', {name:'Instructions', exact:true}).click();
  await expect(page.getByRole('button', {name:'Instructions', exact:true})).toHaveAttribute('aria-current', 'true');
  await expect(page.locator('.exercise-bar')).toHaveClass(/is-stuck/);
  await expect(page.getByRole('heading', {name:'Test press'})).toBeInViewport();
  await page.getByRole('button', {name:'History', exact:true}).click();
  await expect(page.getByRole('button', {name:'History', exact:true})).toHaveAttribute('aria-current', 'true');
  const row = page.locator('.exercise-history details').first();
  await row.locator('summary').click();
  await expect(row.locator('li')).toHaveCount(1);
  expect(await noSideScroll(page)).toBe(true);
});

test('an unlogged exercise says so instead of showing empty numbers', async ({page}) => {
  await demo(page);
  const data = await state(page);
  const unlogged = data.library.find(item => !data.sessions.some(session => session.sets.some(set => set.name === item.name)));
  await visit(page, `#/client/progress?exercise=${encodeURIComponent(unlogged.name)}`);
  await expect(page.locator('.exercise-detail')).toContainText('No sets logged yet');
  await expect(page.locator('.volume-plot')).toHaveCount(0);
  await expect(page.locator('.exercise-records')).toHaveCount(0);
});

test('Strength opens exercise details and Back returns to the same tab', async ({page}) => {
  await demo(page);
  await logTwoSessions(page);
  await visit(page, '#/client/progress?tab=Strength');
  await page.locator('.strength-list .card', {hasText:'Test press'}).getByRole('button', {name:'Exercise details'}).click();
  await expect(page.getByRole('heading', {name:'Test press'})).toBeVisible();
  await page.getByRole('button', {name:'Back', exact:true}).click();
  await expect(page.locator('.strength-list')).toBeVisible();
});

test('a coach sees the same page for a client, in the coach voice', async ({page}) => {
  await demo(page, 'coach');
  const data = await state(page), client = data.clients[0];
  await logTwoSessions(page, client.id);
  await visit(page, `#/coach/clients?client=${client.id}&section=Progress&exercise=Test%20press`);
  await expect(page.locator('.exercise-readout')).toContainText('595');
  await expect(page.locator('.app-header')).toBeHidden();
  const unlogged = data.library.find(item => !data.sessions.some(session => session.clientId === client.id && session.sets.some(set => set.name === item.name)));
  await visit(page, `#/coach/clients?client=${client.id}&section=Progress&exercise=${encodeURIComponent(unlogged.name)}`);
  await expect(page.locator('.exercise-detail')).toContainText(`${client.name} has not logged this exercise yet.`);
});
