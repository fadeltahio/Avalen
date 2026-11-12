import { test, expect } from '@playwright/test';
const nav = (p,name) => p.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name,exact:true});
const state = p => p.evaluate(() => JSON.parse(localStorage.getItem('avalen.workspace.v1')));
async function demo(p) { await p.goto('/'); await p.getByRole('button',{name:'Explore demo'}).click(); await expect(p.getByRole('heading',{name:/Make it count,/})).toBeVisible(); }
async function coachClient(p) { await p.getByLabel('Workspace role').selectOption('coach'); await nav(p,'Clients').click(); await p.locator('.client-card').first().click(); }

test('home prioritises a workout and browser navigation restores sections and selected days', async ({page:p}) => {
 await demo(p); await expect(p.getByRole('button',{name:'Start Workout',exact:true})).toBeInViewport();
 await nav(p,'Nutrition').click(); await p.getByRole('button',{name:'Previous nutrition day'}).click(); const url=p.url();
 await nav(p,'Progress').click(); await p.goBack(); await expect(p).toHaveURL(url); await p.reload(); await expect(p).toHaveURL(url); await expect(p.getByRole('heading',{name:'Nutrition.',exact:true})).toBeVisible();
 await nav(p,'Train').click(); await expect(p.getByRole('tab',{name:'Nutrition',exact:true})).toHaveCount(0);
});

test('nutrition coach drafts survive tabs and reload, publish only after explicit save and support discard', async ({page:p}) => {
 await demo(p); await coachClient(p); await p.getByRole('tab',{name:'Nutrition',exact:true}).click();
 const original=(await state(p)).clients[0].nutrition.kcal;
 await p.getByLabel('Calories',{exact:true}).fill('2777'); await p.getByLabel('Why are you making this change?').fill('New training phase');
 await expect(p.getByRole('button',{name:'Save nutrition plan',exact:true})).toBeInViewport();
 await p.getByRole('tab',{name:'Overview',exact:true}).click(); await p.getByRole('tab',{name:'Nutrition',exact:true}).click(); await expect(p.getByLabel('Calories',{exact:true})).toHaveValue('2777');
 await p.reload(); await expect(p.getByLabel('Calories',{exact:true})).toHaveValue('2777'); expect((await state(p)).clients[0].nutrition.kcal).toBe(original);
 await p.getByRole('button',{name:'Save nutrition plan',exact:true}).click(); expect((await state(p)).clients[0].nutrition.kcal).toBe(2777);
 await p.getByLabel('Calories',{exact:true}).fill('2888'); await expect(p.getByText('The assigned plan changed since this draft was started.',{exact:false})).toHaveCount(0);
 await p.getByRole('button',{name:'Discard draft',exact:true}).click(); await p.getByRole('dialog',{name:'Discard this draft?'}).getByRole('button',{name:'Discard draft',exact:true}).click(); await expect(p.getByLabel('Calories',{exact:true})).toHaveValue('2777');
});

test('programme editing draft survives closing the builder without changing the assigned plan', async ({page:p}) => {
 await demo(p); await coachClient(p); await p.getByRole('tab',{name:'Plan',exact:true}).click(); await p.getByRole('button',{name:'Edit programme',exact:true}).click();
 await p.getByLabel('Programme name',{exact:true}).fill('Strength · next phase'); await p.getByRole('button',{name:'Close dialog',exact:true}).click();
 expect((await state(p)).clients[0].program.name).not.toBe('Strength · next phase');
 await p.getByRole('button',{name:'Edit programme',exact:true}).click(); await expect(p.getByLabel('Programme name',{exact:true})).toHaveValue('Strength · next phase');
});

test('quick meal review confirms above the fold; editing, completion and removal undo preserve records', async ({page:p}) => {
 await demo(p); await nav(p,'Nutrition').click();
 await expect(p.getByRole('heading',{name:'Food diary',exact:true})).toBeInViewport();
 await p.locator('.nutrition-plan-disclosure > summary').click(); await p.getByRole('button',{name:'Log planned Breakfast',exact:true}).click();
 await p.getByRole('button',{name:/0\.5×/}).click(); await expect(p.getByRole('button',{name:'Log meal',exact:true})).toBeInViewport(); await p.getByRole('button',{name:'Log meal',exact:true}).click();
 const logged=(await state(p)).foodLogs.at(-1); expect(logged.kcal).toBe(275); await p.getByRole('button',{name:'Dismiss notification'}).click();
 await p.getByRole('button',{name:'Finish logging',exact:false}).click();
 await p.locator('.page-nutrition .card.list').getByRole('button').filter({hasText:logged.name}).click(); await p.getByRole('button',{name:'Edit entry',exact:true}).click();
 await p.locator('.meal-edit-details > summary').click(); await p.getByLabel('Calories (kcal)',{exact:true}).fill('300'); await p.getByRole('button',{name:'Save meal',exact:true}).click();
 expect((await state(p)).foodLogs.find(f=>f.id===logged.id).kcal).toBe(300); expect((await state(p)).nutritionDays.find(d=>d.clientId===logged.clientId&&d.date===logged.date).complete).toBe(false);
 await p.getByRole('button',{name:'Dismiss notification'}).click();
 await p.locator('.page-nutrition .card.list').getByRole('button').filter({hasText:logged.name}).click(); await p.getByRole('button',{name:'Remove entry',exact:true}).click(); expect((await state(p)).foodLogs.some(f=>f.id===logged.id)).toBe(false);
 await p.getByRole('button',{name:'Undo',exact:true}).click(); expect((await state(p)).foodLogs.find(f=>f.id===logged.id).kcal).toBe(300);
});

test('library and recent foods use portion review without forcing manual nutrient entry', async ({page:p}) => {
 await demo(p); await p.getByRole('button',{name:'Log food',exact:true}).click(); await p.locator('.recent-foods button').first().click();
 await expect(p.getByRole('button',{name:'Log meal',exact:true})).toBeInViewport(); await expect(p.locator('.meal-edit-details')).not.toHaveAttribute('open');
 await p.getByRole('button',{name:'Log meal',exact:true}).click(); await expect(p.locator('.app-toast')).toContainText('logged');
});

test('rest can be extended and logged through; duration movements use seconds and retain history', async ({page:p}) => {
 await demo(p); await p.getByRole('button',{name:'Start Workout',exact:true}).click(); await p.getByRole('button',{name:'Log set 1',exact:true}).click();
 await expect(p.getByRole('timer',{name:'Rest remaining'})).toBeInViewport(); await p.getByRole('button',{name:'+30s',exact:true}).click(); await expect(p.getByRole('timer',{name:'Rest remaining'})).toContainText(/1:5|2:0/);
 await expect(p.getByRole('button',{name:'Log set 2',exact:true})).toBeEnabled(); await p.waitForTimeout(450); await p.getByRole('button',{name:'Log set 2',exact:true}).click();
 await p.getByRole('button',{name:'Close dialog',exact:true}).click();
  await expect(p.getByRole('dialog')).toHaveCount(0);
  await p.evaluate(() => {const d=JSON.parse(localStorage.getItem('avalen.workspace.v1'));const ex=d.drafts[d.activeClientId].exercises[0];ex.kind='Duration';ex.reps=45;localStorage.setItem('avalen.workspace.v1',JSON.stringify(d));});
 await p.reload();await p.getByRole('button',{name:/^Resume workout:/}).click();await expect(p.getByLabel('Duration (seconds)',{exact:true})).toBeVisible();await p.getByLabel('Duration (seconds)',{exact:true}).fill('40'); await p.getByRole('button',{name:'Log set 3',exact:true}).click();expect((await state(p)).drafts[(await state(p)).activeClientId].sets.at(-1)).toMatchObject({kind:'Duration',reps:40});
});

for(const width of [320,390,1440]) test(`refined screens fit ${width}px in both themes`,async({page:p})=>{
 await p.setViewportSize({width,height:900});await demo(p);const menu=n=>width>760?p.locator('aside nav').getByRole('button',{name:n,exact:true}):nav(p,n);
 const errors=[];p.on('pageerror',e=>errors.push(e.message));
 for(const theme of ['dark','light']) {
  if(theme==='light'){await menu('More').click();await p.getByRole('button',{name:/Light A clean/}).click();}
  for(const name of ['Home','Train','Nutrition','Progress','More']){await menu(name).click();expect(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
 }
 await p.getByLabel('Workspace role').selectOption('coach');for(const name of ['Dashboard','Clients','Programs','Inbox','Business']){await menu(name).click();await p.locator('main h1').waitFor();expect(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
 expect(errors).toEqual([]);
});

test('browser Back pauses an active workout and empty workouts can be discarded explicitly', async({page:p})=>{
 await demo(p);await p.getByRole('button',{name:'View Upper Body A',exact:true}).click();await p.getByRole('button',{name:'Begin Workout',exact:true}).click();
 await p.getByLabel('Weight (kg)',{exact:true}).fill('67.5');await p.goBack();await expect(p.getByRole('dialog')).toHaveCount(0);
 const d=await state(p);expect(d.drafts[d.activeClientId].pausedAt).toBeTruthy();
 await p.getByRole('button',{name:/^Resume workout:/}).click();await expect(p.getByLabel('Weight (kg)',{exact:true})).toHaveValue('67.5');
 await p.getByRole('button',{name:'Finish session early',exact:true}).click();await p.getByRole('button',{name:'Discard empty workout',exact:true}).click();
 expect((await state(p)).drafts[d.activeClientId]).toBeUndefined();
});

test('manual food logs retain unknown macros and can be undone',async({page:p})=>{
 await demo(p);const count=(await state(p)).foodLogs.length;
 await p.getByRole('button',{name:'Log food',exact:true}).click();await p.getByRole('tab',{name:'Manual',exact:true}).click();
 await p.getByLabel('Food / meal name',{exact:true}).fill('Homemade soup');await p.getByLabel('Calories',{exact:true}).fill('220');await p.getByRole('button',{name:'Add to diary',exact:true}).click();
 expect((await state(p)).foodLogs.at(-1)).toMatchObject({name:'Homemade soup',kcal:220,p:null,c:null,f:null,missingMacros:['p','c','f']});await p.getByRole('button',{name:'Undo',exact:true}).click();expect((await state(p)).foodLogs).toHaveLength(count);
});
