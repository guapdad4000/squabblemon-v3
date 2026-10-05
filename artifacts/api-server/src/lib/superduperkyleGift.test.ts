import assert from 'node:assert/strict';
import test from 'node:test';

test('one-player GUAP gift is exact and idempotent', { skip: !process.env.DATABASE_URL }, async t => {
  const { db, pool, playerCollectionClaimsTable, playerProfilesTable, socialIdentitiesTable } = await import('@workspace/db');
  const { eq } = await import('drizzle-orm');
  const { previewSuperduperkyleGift, sendSuperduperkyleGift } = await import('./superduperkyleGift');
  const userId = 'superduperkyle-gift-test';
  await db.insert(playerProfilesTable).values({
    clerkUserId: userId,
    displayName: 'superduperkyle',
    onboardingStep: 'complete',
    packTickets: 4,
    ownedCardIds: ['cornball'],
    discoveredCardIds: ['cornball'],
  });
  await db.insert(socialIdentitiesTable).values({ userId, friendCode: 'A1B2C3D4E5F6', username: 'superduperkyle_750d071f' });
  t.after(async () => { await db.delete(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, userId)); await pool.end(); });

  const preview = await previewSuperduperkyleGift();
  assert.equal(preview.player.username, 'superduperkyle_750d071f');
  assert.deepEqual(preview.gift, { cardId: 'guap', cardName: 'GUAP', packTickets: 20 });
  assert.equal(preview.alreadyOwnsCard, false);
  assert.equal(preview.alreadyGranted, false);

  const first = await sendSuperduperkyleGift();
  const retry = await sendSuperduperkyleGift();
  assert.equal(first.alreadyGranted, false);
  assert.equal(retry.alreadyGranted, true);
  const [profile] = await db.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, userId));
  assert.equal(profile.packTickets, 24);
  assert.equal(profile.ownedCardIds.filter(id => id === 'guap').length, 1);
  assert(profile.discoveredCardIds.includes('guap'));
  assert.deepEqual(profile.cardProgression.guap, { xp: 0, level: 1, moveTier: 0 });
  assert.equal(profile.inbox.filter(item => item.id === 'gift_superduperkyle_guap_20_20261004').length, 1);
  const receipts = await db.select().from(playerCollectionClaimsTable).where(eq(playerCollectionClaimsTable.clerkUserId, userId));
  assert.equal(receipts.filter(row => row.milestoneKey === 'operator:superduperkyle-guap-20-tickets-2026-10-04').length, 1);
});
