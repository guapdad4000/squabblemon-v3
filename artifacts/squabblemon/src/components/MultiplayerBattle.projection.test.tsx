import assert from 'node:assert/strict';
import test from 'node:test';
import { applyOnlineCommand, createOnlineRoom, joinOnlineRoom, onlineRoomView, type OnlineRoomView } from '@workspace/squabblemon-engine/multiplayer';
import { createCardInstance, createMatch, type Match } from '../gameEngine';
import { decks } from '../data';
import { computeTurnSecondsRemaining, createOnlineBattleProjector, onlineBattleProjection } from './MultiplayerBattle';

function populatedView() {
  const member = (userId: string) => ({ userId, name: userId, ready: false, deck: decks[0] });
  let room = createOnlineRoom(member('host'), 'cpu', 10_000);
  room = joinOnlineRoom(room, member('guest'), 10_000);
  room = applyOnlineCommand(room, 'player', { type: 'ready' }, 10_000);
  room = applyOnlineCommand(room, 'cpu', { type: 'ready' }, 10_000);
  const boards = ([0, 1, 2] as const).map(lane => Array.from({ length: 12 }, (_, index) => ({
    ...createCardInstance('hooper', index % 2 ? 'cpu' : 'player', `projection-${lane}`, index), lane,
  }))) as Match['boards'];
  room = { ...room, match: { ...createMatch('block', 'combo'), boards } };
  return copy(onlineRoomView(room, 'PROJECT12345', 'host', 10_000));
}
const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

test('online projection reuses all 36 card identities across 20 clock-only fresh JSON polls', () => {
  const project = createOnlineBattleProjector();
  const view = populatedView();
  const first = project(view);
  for (let i = 1; i <= 20; i++) {
    const heartbeat = { ...copy(view), serverTime: view.serverTime + i * 800, deadline: view.serverTime + i * 800 + 5_000 };
    const next = project(heartbeat);
    assert.equal(next, first, 'unmodified gameplay projection is shared');
    assert.equal(next.match.boards.flat().filter((card, index) => card !== first.match.boards.flat()[index]).length, 0);
    // Metadata is deliberately outside the projection and still advances the
    // actual component clock; a changed deadline cannot be cached in this view.
    assert.equal(computeTurnSecondsRemaining(heartbeat.deadline, heartbeat.serverTime, 0), 5);
  }
  const extended = { ...copy(view), serverTime: view.serverTime + 17_000, deadline: view.serverTime + 28_000 };
  assert.equal(project(extended), first);
  assert.equal(computeTurnSecondsRemaining(extended.deadline, extended.serverTime, 0), 11);
});

test('same-revision public form/status correction replaces only the changed projected card', () => {
  const project = createOnlineBattleProjector();
  const view = populatedView(), before = project(view), changed = copy(view);
  changed.boards[0][0] = { ...changed.boards[0][0], power: 17, powerModifier: 12, covered: true,
    form: { name: 'Confirmed form', ability: 'Confirmed ability', effect: 'Confirmed effect' },
    statuses: { ...changed.boards[0][0].statuses, frozen: true } };
  const after = project(changed);
  assert.equal(changed.revision, view.revision);
  assert.deepEqual(after, onlineBattleProjection(changed));
  assert.equal(after.match.boards.flat().filter((card, index) => card !== before.match.boards.flat()[index]).length, 1);
  assert.equal(after.match.playerHand[0], before.match.playerHand[0]);
  assert.equal(after.match.boards[0][0].name, 'Confirmed form');
  assert.equal(after.match.boards[0][0].statuses.frozen, true);
  assert(after.presentation.covered.has(changed.boards[0][0].instanceId));
});

test('same-revision costs, phase, scores, history, marks and identity updates match uncached projection', () => {
  const project = createOnlineBattleProjector();
  const view = populatedView(), before = project(view), next = copy(view);
  next.round = 4; next.roundLimit = 7; next.activeSeat = 'cpu';
  next.motion = { player: 7, cpu: 2 }; next.squabble = { player: true, cpu: false };
  next.hand[0].costs = [0, 4, 6]; next.ownDeck = { ...next.ownDeck, id: 'confirmed-private-deck' };
  next.scores[0] = { ...next.scores[0], player: 37, cpu: 11, winner: 'player' };
  next.rivalHandCount = 1; next.lockedLanes = [2];
  next.members.player = { ...next.members.player!, name: 'Updated player', playerMatId: 'comic-panels' };
  next.districtMarks = [{ lane: 1, owner: 'cpu', text: 'Confirmed lane mark' }];
  next.events = [...next.events, { sequence: 88, type: 'play', owner: 'player', note: 'SQUABBLE', sourceId: next.boards[0][0].instanceId } as OnlineRoomView['events'][number]];
  const after = project(next);
  assert.deepEqual(after, onlineBattleProjection(next));
  assert.equal(after.match.phase, 'cpu-reveal'); assert.equal(after.match.nextEventSequence, 89);
  assert.equal(after.presentation.scores[0].player, 37);
  assert.deepEqual(after.presentation.costs[next.hand[0].instanceId], [0, 4, 6]);
  assert.equal(after.match.boards[0][0], before.match.boards[0][0], 'unmodified board artwork stays shared');
  assert.notEqual(after.match.playerHand[0], before.match.playerHand[0], 'authoritative costs remain current');
  const complete = { ...next, status: 'complete' as const, revision: next.revision + 1 };
  assert.equal(project(complete).match.phase, 'complete');
  assert.deepEqual(project(complete), onlineBattleProjection(complete));
});

test('game, room and private-seat changes isolate the projection cache', () => {
  const project = createOnlineBattleProjector();
  const original = populatedView();
  let previous = project(original);
  const views = [
    { ...original, gameNumber: original.gameNumber + 1 },
    { ...original, code: 'OTHER1234567' },
    { ...original, seat: 'cpu' as const, hand: [{ ...original.boards[0][1], lane: null }], ownDeck: { ...original.ownDeck, id: 'guest-private-deck' } },
  ];
  for (const view of views) {
    const next = project(view);
    assert.deepEqual(next, onlineBattleProjection(view));
    assert.notEqual(next.match.boards[0][0], previous.match.boards[0][0]);
    assert.deepEqual(next.match.cpuHand, []); assert.deepEqual(next.match.cpuCardIds, []);
    previous = next;
  }
  assert.equal(previous.match.boards[0][0].owner, 'cpu');
  assert.equal(previous.match.playerHand[0].owner, 'player');
  assert.equal(previous.match.playerDeck, 'guest-private-deck');
});

test('revision changes never mask changed inputs or preserve removed cards', () => {
  const project = createOnlineBattleProjector(), view = populatedView();
  const first = project(view);
  const revisionOnly = { ...view, revision: view.revision + 1 };
  assert.deepEqual(project(revisionOnly), onlineBattleProjection(revisionOnly));
  const removed = { ...copy(revisionOnly), revision: view.revision - 1 };
  removed.boards[0].shift();
  const result = project(removed);
  assert.deepEqual(result, onlineBattleProjection(removed));
  assert.equal(result.match.boards.flat().length, 35);
  assert(!result.match.boards.flat().some(card => card.instanceId === first.match.boards[0][0].instanceId));
});
