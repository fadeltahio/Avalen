import { test, expect } from '@playwright/test';
const nav = (page,name)=>page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name,exact:true});
async function demo(page){await page.goto('/');await page.getByRole('button',{name:'Explore demo'}).click();}

test('water responds to actual touch and drag without changing the logged intake', async({browser},testInfo)=>{
  const context=await browser.newContext({hasTouch:true,viewport:{width:390,height:844}}),page=await context.newPage();
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await demo(page);await nav(page,'Train').click();await page.getByRole('tab',{name:'Habits',exact:true}).click();
  const canvas=page.locator('.liquid-canvas'),scene=page.locator('.water-scene');
  await scene.scrollIntoViewIfNeeded();
  await expect(canvas).toHaveAttribute('data-renderer',/webgl|canvas/);
  const total=await page.locator('.water-heading b').innerText();
  const before=Number(await canvas.getAttribute('data-interactions'));
  const box=await scene.boundingBox();
  await page.touchscreen.tap(box.x+box.width*.3,box.y+box.height*.64);
  await expect.poll(async()=>Number(await canvas.getAttribute('data-interactions'))).toBeGreaterThan(before);
  await page.mouse.move(box.x+box.width*.25,box.y+box.height*.64);
  await page.mouse.down();await page.mouse.move(box.x+box.width*.8,box.y+box.height*.5,{steps:12});await page.mouse.up();
  await expect.poll(async()=>Number(await canvas.getAttribute('data-interactions'))).toBeGreaterThan(before+1);
  await expect(page.locator('.water-heading b')).toHaveText(total);
  await scene.screenshot({path:testInfo.outputPath('touch-ripples.png')});
  expect(errors).toEqual([]);await context.close();
});

test('the waterline crosses the percentage when intake rises and the renderer survives reduced motion', async({page},testInfo)=>{
  await demo(page);await nav(page,'Train').click();await page.getByRole('tab',{name:'Habits',exact:true}).click();
  await page.getByRole('spinbutton',{name:'Drink water',exact:true}).fill('0.5');
  const canvas=page.locator('.liquid-canvas'),scene=page.locator('.water-scene');await scene.scrollIntoViewIfNeeded();
  await expect.poll(async()=>Number(await canvas.getAttribute('data-level'))).toBe(20);
  await scene.screenshot({path:testInfo.outputPath('dry-percentage.png')});
  for(const [ml,percent,name] of [[500,40,'partial'],[500,60,'submerged']]){
    await page.getByRole('button',{name:'Custom',exact:true}).click();await page.getByLabel('Water amount (ml)').fill(String(ml));await page.getByRole('button',{name:'Log water',exact:true}).click();
    await expect.poll(async()=>Number(await canvas.getAttribute('data-level'))).toBe(percent);
    await scene.screenshot({path:testInfo.outputPath(`${name}-percentage.png`)});
  }
  await page.emulateMedia({reducedMotion:'reduce'});
  await expect(scene).toHaveAttribute('data-interactive','false');await expect(canvas).toHaveAttribute('data-level','60');
  await expect(page.locator('.water-percent')).toHaveText('60%');
  await page.getByRole('button',{name:'Add 250 ml water'}).click();await expect(canvas).toHaveAttribute('data-level','70');
});

test('the training calendar previews scheduled days and meal capture opens the photo form', async({page})=>{
  await demo(page);
  await expect(page.getByRole('heading',{name:/Make it count,/})).toBeVisible();
  await nav(page,'Train').click();
  for (const width of [768, 320, 390]) {
    await page.setViewportSize({width,height:844});
    await expect.poll(() => page.locator('.calendar').evaluate(calendar => {
      const selected = calendar.querySelector('[aria-pressed="true"]').getBoundingClientRect();
      const bounds = calendar.getBoundingClientRect();
      return selected.left >= bounds.left - 1 && selected.right <= bounds.right + 1;
    })).toBe(true);
  }
  const next = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('avalen.workspace.v1'));
    const client = data.clients.find(c => c.id === data.activeClientId);
    const now = new Date(); now.setHours(12,0,0,0);
    const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    return client.schedule.find(s => s.date > today && s.dayId);
  });
  const label = new Date(`${next.date}T12:00:00`).toLocaleDateString('en', {weekday:'long',month:'long',day:'numeric'});
  await page.locator('.calendar').getByRole('button',{name:label,exact:true}).click();
  await expect(page.getByRole('button',{name:/Available on/})).toBeDisabled();
  await nav(page,'Nutrition').click();
  await page.getByRole('button',{name:'Photo meal',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Add meal photo',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Upload meal photo',exact:true})).toBeVisible();
});
