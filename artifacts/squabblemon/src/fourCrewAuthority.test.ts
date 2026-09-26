import assert from 'node:assert/strict';
import test from 'node:test';
import { cards, decks, MAX_MOTION, catalogCardByEngineId, validateSavedDeck } from './data';
import {
  canAffordSelection, createAbilityUpgradeSnapshot, createCardInstance, getCharacterDistrictMarks,
  createMatchFromEngineCards, createDistrictSnapshot, getEffectiveCardPower,
  nextRound, pass, playTurnCard, revealCpuTurn, verifyMatchTranscript,
  type Lane, type Owner, type PlayerMove,
} from './gameEngine';
import {
  applyOnlineCommand, createOnlineRoom, joinOnlineRoom, onlineRoomView,
  CARD_BALANCE_VERSION, ONLINE_RULES_VERSION, type OnlineRoom,
} from '@workspace/squabblemon-engine/multiplayer';
import { createDefaultBalanceDecks } from '@workspace/squabblemon-engine/balanceLab';

const crewIds = ['focus-cellblock', 'focus-detective', 'focus-demario-luigion', 'focus-counterplay-coherent'];
const opponent = decks.find(deck => deck.id === 'block')!;
const progression = (ids: readonly string[], tier: number) => Object.fromEntries(
  ids.map(id => [id, { level: [1, 2, 5, 8][tier], xp: 2800, moveTier: tier }]),
);
const json = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

test('revised recommendations remain legal collectibles, not new starters or battle-only forms', () => {
  for (const crewId of crewIds) {
    const crew = createDefaultBalanceDecks().find(deck => deck.id === crewId)!;
    assert.ok(crew, crewId);
    const ids = crew.cardIds.map(id => catalogCardByEngineId[id].catalogId);
    assert.equal(ids.length, 10);
    assert.equal(validateSavedDeck(ids, ids, ids[0]).valid, true);
    assert.ok(!decks.some(deck => deck.id === crew.id));
    assert.ok(!ids.includes('demario-mushroom') && !ids.includes('luigion-powered'));
  }
  assert.equal(cards['inmate-crafty'].cost, 2);
  assert.equal(cards['inmate-crafty'].power, 3);
  assert.equal(cards.watson.cost, 2);
  assert.equal(cards.watson.power, 3);
  assert.equal(cards.demario.cost, 2);
  assert.equal(cards.demario.power, 2);
  assert.equal(cards.luigion.cost, 2);
  assert.equal(cards.luigion.power, 2);
  assert.equal(MAX_MOTION, 9);
  assert.equal(CARD_BALANCE_VERSION, 8);
  assert.equal(ONLINE_RULES_VERSION, 8);
});

for (const crewId of crewIds) for (let tier = 0; tier <= 3; tier++) {
  test(`${crewId} tier ${tier}: browser actions and serialized authoritative transcript agree`, () => {
    const crew = createDefaultBalanceDecks().find(deck => deck.id === crewId)!;
    const snapshot = createAbilityUpgradeSnapshot([...crew.cardIds], opponent.cards, {
      player: progression(crew.cardIds, tier), cpu: progression(opponent.cards, tier),
    });
    const districts = createDistrictSnapshot('four-crew-authority');
    let local = createMatchFromEngineCards(crew.id, [...crew.cardIds], opponent.id, [...opponent.cards],
      undefined, undefined, snapshot, districts);
    assert.equal(local.playerMotion, 2);
    assert.equal(local.cpuMotion, 2);
    const moves: PlayerMove[] = [];
    while (local.phase !== 'complete') {
      // Real legal multi-card turns. Round/lane rotation prevents fixture-only full-lane plays.
      const legal = local.playerHand.flatMap(card => ([0, 1, 2] as Lane[])
        .map(index => ((index + local.round) % 3) as Lane)
        .filter(lane => canAffordSelection(local, 'player', card.instanceId, lane))
        .map(lane => ({ card, lane })));
      if (legal.length) {
        const { card, lane } = legal[0];
        const squabble = !local.squabbleUsed && (card.cardId === 'luigion' || local.round >= 4);
        moves.push({ cardInstanceId: card.instanceId, lane, squabble, endTurn: false });
        local = playTurnCard(local, 'player', card.instanceId, lane, squabble);
      } else {
        moves.push({ cardInstanceId: null, lane: null, squabble: false, endTurn: true });
        local = nextRound(revealCpuTurn(pass(local, 'player')));
      }
      assert.ok(moves.length <= 64);
    }
    const authoritative = verifyMatchTranscript(crew.id, opponent.id, json(moves),
      json(snapshot), [...crew.cardIds], json(districts));
    assert.deepEqual(authoritative, local);
    assert.equal(local.round, 6);
    assert.ok(local.effectLog.some(event => event.type === 'play'));
  });
}

function roomFor(owner: Owner, ids: string[], tier: number): OnlineRoom {
  const member = (userId: string) => ({ userId, name: userId, ready: false,
    deck: { id: 'four-crew-fixture', name: 'Fixture', hero: ids[0], cards: [...ids] } });
  let room = createOnlineRoom(member('a'), owner, 0);
  room = joinOnlineRoom(room, member('b'), 1);
  room = applyOnlineCommand(room, 'player', { type: 'ready' }, 2);
  room = applyOnlineCommand(room, 'cpu', { type: 'ready' }, 3);
  const snapshot = createAbilityUpgradeSnapshot(ids, ids, {
    player: progression(ids, tier), cpu: progression(ids, tier),
  });
  room.match = createMatchFromEngineCards('fixture-a', ids, 'fixture-b', ids, undefined, undefined, snapshot);
  room.match.phase = owner === 'player' ? 'player' : 'cpu-reveal';
  room.match.squabbleByOwner = { player: false, cpu: false };
  return room;
}
function playOnline(room: OnlineRoom, owner: Owner, cardId: string, lane: Lane, squabble = false) {
  const match = room.match!;
  const source = (owner === 'player' ? match.playerHand : match.cpuHand).find(card => card.cardId === cardId)!;
  assert.ok(source, cardId);
  const expected = playTurnCard(json(match), owner, source.instanceId, lane, squabble);
  const after = applyOnlineCommand(json(room), owner,
    { type: 'play', instanceId: source.instanceId, lane, squabble }, 10);
  assert.deepEqual(after.match, expected);
  for (const user of ['a', 'b']) {
    const view = onlineRoomView(after, 'FIXTURE', user, 11);
    for (const card of expected.boards.flat()) {
      const publicCard = view.boards.flat().find(item => item.instanceId === card.instanceId)!;
      assert.ok(publicCard);
      assert.equal(publicCard.power, getEffectiveCardPower(card));
      assert.deepEqual(publicCard.statuses, card.statuses);
    }
    const serialized = JSON.stringify(view);
    for (const key of ['playerHand', 'cpuHand', 'replay', 'abilityUpgradeSnapshot', 'playerCardIds', 'cpuCardIds']) {
      assert.ok(!serialized.includes(`"${key}"`), key);
    }
  }
  return after;
}

for (const owner of ['player', 'cpu'] as const) for (let tier = 0; tier <= 3; tier++) {
  for (const powered of [false, true]) test(`${owner} tier ${tier}: ${powered ? 'powered' : 'normal'} Mushroom combo matches public online views`, () => {
    const ids = ['demario', 'luigion', 'plug', 'watson', 'bustdown', 'soulfood', 'gamer', 'counter', 'nerd', 'buddy'];
    let room = roomFor(owner, ids, tier);
    room = playOnline(room, owner, 'demario', 0);
    const mushroom = room.match!.boards[0].find(card => card.cardId === 'demario-mushroom')!;
    assert.ok(mushroom);
    assert.equal(getEffectiveCardPower(mushroom), 1);
    // Isolated fixture advances spending capacity, not any live match or player data.
    room.match![owner === 'player' ? 'playerMotion' : 'cpuMotion'] = 2;
    room = playOnline(room, owner, 'luigion', 0, powered);
    assert.ok(!room.match!.boards.flat().some(card => card.instanceId === mushroom.instanceId));
    const consumed = room.match!.effectLog.filter(event => /consumed.*Mushroom/i.test(event.note));
    assert.equal(consumed.length, 1);
    for (const user of ['a', 'b']) {
      const view = onlineRoomView(room, 'FIXTURE', user, 11);
      const luigion = view.boards.flat().find(card => card.cardId === 'luigion')!;
      assert.equal(luigion.artworkId, powered ? 'luigion-powered' : 'luigion');
      assert.equal(!!luigion.form, powered);
      if (powered) assert.match(luigion.form!.effect, /jump/i);
    }
  });
  test(`${owner} tier ${tier}: cross-district Cellblock payoff and cancelled entrance project correctly`, () => {
    const ids = ['inmate-crafty', 'inmate-boyfriend', 'sherlock', 'watson', 'cornball',
      'inmate-informant', 'inmate-contraband', 'cognac', 'bustdown', 'plug'];
    let room = roomFor(owner, ids, tier);
    room = playOnline(room, owner, 'inmate-crafty', 1);
    room.match![owner === 'player' ? 'playerMotion' : 'cpuMotion'] = 9;
    room = playOnline(room, owner, 'inmate-boyfriend', 0);
    const crafty = room.match!.boards.flat().find(card => card.cardId === 'inmate-crafty')!;
    assert.equal(crafty.powerModifier, 2);
    room = playOnline(room, owner, 'sherlock', 0);
    const trap = room.match!.districtTraps![0];
    const enemy: Owner = owner === 'player' ? 'cpu' : 'player';
    room.activeSeat = enemy;
    room.match!.phase = enemy === 'player' ? 'player' : 'cpu-reveal';
    room = playOnline(room, enemy, 'cornball', trap.lane);
    assert.equal(room.match!.districtTraps!.length, 0);
    const event = room.match!.effectLog.find(entry => /canceled.*entrance/i.test(entry.note))!;
    assert.ok(event);
    const changedFriend = event.targets.find(target => target.owner === owner
      && target.cardId !== 'sherlock' && target.after && target.before);
    assert.ok(changedFriend, 'the crew reward is included alongside the cancelled enemy');
  });
}
for (const owner of ['player', 'cpu'] as const) {
  test(`${owner}: Told You prediction and discount survive authoritative commands and public views`, () => {
    const enemy: Owner = owner === 'player' ? 'cpu' : 'player';
    const ids = ['homeless-wiseman', 'ronald', 'cornball', 'plug', 'watson', 'bustdown', 'soulfood', 'gamer', 'counter', 'buddy'];
    let room = roomFor(owner, ids, 0);
    const prepare = (side: Owner, id: string) => {
      room.activeSeat = side;
      room.match!.phase = side === 'player' ? 'player' : 'cpu-reveal';
      room.match![side === 'player' ? 'playerMotion' : 'cpuMotion'] = 9;
      room.match![side === 'player' ? 'playerHand' : 'cpuHand'] = [createCardInstance(id, side)];
    };
    prepare(owner, 'homeless-wiseman');
    room = playOnline(room, owner, 'homeless-wiseman', 2);
    const lane = room.match!.districtTraps!.find(t => t.kind === 'wiseman')!.lane;
    prepare(enemy, 'cornball');
    room = playOnline(room, enemy, 'cornball', ((lane + 1) % 3) as Lane);
    assert.ok(room.match!.discountTokens.some(t => t.eligibility === 'wiseman-prediction'));
    for (const user of ['a', 'b']) {
      assert.deepEqual(onlineRoomView(room, 'FIXTURE', user, 11).districtMarks, getCharacterDistrictMarks(room.match!));
    }
    prepare(owner, 'ronald');
    room = playOnline(room, owner, 'ronald', lane);
    assert.equal(room.match![owner === 'player' ? 'playerMotion' : 'cpuMotion'], 8);
    assert.ok(!room.match!.discountTokens.some(t => t.eligibility === 'wiseman-prediction'));
  });
}
