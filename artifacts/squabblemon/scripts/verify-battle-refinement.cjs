const { chromium } = require('@playwright/test');
const fs = require('node:fs');
const origin = process.env.BATTLE_PERF_ORIGIN || 'http://127.0.0.1:4198';
const output = process.env.REVIEW_OUTPUT || '/tmp/battle-refine-shots';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
 const results=[];fs.mkdirSync(output,{recursive:true});
 for(const width of [390,1440]) for(const theme of ['light','dark']) {
  const page=await browser.newPage({viewport:{width,height:width===390?844:1000},reducedMotion:'no-preference'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${origin}/?__battle_perf=1&motion=standard`);
  await page.waitForFunction(()=>window.__battlePerf?.ready);
  await page.evaluate(t=>{document.documentElement.classList.toggle('dark',t==='dark');document.documentElement.dataset.theme=t; window.__battlePerf.run();},theme);
  await page.waitForFunction(()=>document.querySelector('.attack-hit-shell circle'));
  await page.evaluate(()=>document.querySelectorAll('.attack-hit-shell').forEach(el=>el.getAnimations().forEach(a=>{a.pause();a.currentTime=140;})));
  const rings=await page.locator('.attack-hit').evaluateAll(nodes=>nodes.map(n=>({stroke:getComputedStyle(n).strokeWidth,inner:getComputedStyle(n.lastElementChild).strokeWidth,width:n.getBoundingClientRect().width})));
  if(!rings.length||rings.some(r=>parseFloat(r.stroke)>2.5||r.width<=0))throw Error('Impact geometry/stroke regression');
  await page.screenshot({path:`${output}/${width}-${theme}.png`});
  if(errors.length)throw Error(errors.join('\n'));
  results.push({width,theme,rings,errors});await page.close();
 }
 for (const fallback of [false,true]) {
 const page=await browser.newPage({viewport:{width:1000,height:800}});
 await page.addInitScript(fallback=>{ if(fallback) HTMLVideoElement.prototype.requestVideoFrameCallback=undefined; window.uploadCount=0; const upload=WebGLRenderingContext.prototype.texSubImage2D; WebGLRenderingContext.prototype.texSubImage2D=function(...args){window.uploadCount++;return upload.apply(this,args)}; },fallback);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`${origin}/moves?card=barber`);
 await page.locator('canvas[data-ready="true"]').waitFor({timeout:15000});
 for(let i=0;i<2;i++){await page.getByRole('button',{name:'Replay preview',exact:true}).click();await page.locator('canvas[data-ready="true"]').waitFor({timeout:10000});}
 await page.screenshot({path:`${output}/video-${fallback ? 'fallback' : 'native'}.png`});
 await page.waitForTimeout(200);
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
 const paused=await page.evaluate(()=>window.uploadCount);await page.waitForTimeout(250);
 if(await page.evaluate(()=>window.uploadCount)!==paused)throw Error('Video uploaded while hidden');
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));});
 await page.waitForFunction(n=>window.uploadCount>n,paused);
 if(errors.length)throw Error(errors.join('\n'));
 results.push({fallback,video:await page.locator('canvas').getAttribute('data-renderer'),visibilityResume:true,errors});
 await page.close(); } await browser.close();fs.writeFileSync(`${output}/browser.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results));
})().catch(e=>{console.error(e);process.exit(1)});
