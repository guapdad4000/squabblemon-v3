import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { PLAYER_MATS } from '../../../lib/squabblemon-engine/src/playerMats';
import { STYLE_SHARD_RARITIES, STYLE_SHARD_TIERS } from '../../../lib/squabblemon-engine/src/styleShards';
const out=process.env.MAT_COLLECTION_OUTPUT ?? '/tmp/player-mat-collection';
await mkdir(`${out}/battle`,{recursive:true});
const mats=PLAYER_MATS.filter(m=>m.characterId), results:unknown[]=[];
for(const m of mats) for(const path of [m.assetId,m.posterAssetId!]) assert((await stat(`public/${path}`)).size>10000,path);
const browser=await chromium.launch({headless:true});
try {
 for(const [width,height] of [[390,844],[1280,800]]) {
  let p=await browser.newPage({viewport:{width,height},hasTouch:width<600,reducedMotion:'reduce'});
  const errors:string[]=[];p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400&&r.url().includes('/assets/player-mats/')) errors.push(`${r.status()} ${r.url()}`);});
  await p.goto('http://127.0.0.1:4228/e2e/player-mats/fixture.html',{waitUntil:'networkidle'});
  for(const rarity of STYLE_SHARD_RARITIES){
   await p.getByRole('combobox',{name:'Mat rarity',exact:true}).selectOption(rarity);
   assert.equal(await p.locator('.mat-card').count(),PLAYER_MATS.filter(m=>m.rarity===rarity).length);
   for(const text of await p.locator('.mat-card .mat-rarity').allTextContents())assert.equal(text,STYLE_SHARD_TIERS[rarity].label);
  }
  await p.getByRole('combobox',{name:'Mat rarity',exact:true}).selectOption('all');
  for(const mat of mats){
   await p.getByTestId(`mat-${mat.id}`).click();
   assert.equal(await p.locator('.mat-selection .mat-rarity').textContent(),STYLE_SHARD_TIERS[mat.rarity].label);
   const pic=p.locator('.mat-preview .player-mat-half--player .player-mat-art__scene');await pic.evaluate(async(el:HTMLImageElement)=>await el.decode());
   assert((await pic.getAttribute('src'))?.endsWith(mat.posterAssetId!));
  }
  await p.getByTestId('mat-signature-ashlee').click();
  await p.screenshot({path:`${out}/studio-${width}.png`});
  for(const [i,mat] of mats.entries()){
   await p.close();
   p=await browser.newPage({viewport:{width,height},hasTouch:width<600,reducedMotion:'reduce'});
   p.on('pageerror',e=>errors.push(e.message));
   console.log(`Checking ${width} ${mat.id}`);
   const mode=width===390?'pvp':'training';const rival=mats[(i+7)%mats.length];
   await p.goto(`http://127.0.0.1:4228/e2e/art-recovery/fixture.html?${mode==='pvp'?'pvp&':''}playerMat=${mat.id}&rivalMat=${rival.id}`,{waitUntil:'networkidle'});
   const bg=p.getByTestId('battle-player-mats');assert.equal(await bg.getAttribute('data-player-mat'),mat.id);
   await p.locator('.battle-mat-characters img').evaluateAll(async imgs=>await Promise.all(imgs.map(img=>(img as HTMLImageElement).decode())));
   const lanes=await p.locator('.battle-lane-mat').evaluateAll(async els=>{
    const rows=[];for(const el of els){const lane=el.closest('.district-lane')!.getBoundingClientRect();const arts=[];for(const svg of el.querySelectorAll('svg')){const r=svg.getBoundingClientRect();const src=svg.querySelector('img')!.currentSrc;const img=new Image();img.src=src;await img.decode();arts.push({src,center:r.x+r.width/2,expected:lane.x+lane.width/2,height:r.height,laneHeight:lane.height,ratio:img.naturalWidth/img.naturalHeight});}rows.push(arts);}return rows;
   });
   assert.equal(lanes.length,3);
   for(const arts of lanes){assert.equal(arts.length,mode==='pvp'?2:1);for(const a of arts){assert(Math.abs(a.center-a.expected)<1);assert(Math.abs(a.height-a.laneHeight/(mode==='pvp'?2:1))<2);assert.equal(a.ratio,1.5);}}
   const corner=await p.locator('.battle-mat-character-anchor--player img').boundingBox();assert(corner&&corner.x>=-1&&corner.y>=0&&corner.x+corner.width<=width+1&&corner.y+corner.height<=height);
   assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await p.screenshot({path:`${out}/battle/${mat.characterId}-${width}.png`});
   results.push({id:mat.id,rarity:mat.rarity,width,height,mode,rival:rival.id,corner});
  }
  assert.deepEqual(errors,[]);await p.close();
 }
 await writeFile(`${out}/collection-checks.json`,JSON.stringify({passed:true,cases:results.length,results},null,2));
 await writeFile(`${out}/CATALOG.json`,JSON.stringify(PLAYER_MATS,null,2));
 console.log(`Passed ${results.length} character/mode checks; all 20 shop previews and all rarity filters at both widths.`);
}finally{await browser.close();}
