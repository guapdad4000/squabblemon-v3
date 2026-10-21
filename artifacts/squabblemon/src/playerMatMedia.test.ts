import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,stat} from 'node:fs/promises';
import sharp from 'sharp';
import {PLAYER_MATS} from '@workspace/squabblemon-engine/playerMats';

const root='public/';
const expected=new Set<string>();
for(const mat of PLAYER_MATS){
 for(const src of [mat.assetId,mat.posterAssetId,mat.portraitAssetId].filter(Boolean) as string[]){expected.add(src);expected.add(src.replace('.webp','.avif'));}
 const thumb=(mat.posterAssetId??mat.assetId).replace('.webp','-thumb.webp');expected.add(thumb);expected.add(thumb.replace('.webp','.avif'));
 if(mat.characterAssetId)expected.add(mat.characterAssetId);
}
test('every mat ships full, fallback, thumbnail and transparent-corner media within budgets',async()=>{
 assert.equal(PLAYER_MATS.filter(m=>m.characterId).length,20);
 for(const src of expected){
  const bytes=(await stat(root+src)).size,meta=await sharp(await readFile(root+src)).metadata();
  assert(bytes>500,src);assert(meta.width&&meta.height,src);
  if(src.includes('-thumb.')){assert.equal(meta.width,640,src);assert(bytes<110*1024,src+' thumbnail budget');}
  else if(src.includes('-corner.')){assert(meta.width<=256,src);assert(meta.hasAlpha,src+' keeps transparency');assert(bytes<90*1024,src+' corner budget');}
  else {assert(bytes<(src.endsWith('.avif')?350:550)*1024,src+' full image budget');}
 }
 for(const mat of PLAYER_MATS){
  const original=await sharp(root+mat.assetId).metadata(),modern=await sharp(root+mat.assetId.replace('.webp','.avif')).metadata();
  assert.deepEqual([original.width,original.height],[modern.width,modern.height],mat.id+' format geometry');
  if(mat.laneScene)assert.deepEqual([original.width,original.height],[1536,1024],mat.id+' source thirds');
 }
});
test('runtime mat folder includes only catalog media; masters and auditions stay out of deployment',async()=>{
 const files=await readdir(root+'assets/player-mats/v4');
 assert.deepEqual(new Set(files.map(f=>'assets/player-mats/v4/'+f)),expected);
 assert.deepEqual(await readdir(root+'assets/player-mats'),['v4']);
});
