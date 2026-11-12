import { test, expect } from '@playwright/test';

const nav = page => page.getByRole('navigation', {name: 'Main navigation'});
const tab = (page, name) => nav(page).getByRole('button', {name, exact:true});

async function start(page) {
  await page.goto('/');
  await page.getByRole('button', {name:'Explore demo', exact:true}).click();
}

async function expectSettled(page, name) {
  await expect(tab(page, name)).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('.nav-glass-selection')).toHaveAttribute('data-moving', 'false');
  await expect.poll(() => nav(page).evaluate(el => {
    const selected = el.querySelector('button[aria-current="page"]').getBoundingClientRect();
    const lens = el.querySelector('.nav-glass-selection').getBoundingClientRect();
    return Math.max(Math.abs((lens.x + lens.width / 2) - (selected.x + selected.width / 2)), Math.abs(lens.width - selected.width));
  })).toBeLessThan(1);
  await expect(page.locator('.nav-glass-trail')).toHaveCSS('opacity', '0');
}

test('liquid selector settles after distant tabs, rapid reversals and resize', async ({page}) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await start(page);
  await tab(page, 'You').click();
  await expectSettled(page, 'You');
  await tab(page, 'Today').click();
  await tab(page, 'Coach').click();
  await tab(page, 'Plan').click();
  await expectSettled(page, 'Plan');
  await page.setViewportSize({width:320, height:740});
  await tab(page, 'You').click();
  await expectSettled(page, 'You');
  expect(errors).toEqual([]);
});

test('liquid selector respects system and in-app reduced motion', async ({page}) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  await start(page);
  await tab(page, 'You').click();
  expect(await page.locator('.nav-glass-selection').evaluate(el => el.getAnimations().length)).toBe(0);
  await expectSettled(page, 'You');
  await page.getByRole('switch', {name:/Reduce motion/}).check();
  await page.emulateMedia({reducedMotion:'no-preference'});
  await tab(page, 'Plan').click();
  expect(await page.locator('.nav-glass-selection').evaluate(el => el.getAnimations().length)).toBe(0);
  await expectSettled(page, 'Plan');
});
