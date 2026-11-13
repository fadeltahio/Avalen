import {test, expect} from '@playwright/test';
const nav = (page, name) => page.getByRole('navigation', {name:'Main navigation'}).getByRole('button', {name,exact:true});
const state = page => page.evaluate(() => JSON.parse(localStorage.getItem('avalen.workspace.v1')));
async function demo(page) {await page.goto('/'); await page.getByRole('button',{name:'Explore demo'}).click(); await expect(page.getByRole('heading',{name:/Make it count,/})).toBeVisible();}
async function conversation(page) {await page.getByRole('button',{name:'Coach messages',exact:true}).click(); await expect(page.getByLabel('Message',{exact:true})).toBeVisible();}
async function checkin(page) {await page.goto('/#/client/coach?tab=Check-in'); await page.getByRole('button',{name:'Start check-in',exact:true}).click();}
async function revise(page, fn) {await page.evaluate(fn); await page.evaluate(() => window.dispatchEvent(new StorageEvent('storage',{key:'avalen.workspace.v1',newValue:localStorage.getItem('avalen.workspace.v1')})));}
async function failSaves(page) {await page.evaluate(()=>{const original=Storage.prototype.setItem;window.restoreStorage=()=>{Storage.prototype.setItem=original;};Storage.prototype.setItem=function(key,value){if(key==='avalen.workspace.v1')throw new DOMException('Full','QuotaExceededError');return original.call(this,key,value);};});}

test('training prioritises starting and resuming above planning tools on a small phone', async ({page}) => {
 await page.setViewportSize({width:320,height:740}); await demo(page); await nav(page,'Train').click();
 await expect(page.getByRole('button',{name:'Start Workout',exact:true})).toBeInViewport();
 await page.getByRole('button',{name:'Start Workout',exact:true}).click(); await page.getByLabel('Weight (kg)',{exact:true}).fill('67.5'); await page.getByRole('button',{name:'Close dialog',exact:true}).click();
 await expect(page.getByRole('button',{name:/^Resume workout:/})).toHaveCount(1);
 await expect(page.getByRole('button',{name:/^Resume workout:/})).toBeInViewport();
 await page.getByRole('button',{name:/^Resume workout:/}).click(); await expect(page.getByLabel('Weight (kg)',{exact:true})).toHaveValue('67.5');
});

test('conversation drafts survive navigation and reload; Shift Enter creates a line and Enter sends once', async ({page}) => {
 await demo(page); await conversation(page); const input=page.getByLabel('Message',{exact:true});
 await input.fill('A question about my training'); await nav(page,'Home').click(); await conversation(page); await expect(input).toHaveValue('A question about my training');
 await page.reload(); await expect(input).toHaveValue('A question about my training');
 await input.evaluate(element=>element.setSelectionRange(element.value.length,element.value.length)); await input.press('Shift+Enter'); await input.pressSequentially('Can we discuss recovery?');
 const text=await input.inputValue(), before=(await state(page)).messages.length;
 await input.press('Enter'); await expect(input).toHaveValue('');
 const after=await state(page); expect(after.messages).toHaveLength(before+1); expect(after.messages.at(-1).text).toBe(text);
 await page.reload(); await expect(input).toHaveValue('');
});

test('failed storage keeps the message draft and previous records; retry saves exactly once', async ({page}) => {
 await demo(page); await conversation(page); const input=page.getByLabel('Message',{exact:true}); await input.fill('Please check my next session.');
 const before=await state(page);
 await page.evaluate(() => {const original=Storage.prototype.setItem;window.restoreStorage=()=>{Storage.prototype.setItem=original;};Storage.prototype.setItem=function(key,value){if(key==='avalen.workspace.v1')throw new DOMException('Full storage','QuotaExceededError');return original.call(this,key,value);};});
 await page.getByRole('button',{name:'Send message',exact:true}).click();
 await expect(page.locator('.refined-messages [role="alert"]')).toContainText('couldn’t be saved'); await expect(input).toHaveValue('Please check my next session.');
 expect((await state(page)).messages).toEqual(before.messages);
 await page.evaluate(()=>window.restoreStorage()); await page.getByRole('button',{name:'Send message',exact:true}).click();
 await expect(input).toHaveValue(''); expect((await state(page)).messages).toHaveLength(before.messages.length+1);
});

test('coach conversations keep drafts separate for each client and retain quick replies', async ({page}) => {
 await demo(page); await page.getByLabel('Workspace role').selectOption('coach'); await nav(page,'Inbox').click();
 const input=page.getByLabel('Message',{exact:true});
 const open=async name=>{const back=page.getByRole('button',{name:'All conversations',exact:true}); if(await back.isVisible())await back.click(); await page.getByRole('button',{name:`Open conversation with ${name}`,exact:true}).click();};
 await open('Jordan Williams'); await input.fill('First client draft');
 await open('Maya Chen'); await expect(input).toHaveValue(''); await input.fill('Second client draft');
 await open('Jordan Williams'); await expect(input).toHaveValue('First client draft');
 await open('Maya Chen'); await expect(input).toHaveValue('Second client draft');
 await page.locator('.saved-replies > summary').click(); const reply=(await state(page)).savedReplies[0]; await page.getByLabel('Quick reply',{exact:true}).selectOption(reply); await expect(input).toHaveValue(reply);
});

test('a user reading earlier messages is not pulled down by an incoming update', async ({page}) => {
 await demo(page);
 await revise(page,()=>{const data=JSON.parse(localStorage.getItem('avalen.workspace.v1'));const start=Date.now()-100000;for(let i=0;i<15;i++)data.messages.push({id:`reading-${i}`,clientId:data.activeClientId,from:'coach',text:`Training update ${i}: follow your prescribed plan.`,at:new Date(start+i*1000).toISOString(),read:true});localStorage.setItem('avalen.workspace.v1',JSON.stringify(data));});
 await conversation(page); const thread=page.getByRole('log',{name:'Conversation history'}); await thread.evaluate(element=>{element.scrollTop=0;element.dispatchEvent(new Event('scroll'));});
 await revise(page,()=>{const data=JSON.parse(localStorage.getItem('avalen.workspace.v1'));data.messages.push({id:'reading-new',clientId:data.activeClientId,from:'coach',text:'Your latest update',at:new Date().toISOString(),read:false});localStorage.setItem('avalen.workspace.v1',JSON.stringify(data));});
 await expect(page.getByRole('button',{name:'Jump to latest',exact:true})).toBeVisible();expect(await thread.evaluate(element=>element.scrollTop)).toBe(0);
 await page.getByRole('button',{name:'Jump to latest',exact:true}).click();await expect.poll(()=>thread.evaluate(element=>element.scrollHeight-element.clientHeight-element.scrollTop)).toBeLessThan(4);
});

test('measurements come first and an unsent check-in restores after closing and refresh', async ({page}) => {
 await demo(page); await checkin(page); await expect(page.getByLabel('Weight (kg)',{exact:true})).toBeInViewport(); await expect(page.getByRole('button',{name:'Record voice',exact:true})).toHaveCount(0);
 await page.getByLabel('Weight (kg)',{exact:true}).fill('78.25'); await page.getByLabel('Your update (optional)',{exact:true}).fill('A steady week, feeling stronger.');
 await page.getByRole('button',{name:'Close dialog',exact:true}).click(); await page.getByRole('button',{name:'Start check-in',exact:true}).click(); await expect(page.getByLabel('Weight (kg)',{exact:true})).toHaveValue('78.25');
 await page.reload(); await page.getByRole('button',{name:'Start check-in',exact:true}).click(); await expect(page.getByLabel('Your update (optional)',{exact:true})).toHaveValue('A steady week, feeling stronger.');
 const before=(await state(page)).checkins.length; await page.getByRole('button',{name:'Send check-in',exact:true}).click(); await expect(page.getByRole('dialog',{name:'Your check-in',exact:true})).toHaveCount(0);
 expect((await state(page)).checkins).toHaveLength(before+1); expect((await state(page)).checkins.at(-1).answers.weight).toBe(78.25);
});

test('a failed check-in save retains the form and does not create a submission', async ({page}) => {
 await demo(page); await checkin(page); await page.getByLabel('Weight (kg)',{exact:true}).fill('79.2'); const before=(await state(page)).checkins;
 await page.evaluate(()=>{const original=Storage.prototype.setItem;window.restoreStorage=()=>{Storage.prototype.setItem=original;};Storage.prototype.setItem=function(key,value){if(key==='avalen.workspace.v1')throw new DOMException('Full','QuotaExceededError');return original.call(this,key,value);};});
 await page.getByRole('button',{name:'Send check-in',exact:true}).click(); await expect(page.getByRole('dialog',{name:'Your check-in',exact:true})).toBeVisible(); await expect(page.getByLabel('Weight (kg)',{exact:true})).toHaveValue('79.2'); expect((await state(page)).checkins).toEqual(before);
 await page.evaluate(()=>window.restoreStorage()); await page.getByRole('button',{name:'Send check-in',exact:true}).click();await expect(page.getByRole('dialog',{name:'Your check-in',exact:true})).toHaveCount(0);
});

test('weight-only updates preserve the latest known body measurements with their dates', async ({page}) => {
 await demo(page);await revise(page,()=>{const data=JSON.parse(localStorage.getItem('avalen.workspace.v1'));const key=offset=>{const date=new Date();date.setDate(date.getDate()+offset);return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;};data.measurements=data.measurements.filter(row=>row.clientId!==data.activeClientId);data.measurements.push({id:'older-full',clientId:data.activeClientId,date:key(-2),weight:79,chest:99.4,waist:83.2,bodyFat:21.7},{id:'latest-weight',clientId:data.activeClientId,date:key(0),weight:78.5});localStorage.setItem('avalen.workspace.v1',JSON.stringify(data));});
 await page.goto('/#/client/progress?tab=Body'); await expect(page.getByText('83.2 cm',{exact:true})).toBeVisible();await expect(page.getByText('99.4 cm',{exact:true})).toBeVisible();await expect(page.getByText('21.7 %',{exact:true})).toBeVisible();
});

test('food search precedes recents and device settings remain available without dominating profile', async ({page}) => {
 await demo(page); await page.getByRole('button',{name:'Log food',exact:true}).click();await page.getByRole('dialog').waitFor();await page.evaluate(()=>Promise.all(document.getAnimations().map(a=>a.finished.catch(()=>{}))));const search=await page.getByLabel('Search food library').boundingBox(),recent=await page.locator('.recent-foods').boundingBox();expect(search.y).toBeLessThan(recent.y);
 await page.getByRole('button',{name:'Close dialog',exact:true}).click();await nav(page,'More').click(); await expect(page.getByRole('heading',{name:'Appearance',exact:true})).toBeVisible();
 // Devices stay folded away until asked for, so they never push the profile down.
 const devices=page.locator('.settings-disclosure').filter({hasText:'Connected devices'});await expect(devices).not.toHaveAttribute('open');await expect(page.locator('.device-row').filter({hasText:'Apple Health'})).toBeHidden();
 await devices.locator('summary').click();await expect(page.locator('.device-row').filter({hasText:'Apple Health'})).toBeVisible();
});

test('dialogs follow the keyboard viewport and an inside-padding tap does not dismiss', async ({page}) => {
 await demo(page);await page.getByRole('button',{name:'Log food',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Add food',exact:true});
 await dialog.click({position:{x:3,y:75}});await expect(dialog).toBeVisible();
 await page.getByLabel('Search food library').focus();await page.evaluate(()=>{Object.defineProperty(visualViewport,'height',{configurable:true,value:400});visualViewport.dispatchEvent(new Event('resize'));});
 await expect.poll(async()=>Math.round((await dialog.boundingBox()).height)).toBeLessThanOrEqual(376);
 await page.evaluate(()=>{delete visualViewport.height;visualViewport.dispatchEvent(new Event('resize'));});await page.getByRole('button',{name:'Close dialog',exact:true}).click();await expect(dialog).toHaveCount(0);
});

test('measurement failure retains the entry and retries without duplicate dates', async ({page}) => {
 await demo(page);await page.goto('/#/client/progress?tab=Body');await page.getByRole('button',{name:'Log',exact:true}).click();await page.getByLabel('Weight (kg)',{exact:true}).fill('78.8');const before=(await state(page)).measurements;
 await failSaves(page);await page.getByRole('button',{name:/^(Save|Update) measurement$/}).click();await expect(page.getByRole('dialog',{name:'Log measurements',exact:true})).toBeVisible();await expect(page.getByLabel('Weight (kg)',{exact:true})).toHaveValue('78.8');expect((await state(page)).measurements).toEqual(before);
 await page.evaluate(()=>window.restoreStorage());await page.getByRole('button',{name:/^(Save|Update) measurement$/}).click();await expect(page.getByRole('dialog')).toHaveCount(0);expect((await state(page)).measurements.at(-1).weight).toBe(78.8);
});

test('coach publishing retains the post after a failed save and publishes once on retry', async ({page}) => {
 await demo(page);await page.getByLabel('Workspace role').selectOption('coach');await nav(page,'Inbox').click();await page.getByRole('tab',{name:'Feed',exact:true}).click();await page.getByRole('button',{name:'New post',exact:true}).click();await page.getByLabel('Title',{exact:true}).fill('Quality comes first');await page.getByLabel('Post',{exact:true}).fill('Keep your next session controlled.');const before=(await state(page)).posts.length;
 await failSaves(page);await page.getByRole('button',{name:'Publish to members',exact:true}).click();await expect(page.getByLabel('Title',{exact:true})).toHaveValue('Quality comes first');expect((await state(page)).posts).toHaveLength(before);
 await page.evaluate(()=>window.restoreStorage());await page.getByRole('button',{name:'Publish to members',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);expect((await state(page)).posts).toHaveLength(before+1);
});

test('coach schedule reports success only after saving the adjustment', async ({page}) => {
 await demo(page);await page.getByLabel('Workspace role').selectOption('coach');await nav(page,'Clients').click();await page.locator('.client-card').first().click();await page.getByRole('tab',{name:'Plan',exact:true}).click();await page.getByRole('tab',{name:'Schedule',exact:true}).click();const before=(await state(page)).clients[0].schedule;
 await failSaves(page);await page.getByRole('button',{name:'Save schedule',exact:true}).click();await expect(page.getByText('Schedule updated.',{exact:true})).toHaveCount(0);expect((await state(page)).clients[0].schedule).toEqual(before);
 await page.evaluate(()=>window.restoreStorage());await page.getByRole('button',{name:'Save schedule',exact:true}).click();await expect(page.getByText('Schedule updated.',{exact:true})).toBeVisible();
});
