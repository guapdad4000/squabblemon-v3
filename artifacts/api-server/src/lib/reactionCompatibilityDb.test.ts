import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { eq, inArray } from 'drizzle-orm';
import { db, onlineRoomsTable, playerProfilesTable } from '@workspace/db';
import { createOnlineRoom, joinOnlineRoom, type OnlineMember } from '@workspace/squabblemon-engine/multiplayer';
import { accessRoomReactions } from './onlineMatches';
import { storeOnlineRoom } from './onlineRoomPersistence';

test('legacy reaction polling never sees Anunaki IDs in projected or fallback reads', { skip: !process.env.DATABASE_URL }, async t => {
  const users = [randomUUID(), randomUUID()].map(id => `reaction-client-${id}`);
  await db.insert(playerProfilesTable).values(users.map(clerkUserId => ({ clerkUserId, onboardingStep: 'complete', unlockedCosmeticIds: ['style:yakub:stickers'], settings: { reducedMotion: false, turnTimerEnabled: true, reactionTray: ['reaction:yakub:laugh:v1', 'big-w'] } })));
  t.after(async () => { await db.delete(playerProfilesTable).where(inArray(playerProfilesTable.clerkUserId, users)); });
  const member = (userId: string): OnlineMember => ({ userId, name: userId, ready: true, deck: { id: 'test', name: 'test', hero: 'cornball', cards: [] } });
  const now = Date.now();
  const room = joinOnlineRoom(createOnlineRoom(member(users[0]), 'player', now), member(users[1]), now);
  room.status = 'active'; room.deadline = now + 60_000;
  room.reactions = { revision: 3, latest: { player: { id: randomUUID(), reactionId: 'reaction:yakub:laugh:v1', seat: 'player', sentAt: now, gameNumber: 1 }, cpu: { id: randomUUID(), reactionId: 'big-w', seat: 'cpu', sentAt: now, gameNumber: 1 } } };
  const code = randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase();
  const [row] = await db.insert(onlineRoomsTable).values({ code, hostUserId: users[0], guestUserId: users[1], createRequestId: randomUUID(), state: storeOnlineRoom(room), expiresAt: new Date(now + 60_000) }).returning();
  for (const useProjection of [false, true]) {
    await db.update(onlineRoomsTable).set({ liveState: useProjection ? storeOnlineRoom(room) : null }).where(eq(onlineRoomsTable.id, row.id));
    const legacy = await accessRoomReactions(code, users[1]);
    assert.equal(legacy.latest.player, undefined);
    assert.equal(legacy.latest.cpu?.reactionId, 'big-w');
    assert.deepEqual(legacy.tray, ['big-w']);
    assert(!legacy.owned.includes('reaction:yakub:laugh:v1'));
    const modern = await accessRoomReactions(code, users[1], undefined, true);
    assert.equal(modern.latest.player?.reactionId, 'reaction:yakub:laugh:v1');
    assert(modern.owned.includes('reaction:yakub:laugh:v1'));
  }
  await assert.rejects(accessRoomReactions(code, users[1], { requestId: randomUUID(), reactionId: 'reaction:yakub:laugh:v1', gameNumber: 1 }), /latest game/);
});
