import test from 'node:test';
import assert from 'node:assert/strict';
import { planShopPurchase, type ShopWallet, type ShopRequest } from '@workspace/squabblemon-engine/economy';
import { cardCatalog } from '@workspace/squabblemon-engine/data';
import { styleShardRarityForCard } from '@workspace/squabblemon-engine/styleShards';
import { FINISH_OFFERS, finishCounterSelection, reserveFinishPurchase, clearConfirmedFinishRequest } from './finishCounter';
import { readShopRequest, saveShopRequest } from './shopJournal';
const key = '89dbe5b8-9512-4a27-9938-44e589bcc653', secondKey = '99dbe5b8-9512-4a27-9938-44e589bcc653';
const wallet = (overrides: Partial<ShopWallet> = {}): ShopWallet => ({ softCurrency:3000, packTickets:2, styleShards:200, deckSlots:4, ownedCardIds:['cornball'], discoveredCardIds:['cornball'], ownedVariants:[], collectionProgress:1, cardProgression:{cornball:{xp:0,level:1,moveTier:0}}, ...overrides });
const memory = () => { const values=new Map<string,string>(); return {getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);},removeItem:(key:string)=>{values.delete(key);}}; };
const tagged = {itemId:'tagged-style' as const,cardId:'cornball'};

test('counter exposes only the two existing finish offers and quotes every catalog finish exactly',()=>{
  assert.deepEqual(FINISH_OFFERS.map(offer=>offer.id),['tagged-style','chrome-style']);
  for(const card of cardCatalog) for(const offer of FINISH_OFFERS) {
    const profile=wallet({ownedCardIds:[card.catalogId],styleShards:10000});
    const selection=finishCounterSelection(profile,offer.id,card.catalogId,null);
    const slot=card.variantSlots.find(slot=>slot.id.endsWith(offer.id==='tagged-style'?':tagged':':chrome'));
    assert.equal(selection.cardId,card.catalogId);assert.equal(selection.variant?.id,slot?.id);
    if(slot){assert.equal(selection.cost,slot.shardCost);assert.deepEqual(selection.quote,planShopPurchase(profile,{itemId:offer.id,cardId:card.catalogId}));}
    else assert.equal(selection.quote,null);
  }
});
test('only owned cards can be selected; invalid links and an empty collection stay safe',()=>{
  const fallback=finishCounterSelection(wallet(),'free-finish','young-bull',null);
  assert.equal(fallback.cardId,'cornball');assert.equal(fallback.offer.id,'tagged-style');assert.deepEqual(fallback.choices.map(card=>card.catalogId),['cornball']);
  const empty=finishCounterSelection(wallet({ownedCardIds:[]}),'chrome-style','cornball',null);
  assert.equal(empty.card,undefined);assert.equal(empty.quote,null);assert.equal(empty.choices.length,0);
});
test('matching rarity shards are spent first and a new purchase never changes Clout or card strength',()=>{
  const rarity=styleShardRarityForCard(cardCatalog.find(card=>card.catalogId==='cornball')!.rarity);
  const before=wallet({styleShards:30,styleShardBalances:{[rarity]:60}});
  const chosen=finishCounterSelection(before,'tagged-style','cornball',null);
  assert.deepEqual(chosen.quote?.receipt.shardPayment,{rarity,matching:60,universal:20});
  assert.equal(chosen.quote?.wallet.styleShards,10);assert.equal(chosen.quote?.wallet.softCurrency,before.softCurrency);
  assert.deepEqual(chosen.quote?.wallet.cardProgression,before.cardProgression);assert.equal(before.styleShards,30);
});
test('owned and unaffordable finishes cannot reserve a new charge',()=>{
  const owned=planShopPurchase(wallet(),tagged).wallet;
  assert.equal(finishCounterSelection(owned,'tagged-style','cornball',null).owned,true);
  assert.throws(()=>reserveFinishPurchase(memory(),'a',owned,tagged,()=>key),/already own/);
  assert.throws(()=>reserveFinishPurchase(memory(),'a',wallet({styleShards:0}),tagged,()=>key),/shards/i);
});
test('ambiguous server success recovers the exact saved card, finish and key after navigation or wallet refresh',()=>{
  const storage=memory();const original=reserveFinishPurchase(storage,'a',wallet(),tagged,()=>key);
  const after=planShopPurchase(wallet(),original).wallet;
  const retry=reserveFinishPurchase(storage,'a',after,{itemId:'chrome-style',cardId:'young-bull'},()=>{throw new Error('must not create a second key');});
  assert.deepEqual(retry,original);assert.deepEqual(readShopRequest(storage,'a'),original);
  const selection=finishCounterSelection(after,'chrome-style','young-bull',retry);
  assert.equal(selection.offer.id,'tagged-style');assert.equal(selection.cardId,'cornball');assert.equal(selection.owned,true);assert.equal(selection.quote,null);
  clearConfirmedFinishRequest(storage,'a',retry);assert.equal(readShopRequest(storage,'a'),null);
});
test('foreign purchases remain intact and account journals cannot cross',()=>{
  const storage=memory();const foreign:ShopRequest={idempotencyKey:key,itemId:'deck-slot'};saveShopRequest(storage,'a',foreign);
  assert.deepEqual(reserveFinishPurchase(storage,'a',wallet(),tagged,()=>secondKey),foreign);
  assert.deepEqual(readShopRequest(storage,'a'),foreign);
  const other=reserveFinishPurchase(storage,'b',wallet(),tagged,()=>secondKey);assert.equal(other.idempotencyKey,secondKey);
  assert.equal(finishCounterSelection(wallet(),'chrome-style','cornball',foreign).offer.id,'chrome-style');
  clearConfirmedFinishRequest(storage,'a',other);assert.deepEqual(readShopRequest(storage,'a'),foreign,'a late response cannot clear a newer request');
});
test('blocked or nonpersistent storage fails before a request can be sent',()=>{
  assert.throws(()=>reserveFinishPurchase({getItem:()=>null,setItem:()=>{throw new Error('blocked');}},'a',wallet(),tagged,()=>key),/blocked/);
  assert.throws(()=>reserveFinishPurchase({getItem:()=>null,setItem:()=>{}},'a',wallet(),tagged,()=>key),/No purchase was sent/);
});
