import test from 'node:test';
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { CHARACTER_STYLE_SETS } from '@workspace/squabblemon-engine/cosmetics';
import { catalogCardById } from '@workspace/squabblemon-engine/data';
const publicFile=(relative:string)=>fileURLToPath(new URL('../public/'+relative,import.meta.url));
test('every offered signature pack has a real portrait, background and padded transparent four-cell atlas',async()=>{
 for(const set of Object.values(CHARACTER_STYLE_SETS)){
  assert(catalogCardById[set.cardId],set.cardId+' must be collectible');
  await access(publicFile('assets/characters/'+set.cardId+'.webp'));await access(publicFile(set.background));
  assert(set.stickerAtlas);const atlas=publicFile(set.stickerAtlas);
  const {data,info}=await sharp(atlas).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  assert.equal(info.width,1024,set.cardId);assert.equal(info.height,1024,set.cardId);
  for(let cell=0;cell<4;cell++){
   let visible=0;for(let y=0;y<512;y++)for(let x=0;x<512;x++){
    const alpha=data[((Math.floor(cell/2)*512+y)*1024+(cell%2)*512+x)*4+3];
    if(x<16||y<16||x>=496||y>=496)assert.equal(alpha,0,set.cardId+': safe sprite gutters');
    if(alpha>32)visible++;
   }
   assert(visible>5000,set.cardId+': each cell contains an actual sticker');
  }
 }
});
