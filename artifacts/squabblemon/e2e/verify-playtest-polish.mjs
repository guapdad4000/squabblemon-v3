import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const origin=process.env.UI_ORIGIN ?? 'http://localhost:4198';
const browser=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
try {
 for (const width of [390,1440]) {
  const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin + '/e2e/polish-review.fixture.html');
  await page.getByRole('heading',{name:'Earn your hands.'}).waitFor();
  assert.equal(await page.locator('.career-stage__mastery').count(),4);
  assert.equal(await page.locator('.career-stage__mastery').first().locator('strong').innerText(),'Plug');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:`/tmp/mastery-polish-${width}.png`,fullPage:true});
  await page.addInitScript(()=>{window.__sounds=[];const NativeAudio=window.Audio;window.Audio=class extends NativeAudio {constructor(src){super(src);window.__sounds.push(src);}}});
  await page.goto(origin + '/e2e/polish-review.fixture.html?receipt');
  await page.getByTestId('market-purchase-success').waitFor();
  await page.waitForFunction(()=>window.__sounds.some(src=>src?.endsWith('/register.wav')));
  await page.goto(origin + '/e2e/rookie-road.fixture.html');
  await page.getByRole('button',{name:'Show the whole scene'}).waitFor();
  await page.getByRole('button',{name:'Show the whole scene'}).click();
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('.fade-mask')).backgroundColor === 'rgba(0, 0, 0, 0)');
  await page.getByRole('button',{name:'Focus this step'}).click();
  await page.screenshot({path:`/tmp/tutorial-polish-${width}.png`});
  assert.deepEqual(errors,[]);
  console.log(`PASS ${width}px: mastery, receipt audio, full-scene toggle, no runtime errors`);
  await page.close();
 }
 const page=await browser.newPage();
 await page.addInitScript(()=>{window.__sounds=[];const NativeAudio=window.Audio;window.Audio=class extends NativeAudio {constructor(src){super(src);window.__sounds.push(src);}}});
 await page.route('**/api/**', route=>route.request().url().includes('starter-mythic') ? route.fulfill({json:{state:'locked',ownsCard:false,chapters:[]}}) : route.fulfill({status:503,json:{error:'Fixture endpoint'}}));
 await page.goto(origin + '/e2e/polish-review.fixture.html?home');
 await page.locator('.safehouse-stage[data-scene-ready="true"]').waitFor({timeout:30000});
 await page.getByRole('button',{name:'Explore the heavy bag',exact:true}).click();
 await page.getByRole('button',{name:'Hit the bag',exact:true}).click();
 await page.waitForFunction(()=>window.__sounds.some(src=>src?.endsWith('/bag-hit.mp3')));
 console.log('PASS safehouse: real scene punch sends bag-hit sound to parent');
 await page.close();
} finally {await browser.close()}
