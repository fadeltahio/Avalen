import {test, expect} from '@playwright/test';
const nav = (page, name) => page.getByRole('navigation', {name:'Main navigation'}).getByRole('button', {name,exact:true});
const state = page => page.evaluate(() => JSON.parse(localStorage.getItem('avalen.workspace.v1')));
async function demo(page) {await page.goto('/'); await page.getByRole('button',{name:'Explore demo'}).click(); await expect(page.getByRole('heading',{name:/Make it count,/})).toBeVisible();}
async function coach(page) {await demo(page); await page.getByLabel('Workspace role').selectOption('coach');}

test('the log button stays under the thumb when rest begins', async ({page}) => {
 await demo(page); await nav(page,'Train').click();
 await page.getByRole('button',{name:'Start Workout',exact:true}).click();
 const first = page.getByRole('button',{name:'Log set 1',exact:true});
 await expect(first).toBeVisible();
 await page.waitForTimeout(600);
 const before = await first.boundingBox();
 await first.click();
 await expect(page.getByRole('region',{name:'Rest timer'})).toBeVisible();
 const after = await page.getByRole('button',{name:'Log set 2',exact:true}).boundingBox();
 expect(Math.abs(after.y - before.y)).toBeLessThan(2);
});

test('Train no longer duplicates the main Nutrition destination', async ({page}) => {
 await demo(page); await nav(page,'Train').click();
 await expect(page.getByRole('tab',{name:'Habits',exact:true})).toBeVisible();
 await expect(page.getByRole('tab',{name:'Nutrition',exact:true})).toHaveCount(0);
 await expect(page.locator('.calendar-month')).toHaveText(new Date().toLocaleDateString('en',{month:'long',year:'numeric'}));
});

test('coach inbox lists people first and only opening a thread marks it read', async ({page}) => {
 await coach(page);
 await page.evaluate(() => {
  const d = JSON.parse(localStorage.getItem('avalen.workspace.v1'));
  d.messages.push({id:'unread-one',clientId:'client-1',from:'client',text:'Felt great today',at:new Date().toISOString(),read:false});
  localStorage.setItem('avalen.workspace.v1',JSON.stringify(d));
 });
 await page.reload();
 await nav(page,'Inbox').click();
 const row = page.getByRole('button',{name:'Open conversation with Maya Chen',exact:true});
 await expect(row).toContainText('Felt great today');
 await expect(page.locator('.inbox-client-list > button').first()).toHaveAttribute('aria-label','Open conversation with Maya Chen');
 await expect(page.getByLabel('Message',{exact:true})).toHaveCount(0);
 expect((await state(page)).messages.find(m => m.id === 'unread-one').read).toBeFalsy();
 await row.click();
 await expect(page.getByLabel('Message',{exact:true})).toBeVisible();
 await expect.poll(async () => (await state(page)).messages.find(m => m.id === 'unread-one').read).toBeTruthy();
 await page.getByRole('button',{name:'All conversations',exact:true}).click();
 await expect(row).toBeVisible();
 // A client who is not the active one must open too: that path used to remount the page.
 await page.getByRole('button',{name:'Open conversation with Liam Parker',exact:true}).click();
 await expect(page.locator('.conversation-heading')).toContainText('Liam Parker');
});

test('coach can pause and resume coaching without touching membership', async ({page}) => {
 await coach(page); await nav(page,'Clients').click();
 await page.locator('.client-card').first().click();
 const membership = (await state(page)).clients[0].subscription.status;
 await page.getByRole('button',{name:'Pause coaching',exact:true}).click();
 await page.getByRole('dialog').getByRole('button',{name:'Pause coaching',exact:true}).click();
 await expect(page.getByRole('dialog')).toHaveCount(0);
 await expect(page.locator('.coach-client-actions')).toContainText('Coaching paused');
 let saved = await state(page);
 expect(saved.clients[0].paused).toBe(true);
 expect(saved.clients[0].subscription.status).toBe(membership);
 await nav(page,'Clients').click();
 await page.getByRole('tab',{name:'Paused',exact:true}).click();
 await expect(page.locator('.client-card')).toHaveCount(1);
 await page.locator('.client-card').first().click();
 await page.getByRole('button',{name:'Resume coaching',exact:true}).click();
 await page.getByRole('dialog').getByRole('button',{name:'Resume coaching',exact:true}).click();
 await expect(page.locator('.coach-client-actions')).not.toContainText('Coaching paused');
 saved = await state(page);
 expect(saved.clients[0].paused).toBe(false);
});

test('live recovery reflects a logged workout for the client and for the coach', async ({page}) => {
 await demo(page);
 await page.evaluate(() => {
  const d = JSON.parse(localStorage.getItem('avalen.workspace.v1'));
  const hours = 4 * 3600000, finishedAt = new Date(Date.now() - hours).toISOString();
  d.sessions = [{id:'hot-chest',clientId:d.activeClientId,title:'Push day',date:finishedAt.slice(0,10),finishedAt,duration:3000,sets:Array.from({length:6},(_,i)=>({name:'Bench press',set:i+1,weight:60,reps:10,effort:'Hard'}))}];
  localStorage.setItem('avalen.workspace.v1',JSON.stringify(d));
 });
 await page.reload();
 await page.getByRole('button',{name:'Open live recovery',exact:true}).click();
 await expect(page).toHaveURL(/tab=Recovery/);
 const chest = page.locator('.recovery-row', {hasText:'Chest'});
 await expect(chest).toHaveClass(/is-hot/);
 await expect(page.locator('.recovery-note')).toContainText('not measured');
 await page.getByRole('button',{name:'In 2 days',exact:true}).click();
 await expect(chest).toHaveClass(/is-recovering/);
 await chest.click();
 await expect(page.locator('.recovery-detail')).toContainText('Bench press');
 await page.getByRole('button',{name:'Back',exact:true}).click();
 await expect(page.locator('.recovery-stage')).toHaveAttribute('data-side','back');
 await expect(page.locator('.recovery-row', {hasText:'Hamstrings'})).toContainText('Not trained lately');
 await page.getByLabel('Workspace role').selectOption('coach');
 await nav(page,'Clients').click();
 await page.locator('.client-card').first().click();
 await page.getByRole('button',{name:'Open live recovery',exact:true}).click();
 await expect(page.locator('.recovery-row', {hasText:'Chest'})).toHaveClass(/is-hot/);
});

test('sign-up questions reach the coach, flag health answers and can be reviewed', async ({page}) => {
 await page.goto('/'); await page.getByRole('button',{name:'Get Started'}).click();
 await page.getByLabel('Your name',{exact:true}).fill('Sara Test');
 await page.getByLabel('Email',{exact:true}).fill('sara@example.test');
 await page.getByLabel('Coach code').fill('00000');
 await page.getByRole('button',{name:'Join my coach'}).click();
 for (const answer of ['1 to 3 years', '4', '60 minutes', 'Full gym']) await page.getByRole('button',{name:answer,exact:true}).click();
 await page.getByRole('button',{name:'Knee',exact:true}).click();
 await page.getByRole('button',{name:'Continue',exact:true}).click();
 await page.getByRole('button',{name:'Yes',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('check with your doctor');
 await page.getByRole('button',{name:'Continue',exact:true}).click();
 await page.getByRole('button',{name:'Continue',exact:true}).click();
 await page.getByRole('button',{name:'Send to Alex',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Sent to Alex.',exact:true})).toBeVisible();
 const saved = await state(page), client = saved.clients.find(row => row.id === saved.activeClientId);
 expect(client.intake.flagged).toBe(true);
 expect(client.intake.answers.injuries).toEqual(['Knee']);
 expect(saved.messages.at(-1).text).toContain('My intake is in.');
 await page.getByRole('button',{name:/Let.s go/}).click();
 await expect(page.locator('.intake-prompt')).toHaveCount(0);
 await page.getByLabel('Workspace role').selectOption('coach');
 await page.getByRole('button',{name:'Review intake',exact:true}).click();
 const card = page.locator('.intake-card');
 await expect(card).toContainText('Health answer needs a look');
 await card.getByRole('button',{name:'Mark reviewed',exact:true}).click();
 await expect(card).toHaveCount(0);
 expect((await state(page)).clients.find(row => row.id === client.id).intake.reviewedAt).toBeTruthy();
});

test('skipping the sign-up questions leaves a way back from Home', async ({page}) => {
 await page.goto('/'); await page.getByRole('button',{name:'Get Started'}).click();
 await page.getByLabel('Your name',{exact:true}).fill('Sara Test');
 await page.getByLabel('Email',{exact:true}).fill('sara@example.test');
 await page.getByLabel('Coach code').fill('00000');
 await page.getByRole('button',{name:'Join my coach'}).click();
 await page.getByRole('button',{name:'Skip for now',exact:true}).click();
 await page.locator('.intake-prompt').click();
 await expect(page.getByRole('heading',{name:'How long have you been training?',exact:true})).toBeVisible();
});

test('client cards fit beside the sidebar once they have loaded', async ({page}) => {
 await page.setViewportSize({width:768,height:900});
 await coach(page);
 await page.locator('aside nav').getByRole('button',{name:'Clients',exact:true}).click();
 await expect(page.locator('.client-card')).toHaveCount(6);
 expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
 expect(await page.locator('.client-mini').evaluateAll(rows => rows.filter(row => row.scrollWidth > row.clientWidth).length)).toBe(0);
});

test('the welcome photograph never widens the page while it settles', async ({page}) => {
 await page.addInitScript(() => {
  window.widest = 0;
  const tick = () => {window.widest = Math.max(window.widest, document.documentElement.scrollWidth - innerWidth); requestAnimationFrame(tick);};
  requestAnimationFrame(tick);
 });
 await page.goto('/');
 await expect(page.getByRole('button',{name:'Explore demo'})).toBeVisible();
 await page.waitForTimeout(1700);
 expect(await page.evaluate(() => window.widest)).toBeLessThanOrEqual(0);
});

test('reduced motion removes sheets, reveals and the first-visit settle', async ({page}) => {
 await page.emulateMedia({reducedMotion:'reduce'});
 await demo(page);
 await page.getByRole('button',{name:'Search sessions',exact:true}).click();
 await expect(page.getByRole('dialog')).toBeVisible();
 const running = await page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running' && a.effect?.getComputedTiming().iterations !== Infinity).length);
 expect(running).toBe(0);
});
