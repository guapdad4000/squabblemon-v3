import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { root, type RankingPlan, type RankingResult } from './all-decks-ranking';
import {
  aggregateHoldout, focusCases, FOCUS_IDS, FRESH_SEEDS, mergeHoldout, validateHoldout,
  type HoldoutPlan, type HoldoutShard,
} from './air-water-holdout';

// Archived input, not createHoldoutPlan(): historical evidence must survive later engine versions.
const original = JSON.parse(readFileSync(path.join(root, 'scripts/results/all-decks-v35-no-guap/plan.json'), 'utf8')) as RankingPlan;
function plan(small = false): HoldoutPlan {
  const decks = structuredClone(small
    ? original.decks.filter(d => FOCUS_IDS.includes(d.id) || d.id === 'element-plant') : original.decks);
  const schedule = { ...structuredClone(original.schedule), seeds: [...FRESH_SEEDS] };
  return { ...structuredClone(original), decks, schedule, cases: focusCases(decks, schedule, FOCUS_IDS),
    focusIds: [...FOCUS_IDS], protocol: 'air-water-field-holdout', harnessHash: 'test-harness',
    baseline: { directory: 'archived-input', seeds: original.schedule.seeds, files: {} } };
}
function shards(p: HoldoutPlan, drawsOnly = false): HoldoutShard[] {
  return Array.from({ length: 2 }, (_, index) => ({
    index, count: 2, sourceHash: p.sourceHash, harnessHash: p.harnessHash, planHash: 'test-plan',
    elapsedMs: 1, failures: [], rows: p.cases.flatMap((c, caseIndex) => {
      if (caseIndex % 2 !== index) return [];
      const logicalWinner = drawsOnly || caseIndex % 3 === 0 ? 'draw' : caseIndex % 3 === 1 ? 'a' : 'b';
      const playerDeckId = c.seat === 'a-player' ? c.a : c.b, cpuDeckId = c.seat === 'a-player' ? c.b : c.a;
      const winner = logicalWinner === 'draw' ? 'draw' : c[logicalWinner] === playerDeckId ? 'player' : 'cpu';
      const result: RankingResult = {
        deckAId: c.a, deckBId: c.b, districtSeed: c.seed, districtIds: ['a', 'b', 'c'],
        rotation: c.rotation, tier: c.tier, seat: c.seat, playerDeckId, cpuDeckId, winner, logicalWinner,
        playerDistricts: winner === 'player' ? 2 : 1, cpuDistricts: winner === 'cpu' ? 2 : 1,
        laneMargins: [1, 0, -1], plays: 20, passes: 4,
      };
      return [{ caseIndex, result }];
    }),
  }));
}

test('eight fresh seeds retain all original rosters and axes, with 71 unique focused pairs', () => {
  const p = plan();
  assert.deepEqual(p.decks, original.decks);
  assert.deepEqual({ ...p.schedule, seeds: original.schedule.seeds }, original.schedule);
  assert.equal(validateHoldout(p), 64);
  assert.equal(p.schedule.seeds.length, 8);
  assert.equal(p.cases.length, 4544);
  assert.equal(new Set(p.cases.map(c => `${c.a}|${c.b}`)).size, 71);
  for (const id of FOCUS_IDS) assert.equal(p.cases.filter(c => c.a === id || c.b === id).length, 2304);
  const mutual = p.cases.filter(c => FOCUS_IDS.includes(c.a) && FOCUS_IDS.includes(c.b));
  assert.equal(mutual.length, 64);
  assert(mutual.every(c => c.a === 'element-water' && c.b === 'element-air'));
  assert(p.schedule.seeds.every(seed => !original.schedule.seeds.includes(seed)));
  assert(p.decks.every(d => !d.cardIds.includes('guap')));
});

test('focused coverage rejects stale seeds, altered schedule, missing subjects and excluded cards', () => {
  const p = plan(true);
  const changes: ((value: HoldoutPlan) => void)[] = [
    x => { x.schedule.seeds[0] = original.schedule.seeds[0]; },
    x => { x.schedule.seeds.push(x.schedule.seeds[0]); },
    x => { x.schedule.policies.pop(); },
    x => { x.schedule.tiers = [0]; },
    x => { x.cases.pop(); },
    x => { x.cases.push(x.cases[0]); },
    x => { x.cases[0].key = 'wrong'; },
    x => { x.decks[0] = { ...x.decks[0], cardIds: ['guap', ...x.decks[0].cardIds.slice(1)] }; },
    x => { x.focusIds = ['element-air', 'element-air']; },
    x => { x.evidenceReuse = {} as NonNullable<RankingPlan['evidenceReuse']>; },
  ];
  for (const mutate of changes) { const next = structuredClone(p); mutate(next); assert.throws(() => validateHoldout(next)); }
  assert.throws(() => focusCases(p.decks, p.schedule, ['element-air', 'missing']));
});

test('merge rejects failures, stale fingerprints, partial cases, duplicate workers and reused results', () => {
  const p = plan(true), valid = shards(p);
  assert.equal(mergeHoldout(p, valid, 2, 'test-plan').length, p.cases.length);
  const changes: ((value: HoldoutShard[]) => void)[] = [
    x => { x[0].sourceHash = 'changed'; },
    x => { x[0].harnessHash = 'changed'; },
    x => { x[0].planHash = 'changed'; },
    x => { x[0].count = 3; },
    x => { x[0].failures.push({ caseIndex: 0, scenario: p.cases[0], message: 'failure' }); },
    x => { x.pop(); },
    x => { x[1].index = 0; },
    x => { x[0].rows.pop(); },
    x => { x[0].rows.push(x[0].rows[0]); },
    x => { x[0].rows.reverse(); },
    x => { x[0].rows[0] = x[1].rows[0]; },
    x => { x[0].rows[0].reusedFrom = 'prior'; },
    x => { x[0].rows[0].result = { ...x[0].rows[0].result, districtSeed: 'wrong' }; },
    x => { x[0].rows[0].result = { ...x[0].rows[0].result, playerDeckId: 'wrong' }; },
    x => { x[0].rows[0].result = { ...x[0].rows[0].result, logicalWinner: 'a' }; },
  ];
  for (const mutate of changes) { const next = structuredClone(valid); mutate(next); assert.throws(() => mergeHoldout(p, next, 2, 'test-plan')); }
});

test('scores independently match seat-normalized winners and every split has equal coverage', () => {
  const p = plan(true), evidence = shards(p), summary = aggregateHoldout(p, evidence, 2, 'test-plan');
  const rows = evidence.flatMap(s => s.rows);
  for (const subject of summary.subjects) {
    const appearances = rows.filter(r => { const c = p.cases[r.caseIndex]; return c.a === subject.deckId || c.b === subject.deckId; });
    const wins = appearances.filter(r => r.result.logicalWinner !== 'draw'
      && p.cases[r.caseIndex][r.result.logicalWinner] === subject.deckId).length;
    const draws = appearances.filter(r => r.result.logicalWinner === 'draw').length;
    assert.equal(subject.all.wins, wins);
    assert.equal(subject.all.draws, draws);
    assert.equal(subject.all.losses, appearances.length - wins - draws);
    assert.equal(subject.all.scoreRate, (wins + draws / 2) / appearances.length);
    assert.equal(subject.commonField.games + subject.headToHead.games, subject.all.games);
    for (const group of [subject.bySeed, subject.byPolicy, subject.byTier, subject.bySeat, subject.byOpponent])
      assert.equal(group.reduce((sum, r) => sum + r.games, 0), subject.all.games);
  }
  assert.equal(summary.checks.uniqueMatches, 192);
  assert.equal(summary.checks.gamesPerSubject, 128);
  assert.equal(summary.subjects[0].headToHead.wins, summary.subjects[1].headToHead.losses);
  assert.equal(summary.seedsLed.air + summary.seedsLed.water + summary.seedsLed.tied, 8);
  assert.equal(summary.districtCoverage.observedOrderedTriples, 1);
  assert.equal(summary.districtCoverage.observedDistinctDistricts, 3);
  assert(summary.perSeed.every(seed => seed.observedDistrictTriples.length === 1));
});

test('ties count as half points without inventing a leading subject', () => {
  const p = plan(true), summary = aggregateHoldout(p, shards(p, true), 2, 'test-plan');
  assert.equal(summary.airMinusWaterPercentagePoints, 0);
  assert.equal(summary.commonFieldAirMinusWaterPercentagePoints, 0);
  assert.deepEqual(summary.seedsLed, { air: 0, water: 0, tied: 8 });
  for (const subject of summary.subjects) {
    assert.equal(subject.all.scoreRate, 0.5);
    assert.equal(subject.all.winRate, 0);
    assert.equal(subject.headToHead.scoreRate, 0.5);
  }
});