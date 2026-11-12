import {chromium} from '@playwright/test';
import {mkdir, copyFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
const output = path.resolve('output/essential-flows');
await mkdir(output, {recursive:true});
const browser = await chromium.launch({executablePath:process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:true});
const shots = [];
try {
  const page = await browser.newPage({viewport:{width:390,height:844}});
  const nav = name => page.getByRole('navigation', {name:'Main navigation'}).getByRole('button', {name,exact:true});
  async function shot(file, title, detail) {await page.evaluate(() => document.fonts.ready); await page.screenshot({path:path.join(output, `${file}.png`), animations:'disabled'}); shots.push({file,title,detail});}
  await page.goto('http://127.0.0.1:5173/');
  await page.getByRole('button',{name:'Explore demo'}).click();
  await page.getByRole('heading',{name:/Make it count,/}).waitFor();
  await shot('01-home','Today, in order','Start or resume training, see your check-in, and open daily habits.');
  await page.getByRole('button',{name:'Start Workout',exact:true}).click();
  await shot('02-log-set','One clear working set','Coach target, labelled values, and a full-width Log set action.');
  await page.getByRole('button',{name:'Log set 1',exact:true}).click();
  await page.getByRole('button',{name:'Log set 2',exact:true}).waitFor();
  await shot('03-rest','Rest, then continue','The next set stays in the working area; history stays underneath.');
  await page.locator('.logger-open-exercises').click();
  await shot('04-exercise-picker','Know what is next','Named exercises with logged and skipped set counts.');
  await page.getByRole('button',{name:'Go to Incline dumbbell press'}).click();
  await page.getByRole('heading',{name:'Incline dumbbell press',exact:true}).waitFor();
  await page.getByRole('button',{name:'Pause & close',exact:true}).click();
  await page.getByRole('dialog').waitFor({state:'hidden'});
  await page.locator('.home-log-planned').click();
  await shot('05-quick-meal','Log the coach’s meal','Open portion review directly from Home, then confirm what you ate.');
  await page.getByRole('button',{name:'Close dialog'}).click();
  await page.getByLabel('Workspace role').selectOption('coach');
  await page.getByRole('heading',{name:/Good .*Alex/}).waitFor();
  await shot('06-coach-queue','A focused coach queue','Specific review actions and filters for check-ins, messages, and technique.');
  await nav('Clients').click(); await page.locator('.client-card').first().click();
  await page.getByRole('heading',{name:'Jordan Williams',exact:true}).waitFor();
  await shot('07-client','Five client essentials','Message the client directly; open specialist tools from More sections.');
  await page.getByRole('tab',{name:'Plan',exact:true}).click();
  await shot('08-programme','Programme first','Edit the programme, inspect session details, or switch to scheduling and habits.');
  await page.getByRole('tab',{name:'Schedule',exact:true}).click();
  await page.getByRole('heading',{name:'Adjust the schedule',exact:true}).waitFor();
  await shot('09-schedule','Scheduling has its own space','Review date changes, arrange the week, and manage travel without scrolling through the full programme.');
  await page.setViewportSize({width:1440,height:950}); await page.locator('aside nav').getByRole('button', {name:'Dashboard', exact:true}).click();
  await page.getByRole('heading',{name:/Good .*Alex/}).waitFor();
  await shot('10-desktop','The same flow on desktop','Review tasks remain the primary workspace across screen sizes.');
} finally {await browser.close();}
for (const name of ['home','logger','coach','client']) {
  try {await copyFile(`/tmp/avalen-flow-before/${name}.png`, path.join(output, `before-${name}.png`));} catch {}
}
const cards = shots.map(({file,title,detail}) => `<article><img src="${file}.png" alt="${title}" loading="lazy"><h2>${title}</h2><p>${detail}</p></article>`).join('');
await writeFile(path.join(output,'index.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Avalen · Essential flows</title><style>*{box-sizing:border-box}body{background:#0b0b0b;color:#f6f6f3;font:15px/1.6 system-ui;margin:0;padding:36px 24px}header,main,footer{max-width:1240px;margin:auto}header{margin-bottom:36px}header small{letter-spacing:.15em;color:#b8c3ba}h1{font-size:clamp(30px,5vw,48px);letter-spacing:-.045em;line-height:1.15}a{color:#a5cabb}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:32px}article{min-width:0}article img{width:100%;max-height:660px;object-fit:contain;object-position:top;background:#151515;border:1px solid #303030}h2{font-size:19px;line-height:1.3;margin-bottom:8px}p{color:#aaa;max-width:70ch}footer{padding:40px 0}footer details{border-top:1px solid #333;padding:16px 0}footer summary{cursor:pointer}footer img{max-width:290px;width:100%;margin:16px 10px 0 0}</style><header><small>AVALEN / ESSENTIAL FLOWS</small><h1>Less searching.<br>A clearer next step.</h1><p>A focused refinement of the existing app. Training, nutrition, and coaching keep their original features and saved records.</p><a href="/">Open Avalen</a></header><main>${cards}</main><footer><details><summary>Before this refinement</summary><img src="before-home.png" alt="Previous client home"><img src="before-logger.png" alt="Previous workout logger"><img src="before-coach.png" alt="Previous coach dashboard"><img src="before-client.png" alt="Previous client workspace"></details><p>Actual app captures using isolated demo data. Phone screenshots are 390 × 844 browser previews; physical-phone testing is still valuable.</p></footer></html>`);
console.log(`Saved ${shots.length} screenshots and the walkthrough to ${output}`);
