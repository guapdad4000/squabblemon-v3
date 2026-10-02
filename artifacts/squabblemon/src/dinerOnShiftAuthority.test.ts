import assert from 'node:assert/strict';
import test from 'node:test';
import { cards, decks } from './data';
import {
  createCardInstance,
  createMatchFromEngineCards,
  getDistrictResults,
  playTurnCard,
  replayMatchPrefix,
  type Lane,
  type Match,
  type Owner,
  type PlayerMove,
} from './gameEngine';
import {
  applyOnlineCommand,
  createOnlineRoom,
  joinOnlineRoom,
  onlineRoomView,
  type OnlineRoom,
} from '../../../lib/squabblemon-engine/src/multiplayer';

const DINER_CREW = [
  'squabble-house-manager', 'squabblehouse-bus-boy', 'squabblehouse-cashier',
  'squabblehouse-security', 'squabblehouse-teknician', 'griddle-master',
  'inmate-reformed', 'janitor', 'waffle-warlord', 'sideofhands',
];
const OPPONENT_CREW = [
  'cornball', 'snow', 'roaster', 'rastamon', 'wifey',
  'oink', 'baby', 'bikelife', 'vibe', 'hooper',
];

const json = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

function fixture(owner: Owner): { room: OnlineRoom; initial: Match; managerId: string } {
  const playerIds = owner === 'player' ? DINER_CREW : OPPONENT_CREW;
  const cpuIds = owner === 'cpu' ? DINER_CREW : OPPONENT_CREW;
  const host = {
    userId: 'diner-owner',
    name: 'Diner owner',
    ready: false,
    deck: { id: 'diner-authority-owner', name: 'Diner crew', hero: playerIds[0], cards: [...playerIds] },
  };
  const guest = {
    userId: 'diner-rival',
    name: 'Diner rival',
    ready: false,
    deck: { id: 'diner-authority-rival', name: 'Rival crew', hero: cpuIds[0], cards: [...cpuIds] },
  };
  let room = createOnlineRoom(host, owner, 0);
  room = joinOnlineRoom(room, guest, 1);
  room = applyOnlineCommand(room, 'player', { type: 'ready' }, 2);
  room = applyOnlineCommand(room, 'cpu', { type: 'ready' }, 3);

  let initial = createMatchFromEngineCards(
    'diner-authority-owner',
    playerIds,
    'diner-authority-rival',
    cpuIds,
  );
  const manager = (owner === 'player' ? initial.playerHand : initial.cpuHand)
    .find(card => card.cardId === 'squabble-house-manager')!;
  assert.ok(manager);
  const employeeMale = createCardInstance('squabblecook', owner, 'authority-board', 1);
  employeeMale.lane = 0;
  const employeeFemale = createCardInstance('squabbleserver', owner, 'authority-board', 2);
  employeeFemale.lane = 2;
  const enemy: Owner = owner === 'player' ? 'cpu' : 'player';
  const opponent = createCardInstance('hooper', enemy, 'authority-board', 3);
  opponent.lane = 1;

  initial = {
    ...initial,
    phase: owner === 'player' ? 'player' : 'cpu-reveal',
    playerHand: owner === 'player' ? [manager] : [],
    cpuHand: owner === 'cpu' ? [manager] : [],
    playerMotion: 9,
    cpuMotion: 9,
    boards: [
      [employeeMale].filter(card => card.owner === 'player'),
      [opponent].filter(card => card.owner === 'player'),
      [employeeFemale].filter(card => card.owner === 'player'),
    ].map((lane, index) => [
      ...lane,
      ...[employeeMale, employeeFemale, opponent].filter(card => card.lane === index && card.owner === 'cpu'),
    ]) as Match['boards'],
    effectLog: [],
    nextEventSequence: 1,
  };
  const managerId = manager.instanceId;
  room = { ...room, match: initial };
  return { room, initial, managerId };
}

test('both online owners keep Manager derived Hands authoritative, projected, and replayable after serialization', () => {
  for (const owner of ['player', 'cpu'] as const) {
    const { room, initial, managerId } = fixture(owner);
    const move: PlayerMove = {
      cardInstanceId: managerId,
      lane: 1 as Lane,
      squabble: false,
      endTurn: false,
    };
    const direct = playTurnCard(json(initial), owner, managerId, 1, false);
    const after = applyOnlineCommand(json(room), owner, {
      type: 'play',
      instanceId: managerId,
      lane: 1,
      squabble: false,
    }, 10);
    assert.deepEqual(after.match, direct, `${owner}: online authority uses the same engine resolution`);

    const liveManager = after.match!.boards.flat().find(card => card.instanceId === managerId)!;
    assert.equal(liveManager.powerModifier, 1,
      `${owner}: the reveal reward is the only permanent modifier on the Manager`);
    assert.equal(getDistrictResults(after.match!)[1][owner], 5,
      `${owner}: score includes the two legacy staff and the derived Manager aura`);

    const restored = json(after) as OnlineRoom;
    assert.deepEqual(restored.match, after.match, `${owner}: saved online match rehydrates without losing aura inputs`);
    for (const userId of ['diner-owner', 'diner-rival']) {
      const view = onlineRoomView(restored, 'DINER', userId, 11);
      const publicManager = view.boards.flat().find(card => card.instanceId === managerId)!;
      assert.ok(publicManager);
      assert.equal(publicManager.power, 5, `${owner}/${userId}: projection exposes computed Hands`);
      assert.equal(publicManager.basePower, 2);
      assert.equal(publicManager.powerModifier, 1);
      assert.equal(view.scores[1][owner], 5);
      const serializedView = JSON.stringify(view);
      for (const privateKey of ['playerHand', 'cpuHand', 'replay', 'abilityUpgradeSnapshot', 'playerCardIds', 'cpuCardIds']) {
        assert.ok(!serializedView.includes(`"${privateKey}"`), `${owner}/${userId}: public view does not leak ${privateKey}`);
      }
    }

    if (owner === 'player') {
      assert.deepEqual(replayMatchPrefix(json(initial), [move]), after.match,
        'the committed player transcript reconstructs the same derived aura and event frames');
    }
    const view = onlineRoomView(restored, 'DINER', 'diner-owner', 11);
    assert.deepEqual(
      onlineRoomView(json(restored), 'DINER', 'diner-owner', 11),
      view,
      `${owner}: repeat projection of a rehydrated match is deterministic`,
    );
  }
});

test('the diner authority fixture uses real ten-card crews and leaves the existing starter recipe untouched', () => {
  assert.equal(DINER_CREW.length, 10);
  assert.equal(new Set(DINER_CREW).size, 10);
  assert.equal(OPPONENT_CREW.length, 10);
  assert.equal(new Set(OPPONENT_CREW).size, 10);
  assert.ok(DINER_CREW.every(id => cards[id]));
  assert.ok(OPPONENT_CREW.every(id => cards[id]));
  assert.deepEqual(decks.find(deck => deck.id === 'block')?.cards,
    ['cornball', 'snow', 'roaster', 'rastamon', 'wifey', 'oink', 'baby', 'buspass', 'soulfood', 'cognac']);
});

test('neutral Manager departures survive saved rooms and the public participant allowlist for either seat', () => {
  for (const owner of ['player', 'cpu'] as const) {
    const { room, initial, managerId } = fixture(owner);
    const enemy: Owner = owner === 'player' ? 'cpu' : 'player';
    const manager = {
      ...(owner === 'player' ? initial.playerHand : initial.cpuHand).find(card => card.instanceId === managerId)!,
      lane: 2 as Lane, basePower: 2, powerModifier: -2, continuousPower: 1,
    };
    const employee = { ...createCardInstance('squabbleserver', owner, 'authority-neutral', 1),
      lane: 0 as Lane, basePower: 1 };
    const attacker = createCardInstance('roaster', enemy, 'authority-neutral', 2);
    const match = playTurnCard({
      ...initial,
      phase: enemy === 'player' ? 'player' : 'cpu-reveal',
      playerHand: enemy === 'player' ? [attacker] : [],
      cpuHand: enemy === 'cpu' ? [attacker] : [],
      boards: [[employee], [], [manager]],
      effectLog: [],
      nextEventSequence: 1,
    }, enemy, attacker.instanceId, 0, false);
    assert.ok(!match.boards.flat().some(card => card.instanceId === managerId));
    const saved = json({ ...room, match });
    for (const userId of ['diner-owner', 'diner-rival']) {
      const view = onlineRoomView(saved, 'DINER', userId, 11);
      const neutral = view.events.flatMap(event => event.participants ?? [])
        .find(participant => participant.cardInstanceId === managerId && participant.departureCause === 'aura-loss');
      assert.ok(neutral, `${owner}/${userId}: the public event explains the neutral casualty`);
      assert.equal(neutral.before?.power, 1);
      assert.equal(neutral.before?.continuousPower, 1);
      assert.equal(neutral.after, null);
      assert.ok(!JSON.stringify(view).includes('"playerHand"'));
      assert.ok(!JSON.stringify(view).includes('"cpuHand"'));
    }
  }
});
