import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium, expect } from '@playwright/test';
import { entranceAnimations, settledEntrance } from './gacha-reveal-checks.mjs';
process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY='1';
const origin=process.env.UI_ORIGIN??'http://127.0.0.1:4245',output=process.env.GACHA_REVEAL_OUTPUT??'screenshots/gacha-reveal';
await mkdir(output,{recursive:true});
const quick=process.env.GACHA_REVEAL_QUICK==='1',motionOnly=process.env.GACHA_REVEAL_MOTION_ONLY==='1';
const viewports=motionOnly?[]:quick?[[390,844],[844,390]]:[[1440,900],[1920,1080],[390,844],[320,740],[844,390]];
const browser=await chromium.launch(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),report=[];
async function readyArt(scope){await scope.locator('img:visible').evaluateAll(async images=>{await Promise.race([Promise.all(images.map(image=>image.decode())),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Image decode timeout: '+images.filter(image=>!image.complete).map(image=>image.src).join(','))),10000))]);});}
try{
 for(const[width,height]of viewports){
  console.log(`Starting ${width}x${height}`);const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'}),errors=[];page.setDefaultTimeout(15000);page.on('pageerror',error=>errors.push(error.message));await page.routeWebSocket('**',socket=>socket.close());
  await page.goto(`${origin}/e2e/gacha-reveal.fixture.html`,{waitUntil:'domcontentloaded'});
  console.log('Navigated');const dialog=page.locator('dialog[open].gacha-reveal-dialog');await expect(dialog).toBeVisible();
  await expect(dialog.locator('.gacha-reveal__flip .collector-card')).toHaveCount(1);
  console.log('Card present');await readyArt(dialog.locator('.gacha-reveal__flip'));await page.evaluate(()=>Promise.race([document.fonts.ready,new Promise(resolve=>setTimeout(resolve,3000))]));console.log('Art ready');await readyArt(dialog.locator('.gacha-reveal__backdrop'));
  const cinematic=await dialog.locator('.gacha-reveal').evaluate(el=>{const arena=el.querySelector('.gacha-reveal__arena'),image=getComputedStyle(arena),style=getComputedStyle(el),flip=el.querySelector('.gacha-reveal__flip');return{src:arena.getAttribute('src'),fit:image.objectFit,position:image.objectPosition,transform:image.transform,border:style.borderTopWidth,shadow:style.boxShadow,light:getComputedStyle(flip,'::after').animationName,card:getComputedStyle(flip.querySelector('.gacha-reveal__card-target')).animationName,decorations:flip.querySelector('.gacha-reveal__impact')!==null};});
  assert.ok(cinematic.src.endsWith('/single-arrival-wall-v2.webp'));assert.equal(cinematic.fit,'cover');assert.equal(cinematic.position,'50% 50%');assert.equal(cinematic.transform,'none');assert.equal(cinematic.border,'0px');assert.equal(cinematic.shadow,'none');assert.equal(cinematic.light,'none');assert.equal(cinematic.card,'none');assert.equal(cinematic.decorations,false);
  const single=await dialog.locator('.gacha-reveal__flip').evaluate(el=>{const r=el.getBoundingClientRect(),p=el.closest('.gacha-reveal__content').getBoundingClientRect();return{width:r.width,height:r.height,contained:r.left>=p.left&&r.right<=p.right+1&&r.top>=p.top-1&&r.bottom<=p.bottom+1};});
  assert.ok(single.contained,JSON.stringify(single));assert.ok(single.width>=(width>=1400?350:width<600?210:160),JSON.stringify(single));
  await expect(dialog.locator('.depth-reveal__burst,.gacha-results__impact')).toHaveCount(0);
  await page.screenshot({path:join(output,`reveal-${width}.png`)});
  await dialog.getByRole('button',{name:'View all 6',exact:true}).click();
  await expect(dialog.locator('.gacha-reveal__item')).toHaveCount(4);await expect(dialog.locator('.gacha-reveal__resources>button')).toHaveCount(2);
  await expect(dialog.locator('.gacha-reveal__resources')).toContainText('+125');await expect(dialog.locator('.gacha-reveal__resources')).toContainText('+5');
  await readyArt(dialog.locator('.gacha-reveal__grid'));
  const haul=await dialog.locator('.gacha-reveal__content').evaluate(el=>{const p=el.getBoundingClientRect();return{width:el.clientWidth,scrollWidth:el.scrollWidth,height:el.clientHeight,scrollHeight:el.scrollHeight,cards:[...el.querySelectorAll('.gacha-reveal__item')].map(card=>{const r=card.getBoundingClientRect();return{width:r.width,left:r.left,right:r.right,contained:r.left>=p.left-1&&r.right<=p.right+1};})};});
  assert.ok(haul.scrollWidth<=haul.width+1);assert.ok(haul.cards.every(card=>card.contained));if(width>=1400)assert.ok(haul.cards.every(card=>card.width>=280));
  await page.screenshot({path:join(output,`haul-${width}.png`)});
  await dialog.locator('.gacha-reveal__item').first().click();await expect(page.locator('.card-inspector-shell')).toBeVisible();
  await page.keyboard.press('Escape');await expect(page.locator('.card-inspector-shell')).toHaveCount(0);
  await expect(dialog).toBeVisible();await expect(dialog.locator('.gacha-reveal__item')).toHaveCount(4);
  console.log(`Passed ${width}x${height}`);assert.deepEqual(errors,[]);report.push({width,height,single,haul,cinematic,inspection:true,errors});await page.close();
 }
 if(!motionOnly){
 const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});await page.routeWebSocket('**',socket=>socket.close());
 await page.goto(`${origin}/e2e/gacha-reveal.fixture.html?phase=summary&count=60&cardsOnly=1`,{waitUntil:'domcontentloaded'});
 const dialog=page.locator('dialog[open]');await expect(dialog.locator('.gacha-reveal__item')).toHaveCount(60);await expect(dialog.locator('.gacha-reveal__guarantee')).toHaveCount(1);
 await dialog.locator('.gacha-reveal__item').last().scrollIntoViewIfNeeded();await dialog.locator('.gacha-reveal__item').last().click();await expect(page.locator('.card-inspector-shell')).toBeVisible();await page.keyboard.press('Escape');
 await expect(dialog.locator('.gacha-reveal__item')).toHaveCount(60);await page.screenshot({path:join(output,'haul-60-last-row.png')});
 report.push({sixtyRealCards:true,lastCardInspectable:true});await page.close();
 }
 const motion=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'no-preference'});await motion.routeWebSocket('**',socket=>socket.close());
 await motion.goto(`${origin}/e2e/gacha-reveal.fixture.html?count=60&pullSize=10&cardsOnly=1`,{waitUntil:'domcontentloaded'});
 const reveal=motion.locator('.gacha-reveal');await expect(reveal.locator('.gacha-reveal__foreground')).toHaveCount(1);
 await readyArt(reveal.locator('.gacha-reveal__backdrop'));
 const flip=reveal.locator('.gacha-reveal__flip');await entranceAnimations(flip);await readyArt(flip);
 const flight=await flip.evaluate(node=>{
  const target=node.querySelector('.gacha-reveal__card-target'),animation=target.getAnimations().find(animation=>animation.animationName==='gacha-card-arrival'),duration=animation.effect.getTiming().duration;
  animation.pause();
  const samples=[0,75,150,300].map(time=>{animation.currentTime=time;const style=getComputedStyle(target),box=target.getBoundingClientRect();return{time,opacity:style.opacity,width:box.width,height:box.height,transform:style.transform,z:style.transform==='none'?0:new DOMMatrix(style.transform).m43};});
  animation.currentTime=0;
  const caption=node.closest('.gacha-reveal__single').querySelector('.gacha-reveal__caption');
  return{samples,duration,iterations:animation.effect.getTiming().iterations,side:getComputedStyle(node).getPropertyValue('--entry-side').trim(),captionOpacity:getComputedStyle(caption).opacity};
 });
 assert.ok(flight.duration<=300);assert.equal(flight.iterations,1);assert.equal(flight.captionOpacity,'1');
 const settledWidth=flight.samples.at(-1).width;
 for(const sample of flight.samples){assert.equal(sample.opacity,'1','Every entrance frame has full opacity');assert.ok(sample.width>=settledWidth*.9&&sample.width<=settledWidth*1.12,'The card is near full-size from its first frame');assert.equal(sample.z,0,'The print never travels behind the native dialog plane');}
 await expect(reveal.getByRole('button',{name:'Next card',exact:true})).toBeEnabled();await expect(reveal.getByRole('button',{name:'View all 60',exact:true})).toBeEnabled();
 await motion.screenshot({path:join(output,'quick-entry-first-frame.png')});
 await flip.evaluate(node=>node.querySelector('.gacha-reveal__card-target').getAnimations().forEach(animation=>animation.finish()));
 const settled=await settledEntrance(flip,{contain:true});await motion.screenshot({path:join(output,'quick-entry-settled.png')});
 await expect(reveal.locator('.gacha-reveal__arena')).toHaveAttribute('src',/single-arrival-wall-v2\.webp$/);
 await flip.evaluate(node=>{window.__previousReveal=node;});
 await reveal.getByRole('button',{name:'Next card',exact:true}).click();await expect(flip).toHaveCount(1);await entranceAnimations(flip);
 assert.equal(await flip.evaluate(node=>node!==window.__previousReveal&&!window.__previousReveal.isConnected),true,'Next reward owns a fresh brief entrance');
 const nextSide=await flip.evaluate(node=>getComputedStyle(node).getPropertyValue('--entry-side').trim());assert.notEqual(nextSide,flight.side);await expect(reveal.locator('.gacha-reveal__receipt')).toContainText('+35');
 await flip.evaluate(node=>{window.__interruptedReveal=node;node.querySelector('.gacha-reveal__card-target').getAnimations().forEach(animation=>{animation.pause();animation.currentTime=75;});});
 await reveal.getByRole('button',{name:'Next card',exact:true}).click();await expect(reveal.locator('#gym-results-title')).toHaveText('3 / 60');assert.equal(await motion.evaluate(()=>window.__interruptedReveal.isConnected),false,'Next works during the short settle');
 await reveal.getByRole('button',{name:'View all 60',exact:true}).click();await expect(reveal.locator('.gacha-reveal__item')).toHaveCount(60);
 const haulAnimations=await reveal.locator('.gacha-reveal__item').evaluateAll(nodes=>nodes.flatMap(node=>node.getAnimations().filter(animation=>animation.animationName?.startsWith('gacha-')).map(animation=>animation.animationName)));
 assert.deepEqual(haulAnimations,[],'The haul has no added animation or stagger');await expect(reveal.locator('.gacha-reveal__impact')).toHaveCount(0);
 await motion.emulateMedia({reducedMotion:'reduce'});assert.ok((await reveal.locator('.gacha-reveal__item').evaluateAll(nodes=>nodes.map(node=>getComputedStyle(node).animationName))).every(name=>name==='none'));
 report.push({quickEntrance:{flight,settled,nextSide,interruptedEntranceRemoved:true,noImpactEffects:true,haulAnimations,reduced:true}});await motion.close();
}finally{await browser.close();await writeFile(join(output,'verification.json'),JSON.stringify(report,null,2));}
console.log(`PASS: ${report.length} selected reveal/haul cases; finite per-card motion.`);
