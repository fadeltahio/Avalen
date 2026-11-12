import { chromium } from '@playwright/test';
import { fixture } from '../tests/helpers/service.js';
import { writeFile } from 'node:fs/promises';
const service = await fixture();
const browser = await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try {
  const page = await browser.newPage({viewport:{width:390,height:844}});
  await page.addInitScript(()=>sessionStorage.setItem('avalen.editorial.splash','seen'));
  await page.goto(`${service.base}/?connected=0`);
  await page.getByRole('button',{name:'Explore demo'}).click();
  await page.getByRole('button',{name:'Start Workout',exact:true}).click();
  await page.waitForTimeout(400);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.start');
  // Keep protocol/actionability polling out of the sample. These invoke the
  // actual React handlers on a paced schedule, without changing records directly.
  const samples = await page.evaluate(()=>new Promise(resolve=>{
    const frames=[],start=performance.now();let last;
    const paint=now=>{if(last)frames.push(now-last);last=now;if(now-start<4500)requestAnimationFrame(paint);else resolve(frames);};
    requestAnimationFrame(paint);
    const press=label=>[...document.querySelectorAll('button')].find(button=>button.getAttribute('aria-label')===label||button.textContent.trim()===label)?.click();
    setTimeout(()=>press('Log set 1'),300);
    setTimeout(()=>press('Pause rest'),1600);
    setTimeout(()=>press('+30s'),2300);
    setTimeout(()=>press('Resume rest'),3100);
  }));
  const {profile} = await cdp.send('Profiler.stop');
  await writeFile('/tmp/avalen-motion.cpuprofile',JSON.stringify(profile));
  samples.sort((a,b)=>a-b);
  const result={environment:'Production build, Chrome, 390×844, 4× CPU throttle, paced in-page button handlers; not a physical-device benchmark',frames:{samples:samples.length,medianMs:+samples[Math.floor(samples.length*.5)].toFixed(2),p95Ms:+samples[Math.floor(samples.length*.95)].toFixed(2),maxMs:+samples.at(-1).toFixed(2)},topCPU:profile.nodes.filter(node=>node.hitCount).sort((a,b)=>b.hitCount-a.hitCount).slice(0,12).map(node=>({name:node.callFrame.functionName,hits:node.hitCount,url:node.callFrame.url.split('/').at(-1),column:node.callFrame.columnNumber}))};
  await writeFile('output/motion/profile.json',JSON.stringify(result,null,2));
  console.log(JSON.stringify(result));
} finally {await browser.close();await service.close();}
