const {chromium}=require('@playwright/test');const assert=require('node:assert/strict');const fs=require('node:fs');
const origin=process.env.TEST_BASE_URL || 'http://127.0.0.1:4212';const output=process.env.REVIEW_OUTPUT || '/tmp/today-effects-review';fs.mkdirSync(output,{recursive:true});
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});const results=[];
try {
for(const width of [390,1440])for(const theme of ['light','dark']) {
const page=await browser.newPage({viewport:{width,height:width===390?844:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(`${origin}/e2e/battle-mobile.fixture.html?effect`);await page.locator('.attack-hit-shell').first().waitFor({state:'attached'});
await page.evaluate(theme=>{document.documentElement.classList.toggle('dark',theme==='dark');document.querySelectorAll('.battle-choreography *').forEach(n=>n.getAnimations().forEach(a=>{a.pause();a.currentTime=140;}));},theme);
const hits=await page.locator('.attack-hit-shell').evaluateAll(ns=>ns.map(n=>{const star=n.querySelector('.attack-star');const svg=n.querySelector('svg');return{width:n.getBoundingClientRect().width,height:n.getBoundingClientRect().height,stroke:parseFloat(getComputedStyle(svg).strokeWidth),star:star?parseFloat(getComputedStyle(star).strokeWidth):null,points:star?.getAttribute('points')};}));assert.ok(hits.length>0);assert.ok(hits.every(h=>h.width>0&&h.width<400&&h.height>0&&h.stroke<=2.5&&h.star<=1.75&&h.points));
await page.screenshot({path:`${output}/${width}-impact-${theme}.png`});assert.deepEqual(errors,[]);results.push({width,theme,hits,errors});await page.close();
}
for(const fallback of [false,true]) {
const page=await browser.newPage({viewport:{width:1000,height:800}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(fallback=>{if(fallback)HTMLVideoElement.prototype.requestVideoFrameCallback=undefined;window.uploadCount=0;const upload=WebGLRenderingContext.prototype.texSubImage2D;WebGLRenderingContext.prototype.texSubImage2D=function(...a){window.uploadCount++;return upload.apply(this,a);};},fallback);
await page.goto(`${origin}/e2e/special-moves.fixture.html?card=barber`);await page.locator('canvas[data-ready="true"]').waitFor({timeout:15000});
for(let i=0;i<2;i++){await page.getByRole('button',{name:'Replay preview',exact:true}).click();await page.locator('canvas[data-ready="true"]').waitFor({timeout:15000});}
await page.screenshot({path:`${output}/video-${fallback?'fallback':'native'}.png`});
await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});const paused=await page.evaluate(()=>window.uploadCount);await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>window.uploadCount),paused);
await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));});await page.waitForFunction(n=>window.uploadCount>n,paused);assert.deepEqual(errors,[]);results.push({fallback,hiddenUploads:0,resumed:true,renderer:await page.locator('canvas').getAttribute('data-renderer'),errors});await page.close();
}
}finally{await browser.close();fs.writeFileSync(`${output}/browser.json`,JSON.stringify(results,null,2));}console.log(JSON.stringify(results,null,2));})().catch(e=>{console.error(e);process.exit(1);});
