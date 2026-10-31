import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { eq } from 'drizzle-orm';
import { db, pool, playerProfilesTable, playerPackOpeningsTable, playerCollectionClaimsTable } from '@workspace/db';
import { openStreetPackForPlayer, EconomyTransactionError } from './collectionTransactions';
import { redeemPromoCode } from './promoCodeTransactions';
import { findPromoCode } from './promoCodes';
import { normalizeCardProgress } from '@workspace/squabblemon-engine/cardProgression';
import { ANUNAKI_BANNER_CARD_IDS } from '@workspace/squabblemon-engine/anunakiBanner';
const owned = process.env.FEATURED_PULLS_TEST_OWNED === '1';
const fixture = async (t: any, values: Partial<typeof playerProfilesTable.$inferInsert> = {}) => {
  const id = `featured-native-${randomUUID()}`;
  await db.insert(playerProfilesTable).values({ clerkUserId: id, onboardingStep: 'complete', packTickets: 20, ...values });
  t.after(() => db.delete(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, id)));
  return id;
};
const profile = async (id: string) => (await db.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, id)))[0];
const request = () => ({ idempotencyKey: randomUUID(), paymentMethod: 'ticket' as const, bannerId: 'anunaki', bannerOccurrenceId: 'anunaki:2026-11-02' });
test('two independent native writers serialize the same family guarantee with one payment per saved opening', { skip: !owned }, async t => {
  t.mock.method(Date, 'now', () => Date.parse('2026-11-02T12:00:00Z'));
  const id = await fixture(t, { featuredPackProgress: { anunaki: { misses: 9, packs: 9 }, inmates: { misses: 8, packs: 18 } } });
  const blocker = await pool.connect();
  await blocker.query('begin');
  await blocker.query('select clerk_user_id from player_profiles where clerk_user_id=$1 for update', [id]);
  const requests = [request(), request()];
  const pending = requests.map(input => openStreetPackForPlayer(id, input));
  try {
    let waiting = 0;
    for (let i = 0; i < 100; i++) {
      const result = await blocker.query("select count(*)::int as count from pg_stat_activity where wait_event_type='Lock' and query like '%player_profiles%'");
      waiting = result.rows[0].count;
      if (waiting >= 2) break;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    assert(waiting >= 2, 'independent backend connections must both wait for the profile lock');
  } finally { await blocker.query('commit'); blocker.release(); }
  const result = await Promise.all(pending);
  const progress = result.map(r => r.opening.featuredProgress!).sort((a, b) => a.packsBefore - b.packsBefore);
  assert.equal(progress[0].missesBefore, 9);
  assert.equal(progress[0].hits.length, 1);
  assert.equal(progress[0].hits[0].guaranteed, true);
  assert.equal(progress[0].missesAfter, 0);
  assert.equal(progress[1].missesBefore, progress[0].missesAfter);
  assert.equal(progress[1].packsBefore, progress[0].packsAfter);
  const saved = await profile(id);
  assert.equal(saved.packTickets, 18);
  assert.deepEqual(saved.featuredPackProgress.inmates, { misses: 8, packs: 18 });
  assert.equal(saved.featuredPackProgress.anunaki.packs, 11);
});
test('retry after expiry returns the identical receipt and rejects key reuse with changed intent', { skip: !owned }, async t => {
  let now = Date.parse('2026-11-02T12:00:00Z'); t.mock.method(Date, 'now', () => now);
  const id = await fixture(t, { featuredPackProgress: { anunaki: { misses: 9, packs: 9 } } });
  const input = request();
  const [first, raced] = await Promise.all([openStreetPackForPlayer(id, input), openStreetPackForPlayer(id, input)]);
  assert.deepEqual(first.opening, raced.opening);
  assert.equal((await profile(id)).packTickets, 19);
  now = Date.parse('2026-11-20T12:00:00Z');
  const retry = await openStreetPackForPlayer(id, input);
  assert.deepEqual(first.opening, retry.opening);
  const before = await profile(id);
  for (const change of [{ pullCount: 2 }, { paymentMethod: 'softCurrency' as const }, { bannerId: 'oz' }, { bannerOccurrenceId: 'anunaki:2026-12-07' }]) {
    await assert.rejects(openStreetPackForPlayer(id, { ...input, ...change }), (error: unknown) => error instanceof EconomyTransactionError && error.status === 409);
  }
  assert.deepEqual(await profile(id), before);
  assert.equal((await db.select().from(playerPackOpeningsTable).where(eq(playerPackOpeningsTable.clerkUserId, id))).length, 1);
});
test('returning monthly occurrence continues family progress and closed/failed purchases do not advance it', { skip: !owned }, async t => {
  let now = Date.parse('2026-11-20T12:00:00Z'); t.mock.method(Date, 'now', () => now);
  const id = await fixture(t, { packTickets: 0, featuredPackProgress: { anunaki: { misses: 9, packs: 29 } } });
  const before = await profile(id);
  await assert.rejects(openStreetPackForPlayer(id, request()), /unavailable/);
  now = Date.parse('2026-12-07T00:00:00Z');
  const monthly = { ...request(), bannerOccurrenceId: 'anunaki:2026-12-07' };
  await assert.rejects(openStreetPackForPlayer(id, monthly), /need/);
  assert.deepEqual(await profile(id), before);
  await db.update(playerProfilesTable).set({ packTickets: 1 }).where(eq(playerProfilesTable.clerkUserId, id));
  const result = await openStreetPackForPlayer(id, monthly);
  assert.equal(result.opening.featuredProgress?.missesBefore, 9);
  assert.equal(result.opening.featuredProgress?.packsAfter, 30);
  assert(result.opening.featuredProgress?.hits[0].guaranteed);
  assert(ANUNAKI_BANNER_CARD_IDS.includes(result.opening.rewards[4].cardId as any));
});
test('live beta dev code is switch-controlled, once per account and preserves upgrades, wallets and both pity systems', { skip: !owned }, async t => {
  const original = process.env.ANUNAKI_BETA_CODE_ENABLED;
  t.after(() => { if (original === undefined) delete process.env.ANUNAKI_BETA_CODE_ENABLED; else process.env.ANUNAKI_BETA_CODE_ENABLED = original; });
  delete process.env.ANUNAKI_BETA_CODE_ENABLED;
  assert.equal(findPromoCode('DEVANUNAKI', 'production'), null);
  const progress = normalizeCardProgress({ xp: 2500, level: 10, moveTier: 2 });
  const id = await fixture(t, { ownedCardIds: ['anu'], cardProgression: { anu: progress }, packPity: 7, featuredPackProgress: { anunaki: { misses: 9, packs: 9 } } });
  const before = await profile(id);
  await assert.rejects(redeemPromoCode(id, 'DEVANUNAKI'), /not available/);
  process.env.ANUNAKI_BETA_CODE_ENABLED = 'true';
  assert.equal(findPromoCode('devanunaki', 'production')?.cardIds?.length, 10);
  const [first, retry] = await Promise.all([redeemPromoCode(id, 'DEVANUNAKI'), redeemPromoCode(id, 'devanunaki')]);
  assert.deepEqual(first.receipt, retry.receipt);
  const after = await profile(id);
  assert.equal(after.ownedCardIds.length, 10);
  assert.deepEqual(after.cardProgression.anu, before.cardProgression.anu);
  assert.equal(after.packTickets, before.packTickets);
  assert.equal(after.softCurrency, before.softCurrency);
  assert.equal(after.packPity, 7);
  assert.deepEqual(after.featuredPackProgress, before.featuredPackProgress);
  assert.equal((await db.select().from(playerCollectionClaimsTable).where(eq(playerCollectionClaimsTable.clerkUserId, id))).length, 1);
  delete process.env.ANUNAKI_BETA_CODE_ENABLED;
  assert.equal((await redeemPromoCode(id, 'DEVANUNAKI')).alreadyRedeemed, true);
});
