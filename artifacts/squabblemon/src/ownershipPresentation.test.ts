import assert from 'node:assert/strict';
import test from 'node:test';
import { decks } from './data';
import { createCardInstance, type Match } from './gameEngine';
import {
  applyOnlineCommand, createOnlineRoom, joinOnlineRoom, onlineRoomView,
  type PublicEvent, type Seat,
} from '@workspace/squabblemon-engine/multiplayer';
import { toPresentationEffect } from './lib/useOnlineEffectPresenter';

const other = (seat: Seat): Seat => seat === 'player' ? 'cpu' : 'player';
const json = <T>(value: T): T => JSON.parse(JSON.stringify(value));
function roomFixture(opening: Seat) {
  const member = (userId: string) => ({ userId, name: userId, ready: false,
    deck: { ...decks[0], cards: [...decks[0].cards] } });
  let room = createOnlineRoom(member('owner-a'), opening, 0);
  room = joinOnlineRoom(room, member('owner-b'), 0);
  room = applyOnlineCommand(room, 'player', { type: 'ready' }, 1);
  return applyOnlineCommand(room, 'cpu', { type: 'ready' }, 2);
}

for (const recruitingSeat of ['player', 'cpu'] as const) {
  const formerSeat = other(recruitingSeat);
  for (const viewingSeat of ['player', 'cpu'] as const) test(`${recruitingSeat} recruitment retains old and new owners in the ${viewingSeat} public presentation`, () => {
    const room = roomFixture(recruitingSeat);
    const swookie = createCardInstance('pimp-swookie', recruitingSeat, 'online-ownership', 0);
    const snow = { ...createCardInstance('snow', formerSeat, 'online-ownership', 1), lane: 1 as const, powerModifier: 3 };
    const rival = { ...createCardInstance('hooper', formerSeat, 'online-ownership', 2), lane: 1 as const, basePower: 12 };
    const privateA = createCardInstance('rainmaker', 'player', 'private-frame-a', 3);
    const privateB = createCardInstance('monsoonanchor', 'cpu', 'private-frame-b', 4);
    const match: Match = { ...room.match!, round: 3,
      phase: recruitingSeat === 'player' ? 'player' : 'cpu-reveal', boards: [[], [snow, rival], []],
      playerMotion: 9, cpuMotion: 9,
      playerHand: recruitingSeat === 'player' ? [swookie, privateA] : [privateA],
      cpuHand: recruitingSeat === 'cpu' ? [swookie, privateB] : [privateB],
    };
    const played = applyOnlineCommand({ ...room, match, activeSeat: recruitingSeat }, recruitingSeat,
      { type: 'play', instanceId: swookie.instanceId, lane: 0, squabble: false }, 10);
    const view = onlineRoomView(json(played), 'OWNERFRAME', viewingSeat === 'player' ? 'owner-a' : 'owner-b', 11);
    const event = view.events.find(entry => entry.participants?.some(p => p.cardInstanceId === snow.instanceId
      && p.before?.owner === formerSeat && p.after?.owner === recruitingSeat));
    assert(event, 'the actual ownership-change event must retain both public frame owners');
    const projected = event.participants!.find(p => p.cardInstanceId === snow.instanceId)!;
    assert.equal(projected.owner, recruitingSeat, 'top-level participant owner remains the current controller');
    assert.equal(projected.before!.owner, formerSeat);
    assert.equal(projected.after!.owner, recruitingSeat);
    assert.equal(projected.before!.lane, projected.after!.lane, 'control transfer itself is not movement');
    assert.equal(projected.before!.powerModifier, 3);
    assert.equal(projected.after!.powerModifier, 3);
    const effect = toPresentationEffect(json(event), viewingSeat, []);
    assert(effect);
    const target = effect.targets.find(p => p.cardInstanceId === snow.instanceId)!;
    const local = (seat: Seat) => seat === viewingSeat ? 'player' : 'cpu';
    assert.equal(target.owner, local(recruitingSeat));
    assert.equal(target.before!.owner, local(formerSeat));
    assert.equal(target.after!.owner, local(recruitingSeat));
    assert.equal(view.boards[1].find(card => card.instanceId === snow.instanceId)?.owner, recruitingSeat);
    const publicEvents = JSON.stringify(view.events);
    assert(!publicEvents.includes(privateA.instanceId));
    assert(!publicEvents.includes(privateB.instanceId));
    assert(!publicEvents.includes('playerHand'));
    assert(!publicEvents.includes('cpuHand'));
    assert(!publicEvents.includes('replay'));
  });
}

for (const viewingSeat of ['player', 'cpu'] as const) test(`${viewingSeat} legacy events without per-frame owners retain the current-owner fallback`, () => {
  const card = createCardInstance('snow', 'cpu', 'legacy-owner', 0);
  const state = { lane: 1 as const, power: card.basePower, basePower: card.basePower,
    powerModifier: 0, moved: false, statuses: card.statuses };
  const event: PublicEvent = { sequence: 1, round: 2, type: 'ability', kind: 'ability',
    note: 'Legacy board effect', owner: 'cpu', lane: 1, cardId: 'snow', sourceId: card.instanceId,
    participants: [{ cardInstanceId: card.instanceId, cardId: 'snow', owner: 'cpu',
      before: state, after: { ...state, powerModifier: 1, power: state.power + 1 } }],
  };
  const effect = toPresentationEffect(event, viewingSeat, []);
  assert(effect?.source);
  const expected = viewingSeat === 'cpu' ? 'player' : 'cpu';
  assert.equal(effect.source.owner, expected);
  assert.equal(effect.source.before!.owner, expected);
  assert.equal(effect.source.after!.owner, expected);
  const mixed = json(event);
  mixed.participants![0].before!.owner = 'player';
  const partiallyUpgraded = toPresentationEffect(mixed, viewingSeat, []);
  assert.equal(partiallyUpgraded!.source!.before!.owner, viewingSeat === 'player' ? 'player' : 'cpu');
  assert.equal(partiallyUpgraded!.source!.after!.owner, expected, 'one missing frame cannot override the other frame owner');
});
