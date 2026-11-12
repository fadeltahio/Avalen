import {test, expect} from '@playwright/test';
import {fixture} from './helpers/service.js';

const nav = (page, name) => page.getByRole('navigation', {name:'Main navigation'}).getByRole('button', {name, exact:true});
const state = page => page.evaluate(() => JSON.parse(localStorage.getItem('avalen.workspace.v1')));
async function demo(page, role='client') {
  await page.goto('/');
  await page.getByRole('button', {name:'Explore demo'}).click();
  if (role==='coach') await page.getByLabel('Workspace role').selectOption('coach');
}
async function failSaves(page) {
  await page.evaluate(() => {
    const original=Storage.prototype.setItem;
    window.restoreStorage=()=>Storage.prototype.setItem=original;
    Storage.prototype.setItem=function(key,value) {
      if (key==='avalen.workspace.v1') throw new DOMException('Full', 'QuotaExceededError');
      return original.call(this,key,value);
    };
  });
}
async function clientSection(page, section) {
  await page.goto(`/#/coach/clients?client=client-0&section=${encodeURIComponent(section)}`);
}

test('profile save failure retains edited values and retries against the selected profile', async ({page},testInfo) => {
  await demo(page); await nav(page,'More').click();
  await page.getByRole('button',{name:'Edit profile',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Your profile',exact:true});
  await dialog.getByLabel('Full name',{exact:true}).fill('Review Test');
  const before=(await state(page)).clients[0];
  await failSaves(page); await dialog.getByRole('button',{name:'Save profile',exact:true}).click();
  await expect(dialog).toBeVisible(); await expect(dialog.getByRole('alert')).toContainText('couldn’t be saved');
  await expect(dialog.getByLabel('Full name',{exact:true})).toHaveValue('Review Test');
  await page.screenshot({path:`output/functional-review/profile-retry-${testInfo.project.name}.png`});
  expect((await state(page)).clients[0]).toEqual(before);
  await page.evaluate(()=>window.restoreStorage()); await dialog.getByRole('button',{name:'Save profile',exact:true}).click();
  await expect(dialog).toHaveCount(0); expect((await state(page)).clients[0].name).toBe('Review Test');
  await page.reload(); await expect(page.getByRole('heading',{name:'Review Test',exact:true})).toBeVisible();
});

test('switching the preview client loads that client’s profile editor',async({page})=>{
  await demo(page); await nav(page,'More').click();
  await page.getByLabel('Client preview',{exact:true}).selectOption('client-1');
  await page.getByRole('button',{name:'Edit profile',exact:true}).click();
  await expect(page.getByRole('dialog').getByLabel('Full name',{exact:true})).toHaveValue('Maya Chen');
});

// Manual wearable readings and device connections are covered in wearables.spec.js.

for(const kind of ['brand','billing','habits','measurements']) test(`${kind} reports success only after saving and retains failed input`,async({page})=>{
  await demo(page,'coach');
  let save,success,input;
  if(kind==='brand') {
    await page.getByRole('button',{name:'Coach brand settings',exact:true}).click();
    input=page.getByLabel('Coaching brand',{exact:true});await input.fill('Reviewed Coaching');
    save=page.getByRole('button',{name:'Save brand',exact:true});success=page.getByText(/Brand saved for all/);
  } else if(kind==='billing') {
    await clientSection(page,'Billing');input=page.getByLabel('Amount',{exact:true});await input.fill('3150');
    save=page.getByRole('button',{name:'Save membership',exact:true});success=page.getByText('Membership updated.',{exact:true});
  } else if(kind==='habits') {
    await clientSection(page,'Plan');await page.getByRole('tab',{name:'Habits',exact:true}).click();
    input=page.getByLabel('Daily target',{exact:true}).first();await input.fill('3');
    save=page.getByRole('button',{name:'Save habit targets',exact:true});success=page.getByText('Habit targets updated.',{exact:true});
  } else {
    await clientSection(page,'Documents');input=page.getByLabel('Weight (kg)',{exact:true});await input.fill('81.2');
    await page.getByLabel('Body fat (%)',{exact:true}).fill('20.5');await page.getByLabel('Skeletal muscle (kg)',{exact:true}).fill('34.1');
    save=page.getByRole('button',{name:'Save verified measurements',exact:true});success=page.getByText('Verified measurements saved to this client’s body-composition history.',{exact:true});
  }
  const value=await input.inputValue(), before=await state(page);
  await failSaves(page);await save.click();await expect(success).toHaveCount(0);await expect(input).toHaveValue(value);
  await expect(page.locator('main form [role="alert"]').last()).toContainText('couldn’t be saved');
  const after=await state(page);expect(after.clients).toEqual(before.clients);expect(after.coach).toEqual(before.coach);expect(after.inbodies).toEqual(before.inbodies);
  await page.evaluate(()=>window.restoreStorage());await save.click();await expect(success).toBeVisible();
  const saved=await state(page);
  if(kind==='brand')expect(saved.coach.brand).toBe(value);
  if(kind==='billing')expect(saved.clients[0].subscription.amount).toBe(Number(value));
  if(kind==='habits')expect(saved.clients[0].habits[0].target).toBe(Number(value));
  if(kind==='measurements')expect(saved.inbodies).toHaveLength(before.inbodies.length+1);
});

test('new client failure retains the form and retry creates one client',async({page})=>{
  await demo(page,'coach');await nav(page,'Clients').click();await page.getByRole('button',{name:'Add client',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Add a client',exact:true});await dialog.getByLabel('Full name',{exact:true}).fill('Review Client');
  await dialog.getByLabel('Email',{exact:true}).fill('review@example.test');const before=(await state(page)).clients.length;
  await failSaves(page);await dialog.getByRole('button',{name:'Create client',exact:true}).click();await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('alert')).toContainText('couldn’t be saved');expect((await state(page)).clients).toHaveLength(before);
  await page.evaluate(()=>window.restoreStorage());await dialog.getByRole('button',{name:'Create client',exact:true}).click();
  await expect(dialog).toHaveCount(0);await expect(page.getByRole('heading',{name:'Review Client',exact:true})).toBeVisible();
  expect((await state(page)).clients).toHaveLength(before+1);
});

test('programme assignment remains reviewable after failure and retry preserves workout history',async({page})=>{
  await demo(page,'coach');await nav(page,'Programs').click();
  await page.getByRole('button',{name:'Create programme',exact:true}).click();await page.getByRole('button',{name:'Save programme',exact:true}).click();
  await page.getByRole('button',{name:'Assign',exact:true}).first().click();
  const dialog=page.getByRole('dialog',{name:'Assign programme',exact:true}),before=await state(page);
  await failSaves(page);await dialog.getByRole('button',{name:'Confirm assignment',exact:true}).click();await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('alert')).toContainText('couldn’t be saved');expect((await state(page)).clients).toEqual(before.clients);
  await page.evaluate(()=>window.restoreStorage());await dialog.getByRole('button',{name:'Confirm assignment',exact:true}).click();await expect(dialog).toHaveCount(0);
  expect((await state(page)).sessions).toEqual(before.sessions);
});

test('travel session details open the prescribed travel workout from Home and Train',async({page},testInfo)=>{
  await demo(page);
  await page.evaluate(()=>{
    const data=JSON.parse(localStorage.getItem('avalen.workspace.v1')),client=data.clients[0],today=new Date();
    const key=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
    const start=key(today);today.setDate(today.getDate()+7);
    client.travel={start,end:key(today),days:[{id:'travel',name:'Travel · Full Body',minutes:25,cover:3,exercises:[{...data.library.find(e=>e.name==='Push-up'),id:'travel-pushup'}]}]};
    if(!client.schedule.some(s=>s.date===start))client.schedule.push({date:start,dayId:client.program.days[0].id});
    localStorage.setItem('avalen.workspace.v1',JSON.stringify(data));
  });await page.reload();
  await page.locator('.home-today-session').getByRole('button',{name:'View Travel · Full Body',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Travel · Full Body',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Begin Workout',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Back to sessions',exact:true}).click();await nav(page,'Train').click();
  await page.getByRole('button',{name:'View session details',exact:true}).click();
  await expect(page.locator('.session-detail-exercises')).toContainText('Push-up');
  await page.screenshot({path:`output/functional-review/travel-details-${testInfo.project.name}.png`,fullPage:true});
});

test('account service outage offers an in-place retry without erasing typed email',async({page})=>{
  await page.route('**/api/session',route=>route.abort('failed'));
  await page.route('**/api/status',route=>route.abort('failed'));
  await page.goto('/?connected=1');await expect(page.getByRole('alert')).toContainText('unavailable');
  await page.getByLabel('Email',{exact:true}).fill('review@example.test');
  await page.unroute('**/api/session');await page.unroute('**/api/status');
  await page.route('**/api/session',route=>route.fulfill({json:{user:null}}));
  await page.route('**/api/status',route=>route.fulfill({json:{configured:true}}));
  await page.getByRole('button',{name:'Retry connection',exact:true}).click();
  await expect(page.getByRole('button',{name:'Sign in',exact:true})).toBeEnabled();
  await expect(page.getByLabel('Email',{exact:true})).toHaveValue('review@example.test');
});

test('custom exercise failure keeps its fields and retry adds one library movement',async({page})=>{
  await demo(page,'coach');await clientSection(page,'Plan');
  await page.getByRole('button',{name:'Edit programme',exact:true}).click();
  await page.getByRole('button',{name:'Create a custom exercise',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Add to your exercise library',exact:true});
  await dialog.getByLabel('Exercise name',{exact:true}).fill('Review movement');
  await dialog.getByLabel('Muscle group',{exact:true}).fill('Legs');
  const before=(await state(page)).library.length;
  await failSaves(page);await dialog.getByRole('button',{name:'Create exercise',exact:true}).click();
  await expect(dialog).toBeVisible();await expect(dialog.getByRole('alert')).toContainText('couldn’t be saved');
  expect((await state(page)).library).toHaveLength(before);
  await page.evaluate(()=>window.restoreStorage());await dialog.getByRole('button',{name:'Create exercise',exact:true}).click();
  await expect(dialog).toHaveCount(0);expect((await state(page)).library).toHaveLength(before+1);
  await expect(page.locator('.exercise-editor summary').filter({hasText:'Review movement'})).toBeVisible();
});

test('report metadata failure keeps the prepared file for a duplicate-free retry',async({page})=>{
  await demo(page,'coach');await clientSection(page,'Documents');const before=(await state(page)).documents.length;
  await failSaves(page);await page.locator('input[type=file]').setInputFiles({name:'review-report.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\nReview fixture\n%%EOF')});
  await expect(page.getByRole('button',{name:'Retry adding report',exact:true})).toBeVisible();
  expect((await state(page)).documents).toHaveLength(before);
  await page.evaluate(()=>window.restoreStorage());await page.getByRole('button',{name:'Retry adding report',exact:true}).click();
  await expect(page.getByRole('button',{name:'Retry adding report',exact:true})).toHaveCount(0);
  expect((await state(page)).documents).toHaveLength(before+1);await page.reload();
  const download=page.waitForEvent('download');await page.getByRole('button',{name:/review-report.pdf/}).click();
  expect((await download).suggestedFilename()).toBe('review-report.pdf');
});

for(const kind of ['profile','billing'])test(`connected ${kind} guards pending saves until server acknowledgement`,async({page})=>{
  const service=await fixture();let release;
  try {
    const clientId=service.coach.data.clients[0].id;
    let email='coach@test.app',password='strong-password-123';
    if(kind==='profile') {
      const invite=await service.call('/api/invitations',{method:'POST',account:service.coach,body:{clientId}});
      await service.call('/api/join',{method:'POST',body:{invite:invite.invite,email:'client@test.app',password:'client-password-123'}});
      email='client@test.app';password='client-password-123';
    }
    await page.goto(`${service.base}/?connected=1${kind==='profile'?'#/client/you':`#/coach/clients?client=${clientId}&section=Billing`}`);
    await page.getByLabel('Email',{exact:true}).fill(email);await page.getByLabel('Password',{exact:true}).fill(password);
    await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.getByRole('button',{name:'Account',exact:true})).toBeVisible();
    let input,save;
    if(kind==='profile') {
      await page.getByRole('button',{name:'Edit profile',exact:true}).click();input=page.getByLabel('Full name',{exact:true});
      await input.fill('Connected Review');save=page.getByRole('button',{name:'Save profile',exact:true});
    } else {input=page.getByLabel('Amount',{exact:true});await input.fill('3150');save=page.getByRole('button',{name:'Save membership',exact:true});}
    let held=false,requests=0;const pending=new Promise(resolve=>release=resolve);
    await page.route('**/api/workspace',async route=>{if(route.request().method()==='PATCH'){requests++;held=true;await pending;}await route.continue();});
    await save.click();await expect.poll(()=>held).toBe(true);await expect(input).toBeDisabled();
    await expect(page.getByRole('button',{name:kind==='profile'?'Saving profile…':'Saving membership…',exact:true})).toBeDisabled();
    if(kind==='profile')await expect(page.getByRole('dialog').getByRole('button',{name:'Close dialog',exact:true})).toBeDisabled();
    const before=await service.call('/api/workspace',{account:service.coach});
    if(kind==='profile')expect(before.data.clients[0].name).not.toBe('Connected Review');
    else expect(before.data.clients[0].subscription.amount).not.toBe(3150);
    release();
    await expect.poll(async()=>{const result=await service.call('/api/workspace',{account:service.coach});return kind==='profile'?result.data.clients[0].name:result.data.clients[0].subscription.amount;}).toBe(kind==='profile'?'Connected Review':3150);
    if(kind==='profile')await expect(page.getByRole('dialog')).toHaveCount(0);else await expect(page.getByText('Membership updated.',{exact:true})).toBeVisible();
    expect(requests).toBe(1);
  } finally {release?.();await page.close();await service.close();}
});

test('connected client can save, search and unsave sessions without changing the coach’s programme',async({page})=>{
  const service=await fixture();
  try {
    const clientId=service.coach.data.clients[0].id;
    const invite=await service.call('/api/invitations',{method:'POST',account:service.coach,body:{clientId}});
    await service.call('/api/join',{method:'POST',body:{invite:invite.invite,email:'client@test.app',password:'client-password-123'}});
    await page.goto(`${service.base}/?connected=1`);
    await page.getByLabel('Email',{exact:true}).fill('client@test.app');await page.getByLabel('Password',{exact:true}).fill('client-password-123');
    await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.getByRole('button',{name:'Account',exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Search sessions',exact:true}).click();
    const search=page.getByRole('dialog',{name:'Find your next session',exact:true});await search.locator('.session-search-results button').first().click();
    const title=await page.locator('.session-detail-copy h1').innerText();
    await page.getByRole('button',{name:'Save session',exact:true}).click();
    await expect(page.getByRole('button',{name:'Unsave session',exact:true})).toHaveAttribute('aria-pressed','true');
    await page.reload();await expect(page.getByRole('button',{name:'Unsave session',exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Back to sessions',exact:true}).click();
    await page.getByRole('button',{name:'Search sessions',exact:true}).click();await page.getByRole('button',{name:'Saved sessions',exact:true}).click();
    await expect(search.locator('.session-search-results button')).toHaveCount(1);await expect(search).toContainText(title);
    await search.locator('.session-search-results button').click();await page.getByRole('button',{name:'Unsave session',exact:true}).click();
    await expect(page.getByRole('button',{name:'Save session',exact:true})).toHaveAttribute('aria-pressed','false');
    const stored=await service.call('/api/workspace',{account:service.coach});expect(stored.data.clients[0].savedSessions).toEqual([]);
    expect(stored.data.clients[0].program).toEqual(service.coach.data.clients[0].program);
    await page.getByRole('button',{name:'Back to sessions',exact:true}).click();
    await page.getByRole('button',{name:'Account',exact:true}).click();
    await page.route('**/api/logout',route=>route.abort('failed'));await page.getByRole('button',{name:'Sign out',exact:true}).click();
    await expect(page.getByRole('dialog').getByText(/Sign out was not confirmed/)).toBeVisible();
    await page.unroute('**/api/logout');await page.getByRole('button',{name:'Sign out',exact:true}).click();
    await expect(page.getByRole('button',{name:'Sign in',exact:true})).toBeVisible();
  } finally {await page.close();await service.close();}
});
