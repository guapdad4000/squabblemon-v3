import assert from 'node:assert/strict';
import test from 'node:test';
import { NEIGHBORHOOD_WAVE } from '../../../lib/squabblemon-engine/src/neighborhoodWave';
import { getStoryBattle } from '@workspace/squabblemon-engine/story';
import { cards, cardCatalog, catalogCardById, validateSavedDeck, validateCardAbilityUpgrades } from './data';
import { createCardInstance, createMatch, createMatchFromEngineCards, createStoryMatch, getStoryLockedLanes, createAbilityUpgradeSnapshot, nextRound, playTurnCard, SUMMON_TEMPLATES,
  type Match, type Owner, type Lane, type CardInstance } from './gameEngine';
import { createOnlineRoom, onlineRoomView } from '@workspace/squabblemon-engine/multiplayer';

const blank = (): Match => ({ ...createMatch('block', 'block'), round: 3, playerMotion: 9, cpuMotion: 9,
  playerHand: [], cpuHand: [], boards: [[], [], []], squabbleByOwner: { player: false, cpu: false } });
const unit = (id: string, owner: Owner = 'player', lane: Lane = 0, index = 0): CardInstance => ({
  ...createCardInstance(id, owner, 'test', index), lane,
});
const find = (m: Match, id: string) => m.boards.flat().find(c => c.cardId === id)!;
const mushrooms = (m: Match, owner?: Owner) => m.boards.flat().filter(c =>
  c.cardId === 'demario-mushroom' && (!owner || c.owner === owner));
const mushroomConsumptionEvents = (m: Match) => m.effectLog.filter(e => /consumed.*Mushroom.*\+2 Hands/i.test(e.note));
test('story round-two lane locks apply before Demario plants the new round’s Mushroom', () => {
  const base = createMatch('block', 'block');
  const original = getStoryBattle('receipts-on-camera')!.encounter;
  const story = { ...original, modifiers: { ...original.modifiers, laneLocks: [], lanePowerBonuses: [] },
    phases: [{ id: 'round-two-delivery', name: 'Delivery arrives', trigger: { kind: 'round' as const, atLeast: 2 },
      onEnter: [{ kind: 'lane-lock' as const, owner: 'both' as const, lanes: [1 as Lane] },
        { kind: 'reinforcement' as const, owner: 'player' as const, cardId: 'demario' }] },
    { id: 'mushroom-threshold', name: 'Mushroom pressure', trigger: { kind: 'total-power' as const, owner: 'player' as const, atLeast: 2 },
      onEnter: [{ kind: 'lane-lock' as const, owner: 'player' as const, lanes: [2 as Lane] }] }] };
  const start = createStoryMatch(story, base.playerCardIds, 'demario-story');
  assert.equal(mushrooms(start,'player').length,0);
  const existing = new Set(mushrooms(start,'player').map(card => card.instanceId));
  const next = nextRound({ ...start, phase: 'resolved' });
  assert(next.playerHand.some(card=>card.cardId==='demario'),'phase reinforcement reaches the hand before passive triggers');
  assert(getStoryLockedLanes(next,'player').includes(1));
  const fresh = mushrooms(next,'player').filter(card => !existing.has(card.instanceId));
  assert.equal(fresh.length,1);
  assert.notEqual(fresh[0].lane,1,'the district locked by this round’s story phase is ineligible');
  const lock = next.effectLog.find(event => /lane-lock/.test(event.note) && event.replay.after.round === 2);
  const sprout = next.effectLog.find(event => /sprouted/.test(event.note) && event.owner === 'player'
    && event.replay.after.boards.flat().some(card => card.instanceId === fresh[0].instanceId));
  assert(lock && sprout && lock.sequence < sprout.sequence,'the new lock resolves before the sprout event');
  const threshold = next.effectLog.find(event => /phase:mushroom-threshold:0: lane-lock/.test(event.note));
  assert(threshold && sprout.sequence < threshold.sequence,'the Mushroom activates the new power threshold before players act');
  assert.equal(next.storyRuntime?.activePhaseIndex,1);
  assert(getStoryLockedLanes(next,'player').includes(2));
});
test('opening hand Mushroom activates a story power threshold on match creation', () => {
  const original = getStoryBattle('receipts-on-camera')!.encounter;
  const story = { ...original, modifiers: { ...original.modifiers, laneLocks: [], lanePowerBonuses: [] },
    phases: [{ id: 'first-sprout', name: 'First sprout', trigger: { kind: 'total-power' as const, owner: 'player' as const, atLeast: 2 },
      onEnter: [{ kind: 'lane-lock' as const, owner: 'player' as const, lanes: [1 as Lane] }] }] };
  const ids = createMatch('block','block').playerCardIds.filter(id => id !== 'demario');
  const start = createStoryMatch(story, ['demario',...ids].slice(0,10), 'opening-sprout');
  assert.equal(mushrooms(start,'player').length,1);
  assert.equal(start.storyRuntime?.activePhaseIndex,0);
  assert(getStoryLockedLanes(start,'player').includes(1));
  assert(start.effectLog.some(event=>/phase:first-sprout:0: lane-lock/.test(event.note)));
});
function localMushroomFixture(m: Match, owner: Owner = 'player', lane: Lane = 0, count = 1): Match {
  const seed = find(cast(blank(), 'demario'), 'demario-mushroom');
  const boards = m.boards.map(items => items.filter(c => c.cardId !== 'demario-mushroom')) as Match['boards'];
  for (let i = 0; i < count; i++) boards[lane].push({
    ...seed, owner, lane, instanceId: `${owner}:fixture:${i}:demario-mushroom`,
  });
  return { ...m, boards };
}
function cast(m: Match, id: string, owner: Owner = 'player', lane: Lane = 0, squabble = false, tier = 0) {
  const card = createCardInstance(id, owner, 'cast');
  if (tier) m = { ...m, abilityUpgradeSnapshot: createAbilityUpgradeSnapshot(owner === 'player' ? [id] : [], owner === 'cpu' ? [id] : [],
    { [owner]: { [id]: { level: [1, 2, 5, 8][tier], xp: 2800, moveTier: tier } } }) };
  return playTurnCard({ ...m, phase: owner === 'player' ? 'player' : 'cpu-reveal',
    [owner === 'player' ? 'playerHand' : 'cpuHand']: [card] }, owner, card.instanceId, lane, squabble);
}

test('five collectible identities have rarities, three upgrades and legal acquisition; forms and tokens do not', () => {
  validateCardAbilityUpgrades();
  for (const [id, name, rarity] of NEIGHBORHOOD_WAVE) {
    assert.equal(cards[id].name, name);
    assert.equal(catalogCardById[id].rarity, rarity);
    assert.equal(catalogCardById[id].artworkId, id);
    assert.equal(cards[id].abilityUpgrades.length, 3);
    assert.deepEqual(catalogCardById[id].acquisitionSources, ['Street Packs']);
  }
  const ids = [...NEIGHBORHOOD_WAVE.map(([id]) => id), ...cardCatalog.filter(c => !NEIGHBORHOOD_WAVE.some(([id]) => id === c.catalogId)).slice(0, 5).map(c => c.catalogId)];
  assert.equal(validateSavedDeck(ids, ids, 'luigion').valid, true);
  for (const id of ['luigion-powered', 'demario-mushroom']) {
    assert.equal(catalogCardById[id], undefined);
    assert.equal(cards[id], undefined);
  }
  assert.equal(SUMMON_TEMPLATES['demario-mushroom'].power, 2);
  assert.match(cards.demario.effect, /While in hand: At the start of each round, summon one 2-Hand Mushroom/);
  assert.match(cards.demario.effect, /On Reveal: Summon two more Mushrooms in random open districts/);
  assert.match(SUMMON_TEMPLATES['demario-mushroom'].effect, /consumes one Mushroom for \+2 Hands/);
});

for (const owner of ['player', 'cpu'] as const) {
  test(`${owner}: base abilities and all upgrade tiers are deterministic and immutable`, () => {
    for (const [id] of NEIGHBORHOOD_WAVE) for (let tier = 0; tier <= 3; tier++) {
      const m = blank(), ally = unit('rastamon', owner), rival = unit('hooper', owner === 'player' ? 'cpu' : 'player', 1);
      ally.statuses.burnStacks = 2; ally.statuses.frozen = true; ally.statuses.silenced = true;
      m.boards[0] = [ally]; m.boards[1] = [rival];
      const saved = JSON.stringify(m);
      const after = cast(m, id, owner, 0, false, tier);
      assert.equal(JSON.stringify(m), saved);
      assert.deepEqual(cast(JSON.parse(saved), id, owner, 0, false, tier), after);
      assert.equal(find(after, id).powerModifier, tier + (id === 'luigion' ? 1 : 0));
      if (id === 'luigion') assert.equal(find(after, 'rastamon').powerModifier, 1);
      if (id === 'hair-stylist') {
        assert.equal(find(after, 'rastamon').statuses.burnStacks, 0);
        assert.equal(find(after, 'rastamon').statuses.frozen, false);
        assert.equal(find(after, 'rastamon').statuses.silenced, false);
        assert.equal(find(after, 'rastamon').powerModifier, 1);
      }
      if (id === 'stylist') { assert.equal(find(after, 'rastamon').statuses.protected, true); assert.equal(find(after, 'rastamon').powerModifier, 1); }
      if (id === 'demario') assert.equal(find(after, 'demario-mushroom').basePower, 2);
      if (id === 'black-cowboy') assert.equal(find(after, 'hooper').lane, 0);
    }
  });
  test(`${owner}: mushroom requires summon space, and Squabble transforms independently`, () => {
    const full = blank();
    full.boards = [[0, 1, 2].map(i => unit('rastamon', owner, 0, i)),
      [0, 1, 2, 3].map(i => unit('rastamon', owner, 1, i + 3)),
      [0, 1, 2, 3].map(i => unit('rastamon', owner, 2, i + 7))];
    assert.equal(find(cast(full, 'demario', owner, 0, false, 3), 'demario-mushroom'), undefined);
    assert.equal(find(cast(full, 'demario', owner, 0, false, 3), 'demario').powerModifier, 0);
    const solo = cast(blank(), 'luigion', owner, 0, true);
    assert.equal(find(solo, 'luigion').id, 'luigion-powered');
    assert.equal(find(solo, 'luigion').powerModifier, 6);
    assert.equal(find(cast(blank(), 'luigion', owner), 'luigion').powerModifier, 2);
    assert.equal(find(cast(blank(), 'luigion', owner, 0, true, 3), 'luigion').powerModifier, 9);
  });
}

for (const owner of ['player', 'cpu'] as const) {
  test(`${owner}: Demario plants once on round one and once on every later round while active in hand`, () => {
    const ids = ['demario', 'luigion', 'plug', 'watson', 'bustdown', 'soulfood', 'gamer', 'counter', 'nerd', 'buddy'];
    const otherIds = ['luigion', 'plug', 'watson', 'bustdown', 'soulfood', 'gamer', 'counter', 'nerd', 'buddy', 'cornball'];
    const opening = createMatchFromEngineCards('passive-owner', owner === 'player' ? ids : otherIds,
      'passive-opponent', owner === 'cpu' ? ids : otherIds);
    const hand = owner === 'player' ? opening.playerHand : opening.cpuHand;
    assert.ok(hand.some(card => card.cardId === 'demario' && !card.statuses.silenced));
    assert.equal(mushrooms(opening, owner).length, 1);
    assert.equal(mushrooms(opening).length, 1);
    assert.equal(JSON.stringify(createMatchFromEngineCards('passive-owner', owner === 'player' ? ids : otherIds,
      'passive-opponent', owner === 'cpu' ? ids : otherIds)), JSON.stringify(opening));
    assert.ok(opening.boards.every(lane => lane.filter(card => card.owner === owner).length <= 4));

    let repeated = { ...opening, phase: 'resolved' as const };
    for (let round = 2; round <= 4; round++) {
      const before = mushrooms(repeated, owner).length;
      const saved = JSON.stringify({ ...repeated, phase: 'resolved' as const });
      repeated = nextRound(JSON.parse(saved));
      assert.equal(JSON.stringify(nextRound(JSON.parse(saved))), JSON.stringify(repeated));
      assert.equal(repeated.round, round);
      assert.equal(mushrooms(repeated, owner).length - before, 1);
      assert.ok((owner === 'player' ? repeated.playerHand : repeated.cpuHand).some(card => card.cardId === 'demario'));
      assert.ok(repeated.boards.every(lane => lane.filter(card => card.owner === owner).length <= 4));
    }
  });

  test(`${owner}: Demario reveal makes two seeded eligible summons and replays identically`, () => {
    const reveal = (index: number) => {
      const source = createCardInstance('demario', owner, `reveal-seed-${index}`, index);
      const m = blank();
      const hand = owner === 'player' ? 'playerHand' : 'cpuHand';
      return playTurnCard({ ...m, phase: owner === 'player' ? 'player' : 'cpu-reveal', [hand]: [source] },
        owner, source.instanceId, 0);
    };
    const first = reveal(0), replay = reveal(0);
    assert.deepEqual(replay, first);
    assert.deepEqual(JSON.parse(JSON.stringify(first)), first);
    assert.equal(mushrooms(first, owner).length, 2);
    assert.ok(mushrooms(first, owner).every(card => card.lane !== null
      && first.boards[card.lane].filter(item => item.owner === owner).length <= 4));
    const observedLanes = new Set<number>();
    for (let seed = 1; seed <= 16; seed++) {
      const after = reveal(seed);
      const summoned = mushrooms(after, owner);
      assert.equal(summoned.length, 2);
      for (const mushroom of summoned) observedLanes.add(mushroom.lane!);
    }
    assert.ok(observedLanes.size > 1, 'different source seeds should vary eligible summon lanes');
  });

  test(`${owner}: hand passive and reveal summons respect capacity in all three districts`, () => {
    const ids = ['demario', 'luigion', 'plug', 'watson', 'bustdown', 'soulfood', 'gamer', 'counter', 'nerd', 'buddy'];
    const otherIds = ['luigion', 'plug', 'watson', 'bustdown', 'soulfood', 'gamer', 'counter', 'nerd', 'buddy', 'cornball'];
    const opening = createMatchFromEngineCards('full-owner', owner === 'player' ? ids : otherIds,
      'full-opponent', owner === 'cpu' ? ids : otherIds);
    const full = { ...opening, phase: 'resolved' as const,
      boards: [0, 1, 2].map((lane) => [0, 1, 2, 3].map(index => unit('rastamon', owner, lane as Lane, lane * 10 + index))) as Match['boards'] };
    const next = nextRound(full);
    assert.equal(mushrooms(next, owner).length, 0);
    assert.deepEqual(next.boards.map(lane => lane.filter(card => card.owner === owner).length), [4, 4, 4]);

    const revealFixture = blank();
    revealFixture.boards = [[0, 1, 2].map(i => unit('rastamon', owner, 0, i)),
      [0, 1, 2, 3].map(i => unit('rastamon', owner, 1, i + 3)),
      [0, 1, 2, 3].map(i => unit('rastamon', owner, 2, i + 7))];
    const source = createCardInstance('demario', owner, 'capacity-reveal');
    const hand = owner === 'player' ? 'playerHand' : 'cpuHand';
    const revealed = playTurnCard({ ...revealFixture, phase: owner === 'player' ? 'player' : 'cpu-reveal', [hand]: [source] },
      owner, source.instanceId, 0);
    assert.equal(mushrooms(revealed, owner).length, 0);
    assert.deepEqual(revealed.boards.map(lane => lane.filter(card => card.owner === owner).length), [4, 4, 4]);
  });

  test(`${owner}: absent or silenced Demario in hand does not sprout`, () => {
    const ids = ['luigion', 'plug', 'watson', 'bustdown', 'soulfood', 'gamer', 'counter', 'nerd', 'buddy', 'cornball'];
    const match = createMatchFromEngineCards('no-passive', ids, 'other-side', [...ids]);
    const noDemario = nextRound({ ...match, phase: 'resolved' });
    assert.equal(mushrooms(noDemario).length, 0);

    const silenced = createCardInstance('demario', owner, 'silenced-hand');
    silenced.statuses.silenced = true;
    const hand = owner === 'player' ? 'playerHand' : 'cpuHand';
    const withSilenced = nextRound({ ...match, [hand]: [silenced], phase: 'resolved' });
    assert.equal(mushrooms(withSilenced).length, 0);
    assert.ok((owner === 'player' ? withSilenced.playerHand : withSilenced.cpuHand)
      .some(card => card.instanceId === silenced.instanceId && card.statuses.silenced));
  });
}

test('Luigion consumes only one same-owner same-lane mushroom, preserving identity and historical frames', () => {
  let m = localMushroomFixture(blank(), 'player', 0, 2);
  const mushroom = find(m, 'demario-mushroom');
  m.boards[0].push({ ...mushroom, owner: 'cpu', instanceId: 'enemy-mushroom' });
  m.boards[1].push({ ...mushroom, lane: 1, instanceId: 'remote-mushroom' });
  const before = JSON.stringify(m);
  const consumedBefore = mushroomConsumptionEvents(m).length;
  const after = cast(m, 'luigion', 'player', 0, true);
  const luigion = find(after, 'luigion');
  assert.equal(JSON.stringify(m), before);
  assert.equal(luigion.cardId, 'luigion');
  assert.equal(luigion.name, 'Powered Luigion');
  assert.equal(luigion.instanceId, 'player:cast:0:luigion');
  assert.equal(luigion.powerModifier, 7); // +3 Squabble, +1 base reveal, +2 Mushroom, +1 jump
  assert.equal(mushrooms(after, 'player').length, mushrooms(m, 'player').length - 1);
  assert.equal(mushroomConsumptionEvents(after).length - consumedBefore, 1);
  assert.ok(after.boards[0].some(c => c.instanceId === 'enemy-mushroom'));
  assert.ok(after.boards[1].some(c => c.instanceId === 'remote-mushroom'));
  assert.deepEqual(cast(JSON.parse(before), 'luigion', 'player', 0, true), after);
  assert.ok(after.effectLog.some(e => e.replay.after.boards.flat().some(c => c.id === 'luigion-powered')));
  const normal = cast(m, 'luigion');
  assert.equal(mushrooms(normal, 'player').length, mushrooms(m, 'player').length - 1);
});

test('form preserves existing statuses and buffs and projects public art without leaking rival hands', () => {
  const card = createCardInstance('luigion', 'player');
  card.powerModifier = 3; card.statuses.protected = true; card.statuses.silenced = true;
  const m = playTurnCard({ ...blank(), playerHand: [card], cpuHand: [createCardInstance('demario', 'cpu')] }, 'player', card.instanceId, 0, true);
  assert.equal(find(m, 'luigion').powerModifier, 6);
  assert.deepEqual(find(m, 'luigion').statuses, card.statuses);
  const host = { userId: 'host', name: 'Host', ready: true, deck: { id: 'custom', name: 'Crew', hero: 'luigion', cards: m.playerCardIds } };
  const room = { ...createOnlineRoom(host, 'player', 0), match: JSON.parse(JSON.stringify(m)), status: 'active' as const };
  const view = onlineRoomView(room, 'test', 'host', 1);
  assert.equal(view.boards[0][0].artworkId, 'luigion-powered');
  assert.equal(view.boards[0][0].cardId, 'luigion');
  assert.equal(view.boards[0][0].form?.name, 'Powered Luigion');
  assert.equal(view.rivalHandCount, 1);
  assert.equal('cpuHand' in view, false);
});

test('opponent and remote mushrooms never grant a transformation bonus', () => {
  const m = blank();
  const seed = find(cast(blank(), 'demario'), 'demario-mushroom');
  m.boards[0] = [{ ...seed, owner: 'cpu', instanceId: 'enemy-only' }];
  m.boards[1] = [{ ...seed, lane: 1, instanceId: 'remote-only' }];
  const after = cast(m, 'luigion', 'player', 0, true);
  assert.equal(find(after, 'luigion').powerModifier, 6);
  assert.ok(after.boards[0].some(c => c.instanceId === 'enemy-only'));
  assert.ok(after.boards[1].some(c => c.instanceId === 'remote-only'));
});

test('lasso respects locks, immunity, destination cap, and deterministic weakest tie breaks', () => {
  for (const status of ['locked', 'uncounterable'] as const) {
    const m = blank(), target = unit('rastamon', 'cpu', 1);
    target.statuses[status] = true; m.boards[1] = [target];
    const after = cast(m, 'black-cowboy', 'player', 0, false, 3);
    assert.equal(find(after, 'rastamon').lane, 1);
    assert.equal(find(after, 'black-cowboy').powerModifier, 0);
  }
  const m = blank(); m.boards[1] = [unit('rastamon', 'cpu', 1, 2), unit('rastamon', 'cpu', 1, 1)];
  assert.equal(cast(m, 'black-cowboy').boards[0].find(c => c.owner === 'cpu')?.instanceId, 'cpu:test:1:rastamon');
  m.boards[0] = [0, 1, 2, 3].map(i => unit('rastamon', 'cpu', 0, i + 10));
  assert.equal(cast(m, 'black-cowboy').boards[1].length, 2);
});

for (const owner of ['player', 'cpu'] as const) {
  test(`${owner}: opening Demario and both Luigion forms get exactly one local premium at all tiers`, () => {
    for (let tier = 0; tier <= 3; tier++) for (const powered of [false, true]) {
      const opening = { ...blank(), round: 1, playerMotion: 2, cpuMotion: 2 };
      const setup = cast(opening, 'demario', owner);
      assert.equal(setup[owner === 'player' ? 'playerMotion' : 'cpuMotion'], 0);
      assert.equal(find(setup, 'demario').basePower, 3);
      assert.equal(find(setup, 'demario-mushroom').basePower, 2);
      const m = { ...localMushroomFixture(setup, owner, 0, 1), playerMotion: 9, cpuMotion: 9 };
      const before = JSON.stringify(m), after = cast(m, 'luigion', owner, 0, powered, tier);
      assert.equal(JSON.stringify(m), before);
      assert.deepEqual(cast(JSON.parse(before), 'luigion', owner, 0, powered, tier), after);
      assert.equal(find(after, 'luigion').powerModifier, tier + (powered ? 7 : 3));
      assert.equal(find(after, 'demario').powerModifier, 1);
      assert.equal(mushrooms(after, owner).length, mushrooms(m, owner).length - 1);
      assert.equal(find(after, 'luigion').luigionMushroomUsed, true);
      assert.equal(after.effectLog.filter(e => e.abilityMetadata).length, tier);
      const echo = cast({ ...after, playerMotion: 9, cpuMotion: 9 }, 'tayaty', owner, 2);
      assert.equal(mushrooms(echo, owner).length, mushrooms(after, owner).length);
      assert.equal(echo.effectLog.filter(e => e.abilityMetadata).length, tier);
    }
  });
  test(`${owner}: Luigion counts legacy and other Luigion characters, but not tokens, supports, enemies or hazards`, () => {
    const enemy = owner === 'player' ? 'cpu' : 'player';
    for (const ally of [unit('rastamon', owner), unit('luigion', owner)]) {
      const m = blank(); m.boards[0] = [ally];
      const after = cast(m, 'luigion', owner);
      assert.equal(after.boards[0].find(c => c.instanceId === ally.instanceId)!.powerModifier, 1);
      assert.equal(after.boards[0].find(c => c.instanceId === `${owner}:cast:0:luigion`)!.powerModifier, 1);
    }
    for (const invalid of [
      unit('rastamon', enemy), { ...unit('rastamon', owner), kind: 'token' as const },
      { ...unit('rastamon', owner), kind: 'support' as const }, { ...unit('rastamon', owner), hazard: true as const },
    ]) {
      const m = blank(); m.boards[0] = [invalid];
      const after = cast(m, 'luigion', owner);
      assert.equal(find(after, 'luigion').powerModifier, 2);
      assert.equal(after.boards[0].find(c => c.instanceId === invalid.instanceId)!.powerModifier, 0);
    }
  });
  test(`${owner}: disabled Luigion cannot consume or train; ordinary consumers get exactly +2`, () => {
    for (const powered of [false, true]) for (const status of ['silenced', 'frozen', 'weakened'] as const) {
      const setup = localMushroomFixture(cast(blank(), 'demario', owner), owner, 0, 1);
      const mushroomId = find(setup, 'demario-mushroom').instanceId;
      const source = createCardInstance('luigion', owner);
      source.statuses[status] = true;
      const hand = owner === 'player' ? 'playerHand' : 'cpuHand';
      const after = playTurnCard({ ...setup, phase: owner === 'player' ? 'player' : 'cpu-reveal', [hand]: [source] }, owner, source.instanceId, 0, powered);
      assert.equal(find(after, 'luigion').powerModifier, powered ? 3 : 0);
      assert.ok(after.boards.flat().some(card => card.instanceId === mushroomId));
    }
    const setup = localMushroomFixture(cast(blank(), 'demario', owner), owner, 0, 1);
    const consumedBefore = mushroomConsumptionEvents(setup).length;
    const after = cast(setup, 'rastamon', owner);
    assert.equal(find(after, 'rastamon').powerModifier, 2);
    assert.equal(mushrooms(after, owner).length, mushrooms(setup, owner).length - 1);
    assert.equal(mushroomConsumptionEvents(after).length - consumedBefore, 1);
  });
  test(`${owner}: ordinary deployment consumes one Mushroom, not on echoes; a silenced entrant still consumes`, () => {
    const setup = localMushroomFixture(cast(blank(), 'demario', owner), owner, 0, 1);
    const initialConsumed = mushroomConsumptionEvents(setup).length;
    const after = cast(setup, 'cornball', owner);
    assert.equal(find(after, 'cornball').powerModifier, 2);
    assert.equal(mushrooms(after, owner).length, mushrooms(setup, owner).length - 1);
    assert.equal(mushroomConsumptionEvents(after).length - initialConsumed, 1);
    const echoed = cast({ ...after, playerMotion: 9, cpuMotion: 9 }, 'oz', owner, 1);
    assert.equal(mushrooms(echoed, owner).length, mushrooms(after, owner).length);
    const silencedSetup = localMushroomFixture(after, owner, 0, 1);
    const silencedConsumed = mushroomConsumptionEvents(silencedSetup).length;
    const source = createCardInstance('cornball', owner);
    source.statuses.silenced = true;
    const hand = owner === 'player' ? 'playerHand' : 'cpuHand';
    const disabled = playTurnCard({ ...silencedSetup, playerMotion: 9, cpuMotion: 9,
      phase: owner === 'player' ? 'player' : 'cpu-reveal', [hand]: [source] }, owner, source.instanceId, 0);
    assert.equal(mushrooms(disabled, owner).length, mushrooms(silencedSetup, owner).length - 1);
    assert.equal(mushroomConsumptionEvents(disabled).length - silencedConsumed, 1);
    assert.equal(disabled.boards[0].find(c => c.instanceId === source.instanceId)?.powerModifier, 2);
  });
  test(`${owner}: Oz echoes cannot consume another Mushroom; return and redeploy can`, () => {
    let m = localMushroomFixture(cast(blank(), 'demario', owner), owner, 0, 2);
    const mushroom = find(m, 'demario-mushroom');
    m = cast(m, 'luigion', owner);
    const source = find(m, 'luigion');
    m = cast({ ...m, playerMotion: 9, cpuMotion: 9 }, 'oz', owner, 1);
    assert.equal(mushrooms(m, owner).length, 1);
    // Dorothy selects the weakest printed-two character: ensure it is Luigion.
    m.boards[0] = m.boards[0].map(c => c.instanceId === source.instanceId ? { ...c, powerModifier: -1 } : c);
    m = cast({ ...m, playerMotion: 9, cpuMotion: 9 }, 'dorothy', owner);
    const hand = owner === 'player' ? 'playerHand' : 'cpuHand';
    const returned = m[hand].find(c => c.instanceId === source.instanceId)!;
    assert(returned);
    // Dorothy was an ordinary consumer and used the spare; place a fresh local resource.
    m.boards[0].push({ ...mushroom, instanceId: 'redeploy-resource' });
    const after = playTurnCard({ ...m, playerMotion: 9, cpuMotion: 9 }, owner, returned.instanceId, 0);
    assert.equal(find(after, 'luigion').powerModifier, 4); // +1 base, +1 ally, +2 local Mushroom
    assert.equal(after.boards[0].some(c => c.instanceId === 'redeploy-resource'), false);
  });
}