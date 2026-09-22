import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const origin = process.env.UI_ORIGIN ?? 'http://127.0.0.1:4197';
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL ?? 'msedge', headless: true });
try {
 const page = await browser.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
 for (const viewport of [{width:320,height:568},{width:390,height:844},{width:1440,height:900}]) {
  await page.setViewportSize(viewport);
  for (const mode of ['ranked-win','ranked-loss','ranked-draw','versus']) {
   await page.goto(origin+'/e2e/ui-polish.fixture.html?mode='+mode);
   const action=page.getByRole('button',{name:mode==='versus'?'Step into the field':'Back to Fade Park'});
   await action.waitFor(); await page.waitForTimeout(1600);
   const bounds=await action.boundingBox(); assert.ok(bounds && bounds.y>=0 && bounds.y+bounds.height<=viewport.height,mode+' action above fold');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   assert.equal(await page.locator('img').evaluateAll(imgs=>imgs.every(i=>i.complete&&i.naturalWidth>0)),true,'Art loads');
   if (mode!=='versus') { const award=await page.getByTestId('ranked-result').innerText();assert.match(award,mode==='ranked-loss'?/-15 RP/:mode==='ranked-draw'?/\+5 RP/:/\+25 RP/);if(mode==='ranked-loss')assert.ok(!award.includes('RANK UP!'));await page.getByRole('button',{name:'Inspect final board'}).click();assert.equal(await page.evaluate(()=>document.body.dataset.action),'inspect'); }
   await action.click();assert.equal(await page.evaluate(()=>document.body.dataset.action),mode==='versus'?'enter':'park');
  }
 }
 await page.goto(origin+'/e2e/ui-polish.fixture.html?mode=ladder');await page.getByText('The seven ranks').click();assert.equal(await page.locator('.rank-trophy').count(),7);await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto(origin+'/e2e/ui-polish.fixture.html?mode=ranked-win');await page.getByTestId('ranked-result').waitFor();assert.match(await page.getByTestId('ranked-result').innerText(),/120 total RP/);
 assert.deepEqual(errors,[]);console.log('PvP art verified: seven ranks, win/loss/draw, RP signs, promotion, loaded assets, actions above fold at 320/390/1440, reduced motion and versus entry.');
} finally {await browser.close();}
