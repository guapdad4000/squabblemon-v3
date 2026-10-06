import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const origin=(process.env.STREET_LEGENDS_ORIGIN??'http://127.0.0.1:4213').replace(/\/$/, '');
const require=createRequire(root+'/artifacts/squabblemon/package.json');const {chromium}=require('@playwright/test');
const out=root+'/artifacts/deliverables/street-legends-wave-2026-10-06/screenshots';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true});const results=[],errors=[];
for(const [name,viewport,group] of [['street-legends-desktop',{width:1440,height:1000},'block'],['music-desktop',{width:1440,height:1000},'music'],['fitness-mobile',{width:390,height:844},'fitness']]) {
 const page=await browser.newPage({viewport,reducedMotion:'reduce'});page.on('pageerror',e=>errors.push(name+': '+e.message));
 console.log(name+': navigate'); await page.goto(origin+'/e2e/street-legends.fixture.html?group='+group,{waitUntil:'domcontentloaded'});
 await page.locator('[data-wave-card]').first().waitFor(); await page.evaluate(()=>{for(const i of document.images)i.loading='eager';}); console.log(name+': image readiness'); await page.waitForFunction(()=>[...document.images].every(i=>i.complete),null,{timeout:20000}).catch(async e=>{console.log(await page.evaluate(()=>[...document.images].filter(i=>!i.complete).map(i=>({src:i.src,loading:i.loading}))));throw e;}); console.log(name+': ready');
 assert.equal(await page.locator('[data-wave-card]').count(),group==='block'?15:group==='music'?10:5);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 const failed=await page.evaluate(()=>[...document.images].filter(i=>!i.complete||!i.naturalWidth).map(i=>i.src));assert.deepEqual(failed,[]);
 console.log(name+': screenshot'); await page.screenshot({path:out+'/'+name+'.png',fullPage:true,timeout:20000});results.push({name,cards:await page.locator('[data-wave-card]').count(),imageFailures:failed.length});
 if(group==='fitness') {
   await page.getByRole('button',{name:'Inspect Fitness Girl',exact:true}).click();
   await page.getByRole('dialog').waitFor();await page.locator('.dossier-sticky__title').waitFor();await page.screenshot({path:out+'/fitness-girl-dossier-mobile.png'});
   assert.match(await page.getByRole('dialog').innerText(),/Active Recovery/i); await page.locator('.dossier-sticky__title').scrollIntoViewIfNeeded(); await page.screenshot({path:out+'/fitness-girl-ability-mobile.png'});
 }
 await page.close();
}
for(const [name,viewport] of [['battle-desktop',{width:1440,height:1000}],['battle-mobile',{width:390,height:844}],['battle-ipad-portrait',{width:820,height:1180}],['battle-ipad-landscape',{width:1180,height:820}]]) {
 const page=await browser.newPage({viewport,reducedMotion:'reduce'});page.on('pageerror',e=>errors.push(name+': '+e.message));
 console.log(name+': battle navigate'); await page.goto(origin+'/e2e/street-legends-battle.fixture.html',{waitUntil:'domcontentloaded'});
 await page.getByTestId('battle-arena').waitFor();
 const source=page.locator('[data-battle-draggable="true"][data-card-id="the-rapper"]');await source.waitFor();await source.scrollIntoViewIfNeeded();await source.click();
 await page.getByTestId('lane-1').click();await page.getByTestId('button-lock').click();
 await page.locator('[data-card-zone="board"][data-card-id="the-rapper"]').waitFor();
 await page.locator('[data-presentation-phase="player-ready"]').waitFor();
 const board=await page.locator('[data-card-zone="board"]').evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect();return {card:node.getAttribute('data-card-id'),w:r.width,h:r.height};}));
 assert(board.length>0&&board.every(c=>c.w>0&&c.h>0),'board survives the final transition');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 const remaining=await page.evaluate(()=>window.__streetWaveBattle.getMatch().playerMotion);assert(remaining>=0);
 await page.screenshot({path:out+'/'+name+'.png'});results.push({name,visibleBoardCards:board.length,boardCards:board,remainingMotion:remaining});
 await page.getByRole('button',{name:'End Turn',exact:true}).click();
 await page.locator('[data-presentation-phase="player-ready"]').waitFor();assert(await page.locator('[data-card-zone="board"]').count()>0);
 const trigger=page.getByRole('button',{name:'Music controls',exact:true}).first();
 if(!await trigger.isVisible())await page.getByLabel('Battle menu',{exact:true}).click(); await trigger.click(); const musicPanel=page.getByRole('dialog',{name:'The Fade Tapes'}); await musicPanel.waitFor();
 await page.getByRole('slider',{name:'Music volume',exact:true}).fill('17');
 await page.getByRole('slider',{name:'Battle announcer volume',exact:true}).fill('23');
 await page.getByRole('button',{name:'Close music controls',exact:true}).click();
 await trigger.click(); await musicPanel.waitFor();
 assert.equal(await page.getByRole('slider',{name:'Music volume',exact:true}).inputValue(),'17');
 assert.equal(await page.getByRole('slider',{name:'Battle announcer volume',exact:true}).inputValue(),'23');
 await page.keyboard.press('Escape'); await musicPanel.waitFor({state:'hidden'});
 results.push({name:name+'-music-controls',repeatedOpen:true,persistedSettings:true});
 await page.close();
}
await browser.close();assert.deepEqual(errors,[]);writeFileSync(root+'/artifacts/deliverables/street-legends-wave-2026-10-06/browser-verification.json',JSON.stringify({results,errors},null,2));console.log(JSON.stringify({checks:results.length,errors,screenshots:out}));
