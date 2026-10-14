import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, access} from 'node:fs/promises';
import sharp from 'sharp';
import {cardCatalog} from '../../../lib/squabblemon-engine/src/data';
import {CHARACTER_SIGNATURE_ARTWORK, CHARACTER_STYLE_SETS, hasCharacterStickers, validateCosmeticLoadout} from '../../../lib/squabblemon-engine/src/cosmetics';
import {KUMITE_CARD_REWARDS} from '../../../lib/squabblemon-engine/src/kumiteCards';
import {planShopPurchase} from '../../../lib/squabblemon-engine/src/economy';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../public/',import.meta.url));
test('every eligible character has dedicated correctly proportioned art with no portrait fallbacks',async()=>{
 const eligible=cardCatalog.filter(c=>(c.kind??'character')==='character' && (['Mythical','Legendary','Epic'].includes(c.rarity)||CHARACTER_STYLE_SETS[c.catalogId]||KUMITE_CARD_REWARDS.some(r=>r.cardId===c.catalogId)));
 assert.equal(eligible.length,128);
 for(const card of eligible){const set=CHARACTER_STYLE_SETS[card.catalogId];assert(set,card.name);
  for(const [kind,ratio] of [['banner',3],['deckCover',2/3]] as const){const file=set[kind];assert(file?.startsWith('assets/cosmetics/'),card.name+' '+kind);await access(root+file);const m=await sharp(root+file).metadata();assert.equal(m.format,'webp');assert(m.width&&m.height);assert(Math.abs(m.width/m.height-ratio)<(CHARACTER_SIGNATURE_ARTWORK[card.catalogId]?0.01:0.05),card.name+' aspect ratio');}
 }
 assert.equal(Object.keys(CHARACTER_SIGNATURE_ARTWORK).length,69);
});
test('banner-only collections preserve card ownership gates and reject empty sticker packs',()=>{
 const wallet={ownedCardIds:['franklin-duke'],cardProgression:{},unlockedCosmeticIds:[],styleShards:1000} as Parameters<typeof planShopPurchase>[0];
 assert.throws(()=>planShopPurchase(wallet,{itemId:'character-stickers',cardId:'franklin-duke'}),/not ready/);
 const set=CHARACTER_STYLE_SETS['franklin-duke'];assert(!hasCharacterStickers(set));
 assert.equal(validateCosmeticLoadout({ownedCardIds:['franklin-duke']},{bannerCardId:'franklin-duke'}),null);
 assert.match(validateCosmeticLoadout({ownedCardIds:[]},{bannerCardId:'franklin-duke'})!,/Unlock/);
 assert.deepEqual(CHARACTER_STYLE_SETS.leroy.stickers.map(s=>s.id),['leroy:v3-portrait','leroy:v3-action','leroy:v3-reaction','leroy:v3-emblem','leroy:portrait','leroy:signature','leroy:keepsake','leroy:mark']);
});
