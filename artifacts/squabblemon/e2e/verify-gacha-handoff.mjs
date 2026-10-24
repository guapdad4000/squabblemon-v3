import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium,expect} from '@playwright/test';
const origin=process.env.UI_ORIGIN??'http://127.0.0.1:4245';
const output=process.env.GACHA_OUTPUT??'/tmp/gacha-handoff';
const phone=process.env.GACHA_CASE==='phone',expectPrepared=process.env.GACHA_EXPECT_PREPARED==='1';
const viewport=phone?{width:390,height:844}:{width:1440,height:1000};
await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/home/falcon/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
const context=await browser.newContext({viewport,recordVideo:{dir:output,size:viewport}});
const page=await context.newPage(),errors=[],network=[],cacheIds=new Set();
page.on('pageerror',error=>errors.push(error.message));
// No route/routeWebSocket calls: retain normal browser HTTP caching.
const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');
cdp.on('Network.requestServedFromCache',event=>cacheIds.add(event.requestId));
cdp.on('Network.responseReceived',event=>{if(event.type==='Image'||event.type==='Media')network.push({id:event.requestId,url:event.response.url,at:event.timestamp,fromDiskCache:!!event.response.fromDiskCache,status:event.response.status});});
await page.addInitScript(()=>{
 sessionStorage.setItem('squabblemon-gpu-tier-v2','low');
 localStorage.setItem('squabblemon_battle_speed','1.5');
 localStorage.setItem('squabblemon_battle_feedback',JSON.stringify({audioEnabled:false,hapticsEnabled:false}));
 if(window!==top)return;
 const proof=window.__handoff={states:[],frames:[],videoFrames:[],events:[],writes:[]};
 const write=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(this===sessionStorage&&/^squabblemon:pack-(request|reveal):e2e-player$/.test(key))proof.writes.push({key,at:performance.now(),value});return write.call(this,key,value);};
 window.addEventListener('message',event=>{if(event.origin===location.origin&&event.data?.channel==='squabblemon-scene')proof.events.push({at:performance.now(),...event.data});});
 const videos=new WeakSet(),nodeIds=new WeakMap();let nextId=0;const id=node=>{if(!node)return null;if(!nodeIds.has(node))nodeIds.set(node,++nextId);return nodeIds.get(node);};let sampling=false,revealAt=null,started=0,last='';
 const opacity=node=>node?getComputedStyle(node).opacity:null;
 const snapshot=()=>{
  const finale=document.querySelector('.pack-gym-finale'),dialog=document.querySelector('.gacha-reveal-dialog'),reveal=document.querySelector('.gacha-reveal'),landing=finale?.querySelector('[data-film=landing]'),video=landing?.querySelector('video'),arena=reveal?.querySelector('.gacha-reveal__arena'),portrait=reveal?.querySelector('.collector-portrait');
  const print=reveal?.querySelector('.gacha-reward-print'),shade=reveal?.querySelector('.gacha-reveal__backdrop>span'),target=reveal?.querySelector('.gacha-reveal__card-target');
  return{at:performance.now(),preparing:dialog?.dataset.preparing==='true',inert:!!dialog?.inert,ariaHidden:dialog?.getAttribute('aria-hidden'),focusInside:!!dialog?.contains(document.activeElement),revealId:id(reveal),printId:id(print),portraitId:id(portrait),arrivalAnimation:target?getComputedStyle(target).animationName:null,shadeBackground:shade?getComputedStyle(shade).backgroundImage:null,shadeAnimation:shade?getComputedStyle(shade).animationName:null,stage:finale?.dataset.stage??null,finale:!!finale,dialogOpen:!!dialog?.open,modal:!!dialog?.matches(':modal'),reveal:!!reveal,card:!!reveal?.querySelector('.gacha-reward-print'),landingOpacity:opacity(landing),landingState:landing?.dataset.videoState??null,videoOpacity:opacity(video),videoTime:video?.currentTime??null,videoEnded:video?.ended??null,distanceOpacity:opacity(finale?.querySelector('.pack-gym-finale__distance')),arenaReady:!!(arena?.complete&&arena.naturalWidth),portraitReady:!!(portrait?.complete&&portrait.naturalWidth),arenaOpacity:opacity(arena),shadeOpacity:opacity(reveal?.querySelector('.gacha-reveal__backdrop>span'))};
 };
 const tick=()=>{const state=snapshot();proof.frames.push(state);if(state.modal&&revealAt===null)revealAt=state.at;if(state.at-started<10000&&(revealAt===null||state.at-revealAt<1100))requestAnimationFrame(tick);};
 new MutationObserver(()=>{
  for(const video of document.querySelectorAll('.pack-gym-finale__film video'))if(!videos.has(video)){
   videos.add(video);const name=video.parentElement.dataset.film;
   for(const type of['playing','waiting','ended','pause','error'])video.addEventListener(type,()=>proof.events.push({type,film:name,at:performance.now(),mediaTime:video.currentTime}));
   const frame=(now,meta)=>{proof.videoFrames.push({film:name,at:now,mediaTime:meta.mediaTime,presentedFrames:meta.presentedFrames});if(video.isConnected)video.requestVideoFrameCallback(frame);};video.requestVideoFrameCallback(frame);
  }
  const state=snapshot(),key=JSON.stringify([state.stage,state.dialogOpen,state.modal,state.reveal,state.preparing,state.landingState]);
  if(key!==last){last=key;proof.states.push(state);}
  if(!sampling&&state.stage==='impact'){sampling=true;started=performance.now();requestAnimationFrame(tick);}
 }).observe(document,{childList:true,subtree:true,attributes:true,attributeFilter:['data-stage','data-video-state','open']});
});
try{
 await page.goto(`${origin}/e2e/gacha-cinematic.fixture.html`,{waitUntil:'domcontentloaded'});
 await expect(page.locator('.venue-scene.is-ready')).toBeVisible({timeout:30000});
 await page.getByRole('button',{name:'Open · 1 ticket',exact:true}).click();
 await expect(page.locator('.pack-gym-controls__strike')).toBeVisible();
 const receipt=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('squabblemon:pack-reveal:e2e-player')));
 for(let hit=1;hit<=3;hit++){
  await page.locator('.pack-gym-controls__strike').click();
  await page.waitForFunction(count=>window.__handoff.events.filter(event=>event.type==='hit').length>=count,hit);
  if(hit<3)await page.waitForTimeout(320);
 }
 await expect(page.locator('dialog.gacha-reveal-dialog:modal')).toBeVisible({timeout:10000});
 await page.waitForTimeout(1250);
 const proof=await page.evaluate(()=>({timeOrigin:performance.timeOrigin,...window.__handoff,resources:performance.getEntriesByType('resource').filter(entry=>/bodega-cat|normal-plate|normal-fist|single-arrival-wall|landing\.mp4/.test(entry.name)).map(entry=>({name:entry.name,startTime:entry.startTime,responseEnd:entry.responseEnd,transferSize:entry.transferSize,decodedBodySize:entry.decodedBodySize}))}));
 const sameReceipt=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('squabblemon:pack-reveal:e2e-player')));
 assert.deepEqual(sameReceipt,receipt);assert.equal(receipt.rewards.length,6);
 assert.deepEqual(proof.writes.map(write=>write.key),['squabblemon:pack-request:e2e-player','squabblemon:pack-reveal:e2e-player']);
 assert.equal(proof.events.filter(event=>event.type==='hit').length,3);assert.equal(proof.events.filter(event=>event.type==='complete').length,1);
 assert.ok(proof.videoFrames.some(frame=>frame.film==='landing'),'The real landing film presents decoded frames');
 assert.deepEqual(errors,[]);
 if(expectPrepared){
  const prepared=proof.states.find(state=>state.preparing),shown=proof.states.find(state=>state.modal);
  assert.ok(prepared&&shown,'The real card prepares before modal promotion');
  assert.equal(prepared.stage,'impact');assert.equal(prepared.modal,false);assert.equal(prepared.inert,true);assert.equal(prepared.ariaHidden,'true');assert.equal(prepared.focusInside,false);assert.equal(prepared.arrivalAnimation,'none');
  assert.ok(prepared.at<shown.at-500,'The paid card prepares during the opaque landing, not at its end');
  assert.equal(prepared.revealId,shown.revealId);assert.equal(prepared.printId,shown.printId);assert.equal(prepared.portraitId,shown.portraitId);
  assert.equal(shown.preparing,false);assert.equal(shown.inert,false);assert.equal(shown.portraitReady,true);assert.equal(shown.arenaReady,true);assert.equal(shown.arrivalAnimation,'gacha-card-arrival');
  assert.ok(shown.shadeBackground===null||shown.shadeBackground==='none');assert.ok(shown.shadeAnimation===null||shown.shadeAnimation==='none');
  const lastPresented=proof.videoFrames.filter(frame=>frame.film==='landing'&&frame.mediaTime>=2.5&&frame.at<=shown.at).at(-1);
  assert.ok(lastPresented,'The complete landing reaches its final presented frames');
  assert.ok(shown.at-lastPresented.at<200,'Card promotion follows the last presented landing frame without the old250ms hold');
  const preparedFrames=proof.frames.filter(frame=>frame.preparing&&frame.at<shown.at);
  assert.ok(preparedFrames.length>0);assert.ok(preparedFrames.every(frame=>frame.landingOpacity==='1'&&!frame.modal),'The prepared card cannot leak over the opaque landing');
  const firstShownFrame=proof.frames.find(frame=>frame.modal);assert.ok(firstShownFrame?.card&&firstShownFrame.arenaReady&&firstShownFrame.portraitReady);
 }

 const report={viewport,normalHttpCache:true,networkInterception:false,preparedHandoffChecked:expectPrepared,renderer:'SwiftShader; existing low GPU tier',...proof,network:network.map(entry=>({...entry,servedFromCache:cacheIds.has(entry.id)})),errors};
 await writeFile(`${output}/handoff.json`,JSON.stringify(report,null,2));
 await page.screenshot({path:`${output}/settled.png`});
 console.log(JSON.stringify({pass:true,states:proof.states,landingLastFrames:proof.videoFrames.filter(frame=>frame.film==='landing').slice(-4)},null,2));
}finally{
 await context.close();await page.video().saveAs(`${output}/opening.webm`);await browser.close();
}
