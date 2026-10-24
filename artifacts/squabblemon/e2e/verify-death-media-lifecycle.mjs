import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
const origin = process.env.UI_ORIGIN ?? 'http://127.0.0.1:4242';
const output = process.env.DEATH_REPORT_DIR ?? 'screenshots/death-media';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const results = [], errors = [];
try {
 for (const [name, viewport] of [['phone', {width:390,height:844}], ['desktop', {width:1280,height:1000}]]) {
  for (const mode of ['ready', 'missing', 'slow']) {
   const page = await browser.newPage({viewport, reducedMotion:'no-preference'});
   page.on('pageerror', error => errors.push(error.message));
   await page.routeWebSocket('**', socket => socket.close());
   const pending = [];
   if (mode !== 'ready') await page.route('**/assets/combat/supplied/defeat-*-atlas.webp', route => {
    if (mode === 'missing') return route.fulfill({status:404,body:'missing'});
    return new Promise(resolve => pending.push(async () => { await route.continue(); resolve(); }));
   });
   await page.goto(`${origin}/e2e/pvp-effects.fixture.html`, {waitUntil:'domcontentloaded'});
   await page.getByTestId('battle-arena').waitFor();
   const arrival = page.getByRole('button',{name:'Step into the field'});
   if (await arrival.count()) await arrival.click();
   if (mode === 'ready') await page.waitForFunction(async () => (await import('/src/lib/battleDefeatMedia.ts')).isDefeatMediaReady());
   const started = Date.now();
   await page.getByRole('button',{name:'Queue two plays',exact:true}).click();
   const dead = page.getByTestId('destroyed-card').first();
   await dead.waitFor();
   assert.equal(await dead.getAttribute('data-defeat-media'), mode === 'ready' ? 'atlas' : 'fallback');
   const style = await dead.locator('img').evaluate(img => ({clip:getComputedStyle(img).clipPath,opacity:getComputedStyle(img).opacity}));
   if (mode === 'slow') { await Promise.all(pending.splice(0).map(release => release())); await page.waitForTimeout(250); }
   if (mode !== 'ready') {
    await page.waitForFunction(initial => { const img=document.querySelector('[data-testid="destroyed-card"] img'); return img && getComputedStyle(img).clipPath!==initial; }, style.clip, { timeout:2500 });
    const moved = await dead.locator('img').evaluate(img => ({clip:getComputedStyle(img).clipPath,opacity:getComputedStyle(img).opacity}));
    assert.notDeepEqual(moved,style,'The failed-media portrait animates rather than freezing');
    assert.equal(await dead.getAttribute('data-defeat-media'),'fallback','Late art never replaces the in-flight fallback');
    await page.waitForFunction(() => [...document.querySelectorAll('.defeat-fallback-final')].some(node=>getComputedStyle(node).visibility==='visible'));
    assert.equal(await dead.locator('.defeat-fallback-final').textContent(),'KO','A visible finale requires no image request');
    await page.screenshot({path:`${output}/${name}-${mode}-finale.png`});
   } else {
    await page.waitForFunction(() => [...document.querySelectorAll('.defeat-tombstone')].some(node=>getComputedStyle(node).visibility==='visible'));
    await page.screenshot({path:`${output}/${name}-authored-finale.png`});
   }
   await page.waitForFunction(() => !document.querySelector('[data-testid="character-attack"]'),{},{timeout:15000});
   const audit=JSON.parse(await page.getByTestId('pvp-effect-audit').textContent());
   await writeFile(`${output}/${name}-${mode}-audit.json`, JSON.stringify(audit,null,2));
   console.log(name, mode, 'queue completed', Date.now()-started);
   assert.ok(audit.entries.some(row=>row.actor==='cornball'),'The queued second play advances after the defeat');
   assert.ok(audit.entries.some(row=>row.event==='ghost-start'));
   // Cleanup is driven by the authoritative presentation timer. A loaded-browser
   // frame can coalesce the final animationend with unmount; the finale and queue
   // completion above are the visible behavior, not delivery of that DOM event.
   assert.equal(await page.getByTestId('destroyed-card').count(),0);
   results.push({name,mode,elapsedMs:Date.now()-started,audit});
   // Real presenter cleanup on hidden-return and the reduced-motion UI gate.
   if (mode === 'ready') {
    await page.getByRole('button',{name:'Reset',exact:true}).click();
    const entry = page.getByRole('button',{name:'Step into the field'}); if (await entry.count()) await entry.click();
    await page.getByRole('button',{name:'Queue two plays',exact:true}).click(); await page.getByTestId('destroyed-card').first().waitFor();
    await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
    await page.waitForFunction(()=>!document.querySelector('[data-testid="character-attack"]'));
    await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
    await page.waitForTimeout(100);assert.equal(await page.getByTestId('destroyed-card').count(),0);
    await page.getByRole('button',{name:'Reset',exact:true}).click();
    await page.getByLabel('Reduced motion',{exact:true}).check();
    await page.getByRole('button',{name:'Queue two plays',exact:true}).click(); await page.waitForTimeout(150);
    assert.equal(await page.getByTestId('character-attack').count(),0,'Reduced mode immediately presents final state');
    results.push({name,hiddenReturn:'clean',reducedMotion:'clean'});
   }
   await page.close();
  }
  const page = await browser.newPage({viewport,reducedMotion:'no-preference'});
  await page.routeWebSocket('**',socket=>socket.close());page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{
   window.__special={videos:[],pending:null,plays:0,pauses:0};
   const create=document.createElement;
   document.createElement=function(name,options){const element=create.call(this,name,options);if(name!=='video')return element;
    window.__special.videos.push(element);const play=element.play.bind(element),pause=element.pause.bind(element);
    element.play=()=>{window.__special.plays++;if(window.__special.plays===1)return new Promise((resolve,reject)=>{window.__special.pending={resolve,reject};});return play();};
    element.pause=()=>{window.__special.pauses++;return pause();};return element;
   };
  });
  await page.goto(`${origin}/e2e/special-move-lifecycle.fixture.html`);
  await page.waitForFunction(()=>window.__special.pending!==null);
  await page.evaluate(()=>{
   Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));
   delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));
   window.__special.pending.reject(new DOMException('Interrupted by pause','AbortError'));
  });
  await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.ready==='true');
  assert.equal(await page.getByTestId('status').textContent(),'Playing','A stale interrupted play must recover after return');
  const first=await page.evaluate(()=>window.__special.videos[0].currentTime);await page.waitForTimeout(150);
  assert.ok(await page.evaluate(first=>window.__special.videos[0].currentTime>first,first),'Recovered video actually progresses');
  await page.getByRole('button',{name:'Unmount',exact:true}).click();
  const released=await page.evaluate(()=>{const video=window.__special.videos[0];return {paused:video.paused,src:video.getAttribute('src'),handlers:[video.onplaying,video.onpause,video.onerror,video.onended].filter(Boolean).length};});
  assert.deepEqual(released,{paused:true,src:null,handlers:0});
  results.push({name,specialMove:'pending-play recovered and unmount cleaned'});await page.close();
  const failed = await browser.newPage({viewport,reducedMotion:'no-preference'});
  await failed.routeWebSocket('**',socket=>socket.close());failed.on('pageerror',error=>errors.push(error.message));
  await failed.route('**/*.mp4*',route=>route.fulfill({status:404,body:'missing'}));
  await failed.goto(`${origin}/e2e/special-move-lifecycle.fixture.html`);
  await failed.getByTestId('status').filter({hasText:'Clip unavailable'}).waitFor();
  assert.equal(await failed.getByTestId('special-move-canvas').getAttribute('data-ready'),'false');
  results.push({name,specialMove:'missing video clean fallback'});await failed.close();
 }
 assert.deepEqual(errors,[]);
 await writeFile(`${output}/death-media-lifecycle.json`,JSON.stringify({localFixture:true,results},null,2));
 console.log(JSON.stringify({pass:true,cases:results.map(({name,mode,specialMove,hiddenReturn,reducedMotion})=>({name,mode,specialMove,hiddenReturn,reducedMotion}))},null,2));
} finally { await browser.close(); }
