import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { CHARACTER_STYLE_ARTWORK, CHARACTER_STYLE_SETS, hasCharacterStickers, stickerById } from '@workspace/squabblemon-engine/cosmetics';
import { catalogCardById } from '@workspace/squabblemon-engine/data';
const publicFile=(relative:string)=>fileURLToPath(new URL('../public/'+relative,import.meta.url));
test('every offered signature pack has a real portrait and background, with legacy atlas gutters preserved',async()=>{
 for(const set of Object.values(CHARACTER_STYLE_SETS)){
  assert(catalogCardById[set.cardId],set.cardId+' must be collectible');
  await access(publicFile('assets/characters/'+set.cardId+'.webp'));await access(publicFile(set.background));
  assert(hasCharacterStickers(set));
  if (!set.stickerAtlas) continue;
  const atlas=publicFile(set.stickerAtlas);
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

test('all ten supplied packs are accounted for: 60 banners, 60 deck covers and 239 transparent stickers', async () => {
 const manifest = JSON.parse(await readFile(new URL('../reference/cosmetics/import-manifest.json', import.meta.url), 'utf8'));
 assert.equal(manifest.sources.length, 10);
 assert.equal(manifest.images.length, 359);
 assert.equal(Object.keys(CHARACTER_STYLE_ARTWORK).length, 60);
 const referenced = new Set<string>();
 let stickers = 0;
 for (const [cardId, art] of Object.entries(CHARACTER_STYLE_ARTWORK)) {
  assert(catalogCardById[cardId], cardId);
  assert.equal(CHARACTER_STYLE_SETS[cardId].banner, art.banner);
  assert.equal(CHARACTER_STYLE_SETS[cardId].deckCover, art.deckCover);
  for (const file of [art.banner, art.deckCover]) {
   const metadata = await sharp(publicFile(file)).metadata();
   assert.equal(metadata.format, 'webp');
   assert(metadata.width && metadata.height);
   if (file === art.banner) assert(Math.abs(metadata.width / metadata.height - 3) < 0.05, cardId);
   else assert(Math.abs(metadata.width / metadata.height - 2 / 3) < 0.05, cardId);
   referenced.add(file);
  }
  for (const sticker of art.stickers) {
   assert.equal(stickerById(sticker.id)?.sticker.image, sticker.image);
   const image = sharp(publicFile(sticker.image));
   const metadata = await image.metadata();
   assert.equal(metadata.format, 'webp');
   assert.equal(metadata.width, 512);
   assert.equal(metadata.hasAlpha, true, sticker.id);
   const stats = await image.stats();
   assert.equal(stats.channels[3].min, 0, sticker.id + ' keeps transparency');
   assert(stats.channels[3].max >= 250, sticker.id + ' contains visible art');
   referenced.add(sticker.image); stickers++;
  }
 }
 assert.equal(stickers, 239);
 assert.deepEqual([...referenced].sort(), manifest.images.map((image: { asset: string }) => image.asset).sort());
 assert.equal(CHARACTER_STYLE_ARTWORK.powerhouse.stickers.length, 3, 'Do not invent the missing portrait');
 for (const id of ['kyle:smile', 'guap:portrait', 'ashlee:signature', 'stockz:mark']) assert(stickerById(id), 'Preserve saved sticker ' + id);
});
