import { chromium } from '@playwright/test';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const review=process.env.MEDIA_REVIEW_DIR;
assert(review,'MEDIA_REVIEW_DIR must point at retained before/after media');
const output=path.join(review,'browser');await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH??'/usr/bin/google-chrome',args:['--enable-unsafe-swiftshader']});
const report=[];
const clipRoute=/\/assets\/special-moves\/anunaki-[^/?]+\.mp4(?:\?.*)?$/;
try {
 const page=await browser.newPage({viewport:{width:1100,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const variant of ['before','after']) {
  const served=new Set();
  await page.route(clipRoute,async route=>{
   const asset=new URL(route.request().url()).pathname.replace(/^\//,'');
   served.add(asset);
   const bytes=await readFile(path.join(review,variant,asset));
   const range=/bytes=(\d+)-(\d*)/.exec(route.request().headers()['range']??'');
   const start=range?Number(range[1]):0,end=range&&range[2]?Math.min(Number(range[2]),bytes.length-1):bytes.length-1;
   await route.fulfill({status:range?206:200,contentType:'video/mp4',headers:{'accept-ranges':'bytes',...(range?{'content-range':`bytes ${start}-${end}/${bytes.length}`}:{})},body:bytes.subarray(start,end+1)});
  });
  await page.goto(`${process.env.ARCADE_BASE_URL??'http://127.0.0.1:4257'}/e2e/anunaki-moves-review.html`);
  for(const name of ['yakub','utu','enlil','nabu','anu','ninhursag','ereshkigal','inanna','caucus-mountaineer','enki']) {
   await page.locator('#character').selectOption(name);
   await page.waitForFunction(name=>{const v=document.querySelector('#source');return v?.src.includes(`anunaki-${name}-v1.mp4`)&&v.readyState>=2&&!v.seeking;},name);
   await page.evaluate(()=>{document.querySelector('#source').currentTime=1.25;});
   await page.waitForFunction(()=>{const v=document.querySelector('#source');return !v.seeking&&Math.abs(v.currentTime-1.25)<.05&&document.querySelector('#time').textContent.startsWith('1.25');});
   const stats=await page.evaluate(()=>{const c=document.querySelector('#cpu');const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let transparent=0;for(let i=3;i<d.length;i+=4)if(d[i]<10)transparent++;return {transparentFraction:transparent/(c.width*c.height),renderer:document.querySelector('#status').textContent};});
   assert(stats.transparentFraction>.01,`${name} must still key background`);
   await page.screenshot({path:path.join(output,`${name}-${variant}.png`),fullPage:true});
   report.push({name,variant,...stats});
  }
  assert.equal(served.size,10,`All ten ${variant} files must be served from retained review media`);
  await page.unroute(clipRoute);
 }
 assert.deepEqual(errors,[]);await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log('PASS: 10 before/after special clips decode and chromakey in browser; 20 screenshots.');
} finally {await browser.close();}
