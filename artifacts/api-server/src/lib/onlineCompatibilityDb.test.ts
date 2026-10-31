import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { createOnlineRoom, joinOnlineRoom, type OnlineMember } from '@workspace/squabblemon-engine/multiplayer';
import { decks, ROOKIE_CORE_IDS } from '@workspace/squabblemon-engine/data';

test('ranked queue separates old clients from Anunaki gangs in either seat until they update', {skip: !process.env.DATABASE_URL}, async t => {
  const { db, pool, playerProfilesTable, onlineRoomsTable } = await import('@workspace/db');
  const { inArray, eq } = await import('drizzle-orm');
  const { rankedLobby, cancelRankedSearch, accessFriendRoom } = await import('./onlineMatches');
  const users = Array.from({length: 4}, () => `compat-${randomUUID()}`);
  await db.insert(playerProfilesTable).values(users.map(user => ({clerkUserId: user, displayName: user, onboardingStep: 'complete', ownedCardIds: [...ROOKIE_CORE_IDS],
    unlockedCosmeticIds: ['style:yakub:stickers'], savedDecks: [{id: 'custom', name: 'Rookie gang', heroCardId: 'hooper', cardIds: [...ROOKIE_CORE_IDS]}]})));
  t.after(async () => { await db.delete(playerProfilesTable).where(inArray(playerProfilesTable.clerkUserId, users)); await pool.end(); });
  const member = (userId: string, anunaki: boolean, capable: boolean): OnlineMember => {
    const cards = [...decks[0].cards];
    if (anunaki) cards[0] = 'yakub';
    return {userId, name: userId, ready: false, supportsAnunaki: capable,
      deck: {id: `deck-${userId}`, name: userId, hero: cards[0], cards}};
  };
  const insert = async (host: OnlineMember) => {
    const now = Date.now(), code = randomBytes(6).toString('hex').toUpperCase();
    const room = createOnlineRoom(host, 'player', now);
    room.ranked = {queuedAt: now, heartbeatAt: now, botAfter: now + 600_000, bot: false, ratings: {player: 1000}};
    await db.insert(onlineRoomsTable).values({code, hostUserId: host.userId, createRequestId: randomUUID(), state: room as unknown as Record<string, unknown>, expiresAt: new Date(room.expiresAt)});
    return code;
  };
  for (const [index, anunakiOwn] of [false, true].entries()) {
    const a = users[index * 2], b = users[index * 2 + 1];
    const ownCode = await insert(member(a, anunakiOwn, anunakiOwn));
    const otherCode = await insert(member(b, !anunakiOwn, !anunakiOwn));
    const oldUser = anunakiOwn ? b : a;
    const waiting = await rankedLobby(oldUser, undefined, false);
    assert.equal(waiting.room?.status, 'waiting');
    const other = await db.select().from(onlineRoomsTable).where(eq(onlineRoomsTable.code, anunakiOwn ? ownCode : otherCode));
    assert.equal((other[0].state as {status: string}).status, 'waiting');
    const upgraded = await rankedLobby(oldUser, undefined, true);
    assert.equal(upgraded.room?.status, 'active');
    assert.equal(upgraded.room?.members.player?.ready, true);
    assert.equal(upgraded.room?.members.cpu?.ready, true);
    await db.delete(onlineRoomsTable).where(inArray(onlineRoomsTable.hostUserId, [a, b]));
  }
  const raceCode = await insert(member(users[0], false, false));
  await insert(member(users[1], true, true));
  const [oldPoll, updatedPoll] = await Promise.allSettled([
    rankedLobby(users[0], undefined, false), rankedLobby(users[0], undefined, true),
  ]);
  assert.equal(updatedPoll.status, 'fulfilled');
  if (updatedPoll.status === 'fulfilled') assert.equal(updatedPoll.value.room?.status, 'active');
  if (oldPoll.status === 'fulfilled') assert.equal(oldPoll.value.room?.status, 'waiting');
  else assert.match(String(oldPoll.reason), /Refresh the page/);
  await assert.rejects(rankedLobby(users[0], undefined, false), /Refresh the page/);
  const beforeCancel = await db.select().from(onlineRoomsTable).where(eq(onlineRoomsTable.code, updatedPoll.status === 'fulfilled' ? updatedPoll.value.room!.code : raceCode));
  await assert.rejects(cancelRankedSearch(users[0], raceCode, false), /Refresh the page/);
  const afterCancel = await db.select().from(onlineRoomsTable).where(eq(onlineRoomsTable.code, beforeCancel[0].code));
  assert.deepEqual(afterCancel[0].state, beforeCancel[0].state, 'old cancel retry cannot mutate the paired Anunaki match');
  await db.delete(onlineRoomsTable).where(inArray(onlineRoomsTable.hostUserId, [users[0], users[1]]));
  const now = Date.now(), code = randomBytes(6).toString('hex').toUpperCase();
  const waiting = createOnlineRoom(member(users[0], true, true), 'player', now);
  await db.insert(onlineRoomsTable).values({code, hostUserId: users[0], createRequestId: randomUUID(), state: waiting as unknown as Record<string, unknown>, expiresAt: new Date(waiting.expiresAt)});
  await assert.rejects(accessFriendRoom(code, users[1], {kind: 'join', deckId: 'unused'}, false), /Refresh the page/);
  let row = (await db.select().from(onlineRoomsTable).where(eq(onlineRoomsTable.code, code)))[0];
  assert.equal((row.state as {members: {cpu: unknown}}).members.cpu, null, 'legacy join was rejected before writing a seat');
  const joined = joinOnlineRoom(waiting, member(users[1], false, true), now);
  await db.update(onlineRoomsTable).set({state: joined as unknown as Record<string, unknown>, guestUserId: users[1]}).where(eq(onlineRoomsTable.code, code));
  await assert.rejects(accessFriendRoom(code, users[1], {kind: 'command', requestId: randomUUID(), expectedRevision: joined.revision, command: {type: 'ready'}}, false), /Refresh the page/);
  row = (await db.select().from(onlineRoomsTable).where(eq(onlineRoomsTable.code, code)))[0];
  assert.deepEqual(row.state, joined, 'stale tab did not change the room or record a ready command');
  if (process.env.ANUNAKI_MIXED_BROWSER === '1') {
    await db.delete(onlineRoomsTable).where(inArray(onlineRoomsTable.hostUserId, users));
    await insert(member(users[0], false, false));
    await insert(member(users[1], true, true));
    const browserCode = randomBytes(6).toString('hex').toUpperCase();
    const host = createOnlineRoom(member(users[3], true, true), 'player', now);
    host.reactions = {revision: 1, latest: {player: {id: randomUUID(), reactionId: 'reaction:yakub:laugh:v1', seat: 'player', sentAt: now, gameNumber: 1}}};
    await db.insert(onlineRoomsTable).values({code: browserCode, hostUserId: users[3], createRequestId: randomUUID(), state: host as unknown as Record<string, unknown>, expiresAt: new Date(host.expiresAt)});
    const {default: express} = await import('express');
    const {default: router} = await import('../routes/multiplayer');
    const app = express(); app.use(express.json());
    app.use((req, _res, next) => {
      const userId = req.header('x-test-user') || null;
      (req as unknown as {auth: unknown}).auth = Object.assign(() => ({userId, sessionId: userId ? 'test' : null, tokenType: 'session_token', isAuthenticated: !!userId}), {[Symbol.for('@clerk/express.auth')]: true});
      next();
    });
    app.use('/api', router);
    const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
    try {
      const {verifyMixedClientBrowser} = await import(new URL('../../../squabblemon/e2e/verify-mixed-client.ts', import.meta.url).href);
      const result = await verifyMixedClientBrowser({origin: `http://127.0.0.1:${(server.address() as {port: number}).port}/api/multiplayer`,
        oldRoot: process.env.ANUNAKI_OLD_CLIENT_ROOT!, newRoot: fileURLToPath(new URL('../../../squabblemon/', import.meta.url)),
        queueUser: users[0], friendUser: users[2], friendCode: browserCode});
      console.log('Mixed browser transport against local API and PGlite:', JSON.stringify(result));
    } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
  }
});
