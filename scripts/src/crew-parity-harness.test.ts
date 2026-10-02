import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import {
  BASE_HASH, FOCUS, ROOT, SEEDS, casesFor, merge, paired, validatePlan, type Plan, type Shard,
} from './crew-parity-harness';
import type { RankingPlan, RankingResult } from './all-decks-ranking';

const original = JSON.parse(readFileSync(path.join(ROOT, 'scripts/results/all-decks-v35-no-guap/plan.json'), 'utf8')) as RankingPlan;
const frozen = await import(pathToFileURL(path.join(ROOT, '.local/crew-parity-v35-source/scripts/src/all-decks-ranking.ts')).href) as typeof import('./all-decks-ranking');
function fixture(block: Plan['block'] = 'holdout'): Plan {
  const schedule = { ...structuredClone(original.schedule), seeds: block === 'holdout' ? [...SEEDS] : [...original.schedule.seeds] };
  return { ...structuredClone(original), schedule, cases: casesFor(original.decks, schedule),
    protocol: 'crew-parity-paired-v1', focusIds: [...FOCUS], arm: 'before', block,
    harnessHash: 'synthetic-harness', protocolHash: 'synthetic-protocol', baselineFiles: {},
    provenance: { sourceRoot: path.join(ROOT, '.local/crew-parity-v35-source'),
      sourceHash: BASE_HASH, files: {}, bindings: [] } };
}
function shards(plan: Plan, count = 2): Shard[] {
  return Array.from({ length: count }, (_, index) => ({
    index, count, sourceHash: plan.sourceHash, harnessHash: plan.harnessHash,
    protocolHash: plan.protocolHash, planHash: 'synthetic-plan', elapsedMs: 0, failures: [],
    rows: plan.cases.flatMap((c, caseIndex) => caseIndex % count !== index ? [] : [{
      caseIndex, result: {
        deckAId: c.a, deckBId: c.b, districtSeed: c.seed, districtIds: ['one', 'two', 'three'],
        rotation: c.rotation, tier: c.tier, seat: c.seat,
        playerDeckId: c.seat === 'a-player' ? c.a : c.b,
        cpuDeckId: c.seat === 'a-player' ? c.b : c.a,
        winner: 'draw', logicalWinner: 'draw', playerDistricts: 1, cpuDistricts: 1,
        laneMargins: [0, 0, 0], plays: 20, passes: 2,
      } satisfies RankingResult,
    }]),
  }));
}
test('focus schedule is 5440 unique canonical cases and 1152 appearances per subject', () => {
  const p = fixture();
  validatePlan(p);
  assert.equal(p.cases.length, 5440);
  for (const c of p.cases) assert(original.cases.some(old =>
    old.a === c.a && old.b === c.b && old.policy === c.policy && old.tier === c.tier && old.seat === c.seat));
  assert.equal(p.cases.filter(c => FOCUS.includes(c.a) && FOCUS.includes(c.b)).length, 320);
  assert.equal(p.cases.filter(c => !(FOCUS.includes(c.a) && FOCUS.includes(c.b))).length, 5120);
  const calibration = fixture('calibration');
  validatePlan(calibration);
  assert.equal(calibration.cases.length, 2720);
  assert.deepEqual(calibration.cases, original.cases.filter(c => FOCUS.includes(c.a) || FOCUS.includes(c.b)));
});
test('complete synthetic merge, half draws, actual seat and shared/mutual accounting', () => {
  const p = fixture(), s = shards(p);
  const rows = merge(p, s, 2, 'synthetic-plan', frozen.validateRankingResult);
  const result = paired(p, rows, rows);
  assert.deepEqual(result.map(r => r.deckId), FOCUS);
  for (const r of result) {
    assert.equal(r.all.before.games, 1152);
    assert.equal(r.all.before.score, 576);
    assert.equal(r.all.before.scoreRate, 0.5);
    assert.equal(r.all.deltaPercentagePoints, 0);
    assert.equal(r.all.pairedUnchanged, 1152);
    assert.equal(r.shared32NonfocusOpponents.before.games, 1024);
    assert.equal(r.mutualTargetMatches.before.games, 128);
    assert.equal(r.byOpponent.length, 36);
    for (const seat of r.bySeat) assert.equal(seat.before.games, 576);
    for (const seed of r.bySeed) assert.equal(seed.before.games, 288);
  }
});
test('mixed source/harness/protocol/plan and failed/partial/duplicate/reused rows rejected', () => {
  const p = fixture(), good = shards(p);
  for (const field of ['sourceHash', 'harnessHash', 'protocolHash', 'planHash'] as const) {
    const bad = structuredClone(good); bad[0][field] = 'mixed';
    assert.throws(() => merge(p, bad, 2, 'synthetic-plan', frozen.validateRankingResult));
  }
  const mutations: ((s: Shard[]) => void)[] = [
    s => { s[0].failures.push({ message: 'synthetic failure' }); },
    s => { s.pop(); },
    s => { s[1].index = 0; },
    s => { s[0].rows.pop(); },
    s => { s[0].rows[1] = structuredClone(s[0].rows[0]); },
    s => { s[0].rows[0].reusedFrom = BASE_HASH; },
    s => { s[0].rows[0].result = { ...s[0].rows[0].result, districtSeed: 'wrong' }; },
    s => { s[0].rows[0].result = { ...s[0].rows[0].result, playerDeckId: 'wrong-seat' }; },
  ];
  for (const mutate of mutations) {
    const bad = structuredClone(good); mutate(bad);
    assert.throws(() => merge(p, bad, 2, 'synthetic-plan', frozen.validateRankingResult));
  }
});
test('reject roster order/order-key/orientation/holdout seed mismatch', () => {
  for (const mutate of [
    (p: Plan) => { p.decks.reverse(); },
    (p: Plan) => { p.decks[0] = { ...p.decks[0], orderKey: 'different' }; },
    (p: Plan) => { [p.cases[0].a, p.cases[0].b] = [p.cases[0].b, p.cases[0].a]; },
    (p: Plan) => { p.schedule.seeds[0] = original.schedule.seeds[0]; },
  ]) {
    const bad = fixture(); mutate(bad); assert.throws(() => validatePlan(bad));
  }
});