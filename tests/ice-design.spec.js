import { test, expect } from '@playwright/test';
const nav = (page, name) => page.getByRole('navigation', {name:'Main navigation'}).getByRole('button', {name,exact:true});

test('the theme defaults to dark and an upcoming session previews its real scheduled day', async ({page}) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await page.getByRole('button',{name:'Explore demo',exact:true}).click();
  await expect(page.getByRole('heading',{name:/Make it count,/})).toBeVisible();
  const upcoming = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('avalen.workspace.v1'));
    const client = data.clients.find(c => c.id === data.activeClientId);
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    const current = client.schedule.find(s => s.date === today)?.dayId;
    const day = client.program.days.find(d => d.id !== current && client.schedule.some(s => s.dayId === d.id && s.date > today));
    return {name:day.name,date:client.schedule.find(s => s.dayId === day.id && s.date > today).date};
  });
  await page.getByRole('button',{name:`View ${upcoming.name}`,exact:true}).click();
  await expect(page.getByRole('heading',{name:upcoming.name,exact:true})).toBeVisible();
  const short = new Date(`${upcoming.date}T12:00:00`).toLocaleDateString('en',{month:'short',day:'numeric'});
  await expect(page.getByRole('button',{name:`Scheduled for ${short}`,exact:true})).toBeDisabled();
});

test('adopting the smoked-glass reference preserves saved sets and later appearance choices', async ({page}) => {
  await page.goto('/');await page.getByRole('button',{name:'Explore demo',exact:true}).click();
  await page.getByRole('button',{name:'Start Workout',exact:true}).click();
  await page.getByRole('spinbutton',{name:'Weight (kg)',exact:true}).fill('62.5');
  await page.getByRole('spinbutton',{name:'Reps',exact:true}).fill('11');
  await page.getByRole('button',{name:'Log set 1',exact:true}).click();
  await page.getByRole('button',{name:'Close dialog',exact:true}).click();
  const before = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('avalen.workspace.v1'));
    delete data.settings.designVersion;
    data.settings.theme='light';
    localStorage.setItem('avalen.workspace.v1',JSON.stringify(data));
    return {drafts:data.drafts,clients:data.clients,sessions:data.sessions,habits:data.habitLogs};
  });
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  const after = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('avalen.workspace.v1'));
    return {drafts:data.drafts,clients:data.clients,sessions:data.sessions,habits:data.habitLogs};
  });
  expect(after).toEqual(before);
  await page.getByRole('button',{name:/^Resume workout:/}).click();
  await expect(page.getByText('62.5 × 11',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Close dialog',exact:true}).click();
  await nav(page,'More').click();await page.getByRole('group',{name:'Colour theme'}).getByRole('button',{name:/^Light /}).click();
  await page.reload();await expect(page.locator('html')).toHaveAttribute('data-theme','light');
});
