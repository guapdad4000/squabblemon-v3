import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { PLAYER_MATS, ANUNAKI_EVENT_PLAYER_MATS, ownsPlayerMat, equippedPlayerMat, playerMatUnlockId } from '@workspace/squabblemon-engine/playerMats';
import { ANUNAKI_EVENT_GAMEPLAY_READY } from '@workspace/squabblemon-engine/anunakiEvent';
import { planShopPurchase, type ShopWallet } from '@workspace/squabblemon-engine/economy';
import { avatarSticker, cosmeticId, ownsStyle, stickerById, validateCosmeticLoadout } from '@workspace/squabblemon-engine/cosmetics';
import { catalogCardById, starterRecipes } from '@workspace/squabblemon-engine/data';
import { getStoryNode } from '@workspace/squabblemon-engine/story';
import { EquipPlayerCosmeticsBody, PurchasePlayerShopItemBody } from '@workspace/api-zod';
const wallet = (extra: Partial<ShopWallet> = {}): ShopWallet => ({softCurrency:100,packTickets:0,styleShards:300,deckSlots:4,ownedCardIds:[],discoveredCardIds:[],ownedVariants:[],cardProgression:{},collectionProgress:0,...extra});

test('first collection contains twenty real characters, five defaults, real story gates and existing art',()=>{
  const expectedCount = 25 + (ANUNAKI_EVENT_GAMEPLAY_READY ? 2 : 0);
  assert.equal(PLAYER_MATS.length,expectedCount);assert.equal(new Set(PLAYER_MATS.map(m=>m.id)).size,expectedCount);
  assert.equal(PLAYER_MATS.filter(m=>m.source==='shop').length,15);
  assert.equal(PLAYER_MATS.filter(m=>m.source==='story').length,5);
  for(const id of ['kyle','guap','captain-jigga','ashlee','simmy'])assert(PLAYER_MATS.some(m=>m.characterId===id));
  for(const mat of PLAYER_MATS){
    for(const asset of [mat.assetId,mat.posterAssetId,mat.portraitAssetId,mat.characterAssetId].filter(Boolean))assert(existsSync(`../squabblemon/public/${asset}`),asset);
    if(mat.characterId){assert(catalogCardById[mat.characterId]);if(mat.source!=='event'){assert(mat.laneScene);assert(mat.posterAssetId);}assert(mat.assetId.includes('/player-mats/v4/'));}
    assert(['Common','Uncommon','Rare','Epic','Legendary','Mythical'].includes(mat.rarity));
    if(mat.storyNodeId)assert(getStoryNode(mat.storyNodeId));
  }
});
test('Anunaki mats are event rewards, never shop purchases, and equip only after claim',()=>{
  for (const mat of ANUNAKI_EVENT_PLAYER_MATS) {
    assert.equal(mat.source, 'event');
    assert.equal(PLAYER_MATS.includes(mat), ANUNAKI_EVENT_GAMEPLAY_READY);
    if (!ANUNAKI_EVENT_GAMEPLAY_READY) continue;
    const owner = { ownedCardIds: [], unlockedCosmeticIds: [playerMatUnlockId(mat.id)] };
    assert(!ownsPlayerMat({}, mat.id));
    assert(ownsPlayerMat(owner, mat.id));
    assert.equal(validateCosmeticLoadout(owner, {playerMatId: mat.id}), null);
    assert.throws(() => planShopPurchase(wallet(), {itemId: 'player-mat', cardId: mat.characterId}), /not sold/);
  }
});
test('Anunaki stickers require the earned pack and character and cannot be purchased',()=>{
  for (const cardId of ['yakub', 'anu']) {
    const sticker = `${cardId}:arrival-sticker`;
    assert.equal(!!stickerById(sticker), ANUNAKI_EVENT_GAMEPLAY_READY);
    assert.equal(avatarSticker(`sticker:${sticker}`), undefined, 'reward stickers cannot bypass ownership as free avatars');
    if (!ANUNAKI_EVENT_GAMEPLAY_READY) continue;
    const unlock = cosmeticId(cardId, 'character-stickers');
    const owner = { ownedCardIds: [cardId], unlockedCosmeticIds: [unlock] };
    assert(!ownsStyle({ownedCardIds: [cardId]}, cardId, 'character-stickers'));
    assert(!ownsStyle({ownedCardIds: [], unlockedCosmeticIds: [unlock]}, cardId, 'character-stickers'));
    assert(validateCosmeticLoadout({ownedCardIds: [cardId]}, {bannerCardId: cardId, stickers: [sticker]}));
    assert.equal(validateCosmeticLoadout(owner, {bannerCardId: cardId, stickers: [sticker]}), null);
    assert.throws(() => planShopPurchase(wallet({ownedCardIds: [cardId]}), {itemId: 'character-stickers', cardId}), /event roadmap/);
  }
});
test('mat purchase spends matching shards then universal, never grants a playable character',()=>{
  const original=wallet({styleShards:100,styleShardBalances:{Legendary:150,Mythical:200}});
  const result=planShopPurchase(original,{itemId:'player-mat',cardId:'kyle'});
  assert.equal(result.receipt.cost,200);assert.equal(result.wallet.styleShards,50);
  assert.equal(result.wallet.styleShardBalances?.Legendary,0);assert.equal(result.wallet.styleShardBalances?.Mythical,200);
  assert.deepEqual(result.wallet.ownedCardIds,[]);assert.equal(result.wallet.softCurrency,100);
  assert(ownsPlayerMat(result.wallet,'signature-kyle'));assert.equal(original.styleShards,100);
  assert.throws(()=>planShopPurchase(result.wallet,{itemId:'player-mat',cardId:'kyle'}),/already own/);
  assert.throws(()=>planShopPurchase(wallet({styleShards:0,styleShardBalances:{Common:9999}}),{itemId:'player-mat',cardId:'guap'}),/shards/i);
  for(const id of ['dr-fade','cornball','invented'])assert.throws(()=>planShopPurchase(wallet(),{itemId:'player-mat',cardId:id}));
});
test('all fifteen shop mats charge their explicit rarity and preserve unrelated balances',()=>{
  for(const mat of PLAYER_MATS.filter(m=>m.source==='shop')){
    const original=wallet({styleShards:0,styleShardBalances:{[mat.rarity]:mat.price,Common:99}});
    const result=planShopPurchase(original,{itemId:'player-mat',cardId:mat.characterId});
    assert.equal(result.receipt.shardPayment?.rarity,mat.rarity);
    assert.equal(result.receipt.cost,mat.price);
    assert.equal(result.wallet.styleShardBalances?.[mat.rarity],0);
    assert.equal(result.wallet.styleShardBalances?.Common,99);
    assert(ownsPlayerMat(result.wallet,mat.id));
    assert.equal(validateCosmeticLoadout(result.wallet,{playerMatId:mat.id}),null);
    assert.throws(()=>planShopPurchase(wallet({styleShards:mat.price-1}),{itemId:'player-mat',cardId:mat.characterId}),/shards/i);
  }
});
test('all five story rewards equip from existing verified clears and cannot be bought',()=>{
  for(const mat of PLAYER_MATS.filter(m=>m.source==='story')){
    const owner={ownedCardIds:[],storyProgress:{[mat.storyNodeId!]:{cleared:true}}};
    assert(ownsPlayerMat(owner,mat.id));
    assert.equal(validateCosmeticLoadout(owner,{playerMatId:mat.id}),null);
    assert.throws(()=>planShopPurchase(wallet(),{itemId:'player-mat',cardId:mat.characterId}),/not sold/);
  }
});
test('only verified story completion grants story mats; old clears work without repurchase',()=>{
  assert(ownsPlayerMat({},'corner-store'));assert(!ownsPlayerMat({},'signature-abuela'));
  for(const cleared of [false,'true',1])assert(!ownsPlayerMat({storyProgress:{'red-tapes-mama-has-the-floor':{cleared}}},'signature-abuela'));
  const owner={ownedCardIds:[],storyProgress:{'red-tapes-mama-has-the-floor':{cleared:true}}};
  assert(ownsPlayerMat(owner,'signature-abuela'));assert.equal(validateCosmeticLoadout(owner,{playerMatId:'signature-abuela'}),null);
  assert(validateCosmeticLoadout({ownedCardIds:[]},{playerMatId:'signature-guap'}));
  assert(validateCosmeticLoadout(owner,{playerMatId:'https://bad.invalid/art'}));
  assert.equal(equippedPlayerMat({settings:{cosmetics:{playerMatId:'unknown'}}}),'corner-store');
});
test('API schemas admit mat IDs and reject injected assets or pricing',()=>{
  assert(EquipPlayerCosmeticsBody.strict().safeParse({playerMatId:'signature-kyle'}).success);
  assert(!EquipPlayerCosmeticsBody.strict().safeParse({playerMatId:'signature-kyle',assetId:'bad'}).success);
  assert(!PurchasePlayerShopItemBody.strict().safeParse({idempotencyKey:randomUUID(),itemId:'player-mat',cardId:'guap',price:0}).success);
});
test('database: retry, overspend, equip, reload, story ownership and PvP snapshot', {skip:!process.env.DATABASE_URL},async t=>{
  const {db,playerProfilesTable}=await import('@workspace/db');const {eq}=await import('drizzle-orm');
  const {purchaseShopItem}=await import('./shopTransactions');const {equipCosmetics}=await import('./cosmeticTransactions');const {loadMember}=await import('./onlineMatches');
  const id=`mat-test-${randomUUID()}`,recipe=starterRecipes[0];
  await db.insert(playerProfilesTable).values({clerkUserId:id,onboardingStep:'complete',styleShards:300,styleShardBalances:{Legendary:100},ownedCardIds:[...recipe.catalogCardIds],settings:{reducedMotion:true,turnTimerEnabled:false},storyProgress:{'welcome-to-the-block':{cleared:true}}});
  t.after(async()=>{await db.delete(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId,id));});
  await assert.rejects(()=>equipCosmetics(id,{playerMatId:'signature-guap'}),/Unlock/);
  const request={idempotencyKey:randomUUID(),itemId:'player-mat' as const,cardId:'kyle'};
  const receipts=await Promise.all([purchaseShopItem(id,request),purchaseShopItem(id,request)]);
  assert.equal(receipts.filter(r=>r.alreadyPurchased).length,1);
  await assert.rejects(()=>purchaseShopItem(id,{...request,cardId:'guap'}),/different purchase/);
  let [profile]=await db.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId,id));
  assert.equal(profile.styleShards,200);assert(profile.unlockedCosmeticIds.includes(playerMatUnlockId('signature-kyle')));
  const buys=await Promise.allSettled(['stockz','bushedo-brown'].map(cardId=>purchaseShopItem(id,{idempotencyKey:randomUUID(),itemId:'player-mat',cardId})));
  assert.equal(buys.filter(r=>r.status==='fulfilled').length,1);
  await equipCosmetics(id,{playerMatId:'signature-kyle'});
  [profile]=await db.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId,id));
  assert.equal(profile.settings.cosmetics?.playerMatId,'signature-kyle');assert.equal(profile.settings.reducedMotion,true);
  const issued=await db.transaction(tx=>loadMember(tx,id,recipe.id));assert.equal(issued.playerMatId,'signature-kyle');
  await equipCosmetics(id,{playerMatId:'signature-dr-fade'});
  assert.equal(issued.playerMatId,'signature-kyle','issued room stays stable when equipment changes');
  assert.equal((await db.transaction(tx=>loadMember(tx,id,recipe.id))).playerMatId,'signature-dr-fade');
});
