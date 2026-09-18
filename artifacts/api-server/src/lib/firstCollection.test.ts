import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { ROOKIE_DECK_ID, ROOKIE_FOUNDATION_ID, ROOKIE_FOUNDATION_IDS } from '@workspace/squabblemon-engine/data';

test('foundation grants survive concurrent bootstrap normalization and repeat requests', { skip: !process.env.DATABASE_URL }, async t => {
  const { db, playerProfilesTable } = await import('@workspace/db');
  const { eq } = await import('drizzle-orm');
  const { grantFirstCollection } = await import('./playerRewardTransactions');
  const { getPlayerBootstrap } = await import('./playerState');
  const clerkUserId = `foundation-test-${randomUUID()}`;
  t.after(async () => { await db.delete(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, clerkUserId)); });
  await db.insert(playerProfilesTable).values({ clerkUserId, onboardingStep: 'crew', ownedCardIds: ['closet-nerd'], softCurrency: 123,
    savedDecks: [{ id: 'existing', name: 'Keep me', cardIds: [], heroCardId: '', recipeId: null }] });
  await Promise.all([grantFirstCollection(clerkUserId), getPlayerBootstrap(clerkUserId), grantFirstCollection(clerkUserId)]);
  const state = await getPlayerBootstrap(clerkUserId);
  assert.equal(state.profile.starterDeckId, ROOKIE_FOUNDATION_ID);
  assert.ok(ROOKIE_FOUNDATION_IDS.every(id => state.profile.ownedCardIds.includes(id)));
  assert.ok(state.profile.ownedCardIds.includes('closet-nerd'));
  assert.equal(state.profile.savedDecks.filter(deck => deck.id === ROOKIE_DECK_ID).length, 1);
  assert.ok(state.profile.savedDecks.some(deck => deck.id === 'existing'));
  assert.equal(state.profile.softCurrency, 123);
});

test('welcome reward requires a completed personal practice and remains idempotent', { skip: !process.env.DATABASE_URL }, async t => {
  const { db, playerProfilesTable, playerMatchesTable } = await import('@workspace/db');
  const { eq } = await import('drizzle-orm');
  const { grantFirstCollection, claimStarterReward } = await import('./playerRewardTransactions');
  const clerkUserId = `welcome-test-${randomUUID()}`;
  t.after(async () => { await db.delete(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, clerkUserId)); });
  await db.insert(playerProfilesTable).values({ clerkUserId, onboardingStep: 'crew' });
  await grantFirstCollection(clerkUserId);
  await assert.rejects(claimStarterReward(clerkUserId), /Finish a practice match/);
  // This test exercises the claim transaction; transcript verification has separate engine tests.
  await db.insert(playerMatchesTable).values({ clerkUserId, mode: 'practice', playerDeckId: ROOKIE_DECK_ID, rivalDeckId: 'combo', completedAt: new Date(), outcome: 'loss', rounds: 6 });
  const claims = await Promise.all([claimStarterReward(clerkUserId), claimStarterReward(clerkUserId)]);
  assert.equal(claims.filter(Boolean).length, 1);
  const [profile] = await db.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, clerkUserId));
  assert.equal(profile.softCurrency, 250);
  assert.equal(profile.packTickets, 1);
  assert.equal(profile.onboardingStep, 'complete');
});
