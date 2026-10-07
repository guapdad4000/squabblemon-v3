import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const origin = process.env.UI_ORIGIN ?? 'http://127.0.0.1:4195';
const label = process.env.PERF_LABEL ?? 'after';
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
const results = [];
try {
  for (const [name, viewport] of [['desktop', {width:1440,height:960}], ['phone', {width:390,height:844}]]) {
    const context = await browser.newContext({viewport});
    await context.addInitScript(() => {
      localStorage.setItem('squabblemon_e2e_user', 'signed-in');
      const raf = window.requestAnimationFrame.bind(window);
      window.sceneCallbacks = 0;
      window.requestAnimationFrame = callback => raf(time => { window.sceneCallbacks++; callback(time); });
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/api/**', r => r.fulfill({json:r.request().url().endsWith('/challenges/runs') ? [] : {chapters:[],nodes:[],pending:[],items:[],messages:[],ids:[],state:'claimed',reward:{}}}));
    const started = Date.now();
    await page.goto(origin + '/game');
    await page.locator('.safehouse-stage[data-scene-ready="true"]').waitFor({timeout:30000});
    const readyMs = Date.now() - started;
    const frame = page.frames().find(f => f.url().includes('/scenes/safehouse/'));
    assert.ok(frame);
    const send = data => page.evaluate(data => document.querySelector('.safehouse-stage iframe').contentWindow.postMessage({channel:'squabblemon-scene',...data},location.origin),data);
    await page.waitForTimeout(1200);
    const sample = async () => {
      const a = await frame.evaluate(() => window.sceneCallbacks);
      await page.waitForTimeout(1000);
      return await frame.evaluate(() => window.sceneCallbacks) - a;
    };
    const activeCallbacks = await sample();
    await send({type:'mail-overlay',open:true});
    await page.waitForTimeout(1200);
    if(label === 'after') await frame.waitForFunction(() => !window.Squabblemon.getSceneStatus().animationPending);
    const pausedCallbacks = await sample();
    if(label === 'after') assert.equal(pausedCallbacks,0,'Overlay stops animation callbacks');
    for(let i=0;i<3;i++) {
      await send({type:'mail-overlay',open:false});
      await send({type:'view',view:'training'});
      await frame.waitForFunction(() => window.Squabblemon.getSceneStatus().view === 'training');
      await page.waitForTimeout(250);
      assert.ok(await sample() > 0,'Rendering resumes');
      await send({type:'mail-overlay',open:true});
      await page.waitForTimeout(1200);
      if(label === 'after') {
        await frame.waitForFunction(() => !window.Squabblemon.getSceneStatus().animationPending);
        assert.equal(await sample(),0);
      }
    }
    await send({type:'mail-overlay',open:false});
    await send({type:'view',view:'room'});
    await page.waitForTimeout(1200);
    const status = await frame.evaluate(() => window.Squabblemon.getSceneStatus());
    assert.ok(status.drawCalls > 0 && status.triangles > 0,'Visible room rendered');
    assert.equal(status.view,'room');
    assert.deepEqual(errors,[]);
    await mkdir('screenshots/safehouse-performance',{recursive:true});
    await page.screenshot({path:`screenshots/safehouse-performance/${label}-${name}.png`});
    results.push({name,readyMs,activeCallbacks,pausedCallbacks,drawCalls:status.drawCalls,triangles:status.triangles});
    console.log(JSON.stringify(results.at(-1)));
    await context.close();
  }
  await writeFile(`/tmp/safehouse-performance-${label}.json`,JSON.stringify(results,null,2));
} finally { await browser.close(); }
