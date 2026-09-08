import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canAffordSelection, chooseCpuPlay, createCardInstance, createMatch, createMatchFromCatalog, getEffectiveCardPower,
  getLaneScore, getLegalCardCost, getMatchWinner, nextRound, pass, playCard, revealCpu, type Match,
} from './gameEngine';
import { starterRecipes } from './data';

const custom = (id: string, owner: 'player' | 'cpu', index: number) => createCardInstance(id, owner, 'test', index);
const playOne = (id: string, setup?: (m: Match) => Match) => {
  let match = createMatch('vibes', 'vibes');
  match = { ...match, playerMotion: 20, playerHand: [custom(id, 'player', 0)] };
  return playCard(setup ? setup(match) : match, 'player', match.playerHand[0].instanceId, 0);
};

test('initial hands are stable, owner-specific instances', () => {
  const match = createMatch('block', 'combo');
  assert.equal(match.playerHand.length, 5);
  assert.equal(match.cpuHand.length, 5);
  assert.equal(new Set([...match.playerHand, ...match.cpuHand].map((c) => c.instanceId)).size, 10);
  assert(match.playerHand.every((c) => c.owner === 'player' && c.lane === null));
});

test('a legal saved catalog deck can enter the same local CPU engine', () => {
  const recipe = starterRecipes[0];
  const match = createMatchFromCatalog('saved-test', recipe.catalogCardIds, 'combo');
  assert.equal(match.playerDeck, 'saved-test');
  assert.equal(match.playerCardIds.length, 7);
  assert.equal(match.playerHand.length, 5);
  assert.equal(match.cpuHand.length, 5);
});

test('exact instance is removed and both owners spend their actual Motion', () => {
  let match = createMatch('vibes', 'combo');
  const selected = match.playerHand[0];
  match = { ...match, playerMotion: 10, cpuMotion: 10 };
  match = playCard(match, 'player', selected.instanceId, 0);
  assert(!match.playerHand.some((c) => c.instanceId === selected.instanceId));
  assert.equal(match.playerMotion, 10 - selected.cost);
  assert.equal(match.effectLog.at(-1)?.state.after.phase, 'cpu-reveal');
  const cpu = match.cpuHand[0];
  match = playCard(match, 'cpu', cpu.instanceId, 1);
  assert.equal(match.cpuMotion, 10 - cpu.cost);
  assert.equal(match.effectLog.at(-1)?.state.after.phase, 'resolved');
});

test('printed abilities resolve with an effect note, including fire and water mapping', () => {
  const ids = ['rastamon', 'roaster', 'nerd', 'cornball', 'plug', 'streamer', 'gamer', 'techbro', 'bikelife', 'vibe', 'hooper', 'baby', 'oink', 'snow', 'wifey'];
  for (const id of ids) {
    const resolved = playOne(id);
    assert(resolved.effectLog.length > 0, `${id} should log its resolution`);
  }
  assert.equal(playOne('snow').effectLog.at(-1)?.kind, 'water');
  assert.equal(playOne('hooper').effectLog.at(-1)?.kind, 'fire');
});

test('Wifey blocks one targeted effect and movement cards visibly move', () => {
  const wifey = { ...custom('wifey', 'cpu', 1), lane: 0 as const, statuses: { frozen: false, silenced: false, protected: true, blocked: false } };
  const victim = { ...custom('snow', 'cpu', 2), lane: 0 as const };
  const blocked = playOne('nerd', (m) => ({ ...m, boards: [[wifey, victim], [], []] }));
  assert(blocked.boards[0].find((c) => c.instanceId === wifey.instanceId)?.statuses.blocked);
  assert(!blocked.boards[0].find((c) => c.instanceId === victim.instanceId)?.statuses.silenced);
  const bike = playOne('bikelife');
  const bikeOnBoard = bike.boards.flat().find((c) => c.cardId === 'bikelife')!;
  assert(bikeOnBoard.moved);
  const ally = { ...custom('cornball', 'player', 8), lane: 1 as const };
  const vibe = playOne('vibe', (m) => ({ ...m, boards: [[], [ally], []] }));
  const movedAlly = vibe.boards[0].find((c) => c.instanceId === ally.instanceId);
  assert(movedAlly?.moved);
  assert.equal(movedAlly?.powerModifier, 1);
});

test('freeze, silence and power modifiers affect scoring; Plug discounts its next other-lane play', () => {
  const frozen = { ...custom('hooper', 'player', 1), statuses: { frozen: true, silenced: false, protected: false, blocked: false } };
  assert.equal(getEffectiveCardPower(frozen), 0);
  const boosted = { ...custom('cornball', 'player', 2), powerModifier: 2 };
  assert.equal(getLaneScore([boosted], 0), 3);
  let match = playOne('plug');
  const cheap = custom('snow', 'player', 3);
  match = { ...match, phase: 'player', playerMotion: 1, playerHand: [cheap] };
  assert(canAffordSelection(match, 'player', cheap.instanceId, 1));
  match = playCard(match, 'player', cheap.instanceId, 1);
  assert.equal(match.playerMotion, 0);
});

test('hostile abilities change real enemy cards and scoring', () => {
  const recentEnemy = { ...custom('hooper', 'cpu', 20), lane: 0 as const, playedRound: 1 };
  const roasted = playOne('roaster', m => ({ ...m, boards: [[recentEnemy], [], []] }));
  assert.equal(roasted.boards[0].find(c => c.instanceId === recentEnemy.instanceId)?.powerModifier, -3);

  const silenced = playOne('nerd', m => ({ ...m, boards: [[recentEnemy], [], []] }));
  assert(silenced.boards[0].find(c => c.instanceId === recentEnemy.instanceId)?.statuses.silenced);

  const frozen = playOne('snow', m => ({ ...m, boards: [[recentEnemy], [], []] }));
  assert(frozen.boards[0].find(c => c.instanceId === recentEnemy.instanceId)?.statuses.frozen);
  assert.equal(getLaneScore(frozen.boards[0].filter(c => c.owner === 'cpu'), 0), 2);

  const secondEnemy = { ...custom('plug', 'cpu', 21), lane: 0 as const };
  const pressured = playOne('oink', m => ({ ...m, boards: [[recentEnemy, secondEnemy], [], []] }));
  assert(pressured.boards[0].filter(c => c.owner === 'cpu').every(c => c.powerModifier === -1));
});

test('sustain and comeback abilities visibly cleanse and swing Power', () => {
  const frozenAlly = {
    ...custom('snow', 'player', 30),
    lane: 0 as const,
    statuses: { frozen: true, silenced: false, protected: false, blocked: false },
  };
  const cured = playOne('rastamon', m => ({ ...m, boards: [[frozenAlly], [], []] }));
  const clean = cured.boards[0].find(c => c.instanceId === frozenAlly.instanceId)!;
  assert(!clean.statuses.frozen);
  assert.equal(clean.powerModifier, 2);

  const enemyA = { ...custom('wifey', 'cpu', 31), lane: 0 as const };
  const enemyB = { ...custom('baby', 'cpu', 32), lane: 0 as const };
  const mama = playOne('baby', m => ({ ...m, boards: [[enemyA, enemyB], [], []] }));
  assert.equal(mama.boards[0].find(c => c.owner === 'player')?.powerModifier, 2);

  const giant = { ...custom('oink', 'cpu', 33), lane: 0 as const, powerModifier: 8 };
  const comeback = playOne('hooper', m => ({ ...m, boards: [[giant], [], []] }));
  assert.equal(comeback.boards[0].find(c => c.owner === 'player')?.powerModifier, 2);
  assert.equal(comeback.boards[0].find(c => c.instanceId === giant.instanceId)?.powerModifier, 6);
});

test('movement and engine cards keep their persistent board changes', () => {
  const enemies = [0, 1, 2].map(i => ({ ...custom(i === 0 ? 'plug' : i === 1 ? 'snow' : 'vibe', 'cpu', 40 + i), lane: 0 as const }));
  const scared = playOne('cornball', m => ({ ...m, boards: [[...enemies], [], []] }));
  assert.equal(scared.boards[1].filter(c => c.owner === 'cpu').length, 1);
  assert(scared.boards[1][0].moved);

  const streamer = { ...custom('streamer', 'player', 50), lane: 0 as const };
  let frenzy = createMatch('combo', 'vibes');
  frenzy = { ...frenzy, playerMotion: 10, playerHand: [custom('cornball', 'player', 51)], boards: [[streamer], [], []] };
  frenzy = playCard(frenzy, 'player', frenzy.playerHand[0].instanceId, 0);
  assert.equal(frenzy.boards[0].find(c => c.cardId === 'cornball')?.powerModifier, 1);

  const gamer = { ...custom('gamer', 'player', 52), lane: 0 as const };
  let combo = createMatch('combo', 'vibes');
  combo = { ...combo, playerMotion: 10, playerHand: [custom('plug', 'player', 53)], boards: [[gamer], [], []] };
  combo = playCard(combo, 'player', combo.playerHand[0].instanceId, 0);
  assert.equal(combo.boards[0].find(c => c.instanceId === gamer.instanceId)?.powerModifier, 1);
  assert.equal(combo.boards[0].find(c => c.cardId === 'plug')?.powerModifier, 1);

  const flexed = playOne('techbro', m => ({ ...m, playerMotion: 6 }));
  assert.equal(flexed.playerMotion, 1);
  assert.equal(flexed.boards[0].find(c => c.cardId === 'techbro')?.powerModifier, 2);
});

test('Plug discount waits for a different district and is then consumed', () => {
  let match = playOne('plug');
  const sameLane = custom('snow', 'player', 60);
  match = { ...match, phase: 'player', playerMotion: 10, playerHand: [sameLane] };
  assert.equal(getLegalCardCost(match, 'player', sameLane, 0), 2);
  match = playCard(match, 'player', sameLane.instanceId, 0);
  assert.equal(match.plugDiscountLane.player, 0);

  const otherLane = custom('vibe', 'player', 61);
  match = { ...match, phase: 'player', playerMotion: 10, playerHand: [otherLane] };
  assert.equal(getLegalCardCost(match, 'player', otherLane, 1), 1);
  match = playCard(match, 'player', otherLane.instanceId, 1);
  assert.equal(match.plugDiscountLane.player, null);
});

test('SQUABBLE is a once-per-match card modifier', () => {
  let match = createMatch('vibes', 'combo');
  const card = match.playerHand[0];
  match = { ...match, playerMotion: 20 };
  match = playCard(match, 'player', card.instanceId, 0, true);
  const played = match.boards.flat().find((c) => c.instanceId === card.instanceId)!;
  assert.equal(played.powerModifier, card.basePower);
  assert(match.squabbleUsed);
  const play = match.effectLog.find(event => event.type === 'play')!;
  assert.match(play.note, /SQUABBLE/);
  assert.equal(play.source?.before?.lane, null);
  assert.equal(play.source?.after?.lane, 0);
  assert.equal(play.source?.before?.power, card.basePower);
  assert.equal(play.source?.after?.power, card.basePower * 2);
  assert.equal(play.resources.before.playerMotion, 20);
  assert.equal(play.resources.after.playerMotion, 20 - card.cost);
  assert.throws(() => playCard({ ...match, phase: 'player' }, 'player', match.playerHand[0].instanceId, 1, true));
});

test('a complete six-round pass match resolves deterministically', () => {
  let match = createMatch('vibes', 'combo');
  for (let round = 1; round <= 6; round += 1) {
    match = pass(match, 'player');
    match = pass(match, 'cpu');
    match = nextRound(match);
    assert.equal(match.round, round < 6 ? round + 1 : 6);
  }
  assert.equal(match.phase, 'complete');
  assert.equal(match.effectLog.filter((event) => event.type === 'pass').length, 12);
  assert.equal(match.effectLog.at(-1)?.type, 'match-complete');
});

test('CPU selects only an affordable exact hand card; rounds draw unused cards and final result is 2-of-3 or draw', () => {
  let match = createMatch('vibes', 'combo');
  match = { ...pass(match, 'player'), cpuMotion: 0 };
  assert.equal(chooseCpuPlay(match), null);
  match = { ...match, cpuMotion: 20 };
  const choice = chooseCpuPlay(match)!;
  assert(match.cpuHand.some((c) => c.instanceId === choice.instanceId));
  match = revealCpu(match);
  assert.equal(match.phase, 'resolved');
  const afterDraw = nextRound(match);
  assert.equal(afterDraw.playerHand.length, 6);
  assert.equal(afterDraw.cpuHand.length, 5);
  const won: Match = { ...afterDraw, round: 6, phase: 'complete', boards: [[{ ...custom('cornball', 'player', 20), lane: 0 }], [{ ...custom('cornball', 'player', 21), lane: 1 }], []] };
  assert.equal(getMatchWinner(won), 'player');
  assert.equal(getMatchWinner({ ...won, boards: [[], [], []] }), 'draw');
});

test('battle events identify play, reveal, ability source and ordered target state changes', () => {
  const enemy = { ...custom('hooper', 'cpu', 70), lane: 0 as const, playedRound: 1 };
  const match = playOne('roaster', m => ({ ...m, boards: [[enemy], [], []] }));
  assert.deepEqual(match.effectLog.map(event => event.type), ['play', 'reveal', 'ability']);
  assert.deepEqual(match.effectLog.map(event => event.sequence), [1, 2, 3]);

  const ability = match.effectLog[2];
  assert.equal(ability.source?.cardId, 'roaster');
  assert.equal(ability.source?.after?.lane, 0);
  assert.equal(ability.timing, 'instant');
  assert.equal(ability.duration, null);
  assert.equal(ability.targets.length, 1);
  assert.equal(ability.targets[0].cardInstanceId, enemy.instanceId);
  assert.equal(ability.targets[0].before?.power, 5);
  assert.equal(ability.targets[0].after?.power, 2);
  assert.deepEqual(ability.targets[0].before?.statuses, enemy.statuses);
  assert.equal(ability.scores.before[0].cpu, 7);
  assert.equal(ability.scores.after[0].cpu, 4);
  assert.equal(ability.scores.after[0].player, 3);
});

test('blocked targeted effects record both intended target and protecting Wifey', () => {
  const wifey = { ...custom('wifey', 'cpu', 71), lane: 0 as const, statuses: { frozen: false, silenced: false, protected: true, blocked: false } };
  const victim = { ...custom('snow', 'cpu', 72), lane: 0 as const, powerModifier: 5 };
  const match = playOne('nerd', m => ({ ...m, boards: [[wifey, victim], [], []] }));
  const ability = match.effectLog.at(-1)!;
  assert.equal(ability.type, 'ability');
  assert.deepEqual(new Set(ability.targets.map(target => target.cardInstanceId)), new Set([wifey.instanceId, victim.instanceId]));
  assert.equal(ability.targets.find(target => target.cardInstanceId === victim.instanceId)?.after?.statuses.silenced, false);
  assert.equal(ability.targets.find(target => target.cardInstanceId === wifey.instanceId)?.after?.statuses.blocked, true);
});

test('movement abilities are move events with authoritative lane snapshots', () => {
  const bike = playOne('bikelife');
  const bikeMove = bike.effectLog.at(-1)!;
  assert.equal(bikeMove.kind, 'move');
  assert.equal(bikeMove.source?.before?.lane, 0);
  assert.equal(bikeMove.source?.after?.lane, 1);
  assert.equal(bikeMove.source?.before?.moved, false);
  assert.equal(bikeMove.source?.after?.moved, true);

  const ally = { ...custom('cornball', 'player', 73), lane: 1 as const };
  const vibe = playOne('vibe', m => ({ ...m, boards: [[], [ally], []] }));
  const vibeMove = vibe.effectLog.at(-1)!;
  const pulled = vibeMove.targets.find(target => target.cardInstanceId === ally.instanceId)!;
  assert.equal(vibeMove.kind, 'move');
  assert.equal(pulled.before?.lane, 1);
  assert.equal(pulled.after?.lane, 0);

  const enemies = [0, 1, 2].map(index => ({ ...custom('snow', 'cpu', 80 + index), lane: 0 as const }));
  const cornball = playOne('cornball', m => ({ ...m, boards: [[...enemies], [], []] }));
  const cornballMove = cornball.effectLog.at(-1)!;
  assert.equal(cornballMove.kind, 'move');
  assert.equal(cornballMove.targets[0].before?.lane, 0);
  assert.equal(cornballMove.targets[0].after?.lane, 1);
});

test('Wifey protection has deterministic round duration, expiration, and renewal', () => {
  let match = playOne('wifey');
  const protection = match.effectLog.at(-1)!;
  assert.equal(protection.timing, 'timed');
  assert.deepEqual(protection.duration, { unit: 'round', startsAtRound: 1, expiresAtRound: 2, expiration: 'round-start' });
  assert.equal(match.timedEffects[0].expiresAtRound, 2);
  const firstEffectId = match.timedEffects[0].id;

  match = pass(match, 'cpu');
  match = nextRound(match);
  const expiration = match.effectLog.find(event => event.type === 'expiration')!;
  const roundStart = match.effectLog.at(-1)!;
  assert.equal(expiration.round, 2);
  assert.equal(expiration.source?.before?.statuses.protected, true);
  assert.equal(expiration.source?.after?.statuses.protected, false);
  assert.equal(roundStart.type, 'round-start');
  assert.equal(roundStart.duration?.expiresAtRound, 3);
  assert(!match.timedEffects.some(effect => effect.id === firstEffectId));
  assert.equal(match.timedEffects[0].id.endsWith(':2'), true);
  assert.equal(match.boards[0].find(card => card.cardId === 'wifey')?.statuses.protected, true);
  assert.deepEqual(match.effectLog.map(event => event.sequence), match.effectLog.map((_, index) => index + 1));
});

test('passes are synchronous authoritative events and survive round transitions', () => {
  let match = createMatch('vibes', 'combo');
  const controller = new AbortController();
  match = pass(match, 'player');
  controller.abort();
  assert.equal(match.phase, 'cpu-reveal');
  assert.equal(match.effectLog[0].type, 'pass');
  assert.equal(match.effectLog[0].owner, 'player');
  assert.equal(match.effectLog[0].source, null);
  assert.deepEqual(match.effectLog[0].scores.before, match.effectLog[0].scores.after);

  match = pass(match, 'cpu');
  const priorCount = match.effectLog.length;
  match = nextRound(match);
  assert.equal(match.phase, 'player');
  assert.equal(match.effectLog.length, priorCount + 1);
  const roundStart = match.effectLog.at(-1)!;
  assert.equal(roundStart.type, 'round-start');
  assert.equal(roundStart.state.before.round, 1);
  assert.equal(roundStart.state.after.round, 2);
  assert.equal(roundStart.state.after.phase, 'player');
  const draws = roundStart.targets.filter((target) => target.before === null && target.after?.lane === null);
  assert.equal(draws.length, 2);
  assert.deepEqual(match.effectLog.map(event => event.sequence), [1, 2, 3]);
});