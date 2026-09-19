import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { CARD_XP_CAP } from '@workspace/squabblemon-engine/cardProgression';
import { catalogCardById } from '@workspace/squabblemon-engine/data';
import { planShopPurchase, type ShopWallet } from '@workspace/squabblemon-engine/economy';
import { findPromoCode, isDevelopmentPromoCodeEnabled } from './promoCodes';

test('public promo lookup accepts normalization and rejects unknown or inherited keys', () => {
  assert.deepEqual(findPromoCode(' simmyfoodz ', 'production'), { code: 'SIMMYFOODZ', packTickets: 0, softCurrency: 0, styleShards: 0, cardIds: ['simmy', 'foodz'] });
  assert.deepEqual(findPromoCode(' citylegends ', 'production'), { code: 'CITYLEGENDS', packTickets: 0, softCurrency: 40_000, styleShards: 0,
    cardIds: ['dragonfly-jones', 'sho-nuff', 'yasuke', 'mansa-musa', 'tron', 'john-henry', 'leroy'] });
  for (const code of ['', ' ', 'DEV TEST', 'NOTREAL', '__proto__', 'constructor', 'toString']) assert.equal(findPromoCode(code, 'development'), null);
});

test('internal test promos are available only in development', () => {
  const internalPromos = {
    DEVTEST: { code: 'DEVTEST', packTickets: 100, softCurrency: 25_000, styleShards: 5_000 },
    DEVTEST2: { code: 'DEVTEST2', packTickets: 100, softCurrency: 25_000, styleShards: 5_000 },
    JETSETCABIN: { code: 'JETSETCABIN', packTickets: 25, softCurrency: 10_000, styleShards: 0,
      cardIds: ['ashlee', 'captain-jigga'] },
  } as const;
  for (const [code, reward] of Object.entries(internalPromos)) {
    assert.deepEqual(findPromoCode(' ' + code.toLowerCase() + '\n', 'development'), reward);
    assert.equal(findPromoCode(code, 'production'), null);
    assert.equal(findPromoCode(code, 'test'), null);
    assert.equal(findPromoCode(code, ''), null);
  }
  assert.equal(isDevelopmentPromoCodeEnabled('development'), true);
  assert.equal(isDevelopmentPromoCodeEnabled('production'), false);
  assert.equal(isDevelopmentPromoCodeEnabled(''), false);
  assert.equal(findPromoCode('CITYLEGENDS', 'production')?.code, 'CITYLEGENDS');
});

test('City Legends grant covers all seven fighters through max level and three coached moves', () => {
  const reward = findPromoCode('CITYLEGENDS')!;
  const ids = reward.cardIds!;
  assert.equal(ids.length, 7);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.equal(catalogCardById[id]?.faction, 'City Legends', id);
  let wallet: ShopWallet = { softCurrency: reward.softCurrency, packTickets: 0, styleShards: 0, deckSlots: 1,
    ownedCardIds: [...ids], discoveredCardIds: [...ids], ownedVariants: [], cardProgression: {}, collectionProgress: ids.length };
  for (const id of ids) {
    while ((wallet.cardProgression[id]?.xp ?? 0) < CARD_XP_CAP) {
      wallet = planShopPurchase(wallet, { itemId: 'training-intensive', cardId: id }).wallet;
    }
    for (let tier = 0; tier < 3; tier++) wallet = planShopPurchase(wallet, { itemId: 'move-training', cardId: id }).wallet;
    assert.equal(wallet.cardProgression[id].level, 10);
    assert.equal(wallet.cardProgression[id].moveTier, 3);
  }
  assert(wallet.softCurrency >= 0);
});

test('promo redemption persists rewards once and works with the real economy', { skip: !process.env.DATABASE_URL }, async t => {
  const originalNodeEnvironment = process.env.NODE_ENV;
  process.env.NODE_ENV = 'development';
  t.after(() => {
    if (originalNodeEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnvironment;
  });
  const { default: express } = await import('express');
  const { db, pool, playerProfilesTable, playerCollectionClaimsTable } = await import('@workspace/db');
  const { eq } = await import('drizzle-orm');
  const { default: router } = await import('../routes/promoCodes');
  const { redeemPromoCode } = await import('./promoCodeTransactions');
  const { getPlayerBootstrap } = await import('./playerState');
  const { openStreetPackForPlayer } = await import('./collectionTransactions');
  const { purchaseShopItem } = await import('./shopTransactions');
  const ids: string[] = [];
  const createPlayer = async (overrides: Partial<typeof playerProfilesTable.$inferInsert> = {}) => {
    const userId = `promo-test-${randomUUID()}`;
    ids.push(userId);
    await db.insert(playerProfilesTable).values({ clerkUserId: userId, onboardingStep: 'complete', packTickets: 3, softCurrency: 700, styleShards: 20, ownedCardIds: ['cornball'], ...overrides });
    return userId;
  };
  const profile = async (userId: string) => (await db.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, userId)))[0];
  const claims = async (userId: string) => db.select().from(playerCollectionClaimsTable).where(eq(playerCollectionClaimsTable.clerkUserId, userId));
  const app = express();
  app.use(express.json());
  // This local test server alone supplies mock Clerk sessions.
  app.use((req, _res, next) => {
    const userId = req.header('x-test-user') ?? null;
    (req as any).auth = Object.assign(() => ({ userId, sessionId: 'test', tokenType: 'session_token', isAuthenticated: !!userId }), { [Symbol.for('@clerk/express.auth')]: true });
    next();
  });
  app.use('/api', router);
  app.use((error: Error, _req: unknown, res: import('express').Response, _next: unknown) => { res.status(500).json({ error: error.message }); });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  t.after(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
    for (const id of ids) await db.delete(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, id));
    await pool.end();
  });
  const address = server.address() as { port: number };
  const post = async (body: unknown, userId?: string) => {
    const res = await fetch(`http://127.0.0.1:${address.port}/api/player/promo-codes/redeem`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(userId ? { 'x-test-user': userId } : {}) }, body: JSON.stringify(body) });
    return { status: res.status, body: await res.json() as any };
  };

  await t.test('requires authentication and rejects malformed or client-supplied rewards', async () => {
    assert.equal((await post({ code: 'DEVTEST' })).status, 401);
    const id = await createPlayer();
    for (const body of [{}, { code: 123 }, { code: '' }, { code: ' ' }, { code: 'NOTREAL' }, { code: 'x'.repeat(65) }, { code: 'DEVTEST', packTickets: 999 }, { code: 'DEVTEST', userId: 'another-account' }]) {
      assert.equal((await post(body, id)).status, 400, JSON.stringify(body));
    }
    assert.equal((await claims(id)).length, 0);
    assert.equal((await profile(id)).packTickets, 3);
  });

  await t.test('requires Rookie Road without consuming the code', async () => {
    const id = await createPlayer({ onboardingStep: 'identity' });
    assert.equal((await post({ code: 'DEVTEST' }, id)).status, 409);
    assert.equal((await claims(id)).length, 0);
    assert.equal((await profile(id)).softCurrency, 700);
  });

  await t.test('HTTP redemption returns credited balances and a durable retry receipt', async () => {
    const id = await createPlayer();
    const result = await post({ code: '  devtest  ' }, id);
    assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.equal(result.body.alreadyRedeemed, false);
    assert.equal(result.body.bootstrap.profile.packTickets, 103);
    assert.equal(result.body.bootstrap.profile.softCurrency, 25_700);
    assert.equal(result.body.bootstrap.profile.styleShards, 5_020);
    const repeat = await post({ code: 'DEVTEST' }, id);
    assert.equal(repeat.status, 200);
    assert.equal(repeat.body.alreadyRedeemed, true);
    assert.deepEqual(repeat.body.receipt, result.body.receipt);
    assert.equal((await claims(id)).length, 1);
    assert.equal((await getPlayerBootstrap(id)).profile.packTickets, 103);
  });

  await t.test('simultaneous requests grant only once, independently for each account', async () => {
    const a = await createPlayer(), b = await createPlayer();
    const results = await Promise.all(Array.from({ length: 5 }, (_, i) => redeemPromoCode(a, i % 2 ? 'devtest' : ' DEVTEST ')));
    assert.equal(results.filter(result => !result.alreadyRedeemed).length, 1);
    assert.equal((await profile(a)).packTickets, 103);
    assert.equal((await claims(a)).length, 1);
    assert.equal((await redeemPromoCode(b, 'DEVTEST')).alreadyRedeemed, false);
    assert.equal((await profile(b)).softCurrency, 25_700);
  });

  await t.test('second code grants the same rewards to an account that already used the first', async () => {
    const id = await createPlayer();
    assert.equal((await redeemPromoCode(id, 'DEVTEST')).alreadyRedeemed, false);
    const results = await Promise.all(Array.from({ length: 4 }, () => post({ code: ' devtest2 ' }, id)));
    assert(results.every(result => result.status === 200));
    assert.equal(results.filter(result => !result.body.alreadyRedeemed).length, 1);
    assert(results.every(result => result.body.receipt.code === 'DEVTEST2'));
    const current = await profile(id);
    assert.equal(current.packTickets, 203);
    assert.equal(current.softCurrency, 50_700);
    assert.equal(current.styleShards, 10_020);
    assert.deepEqual((await claims(id)).map(claim => claim.milestoneKey).sort(), ['promo:DEVTEST', 'promo:DEVTEST2']);
    assert.equal((await redeemPromoCode(id, 'DEVTEST')).alreadyRedeemed, true);
    assert.equal((await redeemPromoCode(id, 'DEVTEST2')).alreadyRedeemed, true);
  });

  await t.test('character code grants Simmy and Foodz once and leaves existing copies intact', async () => {
    const id = await createPlayer({ ownedCardIds: ['cornball', 'simmy'], discoveredCardIds: ['cornball', 'simmy'] });
    assert.equal((await redeemPromoCode(id, 'DEVTEST')).alreadyRedeemed, false);
    const results = await Promise.all(Array.from({ length: 4 }, () => post({ code: ' simmyfoodz ' }, id)));
    assert(results.every(result => result.status === 200));
    assert.equal(results.filter(result => !result.body.alreadyRedeemed).length, 1);
    assert(results.every(result => result.body.receipt.code === 'SIMMYFOODZ'));
    assert.deepEqual(results[0].body.receipt.cardIds, ['simmy', 'foodz']);
    const current = await profile(id);
    assert.deepEqual(current.ownedCardIds.filter(id => id === 'simmy' || id === 'foodz').sort(), ['foodz', 'simmy']);
    assert(current.discoveredCardIds.includes('simmy'));
    assert(current.discoveredCardIds.includes('foodz'));
    assert.equal(current.collectionProgress, current.ownedCardIds.length);
    assert.deepEqual(current.cardProgression.foodz, { xp: 0, level: 1, moveTier: 0 });
    assert.equal(current.packTickets, 103);
    assert.equal(current.softCurrency, 25_700);
    assert.equal(current.styleShards, 5_020);
    assert.deepEqual((await claims(id)).map(claim => claim.milestoneKey).sort(), ['promo:DEVTEST', 'promo:SIMMYFOODZ']);
    assert.deepEqual((await getPlayerBootstrap(id)).profile.ownedCardIds.filter(id => id === 'simmy' || id === 'foodz').sort(), ['foodz', 'simmy']);
    assert.equal((await redeemPromoCode(id, 'SIMMYFOODZ')).alreadyRedeemed, true);
  });

  await t.test('character code gives both cards to a fresh collection without spending a pack', async () => {
    const id = await createPlayer();
    const result = await post({ code: 'SIMMYFOODZ' }, id);
    assert.equal(result.status, 200);
    assert.equal(result.body.alreadyRedeemed, false);
    assert.deepEqual(result.body.receipt.cardIds, ['simmy', 'foodz']);
    assert(result.body.bootstrap.profile.ownedCardIds.includes('simmy'));
    assert(result.body.bootstrap.profile.ownedCardIds.includes('foodz'));
    assert.deepEqual(result.body.bootstrap.profile.cardProgression.simmy, { xp: 0, level: 1, moveTier: 0 });
    assert.deepEqual(result.body.bootstrap.profile.cardProgression.foodz, { xp: 0, level: 1, moveTier: 0 });
    assert.equal(result.body.bootstrap.profile.packTickets, 3);
    assert.equal(result.body.bootstrap.profile.softCurrency, 700);
    assert.equal(result.body.bootstrap.profile.styleShards, 20);
  });

  await t.test('City Legends code gives seven cards and Clout once without replacing Leroy progress', async () => {
    const id = await createPlayer({ ownedCardIds: ['cornball', 'leroy'], discoveredCardIds: ['cornball', 'leroy'],
      cardProgression: { leroy: { xp: 300, level: 3, moveTier: 1 } } });
    const result = await post({ code: ' citylegends ' }, id);
    assert.equal(result.status, 200);
    assert.equal(result.body.alreadyRedeemed, false);
    assert.equal(result.body.receipt.softCurrency, 40_000);
    assert.equal(result.body.receipt.cardIds.length, 7);
    const current = await profile(id);
    for (const cardId of result.body.receipt.cardIds) {
      assert(current.ownedCardIds.includes(cardId), cardId);
      assert(current.discoveredCardIds.includes(cardId), cardId);
      assert.equal(current.ownedCardIds.filter(value => value === cardId).length, 1);
    }
    assert.deepEqual(current.cardProgression.leroy, { xp: 300, level: 3, moveTier: 1 });
    assert.deepEqual(current.cardProgression['dragonfly-jones'], { xp: 0, level: 1, moveTier: 0 });
    assert.equal(current.softCurrency, 40_700);
    assert.equal(current.packTickets, 3);
    assert.equal((await redeemPromoCode(id, 'CITYLEGENDS')).alreadyRedeemed, true);
    assert.equal((await profile(id)).softCurrency, 40_700);
  });

  await t.test('concurrent pulls, training and bootstrap retain both the grant and spending', async () => {
    const id = await createPlayer();
    const [, opened] = await Promise.all([
      redeemPromoCode(id, 'DEVTEST'),
      openStreetPackForPlayer(id, { idempotencyKey: randomUUID(), paymentMethod: 'ticket' }),
      purchaseShopItem(id, { itemId: 'training', cardId: 'cornball', idempotencyKey: randomUUID() }),
      getPlayerBootstrap(id),
    ]);
    const rewards = opened.opening.rewards;
    const clout = rewards.filter(reward => reward.kind === 'softCurrency').reduce((total, reward) => total + (reward.amount ?? 0), 0);
    const shards = rewards.filter(reward => reward.kind === 'styleShards').reduce((total, reward) => total + (reward.amount ?? 0), 0);
    const final = await profile(id);
    assert.equal(final.packTickets, 102);
    assert.equal(final.softCurrency, 25_600 + clout);
    assert.equal(final.styleShards, 5_020 + shards);
    assert.equal(final.cardProgression.cornball.xp, 100);
    assert(rewards.some(reward => reward.kind === 'card'));
    assert.equal((await redeemPromoCode(id, 'DEVTEST')).alreadyRedeemed, true);
    assert.equal((await profile(id)).packTickets, 102);
  });

  await t.test('database failure leaves balances and claim unchanged, allowing a later retry', async () => {
    const id = await createPlayer({ styleShards: 2_147_483_647 });
    await assert.rejects(redeemPromoCode(id, 'DEVTEST'), /integer out of range|Failed query/);
    assert.equal((await profile(id)).packTickets, 3);
    assert.equal((await profile(id)).softCurrency, 700);
    assert.equal((await claims(id)).length, 0);
    await db.update(playerProfilesTable).set({ styleShards: 20 }).where(eq(playerProfilesTable.clerkUserId, id));
    assert.equal((await redeemPromoCode(id, 'DEVTEST')).alreadyRedeemed, false);
  });
});
