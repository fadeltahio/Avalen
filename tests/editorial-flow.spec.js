import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const nav = (page, name) => page.getByRole('navigation', {name: 'Main navigation'}).getByRole('button', {name, exact:true});
async function demo(page) {
  await page.goto('/');
  await page.getByRole('button',{name:'Explore demo'}).click();
  await expect(page.getByRole('heading',{name:/Make it count,/})).toBeVisible();
}
async function firstSession(page) {
  await page.getByRole('button',{name:'View Upper Body A',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Upper Body A',exact:true})).toBeVisible();
}

test('launch, privacy and quick setup lead into the new home', async ({page}) => {
  await page.goto('/?preview=splash');
  await expect(page.getByRole('button',{name:'Enter Avalen'})).toBeVisible();
  await page.getByRole('button',{name:'Enter Avalen'}).click();
  await expect(page.getByRole('heading',{name:'Realize your potential.'})).toBeVisible();
  await page.getByRole('button',{name:'Your privacy',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Your privacy'})).toBeVisible();
  await page.getByRole('button',{name:'Got it'}).click();
  await page.getByRole('button',{name:'Get Started'}).click();
  await page.getByLabel('Your name',{exact:true}).fill('Nadine Test');
  await page.getByLabel('Email',{exact:true}).fill('nadine@example.test');
  await page.getByLabel('Your focus').selectOption('Build a consistent routine');
  await page.getByLabel('Coach code').fill('11111');
  await page.getByRole('button',{name:'Join my coach'}).click();
  await expect(page.getByRole('alert')).toContainText('00000');
  await page.getByLabel('Coach code').fill('00000');
  await page.getByRole('button',{name:'Join my coach'}).click();
  await page.getByRole('button',{name:'Skip for now',exact:true}).click();
  await expect(page.getByRole('heading',{name:/Make it count,/})).toBeVisible();
  await nav(page,'More').click();
  await expect(page.getByRole('heading',{name:'Nadine Test',exact:true})).toBeVisible();
  await expect(page.getByText('Build a consistent routine',{exact:true})).toBeVisible();
  const count = await page.evaluate(()=>JSON.parse(localStorage.getItem('avalen.workspace.v1')).clients.length);
  await page.goto('/?preview=welcome');
  await page.getByRole('button',{name:'Get Started'}).click();
  await expect(page.getByRole('heading',{name:/Make it count,/})).toBeVisible();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('avalen.workspace.v1')).clients.length)).toBe(count);
});

test('session details, favorites and calendar use the scheduled session', async ({page}) => {
  await demo(page); await firstSession(page);
  await expect(page.getByRole('button',{name:'Begin Workout'})).toBeEnabled();
  await page.getByRole('button',{name:'Save session',exact:true}).click();
  await expect(page.getByRole('button',{name:'Unsave session'})).toHaveAttribute('aria-pressed','true');
  const pending = page.waitForEvent('download');
  await page.getByRole('button',{name:'Add to Cal'}).click();
  const file = await pending;
  expect(file.suggestedFilename()).toBe('avalen-session.ics');
  const content = await readFile(await file.path(),'utf8');
  expect(content).toContain('SUMMARY:Upper Body A');
  expect(content).toContain('DTSTART;VALUE=DATE:');
  await expect(page.getByRole('status')).toContainText('Calendar file downloaded');
  await page.getByRole('button',{name:'Back to sessions'}).click();
  await page.reload();
  await page.getByRole('button',{name:'Search sessions'}).click();
  await page.getByRole('button',{name:'Saved sessions',exact:true}).click();
  await expect(page.locator('.session-search-results > button')).toHaveCount(1);
  await page.getByRole('button',{name:/Upper Body A.*mins/}).click();
  await expect(page.getByRole('button',{name:'Unsave session'})).toBeVisible();
  await page.getByRole('button',{name:'Unsave session'}).click();
  await page.getByRole('button',{name:'Back to sessions'}).click();
  await page.getByRole('button',{name:'Search sessions'}).click();
  await page.getByRole('button',{name:'Saved sessions',exact:true}).click();
  await expect(page.getByRole('heading',{name:'No saved sessions yet.'})).toBeVisible();
});

test('search has empty states and future workouts stay locked', async ({page}) => {
  await demo(page);
  await page.getByRole('button',{name:'Search sessions'}).click();
  await page.getByRole('searchbox').fill('not a workout');
  await expect(page.getByRole('heading',{name:'No sessions found.'})).toBeVisible();
  await page.getByRole('searchbox').fill('Lower');
  await expect(page.locator('.session-search-results > button')).toHaveCount(2);
  await page.locator('.session-search-results > button').first().click();
  await expect(page.getByRole('button',{name:/Scheduled for/})).toBeDisabled();
  await expect(page.getByRole('button',{name:'Add to Cal'})).toBeEnabled();
});

test('details enter the logger and drafts survive reload and design migration', async ({page}) => {
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await demo(page); await firstSession(page);
  await page.getByRole('button',{name:'Begin Workout'}).click();
  await page.getByRole('spinbutton',{name:'Weight (kg)',exact:true}).fill('62.5');
  await page.getByRole('spinbutton',{name:'Reps',exact:true}).fill('11');
  await page.getByRole('button',{name:'Log set 1',exact:true}).click();
  await page.getByRole('button',{name:'Close dialog'}).click();
  await page.getByRole('button',{name:'Back to sessions'}).click();
  await expect(page.getByRole('button',{name:/Resume workout:/})).toBeVisible();
  const before = await page.evaluate(()=>{
    const data=JSON.parse(localStorage.getItem('avalen.workspace.v1'));
    data.settings.designVersion='atmosphere-v1'; data.settings.theme='light';
    localStorage.setItem('avalen.workspace.v1',JSON.stringify(data));
    return {drafts:data.drafts,sessions:data.sessions,habitLogs:data.habitLogs};
  });
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  expect(await page.evaluate(()=>{
    const data=JSON.parse(localStorage.getItem('avalen.workspace.v1'));
    return {drafts:data.drafts,sessions:data.sessions,habitLogs:data.habitLogs};
  })).toEqual(before);
  await page.getByRole('button',{name:/Resume workout:/}).click();
  await expect(page.getByRole('button',{name:'Edit set 1',exact:true})).toContainText('62.5 × 11');
  await page.getByRole('button',{name:'Finish session early'}).click();
  await page.getByRole('button',{name:'Finish & see results'}).click();
  await expect(page.getByRole('heading',{name:'You showed up.'})).toBeVisible();
  expect(errors).toEqual([]);
});

for (const width of [320,390,768,1440]) test(`navigation, themes and layout fit ${width}px`, async ({page}) => {
  await page.setViewportSize({width,height:900});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await demo(page);
  const menu=width>760?page.locator('aside nav'):page.getByRole('navigation',{name:'Main navigation'});
  if(width<=760) {
    for(const label of ['Home','Train','Nutrition','Progress','More']) await expect(menu.getByRole('button',{name:label,exact:true})).toBeInViewport();
    const box=await menu.boundingBox();expect(box.x).toBe(0);expect(box.width).toBe(width);
  }
  // Measure the destination, not whichever screen was still up when the click returned.
  const open=async label=>{
    const item=menu.getByRole('button',{name:label,exact:true});
    await item.click();
    await expect(item).toHaveAttribute('aria-current','page');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  };
  for(const label of ['Train','Nutrition','Progress','More']) await open(label);
  await page.getByRole('button',{name:/Light A clean/}).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme','light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme','light');
  await page.getByLabel('Workspace role').selectOption('coach');
  for(const label of ['Clients','Programs','Inbox','Business','More','Home']) await open(label);
  expect(errors).toEqual([]);
});
