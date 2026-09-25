import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { accountLevelFromXp, battleEarnings, LEGACY_ECONOMY_VERSION, planShopPurchase, type ShopWallet } from '@workspace/squabblemon-engine/economy';
import { normalizeCardProgress } from '@workspace/squabblemon-engine/cardProgression';
import { createAbilityUpgradeSnapshot, validateAbilityUpgradeSnapshot } from '@workspace/squabblemon-engine/abilityUpgrades';
import { createCardProgressionSnapshot, parseCardProgressionSnapshot, applyCardXp } from './cardProgression';

const wallet = (overrides: Partial<ShopWallet> = {}): ShopWallet => ({ softCurrency: 3000, packTickets: 0, styleShards: 200, deckSlots: 4,
  ownedCardIds: ['cornball'], discoveredCardIds: ['cornball'], ownedVariants: [], collectionProgress: 1,
  cardProgression: { cornball: { xp: 0, level: 1, moveTier: 0 } }, ...overrides });

test('account XP level helper is stable at every level boundary', () => {
  assert.equal(accountLevelFromXp(-1), 1);
  assert.equal(accountLevelFromXp(0), 1);
  assert.equal(accountLevelFromXp(249), 1);
  assert.equal(accountLevelFromXp(250), 2);
  assert.equal(accountLevelFromXp(499), 2);
  assert.equal(accountLevelFromXp(500), 3);
});

test('starter Clout covers training and first move coaching; buying never mutates the input', () => {
  const initial = wallet({ softCurrency: 250 });
  const trained = planShopPurchase(initial, { itemId: 'training', cardId: 'cornball' });
  assert.deepEqual(trained.wallet.cardProgression.cornball, { xp: 100, level: 2, moveTier: 0 });
  const coached = planShopPurchase(trained.wallet, { itemId: 'move-training', cardId: 'cornball' });
  assert.equal(coached.wallet.softCurrency, 50);
  assert.equal(coached.wallet.cardProgression.cornball.moveTier, 1);
  assert.equal(initial.softCurrency, 250);
  assert.equal(initial.cardProgression.cornball.xp, 0);
});

test('training respects XP cap, proportionate pricing, ownership, and funds', () => {
  const nearCap = planShopPurchase(wallet({ cardProgression: { cornball: { xp: 4490, level: 9, moveTier: 2 } } }), { itemId: 'training-intensive', cardId: 'cornball' });
  assert.equal(nearCap.receipt.cost, 9);
  assert.equal(nearCap.wallet.cardProgression.cornball.xp, 4500);
  assert.equal(nearCap.wallet.cardProgression.cornball.moveTier, 2);
  assert.throws(() => planShopPurchase(nearCap.wallet, { itemId: 'training', cardId: 'cornball' }), /maximum/);
  assert.throws(() => planShopPurchase(wallet({ softCurrency: 0 }), { itemId: 'training', cardId: 'cornball' }), /Clout/);
  assert.throws(() => planShopPurchase(wallet(), { itemId: 'training', cardId: 'young-bull' }), /Unlock/);
});

test('move tiers require levels, charge 100/250/500, and preserve legacy-earned tiers', () => {
  assert.throws(() => planShopPurchase(wallet(), { itemId: 'move-training', cardId: 'cornball' }), /level 2/);
  let w = wallet({ cardProgression: { cornball: { xp: 2800, level: 8, moveTier: 0 } } });
  for (const [index, cost] of [100, 250, 500].entries()) {
    const result = planShopPurchase(w, { itemId: 'move-training', cardId: 'cornball' });
    assert.equal(result.receipt.cost, cost); assert.equal(result.wallet.cardProgression.cornball.moveTier, index + 1); w = result.wallet;
  }
  assert.throws(() => planShopPurchase(w, { itemId: 'move-training', cardId: 'cornball' }), /already active/);
  assert.equal(normalizeCardProgress({ xp: 1000, level: 5 }).moveTier, 2);
  assert.equal(normalizeCardProgress({ xp: 1000, level: 5, moveTier: 0 }).moveTier, 0);
});

test('tickets, slots, recruitment and styles use the correct currency and reject repeat ownership', () => {
  assert.equal(planShopPurchase(wallet(), { itemId: 'ticket' }).wallet.packTickets, 1);
  assert.equal(planShopPurchase(wallet(), { itemId: 'deck-slot' }).wallet.deckSlots, 5);
  assert.throws(() => planShopPurchase(wallet({ deckSlots: 24 }), { itemId: 'deck-slot' }), /24/);
  const recruited = planShopPurchase(wallet(), { itemId: 'common-recruit', cardId: 'young-bull' }).wallet;
  assert(recruited.ownedCardIds.includes('young-bull')); assert(recruited.discoveredCardIds.includes('young-bull'));
  assert.equal(recruited.cardProgression['young-bull'].moveTier, 0);
  assert.throws(() => planShopPurchase(recruited, { itemId: 'common-recruit', cardId: 'young-bull' }), /already own/);
  assert.throws(() => planShopPurchase(wallet(), { itemId: 'common-recruit', cardId: 'techbro-rich' }), /Common/);
  const styled = planShopPurchase(wallet(), { itemId: 'tagged-style', cardId: 'cornball' }).wallet;
  assert.equal(styled.styleShards, 120); assert.equal(styled.softCurrency, 3000);
  assert.throws(() => planShopPurchase(styled, { itemId: 'tagged-style', cardId: 'cornball' }), /already own/);
});

test('XP does not activate unpurchased moves and an active fade retains its starting moves', () => {
  const initial = wallet({ cardProgression: { cornball: { xp: 100, level: 2, moveTier: 0 } } });
  const snapshot = createCardProgressionSnapshot(['cornball'], ['cornball'], initial.cardProgression);
  const purchased = planShopPurchase(initial, { itemId: 'move-training', cardId: 'cornball' });
  assert.equal(snapshot.abilityUpgradeSnapshot.player[0].upgradeIds.length, 0);
  assert.equal(createCardProgressionSnapshot(['cornball'], ['cornball'], purchased.wallet.cardProgression).abilityUpgradeSnapshot.player[0].upgradeIds.length, 1);
  assert.deepEqual(parseCardProgressionSnapshot(snapshot, ['cornball'], []), snapshot);
  const earned = applyCardXp(initial.cardProgression, snapshot, ['cornball'], 'win');
  assert.equal(earned.progression.cornball.moveTier, 0);
  const engineSnapshot = createAbilityUpgradeSnapshot(['cornball'], [], { player: initial.cardProgression });
  assert.throws(() => validateAbilityUpgradeSnapshot({ ...engineSnapshot, player: [{ ...engineSnapshot.player[0], upgradeIds: ['cornball:upgrade:1'] }] }, ['cornball'], []), /Forged/);
});

test('verified battle earnings cover wins, draws and losses without generating repeatable tickets', () => {
  assert.deepEqual(['win', 'draw', 'loss'].map(outcome => battleEarnings(outcome as 'win').softCurrency), [80, 60, 40]);
  assert.deepEqual(['win', 'draw', 'loss'].map(outcome => battleEarnings(outcome as 'win', LEGACY_ECONOMY_VERSION).softCurrency), [40, 30, 20]);
  assert.equal(battleEarnings('win').packTickets, 0);
});

test('database: simultaneous shop retries charge once and reject a changed request', { skip: !process.env.DATABASE_URL }, async t => {
  const { db, playerProfilesTable } = await import('@workspace/db');
  const { eq } = await import('drizzle-orm');
  const { purchaseShopItem } = await import('./shopTransactions');
  const id = `shop-test-${randomUUID()}`;
  await db.insert(playerProfilesTable).values({ clerkUserId: id, onboardingStep: 'complete', softCurrency: 400 });
  t.after(async () => { await db.delete(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, id)); });
  const input = { itemId: 'ticket' as const, idempotencyKey: randomUUID() };
  const results = await Promise.all([purchaseShopItem(id, input), purchaseShopItem(id, input)]);
  assert.equal(results.filter(result => result.alreadyPurchased).length, 1);
  const [profile] = await db.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, id));
  assert.equal(profile.softCurrency, 200); assert.equal(profile.packTickets, 1);
  await assert.rejects(purchaseShopItem(id, { ...input, itemId: 'deck-slot' }), /different purchase/);
});

test('database: separate simultaneous purchases cannot overspend the same wallet', { skip: !process.env.DATABASE_URL }, async t => {
  const { db, playerProfilesTable } = await import('@workspace/db');
  const { eq } = await import('drizzle-orm');
  const { purchaseShopItem } = await import('./shopTransactions');
  const id = `shop-spend-${randomUUID()}`;
  t.after(async () => { await db.delete(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId,id)); });
  await db.insert(playerProfilesTable).values({clerkUserId:id,onboardingStep:'complete',softCurrency:250});
  const results = await Promise.allSettled([1,2].map(() => purchaseShopItem(id,{itemId:'ticket',idempotencyKey:randomUUID()})));
  assert.equal(results.filter(result => result.status === 'fulfilled').length,1);
  const [profile] = await db.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId,id));
  assert.equal(profile.softCurrency,50); assert.equal(profile.packTickets,1);
});

test('database: normalization and a fade reward preserve a concurrent purchase', { skip: !process.env.DATABASE_URL }, async t => {
  const { db, playerProfilesTable, playerMatchesTable } = await import('@workspace/db');
  const { eq } = await import('drizzle-orm');
  const { purchaseShopItem } = await import('./shopTransactions');
  const { getPlayerBootstrap } = await import('./playerState');
  const { completeStandardMatchReward } = await import('./playerRewardTransactions');
  const { createMatch } = await import('@workspace/squabblemon-engine/gameEngine');
  const id = `shop-overlap-${randomUUID()}`;
  t.after(async () => { await db.delete(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId,id)); });
  await db.insert(playerProfilesTable).values({clerkUserId:id,onboardingStep:'complete',softCurrency:200,ownedCardIds:['cornball']});
  const [match] = await db.insert(playerMatchesTable).values({clerkUserId:id,mode:'practice',playerDeckId:'block',rivalDeckId:'slide'}).returning();
  await Promise.all([purchaseShopItem(id,{itemId:'training',cardId:'cornball',idempotencyKey:randomUUID()}),getPlayerBootstrap(id),completeStandardMatchReward({clerkUserId:id,matchId:match.id,outcome:'win',districtsWon:1,verifiedMatch:createMatch('block','slide')})]);
  const [profile] = await db.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId,id));
  assert.equal(profile.softCurrency,140);assert.deepEqual(profile.cardProgression.cornball,{xp:100,level:2,moveTier:0});
  assert.equal(profile.xp,50);
});
