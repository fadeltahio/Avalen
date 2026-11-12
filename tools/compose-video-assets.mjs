import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
const root = '/Users/compucity/Desktop/Avalen Video Assets';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const page = await browser.newPage({ deviceScaleFactor: 2 });
const data = async (folder, file) => 'data:image/png;base64,' + (await fs.readFile(path.join(root, folder, file))).toString('base64');
const css = `*{box-sizing:border-box}body{margin:0;background:#0b1110;color:#eef3f0;font-family:Arial,Helvetica,sans-serif}h1,h2,p{margin:0}img{display:block}header{margin-bottom:34px}header p{color:#91a79c;font-size:17px;margin-top:12px}.eyebrow{font-size:13px;letter-spacing:3px;color:#84c8aa;text-transform:uppercase}h1{font-size:38px;font-weight:500;letter-spacing:-1.5px;margin-top:12px}.grid{display:grid;gap:28px 22px}.tile img{width:100%;border:1px solid #34423a;border-radius:18px}.tile p{font-size:15px;margin-top:13px;color:#bac8c0}.footer{font-size:12px;color:#859a8f;letter-spacing:1px;margin-top:30px}.hero{width:1920px;height:1080px;position:relative;overflow:hidden;background:radial-gradient(ellipse at 72% 48%,#1e3028 0%,#0c1511 40%,#080e0c 72%)}.brand{position:absolute;left:110px;top:90px;font-size:36px;letter-spacing:-1px}.copy{position:absolute;left:110px;top:350px;width:590px}.copy h1{font-size:72px;line-height:1.07;letter-spacing:-3px}.copy p{font-size:25px;line-height:1.5;color:#a6b7ad;margin-top:32px;max-width:510px}.phone{position:absolute;width:278px;padding:9px;background:#060908;border:1px solid #536259;border-radius:35px;box-shadow:0 34px 70px #0009}.phone img{width:100%;border-radius:26px}.hero .footer{position:absolute;left:110px;bottom:70px}.badge{position:absolute;bottom:70px;right:110px;font-size:13px;color:#859a8f}.desktop{position:absolute;width:1140px;left:710px;top:180px;padding:12px;border:1px solid #3e5146;border-radius:23px;background:#080d0b;box-shadow:0 30px 75px #0008}.desktop img{width:100%;border-radius:12px}`;
async function render(name, html, width, height) {
  await page.setViewportSize({ width, height });
  await page.setContent(`<html><head><style>${css}</style></head><body>${html}</body></html>`);
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(i=>i.decode())); });
  await page.screenshot({ path: path.join(root, '04 Overview', name + '.png') });
  console.log('Composed:', name);
}
async function board(name, folder, files, title, subtitle, columns, width, imageRatio) {
  let tiles = '';
  for (const file of files) tiles += `<div class="tile"><img src="${await data(folder,file)}"><p>${file.replace('.png','')}</p></div>`;
  const tileWidth=(width-112-22*(columns-1))/columns;
  const height=Math.ceil(56+134+Math.ceil(files.length/columns)*(tileWidth/imageRatio+59)+60);
  await render(name, `<main style="padding:56px"><header><span class="eyebrow">Avalen / image index</span><h1>${title}</h1><p>${subtitle}</p></header><div class="grid" style="grid-template-columns:repeat(${columns},1fr)">${tiles}</div><p class="footer">REAL APP CAPTURES · DEMONSTRATION DATA · USE INDIVIDUAL PNGS FOR VIDEO</p></main>`,width,height);
}
try {
  const mobile=(await fs.readdir(path.join(root,'01 Mobile screens'))).filter(f=>f.endsWith('.png')).sort();
  const desktop=(await fs.readdir(path.join(root,'02 Coach desktop'))).filter(f=>f.endsWith('.png')).sort();
  const cards=(await fs.readdir(path.join(root,'03 Share cards'))).filter(f=>f.endsWith('.png')).sort();
  await board('01 Client journey index','01 Mobile screens',mobile.slice(0,8),'The client journey','Welcome, training, nutrition, habits and progress.',4,1400,390/844);
  await board('02 Coaching and workout index','01 Mobile screens',mobile.slice(8),'Connected coaching','Results, membership, community, check-ins and coaching on mobile.',4,1400,390/844);
  await board('03 Desktop coach index','02 Coach desktop',desktop,'The coach workspace','Attention, planning, client reviews, memberships and your brand.',2,1600,1440/1000);
  await board('04 Share card index','03 Share cards',cards,'The work speaks for itself.','Real 1080 × 1920 exports with photographic backgrounds.',4,1400,1080/1920);
  const phone=async(file,left,top)=>`<div class="phone" style="left:${left}px;top:${top}px"><img src="${await data('01 Mobile screens',file)}"></div>`;
  await render('05 Client hero - 4K widescreen',`<div class="hero"><div class="brand">Λ &nbsp; Avalen</div><div class="copy"><div class="eyebrow">A more personal way forward</div><h1>Small steps.<br>Real progress.</h1><p>Your training, nutrition and coaching.<br>All in one place.</p></div>${await phone('01 Welcome.png',820,255)}${await phone('02 Today dashboard.png',1130,170)}${await phone('06 Progress overview.png',1440,255)}<div class="footer">THOUGHTFUL COACHING. MEANINGFUL PROGRESS.</div><div class="badge">Product preview · Demonstration data</div></div>`,1920,1080);
  await render('06 Coach hero - 4K widescreen',`<div class="hero"><div class="brand">Λ &nbsp; Avalen</div><div class="copy" style="top:300px;width:540px"><div class="eyebrow">Built around your clients</div><h1 style="font-size:65px">Know who<br>needs you.</h1><p style="max-width:450px">See what matters.<br>Make the next step personal.</p></div><div class="desktop"><img src="${await data('02 Coach desktop','01 Coach dashboard.png')}"></div><div class="footer">COACHING ON MOBILE AND DESKTOP.</div><div class="badge">Product preview · Demonstration data</div></div>`,1920,1080);
} finally { await browser.close(); }
