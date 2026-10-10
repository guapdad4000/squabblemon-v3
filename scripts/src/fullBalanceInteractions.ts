import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { writeFileSync } from 'node:fs';
import { cards, cardCatalog } from '@workspace/squabblemon-engine/data';
import { createMatch, createCardInstance, createAbilityUpgradeSnapshot, getDistrictResults, getEffectiveCardPower,
  playTurnCard, nextRound, suppressMatchPresentationEvents, type Match, type Owner, type Lane } from '@workspace/squabblemon-engine';
import { TRIPLE_OG_LANE } from '../../lib/squabblemon-engine/src/tripleOgs';

const json = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const ids = cardCatalog.filter(c => c.kind !== 'token' && !c.hazard).map(c => c.engineId).sort();
const baseline = createMatch('block', 'block');
export function pairFixture(sourceId: string, targetId: string, friendly = false, tier = 0, owner: Owner = 'player'): Match {
  const targetLane = (TRIPLE_OG_LANE[sourceId] ?? 0) as Lane;
  const rival = owner === 'player' ? 'cpu' : 'player';
  const source = createCardInstance(sourceId, owner, 'full-pair-source', 0);
  const target = { ...createCardInstance(targetId, friendly ? owner : rival, 'full-pair-target', 1), lane: targetLane, playedRound: 2 };
  assert.equal(tier, 0, 'Pair checks only permit base cards');
  const progress = { xp: 0, level: 1, moveTier: 0 };
  return { ...baseline, round: 3, phase: owner === 'player' ? 'player' : 'cpu-reveal',
    playerMotion: 9, cpuMotion: 9, playerHand: owner === 'player' ? [source] : [], cpuHand: owner === 'cpu' ? [source] : [],
    boards: ([0, 1, 2] as const).map(lane => lane === targetLane ? [target] : []) as Match['boards'],
    abilityUpgradeSnapshot: createAbilityUpgradeSnapshot(owner === 'player' ? [sourceId] : [targetId], owner === 'cpu' ? [sourceId] : [targetId], {
      [owner]: { [sourceId]: progress },
    }) };
}
export function assertState(match: Match, context: string) {
  for (const side of ['player', 'cpu'] as const) {
    const motion = side === 'player' ? match.playerMotion : match.cpuMotion;
    assert(Number.isInteger(motion) && motion >= 0 && motion <= 9, `${context}: ${side} Motion=${motion}`);
  }
  const live = [...match.boards.flat(), ...match.playerHand, ...match.cpuHand];
  assert.equal(new Set(live.map(c => c.instanceId)).size, live.length, `${context}: duplicate live instance`);
  match.boards.forEach((board, lane) => board.forEach(card => {
    assert.equal(card.lane, lane, `${context}: card ${card.cardId} has mismatched lane`);
    assert(card.owner === 'player' || card.owner === 'cpu', `${context}: invalid owner`);
    assert(Number.isFinite(getEffectiveCardPower(card)), `${context}: invalid effective power`);
    assert(Number.isFinite(card.basePower) && Number.isFinite(card.powerModifier), `${context}: invalid raw power`);
    assert(Number.isInteger(card.statuses.burnStacks) && card.statuses.burnStacks >= 0, `${context}: invalid Burn stacks`);
  }));
  for (const score of getDistrictResults(match)) for (const side of ['player', 'cpu'] as const)
    assert(Number.isFinite(score[side]) && score[side] >= 0, `${context}: invalid district score`);
}
export function inspectPair(sourceId: string, targetId: string, friendly = false, tier = 0, owner: Owner = 'player', ending = false) {
  const input = suppressMatchPresentationEvents(pairFixture(sourceId, targetId, friendly, tier, owner));
  const before = JSON.stringify(input);
  const source = owner === 'player' ? input.playerHand[0] : input.cpuHand[0];
  const lane = (TRIPLE_OG_LANE[sourceId] ?? 0) as Lane;
  const after = playTurnCard(input, owner, source.instanceId, lane);
  const context = `${owner}/${sourceId}->${friendly ? 'ally' : 'enemy'}:${targetId}/tier${tier}`;
  assert.equal(JSON.stringify(input), before, `${context}: input mutated`);
  const restored = suppressMatchPresentationEvents(JSON.parse(before) as Match);
  assert.equal(JSON.stringify(after), JSON.stringify(playTurnCard(restored, owner, source.instanceId, lane)), `${context}: non-deterministic serialized play`);
  assertState(after, context);
  if (ending) {
    const endInput: Match = { ...after, phase: 'resolved', playerHand: [], cpuHand: [] };
    const endBefore = JSON.stringify(endInput);
    const ended = nextRound(endInput);
    assert.equal(JSON.stringify(endInput), endBefore, `${context}: round end mutated input`);
    assert.equal(JSON.stringify(ended), JSON.stringify(nextRound(suppressMatchPresentationEvents(JSON.parse(endBefore)))), `${context}: non-deterministic serialized round end`);
    assertState(ended, `${context}/round-end`);
  }
  return after;
}

const args = Object.fromEntries(process.argv.slice(2).map(arg => { const [key, value = 'true'] = arg.replace(/^--/, '').split('='); return [key, value]; }));
if (args.run === 'true') {
  const shard = Number(args.shard ?? 0), shards = Number(args.shards ?? 1), limit = Number(args.limit ?? Infinity);
  const started = performance.now(), failures: unknown[] = [], coverage = new Set<string>();
  let cases = 0;
  for (let i = 0; i < ids.length; i++) {
    if (i % shards !== shard) continue;
    for (const targetId of ids) for (const friendly of [false, true]) for (const owner of ['player','cpu'] as const) {
      if (cases >= limit) break;
      cases++; coverage.add(ids[i]); coverage.add(targetId);
      try { inspectPair(ids[i], targetId, friendly, 0, owner, true); }
      catch (error) { failures.push({ sourceId: ids[i], targetId, friendly, owner, message: error instanceof Error ? error.message : String(error) }); }
    }
    if (cases >= limit) break;
  }
  const result = { version: 2, scope:'base PvP; both owners; ally/enemy; play and round end; serialized determinism', shard, shards, rosterCount: ids.length, cases, coveredCards: [...coverage].sort(),
    elapsedMs: Math.round(performance.now() - started), failures };
  if (args.report) writeFileSync(args.report, JSON.stringify(result, null, 2) + '\n');
  process.stdout.write(JSON.stringify({ ...result, coveredCards: coverage.size, failures: failures.slice(0, 15) }) + '\n');
  if (failures.length) process.exitCode = 1;
}
