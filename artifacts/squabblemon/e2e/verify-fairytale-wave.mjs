import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
const origin=process.env.WAVE_ORIGIN ?? 'http://127.0.0.1:4197';
const browser=await chromium.launch({headless:true});
const errors=[];
try {
  for(const [width,height] of [[1280,900],[390,844],[320,740],[844,390]]) for(const online of [false,true]) {
    const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce',hasTouch:width<900});
    const page=await context.newPage(); page.on('pageerror',e=>errors.push(e.message));
    await page.goto(origin+'/e2e/battle-drag.fixture.html?fairytale'+(online?'&online':''));
    assert.match(await page.getByTestId('character-mark-0').innerText(),/Rival Take a Number/);
    assert.match(await page.getByTestId('character-mark-1').innerText(),/Rival Stakeout/);
    assert.match(await page.getByTestId('card-charge').innerText(),/2\/3/);
    await page.locator('[data-card-zone="hand"][data-card-id="dorothy"]').click();
    await page.getByTestId('lane-0').click();
    const confirm=page.getByTestId('button-lock'), total=Number((await confirm.innerText()).match(/(\d+) MOTION/i)[1]);
    const box=await confirm.boundingBox();assert(box && box.y>=0 && box.y+box.height<=height+1);
    assert(await confirm.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}));
    await confirm.click();
    await page.locator('[data-card-zone="hand"][data-card-id="bonnet-girl"]').waitFor();
    assert.equal(await page.locator('[data-card-zone="board"][data-card-id="bonnet-girl"]').count(),0);
    assert.equal(await page.locator('[data-card-kind="token"][data-card-id="cheshire"]').count(),1);
    assert.equal(Number(await page.getByTestId('motion-player').innerText()),9-total);
    assert.equal(await page.getByTestId('character-mark-0').count(),0);
    const target=page.locator('[data-card-zone="board"][data-card-id="hooper"]');
    const previous=await target.getAttribute('data-card-power');
    await page.locator('[data-card-zone="hand"][data-card-id="powerhouse"]').click();
    await page.getByTestId('lane-1').click();await confirm.click();
    await page.locator('[data-card-zone="board"][data-card-id="powerhouse"]').waitFor();
    assert.equal(await target.getAttribute('data-card-power'),previous);
    assert.equal(await page.getByTestId('character-mark-1').count(),0);
    await page.screenshot({path:'../../screenshots/fairytale-'+(online?'online-':'solo-')+width+'.png'});
    console.log((online?'PvP':'Solo')+' '+width+'x'+height+': bounce, Grin, exact tax, visible charge, consumed trap, reachable confirm');
    await context.close();
  }
  const page=await browser.newPage({viewport:{width:1440,height:1100}});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/e2e/battle-drag.fixture.html?gallery');
  await page.locator('.collector-portrait').last().waitFor();
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('.collector-portrait')).every(i=>i.complete && i.naturalWidth>0));
  assert.equal(await page.locator('.collector-portrait').count(),29);
  assert.equal(await page.locator('[data-card-variant="alternate"]').count(),8);
  await page.screenshot({path:'../../screenshots/fairytale-gallery.png',fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('Gallery: all 29 portraits loaded, all 8 alternate illustrations selected.');
} finally {await browser.close();}
