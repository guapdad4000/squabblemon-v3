import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { root, type RankingCase, type RankingPlan, type RankingResult, type RankingRow } from './all-decks-ranking';
import { selectReusableRows, verifyIncrementalRows } from './all-decks-ranking-incremental';

function fixture(): { previous: RankingPlan; current: RankingPlan; rows: RankingRow[] } {
  const archived = JSON.parse(readFileSync(path.join(root, 'scripts/results/all-decks-v34-ranking/plan.json'), 'utf8')) as RankingPlan;
  const decks = archived.decks.slice(0, 3);
  const ids = new Set(decks.map(deck => deck.id));
  const previous: RankingPlan = { ...archived, excludedCardIds: [],
    decks, cases: archived.cases.filter(item => ids.has(item.a) && ids.has(item.b)) };
  const current = structuredClone(previous);
  current.sourceHash = 'new-output-harness';
  const rows = previous.cases.map((scenario, caseIndex) => ({ caseIndex, result: result(scenario) }));
  return { previous, current, rows };
}

function result(scenario: RankingCase): RankingResult {
  const playerDeckId = scenario.seat === 'a-player' ? scenario.a : scenario.b;
  const cpuDeckId = scenario.seat === 'a-player' ? scenario.b : scenario.a;
  return { deckAId: scenario.a, deckBId: scenario.b, districtSeed: scenario.seed,
    districtIds: ['one', 'two', 'three'], rotation: scenario.rotation, tier: scenario.tier, seat: scenario.seat,
    playerDeckId, cpuDeckId, winner: 'draw', logicalWinner: 'draw',
    playerDistricts: 1, cpuDistricts: 1, laneMargins: [1, 0, -1], plays: 20, passes: 4 };
}

function completed(previous: RankingPlan, current: RankingPlan, rows: RankingRow[], reusable: RankingRow[]): RankingRow[] {
  current.evidenceReuse = { sourceDirectory: 'scripts/results/all-decks-v34-ranking',
    sourceHash: previous.sourceHash, sourcePlanHash: 'original-plan-hash',
    sourceWorkerHashes: ['original-worker-hash'], cacheHash: 'reuse-cache-hash',
    reusedGames: reusable.length, rerunGames: current.cases.length - reusable.length };
  const reused = new Set(reusable.map(row => row.caseIndex));
  return rows.map(row => reused.has(row.caseIndex)
    ? { ...structuredClone(row), reusedFrom: previous.sourceHash } : structuredClone(row));
}

test('changed deck reuses only cases with both complete deck definitions unchanged', () => {
  const { previous, current, rows } = fixture();
  current.decks[0] = { ...current.decks[0], cardIds: ['redneck-evil', ...current.decks[0].cardIds.slice(1)] };
  const reusable = selectReusableRows(previous, current, rows);
  const expected = rows.filter(row => {
    const scenario = current.cases[row.caseIndex];
    return scenario.a !== current.decks[0].id && scenario.b !== current.decks[0].id;
  });
  assert.deepEqual(reusable.map(row => row.caseIndex), expected.map(row => row.caseIndex));
  assert.equal(reusable.length, 16);
  verifyIncrementalRows(current, completed(previous, current, rows, reusable), reusable);
});

test('order key and display name are part of the complete deck definition', () => {
  for (const changed of [{ orderKey: 'changed-draw-order' }, { name: 'changed-name' }]) {
    const { previous, current, rows } = fixture();
    current.decks[0] = { ...current.decks[0], ...changed };
    const reusable = selectReusableRows(previous, current, rows);
    assert.equal(reusable.length, 16);
    assert(reusable.every(row => {
      const scenario = current.cases[row.caseIndex];
      return scenario.a !== current.decks[0].id && scenario.b !== current.decks[0].id;
    }));
  }
});

test('unchanged decks reuse every case despite a new harness source hash', () => {
  const { previous, current, rows } = fixture();
  const reusable = selectReusableRows(previous, current, rows);
  assert.deepEqual(reusable.map(row => row.caseIndex), rows.map(row => row.caseIndex));
  verifyIncrementalRows(current, completed(previous, current, rows, reusable), reusable);
});

test('reuse rejects changed rules/balance versions, schedule or ordered cases', () => {
  const mutations: ((plan: RankingPlan) => void)[] = [
    plan => { plan.balanceVersion++; },
    plan => { plan.rulesVersion++; },
    plan => { plan.schedule.seeds[0] = 'changed-seed'; },
    plan => { plan.schedule.rotations = [0, 1]; },
    plan => { plan.cases.pop(); },
    plan => { plan.cases.reverse(); },
    plan => { plan.cases[0].key = 'changed-case'; },
  ];
  for (const mutate of mutations) {
    const { previous, current, rows } = fixture();
    mutate(current);
    assert.throws(() => selectReusableRows(previous, current, rows));
  }
});

test('verification rejects tampered reused results, missing/wrong/spurious markers and counts', () => {
  const { previous, current, rows } = fixture();
  current.decks[0] = { ...current.decks[0], orderKey: 'new-order' };
  const reusable = selectReusableRows(previous, current, rows);
  const valid = completed(previous, current, rows, reusable);
  verifyIncrementalRows(current, valid, reusable);
  const reusedIndex = reusable[0].caseIndex;
  const freshIndex = valid.findIndex(row => row.reusedFrom === undefined);
  const mutations: ((evidence: RankingRow[]) => void)[] = [
    evidence => { evidence[reusedIndex].result = { ...evidence[reusedIndex].result, plays: 21 }; },
    evidence => { evidence[reusedIndex].result = { ...evidence[reusedIndex].result, laneMargins: [2, 0, -1] }; },
    evidence => { delete evidence[reusedIndex].reusedFrom; },
    evidence => { evidence[reusedIndex].reusedFrom = 'wrong-source'; },
    evidence => { evidence[freshIndex].reusedFrom = previous.sourceHash; },
    evidence => { evidence.pop(); },
    evidence => { evidence.push(structuredClone(evidence[0])); },
  ];
  for (const mutate of mutations) {
    const evidence = structuredClone(valid);
    mutate(evidence);
    assert.throws(() => verifyIncrementalRows(current, evidence, reusable));
  }
  const wrongCount = structuredClone(current);
  wrongCount.evidenceReuse!.reusedGames++;
  assert.throws(() => verifyIncrementalRows(wrongCount, valid, reusable));
});