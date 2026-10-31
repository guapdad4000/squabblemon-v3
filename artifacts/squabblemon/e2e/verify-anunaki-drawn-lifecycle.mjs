import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { mkdir,writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {createHash} from 'node:crypto';
const base=process.env.ARCADE_BASE_URL ?? 'http://127.0.0.1:4257';
const output=process.env.REVIEW_OUTPUT ?? '/home/falcon/Documents/New project 9/output/raid-cinema-review/verification/drawn-lifecycle';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH ?? '/usr/bin/google-chrome',args:['--enable-unsafe-swiftshader']});
const report={environment:'local Chromium controlled component fixture, 900x1000',phases:[],reactions:[],lifecycle:{}};
try {
 const page=await browser.newPage({viewport:{width:900,height:1000}}), errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>{
  const NativeObserver=window.IntersectionObserver, observers=new Map(), listeners=new Set();
  window.IntersectionObserver=class extends NativeObserver {
   constructor(...args){super(...args);observers.set(this,new Set());}
   observe(node){observers.get(this)?.add(node);super.observe(node);}
   unobserve(node){observers.get(this)?.delete(node);super.unobserve(node);}
   disconnect(){observers.get(this)?.clear();super.disconnect();}
  };
  const add=document.addEventListener.bind(document), remove=document.removeEventListener.bind(document);
  document.addEventListener=function(type,listener,...rest){if(type==='visibilitychange')listeners.add(listener);return add(type,listener,...rest);};
  document.removeEventListener=function(type,listener,...rest){if(type==='visibilitychange')listeners.delete(listener);return remove(type,listener,...rest);};
  window.__motionCounts=()=>({observed:[...observers.values()].reduce((sum,set)=>sum+set.size,0),visibilityListeners:listeners.size});
 });
 await page.goto(`${base}/e2e/anunaki-sprite.fixture.html`);
 const image=page.locator('[data-testid="sprite-stage"] .anunaki-motion img');
 const waitSource=async suffix=>{await page.waitForFunction(suffix=>{const img=document.querySelector('[data-testid="sprite-stage"] .anunaki-motion img');return img?.getAttribute('src')?.endsWith(suffix)&&img.complete&&img.naturalWidth>0;},suffix);return image.getAttribute('src');};
 for(const phase of ['idle','windup','strike','recoil']) {
  await page.getByRole('button',{name:phase,exact:true}).click();
  const source=await waitSource(`boss-anu-${phase}.webp`);
  const file=path.resolve('public',source.replace(/^\//,'')), metadata=await sharp(file,{animated:true}).metadata(), hashes=[];
  for(let frame=0;frame<(metadata.pages??1);frame++) hashes.push(createHash('sha256').update(await sharp(file,{page:frame}).raw().toBuffer()).digest('hex'));
  assert((metadata.pages??1)>=4);assert(new Set(hashes).size>=4,'authored clip contains different decoded cels');
  await page.getByRole('button',{name:'Pause sprite',exact:true}).click();
  const still=await waitSource(phase==='idle'?'boss-anu-still.webp':`boss-anu-${phase}-still.webp`);
  await page.getByRole('button',{name:'Pause sprite',exact:true}).click();await waitSource(`boss-anu-${phase}.webp`);
  await page.locator('[data-testid="sprite-stage"]').screenshot({path:`${output}/boss-${phase}.png`});
  report.phases.push({phase,source,still,width:metadata.width,height:metadata.pageHeight,pages:metadata.pages,uniqueDecodedFrames:new Set(hashes).size});
 }
 await page.emulateMedia({reducedMotion:'reduce'});await waitSource('boss-anu-recoil-still.webp');report.lifecycle.osReducedMotion=true;
 await page.emulateMedia({reducedMotion:'no-preference'});await waitSource('boss-anu-recoil.webp');
 await image.evaluate(node=>node.style.transform='translateY(-2000px)');await waitSource('boss-anu-recoil-still.webp');report.lifecycle.offscreen=true;
 await image.evaluate(node=>node.style.transform='');await waitSource('boss-anu-recoil.webp');
 const other=await browser.newPage();await other.goto('about:blank');await other.bringToFront();await page.waitForTimeout(100);
 const reallyHidden=await page.evaluate(()=>document.hidden);report.lifecycle.realBackgroundTabObserved=reallyHidden;
 if(reallyHidden) {await waitSource('boss-anu-recoil-still.webp');report.lifecycle.realBackgroundTabPaused=true;}
 await page.bringToFront();await waitSource('boss-anu-recoil.webp');await other.close();
 // Headless Chromium may leave both pages visible. Explicitly label this as a
 // synthetic visibility-event branch, not proof of operating-system tab hiding.
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
 await waitSource('boss-anu-recoil-still.webp');report.lifecycle.syntheticVisibilityEventPaused=true;
 await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});await waitSource('boss-anu-recoil.webp');
 await page.getByRole('button',{name:'Switch actor',exact:true}).click();const npcSource=await waitSource('yakub-idle.webp');
 await page.getByRole('button',{name:'Pause sprite',exact:true}).click();await waitSource('yakub-still.webp');
 await page.getByRole('button',{name:'Pause sprite',exact:true}).click();await waitSource('yakub-idle.webp');
 report.lifecycle.npc={source:npcSource,paused:true};
 const counts=await page.evaluate(()=>window.__motionCounts());assert.equal(counts.observed,1,'every actor shares the existing playback observer');
 await page.getByRole('button',{name:'Toggle mount',exact:true}).click();await page.waitForTimeout(50);
 const after=await page.evaluate(()=>window.__motionCounts());assert.equal(after.observed,0);assert.equal(after.visibilityListeners,0);report.lifecycle.unmount={before:counts,after};
 for(const reaction of await page.locator('[data-reaction-id]').all()) {
  const id=await reaction.getAttribute('data-reaction-id'), img=reaction.locator('img');
  await img.evaluate(node=>node.decode());const source=await img.getAttribute('src');assert(source.includes('anunaki-drawn-v2')&&source.endsWith('-animated.webp'));
  const metadata=await sharp(path.resolve('public',source.replace(/^\//,'')),{animated:true}).metadata();assert((metadata.pages??1)>=4);
  report.reactions.push({id,source,width:metadata.width,height:metadata.pageHeight,pages:metadata.pages,renderSize:await img.evaluate(node=>({width:node.getBoundingClientRect().width,height:node.getBoundingClientRect().height}))});
 }
 assert.equal(report.reactions.length,9);await page.getByRole('button',{name:'Still reactions',exact:true}).click();
 for(const img of await page.locator('[data-reaction-id] img').all()) assert(!(await img.getAttribute('src')).endsWith('-animated.webp'));
 await page.screenshot({path:`${output}/actual-reaction-art-stills.png`,fullPage:true});
 await page.getByRole('button',{name:'Still reactions',exact:true}).click();
 await page.screenshot({path:`${output}/actual-reaction-art-animated.png`,fullPage:true});
 await page.locator('section[aria-label="Drawn chat reactions"]').screenshot({path:`${output}/actual-reaction-art-grid.png`});
 await page.evaluate(()=>window.__spriteUnmount());assert.equal(await page.locator('.anunaki-motion').count(),0);assert.deepEqual(errors,[]);
 report.errors=errors;await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
} finally {await browser.close();}
