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

test('Techbro borrows after paying deployment cost; discounts work at zero remaining Motion', () => {
  for (const owner of ['player', 'cpu'] as const) {
    const tech = card('techbro', owner, 0);
    const m: Match = { ...createMatch('block', 'block'), phase: owner === 'player' ? 'player' : 'cpu-reveal',
      playerMotion: 4, cpuMotion: 4, playerHand: [tech], cpuHand: [tech], boards: [[card('edgar', owner, 0)], [], []] };
    const result = playCard(m, owner, tech.instanceId, 0);
    assert.equal(owner === 'player' ? result.playerMotion : result.cpuMotion, 2);
    assert.equal(result.boards[0].find(c => c.cardId === 'techbro')?.powerModifier, 0);
  }
  const bottle = card('bottle', 'player', 0);
  const m: Match = { ...createMatch('block', 'block'), playerMotion: 2, playerHand: [bottle] };
  assert.equal(playCard(m, 'player', bottle.instanceId, 0).discountTokens.length, 1);
});

const upgraded = (id: string, boards: Match['boards']): Match => ({
  ...createMatch('block', 'block'), playerMotion: 6, playerHand: [card(id, 'player', 0)], boards,
  abilityUpgradeSnapshot: createAbilityUpgradeSnapshot([id], [], { player: { [id]: { xp: 2800, level: 8, moveTier: 3 } } }),
});
test('support and former bond setup tiers trigger once', () => {
  let m = upgraded('earthy', [[card('edgar', 'player', 0)], [], []]);
  m = playCard(m, 'player', m.playerHand[0].instanceId, 0);
  assert.equal(m.boards[0].find(c => c.cardId === 'earthy')?.powerModifier, 3);
  assert.equal(m.boards[0].find(c => c.cardId === 'edgar')?.powerModifier, 1);
  m = nextRound(pass(m, 'cpu'));
  assert.equal(m.boards[0].find(c => c.cardId === 'edgar')?.powerModifier, 1);

  for (const id of ['abuela', 'icecream'] as const) {
    m = upgraded(id, [[card('edgar', 'player', 0)], [], []]);
    m = playCard(m, 'player', m.playerHand[0].instanceId, 0);
    assert.equal(m.boards[0].find(c => c.cardId === id)?.powerModifier, 3);
    assert.equal(m.boards[0].find(c => c.cardId === 'edgar')?.powerModifier, 0);
    m = nextRound(pass(m, 'cpu'));
    assert.equal(m.boards[0].find(c => c.cardId === 'edgar')?.powerModifier, 0);
  }
});
test('blocked cheap Burn does not earn success upgrades', () => {
  const target = card('edgar', 'cpu', 0);
  target.statuses.protected = true;
  let m = upgraded('cornball', [[target], [], []]);
  m.timedEffects = [{ id: 'shield', kind: 'church-protection', sourceInstanceId: 'church', targetInstanceId: target.instanceId, owner: 'cpu', lane: 0, startsAtRound: 1, expiresAtRound: 7, expiration: 'match-complete' }];
  m = playCard(m, 'player', m.playerHand[0].instanceId, 0);
  assert.equal(m.boards[0].find(c => c.cardId === 'cornball')?.powerModifier, 0);
  assert.equal(m.boards[0].find(c => c.instanceId === target.instanceId)?.statuses.burnStacks, 0);
});

test('Common upgrades require real effects, while Step Up and Act Up always succeed', () => {
  for (const id of ['earthy', 'abuela', 'pinaynurse', 'edgar', 'nguyen', 'manman']) {
    const m = upgraded(id, [[], [], []]);
    const result = playCard(m, 'player', m.playerHand[0].instanceId, 0);
    assert.equal(result.boards[0][0].powerModifier, 0, id);
  }
  let m = upgraded('youngbull', [[], [], []]);
  m = playCard(m, 'player', m.playerHand[0].instanceId, 0);
  assert.equal(m.boards[0].find(c => c.cardId === 'youngbull')?.powerModifier, 4);
  m = upgraded('tayaty', [[], [], []]);
  m = playCard(m, 'player', m.playerHand[0].instanceId, 0);
  assert.equal(m.boards[0].find(c => c.cardId === 'tayaty')?.powerModifier, 4);
  const patient = card('edgar', 'player', 0);
  patient.statuses.frozen = true;
  patient.statuses.silenced = true;
  m = upgraded('pinaynurse', [[patient], [], []]);
  m = playCard(m, 'player', m.playerHand[0].instanceId, 0);
  assert.equal(m.boards[0].find(c => c.cardId === 'pinaynurse')?.powerModifier, 3);
  assert.equal(m.boards[0].find(c => c.cardId === 'edgar')?.powerModifier, 2);
  assert.equal(m.boards[0].find(c => c.cardId === 'edgar')?.statuses.frozen, false);
});
