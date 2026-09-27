import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { REACTIONS, CHARACTER_REACTION_PACKS, ownedReactions, addReaction } from '../../../../lib/squabblemon-engine/src/reactions';
import { planShopPurchase } from '../../../../lib/squabblemon-engine/src/economy';
import { PurchasePlayerShopItemBody } from '../../../../lib/api-zod/src/generated/api';
const root = new URL('../../../squabblemon/public/', import.meta.url);
test('all seven character packs validate, purchase and unlock exactly their playable reactions', () => {
 assert.equal(CHARACTER_REACTION_PACKS.length, 7);
 for (const pack of CHARACTER_REACTION_PACKS) {
  const input = {itemId: pack.id, idempotencyKey:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'};
  assert.ok(PurchasePlayerShopItemBody.safeParse(input).success);
  const wallet = {softCurrency:800,styleShards:0,packTickets:0,deckSlots:4,ownedCardIds:[],discoveredCardIds:[],ownedVariants:[],unlockedCosmeticIds:['existing'],cardProgression:{},collectionProgress:0};
  const result = planShopPurchase(wallet,input);
  assert.equal(result.wallet.softCurrency,400);
  assert.deepEqual(result.wallet.unlockedCosmeticIds,['existing',pack.unlock]);
  assert.equal(wallet.softCurrency,800);
  const owned = ownedReactions(result.wallet.unlockedCosmeticIds);
  assert.equal(owned.length,6);
  for (const id of pack.reactionIds) {
   assert.ok(owned.includes(id));
   assert.equal(addReaction(undefined,{id:'request',reactionId:id,seat:'player',gameNumber:1},owned,10000).latest.player?.reactionId,id);
   const r=REACTIONS.find(r=>r.id===id)!;
   for(const path of [r.gif,r.poster,r.animatedWebp]) assert.ok(path && existsSync(new URL(path,root)),path ?? 'missing path');
  }
  assert.throws(()=>planShopPurchase(result.wallet,input),/already own/);
  assert.throws(()=>planShopPurchase({...wallet,softCurrency:399},input),/Clout/);
 }
 const manifest=JSON.parse(readFileSync(new URL('assets/reactions/character-pack-v1/manifest.json',root),'utf8'));
 assert.equal(manifest.reactions.length,28);
});
