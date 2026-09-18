import assert from 'node:assert/strict';
import test from 'node:test';
import { createCardInstance, createMatch, chooseCpuPlay, playCard, pass, nextRound, getMatchWinner, createAbilityUpgradeSnapshot, type Match, type Lane } from './gameEngine';
import { decks } from './data';

const card = (id: string, owner: 'player' | 'cpu', lane: Lane, power?: number) => ({
  ...createCardInstance(id, owner, `ai-${lane}`, lane), lane,
  ...(power === undefined ? {} : { basePower: power }),
});
const cpuMatch = (): Match => ({ ...createMatch('block', 'block'), phase: 'cpu-reveal', cpuMotion: 6 });

test('CPU expands beyond an oversized stack and leaves the input unchanged', () => {
  const m: Match = { ...cpuMatch(), boards: [[card('edgar', 'cpu', 0, 30)], [], []], cpuHand: [card('youngbull', 'cpu', 0)] };
  const before = JSON.stringify(m);
  const choice = chooseCpuPlay(m)!;
  assert.notEqual(choice.lane, 0);
  assert.deepEqual(chooseCpuPlay(m), choice);
  assert.equal(JSON.stringify(m), before);
});

test('CPU uses freeze to win a second district instead of adding raw Hands to a stack', () => {
  const m: Match = { ...cpuMatch(), round: 6, boards: [
    [card('edgar', 'cpu', 0, 30)],
    [card('edgar', 'player', 1, 12)],
    [card('edgar', 'player', 2, 20)],
  ], cpuHand: [card('snow', 'cpu', 0), card('youngbull', 'cpu', 1)] };
  const choice = chooseCpuPlay(m)!;
  assert.equal(m.cpuHand.find(c => c.instanceId === choice.instanceId)?.cardId, 'snow');
  assert.equal(getMatchWinner(nextRound(playCard(m, 'cpu', choice.instanceId, choice.lane))), 'cpu');
});

test('all training recipes contest multiple districts over six automatic rival turns', () => {
  for (const deck of decks) {
    let m = createMatch('block', deck.id);
    for (let i = 0; i < 6; i++) {
      m = pass(m, 'player');
      const choice = chooseCpuPlay(m);
      m = nextRound(choice ? playCard(m, 'cpu', choice.instanceId, choice.lane) : pass(m, 'cpu'));
    }
    assert(m.boards.filter(lane => lane.some(c => c.owner === 'cpu')).length >= 2, deck.id);
  }
});

test('Motion pays only summon cost; board conditions and discounts work at zero remaining Motion', () => {
  for (const owner of ['player', 'cpu'] as const) {
    const tech = card('techbro', owner, 0);
    const m: Match = { ...createMatch('block', 'block'), phase: owner === 'player' ? 'player' : 'cpu-reveal',
      playerMotion: 4, cpuMotion: 4, playerHand: [tech], cpuHand: [tech], boards: [[card('edgar', owner, 0)], [], []] };
    const result = playCard(m, owner, tech.instanceId, 0);
    assert.equal(owner === 'player' ? result.playerMotion : result.cpuMotion, 0);
    assert.equal(result.boards[0].find(c => c.cardId === 'techbro')?.powerModifier, 2);
  }
  const bottle = card('bottle', 'player', 0);
  const m: Match = { ...createMatch('block', 'block'), playerMotion: 2, playerHand: [bottle] };
  assert.equal(playCard(m, 'player', bottle.instanceId, 0).discountTokens.length, 1);
});

const upgraded = (id: string, boards: Match['boards']): Match => ({
  ...createMatch('block', 'block'), playerMotion: 6, playerHand: [card(id, 'player', 0)], boards,
  abilityUpgradeSnapshot: createAbilityUpgradeSnapshot([id], [], { player: { [id]: { xp: 2800, level: 8, moveTier: 3 } } }),
});
test('support tiers add bounded self Hands once, never multiply ally buffs or repeat next round', () => {
  for (const [id, amount] of [['earthy', 1], ['abuela', 2], ['icecream', 1]] as const) {
    let m = upgraded(id, [[card('edgar', 'player', 0)], [], []]);
    m = playCard(m, 'player', m.playerHand[0].instanceId, 0);
    assert.equal(m.boards[0].find(c => c.cardId === id)?.powerModifier, 3);
    assert.equal(m.boards[0].find(c => c.cardId === 'edgar')?.powerModifier, amount);
    m = nextRound(pass(m, 'cpu'));
    assert.equal(m.boards[0].find(c => c.cardId === 'edgar')?.powerModifier, amount);
  }
});
test('blocked or fully mitigated cheap disruption does not earn success upgrades', () => {
  for (const id of ['tayaty', 'honestthot']) {
    const target = card('edgar', 'cpu', 0);
    let m = upgraded(id, [[target], [], []]);
    m.timedEffects = [{ id: 'shield', kind: 'church-protection', sourceInstanceId: 'church', targetInstanceId: target.instanceId, owner: 'cpu', lane: 0, startsAtRound: 1, expiresAtRound: 7, expiration: 'match-complete' }];
    m = playCard(m, 'player', m.playerHand[0].instanceId, 0);
    assert.equal(m.boards[0].find(c => c.cardId === id)?.powerModifier, 0);
  }
  const target = card('edgar', 'cpu', 0);
  let m = upgraded('tayaty', [[target], [], []]);
  m.timedEffects = [{ id: 'nail', kind: 'nail-mitigation', sourceInstanceId: 'nail', targetInstanceId: target.instanceId, owner: 'cpu', lane: 0, startsAtRound: 1, expiresAtRound: 7, expiration: 'match-complete' }];
  m = playCard(m, 'player', m.playerHand[0].instanceId, 0);
  assert.equal(m.boards[0].find(c => c.cardId === 'tayaty')?.powerModifier, 0);
});

test('Common upgrades require real effects, including cleanse and lethal disruption', () => {
  for (const id of ['earthy', 'abuela', 'icecream', 'pinaynurse', 'honestthot', 'tayaty', 'youngbull', 'edgar', 'nguyen', 'manman']) {
    const m = upgraded(id, [[], [], []]);
    const result = playCard(m, 'player', m.playerHand[0].instanceId, 0);
    assert.equal(result.boards[0][0].powerModifier, 0, id);
  }
  const patient = card('edgar', 'player', 0);
  patient.statuses.frozen = true;
  patient.statuses.silenced = true;
  let m = upgraded('pinaynurse', [[patient], [], []]);
  m = playCard(m, 'player', m.playerHand[0].instanceId, 0);
  assert.equal(m.boards[0].find(c => c.cardId === 'pinaynurse')?.powerModifier, 3);
  assert.equal(m.boards[0].find(c => c.cardId === 'edgar')?.powerModifier, 1);
  assert.equal(m.boards[0].find(c => c.cardId === 'edgar')?.statuses.frozen, false);
  const victim = card('edgar', 'cpu', 0, 1);
  m = upgraded('tayaty', [[victim], [], []]);
  m = playCard(m, 'player', m.playerHand[0].instanceId, 0);
  assert(!m.boards[0].some(c => c.instanceId === victim.instanceId));
  assert.equal(m.boards[0].find(c => c.cardId === 'tayaty')?.powerModifier, 3);
});
