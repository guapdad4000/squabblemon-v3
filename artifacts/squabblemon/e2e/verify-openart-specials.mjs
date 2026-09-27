import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
const review=new URL('../../deliverables/openart-specials/review/',import.meta.url);
const audit=JSON.parse(await readFile(new URL('technical-audit.json',review),'utf8'));
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
const results=[], errors=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:1080}});
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://localhost:4211/e2e/openart-specials.fixture.html');
 await page.waitForFunction(()=>document.querySelector('#character').options.length===100);
 await page.evaluate(async()=>{
  const {createChromaRenderer}=await import('/src/lib/chromaRenderer.ts');
  const {keyChromaPixels}=await import('/src/specialMoves.ts');
  const gpu=document.createElement('canvas'),cpu=document.createElement('canvas'),copy=document.createElement('canvas');
  gpu.width=cpu.width=copy.width=288;gpu.height=cpu.height=copy.height=504;
  const key=p=>keyChromaPixels(p,'cyan');
  window.__auditRenderers={gpu,cpu,copy,g:createChromaRenderer(gpu,'move-cyan',key,true),c:createChromaRenderer(cpu,'move-cyan',key,false)};
 });
 for(const clip of audit.clips){
  await page.selectOption('#character',clip.catalogId);
  await page.waitForFunction(id=>{const v=document.querySelector('#source');const path=new URL(v.currentSrc||location.href).pathname;return v.readyState>=2&&!v.seeking&&(path.endsWith('/oa-'+id+'-v1.mp4')||path.endsWith('/'+id+'.mp4'))},clip.catalogId);
  const result=await page.evaluate(async({catalogId,duration})=>{
   const video=document.querySelector('#source'),r=window.__auditRenderers,samples=[];
   for(const fraction of [.04,.5,.94]){
    await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('Seek timed out')),6000);video.addEventListener('seeked',()=>{clearTimeout(timeout);resolve()},{once:true});video.currentTime=duration*fraction});
    r.g.draw(video);r.c.draw(video);
    const ctx=r.copy.getContext('2d',{willReadFrequently:true});ctx.clearRect(0,0,288,504);ctx.drawImage(r.gpu,0,0);
    const g=ctx.getImageData(0,0,288,504).data,c=r.cpu.getContext('2d').getImageData(0,0,288,504).data;
    let alphaMax=0,alphaError=0,rgbError=0,rgbCount=0,visible=0,clear=0;
    for(let i=0;i<g.length;i+=4){const d=Math.abs(g[i+3]-c[i+3]);alphaMax=Math.max(alphaMax,d);alphaError+=d;visible+=c[i+3]>240;clear+=c[i+3]<15;if(c[i+3]>240){for(let k=0;k<3;k++){rgbError+=Math.abs(g[i+k]-c[i+k]);rgbCount++}}}
    samples.push({t:video.currentTime,alphaMax,alphaMean:alphaError/(g.length/4),opaqueRgbMean:rgbError/Math.max(1,rgbCount),visiblePixels:visible,clearPixels:clear});
   }
   video.currentTime=0;await video.play();await new Promise(resolve=>setTimeout(resolve,250));const advanced=video.currentTime>0;video.pause();
   return {catalogId,renderer:r.g.kind,loaded:true,seeked:true,playbackAdvanced:advanced,samples};
  },clip);
  assert.equal(result.renderer,'gpu');assert.equal(result.playbackAdvanced,true);
  for(const s of result.samples){assert.ok(s.visiblePixels>20);assert.ok(s.alphaMean<.6,`${clip.catalogId} alpha differs: ${s.alphaMean}`);assert.ok(s.opaqueRgbMean<2,`${clip.catalogId} RGB differs: ${s.opaqueRgbMean}`)}
  results.push(result);if(results.length%10===0)console.log(`${results.length}/100 browser media + GPU/CPU comparison passed`);
 }
 // Exercise review controls; these do not approve a generation.
 await page.selectOption('#character','miami-surgeon');
 await page.waitForFunction(()=>document.querySelector('#source').readyState>=2&&!document.querySelector('#source').seeking);
 await page.selectOption('#backdrop','light');
 await page.check('#sound');assert.equal(await page.locator('#source').evaluate(v=>v.muted),false);
 await page.uncheck('#sound');assert.equal(await page.locator('#source').evaluate(v=>v.muted),true);
 await page.selectOption('#speed','0.5');assert.equal(await page.locator('#source').evaluate(v=>v.playbackRate),.5);
 await page.selectOption('#decision','repair');await page.fill('#notes','Verification-only note');await page.reload();
 await page.waitForFunction(()=>document.querySelector('#character').options.length===100);
 assert.equal(await page.inputValue('#notes'),'Verification-only note');
 await page.evaluate(()=>localStorage.removeItem('squabblemon.openart-specials-review.v1'));
 await page.screenshot({path:new URL('browser-miami-surgeon.png',review).pathname,fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.reload();
 await page.waitForFunction(()=>document.querySelector('#character').options.length===100);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,'Review page overflows mobile width');
 assert.deepEqual(errors,[]);
 await writeFile(new URL('browser-verification.json',review),JSON.stringify({passed:results.length,checks:'Load, seek and short playback on all 100; GPU/CPU at 3 timestamps each; mute, speed, note persistence and mobile width',errors,clips:results},null,2)+'\n');
 console.log('100/100 browser checks passed; no runtime errors; review controls and mobile width passed');
}finally{await writeFile(new URL('browser-verification-progress.json',review),JSON.stringify({tested:results.length,errors,clips:results},null,2)+'\n');await browser.close()}
