import { test, expect } from '@playwright/test';

const nav = page => page.getByRole('navigation', {name: 'Main navigation'});
const tab = (page, name) => nav(page).getByRole('button', {name, exact:true});

async function start(page) {
  await page.goto('/');
  await page.getByRole('button', {name:'Explore demo', exact:true}).click();
}

// The bottom menu marks the open tab with a sliding indicator (MovingIndicator in
// motion.jsx). Settled means it sits on the selected tab with nothing still animating.
const indicator = page => page.locator('.motion-nav-indicator');
async function expectSettled(page, name) {
  await expect(tab(page, name)).toHaveAttribute('aria-current', 'page');
  await expect.poll(() => nav(page).evaluate(el => {
    const selected = el.querySelector('button[aria-current="page"]').getBoundingClientRect();
    const mark = el.querySelector('.motion-nav-indicator');
    const box = mark.getBoundingClientRect();
    if (mark.getAnimations().length) return Infinity;
    return Math.max(Math.abs((box.x + box.width / 2) - (selected.x + selected.width / 2)), Math.abs(box.width - selected.width));
  })).toBeLessThan(1);
}

test('menu indicator settles after distant tabs, rapid reversals and resize', async ({page}) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await start(page);
  await tab(page, 'More').click();
  await expectSettled(page, 'More');
  await tab(page, 'Home').click();
  await tab(page, 'Nutrition').click();
  await tab(page, 'Train').click();
  await expectSettled(page, 'Train');
  await page.setViewportSize({width:320, height:740});
  await tab(page, 'More').click();
  await expectSettled(page, 'More');
  expect(errors).toEqual([]);
});

test('menu indicator respects system and in-app reduced motion', async ({page}) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  await start(page);
  await tab(page, 'More').click();
  expect(await indicator(page).evaluate(el => el.getAnimations().length)).toBe(0);
  await expectSettled(page, 'More');
  await page.getByRole('switch', {name:/Reduce motion/}).check();
  await page.emulateMedia({reducedMotion:'no-preference'});
  await tab(page, 'Train').click();
  expect(await indicator(page).evaluate(el => el.getAnimations().length)).toBe(0);
  await expectSettled(page, 'Train');
});
