import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
const origin=process.env.UI_ORIGIN??'http://127.0.0.1:4245';
const output=process.env.FINALE_VIDEO_OUTPUT??'/tmp/pack-finale-video';
const filter=process.env.FINALE_VIDEO_CASE;
const selectedCases=filter?.split(',').map(name=>name.trim()).filter(Boolean);
const unmatchedCases=new Set(selectedCases);
await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/home/falcon/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const reports=[];let matched=false;
const mapping={SuperCommon:'neutral',Common:'neutral',Uncommon:'green',Rare:'blue',Epic:'purple',Legendary:'yellow',Mythical:'red'};
const film=(page,name)=>page.locator(`.pack-gym-finale__film[data-film=${name}]`);
const video=(page,name)=>film(page,name).locator('video');
async function hidden(page,value){await page.evaluate(hidden=>{Object.defineProperty(document,'hidden',{configurable:true,value:hidden});document.dispatchEvent(new Event('visibilitychange'));},value);}
async function start(page){await page.getByRole('button',{name:'Start',exact:true}).click();}
async function ready(page){await page.waitForFunction(()=>[...document.querySelectorAll('.pack-gym-finale video')].every(video=>video.readyState>=2));}
async function moving(page,name){await expect(film(page,name)).toHaveAttribute('data-video-state','playing');await expect.poll(()=>video(page,name).evaluate(video=>video.currentTime),{timeout:2500}).toBeGreaterThan(.05);return video(page,name).evaluate(video=>({time:video.currentTime,frames:video.getVideoPlaybackQuality().totalVideoFrames,rate:video.playbackRate}));}
async function fallback(page,name){await expect(film(page,name)).not.toHaveAttribute('data-video-state','playing');const state=await film(page,name).evaluate(node=>{const image=node.querySelector('img');return{state:node.dataset.videoState,opacity:getComputedStyle(node).opacity,poster:getComputedStyle(image).opacity,decoded:image.complete&&image.naturalWidth>0};});assert.equal(state.opacity,'1');assert.equal(state.poster,'1');assert.ok(state.decoded);return state;}
async function finished(page){await expect(page.getByLabel('Completions',{exact:true})).toHaveText('1',{timeout:10000});await expect(page.locator('.pack-gym-finale')).toHaveCount(0);await page.waitForTimeout(100);await expect(page.getByLabel('Completions',{exact:true})).toHaveText('1');}
async function run(name,options,body){
 if(selectedCases&&!selectedCases.includes(name))return;matched=true;unmatchedCases.delete(name);
 const viewport=options.viewport??{width:390,height:844};
 const context=await browser.newContext({viewport,...(options.record?{recordVideo:{dir:output,size:viewport}}:{})});
 const page=await context.newPage(),errors=[],requests=new Set(),removedRequests=[],cleanups=[];
 page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(request.url().includes('wall-impact.webp'))removedRequests.push(request.url());if(request.url().includes('/brand/gacha/video-flight-v1/'))requests.add(request.url().split('/').pop());});
 await page.routeWebSocket('**',socket=>socket.close());
 await page.addInitScript(()=>{
  const state=window.__films={plays:[],deferNext:false,rejectAll:false,deferred:null,pending:new Set(),videos:[]};
  const play=HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play=function(){
   if(this instanceof HTMLVideoElement){state.plays.push({src:this.getAttribute('src'),time:this.currentTime,at:performance.now()});
    if(state.rejectAll)return Promise.reject(new DOMException('Deterministic autoplay rejection','NotAllowedError'));
    if(state.deferNext){state.deferNext=false;return new Promise((resolve,reject)=>{state.deferred={resolve,reject};});}
   }
   return play.call(this);
  };
  const request=HTMLVideoElement.prototype.requestVideoFrameCallback,cancel=HTMLVideoElement.prototype.cancelVideoFrameCallback;
  if(request){let next=0;const ids=new WeakMap();HTMLVideoElement.prototype.requestVideoFrameCallback=function(callback){if(!ids.has(this))ids.set(this,++next);const id=ids.get(this);const handle=request.call(this,(...args)=>{state.pending.delete(`${id}:${handle}`);callback(...args);});state.pending.add(`${id}:${handle}`);return handle;};HTMLVideoElement.prototype.cancelVideoFrameCallback=function(handle){state.pending.delete(`${ids.get(this)}:${handle}`);return cancel.call(this,handle);};}
 });
 try{
  if(options.before)await options.before(page,cleanups);
  const params=new URLSearchParams({rarity:options.rarity??'Mythical',...(options.ten?{ten:'1'}:{}),...(options.reduced?{reduced:'1'}:{})});
  await page.goto(`${origin}/e2e/pack-finale-video.fixture.html?${params}`,{waitUntil:'domcontentloaded'});
  await expect(page.locator('.pack-gym-finale')).toHaveAttribute('data-active','false');
  await page.evaluate(()=>{window.__films.videos=[...document.querySelectorAll('.pack-gym-finale video')];});
  console.log(name);
  const result=await body(page,requests);
  assert.deepEqual(errors,[]);assert.deepEqual(removedRequests,[],'The removed wall cel is never fetched');
  assert.equal(await page.locator('.pack-gym-finale__wall,img[src*="wall-impact.webp"]').count(),0);
  reports.push({name,viewport,...result,noPageErrors:true});await writeFile(`${output}/video-lifecycle.json`,JSON.stringify(reports,null,2));
 }catch(error){await page.screenshot({path:`${output}/${name}-failure.png`}).catch(()=>{});throw error;}
 finally{for(const cleanup of cleanups)cleanup();await context.close();if(options.record)await page.video().saveAs(`${output}/${name}.webm`);}
}
try{
 for(const [rarity,color] of Object.entries(mapping))await run(`selection-${rarity}`,{rarity},async(page,requests)=>{
  await ready(page);await page.waitForTimeout(80);
  assert.deepEqual([...requests].sort(),[`pov-${color}.mp4`,`pov-${color}.webp`,'landing.mp4'].sort());
  const armed=await page.locator('.pack-gym-finale video').evaluateAll(videos=>videos.map(video=>({paused:video.paused,time:video.currentTime,muted:video.muted,inline:video.playsInline,preload:video.preload})));
  assert.deepEqual(armed,[0,1].map(()=>({paused:true,time:0,muted:true,inline:true,preload:'auto'})));
  assert.equal(await page.evaluate(()=>window.__films.plays.length),0);
  await page.getByRole('button',{name:'Change rarity',exact:true}).click();
  await expect(page.locator('.pack-gym-finale')).toHaveAttribute('data-rarity',rarity);
  assert.ok((await video(page,'pov').getAttribute('src')).endsWith(`pov-${color}.mp4`));
  return{rarity,selectedOnly:[...requests],armedPaused:true,receiptRarityFrozen:true};
 });
 for(const viewport of [{width:1440,height:1000},{width:390,height:844}])await run(`ready-${viewport.width}`,{viewport,rarity:'Mythical',ten:viewport.width===1440,record:true},async(page)=>{
  await ready(page);
  await expect(film(page,'landing').locator('img')).toHaveAttribute('src',/single-arrival-wall-v2\.webp$/);
  await expect.poll(()=>film(page,'landing').locator('img').evaluate(image=>image.complete&&image.naturalWidth>0)).toBe(true);
  await start(page);
  await expect(page.locator('.pack-gym-finale')).toHaveAttribute('data-stage','flight');
  const before=await page.locator('.pack-gym-finale__film').evaluateAll(nodes=>nodes.map(node=>getComputedStyle(node).opacity));assert.deepEqual(before,['0','0']);
  const pov=await moving(page,'pov');assert.ok(pov.frames>=2);assert.equal(pov.rate,1);
  const framing=await film(page,'pov').locator('img,video').evaluateAll(nodes=>nodes.map(node=>({fit:getComputedStyle(node).objectFit,position:getComputedStyle(node).objectPosition})));
  assert.deepEqual(framing,[0,1].map(()=>({fit:'cover',position:viewport.width/viewport.height<=.75?'30% 50%':'50% 50%'})),'Video and fallback preserve the same rarity-visible crop');
  await page.screenshot({path:`${output}/ready-${viewport.width}-pov.png`});
  if(viewport.width===1440){
   await hidden(page,true);await expect(page.locator('.pack-gym-finale')).toHaveAttribute('data-paused','true');
   await expect.poll(()=>video(page,'pov').evaluate(video=>video.paused)).toBe(true);
   const time=await video(page,'pov').evaluate(video=>video.currentTime);await page.waitForTimeout(220);
   assert.ok(Math.abs((await video(page,'pov').evaluate(video=>video.currentTime))-time)<.02);
   await hidden(page,false);await moving(page,'pov');
   assert.ok((await video(page,'pov').evaluate(video=>video.currentTime))>=time-.03,'Visible return resumes the clock, not the start of the film');
  }
  const landing=await moving(page,'landing');assert.ok(landing.frames>=2);assert.equal(landing.rate,1);
  assert.equal(await page.locator('.pack-gym-finale__wall').count(),0,'POV flows directly into the smoke/landing movie');
  assert.deepEqual(await page.locator('.pack-gym-finale__beat').evaluateAll(nodes=>nodes.map(node=>getComputedStyle(node).opacity)),['0','0','0'],'No opening cel flashes over the landing');
  await page.screenshot({path:`${output}/ready-${viewport.width}-landing.png`});
  // Pause the actual landing shot, not settle: settle and completion now share one boundary.
  await hidden(page,true);await expect(page.locator('.pack-gym-finale')).toHaveAttribute('data-stage','impact');await expect(page.locator('.pack-gym-finale')).toHaveAttribute('data-paused','true');
  await expect.poll(()=>video(page,'landing').evaluate(video=>video.paused)).toBe(true);
  const landingPause=await video(page,'landing').evaluate(video=>video.currentTime);await page.waitForTimeout(220);
  assert.ok(Math.abs((await video(page,'landing').evaluate(video=>video.currentTime))-landingPause)<.02);
  await expect(page.getByLabel('Completions',{exact:true})).toHaveText('0');
  assert.equal(await film(page,'landing').evaluate(node=>getComputedStyle(node).opacity),'1');
  const handoff=await page.locator('.pack-gym-finale__distance').evaluate(node=>{const image=node.querySelector('img'),style=getComputedStyle(image);return{src:image.getAttribute('src'),opacity:getComputedStyle(node).opacity,fit:style.objectFit,position:style.objectPosition,transform:getComputedStyle(node).transform};});
  assert.ok(handoff.src.endsWith('single-arrival-wall-v2.webp'));assert.deepEqual({...handoff,src:undefined},{src:undefined,opacity:'0',fit:'cover',position:'50% 50%',transform:'none'},'The matching arrival is prepared beneath the landing, without an extra visible still hold');
  await page.screenshot({path:`${output}/ready-${viewport.width}-landing-paused.png`});
  await hidden(page,false);await finished(page);
  const cleanup=await page.evaluate(()=>({allPaused:window.__films.videos.every(video=>video.paused),sourcesReleased:window.__films.videos.every(video=>video.getAttribute('src')===null),pendingFrames:window.__films.pending.size}));
  assert.deepEqual(cleanup,{allPaused:true,sourcesReleased:true,pendingFrames:0},'Natural completion unmounts the fixture and releases both films');
  return{actualDecodedPlayback:{pov,landing},framing,hiddenResume:viewport.width===1440,landingHiddenPause:true,handoff,cleanup,oneCompletion:true};
 });
 await run('rejected-play',{record:true,before:async page=>{await page.addInitScript(()=>{window.addEventListener('DOMContentLoaded',()=>{window.__films.rejectAll=true;});});}},async page=>{
  await ready(page);await start(page);await expect(page.locator('.pack-gym-finale')).toHaveAttribute('data-stage','flight-pov');await expect(film(page,'pov')).toHaveAttribute('data-video-state','failed');const pov=await fallback(page,'pov');
  await expect(page.locator('.pack-gym-finale')).toHaveAttribute('data-stage','impact');await expect(film(page,'landing')).toHaveAttribute('data-video-state','failed');const landing=await fallback(page,'landing');await finished(page);return{pov,landing,finiteCompletion:true};
 });
 await run('missing-video',{before:async page=>{await page.route('**/brand/gacha/video-flight-v1/*.mp4',route=>route.fulfill({status:404,body:''}));}},async page=>{
  await start(page);await expect(page.locator('.pack-gym-finale')).toHaveAttribute('data-stage','flight-pov');const pov=await fallback(page,'pov');await expect(page.locator('.pack-gym-finale')).toHaveAttribute('data-stage','impact');const landing=await fallback(page,'landing');await finished(page);return{pov,landing,finiteCompletion:true};
 });
 let releaseLate;
 await run('late-pov',{record:true,before:async(page,cleanups)=>{const held=new Promise(resolve=>{releaseLate=resolve;});cleanups.push(releaseLate);await page.route('**/brand/gacha/video-flight-v1/pov-*.mp4',async route=>{await held;await route.continue().catch(()=>{});});}},async page=>{
  await start(page);await expect(page.locator('.pack-gym-finale')).toHaveAttribute('data-stage','flight-pov');const pov=await fallback(page,'pov');
  await expect(page.locator('.pack-gym-finale')).toHaveAttribute('data-stage','impact');releaseLate();await page.waitForTimeout(300);
  assert.equal(await video(page,'pov').evaluate(video=>video.paused),true);assert.equal(await film(page,'pov').evaluate(node=>getComputedStyle(node).opacity),'0');
  assert.equal(await page.evaluate(()=>window.__films.plays.filter(play=>play.src?.includes('/pov-')).length),0,'An expired POV does not begin playing when delayed data arrives');
  const landing=await moving(page,'landing');await finished(page);return{pov,landing,lateArrivalDoesNotReplay:true};
 });
 await run('buffering-rejoin',{},async page=>{
  await ready(page);await start(page);await moving(page,'pov');
  const stalled=await video(page,'pov').evaluate(video=>{video.pause();video.dispatchEvent(new Event('waiting'));return video.currentTime;});
  await expect(film(page,'pov')).toHaveAttribute('data-video-state','playing');await page.waitForTimeout(220);
  const retained=await film(page,'pov').evaluate(node=>({video:getComputedStyle(node.querySelector('video')).opacity,poster:getComputedStyle(node.querySelector('img')).opacity,time:node.querySelector('video').currentTime}));
  assert.deepEqual({video:retained.video,poster:retained.poster},{video:'1',poster:'0'},'Buffering keeps the last displayed frame instead of flashing the poster');assert.ok(Math.abs(retained.time-stalled)<.02);
  await video(page,'pov').evaluate(video=>video.dispatchEvent(new Event('canplay')));
  const rejoined=await moving(page,'pov');assert.ok(rejoined.time>=stalled+.15,'Buffered video rejoins the visible clock instead of resuming stale media time');
  await page.getByRole('button',{name:'Skip pack animation',exact:true}).click();return{stalled,retained,rejoined,clockRejoin:true};
 });
 await run('stale-play-after-hide',{},async page=>{
  await ready(page);await page.evaluate(()=>{window.__films.deferNext=true;});await start(page);await page.waitForFunction(()=>window.__films.deferred!==null);
  await hidden(page,true);await expect(page.locator('.pack-gym-finale')).toHaveAttribute('data-paused','true');await hidden(page,false);
  await page.evaluate(()=>{const pending=window.__films.deferred;window.__films.deferred=null;pending.reject(new DOMException('Interrupted by pause','AbortError'));});
  const resumed=await moving(page,'pov');await expect(page.getByLabel('Completions',{exact:true})).toHaveText('0');await page.getByRole('button',{name:'Skip pack animation',exact:true}).click();return{resumed,staleRejectionIgnored:true};
 });
 for(const action of ['skip','dispose-pending'])await run(action,{},async page=>{
  await ready(page);if(action==='dispose-pending')await page.evaluate(()=>{window.__films.deferNext=true;});await start(page);
  if(action==='dispose-pending')await page.waitForFunction(()=>window.__films.deferred!==null);else await moving(page,'pov');
  if(action==='skip')await page.getByRole('button',{name:'Skip pack animation',exact:true}).click();else await page.getByRole('button',{name:'Unmount',exact:true}).evaluate(button=>button.click());
  await expect(page.locator('.pack-gym-finale')).toHaveCount(0);
  const plays=await page.evaluate(()=>window.__films.plays.length);
  await page.evaluate(()=>{const state=window.__films;if(state.deferred){state.deferred.reject(new DOMException('Disposed','AbortError'));state.deferred=null;}for(const video of state.videos)for(const name of['loadeddata','canplay','playing','error'])video.dispatchEvent(new Event(name));});
  await page.waitForTimeout(4700);await expect(page.getByLabel('Completions',{exact:true})).toHaveText('0');await expect(page.getByLabel('Skips',{exact:true})).toHaveText(action==='skip'?'1':'0');
  const disposed=await page.evaluate(()=>({allPaused:window.__films.videos.every(video=>video.paused),sourcesReleased:window.__films.videos.every(video=>video.getAttribute('src')===null),pendingFrames:window.__films.pending.size,plays:window.__films.plays.length}));assert.equal(disposed.allPaused,true);assert.equal(disposed.sourcesReleased,true);assert.equal(disposed.pendingFrames,0);assert.equal(disposed.plays,plays);return{disposed,lateEventsIgnored:true};
 });
 await run('reduced',{reduced:true},async(page,requests)=>{assert.equal(await page.locator('.pack-gym-finale video').count(),0);assert.deepEqual([...requests],[]);await start(page);await finished(page);return{noAnimatedMedia:true,oneCompletion:true};});
 assert.ok(matched,`Unknown FINALE_VIDEO_CASE: ${filter}`);assert.deepEqual([...unmatchedCases],[],`Unknown FINALE_VIDEO_CASE entries: ${[...unmatchedCases]}`);console.log(JSON.stringify(reports,null,2));
}finally{await browser.close();}
