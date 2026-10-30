import assert from 'node:assert/strict';
import test from 'node:test';
import { createOnlineRoom, type OnlineMember } from '@workspace/squabblemon-engine/multiplayer';
import { createCardInstance, createMatch } from '@workspace/squabblemon-engine/gameEngine';
import { compatibleMembers, hasAnunakiClient, memberHasAnunaki, requireRoomCapability } from './onlineCompatibility';

const member = (userId: string, cards: string[], supportsAnunaki?: boolean): OnlineMember => ({
  userId, name: userId, ready: false, supportsAnunaki,
  deck: { id: userId, name: userId, hero: cards[0], cards },
});
test('missing and unknown capability headers fail closed', () => {
  assert.equal(hasAnunakiClient(undefined), false);
  assert.equal(hasAnunakiClient('another-client'), false);
  assert.equal(hasAnunakiClient('other, anunaki-v1'), true);
});
test('legacy players can pair normally but must not meet an Anunaki gang', () => {
  const legacy = member('old', ['buddy']), modern = member('new', ['yakub'], true);
  assert.equal(memberHasAnunaki(modern), true);
  assert.equal(compatibleMembers(legacy, member('old2', ['buddy'])), true);
  assert.equal(compatibleMembers(legacy, modern), false);
  assert.equal(compatibleMembers(modern, legacy), false);
  assert.equal(compatibleMembers({...legacy, supportsAnunaki: true}, modern), true);
});
test('reject old-client access before any room mutation and allow updated clients', () => {
  const room = createOnlineRoom(member('owner', ['yakub'], true), 'player', 1000);
  const snapshot = JSON.stringify(room);
  assert.throws(() => requireRoomCapability(room, false), /Refresh the page/);
  assert.equal(JSON.stringify(room), snapshot);
  assert.doesNotThrow(() => requireRoomCapability(room, true));
  assert.doesNotThrow(() => requireRoomCapability(createOnlineRoom(member('owner', ['buddy']), 'player', 1000), false));
});
test('summoned or transformed Anunaki cards are guarded even when neither deck lists one', () => {
  const room = createOnlineRoom(member('owner', ['buddy']), 'player', 1000);
  room.match = createMatch('block', 'slide');
  const summoned = {...createCardInstance('caucus-mountaineer', 'cpu', 'summon-test', 0), lane: 0 as const};
  room.match.boards[0] = [summoned];
  assert.throws(() => requireRoomCapability(room, false), /Refresh the page/);
  room.match.boards[0] = [{ ...summoned, cardId: 'buddy', id: 'nabu' }];
  assert.throws(() => requireRoomCapability(room, false), /Refresh the page/);
  assert.doesNotThrow(() => requireRoomCapability(room, true));
});
test('pre-replay legacy snapshots without a log remain readable', () => {
  const room = createOnlineRoom(member('owner', ['buddy']), 'player', 1000);
  room.match = createMatch('block', 'slide');
  delete (room.match as { effectLog?: unknown }).effectLog;
  assert.doesNotThrow(() => requireRoomCapability(room, false));
});
