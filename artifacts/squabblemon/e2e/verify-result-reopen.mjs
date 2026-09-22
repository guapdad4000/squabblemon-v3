import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';

const origin = process.env.UI_ORIGIN ?? 'http://127.0.0.1:23293';
const sizes = [[320,568],[390,844],[519,900],[1024,519]];
const browser = await chromium.launch();
try {
  for (const [width,height] of sizes) {
    const page = await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});
    await page.goto(`${origin}/e2e/result-stage.fixture.html?state=loss`);
    const panel = page.getByTestId('battle-result-screen');
    await panel.waitFor();
    const imgSrc = await page.evaluate(() => document.querySelector('.result-art__image').currentSrc);
    console.log(`At ${width}x${height}, image is: ${imgSrc.split('/').pop()}`);
    await panel.evaluate(element => { element.scrollTop = element.scrollHeight; });
    await page.getByTestId('button-inspect-final-board').click();
    const board = page.getByTestId('transformed-result-parent');
    await board.evaluate(element => { element.scrollTop = Math.floor(element.scrollHeight * .45); });
    const preservedBoardScroll = await board.evaluate(element => element.scrollTop);
    await page.getByRole('button',{name:'View result'}).click();
    await panel.waitFor();
    assert.equal(await panel.evaluate(element => element.scrollTop),0,`Local result did not reset at ${width}x${height}`);
    assert.equal(await board.evaluate(element => element.scrollTop),preservedBoardScroll,`Board scroll was not preserved at ${width}x${height}`);
    const exit = page.getByRole('button',{name:'Home'});
    await exit.scrollIntoViewIfNeeded();
    try {
      assert.ok(await exit.evaluate(element => {
        const rect=element.getBoundingClientRect();
        const hit=document.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2);
        if (!(rect.top>=0 && rect.bottom<=innerHeight && (hit===element || element.contains(hit)))) {
          console.log('DEBUG:', { top: rect.top, bottom: rect.bottom, innerHeight, hit: hit?.tagName, className: hit?.className });
        }
        return rect.top>=0 && rect.bottom<=innerHeight && (hit===element || element.contains(hit));
      }),`Local exit is clipped or occluded at ${width}x${height}`);
    } catch (e) {
      await page.screenshot({path:`screenshots/DEBUG-${width}x${height}.png`});
      throw e;
    }
    await exit.click();
    assert.equal(await page.evaluate(()=>document.body.dataset.action),'Home requested');
    await page.screenshot({path:`screenshots/result-reopen-local-${width}x${height}.png`});
    await page.goto(`${origin}/e2e/result-stage.fixture.html?flow=online`);
    const onlinePanel=page.locator('.park-result');
    await onlinePanel.waitFor();
    await onlinePanel.evaluate(element=>{element.scrollTop=element.scrollHeight;});
    await page.getByRole('button',{name:'Inspect final board'}).click();
    await page.getByRole('button',{name:'View result'}).click();
    await onlinePanel.waitFor();
    assert.equal(await onlinePanel.evaluate(element=>element.scrollTop),0,`Online result did not reset at ${width}x${height}`);
    const onlineExit=page.getByRole('button',{name:'Back to friend fades'});
    await onlineExit.scrollIntoViewIfNeeded();
    await onlineExit.click({trial:true});
    await onlineExit.click();
    assert.equal(await page.evaluate(()=>document.body.dataset.action),'Online exit');
    if(width===390 || height===519) await page.screenshot({path:`screenshots/result-reopen-online-${width}x${height}.png`});
    await page.close();
  }
} finally {
  await browser.close();
}