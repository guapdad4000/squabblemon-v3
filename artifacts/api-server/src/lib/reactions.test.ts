import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { addReaction, ownedReactions, REACTION_PACK_UNLOCK, CHARACTER_REACTION_PACKS } from '@workspace/squabblemon-engine/reactions';

test('reactions enforce ownership, independent seat cooldowns, and idempotent retries', () => {
  const input = { id: 'a', reactionId: 'big-w', seat: 'player' as const, gameNumber: 1 };
  const starters = ownedReactions();
  assert.deepEqual(starters, ['big-w', 'lets-go']);
  assert.equal(ownedReactions([REACTION_PACK_UNLOCK]).length, 4);
  assert.throws(() => addReaction(undefined, { ...input, reactionId: 'hold-that' }, starters, 10000), /Unlock/);
  const first = addReaction(undefined, input, starters, 10000);
  assert.equal(addReaction(first, input, starters, 10001), first);
  assert.throws(() => addReaction(first, { ...input, reactionId: 'lets-go' }, starters, 10001), /already used/);
  assert.throws(() => addReaction(first, { ...input, id: 'b' }, starters, 13999), /moment/);
  const rival = addReaction(first, { ...input, seat: 'cpu', id: 'b' }, starters, 10001);
  assert.equal(rival.revision, 2);
  assert.equal(first.latest.cpu, undefined);
  assert.equal(addReaction(rival, { ...input, id: 'c' }, starters, 14000).revision, 3);
});

test('database: reaction pack retries charge once and preserve other cosmetics', { skip: !process.env.DATABASE_URL }, async t => {
  const { db, playerProfilesTable } = await import('@workspace/db');
  const { eq } = await import('drizzle-orm');
  const { purchaseShopItem } = await import('./shopTransactions');
  const id = `reaction-shop-${randomUUID()}`;
  t.after(async () => { await db.delete(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, id)); });
  await db.insert(playerProfilesTable).values({ clerkUserId: id, onboardingStep: 'complete', softCurrency: 500, unlockedCosmeticIds: ['existing-cosmetic'] });
  const purchase = { itemId: 'reaction-pack' as const, idempotencyKey: randomUUID() };
  const results = await Promise.all([purchaseShopItem(id, purchase), purchaseShopItem(id, purchase)]);
  assert.equal(results.filter(r => r.alreadyPurchased).length, 1);
  const [profile] = await db.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, id));
  assert.equal(profile.softCurrency, 200);
  assert.deepEqual(profile.unlockedCosmeticIds, ['existing-cosmetic', REACTION_PACK_UNLOCK]);
  await assert.rejects(purchaseShopItem(id, { ...purchase, idempotencyKey: randomUUID() }), /already/);
});

test('character packs unlock only their four reactions', () => {
  for (const pack of CHARACTER_REACTION_PACKS) {
    const owned = ownedReactions([pack.unlock]);
    assert.equal(owned.length, 6);
    for (const id of pack.reactionIds) assert(owned.includes(id));
    for (const other of CHARACTER_REACTION_PACKS.filter(other => other.id !== pack.id)) {
      assert(!owned.includes(other.reactionIds[0]));
      assert.throws(() => addReaction(undefined, { id: 'locked', reactionId: other.reactionIds[0], seat: 'player', gameNumber: 1 }, owned, 10000), /Unlock/);
    }
  }
});
