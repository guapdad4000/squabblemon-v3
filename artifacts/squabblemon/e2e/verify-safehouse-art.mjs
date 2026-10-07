import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const origin=process.env.UI_ORIGIN ?? 'http://127.0.0.1:4195';
const browser=await chromium.launch({args:['--enable-unsafe-swiftshader']});
try {
  await mkdir('screenshots/safehouse-performance',{recursive:true});
  for(const [name,viewport] of [['desktop',{width:1440,height:960}],['phone',{width:390,height:844}]]) {
    const context=await browser.newContext({viewport});
    await context.addInitScript(()=>{
      localStorage.setItem('squabblemon_e2e_user','signed-in');
      sessionStorage.setItem('squabblemon-gpu-tier-v2','medium');
    });
    const page=await context.newPage();
    const requests=[];const errors=[];
    page.on('request',r=>requests.push(r.url()));
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/api/**',r=>r.fulfill({json:/\/(challenges\/runs|events\/patches)$/.test(r.request().url())?[]:{chapters:[],nodes:[],pending:[],items:[],messages:[],ids:[],state:'claimed',reward:{}}}));
    await page.goto(origin+'/game');
    await page.locator('.safehouse-stage[data-scene-ready="true"]').waitFor({timeout:30000});
    const frame=page.frames().find(f=>f.url().includes('/scenes/safehouse/'));
    await frame.waitForFunction(()=>performance.getEntriesByType('resource').filter(r=>r.name.includes('/assets/events/supplied/')).length===6);
    assert.equal(requests.filter(url=>/\/assets\/events\/supplied\/.*\.png$|\/safehouse\/concept\.png$/.test(url)).length,0);
    assert.equal(await frame.locator('link[rel="modulepreload"]').count(),1);
    await page.getByRole('button',{name:'Explore the bulletin board',exact:true}).click({force:true});
    await page.getByRole('button',{name:'Read the board',exact:true}).click();
    const dialog=page.getByTestId('dialog-bulletin');
    await dialog.waitFor({state:'visible'});
    await dialog.evaluate(async node=>{await Promise.all([...node.querySelectorAll('img')].map(img=>img.decode()));});
    assert.equal(await dialog.locator('img').evaluateAll(images=>images.filter(img=>!img.complete||!img.naturalWidth).length),0);
    assert.ok(await dialog.locator('img').evaluateAll(images=>images.some(img=>img.src.includes('/events/supplied/')&&img.src.endsWith('.webp'))));
    await page.screenshot({path:`screenshots/safehouse-performance/optimized-board-${name}.png`});
    await page.getByRole('button',{name:'Close bulletin board',exact:true}).click();
    await page.locator('.safehouse-stage[data-view="room"]').waitFor();
    await page.waitForTimeout(1000);
    const status=await frame.evaluate(()=>window.Squabblemon.getSceneStatus());
    assert.ok(status.drawCalls>0&&status.triangles>0);
    await page.screenshot({path:`screenshots/safehouse-performance/optimized-room-${name}.png`});
    assert.deepEqual(errors,[]);
    console.log('PASS',name,'rendered room, WebP assets, bulletin open/close, final room screenshot');
    await context.close();
  }
  for(const mode of ['reduce','static']) {
    const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:mode==='reduce'?'reduce':'no-preference'});
    const page=await context.newPage();
    const requests=[];
    page.on('request',r=>requests.push(r.url()));
    await page.goto(origin+`/e2e/gpu-quality.fixture.html?gpuTier=${mode==='static'?'static':'high'}&scene=safehouse`);
    await page.locator('.venue-scene.is-static').waitFor();
    await page.locator('.venue-scene__poster').evaluate(img=>img.decode());
    assert.equal(await page.locator('iframe').count(),0);
    assert.equal(requests.filter(url=>url.includes('/scenes/shared/three.module.js')).length,0);
    assert.ok((await page.locator('.venue-scene__poster').getAttribute('src')).endsWith('concept.webp'));
    console.log('PASS',mode,'preview loaded without a scene iframe or renderer download');
    await context.close();
  }
} finally {await browser.close();}
