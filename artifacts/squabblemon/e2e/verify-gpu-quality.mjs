import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';

const port='4193', origin=`http://127.0.0.1:${port}/squabblemon`;
const server=spawn(process.execPath,['../../node_modules/vite/bin/vite.js','--config','vite.config.ts','--host','127.0.0.1','--port',port],{
  env:{...process.env,PORT:port,BASE_PATH:'/squabblemon/',VITE_E2E_AUTH:'true'},stdio:'ignore'
});
let browser;
try {
  for(let i=0;i<80;i++){
    try { if((await fetch(`${origin}/e2e/gpu-quality.fixture.html`)).ok) break; } catch {}
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chromium'});
  await mkdir('../../screenshots/gpu-quality',{recursive:true});
  for(const tier of ['low','medium','high','static']){
    const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});
    await page.goto(`${origin}/e2e/gpu-quality.fixture.html?gpuTier=${tier}`);
    await page.locator(`[data-gpu-tier="${tier}"]`).waitFor();
    if(tier!=='static')await page.locator('[data-rendered="true"]').waitFor({timeout:20000});
    await page.screenshot({path:`../../screenshots/gpu-quality/card-and-box-${tier}.png`});
    assert.equal(await page.locator('[data-gpu-tier]').getAttribute('data-gpu-tier'),tier);
    await page.close();
    for(const scene of ['safehouse','gym']){
      const scenePage=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});
      const errors=[];
      scenePage.on('pageerror',error=>errors.push(error.message));
      await scenePage.goto(tier==='static'
        ? `${origin}/e2e/gpu-quality.fixture.html?gpuTier=static&scene=${scene}`
        : `${origin}/scenes/${scene}/index.html?gpuTier=${tier}`);
      if(tier==='static'){
        await scenePage.locator('.venue-scene.is-static').waitFor();
        assert.equal(await scenePage.locator('iframe').count(),0,'static must not allocate a WebGL scene');
      } else await scenePage.waitForFunction(scene=>scene==='safehouse'?
        !!window.Squabblemon?.getSceneStatus && !document.querySelector('#loading'):
        !!document.querySelector('#webgl-container canvas'),scene,{timeout:30000});
      await scenePage.screenshot({path:`../../screenshots/gpu-quality/${scene}-${tier}.png`});
      if(tier!=='static'){
        const width=await scenePage.locator('canvas').first().evaluate(canvas=>canvas.width);
        console.log(`${scene} ${tier}: drawing buffer width ${width}px at 390 CSS px`);
      }
      assert.deepEqual(errors,[],`${scene} ${tier}: ${errors.join('; ')}`);
      await scenePage.close();
      if(tier!=='static'){
        const parent=await browser.newPage({viewport:{width:390,height:844}});
        await parent.goto(`${origin}/e2e/gpu-quality.fixture.html?gpuTier=${tier}&scene=${scene}`);
        await parent.locator('.venue-scene.is-ready').waitFor({timeout:30000});
        assert.equal(await parent.locator('iframe').count(),1,`${scene} ${tier} handshake`);
        if(scene==='safehouse'&&tier==='medium'){
          await parent.frameLocator('iframe').locator('canvas').first().evaluate(canvas=>
            canvas.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
          await parent.getByRole('button',{name:'Reload scene'}).click();
          await parent.locator('.venue-scene.is-ready').waitFor({timeout:30000});
          console.log('PASS context loss displays reload and recovers');
        }
        await parent.close();
      }
    }
    console.log(`PASS ${tier}: card, deck box, safehouse, gym mobile screenshots`);
  }
  const unsupported=await browser.newPage({viewport:{width:390,height:844}});
  await unsupported.addInitScript(() => {
    const original=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(type,...args){
      if(type==='webgl2')return null;
      return original.call(this,type,...args);
    };
  });
  await unsupported.goto(`${origin}/e2e/gpu-quality.fixture.html?scene=safehouse`);
  await unsupported.locator('.venue-scene.is-static').waitFor();
  assert.equal(await unsupported.locator('iframe').count(),0,'unsupported WebGL2 falls back without a canvas');
  await unsupported.close();
  const reduced=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
  await reduced.goto(`${origin}/e2e/gpu-quality.fixture.html?gpuTier=high&scene=safehouse`);
  await reduced.locator('.venue-scene.is-static').waitFor();
  assert.equal(await reduced.locator('iframe').count(),0,'reduced motion overrides forced high');
  await reduced.close();
  console.log('PASS unsupported WebGL2 and reduced-motion static fallbacks');
  for(const mode of ['motion','unsupported']){
    const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:mode==='motion'?'reduce':'no-preference'});
    await context.addInitScript(({mode})=>{
      localStorage.setItem('squabblemon_e2e_user','signed-in');
      if(mode==='unsupported'){
        const original=HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext=function(type,...args){
          if(type==='webgl2')return null;
          return original.call(this,type,...args);
        };
      }
    },{mode});
    const page=await context.newPage();
    page.on('pageerror',error=>console.error('route error:',error.message));
    await page.route('**/api/**',route=>route.fulfill({status:503,contentType:'application/json',body:'{}'}));
    await page.goto(`${origin}/game`);
    await page.locator('.safehouse-stage[data-scene-fallback="static"]').waitFor({timeout:30000});
    const menu=page.getByRole('navigation',{name:'Explore the safehouse'});
    assert.equal(await menu.locator('button:visible').count(),11,`${mode} has all station controls`);
    await menu.getByRole('button',{name:/Explore the television/}).click();
    await page.locator('.safehouse-stage[data-view="story"]').waitFor();
    await page.getByRole('button',{name:'Back to the room'}).click();
    await page.locator('.safehouse-stage[data-view="room"]').waitFor();
    await page.screenshot({path:`../../screenshots/gpu-quality/safehouse-route-${mode}.png`});
    assert.equal(await page.locator('iframe[title="Interactive safehouse"]').count(),0,`${mode} opens no WebGL scene`);
    await context.close();
    console.log(`PASS returning-player Safehouse station navigation: ${mode}`);
  }
  for(const scene of ['safehouse','gym']){
    const page=await browser.newPage({viewport:{width:390,height:844}});
    await page.goto(`${origin}/scenes/${scene}/index.html?gpuTier=static`);
    await page.locator('[aria-label="Static scene preview"]').waitFor();
    assert.equal(await page.locator('canvas').count(),scene==='gym'?2:0,`${scene} standalone static has no renderer canvas`);
    await page.close();
  }
  console.log('PASS standalone static scenes do not allocate WebGL');
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}