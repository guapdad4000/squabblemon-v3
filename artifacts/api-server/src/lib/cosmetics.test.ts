import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { planShopPurchase, type ShopWallet } from '@workspace/squabblemon-engine/economy';
import { cosmeticId, validateCosmeticLoadout, CHARACTER_STYLE_SETS } from '@workspace/squabblemon-engine/cosmetics';
import { EquipPlayerCosmeticsBody } from '@workspace/api-zod';
const wallet = (overrides: Partial<ShopWallet> = {}): ShopWallet => ({ softCurrency: 400, packTickets: 2, styleShards: 500, deckSlots: 4, ownedCardIds: ['kyle'], discoveredCardIds: ['kyle'], ownedVariants: [], unlockedCosmeticIds: ['badge:earned'], cardProgression: {}, collectionProgress: 1, ...overrides });
test('character cosmetics debit only Style Shards, retain badges, and never change card strength', () => {
  const original = wallet(); let current = original;
  for (const itemId of ['character-stickers','character-backdrop','character-banner-finish'] as const) current = planShopPurchase(current, { itemId, cardId: 'kyle' }).wallet;
  assert.equal(current.styleShards, 220); assert.equal(current.softCurrency, 400); assert.equal(current.packTickets, 2);
  assert.deepEqual(current.cardProgression, {}); assert.equal(current.ownedVariants.length, 0);
  assert.equal(original.styleShards, 500); assert.equal(current.unlockedCosmeticIds?.length, 4);
  assert(current.unlockedCosmeticIds?.includes('badge:earned'));
  assert.throws(() => planShopPurchase(current, { itemId:'character-stickers',cardId:'kyle' }), /already own/);
});
test('purchases reject unowned fighters, insufficient funds, and unfinished character collections', () => {
  assert.throws(() => planShopPurchase(wallet({ownedCardIds:[]}), {itemId:'character-stickers',cardId:'kyle'}), /Unlock/);
  assert.throws(() => planShopPurchase(wallet({styleShards:99}), {itemId:'character-stickers',cardId:'kyle'}), /100/);
  assert.throws(() => planShopPurchase(wallet({ownedCardIds:['cornball']}), {itemId:'character-stickers',cardId:'cornball'}), /not ready/);
});
test('base banner is included; paid scenes, finish and individual stickers require ownership', () => {
  assert.equal(validateCosmeticLoadout(wallet(), {bannerCardId:'kyle',bannerFinish:'base'}), null);
  assert.match(validateCosmeticLoadout(wallet(), {bannerCardId:'kyle',bannerFinish:'silver'})!, /Unlock/);
  assert.match(validateCosmeticLoadout(wallet(), {bannerCardId:'kyle',stickers:['kyle:smile']})!, /Unlock/);
  assert.match(validateCosmeticLoadout(wallet(), {cardBackgrounds:{kyle:'blue-hour'}})!, /Unlock/);
  const owner=wallet({unlockedCosmeticIds:['character-stickers','character-backdrop','character-banner-finish'].map(kind=>cosmeticId('kyle',kind as any))});
  assert.equal(validateCosmeticLoadout(owner,{bannerCardId:'kyle',bannerFinish:'silver',stickers:['kyle:point','kyle:smile','kyle:kicks'],cardBackgrounds:{kyle:'blue-hour'}}),null);
  assert.match(validateCosmeticLoadout(owner,{bannerCardId:'kyle',stickers:['kyle:smile','kyle:smile']})!,/different/);
  assert.match(validateCosmeticLoadout(owner,{bannerCardId:'kyle',stickers:CHARACTER_STYLE_SETS.kyle.stickers.map(s=>s.id)})!,/three/);
  assert.match(validateCosmeticLoadout(owner,{bannerCardId:'constructor'})!,/Unlock/);
  assert.equal(EquipPlayerCosmeticsBody.strict().safeParse({styleShards:5000}).success,false);
  assert.equal(EquipPlayerCosmeticsBody.safeParse({cardBackgrounds:{kyle:'forged-scene'}}).success,false);
  assert.equal(validateCosmeticLoadout(owner,{}),null);
});
test('database: retry-safe purchase and equip persist across reload without overwriting settings or earned badges', {skip:process.env.CAMPAIGN_DATABASE_TESTS !== '1' || !process.env.DATABASE_URL}, async t => {
  const {db,pool,playerProfilesTable}=await import('@workspace/db');
  const {eq}=await import('drizzle-orm');const {purchaseShopItem}=await import('./shopTransactions');const {equipCosmetics}=await import('./cosmeticTransactions');
  const id='cosmetics-'+randomUUID();t.after(async()=>{await db.delete(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId,id));await pool.end();});
  await db.insert(playerProfilesTable).values({clerkUserId:id,onboardingStep:'complete',ownedCardIds:['kyle'],styleShards:100,unlockedCosmeticIds:['badge:earned'],settings:{reducedMotion:true,turnTimerEnabled:false}});
  const input={idempotencyKey:randomUUID(),itemId:'character-stickers' as const,cardId:'kyle'};
  const results=await Promise.all([purchaseShopItem(id,input),purchaseShopItem(id,input)]);assert.equal(results.filter(r=>r.alreadyPurchased).length,1);
  await assert.rejects(purchaseShopItem(id,{...input,itemId:'character-backdrop'}),/different purchase/);
  await assert.rejects(purchaseShopItem(id,{...input,idempotencyKey:randomUUID()}),/already own/);
  await assert.rejects(equipCosmetics(id,{bannerCardId:'kyle',bannerFinish:'silver'}),/Unlock/);
  await equipCosmetics(id,{bannerCardId:'kyle',stickers:['kyle:smile','kyle:star']});
  const [row]=await db.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId,id));
  assert.equal(row.styleShards,0);assert.equal(row.settings.reducedMotion,true);assert.equal(row.settings.turnTimerEnabled,false);assert.deepEqual(row.settings.cosmetics?.stickers,['kyle:smile','kyle:star']);assert(row.unlockedCosmeticIds.includes('badge:earned'));
});
