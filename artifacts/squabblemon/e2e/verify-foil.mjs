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
 page.on('pageerror',error=>report.errors.push(error.message));
 page.on('console',event=>{if(event.type()==='error'&&/shader|WebGL|GLSL|React/i.test(event.text()))report.errors.push(event.text());});
 await page.goto(origin+'/e2e/foil-studio.fixture.html');
 for(const rarity of ['SuperCommon','Common','Uncommon','Rare','Epic','Legendary','Mythical']){
  await page.getByRole('button',{name:'Show '+rarity,exact:true}).click();
  if(rarity==='SuperCommon')assert.equal(await page.locator('.collector-webgl canvas').count(),0);
  else await page.locator('.collector-webgl[data-foil-renderer=webgl] canvas').waitFor();
  assert.equal(await page.locator('.foil-lineup canvas').count(),0);
 }
 pass('All seven tiers render; collection cards allocate no WebGL contexts.');
 await page.getByRole('button',{name:'Show Legendary',exact:true}).click();
 const finishes=[];
 for(const edition of ['base','tagged','chrome']){
  await page.getByRole('button',{name:edition,exact:true}).click();
  await page.locator('.collector-webgl[data-foil-renderer=webgl] canvas').waitFor();
  const card=page.locator('.foil-stage__portrait .collector-card');
  finishes.push(await card.getAttribute('data-card-finish'));
  const bounds=await card.boundingBox();
  await page.mouse.move(bounds.x+bounds.width*.2,bounds.y+bounds.height*.3);await page.waitForTimeout(100);
  const canvas=page.locator('.collector-webgl canvas');const first=hash(await canvas.screenshot());
  await page.mouse.move(bounds.x+bounds.width*.8,bounds.y+bounds.height*.55);await page.waitForTimeout(100);
  assert.notEqual(hash(await canvas.screenshot()),first,'Material reflection changes with the viewing angle');
  await page.screenshot({path:'../../screenshots/foil/verified-'+edition+'.jpg',type:'jpeg',quality:85,fullPage:true});
 }
 assert.equal(new Set(finishes).size,3);pass('Base, Tagged and Chrome have distinct finishes and responsive rendered reflections.');
 const hero=page.locator('.foil-stage__portrait .collector-card');await hero.focus();await page.keyboard.press('ArrowLeft');assert.ok(await hero.evaluate(el=>el.style.getPropertyValue('--foil-x')));pass('Keyboard users can move the display light.');
 await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>!document.querySelector('.collector-webgl canvas'));assert.equal(await hero.locator('.collector-foil').evaluate(el=>getComputedStyle(el).display),'block');
 await page.emulateMedia({reducedMotion:'no-preference'});await page.locator('.collector-webgl[data-foil-renderer=webgl] canvas').waitFor();
 await page.evaluate(()=>document.documentElement.dataset.reduceMotion='true');await page.waitForFunction(()=>!document.querySelector('.collector-webgl canvas'));
 await page.evaluate(()=>delete document.documentElement.dataset.reduceMotion);await page.locator('.collector-webgl[data-foil-renderer=webgl] canvas').waitFor();pass('System and in-game reduced-motion changes dispose and restore the renderer; static foil stays visible.');
 await page.evaluate(()=>{const gl=document.querySelector('.collector-webgl canvas').getContext('webgl2');window.foilLoss=gl.getExtension('WEBGL_lose_context');window.foilLoss.loseContext();});
 await page.locator('.collector-webgl[data-foil-renderer=css]').waitFor();await page.waitForTimeout(150);
 await page.evaluate(()=>window.foilLoss.restoreContext());await page.locator('.collector-webgl[data-foil-renderer=webgl]').waitFor();pass('GPU context loss keeps the CSS finish and recovers without crashing.');
 for(let i=0;i<8;i++){await page.getByRole('button',{name:'Close display',exact:true}).click();assert.equal(await page.locator('.collector-webgl canvas').count(),0);await page.getByRole('button',{name:'Open display',exact:true}).click();await page.locator('.collector-webgl[data-foil-renderer=webgl] canvas').waitFor();assert.equal(await page.locator('.collector-webgl canvas').count(),1);}
 pass('Repeated inspection closes dispose each canvas; exactly one returns on reopen.');
 await page.getByRole('button',{name:'Card details',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.waitFor();
 const mutations=[];page.on('request',r=>{if(r.method()==='POST')mutations.push(r.url());});
 for(const name of ['Tagged','Chrome','Original']){await dialog.getByRole('navigation',{name:'Preview card finish'}).getByRole('button',{name,exact:true}).click();await page.waitForTimeout(100);}
 assert.equal(mutations.length,0);assert.equal(await dialog.getByRole('button',{name:'Craft Variant',exact:true}).count(),2);
 assert.ok(await dialog.getByText('80 Shards',{exact:true}).isVisible());assert.ok(await dialog.getByText('140 Shards',{exact:true}).isVisible());
 assert.equal(await dialog.locator('.card-upgrade-pips i[data-active=true]').count(),2);
 pass('Finish previews spend no currency; both existing crafting prices and earned upgrade indicators remain correct.');
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
 const fallback=await browser.newPage({viewport:{width:390,height:844}});
 await fallback.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /^webgl/.test(type)?null:original.call(this,type,...args);};});
 await fallback.goto(origin+'/e2e/foil-studio.fixture.html');await fallback.getByRole('button',{name:'chrome',exact:true}).click();await fallback.locator('.collector-webgl[data-foil-renderer=css]').waitFor();assert.equal(await fallback.locator('.collector-webgl canvas').count(),0);assert.equal(await fallback.locator('.foil-stage .collector-card').count(),1);pass('Devices without WebGL retain the complete card and Chrome treatment.');
 assert.deepEqual(report.errors,[]);report.complete=true;
}finally{await browser?.close();server.kill();await writeFile('../../screenshots/foil/verification.json',JSON.stringify(report,null,2));}
