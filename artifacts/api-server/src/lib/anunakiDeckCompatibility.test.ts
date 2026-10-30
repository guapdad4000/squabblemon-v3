import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import { eq } from 'drizzle-orm';
import { db, playerProfilesTable } from '@workspace/db';
import { starterRecipes } from '@workspace/squabblemon-engine/data';
import { ANUNAKI_EVENT_GAMEPLAY_READY } from '@workspace/squabblemon-engine/anunakiEvent';
import { ANUNAKI_DECK_CAPABILITY, ANUNAKI_DECK_CAPABILITY_HEADER } from '@workspace/squabblemon-engine/anunakiWave';
import { createApp } from '../app';

test('old clients cannot overwrite or delete an Anunaki deck, while updated clients can', { skip: !ANUNAKI_EVENT_GAMEPLAY_READY }, async t => {
  const recipe = starterRecipes[0]!;
  const known = recipe.catalogCardIds.slice(0, 10);
  const userId = `anunaki-decks-${randomUUID()}`;
  const protectedCards = [...known.slice(0, 9), 'yakub'];
  const makeDeck = (id: string, cardIds: string[], heroCardId = cardIds[0]!) => ({ id, name: id, cardIds, heroCardId, deckSize: 10, recipeId: null });
  await db.insert(playerProfilesTable).values({ clerkUserId: userId, onboardingStep: 'complete', ownedCardIds: [...known, 'yakub'], savedDecks: [makeDeck('protected', protectedCards), makeDeck('ordinary', known)], deckSlots: 5 });
  const server = createApp((req, _res, next) => {
    const auth = Object.assign(() => ({ userId, sessionId: 'anunaki-deck-test', tokenType: 'session_token', isAuthenticated: true }), { [Symbol.for('@clerk/express.auth')]: true });
    Object.assign(req, { auth }); next();
  }).listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  t.after(async () => { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); await db.delete(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, userId)); });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/player/decks`;
  const body = { name: 'Edited', cardIds: known, heroCardId: known[0], recipeId: null };
  const put = (id: string, data: typeof body, updated = false) => fetch(`${base}/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...(updated ? { [ANUNAKI_DECK_CAPABILITY_HEADER]: ANUNAKI_DECK_CAPABILITY } : {}) }, body: JSON.stringify(data) });
  const del = (id: string, updated = false) => fetch(`${base}/${id}`, { method: 'DELETE', headers: updated ? { [ANUNAKI_DECK_CAPABILITY_HEADER]: ANUNAKI_DECK_CAPABILITY } : {} });

  for (const request of [() => put('protected', body), () => del('protected'), () => put('new', { ...body, cardIds: protectedCards })]) {
    const response = await request();
    assert.equal(response.status, 409);
    assert.match((await response.json() as { error: string }).error, /Refresh the game/);
  }
  let [profile] = await db.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, userId));
  assert.deepEqual(profile.savedDecks.find(deck => deck.id === 'protected')?.cardIds, protectedCards);
  assert(!profile.savedDecks.some(deck => deck.id === 'new'));
  assert.equal((await put('ordinary', body)).status, 200, 'legacy normal decks remain editable');
  assert.equal((await put('protected', body, true)).status, 200, 'updated client can remove a card intentionally');
  assert.equal((await put('protected', { ...body, cardIds: protectedCards }, true)).status, 200, 'updated client can restore the card');
  assert.equal((await del('protected', true)).status, 200, 'updated client can intentionally delete the deck');
  [profile] = await db.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, userId));
  assert(!profile.savedDecks.some(deck => deck.id === 'protected'));
});
