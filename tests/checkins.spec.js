import {test,expect} from '@playwright/test';
const nav=(p,name)=>p.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name,exact:true});
const state=p=>p.evaluate(()=>JSON.parse(localStorage.getItem('avalen.workspace.v1')));
async function demo(p){await p.goto('/');await p.getByRole('button',{name:'Explore demo'}).click();await expect(p.getByRole('heading',{name:/Make it count,/})).toBeVisible();}
async function coach(p,index=0){await p.getByLabel('Workspace role').selectOption('coach');await nav(p,'Clients').click();await p.locator('.client-card').nth(index).click();await p.getByRole('tab',{name:'Check-ins',exact:true}).click();}
async function client(p){await p.getByLabel('Workspace role').selectOption('client');await p.getByRole('button',{name:'Coach messages',exact:true}).click();await p.getByRole('tab',{name:'Check-in',exact:true}).click();}
async function openSettings(p){await p.getByRole('button',{name:'Check-in settings',exact:true}).click();}
async function onlyWeight(p){await p.locator('.checkin-field-toggle > label:first-child > input').evaluateAll(inputs=>inputs.filter(x=>x.checked && x.closest('.checkin-field-setting').textContent.split('Edit question')[0].includes('Weight')===false).forEach(x=>x.click()));}

test('coach configures client-specific cadence, required fields and custom questions; client submits measurements and coach sees trends',async({page:p})=>{
 await demo(p);await coach(p);await openSettings(p);await p.getByLabel('Repeat every (days)',{exact:true}).fill('3');await onlyWeight(p);
 await p.getByRole('button',{name:'Number',exact:true}).click();await p.getByLabel('Label for new question',{exact:true}).fill('Recovery minutes');await p.getByLabel('Unit for Recovery minutes',{exact:true}).fill('min');await p.getByLabel('Require Recovery minutes',{exact:true}).check();
 await p.getByRole('button',{name:'Text',exact:true}).click();await p.getByLabel('Label for new question',{exact:true}).fill('Anything hurting?');
 await p.getByRole('button',{name:'Save check-in plan',exact:true}).click();await expect(p.locator('.checkin-schedule')).toContainText('Every 3 days');
 const d=await state(p);expect(d.clients[0].checkinPlan.intervalDays).toBe(3);expect(d.clients[1].checkinPlan).toBeUndefined();
 await client(p);await expect(p.locator('.checkin-schedule')).toContainText('Every 3 days');await p.getByRole('button',{name:'Start check-in',exact:true}).click();
 await expect(p.getByLabel('Weight (kg)',{exact:true})).toBeVisible();await expect(p.getByRole('group',{name:'Mood',exact:true})).toHaveCount(0);
 await p.getByLabel('Weight (kg)',{exact:true}).fill('78.4');await p.getByLabel('Recovery minutes (min)',{exact:true}).fill('25');await p.getByLabel('Anything hurting?',{exact:true}).fill('Feeling good.');await p.getByRole('button',{name:'Send check-in',exact:true}).click();
 const after=await state(p),row=after.checkins.find(r=>r.clientId===after.activeClientId && r.date===new Date().toLocaleDateString('en-CA')) || after.checkins.at(-1);
 expect(row.answers.weight).toBe(78.4);expect(after.measurements.filter(m=>m.clientId===row.clientId && m.date===row.date)).toHaveLength(1);expect(after.measurements.find(m=>m.clientId===row.clientId && m.date===row.date).weight).toBe(78.4);
 await p.getByLabel('Trend metric',{exact:true}).selectOption({label:'Recovery minutes (min)'});await expect(p.getByRole('slider',{name:/Recovery minutes history/})).toHaveAttribute('aria-valuetext',`${row.date}: 25 min`);
 await p.reload();await expect(p.locator('.checkin-schedule')).toContainText('Every 3 days');await p.getByLabel('Trend metric',{exact:true}).selectOption({label:'Weight (kg)'});await expect(p.getByRole('slider',{name:/Weight history/})).toHaveAttribute('aria-valuetext',`${row.date}: 78.4 kg`);
 await coach(p);await p.getByRole('button',{name:new RegExp('Waiting for review.*78.4')}).click();await expect(p.getByText('Recovery minutes',{exact:true})).toBeVisible();await p.getByLabel('Feedback to client',{exact:true}).fill('Keep the same plan.');await p.getByRole('button',{name:'Complete review',exact:true}).click();
 expect((await state(p)).checkins.find(r=>r.id===row.id).reviewed).toBe(true);expect((await state(p)).messages.at(-1).text).toBe('Keep the same plan.');
});

test('editing today corrects the same measurement and prior questions survive later coach configuration',async({page:p})=>{
 await demo(p);await coach(p);await openSettings(p);await onlyWeight(p);await p.getByRole('button',{name:'Save check-in plan',exact:true}).click();await client(p);
 await p.getByRole('button',{name:'Start check-in',exact:true}).click();await p.getByLabel('Weight (kg)',{exact:true}).fill('80');await p.getByRole('button',{name:'Send check-in',exact:true}).click();
 const before=await state(p),row=before.checkins.at(-1);await p.getByRole('button',{name:'Edit today’s check-in',exact:true}).click();await p.getByLabel('Weight (kg)',{exact:true}).fill('79.5');await p.getByRole('button',{name:'Send check-in',exact:true}).click();
 expect((await state(p)).checkins.filter(r=>r.id===row.id)).toHaveLength(1);expect((await state(p)).measurements.filter(m=>m.clientId===row.clientId && m.date===row.date)).toHaveLength(1);
 await coach(p);await openSettings(p);await p.locator('.checkin-field-setting').filter({has:p.getByLabel('Require Weight',{exact:true})}).getByText('Edit question',{exact:true}).click();await p.getByLabel('Label for Weight',{exact:true}).fill('Morning weight');await p.getByRole('button',{name:'Save check-in plan',exact:true}).click();
 await p.getByRole('button',{name:/Waiting for review.*79.5/}).click();await expect(p.getByRole('heading',{name:'Weight',exact:true})).toBeVisible();await expect(p.getByRole('heading',{name:'Morning weight',exact:true})).toHaveCount(0);
});

test('legacy check-ins remain reviewable; photos and optional readings remain missing until supplied',async({page:p})=>{
 await demo(p);await coach(p);const before=(await state(p)).checkins;
 await p.locator('.checkin-summary').first().click();await expect(p.getByRole('heading',{name:'Mood',exact:true})).toBeVisible();await expect(p.getByRole('heading',{name:'Weight',exact:true})).toHaveCount(0);await p.getByRole('button',{name:'Close dialog',exact:true}).click();
 await openSettings(p);await onlyWeight(p);await p.locator('.checkin-field-setting').filter({has:p.getByLabel('Require Progress photos',{exact:true})}).locator('.checkin-field-toggle > label:first-child input').check();await p.getByRole('button',{name:'Save check-in plan',exact:true}).click();await client(p);
 await p.getByRole('button',{name:'Start check-in',exact:true}).click();await p.getByLabel('Weight (kg)',{exact:true}).fill('80.2');await p.getByLabel('Progress photos',{exact:true}).setInputFiles('public/design/meal-olive.webp');await expect(p.getByAltText('Check-in progress photo',{exact:true})).toBeVisible();await p.getByRole('button',{name:'Send check-in',exact:true}).click();
 const after=await state(p);expect(after.checkins).toHaveLength(before.length+1);expect(after.checkins.at(-1).photos[0].id).toBeTruthy();expect(after.checkins.at(-1).answers.waist).toBeUndefined();
});

for(const width of [320,1440])test(`check-in screens fit ${width}px and coach settings persist on reload`,async({page:p})=>{
 await p.setViewportSize({width,height:900});await demo(p);await p.getByLabel('Workspace role').selectOption('coach');const menu=n=>width>760?p.locator('aside nav').getByRole('button',{name:n,exact:true}):nav(p,n);await menu('Clients').click();await p.locator('.client-card').first().click();await p.getByRole('tab',{name:'Check-ins',exact:true}).click();
 const errors=[];p.on('pageerror',e=>errors.push(e.message));await expect(p.getByRole('region',{name:'Check-in trends',exact:true})).toBeVisible();expect(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await openSettings(p);await p.getByLabel('Repeat every (days)',{exact:true}).fill('10');await p.getByRole('button',{name:'Close dialog',exact:true}).click();await p.reload();await openSettings(p);await expect(p.getByLabel('Repeat every (days)',{exact:true})).toHaveValue('10');expect(await p.locator('.checkin-settings').evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);await p.getByRole('button',{name:'Save check-in plan',exact:true}).click();expect(errors).toEqual([]);
});

test('irregular check-ins are spaced by time and the graph can be explored with a keyboard',async({page:p})=>{
 await demo(p);await p.evaluate(()=>{
  const d=JSON.parse(localStorage.getItem('avalen.workspace.v1')),id=d.activeClientId;
  const key=days=>{const v=new Date();v.setDate(v.getDate()+days);return `${v.getFullYear()}-${String(v.getMonth()+1).padStart(2,'0')}-${String(v.getDate()).padStart(2,'0')}`;};
  d.measurements=d.measurements.filter(m=>m.clientId!==id);d.checkins=d.checkins.filter(r=>r.clientId!==id);
  for(const [i,days] of [-30,-29,-1].entries())d.checkins.push({id:`trend-${i}`,clientId:id,date:key(days),schema:[{id:'weight',label:'Weight',type:'number',unit:'kg',measurementKey:'weight'}],answers:{weight:80-i},scores:{},reviewed:true});
  localStorage.setItem('avalen.workspace.v1',JSON.stringify(d));
 });await p.reload();await coach(p);
 const points=(await p.locator('.checkin-trends .chart-line').getAttribute('points')).split(' ').map(v=>Number(v.split(',')[0]));expect(points[1]-points[0]).toBeLessThan((points[2]-points[1])/10);
 const graph=p.getByRole('slider',{name:/Weight history/});await graph.focus();await graph.press('Home');await expect(graph).toHaveAttribute('aria-valuetext',/80 kg$/);await graph.press('ArrowRight');await expect(graph).toHaveAttribute('aria-valuetext',/79 kg$/);
});
