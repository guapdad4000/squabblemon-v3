import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { eq, inArray } from 'drizzle-orm';
import { db, playerProfilesTable, kumiteTournamentsTable } from '@workspace/db';
import { ANUNAKI_EVENT_GAMEPLAY_READY } from '@workspace/squabblemon-engine/anunakiEvent';
import { ROOKIE_CORE_IDS } from '@workspace/squabblemon-engine/data';
import { getSocialState, mutateRelationship, sendFadeInvitation, accessInvitation } from './social';
import { currentKumite, enterKumiteMatch, registerKumite } from './kumite';
import { kumiteWeek } from './kumiteEngine';

test('Anunaki Homies invites and Kumite brackets reject stale clients while updated clients can play', { skip: !process.env.DATABASE_URL || !ANUNAKI_EVENT_GAMEPLAY_READY }, async t => {
  const users = [randomUUID(), randomUUID()].map(id => `anunaki-social-${id}`);
  const oldDeck = [...ROOKIE_CORE_IDS];
  const newDeck = [...ROOKIE_CORE_IDS.slice(0, 9), 'yakub'];
  await db.insert(playerProfilesTable).values(users.map(clerkUserId => ({ clerkUserId, displayName: clerkUserId,
    onboardingStep: 'complete', ownedCardIds: [...new Set([...oldDeck, 'yakub'])], savedDecks: [
      { id: 'old', name: 'Old gang', heroCardId: 'cornball', cardIds: oldDeck },
      { id: 'new', name: 'Anunaki gang', heroCardId: 'cornball', cardIds: newDeck },
    ] })));
  const originalNow = Date.now;
  const week = kumiteWeek(Date.parse('2070-01-10T00:00:00Z'));
  t.after(async () => {
    Date.now = originalNow;
    await db.delete(kumiteTournamentsTable).where(eq(kumiteTournamentsTable.id, week.id));
    await db.delete(playerProfilesTable).where(inArray(playerProfilesTable.clerkUserId, users));
  });
  const a = await getSocialState(users[0]);
  const b = await getSocialState(users[1]);
  await mutateRelationship(users[0], 'send', { code: b.self.friendCode });
  const incoming = await getSocialState(users[1]);
  await mutateRelationship(users[1], 'respond', { id: incoming.incomingRequests[0].id, action: 'accept' });
  const invitation = await sendFadeInvitation(users[0], { friendCode: b.self.friendCode, deckId: 'new', requestId: randomUUID() }, true);
  await assert.rejects(accessInvitation(users[1], invitation.id, { action: 'accept', deckId: 'old' }), /latest game update/);
  const accepted = await accessInvitation(users[1], invitation.id, { action: 'accept', deckId: 'old' }, true);
  assert.equal(accepted.status, 'accepted');

  Date.now = () => week.registrationOpensAt + 1;
  const legacyRegistration = await registerKumite(users[1], 'old');
  assert.equal(legacyRegistration.registration?.clientNeedsUpdate, true);
  await assert.rejects(registerKumite(users[0], 'new', true), /older game version/);
  const refreshed = await registerKumite(users[1], 'old', true);
  assert.equal(refreshed.registration?.clientNeedsUpdate, false);
  assert.equal(refreshed.registration?.deckId, legacyRegistration.registration?.deckId);
  assert.equal(refreshed.registration?.registeredAt, legacyRegistration.registration?.registeredAt);
  await assert.rejects(registerKumite(users[1], 'new', true), /gang is locked/);
  const staleRetry = await registerKumite(users[1], 'old');
  assert.equal(staleRetry.registration?.clientNeedsUpdate, false, 'an older tab cannot downgrade the registration');
  assert.equal(staleRetry.tournament.entrants.length, 1);
  await registerKumite(users[0], 'new', true);
  Date.now = () => week.startsAt + 1;
  const active = await currentKumite(users[0]);
  assert.equal(active.tournament.status, 'active');
  await assert.rejects(enterKumiteMatch(users[1]), /latest game/);
  const checkIn = await enterKumiteMatch(users[1], true);
  assert(checkIn.room, 'updated client should receive the playable bracket room');
});
