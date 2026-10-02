import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { cards } from '@workspace/squabblemon-engine/data';
import {
  createRankingPlan, root, validateRankingResult,
  type RankingCase, type RankingPlan, type RankingResult, type RankingShard,
} from './all-decks-ranking';
import { aggregateRanking, mergeRankingShards, validateCoverage, writeRankingReport } from './all-decks-ranking-report';

function smallPlan(): RankingPlan {
  const original = createRankingPlan();
  const decks = original.decks.slice(0, 3);
  const ids = new Set(decks.map(deck => deck.id));
  return { ...original, decks, cases: original.cases.filter(item => ids.has(item.a) && ids.has(item.b)) };
}

function result(scenario: RankingCase, logicalWinner: 'a' | 'b' | 'draw' = 'a'): RankingResult {
  const playerDeckId = scenario.seat === 'a-player' ? scenario.a : scenario.b;
  const cpuDeckId = scenario.seat === 'a-player' ? scenario.b : scenario.a;
  const winner = logicalWinner === 'draw' ? 'draw' :
    scenario[logicalWinner] === playerDeckId ? 'player' : 'cpu';
  return { deckAId: scenario.a, deckBId: scenario.b, districtSeed: scenario.seed,
    districtIds: ['one', 'two', 'three'], rotation: scenario.rotation, tier: scenario.tier, seat: scenario.seat,
    playerDeckId, cpuDeckId, winner, logicalWinner, playerDistricts: winner === 'player' ? 2 : 1,
    cpuDistricts: winner === 'cpu' ? 2 : 1, laneMargins: [1, 0, -1], plays: 20, passes: 4 };
}

function evidence(plan: RankingPlan, count = 2, draw = false): RankingShard[] {
  return Array.from({ length: count }, (_, index) => ({ index, count, sourceHash: plan.sourceHash,
    elapsedMs: 1, failures: [], rows: plan.cases.flatMap((scenario, caseIndex) =>
      caseIndex % count === index ? [{ caseIndex, result: result(scenario, draw ? 'draw' : caseIndex % 3 === 0 ? 'draw' : 'a') }] : []) }));
}

test('authored universe has 37 legal distinct ten-card no-GUAP compositions and all 10,656 Cartesian cases', () => {
  const plan = createRankingPlan();
  assert.equal(plan.decks.length, 37);
  assert.equal(new Set(plan.decks.map(deck => [...deck.cardIds].sort().join('|'))).size, 37);
  assert(plan.decks.every(deck => deck.cardIds.length === 10 && new Set(deck.cardIds).size === 10));
  assert.deepEqual(plan.excludedCardIds, ['guap']);
  for (const deck of plan.decks) for (const id of deck.cardIds) {
    assert.notEqual(id, 'guap');
    assert(cards[id] && cards[id].kind !== 'token' && !cards[id].hazard, `${deck.id}: illegal card ${id}`);
  }
  assert.equal(plan.cases.length, 10656);
  assert.equal(validateCoverage(plan), 16);
  assert.deepEqual(plan.schedule.tiers, [0, 3]);
  assert.deepEqual(plan.schedule.seats, ['a-player', 'b-player']);
  assert.deepEqual(plan.schedule.policies, ['greedy', 'seeded-legal']);
  assert.deepEqual(plan.schedule.rotations, [0]);
  assert.equal(plan.schedule.seeds.length, 2);
  for (const deck of plan.decks) {
    const cases = plan.cases.filter(item => item.a === deck.id || item.b === deck.id);
    assert.equal(cases.length, 576);
    for (const policy of plan.schedule.policies) assert.equal(cases.filter(item => item.policy === policy).length, 288);
    for (const tier of plan.schedule.tiers) assert.equal(cases.filter(item => item.tier === tier).length, 288);
    assert.equal(cases.filter(item => (item.a === deck.id) === (item.seat === 'a-player')).length, 288);
  }
});

test('GUAP replacement preserves four original slots, all IDs/order keys and the other 33 complete definitions', () => {
  const original = JSON.parse(readFileSync(path.join(root, 'scripts/results/all-decks-v34-ranking/plan.json'), 'utf8')) as RankingPlan;
  const current = createRankingPlan();
  const changedIds = ['focus-wonderland', 'focus-fire-guap', 'element-fire', 'focused-red-set'];
  assert.deepEqual(current.decks.map(deck => deck.id), original.decks.map(deck => deck.id));
  assert.deepEqual(current.cases, original.cases);
  assert.deepEqual(current.schedule, original.schedule);
  assert.equal(original.decks.filter(deck => deck.cardIds.includes('guap')).length, 4);
  let unchanged = 0;
  for (let index = 0; index < current.decks.length; index++) {
    const before = original.decks[index];
    const after = current.decks[index];
    assert.equal(after.orderKey, before.orderKey, `${before.id}: changed order key`);
    if (!changedIds.includes(before.id)) {
      assert.deepEqual(after, before);
      unchanged++;
      continue;
    }
    assert.equal(before.cardIds.filter(id => id === 'guap').length, 1);
    assert.deepEqual(after, { ...before,
      name: before.id === 'focus-fire-guap' ? 'Fire Pressure' : before.name,
      cardIds: before.cardIds.map(id => id === 'guap' ? 'redneck-evil' : id) });
  }
  assert.equal(unchanged, 33);
});

test('report validates declared exclusions while accepting archived plans without the field', () => {
  const plan = smallPlan();
  const archived = structuredClone(plan);
  Reflect.deleteProperty(archived, 'excludedCardIds');
  assert.equal(validateCoverage(archived), 16);
  const bad = structuredClone(plan);
  bad.decks[0] = { ...bad.decks[0], cardIds: ['guap', ...bad.decks[0].cardIds.slice(1)] };
  assert.throws(() => validateCoverage(bad), /excluded card guap/);
  assert.throws(() => validateCoverage({ ...plan, excludedCardIds: ['guap', 'guap'] }), /Repeated excluded/);
  assert.throws(() => validateCoverage({ ...plan, excludedCardIds: ['nonexistent-card'] }), /Unknown excluded/);
});

test('result validates both seats, normalizes winners, and rejects changed runtime axes', () => {
  const plan = smallPlan();
  for (const seat of plan.schedule.seats) {
    const scenario = plan.cases.find(item => item.seat === seat)!;
    for (const winner of ['a', 'b', 'draw'] as const) validateRankingResult(scenario, result(scenario, winner));
    const valid = result(scenario);
    for (const changed of [
      { deckAId: 'wrong' }, { deckBId: 'wrong' }, { districtSeed: 'wrong' }, { rotation: 1 },
      { tier: 3 }, { seat: seat === 'a-player' ? 'b-player' : 'a-player' },
      { playerDeckId: valid.cpuDeckId }, { cpuDeckId: valid.playerDeckId },
      { logicalWinner: 'b' }, { winner: 'draw' },
    ]) assert.throws(() => validateRankingResult(scenario, { ...valid, ...changed } as RankingResult));
  }
});

test('W/L/D attribution is seat-normalized, zero sum and equal across splits and matchups', () => {
  const plan = smallPlan();
  const shards = evidence(plan);
  const summary = aggregateRanking(plan, shards, 2);
  assert.equal(summary.checks.matches, 48);
  assert.equal(summary.checks.freshMatches, 48);
  assert.equal(summary.checks.reusedMatches, 0);
  assert.equal(summary.checks.totalWins, summary.checks.totalLosses);
  assert.equal(summary.checks.totalScore, 48);
  assert.equal(summary.checks.centeredScoreSum, 0);
  assert.equal(summary.checks.matchupRows, 6);
  for (const deck of summary.ranking) {
    const appearances = plan.cases.map((scenario, index) => ({ scenario, index }))
      .filter(({ scenario }) => scenario.a === deck.deckId || scenario.b === deck.deckId);
    assert.equal(deck.all.draws, appearances.filter(({ index }) => index % 3 === 0).length);
    assert.equal(deck.all.wins, appearances.filter(({ index, scenario }) => index % 3 !== 0 && scenario.a === deck.deckId).length);
    assert.equal(deck.all.losses, appearances.filter(({ index, scenario }) => index % 3 !== 0 && scenario.b === deck.deckId).length);
    assert.equal(deck.all.games, 32);
    for (const split of ['greedy', 'seeded', 'base', 'upgraded', 'first', 'second'] as const) assert.equal(deck[split].games, 16);
    assert.equal(deck.matchups.length, 2);
    for (const matchup of deck.matchups) {
      const inverse = summary.ranking.find(other => other.deckId === matchup.opponentId)!.matchups.find(item => item.opponentId === deck.deckId)!;
      assert.equal(matchup.all.wins, inverse.all.losses);
      assert.equal(matchup.all.draws, inverse.all.draws);
    }
  }
});

test('report counts fresh/reused matches and rejects missing or mixed reuse provenance', () => {
  const plan = smallPlan();
  const shards = evidence(plan);
  const reusedGames = shards[0].rows.length;
  plan.evidenceReuse = { sourceDirectory: 'original-results', sourceHash: 'original-source',
    sourcePlanHash: 'original-plan', sourceWorkerHashes: ['original-worker'],
    cacheHash: 'original-cache', reusedGames, rerunGames: plan.cases.length - reusedGames };
  for (const row of shards[0].rows) row.reusedFrom = plan.evidenceReuse.sourceHash;
  const summary = aggregateRanking(plan, shards, 2);
  assert.equal(summary.checks.reusedMatches, reusedGames);
  assert.equal(summary.checks.freshMatches, plan.cases.length - reusedGames);
  assert.equal(summary.checks.freshMatches + summary.checks.reusedMatches, summary.checks.matches);
  assert.throws(() => aggregateRanking({ ...plan, evidenceReuse: undefined }, shards, 2), /without provenance/);
  assert.throws(() => aggregateRanking({ ...plan, evidenceReuse: { ...plan.evidenceReuse!, reusedGames: reusedGames - 1 } }, shards, 2),
    /Reused match count mismatch/);
  const wrongSource = structuredClone(shards);
  wrongSource[0].rows[0].reusedFrom = 'wrong-source';
  assert.throws(() => aggregateRanking(plan, wrongSource, 2), /Wrong reused source hash/);
});

test('direct report validates cache hash and original reused results before emitting summaries', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'all-decks-report-test-'));
  try {
    const plan = createRankingPlan();
    const shards = evidence(plan);
    const cachedRows = structuredClone(shards[0].rows);
    const cached = JSON.stringify(cachedRows) + '\n';
    const cacheHash = createHash('sha256').update(cached).digest('hex');
    plan.evidenceReuse = { sourceDirectory: 'original-results', sourceHash: 'original-source',
      sourcePlanHash: 'original-plan', sourceWorkerHashes: ['original-worker'],
      cacheHash, reusedGames: cachedRows.length, rerunGames: plan.cases.length - cachedRows.length };
    for (const row of shards[0].rows) row.reusedFrom = plan.evidenceReuse.sourceHash;
    const savePlan = () => writeFileSync(path.join(directory, 'plan.json'), JSON.stringify(plan));
    const saveWorkers = () => shards.forEach(shard =>
      writeFileSync(path.join(directory, `worker-${shard.index}.json`), JSON.stringify(shard)));
    savePlan();
    saveWorkers();
    writeFileSync(path.join(directory, 'reused-evidence.json'), cached + ' ');
    assert.throws(() => writeRankingReport(directory, 2), /cache hash mismatch/);
    assert(!existsSync(path.join(directory, 'summary.json')));
    writeFileSync(path.join(directory, 'reused-evidence.json'), cached);
    const original = structuredClone(shards[0].rows[0].result);
    shards[0].rows[0].result = { ...original, plays: original.plays + 1 };
    saveWorkers();
    assert.throws(() => writeRankingReport(directory, 2), /Reused result or provenance changed/);
    assert(!existsSync(path.join(directory, 'summary.json')));
    shards[0].rows[0].result = original;
    saveWorkers();
    writeRankingReport(directory, 2);
    const summary = JSON.parse(readFileSync(path.join(directory, 'summary.json'), 'utf8'));
    assert.deepEqual(summary.excludedCardIds, ['guap']);
    assert.deepEqual(summary.evidenceReuse, plan.evidenceReuse);
    assert.equal(summary.checks.reusedMatches, cachedRows.length);
    assert.equal(summary.checks.freshMatches, plan.cases.length - cachedRows.length);
    const markdown = readFileSync(path.join(directory, 'report.md'), 'utf8');
    assert.match(markdown, /GUAP \(guap\) is excluded/);
    assert.match(markdown, /Redneck Evil \(redneck-evil\) replaces GUAP/);
    assert.match(markdown, /5328 fresh matches; 5328 reused matches/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('equal scores share rank and are explicitly ties; stable display order is not strength', () => {
  const plan = smallPlan();
  const summary = aggregateRanking(plan, evidence(plan, 2, true), 2);
  assert(summary.ranking.every(deck => deck.rank === 1 && deck.tied && deck.all.scoreRate === 0.5));
  assert.deepEqual(summary.ranking.map(deck => deck.deckId),
    plan.decks.map(deck => deck.id).sort((a, b) => a.localeCompare(b)));
});

test('merge rejects failed, mixed, missing, duplicate, extra, reordered and wrong-worker evidence', () => {
  const plan = smallPlan();
  const valid = evidence(plan);
  assert.equal(mergeRankingShards(plan, valid, 2).length, 48);
  const mutations: ((shards: RankingShard[]) => void)[] = [
    shards => { shards[0].failures.push({ caseIndex: 0, scenario: plan.cases[0], message: 'simulation failed' }); },
    shards => { shards[0].sourceHash = 'other-build'; },
    shards => { shards[0].count = 3; },
    shards => { shards.pop(); },
    shards => { shards.push(structuredClone(shards[0])); },
    shards => { shards[1].index = 0; },
    shards => { shards[0].rows.pop(); },
    shards => { shards[0].rows.push(structuredClone(shards[0].rows[0])); },
    shards => { shards[0].rows[1] = structuredClone(shards[0].rows[0]); },
    shards => { shards[0].rows.reverse(); },
    shards => { const first = shards[0].rows[0]; shards[0].rows[0] = shards[1].rows[0]; shards[1].rows[0] = first; },
    shards => { shards[0].rows[0].result = { ...shards[0].rows[0].result, logicalWinner: 'b' }; },
  ];
  for (const mutate of mutations) {
    const shards = structuredClone(valid);
    mutate(shards);
    assert.throws(() => mergeRankingShards(plan, shards, 2));
  }
  assert.throws(() => mergeRankingShards({ ...plan, cases: plan.cases.slice(1) }, valid, 2));
});