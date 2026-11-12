import { chromium } from '@playwright/test';
import { mkdir, writeFile, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
let videoFile = 'client-motion.webm';
const output = resolve('output/motion');
await mkdir(output, {recursive:true});
const browser = await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const context = await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,recordVideo:{dir:resolve('/tmp/avalen-motion-recording'),size:{width:390,height:844}}});
const page = await context.newPage();
const screenshots = [];
const nav = name => page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name,exact:true});
async function settle(ms=500){await page.waitForTimeout(ms);}
async function shot(file,title,description){await settle();await page.screenshot({path:`${output}/${file}.png`,fullPage:false});screenshots.push({file:`${file}.png`,title,description});}
try {
  await page.addInitScript(()=>sessionStorage.setItem('avalen.editorial.splash','seen'));
  await page.goto('http://127.0.0.1:5173/');
  await page.getByRole('button',{name:'Explore demo'}).click();await settle(900);
  await shot('01-home','Your day, connected','Real nutrition targets, your coach’s programme, and direct actions. Values retain their actual starting point.');
  await page.getByRole('button',{name:'View Upper Body A',exact:true}).click();await settle(650);
  await page.getByRole('button',{name:'Begin Workout',exact:true}).click();await settle(600);
  await page.getByRole('spinbutton',{name:'Weight (kg)',exact:true}).fill('120');
  await page.getByRole('spinbutton',{name:'Reps',exact:true}).fill('10');
  await page.getByRole('button',{name:'Log set 1',exact:true}).click();await settle(1200);
  await shot('02-logger','A clearer training rhythm','The saved set, next inputs and circular rest timer form one sequence. Logging stays available during rest.');
  await page.getByRole('button',{name:'Pause rest',exact:true}).click();await settle(800);
  await page.getByRole('button',{name:'+30s',exact:true}).click();await settle(600);
  await page.getByRole('button',{name:'Resume rest',exact:true}).click();await settle(800);
  await page.getByRole('button',{name:'Skip rest',exact:true}).click();
  await page.getByRole('button',{name:'Log set 2',exact:true}).click();await settle(600);
  await page.getByRole('button',{name:'Skip rest',exact:true}).click();
  await page.getByRole('button',{name:'Log set 3',exact:true}).click();await settle(500);
  await page.getByRole('button',{name:'Next exercise',exact:true}).click();await settle(750);
  await page.getByRole('button',{name:'Finish session early',exact:true}).click();await settle(400);
  await page.getByRole('button',{name:'Finish & see results',exact:true}).click();
  await page.getByRole('heading',{name:'You put in the work.'}).waitFor();await settle(950);
  await shot('03-completion','An earned finish','Only a newly saved workout gets this signature moment. Personal records come from actual comparisons with prior sessions.');
  await page.getByRole('button',{name:'Close dialog',exact:true}).click();
  await page.getByRole('button',{name:'Back to sessions',exact:true}).click();await settle(700);
  await nav('Nutrition').click();await settle(500);
  await page.locator('.nutrition-plan-disclosure > summary').click();await settle(400);
  await page.getByRole('button',{name:'Log planned Breakfast',exact:true}).click();await settle(450);
  await page.getByRole('button',{name:/0\.5×/}).click();await settle(600);
  await page.getByRole('button',{name:/1\.5×/}).click();await settle(600);
  await page.getByRole('button',{name:'Log meal',exact:true}).click();await settle(700);
  await shot('04-nutrition','Fuel, without friction','Portions update their goal impact smoothly; confirmed meals update totals together. Editing and undo remain available.');
  await nav('Progress').click();await settle(700);
  const chart = page.getByRole('slider').first();
  if(await chart.count()){await chart.focus();await chart.press('Home');await settle(450);await chart.press('ArrowRight');await settle(450);}
  await shot('05-progress','Explore the real trend','Chart reveal is remembered. Scrubbing and keyboard input expose the actual underlying records.');
  await context.close();
  await copyFile(await page.video().path(),`${output}/client-motion.webm`);
  try { execFileSync('ffmpeg', ['-y','-i',`${output}/client-motion.webm`,'-c:v','libx264','-crf','24','-preset','fast','-pix_fmt','yuv420p','-movflags','+faststart','-an','-loglevel','error',`${output}/client-motion.mp4`]); videoFile = 'client-motion.mp4'; } catch {}

  const coachContext=await browser.newContext({viewport:{width:1440,height:950}});
  const coach=await coachContext.newPage();
  await coach.addInitScript(()=>sessionStorage.setItem('avalen.editorial.splash','seen'));
  await coach.goto('http://127.0.0.1:5173/');await coach.getByRole('button',{name:'Explore demo'}).click();
  await coach.getByLabel('Workspace role').selectOption('coach');
  await coach.locator('aside nav').getByRole('button',{name:'Clients',exact:true}).click();
  await coach.getByRole('tab',{name:'Needs attention',exact:true}).click();await coach.waitForTimeout(400);
  await coach.getByRole('tab',{name:'All',exact:true}).click();await coach.waitForTimeout(400);
  await coach.screenshot({path:`${output}/06-coach.png`,fullPage:false});
  screenshots.push({file:'06-coach.png',title:'Calm, efficient coaching',description:'Client filters and evidence disclosures keep visual continuity while existing review and management workflows stay intact.'});
  await coachContext.close();
  await writeFile(`${output}/index.html`, `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Avalen · Motion refinement</title><style>*{box-sizing:border-box}body{background:#090909;color:#f5f5f5;font:15px system-ui;margin:0;padding:48px 6vw}header{max-width:800px}h1{font-size:clamp(38px,6vw,68px);line-height:1.05;letter-spacing:-.05em}p{color:#aaa;line-height:1.7}.eyebrow{font-size:11px;letter-spacing:.18em;color:#c3b197}a{color:#d1c2a8}video{display:block;width:390px;max-width:100%;max-height:85vh;margin:28px 0;background:#111;border:1px solid #333}main{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:36px 24px}article:last-child{grid-column:1/-1}h2{letter-spacing:-.025em}img{display:block;max-width:100%;max-height:1200px;border:1px solid #333}nav{display:flex;gap:24px;flex-wrap:wrap;margin-bottom:40px}@media(max-width:700px){body{padding:28px 20px}main{grid-template-columns:1fr}}</style><header><span class="eyebrow">AVALEN · MOTION REFINEMENT</span><h1>Feel the progress.</h1><p>A recording of the actual application: connected navigation, set confirmation, circular rest with pause and adjustment, an earned workout finish, portion changes, nutrition totals and progress exploration.</p><p>Captured in an isolated demo workspace. Demonstration records belong to this capture; your saved workspace was not changed.</p></header><nav><a href="/#/client/today">Open Avalen</a><a href="/output/ecosystem/index.html">Coaching workflows</a></nav><section><h2>Watch the client flow</h2><video controls playsinline preload="metadata" poster="02-logger.png" src="${videoFile}"></video></section><main>${screenshots.map((s,i)=>`<article><span class="eyebrow">${String(i+1).padStart(2,'0')}</span><h2>${s.title}</h2><p>${s.description}</p><a href="${s.file}" target="_blank"><img src="${s.file}" alt="${s.title}" loading="lazy"></a></article>`).join('')}</main></html>`);
  await writeFile(`${output}/screens.json`,JSON.stringify(screenshots,null,2));
  console.log(`Created motion walkthrough with ${screenshots.length} screens and client video.`);
} finally { await browser.close(); }
