import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.env.ARCADE_BASE_URL ?? 'http://127.0.0.1:4257';
const output = process.env.REVIEW_OUTPUT ?? '/home/falcon/Documents/New project 9/output/raid-cinema-review/verification';
await mkdir(output,{recursive:true});
const browser = await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH ?? '/usr/bin/google-chrome',args:['--enable-unsafe-swiftshader']});
const report=[];
try {
 for(const mode of ['precinct','kumite']) {
  const page=await browser.newPage({viewport:{width:390,height:844}}), errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`${base}/e2e/boss-raid.fixture.html?reset=1&demo=1&raid=${mode}`);
  await page.locator('.raid-field').waitFor(); await page.waitForTimeout(1300);
  // Synthetic dense formation, not a player/reward/balance claim. Reopening the
  // saved fixture renders every card through the ordinary shared battle view.
  await page.evaluate(()=>{
   const raid=window.__raid, source=raid.match.boards.flat().find(card=>card.owner==='cpu');
   if(!source) throw Error('fixture enemy absent');
   for(let lane=0;lane<3;lane++) for(let index=0;index<12;index++) raid.match.boards[lane].push({...structuredClone(source),instanceId:`stress-${lane}-${index}`,lane});
   localStorage.setItem('boss-raid-fixture',JSON.stringify(raid));
  });
  await page.goto(`${base}/e2e/boss-raid.fixture.html?demo=1&raid=${mode}`);
  await page.locator('.raid-cinema-hero').waitFor(); await page.waitForTimeout(1400);
  const counts=await page.evaluate(()=>({
   total:document.querySelectorAll('.raid-police .raid-npc').length,
   shown:[...document.querySelectorAll('.raid-police .raid-npc')].filter(node=>getComputedStyle(node).display!=='none').length,
   moving:[...document.querySelectorAll('.raid-police .raid-npc :is(.boss-idle-frames,.boss-idle-feds)')].filter(node=>getComputedStyle(node).animationPlayState==='running'&&getComputedStyle(node).animationName!=='none').length,
   still:[...document.querySelectorAll('.raid-police .raid-npc .dojo-motion img')].filter(node=>node.src.endsWith('-still.webp')).length,
  }));
  assert(counts.total>=36); assert(counts.shown<=12);
  if(mode==='kumite') assert(counts.still>=counts.total-counts.shown); else assert(counts.moving<=counts.shown);
  await page.getByRole('button',{name:/View all .*cards in/}).first().click();
  await page.locator('.raid-formation-dialog[open]').waitFor();
  assert(await page.locator('.raid-formation-card').count()>=12);
  await page.keyboard.press('Escape'); assert.deepEqual(errors,[]);
  report.push({mode,workload:'synthetic 37 enemy actors',counts,formationReachable:true,errors});
  await page.close();
 }
 await writeFile(output+'/dense-actors.json',JSON.stringify(report,null,2)); console.log(report);
} finally { await browser.close(); }
