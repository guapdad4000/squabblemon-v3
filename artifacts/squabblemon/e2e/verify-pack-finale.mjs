import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
const origin = process.env.UI_ORIGIN ?? 'http://127.0.0.1:4245';
const output = process.env.FINALE_OUTPUT ?? '/tmp/squabblemon-pack-finale';
await mkdir(output,{recursive:true});
const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/google-chrome',args:['--no-sandbox','--enable-unsafe-swiftshader']});
const report=[],impactOnly=process.env.FINALE_IMPACT_ONLY==='1',refinementOnly=process.env.FINALE_REFINEMENT_ONLY==='1';
try {
 for (const viewport of [{width:390,height:844},{width:1440,height:900}]) for(const ten of ((impactOnly||refinementOnly)?[true]:[false,true])) {
  const page=await browser.newPage({viewport}); const errors=[],mediaRequests=new Set();page.on('pageerror',e=>errors.push(e.message));page.on('request',request=>{if(/\/brand\/gacha\/(cinematic-v2|rarity-flight-v1|video-flight-v1)\//.test(request.url()))mediaRequests.add(request.url().split('/').pop());});
  // Read-only fixture instrumentation exposes real mesh state; production sources have no test API.
  await page.route('**/scenes/gym/scene.js',async route=>{const response=await route.fetch();await route.fulfill({response,body:await response.text()+`\nwindow.__finaleRead=()=>({z:heavyBagMesh.position.z,y:heavyBagMesh.position.y,visible:heavyBagMesh.visible,scale:heavyBagMesh.scale.x,fragments:finaleFragments.length,fov:camera.fov,cameraZ:camera.position.z,roll:camera.rotation.z,frame:animationFrame,jabs:jabFrames.size,stage:document.documentElement.dataset.finaleStage,rarity:finale?.rarity??armedRarity,cues:[...(finale?.sounds??[])],audioClips:AudioEngine.clips.size,renders:renderer.info.render.frame});`});});
  await page.addInitScript(()=>{window.__audioPlays=[];const original=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){window.__audioPlays.push({src:this.src,volume:this.volume,rate:this.playbackRate});return original.call(this);};});
  await page.goto(`${origin}/e2e/pack-finale.fixture.html?ten=${Number(ten)}&rarity=${ten?'Mythical':'SuperCommon'}&sound=1&premount=1`);
  await expect(page.getByRole('button',{name:'Arm',exact:true})).toBeEnabled({timeout:20000});
  const frame=page.frames().find(f=>f.url().includes('/scenes/gym/'));
  assert.ok(frame);
  const read=()=>frame.evaluate(()=>window.__finaleRead());
  const hidden=async value=>{await page.evaluate(hidden=>{Object.defineProperty(document,'hidden',{configurable:true,value:hidden});document.dispatchEvent(new Event('visibilitychange'));},value);await frame.evaluate(hidden=>{Object.defineProperty(document,'hidden',{configurable:true,value:hidden});document.dispatchEvent(new Event('visibilitychange'));},value);};
  await page.getByRole('button',{name:'Arm',exact:true}).click();
  await page.getByRole('button',{name:'Punch',exact:true}).click();await page.waitForTimeout(120);
  await page.getByRole('button',{name:'Punch',exact:true}).click();await page.waitForTimeout(120);
  assert.equal((await read()).stage,'idle');
  const freezeAt=stage=>page.evaluate(stage=>{
   const observer=new MutationObserver(()=>{if(document.querySelector('.pack-gym-finale')?.getAttribute('data-stage')!==stage)return;observer.disconnect();
    for(const target of [document,document.querySelector('iframe').contentDocument]){Object.defineProperty(target,'hidden',{configurable:true,value:true});target.dispatchEvent(new Event('visibilitychange'));}
   });observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['data-stage']});
  },stage);
  await freezeAt('compression');
  await page.getByRole('button',{name:'Punch',exact:true}).click();
  await expect(page.locator('.pack-gym-finale')).toHaveCount(1);
  await expect(page.locator('.pack-gym-finale')).toHaveAttribute('data-paused','true');
  await expect(page.locator('.pack-gym-finale')).toHaveAttribute('data-stage','compression');
  assert.equal(await page.locator('.pack-gym-finale img').evaluateAll(images=>images.every(image=>image.complete&&image.naturalWidth>0)),true,'impact artwork was decoded before the third punch');
  const portal=await page.locator('.pack-gym-finale').evaluate(e=>({body:e.parentElement===document.body,position:getComputedStyle(e).position,width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height,pointerEvents:getComputedStyle(e).pointerEvents}));
  assert.deepEqual(portal,{body:true,position:'fixed',width:viewport.width,height:viewport.height,pointerEvents:'auto'},'finale covers the actual viewport above HUD');
  const rarity=ten?'Mythical':'SuperCommon';assert.equal(await page.locator('.pack-gym-finale').getAttribute('data-rarity'),rarity);
  for(const stage of ['compression','contact','release']) {
   if(stage!=='compression'){await freezeAt(stage);await hidden(false);await expect(page.locator('.pack-gym-finale')).toHaveAttribute('data-stage',stage);await expect(page.locator('.pack-gym-finale')).toHaveAttribute('data-paused','true');}
   const beat=await page.locator(`.pack-gym-finale__${stage}`).evaluate(e=>({opacity:getComputedStyle(e).opacity,width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height,fit:getComputedStyle(e.firstElementChild).objectFit}));
   assert.deepEqual(beat,{opacity:'1',width:viewport.width,height:viewport.height,fit:'cover'});
   if(stage==='release')assert.equal(await page.locator('.pack-gym-finale__release>img').evaluate(e=>getComputedStyle(e).objectPosition),viewport.width/viewport.height<.75?'30% 50%':'50% 50%');
   await page.screenshot({path:`${output}/${stage}-${ten?'ten':'single'}-${viewport.width}.png`});
  }
  await hidden(false);
  await frame.waitForFunction(()=>window.__finaleRead().z < -1 && window.__finaleRead().z > -8);
  await hidden(true);const flight=await read();
  assert.equal(flight.stage,'flight');assert.ok(flight.z<-1);assert.equal(flight.visible,true);assert.equal(flight.frame,0);assert.equal(flight.jabs,0);
  assert.equal(await page.locator('.pack-gym-finale__caption').count(),0,'no visible caption clutter');
  await page.screenshot({path:`${output}/flight-${ten?'ten':'single'}-${viewport.width}.png`});
  await page.getByRole('button',{name:'Change speed',exact:true}).evaluate(button=>button.click());
  await page.waitForTimeout(250);assert.deepEqual(await read(),flight,'hidden document holds actual mesh state despite later speed preference');
  await expect(page.locator('.pack-gym-finale')).toHaveAttribute('data-stage','flight');
  assert.equal(await page.locator('.pack-gym-finale').evaluate(e=>e.style.getPropertyValue('--finale-speed')),'1','current opening speed remains frozen');
  await freezeAt('flight-pov');await hidden(false);await expect(page.locator('.pack-gym-finale')).toHaveAttribute('data-stage','flight-pov');await expect(page.locator('.pack-gym-finale')).toHaveAttribute('data-paused','true');
  assert.equal(await page.locator('.pack-gym-finale__film[data-film=pov]').evaluate(e=>getComputedStyle(e).opacity),'1');
  const pov=page.locator('.pack-gym-finale__film[data-film=pov]');
  const povMedia=await pov.locator('video').evaluate(video=>({src:video.getAttribute('src'),muted:video.muted,inline:video.playsInline,preload:video.preload,rate:video.playbackRate,paused:video.paused,fit:getComputedStyle(video).objectFit,position:getComputedStyle(video).objectPosition}));
  assert.ok(povMedia.src.endsWith(ten?'pov-red.mp4':'pov-neutral.mp4'));assert.deepEqual({...povMedia,src:undefined},{src:undefined,muted:true,inline:true,preload:'auto',rate:1,paused:true,fit:'cover',position:viewport.width/viewport.height<=.75?'30% 50%':'50% 50%'});
  assert.equal(await page.locator('.pack-gym-finale__flight-foot').count(),0,'The supplied fixed-cap POV replaces the separate illustrated parallax cap');
  await page.screenshot({path:`${output}/pov-${ten?'ten':'single'}-${viewport.width}.png`});
  await hidden(false);
  await frame.waitForFunction(()=>['burst','impact'].includes(window.__finaleRead().stage));
  await expect(page.locator('.pack-gym-finale')).toHaveAttribute('data-stage','impact');
  await hidden(true);const impact=await read();assert.equal(impact.visible,!ten);assert.equal(impact.fragments,ten?8:0);assert.ok(impact.z < -(ten?37:15),'physical flight distance uses the saved rarity');assert.equal(impact.rarity,rarity);assert.deepEqual(impact.cues,['bag-impact','travel-wind-launch-v3','chain-rattle','impact-cels']);
  assert.equal(await page.locator('.pack-gym-finale__wall,img[src*="wall-impact.webp"]').count(),0,'The supplied landing movie has no obsolete side-view impact still');
  assert.equal(await page.locator('.pack-gym-finale__film[data-film=landing]').evaluate(e=>getComputedStyle(e).opacity),'1','opaque landing film or its poster covers the previous scene');
  await page.screenshot({path:`${output}/impact-${ten?'ten':'single'}-${viewport.width}.png`});
  // The landing ends at the completion boundary: there is no separately painted settle hold.
  // Its matching arrival image is prepared beneath the film, never exposed before completion.
  const handoff=await page.locator('.pack-gym-finale__distance').evaluate(e=>({opacity:getComputedStyle(e).opacity,transform:getComputedStyle(e).transform,fit:getComputedStyle(e.firstElementChild).objectFit,position:getComputedStyle(e.firstElementChild).objectPosition,src:e.firstElementChild.getAttribute('src')}));
  assert.equal(handoff.opacity,'0');assert.equal(handoff.transform,'none');assert.equal(handoff.fit,'cover');assert.equal(handoff.position,'50% 50%');assert.ok(handoff.src.endsWith('single-arrival-wall-v2.webp'));
  await page.waitForTimeout(220);await expect(page.locator('.pack-gym-finale')).toHaveAttribute('data-stage','impact');await expect(page.locator('.pack-gym-finale')).toHaveAttribute('data-paused','true');await expect(page.getByLabel('Completions')).toHaveText('0');
  assert.deepEqual(await read(),impact,'hidden document pauses the landing and mesh without completing');
  assert.deepEqual([...mediaRequests].sort(),['compression.webp','release.webp','contact.webp','single-arrival-wall-v2.webp',`pov-${ten?'red':'neutral'}.mp4`,`pov-${ten?'red':'neutral'}.webp`,'landing.mp4',...(ten?['burst-foreground.webp']:[])].sort(),'only the chosen opening media is fetched');
  await hidden(false);
  try { await expect(page.getByLabel('Completions')).toHaveText('1'); } catch(error) { console.error(JSON.stringify({viewport,ten,errors,state:await page.evaluate(()=>({hidden:document.hidden,stage:document.querySelector('.pack-gym-finale')?.getAttribute('data-stage'),paused:document.querySelector('.pack-gym-finale')?.getAttribute('data-paused')})),scene:await read()}));throw error; }
  await expect(page.locator('.pack-gym-finale'),'fixture onComplete removes the finale immediately').toHaveCount(0);
  await frame.waitForFunction(()=>window.__finaleRead().stage==='done');
  assert.equal((await read()).fragments,0);assert.equal((await read()).fov,45);assert.equal(Math.abs((await read()).roll),0);const finished=await read();assert.equal(finished.frame,0);await page.waitForTimeout(100);assert.equal((await read()).renders,finished.renders,'finished finale stops render loop');await hidden(true);await hidden(false);await page.waitForTimeout(100);assert.equal((await read()).renders,finished.renders,'visibility does not restart a completed finale');await expect(page.getByLabel('Completions')).toHaveText('1');
  await page.getByRole('button',{name:'Arm',exact:true}).click();await frame.waitForFunction(()=>window.__finaleRead().stage==='idle');
  await frame.waitForFunction(previous=>window.__finaleRead().renders>previous,finished.renders);const reset=await read();assert.ok(reset.frame>0,'arm resumes the scene loop');assert.equal(reset.z,0);assert.equal(reset.scale,1);assert.equal(reset.visible,true);assert.equal(reset.fragments,0);
  assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  const audio=await frame.evaluate(()=>window.__audioPlays);assert.equal(audio.length,8,'two impact/rattle punches then four finite finale cues');assert.ok(audio.every(a=>a.src.includes('/audio/rarity-flight-v1/')&&a.rate===1&&a.volume<=1));
  report.push({viewport,ten,rarity,audio,flight,impact,reset,handoff,mediaRequests:[...mediaRequests],hiddenPause:true,oneCompletion:true,noPageErrors:true});await page.close();
 }
 if(!impactOnly) for(const viewport of [{width:320,height:740},{width:844,height:390}]) {
  const page=await browser.newPage({viewport,reducedMotion:'reduce'}),requests=[];page.on('request',request=>{if(/\/brand\/gacha\/(cinematic-v2|rarity-flight-v1|video-flight-v1)\//.test(request.url()))requests.push(request.url().split('/').pop());});await page.goto(`${origin}/e2e/pack-finale.fixture.html?ten=1&reduced=1`);
  await page.getByRole('button',{name:'Arm',exact:true}).click();
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
  await expect(page.locator('.pack-gym-finale')).toHaveAttribute('data-stage','settle');
  assert.equal(await page.locator('.pack-gym-finale__beat,.pack-gym-finale__foreground').count(),0,'reduced motion omits animated image requests');
  assert.deepEqual(requests,['single-arrival-wall-v2.webp']);
  assert.equal(await page.locator('.pack-gym-finale video').count(),0,'Reduced motion creates no video elements');
  const reducedStyle=await page.locator('.pack-gym-finale__distance').evaluate(e=>({animation:getComputedStyle(e).animationName,transform:getComputedStyle(e).transform,width:e.getBoundingClientRect().width}));
  assert.deepEqual(reducedStyle,{animation:'none',transform:'none',width:viewport.width});
  await page.screenshot({path:`${output}/reduced-${viewport.width}.png`});
  await page.getByRole('button',{name:'Unmount finale',exact:true}).evaluate(button=>button.click());await page.waitForTimeout(300);await expect(page.getByLabel('Completions')).toHaveText('0');
  report.push({viewport,reduced:true,staticImpact:true,unmountCancelled:true});await page.close();
 }
 // Hold the generated media response beyond the entire animation: saved rewards still complete.
 if(!impactOnly&&!refinementOnly) {
  const viewport={width:390,height:844},page=await browser.newPage({viewport});let releaseMedia;
  const heldMedia=new Promise(resolve=>{releaseMedia=resolve;});
  await page.route(/\/brand\/gacha\/(cinematic-v2|rarity-flight-v1|video-flight-v1)\//,async route=>{await heldMedia;await route.abort().catch(()=>{});});
  try {
   await page.goto(`${origin}/e2e/pack-finale.fixture.html`,{waitUntil:'domcontentloaded'});
   await expect(page.getByRole('button',{name:'Arm',exact:true})).toBeEnabled({timeout:20000});
   await page.getByRole('button',{name:'Arm',exact:true}).click();
   for(let hit=0;hit<3;hit++){await page.getByRole('button',{name:'Punch',exact:true}).click();if(hit<2)await page.waitForTimeout(120);}
   await expect(page.locator('.pack-gym-finale')).toHaveCount(1);
   const fallback=await page.locator('.pack-gym-finale__contact').evaluate(e=>({fallback:getComputedStyle(e,'::before').backgroundImage,decoded:[...e.querySelectorAll('img')].some(i=>i.complete&&i.naturalWidth>0)}));
   assert.equal(fallback.decoded,false);assert.ok(fallback.fallback.includes('radial-gradient'));
   await expect(page.getByLabel('Completions')).toHaveText('1',{timeout:10000});
   await expect(page.locator('.pack-gym-finale')).toHaveCount(0);
   report.push({viewport,heldMedia:true,transparentLightFallback:true,completionDoesNotWaitForMedia:true});
  } finally {releaseMedia();await page.close();}
 }
 if(!impactOnly&&!refinementOnly) for(const method of ['button','Escape']) {
  const page=await browser.newPage({viewport:{width:390,height:844}});
  await page.goto(`${origin}/e2e/pack-finale.fixture.html?skip=1`);
  await expect(page.getByRole('button',{name:'Arm',exact:true})).toBeEnabled({timeout:20000});
  await page.getByRole('button',{name:'Arm',exact:true}).click();
  for(let hit=0;hit<2;hit++){await page.getByRole('button',{name:'Punch',exact:true}).click();await page.waitForTimeout(120);}
  await page.frameLocator('iframe').locator('#webgl-container').click({position:{x:100,y:100}});
  await expect(page.locator('.pack-gym-finale')).toHaveAttribute('data-stage','flight');
  await expect(page.getByRole('button',{name:'Skip pack animation'})).toBeFocused();
  if(method==='button')await page.getByRole('button',{name:'Skip pack animation'}).click();else await page.keyboard.press('Escape');
  await expect(page.locator('.pack-gym-finale')).toHaveCount(0);await expect(page.getByLabel('Skips',{exact:true})).toHaveText('1');
  await page.keyboard.press('Escape');await page.waitForTimeout(6700);
  await expect(page.getByLabel('Skips',{exact:true})).toHaveText('1');await expect(page.getByLabel('Completions',{exact:true})).toHaveText('0');
  report.push({skip:method,once:true,naturalCompletionCancelled:true});await page.close();
 }
 await writeFile(`${output}/${refinementOnly?'refinement-browser':impactOnly?'impact-browser':'browser'}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
