import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
const output = process.env.REVIEW_OUTPUT ?? '/tmp/popup-system';
await mkdir(output,{recursive:true});
const browser = await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE,args:['--enable-unsafe-swiftshader']});
const report=[];
try {
 for(const [width,height] of [[1440,1000],[390,844],[320,568],[844,390]]) {
  const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${process.env.UI_ORIGIN??'http://127.0.0.1:4245'}/e2e/popup-system.fixture.html`);
  await page.evaluate(()=>document.fonts.ready);
  for(const family of ['reward','announcement','confirmation','recruit']) {
   await page.getByRole('navigation',{name:'Popup family'}).getByRole('button',{name:family,exact:true}).click();
   const opener=page.getByRole('button',{name:`Open ${family} preview`});await opener.click();
   const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();
   await page.evaluate(()=>document.fonts.ready);
   const audit=await dialog.evaluate(d=>{
    const r=d.getBoundingClientRect(),title=d.querySelector('h2'),copy=d.querySelector('.game-popup__copy');
    return {fits:r.x>=0&&r.y>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,noOverflow:d.scrollWidth<=d.clientWidth+1,titleFont:getComputedStyle(title).fontFamily,titleWeight:getComputedStyle(title).fontWeight,bodyFont:getComputedStyle(copy).fontFamily,buttons:[...d.querySelectorAll('button')].map(b=>({text:b.textContent,height:b.getBoundingClientRect().height})),fontsReady:document.fonts.check('700 32px "Hemi Head Italic"')&&document.fonts.check('700 32px "Hemi Head"')};
   });
   assert.ok(audit.fits&&audit.noOverflow,JSON.stringify({family,width,audit}));assert.ok(audit.fontsReady);
   assert.match(audit.titleFont,family==='reward'?/Hemi Head Italic/:/Blzee/);assert.equal(audit.titleWeight,family==='reward'?'700':'400');assert.match(audit.bodyFont,/Plus Jakarta Sans/);
   assert.ok(audit.buttons.every(b=>b.height>=44),JSON.stringify(audit.buttons));
   if(family==='confirmation') await expect(dialog.getByRole('button',{name:'Keep playing',exact:true})).toBeFocused();
   await dialog.screenshot({path:`${output}/${family}-${width}x${height}.png`});
   // Native dialog keeps page controls inert; Chromium may pass through browser chrome during wrapping.
   for(let i=0;i<5;i++){await page.keyboard.press('Tab');assert.ok(await dialog.evaluate(d=>d.matches(':modal') && (d.contains(document.activeElement) || document.activeElement===document.body)), 'Modal focus cannot reach the inert background');}
   await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();await expect(opener).toBeFocused();
   report.push({family,width,height,...audit});
  }
  assert.deepEqual(errors,[]);console.log(`PASS popup system ${width}×${height}: four families, font roles, focus, touch controls`);await page.close();
 }
} finally {await browser.close();await writeFile(`${output}/popup-system.json`,JSON.stringify(report,null,2));}
