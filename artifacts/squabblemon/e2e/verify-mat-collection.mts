import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { PLAYER_MATS } from '../../../lib/squabblemon-engine/src/playerMats';
import { STYLE_SHARD_RARITIES, STYLE_SHARD_TIERS } from '../../../lib/squabblemon-engine/src/styleShards';
const out=process.env.MAT_COLLECTION_OUTPUT ?? '/tmp/player-mat-collection';
await mkdir(`${out}/battle`,{recursive:true});
const mats=PLAYER_MATS.filter(m=>m.characterId), results:unknown[]=[], previews:unknown[]=[];
for(const m of mats) for(const path of [m.assetId,m.posterAssetId!]) assert((await stat(`public/${path}`)).size>10000,path);
const browser=await chromium.launch({headless:true});
try {
 for(const [width,height] of [[390,844],[1280,800]]) {
  let p=await browser.newPage({viewport:{width,height},hasTouch:width<600,reducedMotion:'reduce'});
  const errors:string[]=[];p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400&&r.url().includes('/assets/player-mats/')) errors.push(`${r.status()} ${r.url()}`);});
  await p.goto('http://127.0.0.1:4228/e2e/player-mats/fixture.html',{waitUntil:'networkidle'});
  await p.getByRole('button',{name:'Filter by rarity'}).click();
  for(const rarity of STYLE_SHARD_RARITIES){
   await p.getByRole('combobox',{name:'Mat rarity',exact:true}).selectOption(rarity);
   assert.equal(await p.locator('.mat-card').count(),PLAYER_MATS.filter(m=>m.rarity===rarity).length);
   for(const text of await p.locator('.mat-card .mat-rarity').allTextContents())assert.equal(text,STYLE_SHARD_TIERS[rarity].label);
  }
  await p.getByRole('combobox',{name:'Mat rarity',exact:true}).selectOption('all');
  await p.locator('.mat-card img').evaluateAll(imgs=>imgs.forEach(img=>(img as HTMLImageElement).loading='eager'));
  await p.locator('.mat-card img').evaluateAll(async imgs=>await Promise.all(imgs.map(img=>(img as HTMLImageElement).decode())));
  for(const mat of mats){
   await p.getByTestId(`mat-${mat.id}`).click();
   assert.equal(await p.locator('.mat-selection .mat-rarity').textContent(),STYLE_SHARD_TIERS[mat.rarity].label);
   const pic=p.locator('.mat-preview .player-mat-art[data-side="player"] .player-mat-art__scene');await pic.evaluate(async(el:HTMLImageElement)=>await el.decode());
   assert((await pic.getAttribute('src'))?.endsWith(mat.assetId));
   previews.push({id:mat.id,rarity:mat.rarity,width,height});
   await p.getByRole('button',{name:'Close mat preview'}).click();
   await p.getByRole('dialog').waitFor({state:'hidden'});
  }
  await p.getByTestId('mat-signature-ashlee').click();
  await p.screenshot({path:`${out}/studio-${width}.png`});
  if(!process.env.MAT_SHOP_ONLY) for(const [i,mat] of mats.entries()){
   await p.close();
   p=await browser.newPage({viewport:{width,height},hasTouch:width<600,reducedMotion:'reduce'});
   p.on('pageerror',e=>errors.push(e.message));
   console.log(`Checking ${width} ${mat.id}`);
   const mode=width===390?'pvp':'training';const rival=mats[(i+7)%mats.length];
   await p.goto(`http://127.0.0.1:4228/e2e/art-recovery/fixture.html?${mode==='pvp'?'pvp&':''}playerMat=${mat.id}&rivalMat=${rival.id}`,{waitUntil:'networkidle'});
   const bg=p.getByTestId('battle-player-mats');assert.equal(await bg.getAttribute('data-player-mat'),mat.id);
   await bg.locator('img').evaluateAll(async imgs=>await Promise.all(imgs.map(img=>(img as HTMLImageElement).decode())));
   assert.equal(await p.locator('.battle-lane-mat,.battle-mat-characters,.player-mat-character').count(),0);
   const images=await bg.locator('img').evaluateAll(imgs=>imgs.map(img=>({src:(img as HTMLImageElement).currentSrc,fit:getComputedStyle(img).objectFit})));
   assert.equal(images.length,mode==='pvp'?2:1);
   for(const img of images){assert.equal(img.fit,'cover');assert(img.src.includes('-scene.'));}
   assert(images.some(img=>img.src.endsWith(mat.assetId.replace('.webp','.avif'))));
   assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await p.screenshot({path:`${out}/battle/${mat.characterId}-${width}.png`});
   results.push({id:mat.id,rarity:mat.rarity,width,height,mode,rival:rival.id,images});
  }
  assert.deepEqual(errors,[]);await p.close();
 }
 await writeFile(`${out}/collection-checks.json`,JSON.stringify({passed:true,cases:results.length,results,previews},null,2));
 await writeFile(`${out}/CATALOG.json`,JSON.stringify(PLAYER_MATS,null,2));
 console.log(`Passed ${previews.length} shop previews and all rarity filters at both widths; ${results.length} additional battle checks.`);
}finally{await browser.close();}
