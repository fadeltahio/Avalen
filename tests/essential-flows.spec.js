import {test, expect} from '@playwright/test';
const nav = (page, name) => page.getByRole('navigation', {name:'Main navigation'}).getByRole('button', {name, exact:true});
const state = page => page.evaluate(() => JSON.parse(localStorage.getItem('avalen.workspace.v1')));
async function demo(page) {await page.goto('/'); await page.getByRole('button', {name:'Explore demo'}).click(); await expect(page.getByRole('heading', {name:/Make it count,/})).toBeVisible();}
async function begin(page) {await demo(page); await page.getByRole('button', {name:'Start Workout', exact:true}).click();}
async function revise(page, fn) {
  await page.evaluate(fn);
  await page.evaluate(() => window.dispatchEvent(new StorageEvent('storage', {key:'avalen.workspace.v1', newValue:localStorage.getItem('avalen.workspace.v1')})));
}

test('daily essentials lead directly to habits and check-ins, and planned meals log from home', async ({page}) => {
  await demo(page);
  await page.getByRole('region', {name:'Daily essentials'}).getByRole('button', {name:/Daily habits/}).click();
  await expect(page.getByRole('tab', {name:'Habits', exact:true})).toHaveAttribute('aria-selected', 'true');
  await nav(page, 'Home').click();
  await page.getByRole('region', {name:'Daily essentials'}).getByRole('button', {name:/Check-in/}).click();
  await expect(page.getByRole('button', {name:'Start check-in', exact:true})).toBeVisible();
  await nav(page, 'Home').click();
  const before = (await state(page)).foodLogs.length;
  await page.getByRole('button', {name:/Quick log planned/}).click();
  await expect(page.getByRole('button', {name:'Log meal', exact:true})).toBeInViewport();
  await page.getByRole('button', {name:'Log meal', exact:true}).click();
  expect((await state(page)).foodLogs).toHaveLength(before + 1);
  expect((await state(page)).foodLogs.at(-1).source).toBe('coach-plan');
  await expect(page.getByRole('heading', {name:/Make it count,/})).toBeVisible();
  await page.getByRole('button', {name:'Open coach meal plan'}).click();
  await expect(page.locator('.nutrition-plan-disclosure')).toHaveAttribute('open');
  await expect(page.getByRole('region', {name:'Coach nutrition plan'})).toBeVisible();
});

test('unlogged values survive an immediate reload and exercise switching without changing saved sets', async ({page}) => {
  await begin(page);
  await page.getByLabel('Weight (kg)', {exact:true}).fill('72.5');
  await page.getByLabel('Reps', {exact:true}).fill('9');
  await page.reload();
  await page.getByRole('button', {name:/^Resume workout:/}).click();
  await expect(page.getByLabel('Weight (kg)', {exact:true})).toHaveValue('72.5');
  await expect(page.getByLabel('Reps', {exact:true})).toHaveValue('9');
  await page.locator('.logger-open-exercises').click();
  await page.getByRole('button', {name:'Go to Incline dumbbell press'}).click();
  await expect(page.getByRole('heading', {name:'Incline dumbbell press', exact:true})).toBeVisible();
  await page.locator('.logger-open-exercises').click();
  await page.getByRole('button', {name:'Go to Bench press'}).click();
  await expect(page.getByLabel('Weight (kg)', {exact:true})).toHaveValue('72.5');
  await page.getByRole('button', {name:'Log set 1', exact:true}).click();
  const data = await state(page);
  expect(data.drafts[data.activeClientId].sets).toHaveLength(1);
  expect(data.drafts[data.activeClientId].sets[0]).toMatchObject({weight:72.5, reps:9});
  await expect(page.getByLabel('Weight (kg)', {exact:true})).toHaveValue('72.5');
  await expect(page.getByRole('button', {name:'Log set 2', exact:true})).toBeInViewport();
});

for (const width of [320,390]) test(`active logging stays visible at ${width}px through rest and the next exercise`, async ({page}) => {
  await page.setViewportSize({width, height:740});
  await begin(page);
  await expect(page.getByRole('button', {name:'Log set 1', exact:true})).toBeInViewport();
  await page.getByRole('button', {name:'Log set 1', exact:true}).click();
  await expect(page.getByRole('timer')).toBeInViewport();
  await expect(page.getByRole('button', {name:'Log set 2', exact:true})).toBeInViewport();
  await page.getByRole('button', {name:'Skip rest', exact:true}).click();
  await page.getByRole('button', {name:'Log set 2', exact:true}).click();
  await page.getByRole('button', {name:'Skip rest', exact:true}).click();
  await page.getByRole('button', {name:'Log set 3', exact:true}).click();
  await expect(page.locator('.logger-up-next')).toContainText('Incline dumbbell press');
  await page.getByRole('button', {name:'Next exercise', exact:true}).click();
  await expect(page.getByRole('button', {name:'Log set 1', exact:true})).toBeInViewport();
  expect(await page.locator('.workout-modal').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
});

test('finish review explains incomplete work and saves only once', async ({page}) => {
  await begin(page); await page.getByRole('button', {name:'Log set 1', exact:true}).click();
  await page.getByRole('button', {name:'Finish session early', exact:true}).click();
  await expect(page.locator('.logger-finish-warning')).toContainText('unlogged sets');
  const before = await state(page);
  await page.getByRole('button', {name:'Finish & see results', exact:true}).click();
  await expect(page.getByRole('dialog', {name:'You showed up.'})).toBeVisible();
  const after = await state(page);
  expect(after.sessions.length).toBe(before.sessions.length + 1);
  expect(after.sessions.at(-1).sets).toHaveLength(1);
  expect(after.drafts[after.activeClientId]).toBeUndefined();
});

test('coach essentials fit on a phone and secondary sections remain reachable with deep links', async ({page}) => {
  await demo(page); await page.getByLabel('Workspace role').selectOption('coach'); await nav(page, 'Clients').click(); await page.locator('.client-card').first().click();
  await expect(page.getByRole('button', {name:'Message Jordan', exact:true})).toBeVisible();
  for (const name of ['Overview','Plan','Nutrition','Progress','Check-ins']) await expect(page.getByRole('tab', {name, exact:true})).toBeInViewport();
  await expect(page.getByRole('tab', {name:'Billing', exact:true})).toHaveCount(0);
  await page.getByRole('button', {name:'More sections', exact:true}).click();
  await page.getByRole('tab', {name:'Billing', exact:true}).click();
  await expect(page.getByRole('heading', {name:'Membership & billing', exact:true})).toBeVisible();
  await expect(page.getByRole('tab', {name:'Overview', exact:true})).toHaveAttribute('tabindex', '0');
  const url = page.url(); await page.reload(); await expect(page).toHaveURL(url);
  await expect(page.getByRole('tab', {name:'Billing', exact:true})).toHaveAttribute('aria-selected','true');
  await page.getByRole('tab', {name:'Plan', exact:true}).click();
  await expect(page.getByRole('button', {name:'More sections', exact:true})).toHaveAttribute('aria-expanded','false');
});

test('technique reviews are first-class coach tasks and route to the right client', async ({page}) => {
  await demo(page);
  await revise(page, () => {
    const data = JSON.parse(localStorage.getItem('avalen.workspace.v1')), client = data.clients[0], exercise = client.program.days[0].exercises[0];
    data.formSubmissions.push({id:'flow-technique', clientId:client.id, exerciseId:exercise.id, exerciseName:exercise.name, status:'pending', createdAt:new Date().toISOString(), comment:'Please review', reviews:[], file:{id:'flow-missing-file', name:'Technique.mp4', type:'video/mp4', duration:15}});
    localStorage.setItem('avalen.workspace.v1', JSON.stringify(data));
  });
  await page.getByLabel('Workspace role').selectOption('coach');
  await page.getByRole('tab', {name:/Technique/}).click();
  await expect(page.locator('.review-queue-item')).toHaveCount(1);
  await expect(page.locator('.review-queue-item')).toContainText('Jordan Williams');
  await page.getByRole('button', {name:'Review technique', exact:true}).click();
  await expect(page).toHaveURL(/client=client-0&section=FormLab/);
  await expect(page.getByRole('tab', {name:'FormLab', exact:true})).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', {name:'Jordan Williams', exact:true})).toBeVisible();
});


test('coach programme, schedule and habit tools stay distinct and retain navigation on reload', async ({page}) => {
  await demo(page); await page.getByLabel('Workspace role').selectOption('coach'); await nav(page, 'Clients').click(); await page.locator('.client-card').first().click();
  await page.getByRole('tab', {name:'Plan', exact:true}).click();
  await expect(page.getByRole('button', {name:'Edit programme', exact:true})).toBeInViewport();
  await expect(page.getByRole('tab', {name:'Programme', exact:true})).toHaveAttribute('aria-selected','true');
  await page.locator('.coach-programme-days summary').first().click();
  await expect(page.locator('.coach-programme-days')).toContainText('Bench press');
  await page.getByRole('tab', {name:'Schedule', exact:true}).click();
  await expect(page.getByRole('heading', {name:'Adjust the schedule', exact:true})).toBeVisible();
  await page.getByRole('tab', {name:'Habits', exact:true}).click();
  await expect(page.getByRole('heading', {name:'Daily foundations', exact:true})).toBeVisible();
  await page.reload();
  await expect(page.getByRole('tab', {name:'Habits', exact:true})).toHaveAttribute('aria-selected','true');
});
