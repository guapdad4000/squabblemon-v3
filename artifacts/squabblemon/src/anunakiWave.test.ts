import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compactMatchReplay, restoreMatchReplay, createAbilityUpgradeSnapshot, createCardInstance, createMatch, createMatchFromEngineCards, getCharacterDistrictMarks, getEffectiveCardPower, getLegalCardCost, nextRound, pass, playTurnCard, revealCpuTurn, verifyMatchTranscript, type Lane, type Match, type Owner, type PlayerMove } from '../../../lib/squabblemon-engine/src/gameEngine';
import { cardCatalog, cards, decks } from '../../../lib/squabblemon-engine/src/data';
import { anunakiCards } from '../../../lib/squabblemon-engine/src/anunakiWave';
import { ANUNAKI_BANNER_GAMEPLAY_READY, isAnunakiBannerCardId } from '../../../lib/squabblemon-engine/src/anunakiBanner';
import { ANUNAKI_EVENT_GAMEPLAY_READY, isAnunakiEventCatalogAvailable, isAnunakiEventRewardId } from '../../../lib/squabblemon-engine/src/anunakiEvent';
import { draftOffers } from '../../../lib/squabblemon-engine/src/activities';
import { applyOnlineCommand, createOnlineRoom, joinOnlineRoom, onlineRoomView } from '../../../lib/squabblemon-engine/src/multiplayer';

const blank = (): Match => ({ ...createMatch('block', 'block'), round: 3, playerMotion: 9, cpuMotion: 9, squabbleByOwner: { player: false, cpu: false }, playerHand: [], cpuHand: [], boards: [[], [], []] });
const unit = (id: string, owner: Owner, lane: Lane, index: number) => ({ ...createCardInstance(id, owner, 'fixture', index), lane });
function cast(m: Match, id: string, owner: Owner = 'player', lane: Lane = 0, squabble = false) {
  const card = createCardInstance(id, owner, 'cast', m.nextEventSequence);
  const after = playTurnCard({ ...m, phase: owner === 'player' ? 'player' : 'cpu-reveal', [owner === 'player' ? 'playerHand' : 'cpuHand']: [card] }, owner, card.instanceId, lane, squabble);
  return { after, card };
}
const power = (m: Match, id: string) => getEffectiveCardPower(m.boards.flat().find(c => c.instanceId === id)!);

test('Anunaki reach the public catalog only with the gameplay readiness gate', () => {
  for (const id of Object.keys(anunakiCards)) {
    assert(cards[id]);
    assert.equal(cardCatalog.some(card => card.engineId === id), (ANUNAKI_EVENT_GAMEPLAY_READY && isAnunakiEventRewardId(id)) || (ANUNAKI_BANNER_GAMEPLAY_READY && isAnunakiBannerCardId(id)));
    assert.equal(isAnunakiEventCatalogAvailable(id, false), false);
    assert.equal(isAnunakiEventCatalogAvailable(id, true), ['yakub', 'caucus-mountaineer', 'anu'].includes(id));
  }
  {
    for (let week = 1; week <= 52; week++) {
      assert(draftOffers(`audit-${week}`).flat().every(id => !Object.hasOwn(anunakiCards, id)));
    }
  }
});

for (const owner of ['player', 'cpu'] as const) {
  test(`Caucus chains only landed hits, is bounded and replays deterministically for ${owner}`, () => {
    const enemyOwner = owner === 'player' ? 'cpu' : 'player';
    let sawChain = false, sawMiss = false;
    assert.equal(anunakiCards['caucus-mountaineer'].cost, 2);
    assert.equal(anunakiCards['caucus-mountaineer'].power, 3);
    for (let i = 0; i < 40; i++) {
      const m = blank(), target = unit('buddy', enemyOwner, 0, i);
      target.powerModifier = 100;
      m.boards[0] = [target]; m.nextEventSequence += i;
      const first = cast(m, 'caucus-mountaineer', owner);
      const second = cast(JSON.parse(JSON.stringify(m)), 'caucus-mountaineer', owner);
      assert.deepEqual(first.after, second.after);
      const copies = first.after.boards[0].filter(c => c.cardId === 'caucus-mountaineer');
      assert(copies.length >= 1 && copies.length <= 9);
      assert.equal(power(first.after, target.instanceId), getEffectiveCardPower(target) - copies.length);
      assert.equal(first.after.effectLog.filter(e => e.note === 'Lab Accident landed for 1 damage.').length, copies.length);
      sawChain ||= copies.length > 1; sawMiss ||= copies.length === 1;
    }
    assert(sawChain && sawMiss, 'independent seeds exercise both roll outcomes');
    const protectedMatch = blank(), shielded = unit('buddy', enemyOwner, 0, 40);
    shielded.statuses.protected = true;
    protectedMatch.timedEffects.push({ id: 'caucus-shield', kind: 'church-protection', owner: enemyOwner, sourceInstanceId: shielded.instanceId, targetInstanceId: shielded.instanceId, lane: 0, startsAtRound: 1, expiresAtRound: 7, expiration: 'match-complete' });
    protectedMatch.boards[0] = [shielded];
    const blocked = cast(protectedMatch, 'caucus-mountaineer', owner).after;
    assert.equal(blocked.boards[0].filter(c => c.cardId === 'caucus-mountaineer').length, 1);
    assert.equal(power(blocked, shielded.instanceId), getEffectiveCardPower(shielded));
    assert(blocked.effectLog.some(e => e.note === 'Lab Accident was blocked.'));
  });
  test(`Caucus radiation is owner- and lane-specific and ends with its tablet for ${owner}`, () => {
    const enemy = owner === 'player' ? 'cpu' : 'player';
    const same = unit('caucus-mountaineer', owner, 0, 1), copy = unit('caucus-mountaineer', owner, 0, 2);
    const otherLane = unit('caucus-mountaineer', owner, 1, 3), opposing = unit('caucus-mountaineer', enemy, 0, 4);
    const m = blank(); m.phase = 'resolved'; m.boards[0] = [same, copy, opposing]; m.boards[1] = [otherLane];
    m.ancientTablets = [{ owner, lane: 0 }];
    const next = nextRound(m);
    assert.equal(power(next, same.instanceId), 4); assert.equal(power(next, copy.instanceId), 4);
    assert.equal(power(next, opposing.instanceId), 3); assert.equal(power(next, otherLane.instanceId), 3);
    assert.deepEqual(next.ancientTablets, [{ owner, lane: 0 }]);
    const event = next.effectLog.find(e => e.cardInstanceId === same.instanceId && e.note.includes('radiation'))!;
    assert.equal(power({ ...next, ...event.replay.before }, same.instanceId), 3);
    assert.equal(power({ ...next, ...event.replay.after }, same.instanceId), 4);
    const stopped = nextRound({ ...next, phase: 'resolved', ancientTablets: [] });
    assert.equal(power(stopped, same.instanceId), 4);
  });
  test(`Anunaki tablet payoffs have useful fallback and maximum values for ${owner}`, () => {
    const enemy = owner === 'player' ? 'cpu' : 'player';
    for (const [id, base] of [['inanna', 3]] as const) {
      const fallback = cast(blank(), id, owner);
      assert.equal(power(fallback.after, fallback.card.instanceId), base + 1);
      const setup = blank(); setup.ancientTablets = [{ owner, lane: 0 }, { owner: enemy, lane: 0 }];
      const payoff = cast(setup, id, owner);
      assert.equal(power(payoff.after, payoff.card.instanceId), base + 4);
      assert.deepEqual(payoff.after.ancientTablets, [{ owner: enemy, lane: 0 }]);
    }
    const noTablets = cast(blank(), 'anu', owner);
    assert.equal(power(noTablets.after, noTablets.card.instanceId), 10);
    const three = blank(); three.ancientTablets = [0, 1, 2].map(lane => ({ owner, lane: lane as Lane }));
    const fullPayoff = cast(three, 'anu', owner);
    assert.equal(power(fullPayoff.after, fullPayoff.card.instanceId), 14);
    assert.equal(fullPayoff.after.ancientTablets!.length, 0);
  });
  test(`tablets belong to each owner, never use a slot, deduplicate, and replay for ${owner}`, () => {
    const enemy = owner === 'player' ? 'cpu' : 'player';
    const start = blank(), saved = JSON.stringify(start);
    const first = cast(start, 'nabu', owner);
    assert.equal(JSON.stringify(start), saved);
    assert.deepEqual(first.after.ancientTablets, [{ owner, lane: 0 }]);
    assert.equal(first.after.boards[0].length, 1);
    const event = first.after.effectLog.find(e => e.note.includes('Placed an Ancient Tablet'))!;
    assert.deepEqual(event.replay.before.ancientTablets, []);
    assert.deepEqual(event.replay.after.ancientTablets, [{ owner, lane: 0 }]);
    let m = cast(first.after, 'enki', owner).after;
    assert.equal(m.ancientTablets!.length, 1);
    m = cast(m, 'nabu', enemy).after;
    assert.equal(m.ancientTablets!.length, 2);
    assert.equal(getCharacterDistrictMarks(m).filter(mark => mark.text.startsWith('Ancient Tablet')).length, 2);
    const fighter = cast(m, 'inanna', owner);
    assert.equal(power(fighter.after, fighter.card.instanceId), 7);
    assert.deepEqual(fighter.after.ancientTablets, [{ owner: enemy, lane: 0 }]);
  });
  test(`Anu consumes only his own tablets across lanes for ${owner}`, () => {
    const enemy = owner === 'player' ? 'cpu' : 'player';
    let m = blank();
    m.ancientTablets = [{ owner, lane: 0 }, { owner, lane: 1 }, { owner: enemy, lane: 2 }];
    const result = cast(m, 'anu', owner, 2);
    assert.equal(power(result.after, result.card.instanceId), 11);
    assert.deepEqual(result.after.ancientTablets, [{ owner: enemy, lane: 2 }]);
    assert.equal(result.after.effectLog.find(e => e.note.includes('Consumed 1 Ancient'))!.replay.before.ancientTablets!.length, 2);
  });
  test(`Yakub summons one normally or two on Squabble without On Reveal without buffing later plays for ${owner}`, () => {
    assert.equal(anunakiCards.yakub.cost, 2);
    assert.equal(anunakiCards.yakub.power, 1);
    const enemy = owner === 'player' ? 'cpu' : 'player';
    const enemyTarget = unit('buddy', enemy, 0, 90);
    const normalStart = blank(); normalStart.boards[0] = [enemyTarget];
    const normal = cast(normalStart, 'yakub', owner);
    assert.equal(power(normal.after, normal.card.instanceId), 1);
    assert.equal(normal.after.boards[0].filter(c => c.cardId === 'caucus-mountaineer').length, 1);
    assert.equal(power(normal.after, enemyTarget.instanceId), getEffectiveCardPower(enemyTarget), 'Yakub summons do not activate Lab Accident');
    const squabbleStart = blank(); squabbleStart.boards[0] = [enemyTarget];
    const summoned = cast(squabbleStart, 'yakub', owner, 0, true);
    assert.equal(power(summoned.after, summoned.card.instanceId), 2);
    const mountaineers = summoned.after.boards[0].filter(c => c.cardId === 'caucus-mountaineer');
    assert.equal(mountaineers.length, 2);
    assert.equal(new Set(mountaineers.map(c => c.instanceId)).size, 2);
    assert(mountaineers.every(c => getEffectiveCardPower(c) === 3));
    assert.equal(power(summoned.after, enemyTarget.instanceId), getEffectiveCardPower(enemyTarget));
    const summonEvent = summoned.after.effectLog.find(e => e.cardInstanceId === summoned.card.instanceId && e.note.includes('Summoned 2 free'))!;
    assert(summonEvent, 'the replay records the summon');
    assert.equal(summonEvent.replay.before.boards[0].filter(c => c.cardId === 'caucus-mountaineer').length, 0);
    assert.equal(summonEvent.replay.after.boards[0].filter(c => c.cardId === 'caucus-mountaineer').length, 2);
    assert.equal(summoned.after.yakubBuffs?.length ?? 0, 0);
    const played = cast(summoned.after, 'caucus-mountaineer', owner, 1);
    assert.equal(power(played.after, played.card.instanceId), 3);
    assert.equal(played.after.yakubBuffs?.length ?? 0, 0);
    const full = blank(); full.boards[0] = [unit('buddy', owner, 0, 1), unit('folks', owner, 0, 2), unit('drfade', owner, 0, 3), unit('cornball', owner, 0, 4), unit('waterboy', owner, 0, 5)];
    full.ancientTablets = [{ owner, lane: 0 }];
    const crowded = cast(full, 'yakub', owner, 0, true);
    const freeMountaineers = crowded.after.boards[0].filter(c => c.cardId === 'caucus-mountaineer');
    assert.equal(freeMountaineers.length, 2, 'Squabble summons into a district with more than four allies');
    assert.equal(crowded.after.boards[0].length, 8);
    assert(freeMountaineers.every(c => getEffectiveCardPower(c) === 3), 'the summoned Mountaineers do not resolve On Reveal');
    assert.deepEqual(crowded.after.ancientTablets, [{ owner, lane: 0 }], 'the summon leaves the tablet untouched');
  });
}
test('Utu places a tablet in an empty enemy district and consumes one for the stronger hit', () => {
  assert.equal(anunakiCards.utu.cost, 1);
  assert.equal(anunakiCards.utu.power, 2);
  const empty = cast(blank(), 'utu');
  assert.equal(empty.after.ancientTablets!.length, 1);
  const m = blank(); m.ancientTablets = [{ owner: 'player', lane: 0 }];
  const enemy = unit('buddy', 'cpu', 0, 4); enemy.powerModifier = 5; m.boards[0] = [enemy];
  const result = cast(m, 'utu');
  assert.equal(power(result.after, enemy.instanceId), getEffectiveCardPower(enemy) - 2);
  assert.equal(result.after.ancientTablets!.length, 0);
  const unboosted = cast({ ...m, ancientTablets: [] }, 'utu');
  assert.equal(power(unboosted.after, enemy.instanceId), getEffectiveCardPower(enemy) - 1);
});
test('legacy Yakub buff expires after the next round and does not affect summons', () => {
  const first = cast(blank(), 'yakub');
  first.after.yakubBuffs = [{owner: 'player', sourceInstanceId: first.card.instanceId, expiresAfterRound: 4}];
  const late = cast({ ...first.after, round: 5, playerMotion: 9 }, 'buddy', 'player', 1);
  assert.equal(power(late.after, late.card.instanceId), getEffectiveCardPower(late.card));
});
test('both online seats see public tablets after serialization without private pending buffs', () => {
  const member = (userId: string) => ({ userId, name: userId, ready: false, deck: decks[0] });
  let room = joinOnlineRoom(createOnlineRoom(member('a'), 'player', 0), member('b'), 0);
  room = applyOnlineCommand(applyOnlineCommand(room, 'player', { type: 'ready' }, 1), 'cpu', { type: 'ready' }, 2);
  room.match = cast(blank(), 'nabu').after;
  room.match.yakubBuffs = [{ owner: 'player', sourceInstanceId: 'private', expiresAfterRound: 4 }];
  room = JSON.parse(JSON.stringify(room));
  for (const user of ['a', 'b']) {
    const view = onlineRoomView(room, 'TABLET', user, 3);
    assert(view.districtMarks!.some(mark => mark.owner === 'player' && mark.lane === 0 && mark.text.startsWith('Ancient Tablet')));
    assert(!JSON.stringify(view).includes('yakubBuffs'));
  }
  room.match = cast(room.match, 'inanna').after;
  for (const user of ['a', 'b']) {
    const view = onlineRoomView(room, 'TABLET', user, 4);
    assert(view.events.some(event => event.tabletConsumed?.some(tablet => tablet.owner === 'player' && tablet.lane === 0)));
    assert(!JSON.stringify(view).includes('replay'));
  }
});
test('both online seats receive Caucus chain and tablet radiation outcomes', () => {
  const member = (userId: string) => ({ userId, name: userId, ready: false, deck: decks[0] });
  let room = joinOnlineRoom(createOnlineRoom(member('a'), 'player', 0), member('b'), 0);
  room = applyOnlineCommand(applyOnlineCommand(room, 'player', { type: 'ready' }, 1), 'cpu', { type: 'ready' }, 2);
  const m = blank(), target = unit('buddy', 'cpu', 0, 1);
  target.powerModifier = 30; m.boards[0] = [target]; m.ancientTablets = [{ owner: 'player', lane: 0 }];
  room.match = cast(m, 'caucus-mountaineer').after;
  for (const user of ['a', 'b']) {
    const view = onlineRoomView(room, 'CAUCUS', user, 3);
    assert(view.events.some(event => event.note.includes('Lab Accident landed for 1 damage.')));
    assert(view.boards[0].some(card => card.cardId === 'caucus-mountaineer'));
  }
  room.match = nextRound({ ...room.match, phase: 'resolved' });
  room = JSON.parse(JSON.stringify(room));
  for (const user of ['a', 'b']) {
    const view = onlineRoomView(room, 'CAUCUS', user, 4);
    assert(view.events.some(event => event.note.includes('Ancient Tablet radiation')));
  }
});
test('protection blocks the whole Utu tablet-boosted hit', () => {
  const m = blank(), enemy = unit('buddy', 'cpu', 0, 1);
  enemy.statuses.protected = true;
  m.timedEffects.push({ id: 'test-shield', kind: 'church-protection', owner: 'cpu', sourceInstanceId: enemy.instanceId, targetInstanceId: enemy.instanceId, lane: 0, startsAtRound: 1, expiresAtRound: 7, expiration: 'match-complete' });
  m.boards[0] = [enemy]; m.ancientTablets = [{ owner: 'player', lane: 0 }];
  const result = cast(m, 'utu').after;
  assert.equal(power(result, enemy.instanceId), getEffectiveCardPower(enemy));
  assert.equal(result.ancientTablets!.length, 0);
});
test('echoing Yakub summons one, without recreating the Squabble bonus', () => {
  const initial = cast(blank(), 'yakub', 'player', 0, true);
  const echoed = cast(initial.after, 'tayaty', 'player', 1).after;
  assert.equal(echoed.boards.flat().filter(card => card.cardId === 'caucus-mountaineer').length, 3);
  assert.equal(echoed.yakubBuffs?.length ?? 0, 0, 'echoing does not create a next-play buff');
});
test('serialization preserves tablet and pending buff mechanics on the next play', () => {
  const first = cast(blank(), 'yakub').after;
  first.ancientTablets = [{ owner: 'player', lane: 1 }];
  first.yakubBuffs = [{owner: 'player', sourceInstanceId: 'legacy-yakub', expiresAfterRound: first.round + 1}];
  const resumed = JSON.parse(JSON.stringify(first)) as Match;
  const second = cast(resumed, 'caucus-mountaineer', 'player', 1);
  assert.equal(power(second.after, second.card.instanceId), 6);
  assert.equal(second.after.ancientTablets!.length, 1);
  assert.equal(second.after.yakubBuffs!.length, 0);
});
test('tablet consumption and the resulting buff have distinct replay transitions', () => {
  const m = blank(); m.ancientTablets = [{ owner: 'player', lane: 0 }];
  const result = cast(m, 'inanna');
  const consumed = result.after.effectLog.find(e => e.note === 'Consumed an Ancient Tablet.')!;
  const payoff = result.after.effectLog.find(e => e.note.includes('for +4 Hands'))!;
  assert.equal(consumed.replay.before.ancientTablets!.length, 1);
  assert.equal(consumed.replay.after.ancientTablets!.length, 0);
  assert.equal(power({ ...result.after, ...payoff.replay.before }, result.card.instanceId), 3);
  assert.equal(power({ ...result.after, ...payoff.replay.after }, result.card.instanceId), 7);
});
test('compact replay retains tablet and pending Yakub states without mutating source frames', () => {
  const initial = cast(blank(), 'nabu').after;
  const active = cast(initial, 'yakub', 'player', 1).after;
  active.yakubBuffs = [{owner: 'player', sourceInstanceId: 'legacy-yakub', expiresAfterRound: active.round + 1}];
  const before = JSON.stringify(active);
  const restored = restoreMatchReplay(JSON.parse(JSON.stringify(compactMatchReplay(active)))) as Match;
  assert.equal(JSON.stringify(active), before);
  assert.deepEqual(restored, JSON.parse(before));
  assert.deepEqual(restored.ancientTablets, [{ owner: 'player', lane: 0 }]);
  assert.equal(restored.yakubBuffs!.length, 1);
  const next = cast(restored, 'caucus-mountaineer', 'player', 0);
  assert.equal(power(next.after, next.card.instanceId), 6);
});
test('authoritative transcript replay agrees with a complete Anunaki fade', () => {
  const ids = ['nabu', 'enki', 'utu', 'ninhursag', 'inanna', 'yakub', 'enlil', 'ereshkigal', 'caucus-mountaineer', 'anu'];
  let m = createMatchFromEngineCards('anunaki', ids, 'block', decks[0].cards);
  const moves: PlayerMove[] = [];
  while (m.phase !== 'complete') {
    const options = m.playerHand.flatMap(card => ([0, 1, 2] as Lane[]).map(lane => ({ card, lane, cost: getLegalCardCost(m, 'player', card, lane) })))
      .filter(option => option.cost <= m.playerMotion && m.boards[option.lane].filter(c => c.owner === 'player').length < 4);
    const choice = options[0];
    if (choice) {
      moves.push({ cardInstanceId: choice.card.instanceId, lane: choice.lane, squabble: false, endTurn: false });
      m = playTurnCard(m, 'player', choice.card.instanceId, choice.lane, false);
    }
    moves.push({ cardInstanceId: null, lane: null, squabble: false, endTurn: true });
    m = nextRound(revealCpuTurn(pass(m, 'player')));
  }
  assert.deepEqual(verifyMatchTranscript('anunaki', 'block', moves, undefined, ids), m);
});

test('blocked hostile abilities do not trigger base-success training unless a tablet was consumed', () => {
  for (const id of ['utu', 'enlil', 'ereshkigal']) {
    const m = blank(), enemy = unit('buddy', 'cpu', 0, 1);
    enemy.statuses.protected = true;
    m.timedEffects.push({ id: 'test-shield', kind: 'church-protection', owner: 'cpu', sourceInstanceId: enemy.instanceId, targetInstanceId: enemy.instanceId, lane: 0, startsAtRound: 1, expiresAtRound: 7, expiration: 'match-complete' });
    m.boards[0] = [enemy];
    m.abilityUpgradeSnapshot = createAbilityUpgradeSnapshot([id], [], { player: { [id]: { level: 2, xp: 100, moveTier: 1 } } });
    const blocked = cast(m, id);
    assert.equal(power(blocked.after, blocked.card.instanceId), getEffectiveCardPower(blocked.card), id);
    assert(!blocked.after.effectLog.some(event => event.abilityMetadata?.upgradeId === `${id}:upgrade:1`));
    const tablet = cast({ ...m, ancientTablets: [{ owner: 'player', lane: 0 }] }, id);
    assert(tablet.after.effectLog.some(event => event.abilityMetadata?.upgradeId === `${id}:upgrade:1`));
  }
});
test('both makers place tablets but only Enki buffs an ally on reveal', () => {
  for (const [id, amount] of [['enki', 2], ['ninhursag', 0]] as const) {
    const m = blank(), weak = unit('buddy', 'player', 0, 1), strong = unit('buddy', 'player', 0, 2);
    strong.powerModifier = 4; m.boards[0] = [weak, strong];
    const result = cast(m, id);
    assert.equal(power(result.after, weak.instanceId), getEffectiveCardPower(weak) + amount);
    assert.equal(power(result.after, strong.instanceId), getEffectiveCardPower(strong));
    assert.deepEqual(result.after.ancientTablets, [{ owner: 'player', lane: 0 }]);
  }
});
test('Enlil and Ereshkigal hit their chosen enemies and consume tablet payoffs', () => {
  for (const id of ['enlil', 'ereshkigal']) {
    const m = blank(), weak = unit('buddy', 'cpu', 0, 1), strong = unit('buddy', 'cpu', 0, 2);
    strong.powerModifier = 5; m.boards[0] = [weak, strong]; m.ancientTablets = [{ owner: 'player', lane: 0 }];
    const result = cast(m, id);
    if (id === 'enlil') assert.equal(power(result.after, strong.instanceId), getEffectiveCardPower(strong) - 4);
    else { assert.equal(power(result.after, weak.instanceId), getEffectiveCardPower(weak) - 2); assert.equal(power(result.after, result.card.instanceId), 6); }
    assert.equal(result.after.ancientTablets!.length, 0);
  }
});

for (const owner of ['player', 'cpu'] as const) {
  test(`Ereshkigal requires and spends 3 Motion while resolving her reveal for ${owner}`, () => {
    const enemyOwner = owner === 'player' ? 'cpu' : 'player';
    const motionKey = owner === 'player' ? 'playerMotion' : 'cpuMotion';
    const otherMotionKey = owner === 'player' ? 'cpuMotion' : 'playerMotion';
    const handKey = owner === 'player' ? 'playerHand' : 'cpuHand';
    const card = createCardInstance('ereshkigal', owner, 'cost-check', 1);
    const weak = unit('buddy', enemyOwner, 0, 1), strong = unit('buddy', enemyOwner, 0, 2);
    weak.powerModifier = 3; strong.powerModifier = 7;
    const setup = { ...blank(), phase: owner === 'player' ? 'player' as const : 'cpu-reveal' as const,
      districtSnapshot: undefined, districtRuntime: undefined, [handKey]: [card], [motionKey]: 2,
      boards: [[weak, strong], [], []] as Match['boards'], ancientTablets: [{ owner, lane: 0 as Lane }] };
    assert.equal(anunakiCards.ereshkigal.cost, 3);
    assert.equal(anunakiCards.ereshkigal.power, 3);
    assert.equal(getLegalCardCost(setup, owner, card, 0), 3);
    const saved = JSON.stringify(setup);
    assert.throws(() => playTurnCard(setup, owner, card.instanceId, 0), /Not enough Motion/);
    assert.equal(JSON.stringify(setup), saved, 'a rejected play leaves the hand, board, Motion and tablet unchanged');

    const ready = { ...setup, [motionKey]: 3 };
    const after = playTurnCard(ready, owner, card.instanceId, 0);
    assert.equal(after[motionKey], 0);
    assert.equal(after[otherMotionKey], ready[otherMotionKey]);
    assert.equal(after[handKey].length, 0);
    assert.equal(power(after, weak.instanceId), getEffectiveCardPower(weak) - 2);
    assert.equal(power(after, strong.instanceId), getEffectiveCardPower(strong));
    assert.equal(power(after, card.instanceId), 6);
    assert.deepEqual(after.ancientTablets, []);
  });
}

for (const owner of ['player', 'cpu'] as const) {
  test(`bounced Yakub summons one on replay without the prior Squabble bonus for ${owner}`, () => {
    const first = cast(blank(), 'yakub', owner, 0, true);
    const boosted = { ...first.after, boards: first.after.boards.map(lane => lane.map(card => card.cardId === 'caucus-mountaineer' ? { ...card, powerModifier: card.powerModifier + 10 } : card)) as Match['boards'] };
    const bounced = cast(boosted, 'madhatter', owner, 0).after;
    const key = owner === 'player' ? 'playerHand' : 'cpuHand';
    const yakub = bounced[key].find(card => card.instanceId === first.card.instanceId);
    assert(yakub, 'Mad Hatter returned the actual Yakub instance');
    const ready = { ...bounced, phase: owner === 'player' ? 'player' as const : 'cpu-reveal' as const, playerMotion: 9, cpuMotion: 9 };
    const replayed = playTurnCard(ready, owner, yakub.instanceId, 1, false);
    assert.equal(replayed.boards.flat().filter(card => card.cardId === 'caucus-mountaineer').length, 3);
    assert.equal(replayed.boards.flat().find(card => card.instanceId === yakub.instanceId)?.anunakiSquabbled, false);
  });
}
