import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  loadRankingPlan, root, simulateRankingCase, sourceHash, validateRankingResult,
  type RankingCase, type RankingPlan, type RankingRow, type RankingShard,
} from './all-decks-ranking';

export const FOCUS_IDS = ['element-air', 'element-water'];
export const FRESH_SEEDS = Array.from({ length: 8 }, (_, i) => `air-water-v35-holdout-${String(i + 1).padStart(2, '0')}`);
const BASELINE = 'scripts/results/all-decks-v35-no-guap';
const scriptPath = fileURLToPath(import.meta.url);
const sha256 = (content: string | Buffer): string => createHash('sha256').update(content).digest('hex');
const json = <T>(file: string): T => JSON.parse(readFileSync(file, 'utf8')) as T;
const save = (file: string, value: unknown): void => writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });

export type HoldoutPlan = RankingPlan & {
  protocol: 'air-water-field-holdout';
  focusIds: string[];
  harnessHash: string;
  baseline: { directory: string; seeds: string[]; files: Record<string, string> };
};
export type HoldoutShard = RankingShard & { harnessHash: string; planHash: string };
type Rate = { games: number; wins: number; losses: number; draws: number; scoreRate: number; winRate: number };

/** Retain canonical a/b identities; the shared head-to-head is scheduled only once. */
export function focusCases(
  decks: RankingPlan['decks'], schedule: RankingPlan['schedule'], focusIds: readonly string[],
): RankingCase[] {
  assert.equal(new Set(focusIds).size, 2, 'Need two distinct subjects');
  assert(focusIds.every(id => decks.some(deck => deck.id === id)), 'Missing subject');
  const cases: RankingCase[] = [];
  for (let a = 0; a < decks.length; a++) for (let b = a + 1; b < decks.length; b++) {
    if (!focusIds.includes(decks[a].id) && !focusIds.includes(decks[b].id)) continue;
    for (const policy of schedule.policies) for (const seed of schedule.seeds)
      for (const rotation of schedule.rotations) for (const tier of schedule.tiers) for (const seat of schedule.seats) {
        const values = { a: decks[a].id, b: decks[b].id, policy, seed, rotation, tier, seat };
        cases.push({ ...values, key: [values.a, values.b, policy, seed, rotation, tier, seat].join('|') });
      }
  }
  return cases;
}

export function validateHoldout(plan: HoldoutPlan): number {
  assert.equal(plan.protocol, 'air-water-field-holdout');
  assert.equal(plan.evidenceReuse, undefined, 'Holdout results must all be fresh');
  assert.deepEqual(plan.focusIds, FOCUS_IDS);
  assert.equal(new Set(plan.decks.map(deck => deck.id)).size, plan.decks.length);
  assert.deepEqual(plan.excludedCardIds, ['guap']);
  for (const deck of plan.decks) {
    assert.equal(deck.cardIds.length, 10);
    assert.equal(new Set(deck.cardIds).size, 10);
    assert(!deck.cardIds.includes('guap'), 'GUAP is excluded');
  }
  const axes = plan.schedule;
  for (const values of [axes.seeds, axes.rotations, axes.tiers, axes.seats, axes.policies]) {
    assert(values.length > 0 && new Set<string | number>(values).size === values.length, 'Invalid schedule axis');
  }
  assert(axes.seeds.every(seed => !plan.baseline.seeds.includes(seed)), 'Reused baseline seed');
  assert.deepEqual(axes.policies, ['greedy', 'seeded-legal']);
  assert.deepEqual(axes.tiers, [0, 3]);
  assert.deepEqual(axes.seats, ['a-player', 'b-player']);
  assert.deepEqual(axes.rotations, [0]);
  assert.equal(axes.allowSquabble, true);
  assert.deepEqual(plan.cases, focusCases(plan.decks, axes, plan.focusIds), 'Incomplete or changed focused schedule');
  assert.equal(new Set(plan.cases.map(c => c.key)).size, plan.cases.length);
  return axes.seeds.length * axes.policies.length * axes.tiers.length * axes.seats.length * axes.rotations.length;
}

export function createHoldoutPlan(): HoldoutPlan {
  const directory = path.join(root, BASELINE);
  const baseline = loadRankingPlan(directory);
  assert.equal(baseline.balanceVersion, 35, 'This holdout is pinned to the completed v35 ranking');
  assert.equal(baseline.rulesVersion, 35);
  assert.equal(baseline.evidenceReuse, undefined);
  assert.equal(baseline.decks.length, 37);
  assert(FRESH_SEEDS.every(seed => !baseline.schedule.seeds.includes(seed)));
  const files = Object.fromEntries(readdirSync(directory).map(name =>
    [name, sha256(readFileSync(path.join(directory, name)))]));
  const schedule = { ...structuredClone(baseline.schedule), seeds: [...FRESH_SEEDS] };
  const plan: HoldoutPlan = {
    ...structuredClone(baseline), generatedAt: new Date().toISOString(),
    protocol: 'air-water-field-holdout', focusIds: [...FOCUS_IDS],
    harnessHash: sha256(readFileSync(scriptPath)), schedule,
    baseline: { directory: BASELINE, seeds: [...baseline.schedule.seeds], files },
    cases: focusCases(baseline.decks, schedule, FOCUS_IDS),
  };
  validateHoldout(plan);
  assert.equal(plan.cases.length, 4544);
  return plan;
}

function loadHoldout(directory: string): HoldoutPlan {
  const plan = json<HoldoutPlan>(path.join(directory, 'plan.json'));
  const current = createHoldoutPlan();
  assert.deepEqual({ ...plan, generatedAt: '' }, { ...current, generatedAt: '' },
    'Source, harness, baseline, rosters or schedule changed; refusing mixed evidence');
  return plan;
}

function runWorker(directory: string, index: number, count: number): void {
  assert(Number.isInteger(count) && count > 0 && Number.isInteger(index) && index >= 0 && index < count);
  const plan = loadHoldout(directory), planFile = path.join(directory, 'plan.json');
  const planHash = sha256(readFileSync(planFile));
  const output = path.join(directory, `worker-${index}.json`);
  assert(!existsSync(output), 'Refusing to overwrite completed evidence');
  const decks = new Map(plan.decks.map(deck => [deck.id, deck]));
  const rows: RankingRow[] = [], failures: RankingShard['failures'] = [];
  const started = Date.now(), planned = Math.ceil((plan.cases.length - index) / count);
  console.log(`HOLDOUT_START worker=${index} planned=${planned}`);
  for (let caseIndex = index; caseIndex < plan.cases.length; caseIndex += count) {
    const scenario = plan.cases[caseIndex];
    try { rows.push({ caseIndex, result: simulateRankingCase(scenario, decks) }); }
    catch (error) {
      const message = error instanceof Error ? error.stack ?? error.message : String(error);
      failures.push({ caseIndex, scenario, message });
      console.error(`HOLDOUT_FAILURE worker=${index} caseIndex=${caseIndex} key=${scenario.key} message=${message}`);
    }
    const completed = rows.length + failures.length;
    if (completed % 128 === 0 || completed === planned)
      console.log(`HOLDOUT_PROGRESS worker=${index} completed=${completed}/${planned} failures=${failures.length}`);
  }
  loadHoldout(directory);
  assert.equal(sha256(readFileSync(planFile)), planHash, 'Plan changed during simulation');
  const shard: HoldoutShard = {
    index, count, sourceHash: plan.sourceHash, harnessHash: plan.harnessHash, planHash,
    elapsedMs: Date.now() - started, rows, failures,
  };
  save(output, shard);
  console.log(`HOLDOUT_WORKER_COMPLETE worker=${index} successful=${rows.length} failures=${failures.length}`);
  if (failures.length) process.exitCode = 2;
}

export function mergeHoldout(plan: HoldoutPlan, shards: HoldoutShard[], count: number, planHash: string): RankingRow[] {
  validateHoldout(plan);
  assert(Number.isInteger(count) && count > 0);
  assert.equal(shards.length, count, 'Missing or extra workers');
  assert.equal(new Set(shards.map(shard => shard.index)).size, count, 'Duplicate worker');
  for (const shard of shards) {
    assert(Number.isInteger(shard.index) && shard.index >= 0 && shard.index < count);
    assert.equal(shard.count, count);
    assert.equal(shard.sourceHash, plan.sourceHash, 'Mixed engine source');
    assert.equal(shard.harnessHash, plan.harnessHash, 'Mixed harness source');
    assert.equal(shard.planHash, planHash, 'Mixed plan');
    assert(Number.isFinite(shard.elapsedMs) && shard.elapsedMs >= 0);
    assert.equal(shard.failures.length, 0, 'Failed simulations; no accepted rates');
    const indices = plan.cases.map((_, i) => i).filter(i => i % count === shard.index);
    assert.deepEqual(shard.rows.map(row => row.caseIndex), indices, 'Missing, duplicate, reordered or misplaced cases');
    for (const row of shard.rows) {
      assert.equal(row.reusedFrom, undefined, 'Reused result in fresh holdout');
      validateRankingResult(plan.cases[row.caseIndex], row.result);
      assert.equal(row.result.districtIds.length, 3, 'Incomplete district snapshot');
      assert(row.result.districtIds.every(id => typeof id === 'string' && id.length > 0));
    }
  }
  const rows = shards.flatMap(shard => shard.rows).sort((a, b) => a.caseIndex - b.caseIndex);
  assert.equal(rows.length, plan.cases.length);
  return rows;
}

export function aggregateHoldout(plan: HoldoutPlan, shards: HoldoutShard[], count: number, planHash: string) {
  const rows = mergeHoldout(plan, shards, count, planHash), perPair = validateHoldout(plan);
  const rate = (id: string, predicate: (c: RankingCase) => boolean = () => true): Rate => {
    let wins = 0, losses = 0, draws = 0;
    for (const row of rows) {
      const c = plan.cases[row.caseIndex];
      if ((c.a !== id && c.b !== id) || !predicate(c)) continue;
      const winner = row.result.logicalWinner;
      if (winner === 'draw') draws++;
      else if (c[winner] === id) wins++;
      else losses++;
    }
    const games = wins + losses + draws;
    assert(games > 0, 'No samples');
    return { games, wins, losses, draws, winRate: wins / games, scoreRate: (wins + draws / 2) / games };
  };
  const subjects = plan.focusIds.map(id => {
    const deck = plan.decks.find(d => d.id === id)!;
    const mutual = (c: RankingCase) => plan.focusIds.includes(c.a) && plan.focusIds.includes(c.b);
    const byOpponent = plan.decks.filter(d => d.id !== id).map(d =>
      ({ deckId: d.id, name: d.name, ...rate(id, c => c.a === d.id || c.b === d.id) }));
    const all = rate(id), headToHead = rate(id, mutual), commonField = rate(id, c => !mutual(c));
    const bySeed = plan.schedule.seeds.map(seed => ({ seed, ...rate(id, c => c.seed === seed) }));
    const byPolicy = plan.schedule.policies.map(policy => ({ policy, ...rate(id, c => c.policy === policy) }));
    const byTier = plan.schedule.tiers.map(tier => ({ tier, ...rate(id, c => c.tier === tier) }));
    const bySeat = (['player', 'cpu'] as const).map(seat => ({
      seat, ...rate(id, c => ((c.a === id) === (c.seat === 'a-player')) === (seat === 'player')),
    }));
    assert.equal(all.games, (plan.decks.length - 1) * perPair);
    assert.equal(headToHead.games, perPair);
    assert.equal(commonField.games, (plan.decks.length - 2) * perPair);
    for (const opponent of byOpponent) assert.equal(opponent.games, perPair);
    for (const seed of bySeed) assert.equal(seed.games, all.games / plan.schedule.seeds.length);
    for (const split of [...byPolicy, ...byTier, ...bySeat]) assert.equal(split.games, all.games / 2);
    return { deckId: id, name: deck.name, cardIds: deck.cardIds, all, commonField, headToHead, bySeed, byPolicy, byTier, bySeat, byOpponent };
  });
  const [air, water] = subjects;
  assert.equal(air.headToHead.wins, water.headToHead.losses);
  assert.equal(air.headToHead.draws, water.headToHead.draws);
  assert.equal(air.all.games + water.all.games, rows.length + perPair, 'Double-counted head-to-head');
  const perSeed = plan.schedule.seeds.map((seed, i) => {
    const a = air.bySeed[i], w = water.bySeed[i];
    const observedDistrictTriples = [...new Set(rows.filter(r => plan.cases[r.caseIndex].seed === seed)
      .map(r => JSON.stringify(r.result.districtIds)))].map(value => JSON.parse(value) as string[]);
    return { seed, observedDistrictTriples, air: a, water: w, airMinusWaterPercentagePoints: 100 * (a.scoreRate - w.scoreRate) };
  });
  const districtTriples = perSeed.flatMap(s => s.observedDistrictTriples);
  const gap = (a: Rate, b: Rate) => 100 * (a.scoreRate - b.scoreRate);
  return {
    checks: { complete: true, uniqueMatches: rows.length, freshMatches: rows.length, reusedMatches: 0,
      casesPerPair: perPair, gamesPerSubject: air.all.games, opponentsPerSubject: plan.decks.length - 1,
      commonOpponents: plan.decks.length - 2, failures: 0 },
    subjects, perSeed, airMinusWaterPercentagePoints: gap(air.all, water.all),
    commonFieldAirMinusWaterPercentagePoints: gap(air.commonField, water.commonField),
    districtCoverage: { observedOrderedTriples: new Set(districtTriples.map(d => JSON.stringify(d))).size,
      observedDistinctDistricts: new Set(districtTriples.flat()).size,
      byLane: Array.from({ length: 3 }, (_, lane) => ({ lane: lane + 1, districtIds: [...new Set(districtTriples.map(d => d[lane]))].sort() })) },
    seedsLed: { air: perSeed.filter(s => s.airMinusWaterPercentagePoints > 0).length,
      water: perSeed.filter(s => s.airMinusWaterPercentagePoints < 0).length,
      tied: perSeed.filter(s => s.airMinusWaterPercentagePoints === 0).length },
  };
}

const limitations = [
  'Fixed-deck bot comparison on eight predeclared fresh seed labels; no gameplay or roster changes and no tuning between seeds.',
  'Only Air and Water are tested against the field. This does not rerank all 37 decks or establish an overall best deck.',
  'Score is (wins + half draws) / games, not a player win rate. Repeated policy/tier/seat cases are not independent human samples.',
  'Seed labels change districts, deck shuffles and seeded-policy choices. New labels need not yield unique district layouts; observed ordered layouts are recorded per seed.',
  'The 35 shared opponents are also reported separately from the Air–Water head-to-head; the shared match is simulated only once.',
  'GUAP is excluded. These frozen rosters contain no Barber Bro, so Normal’s hand bonus is not measured.',
  'Bot movement choices are not optimized; ability-driven movement still runs.',
];
const csv = (rows: (string | number)[][]): string =>
  rows.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n') + '\n';
const percent = (value: number) => (100 * value).toFixed(2) + '%';

function report(directory: string, count: number): void {
  const files = ['summary.json', 'report.md', 'summary.csv', 'by-seed.csv', 'matchups.csv'];
  files.forEach(name => assert(!existsSync(path.join(directory, name)), 'Refusing to overwrite summaries'));
  const plan = loadHoldout(directory), planHash = sha256(readFileSync(path.join(directory, 'plan.json')));
  const workers = readdirSync(directory).filter(name => /^worker-.*\.json$/.test(name)).sort();
  assert.deepEqual(workers, Array.from({ length: count }, (_, i) => `worker-${i}.json`).sort());
  const shards = workers.map(name => {
    const shard = json<HoldoutShard>(path.join(directory, name));
    assert.equal(name, `worker-${shard.index}.json`);
    return shard;
  });
  const aggregated = aggregateHoldout(plan, shards, count, planHash);
  const baseline = json<{ ranking: { deckId: string; rank: number; all: Rate }[] }>(path.join(root, BASELINE, 'summary.json'));
  const summary = { generatedAt: new Date().toISOString(), sourceHash: plan.sourceHash, harnessHash: plan.harnessHash,
    planHash, balanceVersion: plan.balanceVersion, rulesVersion: plan.rulesVersion, schedule: plan.schedule,
    baseline: plan.baseline, workers: shards.map((shard, i) => ({ index: shard.index, matches: shard.rows.length,
      elapsedMs: shard.elapsedMs, evidenceHash: sha256(readFileSync(path.join(directory, workers[i]))) })),
    previousSample: baseline.ranking.filter(d => plan.focusIds.includes(d.deckId)).map(d => ({ deckId: d.deckId, rank: d.rank, all: d.all })),
    limitations, ...aggregated };
  const headline: (string | number)[][] = [['deck', 'scope', 'games', 'wins', 'losses', 'draws', 'win_percent', 'score_percent']];
  const add = (name: string, scope: string, rate: Rate) =>
    headline.push([name, scope, rate.games, rate.wins, rate.losses, rate.draws, 100 * rate.winRate, 100 * rate.scoreRate]);
  for (const d of summary.subjects) {
    add(d.name, 'All 36 opponents', d.all); add(d.name, '35 shared opponents', d.commonField);
    add(d.name, 'Air vs Water only', d.headToHead);
    d.byPolicy.forEach(r => add(d.name, `Policy: ${r.policy}`, r));
    d.byTier.forEach(r => add(d.name, `Upgrade tier: ${r.tier}`, r));
    d.bySeat.forEach(r => add(d.name, `Seat: ${r.seat}`, r));
  }
  const seeds = csv([['seed', 'games_per_deck', 'air_score_percent', 'water_score_percent', 'air_minus_water_percentage_points', 'observed_district_triples'],
    ...summary.perSeed.map(s => [s.seed, s.air.games, s.air.scoreRate * 100, s.water.scoreRate * 100,
      s.airMinusWaterPercentagePoints, s.observedDistrictTriples.map(d => d.join(' / ')).join('; ')])]);
  const matchups = csv([['deck', 'opponent', 'games', 'wins', 'losses', 'draws', 'score_percent'],
    ...summary.subjects.flatMap(d => d.byOpponent.map(r => [d.name, r.name, r.games, r.wins, r.losses, r.draws, 100 * r.scoreRate]))]);
  const markdown = ['# Air and Water — fresh-seed field check', '',
    `${summary.checks.uniqueMatches} unique fresh matches; ${summary.checks.gamesPerSubject} games per subject; zero failures.`,
    'Same v35 cards, ordered decks, policies, tiers, rotation and seats as the original GUAP-free ranking. Only the seed labels changed.',
    '', '| Deck | All opponents | Shared field | Head-to-head | W/L/D (all) |', '|---|---:|---:|---:|---|',
    ...summary.subjects.map(d => `| ${d.name} | ${percent(d.all.scoreRate)} | ${percent(d.commonField.scoreRate)} | ${percent(d.headToHead.scoreRate)} | ${d.all.wins}/${d.all.losses}/${d.all.draws} |`),
    '', `Air minus Water: ${summary.airMinusWaterPercentagePoints.toFixed(2)} percentage points.`,
    `Seed leads: Air ${summary.seedsLed.air}; Water ${summary.seedsLed.water}; tied ${summary.seedsLed.tied}.`,
    '', '## Per-seed score', '', '| Seed | Air | Water | Air minus Water (points) |', '|---|---:|---:|---:|',
    ...summary.perSeed.map(s => `| ${s.seed} | ${percent(s.air.scoreRate)} | ${percent(s.water.scoreRate)} | ${s.airMinusWaterPercentagePoints.toFixed(2)} |`),
    '', '## Scope and limitations', '', ...limitations.map(line => '- ' + line), '',
    `Engine source hash: ${plan.sourceHash}`, `Harness hash: ${plan.harnessHash}`, `Plan hash: ${planHash}`, '',
    'The plan binds all original baseline file hashes. Workers and reporting reject any source, plan, roster or baseline change.',
    'Policy, tier and seat splits are in summary.csv; all 36 opponent records for each subject are in matchups.csv.', '',
  ].join('\n');
  // Every validation above must succeed before publishing any accepted summary.
  const contents = [JSON.stringify(summary, null, 2) + '\n', markdown, csv(headline), seeds, matchups];
  files.forEach((name, i) => writeFileSync(path.join(directory, name), contents[i], { flag: 'wx' }));
  console.log(`HOLDOUT_REPORT_COMPLETE matches=${summary.checks.uniqueMatches} failures=0`);
  console.log(JSON.stringify({ checks: summary.checks, subjects: summary.subjects.map(d =>
    ({ name: d.name, all: d.all, commonField: d.commonField, headToHead: d.headToHead })),
    airMinusWaterPercentagePoints: summary.airMinusWaterPercentagePoints, seedsLed: summary.seedsLed, perSeed: summary.perSeed }, null, 2));
}

function main(args: string[]): void {
  const [action, output, worker, count] = args;
  assert(output && !path.isAbsolute(output), 'Provide a workspace-relative output directory');
  const directory = path.resolve(root, output);
  assert(!path.relative(root, directory).startsWith('..'), 'Output must stay in the workspace');
  if (action === 'init' && args.length === 2) {
    assert(!existsSync(directory), 'Refusing to overwrite an existing run');
    const plan = createHoldoutPlan();
    mkdirSync(directory, { recursive: true });
    save(path.join(directory, 'plan.json'), plan);
    save(path.join(directory, 'runner-sources.json'), {
      sourceHash: plan.sourceHash, harnessHash: plan.harnessHash,
      sources: { [path.relative(root, scriptPath)]: readFileSync(scriptPath, 'utf8') },
    });
    console.log(`HOLDOUT_PLAN_COMPLETE cases=${plan.cases.length} seeds=${plan.schedule.seeds.length} source=${sourceHash()}`);
  } else if (action === 'worker' && args.length === 4) runWorker(directory, Number(worker), Number(count));
  else if (action === 'report' && args.length === 3) report(directory, Number(worker));
  else throw new Error('Usage: air-water-holdout.ts init <directory> | worker <directory> <index> <count> | report <directory> <count>');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main(process.argv.slice(2));