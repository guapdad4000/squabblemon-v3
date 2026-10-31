import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.env.ARCADE_BASE_URL ?? 'http://127.0.0.1:4257';
const output = process.env.REVIEW_OUTPUT ?? '/home/falcon/Documents/New project 9/output/raid-cinema-review/verification';
await mkdir(output,{recursive:true});
const browser = await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH ?? '/usr/bin/google-chrome',args:['--enable-unsafe-swiftshader']});
const report=[];
try {
 for(const mode of ['precinct','kumite']) {
  const page=await browser.newPage({viewport:{width:390,height:844}});
  await page.goto(`${base}/e2e/boss-raid.fixture.html?reset=1&demo=1&raid=${mode}`);
  await page.locator('.raid-cinema-hero').waitFor(); await page.evaluate(()=>document.fonts.ready); await page.waitForTimeout(1400);
  const sprite=page.locator('.raid-boss-figure .boss-idle');
  const source=()=>mode==='kumite'?sprite.locator('img').getAttribute('src'):sprite.locator('.boss-idle-frames').evaluate(n=>getComputedStyle(n).animationPlayState);
  const active=await source();
  if(mode==='kumite') assert(active.endsWith('boss-tier-1.webp')); else assert.equal(active,'running');
  await page.getByRole('button',{name:mode==='kumite'?'Inspect Kumite Grandmaster tiers':'Inspect Officer Oink tiers'}).click();
  await page.getByRole('dialog').waitFor();
  const inspected=await source();
  if(mode==='kumite') assert(inspected.endsWith('boss-tier-1-still.webp')); else assert.equal(await sprite.locator('.boss-idle-frames').evaluate(n=>getComputedStyle(n).animationName),'none');
  await page.keyboard.press('Escape'); await page.waitForTimeout(80);
  const restored=await source(); if(mode==='kumite') assert(restored.endsWith('boss-tier-1.webp')); else assert.equal(restored,'running');
  await sprite.evaluate(n=>n.style.transform='translateY(-2000px)'); await page.waitForTimeout(100);
  const offscreen=await source(); if(mode==='kumite') assert(offscreen.endsWith('boss-tier-1-still.webp')); else assert.equal(offscreen,'paused');
  await sprite.evaluate(n=>n.style.transform=''); await page.waitForTimeout(100);
  await page.emulateMedia({reducedMotion:'reduce'}); await page.waitForTimeout(100);
  const reduced=await source(); if(mode==='kumite') assert(reduced.endsWith('boss-tier-1-still.webp')); else assert.equal(await sprite.locator('.boss-idle-frames').evaluate(n=>getComputedStyle(n).animationName),'none');
  await page.emulateMedia({reducedMotion:'no-preference'}); await page.waitForTimeout(100);
  const frames=await page.evaluate(()=>new Promise(resolve=>{const times=[],start=performance.now();let last=start;const tick=now=>{times.push(now-last);last=now;if(now-start<2500)requestAnimationFrame(tick);else{times.shift();times.sort((a,b)=>a-b);resolve({samples:times.length,p50:times[Math.floor(times.length*.5)],p95:times[Math.floor(times.length*.95)],max:times.at(-1)});}};requestAnimationFrame(tick);}));
  await page.evaluate(()=>window.__raidUnmount()); assert.equal(await page.evaluate(()=>document.querySelectorAll('.boss-idle').length),0);
  report.push({mode,precinctAnimationName:mode==='precinct'?'none during inspection and reduced motion; running otherwise':undefined,viewport:'390x844',active,inspected,restored,offscreen,reduced,unmounted:true,frames});await page.close();
 }
 await writeFile(output+'/shared-lifecycle.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
} finally {await browser.close();}
