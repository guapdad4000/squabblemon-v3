import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const port=process.env.FOIL_PORT||'4189',origin='http://127.0.0.1:'+port+'/squabblemon';
const server=spawn(process.execPath,['../../node_modules/vite/bin/vite.js','--config','vite.config.ts','--host','127.0.0.1','--port',port],{env:{...process.env,PORT:port,BASE_PATH:'/squabblemon/',VITE_E2E_AUTH:'true'},stdio:'ignore',windowsHide:true});
const report={checks:[],errors:[]};let browser;
const pass=message=>{report.checks.push(message);console.log('PASS',message);};
const hash=b=>createHash('sha256').update(b).digest('hex');
try{
 await mkdir('../../screenshots/foil',{recursive:true});
 for(let i=0;i<60;i++){try{if((await fetch(origin+'/e2e/foil-studio.fixture.html')).ok)break;}catch{}await new Promise(r=>setTimeout(r,250));}
 browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'msedge'});
 const page=await browser.newPage({viewport:{width:1440,height:1050}});
  await page.addInitScript(()=>{
    const original=HTMLCanvasElement.prototype.getContext;
    window.foilContexts=new Set();
    HTMLCanvasElement.prototype.getContext=function(type,...args){
      const result=original.call(this,type,...args);
      if(type==='webgl'||type==='webgl2')window.foilContexts.add(this);
      return result;
    };
  });
 page.on('pageerror',error=>report.errors.push(error.message));
 page.on('console',event=>{if(event.type()==='error'&&/shader|WebGL|GLSL|React/i.test(event.text()))report.errors.push(event.text());});
 await page.goto(origin+'/e2e/foil-studio.fixture.html');
  const cssScreenshot=async (name,selector='.foil-stage__portrait')=>{
    await page.evaluate(()=>document.documentElement.dataset.reduceMotion='true');
    await page.waitForFunction(()=>!document.querySelector('.collector-webgl canvas'));
    await page.screenshot({path:`../../screenshots/foil/${name}-css.jpg`,type:'jpeg',quality:85,fullPage:true});
    await page.evaluate(()=>delete document.documentElement.dataset.reduceMotion);
    await page.locator(`${selector} .collector-webgl[data-foil-renderer=webgl] canvas`).first().waitFor();
    await page.screenshot({path:`../../screenshots/foil/${name}-webgl.jpg`,type:'jpeg',quality:85,fullPage:true});
  };
  for(const rarity of ['SuperCommon','Common','Uncommon','Rare','Epic','Legendary','Mythical']){
  await page.getByRole('button',{name:'Show '+rarity,exact:true}).click();
   await page.locator('.foil-stage__portrait .collector-webgl[data-foil-renderer=webgl] canvas').waitFor();
   assert.ok(await page.locator('.foil-lineup .collector-webgl[data-foil-renderer=webgl] canvas').count()>=7);
   assert.equal(await page.evaluate(()=>window.foilContexts.size),1,'All visible cards share one WebGL context');
 }
  pass('All seven catalog tiers, including SuperCommon, render in the visible grid through one GPU context.');
 await page.getByRole('button',{name:'Show Legendary',exact:true}).click();
  await cssScreenshot('lineup-legendary');
 const blockbusters=page.locator('[aria-label="Blockbuster full art"] .collector-portrait');
 assert.ok(await blockbusters.count()>0);
 for(const art of await blockbusters.all()) {
  assert.ok(await art.evaluate(el=>{const s=getComputedStyle(el);return s.objectFit==='contain' && s.transform==='none' && Math.abs(el.clientHeight-el.parentElement.clientHeight)<2;}));
 }
 pass('Blockbuster illustrations occupy the entire card height without cropping or hover scaling.');
 const finishes=[];
 for(const edition of ['base','tagged','chrome','prismatic']){
  await page.getByRole('button',{name:edition,exact:true}).click();
  await page.locator('.foil-stage__portrait .collector-webgl[data-foil-renderer=webgl] canvas').waitFor();
  const card=page.locator('.foil-stage__portrait .collector-card');
  finishes.push(await card.getAttribute('data-card-finish'));
  const bounds=await card.boundingBox();
  await page.mouse.move(bounds.x+bounds.width*.2,bounds.y+bounds.height*.3);await page.waitForTimeout(100);
  const canvas=page.locator('.foil-stage__portrait .collector-webgl canvas');const first=hash(await canvas.screenshot());
  await page.mouse.move(bounds.x+bounds.width*.8,bounds.y+bounds.height*.55);await page.waitForTimeout(100);
  assert.notEqual(hash(await canvas.screenshot()),first,'Material reflection changes with the viewing angle');
  await page.screenshot({path:'../../screenshots/foil/verified-'+edition+'.jpg',type:'jpeg',quality:85,fullPage:true});
 }
 assert.equal(new Set(finishes).size,4);
 await page.getByRole('button',{name:'prismatic',exact:true}).click();
 const prism=page.locator('.foil-stage__portrait .collector-card');
 assert.equal(await prism.getAttribute('data-card-variant'),'prismatic');
 assert.equal(await prism.getAttribute('data-card-finish'),'Ultimate prism reverse holo');
 assert.equal(await prism.locator('.collector-foil').evaluate(el=>getComputedStyle(el).maskImage),'none');
 assert.ok(await prism.evaluate(el=>Number(getComputedStyle(el.querySelector('.collector-foil')).zIndex)<Number(getComputedStyle(el.querySelector('.collector-portrait')).zIndex)));
 pass('Base, Tagged, Chrome and Prismatic Reverse Holo have distinct finishes; the prism treatment sits behind the artwork silhouette and responsive rendered reflections.');
  const hero=page.locator('.foil-stage__portrait .collector-card');await hero.focus();const beforeKey=hash(await hero.locator('.collector-webgl canvas').screenshot());await page.keyboard.press('ArrowLeft');await page.waitForTimeout(100);assert.notEqual(hash(await hero.locator('.collector-webgl canvas').screenshot()),beforeKey);pass('Keyboard users can move the display light.');
 await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>!document.querySelector('.collector-webgl canvas'));assert.equal(await hero.locator('.collector-foil').evaluate(el=>getComputedStyle(el).display),'block');
 await page.emulateMedia({reducedMotion:'no-preference'});await page.locator('.foil-stage__portrait .collector-webgl[data-foil-renderer=webgl] canvas').waitFor();
 await page.evaluate(()=>document.documentElement.dataset.reduceMotion='true');await page.waitForFunction(()=>!document.querySelector('.collector-webgl canvas'));
 await page.evaluate(()=>delete document.documentElement.dataset.reduceMotion);await page.locator('.foil-stage__portrait .collector-webgl[data-foil-renderer=webgl] canvas').waitFor();pass('System and in-game reduced-motion changes dispose and restore the renderer; static foil stays visible.');
  await page.evaluate(()=>{const canvas=[...window.foilContexts].at(-1);window.foilCanvas=canvas;const gl=canvas.getContext('webgl2')||canvas.getContext('webgl');window.foilLoss=gl?.getExtension('WEBGL_lose_context');if(window.foilLoss)window.foilLoss.loseContext();else canvas.dispatchEvent(new Event('webglcontextlost',{cancelable:true}));});
  await page.locator('.foil-stage__portrait .collector-webgl[data-foil-renderer=css]').waitFor();await page.waitForTimeout(150);
  await page.evaluate(()=>{if(window.foilLoss)window.foilLoss.restoreContext();else window.foilCanvas.dispatchEvent(new Event('webglcontextrestored'));});await page.locator('.foil-stage__portrait .collector-webgl[data-foil-renderer=webgl]').waitFor();pass('GPU context loss keeps the CSS finish and recovers without crashing.');
  for(let i=0;i<8;i++){await page.getByRole('button',{name:'Close display',exact:true}).click();assert.equal(await page.locator('.foil-stage__portrait .collector-webgl canvas').count(),0);await page.getByRole('button',{name:'Open display',exact:true}).click();await page.locator('.foil-stage__portrait .collector-webgl[data-foil-renderer=webgl] canvas').waitFor();assert.equal(await page.locator('.foil-stage__portrait .collector-webgl canvas').count(),1);}
  pass('Repeated inspection closes dispose its canvas without disturbing the grid.');
 await page.getByRole('button',{name:'Card details',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.waitFor();
 const mutations=[];page.on('request',r=>{if(r.method()==='POST')mutations.push(r.url());});
 for(const name of ['Tagged','Chrome','Prismatic Reverse Holo','Original']){await dialog.getByRole('navigation',{name:'Preview card finish'}).getByRole('button',{name,exact:true}).click();await page.waitForTimeout(100);}
 assert.equal(mutations.length,0);assert.equal(await dialog.getByRole('button',{name:'Craft Variant',exact:true}).count(),3);
 assert.ok(await dialog.getByText('80 Shards',{exact:true}).isVisible());assert.ok(await dialog.getByText('140 Shards',{exact:true}).isVisible());assert.ok(await dialog.getByText('300 Shards',{exact:true}).isVisible());
 assert.equal(await dialog.locator('.card-upgrade-pips i[data-active=true]').count(),2);
 pass('Finish previews spend no currency; all three crafting prices and earned upgrade indicators remain correct.');
 await page.screenshot({path:'../../screenshots/foil/inspector-desktop.jpg',type:'jpeg',quality:85,fullPage:true});
 for(const width of [390,320]){
  await page.setViewportSize({width,height:844});await page.waitForTimeout(100);
  assert.ok(await dialog.locator('.card-inspector-scroll').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'No horizontal overflow');
  const card=dialog.locator('[data-testid=card-inspector]');await card.scrollIntoViewIfNeeded();
  await card.dispatchEvent('pointermove',{pointerType:'touch',clientX:200,clientY:230});assert.ok(await card.evaluate(el=>el.style.getPropertyValue('--foil-x')));
  const close=dialog.getByRole('button',{name:'Close card details',exact:true});const rect=await close.boundingBox();assert.ok(rect.x>=0&&rect.x+rect.width<=width&&rect.y>=0);
  await page.screenshot({path:'../../screenshots/foil/inspector-'+width+'.jpg',type:'jpeg',quality:85});
 }
 pass('390px and 320px inspection supports touch lighting, readable controls and no horizontal overflow.');
 await page.keyboard.press('Escape');assert.equal(await dialog.count(),0);
  await page.evaluate(()=>document.documentElement.dataset.depth='lite');
  await page.waitForFunction(()=>!document.querySelector('.collector-webgl canvas'));
  assert.ok(await page.locator('.collector-foil').count()>0);
  await page.evaluate(()=>delete document.documentElement.dataset.depth);
  await page.locator('.foil-stage__portrait .collector-webgl[data-foil-renderer=webgl] canvas').waitFor();
  pass('Low-end device mode retains the CSS finish without WebGL.');
 const fallback=await browser.newPage({viewport:{width:390,height:844}});
 await fallback.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /^webgl/.test(type)?null:original.call(this,type,...args);};});
  await fallback.goto(origin+'/e2e/foil-studio.fixture.html');await fallback.getByRole('button',{name:'prismatic',exact:true}).click();await fallback.locator('.foil-stage__portrait .collector-webgl[data-foil-renderer=css]').waitFor();assert.equal(await fallback.locator('.collector-webgl canvas').count(),0);assert.equal(await fallback.locator('.foil-stage .collector-card[data-card-variant=prismatic]').count(),1);pass('Devices without WebGL retain the complete card and Prismatic Reverse Holo treatment.');
  // Exercise the mounted product routes, not just the material atelier.
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>localStorage.setItem('squabblemon_e2e_user','signed-in'));
  await page.route('**/api/**',route=>route.fulfill({contentType:'application/json',body:'{}'}));
  for(const [path,selector,label] of [
    ['/game/collection','[data-testid="collection-card-grid"]','collection'],
    ['/game/decks/block','[data-testid="deck-roster-grid"]','deck'],
  ]){
    await page.goto(origin+path);
    await page.locator(selector).waitFor();
    await page.locator(`${selector} .collector-webgl[data-foil-renderer=webgl] canvas`).first().waitFor();
    const cards=await page.locator(`${selector} .collector-card`).count();
    assert.ok(cards>=4,`${label} has real cards on screen`);
    const cues=await page.locator(`${selector} .collector-card`).evaluateAll(nodes=>nodes.every(el=>el.dataset.cardRarity&&el.querySelector('.collector-tier-cue')));
    assert.ok(cues,`${label} preserves catalog rarity cues`);
    await cssScreenshot(`mounted-${label}`,selector);
    pass(`Mounted ${label} cards retain rarity and foil with CSS fallback.`);
  }
  await page.goto(origin+'/game/inventory');
  await page.locator('.inventory-room').waitFor();
  assert.equal(await page.locator('.inventory-room .collector-card').count(),0,'The current inventory is a wallet and link to collection, not a card grid');
 assert.deepEqual(report.errors,[]);report.complete=true;
}finally{await browser?.close();server.kill();await writeFile('../../screenshots/foil/verification.json',JSON.stringify(report,null,2));}
