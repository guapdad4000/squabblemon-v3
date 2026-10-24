import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
const origin=process.env.PVP_POPUP_ORIGIN ?? 'http://127.0.0.1:4245';
const output=process.env.PVP_POPUP_OUTPUT ?? 'screenshots/surrender-popup';
await mkdir(output,{recursive:true});
const browser=await chromium.launch(process.env.CHROMIUM_EXECUTABLE ? {executablePath:process.env.CHROMIUM_EXECUTABLE}:{});
const report=[];
async function openExit(page) {
  const arrival=page.getByTestId('pvp-exit');
  if(await arrival.isVisible()){await arrival.click();return;}
  const tools=page.locator('.battle-tools');
  if(!(await tools.evaluate(el=>el.open)))await page.getByLabel('Battle menu',{exact:true}).click();
  await tools.getByRole('button',{name:'Leave battle',exact:true}).click();
}
async function load(page,kind){
  await page.routeWebSocket('**',socket=>socket.close());
  await page.goto(`${origin}/e2e/pvp-exit.fixture.html?kind=${kind}`,{waitUntil:'domcontentloaded'});
  await page.getByTestId('online-battle').waitFor();
}
try {
  for(const kind of ['ranked','friend'])for(const [width,height] of [[1440,960],[390,844],[320,568],[667,375]]) {
    const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'}),page=await context.newPage();
    page.setDefaultTimeout(15000);
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await load(page,kind);await openExit(page);
    const dialog=page.getByRole('dialog',{name:'Leave this fade?'}),cancel=dialog.getByRole('button',{name:'Keep playing',exact:true});
    await expect(cancel).toBeFocused();await expect(dialog).toHaveAttribute('data-popup-family','confirmation');await expect(dialog).toHaveAttribute('data-popup-tone','destructive');
    assert.equal(await page.getByRole('dialog').count(),1,'Keep the existing single Radix dialog');
    const warning=`Surrendering gives The Opps the win${kind==='ranked'?' and records a ranked loss':''}. Closing the app or leaving does not pause the server turn clock.`;
    assert.equal(await dialog.locator('.game-popup__copy').innerText(),warning);
    await page.keyboard.press('Enter');await expect(dialog).toBeHidden();
    assert.equal(await page.evaluate(()=>window.pvpFixture.requests()),0,'Default Enter cancels without surrender');
    await openExit(page);await page.keyboard.press('Escape');await expect(dialog).toBeHidden();
    assert.equal(await page.evaluate(()=>window.pvpFixture.requests()),0,'Escape cancels without surrender');
    await openExit(page);await page.evaluate(()=>document.fonts.ready);
    const presentation=await dialog.evaluate(el=>{
      const title=el.querySelector('.game-popup__title'),copy=el.querySelector('.game-popup__copy'),action=el.querySelector('.reward-street-file__action'),r=el.getBoundingClientRect();
      return {titleColor:getComputedStyle(title).color,bodyColor:getComputedStyle(copy).color,titleShadow:getComputedStyle(title).textShadow,bodyShadow:getComputedStyle(copy).textShadow,legacyBackground:el.classList.contains('bg-background'),titleFont:getComputedStyle(title).fontFamily,bodyFont:getComputedStyle(copy).fontFamily,actionFont:getComputedStyle(action).fontFamily,sign:getComputedStyle(el).getPropertyValue('--popup-sign').trim(),fits:r.left>=0&&r.top>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1,noHorizontalScroll:el.scrollWidth<=el.clientWidth+1,buttons:[...el.querySelectorAll('button')].map(b=>({label:b.textContent.trim(),height:b.getBoundingClientRect().height}))};
    });
    assert.match(presentation.titleFont,/Blzee/);assert.match(presentation.bodyFont,/Plus Jakarta Sans/);assert.match(presentation.actionFont,/Hemi Head/);
    assert.equal(presentation.titleColor,'rgb(247, 237, 207)');assert.equal(presentation.bodyColor,'rgb(209, 215, 199)');assert.match(presentation.titleShadow,/2px 3px 0px/);assert.equal(presentation.bodyShadow,'none');assert.equal(presentation.legacyBackground,false,'Shared popup must not opt into the old generic-dialog text override');
    assert.equal(presentation.sign,'#a52d25');assert.ok(presentation.fits&&presentation.noHorizontalScroll,JSON.stringify(presentation));assert.ok(presentation.buttons.every(b=>b.height>=44));
    await dialog.evaluate(el=>el.scrollTop=0);await page.screenshot({path:join(output,`${kind}-${width}x${height}.png`)});
    await page.evaluate(()=>window.pvpFixture.holdSurrender());
    await dialog.getByRole('button',{name:'Surrender',exact:true}).click();
    const pending=dialog.getByRole('button',{name:'Surrendering…'});await expect(pending).toBeDisabled();await expect(cancel).toBeDisabled();
    await page.keyboard.press('Escape');await expect(dialog).toBeVisible();
    await dialog.getByRole('button',{name:'Close',exact:true}).click();await expect(dialog).toBeVisible();
    await pending.evaluate(button=>{button.click();button.click();});
    assert.equal(await page.evaluate(()=>window.pvpFixture.requests()),1,'A held surrender is submitted once');assert.equal(await page.evaluate(()=>window.pvpFixture.status()),'active');
    await page.evaluate(()=>window.pvpFixture.releaseSurrender());await expect(dialog).toBeHidden();await expect(page.getByTestId('park-result-dialog')).toBeVisible();
    assert.equal(await page.evaluate(()=>window.pvpFixture.status()),'complete');assert.equal(await page.evaluate(()=>window.pvpFixture.requests()),1);assert.deepEqual(errors,[]);
    report.push({kind,width,height,presentation,cancelFocus:true,enterAndEscapeCancel:true,pendingCannotDismissOrResubmit:true,errors});
    console.log(`${kind} ${width}x${height}: shared typography, cancel focus/keyboard, bounds, held surrender and single settlement passed.`);await context.close();
  }
  for(const kind of ['ranked','friend']){
    const page=await browser.newPage({viewport:{width:320,height:568},reducedMotion:'reduce'});await load(page,kind);await openExit(page);
    const dialog=page.getByRole('dialog',{name:'Leave this fade?'});
    await page.evaluate(()=>window.pvpFixture.fail(true));await dialog.getByRole('button',{name:'Surrender',exact:true}).click();
    await expect(dialog.getByRole('alert')).toContainText('Surrender could not be confirmed.');await expect(dialog.getByRole('alert')).toContainText('The server clock keeps running');
    if(kind==='ranked')await expect(dialog.getByRole('alert')).toContainText('a ranked loss is still possible');
    await page.evaluate(()=>window.pvpFixture.disconnect());await expect(dialog.getByRole('button',{name:'Surrender',exact:true})).toBeDisabled();
    const returnButton=dialog.getByRole('button',{name:/Return to .* without surrender confirmation/});await returnButton.scrollIntoViewIfNeeded();await expect(returnButton).toBeVisible();
    await page.screenshot({path:join(output,`${kind}-failed-offline-320.png`)});await returnButton.click();await expect(page.getByTestId('pvp-hub')).toBeVisible();
    assert.equal(await page.evaluate(()=>window.pvpFixture.requests()),1);assert.equal(await page.evaluate(()=>window.pvpFixture.status()),'active');
    report.push({kind,failureWarningRetained:true,offlineReturnDoesNotConfirmSurrender:true});await page.close();
  }
} finally {await browser.close();await writeFile(join(output,'verification.json'),JSON.stringify(report,null,2));}
