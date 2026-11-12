import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = '/Users/compucity/Desktop/Avalen Video Assets';
for (const folder of ['01 Mobile screens', '02 Coach desktop', '03 Share cards', '04 Overview']) await fs.mkdir(path.join(root, folder), { recursive: true });
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'en-GB', timezoneId: 'Africa/Cairo', reducedMotion: 'reduce' });
const page = await context.newPage();
page.setDefaultTimeout(15000);
const errors = [];
page.on('pageerror', e => errors.push(e.message));
const shots = [];
const nav = name => page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name, exact: true });
const tab = name => page.getByRole('tab', { name, exact: true });
async function ready() {
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(i => i.decode().catch(() => {}))); });
  await page.waitForLoadState('networkidle');
}
async function shot(name, folder = '01 Mobile screens') {
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await ready();
  const file = path.join(root, folder, name + '.png');
  await page.screenshot({ path: file, animations: 'disabled' });
  shots.push({ name, folder, file });
  console.log('Captured:', name);
}
async function close() { await page.getByRole('button', { name: 'Close dialog' }).click(); }
async function saveCard(name, background) {
  await page.getByRole('button', { name: background + ' background', exact: true }).click();
  await ready();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save image', exact: true }).click();
  await (await download).saveAs(path.join(root, '03 Share cards', name + '.png'));
  console.log('Exported:', name);
}
try {
  await page.goto('http://127.0.0.1:5174');
  await shot('01 Welcome');
  await page.getByRole('button', { name: 'Explore demo' }).click();
  await shot('02 Today dashboard');
  await nav('Plan').click();
  await shot('03 Training plan');
  await tab('Nutrition').click();
  await shot('04 Nutrition diary');
  await tab('Habits').click();
  await shot('05 Daily habits');
  await nav('Progress').click();
  await shot('06 Progress overview');
  await tab('Strength').click();
  await shot('07 Strength progress');
  await tab('Consistency').click();
  await shot('08 Consistency');
  await tab('Overview').click();
  await page.getByRole('button').filter({ hasText: /sets ·.*min/ }).first().click();
  await shot('09 Workout results');
  await saveCard('01 Workout - strength', 'Strength');
  await saveCard('02 Workout - dumbbells', 'Dumbbells');
  await saveCard('03 Workout - track', 'Track');
  await close();
  await page.getByRole('button', { name: 'Progress story', exact: true }).click();
  await saveCard('04 Progress story', 'Night gym');
  await close();
  await nav('Coach').click();
  await shot('10 Coach and membership');
  await tab('Feed').click();
  await shot('11 Members feed');
  await tab('Messages').click();
  await shot('12 Coach conversation');
  await tab('Check-in').click();
  await page.getByRole('button', { name: 'Start check-in' }).click();
  await shot('13 Weekly check-in');
  await close();
  await nav('Today').click();
  await page.getByRole('button', { name: 'Start Workout', exact: true }).click();
  await page.getByRole('button', { name: 'Log set 1', exact: true }).click();
  await shot('14 Workout logging');
  await close();
  await page.getByLabel('Workspace role').selectOption('coach');
  await shot('15 Coach dashboard');
  await nav('Clients').click();
  await shot('16 Coach client roster');
  await context.setExtraHTTPHeaders({});
  await page.setViewportSize({ width: 1440, height: 1000 });
  const desktopNav = name => page.locator('aside nav').getByRole('button', { name, exact: true });
  await desktopNav('Dashboard').click();
  await shot('01 Coach dashboard', '02 Coach desktop');
  await desktopNav('Clients').click();
  await shot('02 Client roster', '02 Coach desktop');
  await page.getByRole('button').filter({ has: page.getByRole('heading', { name: 'Jordan Williams' }) }).click();
  await shot('03 Client overview', '02 Coach desktop');
  await tab('Plan').click();
  await page.getByRole('button', { name: 'Edit programme' }).click();
  await shot('04 Programme builder', '02 Coach desktop');
  await close();
  await tab('Nutrition').click();
  await shot('05 Nutrition coaching', '02 Coach desktop');
  await desktopNav('Business').click();
  await shot('06 Membership management', '02 Coach desktop');
  await tab('Brand').click();
  await shot('07 Coach branding', '02 Coach desktop');
  await fs.writeFile(path.join(root, 'capture-manifest.json'), JSON.stringify({ capturedAt: new Date().toISOString(), source: 'Last completed production build, isolated demo workspace. Not the unfinished light-mode branch.', mobile: '1170 × 2532', desktop: '4320 × 3000', shareCards: '1080 × 1920', errors, shots: shots.map(({name,folder})=>({name,folder})) }, null, 2));
} catch (e) {
  await page.screenshot({ path: '/tmp/avalen-capture-error.png' });
  console.error(await page.locator('body').innerText());
  throw e;
} finally { await browser.close(); }
