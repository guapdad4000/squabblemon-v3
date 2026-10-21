import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const out=process.env.MAT_MEDIA_OUTPUT??'/tmp/mat-media-checks';await mkdir(out,{recursive:true});
const b=await chromium.launch({headless:true}),results=[];
try{
for(const [name,url,width,height,dpr,fallback]of [
 ['gallery','player-mats/fixture.html',390,844,1,false],
 ['pvp','art-recovery/fixture.html?pvp&playerMat=signature-buddy&rivalMat=signature-guap',390,844,1,false],
 ['training','art-recovery/fixture.html?playerMat=signature-buddy',1280,800,1,false],
 ['gallery-retina','player-mats/fixture.html',390,844,3,false],
 ['webp-fallback','art-recovery/fixture.html?pvp&playerMat=signature-kyle&rivalMat=signature-guap',390,844,1,true],
 ['decode-recovery','art-recovery/fixture.html?pvp&playerMat=signature-kyle&rivalMat=signature-guap',390,844,1,false],
 ['default-portrait','art-recovery/fixture.html?pvp&playerMat=corner-store&rivalMat=civic-hill',390,844,1,false],
]){
 const p=await b.newPage({viewport:{width,height},deviceScaleFactor:dpr,reducedMotion:'reduce'});const errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400&&r.url().includes('/assets/player-mats/'))errors.push(r.url()+' '+r.status());});
 await p.addInitScript(()=>performance.setResourceTimingBufferSize(5000));
 // Exercise native <picture> selection with an unsupported preferred MIME type.
 if(fallback)await p.route('**/src/components/PlayerMatImage.tsx*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replaceAll('image/avif','image/x-review-unsupported')});});
 if(name==='decode-recovery')await p.route('**/assets/player-mats/**/*.avif',route=>route.fulfill({status:200,contentType:'image/avif',body:'deliberately invalid image'}));
 await p.goto('http://127.0.0.1:4228/e2e/'+url,{waitUntil:'networkidle'});
 if(name.startsWith('gallery')){
  await p.locator('.mat-card').first().waitFor();await p.locator('.mat-card img').evaluateAll(imgs=>imgs.forEach(i=>i.loading='eager'));
  await p.locator('.mat-card img').evaluateAll(async imgs=>await Promise.all(imgs.map(i=>i.decode())));
  for(const info of await p.locator('.mat-card img').evaluateAll(imgs=>imgs.map(i=>({src:i.currentSrc,width:i.naturalWidth})))){assert(info.src.endsWith('-thumb.avif'));assert.equal(info.width,640);}
 }else{
  await p.locator('.battle-player-mats').waitFor();if(name==='decode-recovery')await p.waitForFunction(()=>[...document.querySelectorAll('.battle-player-mats img')].every(i=>i.complete&&i.naturalWidth>0&&i.currentSrc.endsWith('.webp')));await p.locator('.battle-player-mats img').evaluateAll(async imgs=>await Promise.all(imgs.map(i=>i.decode())));
  if(name==='decode-recovery')await p.waitForFunction(()=>[...document.querySelectorAll('.battle-player-mats img')].every(i=>i.complete&&i.naturalWidth>0&&i.currentSrc.endsWith('.webp')));
  for(const src of await p.locator('.battle-player-mats img').evaluateAll(imgs=>imgs.map(i=>i.currentSrc)))assert(src.endsWith(fallback||name==='decode-recovery'?'.webp':'.avif'),src);
 }
 await p.waitForLoadState('networkidle');
 const requests=await p.evaluate(()=>performance.getEntriesByType('resource').filter(r=>/\.(avif|webp|png|jpg|jpeg)(\?|$)/.test(r.name)).map(r=>({url:new URL(r.name).pathname,bytes:r.encodedBodySize,transfer:r.transferSize,type:r.initiatorType})));
 const media=requests.filter(r=>r.url.includes('/assets/player-mats/'));assert(media.length>0);assert(media.every(r=>r.bytes>0),'uncached cold payload is measurable');if(name!=='decode-recovery')assert.equal(new Set(media.map(r=>r.url)).size,media.length,'one request per mat image');
 if(['pvp','training','webp-fallback'].includes(name))assert.equal(media.length,name==='training'?1:2,'one scene per background, no lane copies or cutouts');
 assert.deepEqual(errors,[]);await p.screenshot({path:`${out}/${name}.png`});
 results.push({name,width,height,dpr,fallback,requests,matBytes:media.reduce((n,r)=>n+r.bytes,0),imageBytes:requests.reduce((n,r)=>n+r.bytes,0)});await p.close();
}
await writeFile(`${out}/network-after.json`,JSON.stringify(results,null,2));console.log(results.map(({requests,...r})=>r));
}finally{await b.close();}
