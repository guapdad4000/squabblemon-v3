import assert from 'node:assert/strict';
import test from 'node:test';
import { createMatch, createCardInstance, createAbilityUpgradeSnapshot, type Owner, type Match } from '@workspace/squabblemon-engine/gameEngine';
import { listLegalBalancePlays, evaluateBalanceState, greedyBalancePolicy, type BalancePolicyContext } from '@workspace/squabblemon-engine/balanceLab';
import { DISTRICT_CATALOG, type DistrictSnapshot } from '@workspace/squabblemon-engine/districts';
import { chainBalancePolicy, pairedSeededPolicy } from './rivalry-audit-policies';

function context(owner: Owner): BalancePolicyContext {
  const other = owner === 'player' ? 'cpu' : 'player';
  const m: Match = { ...createMatch('block', 'block'), round: 3, playerMotion: 2, cpuMotion: 2,
    playerDeck: owner === 'player' ? 'blue-audit' : 'red-audit', cpuDeck: owner === 'cpu' ? 'blue-audit' : 'red-audit',
    playerHand: [], cpuHand: [], boards: [[], [], []], phase: owner === 'player' ? 'player' : 'cpu-reveal' };
  m.districtSnapshot = { version: 1, locations: ['county-jail', 'the-trap', 'time-square'].map(id => DISTRICT_CATALOG.find(d => d.id === id)!) as DistrictSnapshot['locations'] };
  m[owner === 'player' ? 'playerHand' : 'cpuHand'] = ['initiation', 'waterboy'].map((id, i) => createCardInstance(id, owner, 'audit', i));
  m.boards = [0, 1, 2].map((lane, i) => [{ ...createCardInstance('waterboy', other, 'audit-enemy', i), lane, powerModifier: 2 }]) as Match['boards'];
  m.abilityUpgradeSnapshot = createAbilityUpgradeSnapshot(['initiation', 'waterboy'], ['initiation', 'waterboy'], {
    [owner]: { initiation: { level: 10, xp: 4500, moveTier: 3 } },
  });
  return { match: m, owner, actionIndex: owner === 'player' ? 0 : 99, seed: `ignored:${owner}`,
    legalPlays: listLegalBalancePlays(m, owner, false), evaluate: evaluateBalanceState };
}
for (const owner of ['player', 'cpu'] as const) test(`two-play search finds recruitment before payoff (${owner})`, () => {
  const ctx = context(owner), before = JSON.stringify(ctx.match);
  assert.equal(greedyBalancePolicy(ctx)?.cardId, 'waterboy');
  const chosen = chainBalancePolicy(ctx);
  assert.equal(chosen?.cardId, 'initiation');
  assert.equal(JSON.stringify(ctx.match), before, 'search cannot mutate the live match');
  assert.equal(chainBalancePolicy(ctx)?.instanceId, chosen?.instanceId);
});
test('paired priorities preserve choices after seat swap and global action-index changes', () => {
  const a = pairedSeededPolicy('common-random'), b = pairedSeededPolicy('common-random');
  for (let i = 0; i < 5; i++) {
    const left = a(context('player')), right = b(context('cpu'));
    assert.deepEqual(left && [left.cardId, left.lane, left.squabble], right && [right.cardId, right.lane, right.squabble]);
  }
});
test('diagnostic policies pass with no legal actions', () => {
  const ctx = { ...context('player'), legalPlays: [] };
  assert.equal(chainBalancePolicy(ctx), null);
  assert.equal(pairedSeededPolicy('empty')(ctx), null);
});
