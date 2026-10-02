import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  greedyBalancePolicy, seededLegalBalancePolicy, simulateBalanceMatch,
  type BalanceDeck, type BalanceMatchResult,
} from '@workspace/squabblemon-engine/balanceLab';
import { CARD_BALANCE_VERSION, ONLINE_RULES_VERSION } from '@workspace/squabblemon-engine/multiplayer';
import { allRankingDecks, excludedRankingCardIds } from './all-decks-ranking-decks';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const policies = { greedy: greedyBalancePolicy, 'seeded-legal': seededLegalBalancePolicy };
export type RankingCase = {
  key: string; a: string; b: string; policy: keyof typeof policies;
  seed: string; rotation: number; tier: 0 | 3; seat: 'a-player' | 'b-player';
};
export type RankingPlan = {
  generatedAt: string; sourceHash: string; balanceVersion: number; rulesVersion: number;
  excludedCardIds: string[];
  evidenceReuse?: {
    sourceDirectory: string; sourceHash: string; sourcePlanHash: string; sourceWorkerHashes: string[];
    cacheHash: string; reusedGames: number; rerunGames: number;
  };
  decks: BalanceDeck[]; cases: RankingCase[]; schedule: {
    seeds: string[]; rotations: number[]; tiers: (0 | 3)[]; seats: ('a-player' | 'b-player')[];
    policies: (keyof typeof policies)[]; allowSquabble: true;
  };
};
export type RankingResult = Pick<BalanceMatchResult,
  'deckAId' | 'deckBId' | 'districtSeed' | 'districtIds' | 'rotation' | 'tier' | 'seat'
  | 'playerDeckId' | 'cpuDeckId' | 'winner' | 'logicalWinner'
  | 'playerDistricts' | 'cpuDistricts' | 'laneMargins' | 'plays' | 'passes'>;
export type RankingRow = { caseIndex: number; result: RankingResult; reusedFrom?: string };
export type RankingShard = {
  index: number; count: number; sourceHash: string; elapsedMs: number;
  rows: RankingRow[]; failures: { caseIndex: number; scenario: RankingCase; message: string }[];
};

export function sourceHash(): string {
  const files = [
    'scripts/src/all-decks-ranking.ts', 'scripts/src/all-decks-ranking-decks.ts',
    'scripts/src/all-decks-ranking-incremental.ts',
    'scripts/src/element-balance-audit-decks.ts',
    'artifacts/squabblemon/src/lib/deckWorkshop.ts', 'artifacts/squabblemon/src/data.ts',
  ].map(file => path.join(root, file));
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (file.endsWith('.ts')) files.push(file);
    }
  };
  visit(path.join(root, 'lib/squabblemon-engine/src'));
  const hash = createHash('sha256');
  for (const file of files.sort()) hash.update(path.relative(root, file)).update('\0').update(readFileSync(file)).update('\0');
  return hash.digest('hex');
}

export function createRankingPlan(): RankingPlan {
  const decks = allRankingDecks();
  const schedule: RankingPlan['schedule'] = {
    seeds: ['all-decks-ranking-fresh-a', 'all-decks-ranking-fresh-b'],
    rotations: [0], tiers: [0, 3], seats: ['a-player', 'b-player'],
    policies: ['greedy', 'seeded-legal'], allowSquabble: true,
  };
  const cases: RankingCase[] = [];
  for (let a = 0; a < decks.length; a++) for (let b = a + 1; b < decks.length; b++) {
    for (const policy of schedule.policies) for (const seed of schedule.seeds)
      for (const rotation of schedule.rotations) for (const tier of schedule.tiers) for (const seat of schedule.seats) {
        const values = { a: decks[a].id, b: decks[b].id, policy, seed, rotation, tier, seat };
        cases.push({ key: [values.a, values.b, policy, seed, rotation, tier, seat].join('|'), ...values });
      }
  }
  assert.equal(cases.length, decks.length * (decks.length - 1) / 2 * 16);
  assert.equal(new Set(cases.map(item => item.key)).size, cases.length);
  return { generatedAt: new Date().toISOString(), sourceHash: sourceHash(), excludedCardIds: [...excludedRankingCardIds],
    balanceVersion: CARD_BALANCE_VERSION, rulesVersion: ONLINE_RULES_VERSION, decks, cases, schedule };
}

export function loadRankingPlan(directory: string): RankingPlan {
  const plan = JSON.parse(readFileSync(path.join(directory, 'plan.json'), 'utf8')) as RankingPlan;
  const current = createRankingPlan();
  for (const field of ['sourceHash', 'balanceVersion', 'rulesVersion', 'excludedCardIds', 'decks', 'cases', 'schedule'] as const) {
    assert.deepEqual(plan[field], current[field], `${field} changed; refuse mixed-source results`);
  }
  return plan;
}

export function validateRankingResult(scenario: RankingCase, result: RankingResult): void {
  assert.equal(result.deckAId, scenario.a);
  assert.equal(result.deckBId, scenario.b);
  assert.equal(result.districtSeed, scenario.seed);
  assert.equal(result.rotation, scenario.rotation);
  assert.equal(result.tier, scenario.tier);
  assert.equal(result.seat, scenario.seat);
  const playerId = scenario.seat === 'a-player' ? scenario.a : scenario.b;
  const cpuId = scenario.seat === 'a-player' ? scenario.b : scenario.a;
  assert.equal(result.playerDeckId, playerId);
  assert.equal(result.cpuDeckId, cpuId);
  assert(['a', 'b', 'draw'].includes(result.logicalWinner));
  assert(['player', 'cpu', 'draw'].includes(result.winner));
  const expected = result.winner === 'draw' ? 'draw'
    : (result.winner === 'player' ? playerId : cpuId) === scenario.a ? 'a' : 'b';
  assert.equal(result.logicalWinner, expected, 'Seat-normalized winner mismatch');
}

export function simulateRankingCase(scenario: RankingCase, decks: ReadonlyMap<string, BalanceDeck>): RankingResult {
  const deckA = decks.get(scenario.a), deckB = decks.get(scenario.b);
  assert(deckA && deckB, 'Unknown ranking deck');
  const full = simulateBalanceMatch({
    deckA, deckB, districtSeed: scenario.seed, rotation: scenario.rotation, tier: scenario.tier,
    seat: scenario.seat, policy: policies[scenario.policy], allowSquabble: true,
  });
  validateRankingResult(scenario, full);
  // Outcomes and complete input axes are retained; card telemetry is not needed to rank crews.
  const { cardsA: _cardsA, cardsB: _cardsB, telemetrySchemaVersion: _schema,
    telemetrySemantics: _semantics, effectEvents: _events, ...result } = full;
  return result;
}

/** Reused rows remain identifiable and must exactly match their pinned original evidence. */
export function verifyIncrementalRows(plan: RankingPlan, rows: RankingRow[], reusableRows: RankingRow[]): void {
  const reuse = plan.evidenceReuse;
  assert(reuse, 'Missing evidence-reuse provenance');
  assert.equal(reusableRows.length, reuse.reusedGames);
  assert.equal(reuse.reusedGames + reuse.rerunGames, plan.cases.length);
  const originals = new Map(reusableRows.map(row => [row.caseIndex, row]));
  assert.equal(originals.size, reusableRows.length, 'Duplicate cached case');
  assert.equal(rows.length, plan.cases.length, 'Incomplete incremental evidence');
  const seen = new Set<number>();
  let reused = 0;
  for (const row of rows) {
    assert(Number.isInteger(row.caseIndex) && row.caseIndex >= 0 && row.caseIndex < plan.cases.length);
    assert(!seen.has(row.caseIndex), 'Duplicate incremental case');
    seen.add(row.caseIndex);
    validateRankingResult(plan.cases[row.caseIndex], row.result);
    const original = originals.get(row.caseIndex);
    if (original) {
      assert.equal(original.reusedFrom, undefined, 'Chained reuse is not supported');
      assert.deepEqual(row, { ...original, reusedFrom: reuse.sourceHash }, 'Reused result or provenance changed');
      reused++;
    } else assert.equal(row.reusedFrom, undefined, 'Changed matchup cannot use old results');
  }
  assert.equal(reused, reuse.reusedGames);
}

function runWorker(directory: string, index: number, count: number): void {
  assert(Number.isInteger(count) && count > 0 && Number.isInteger(index) && index >= 0 && index < count);
  const plan = loadRankingPlan(directory);
  assert(!plan.evidenceReuse, 'Use the incremental runner for an evidence-reuse plan');
  const destination = path.join(directory, `worker-${index}.json`);
  assert(!existsSync(destination), 'Refusing to overwrite completed evidence');
  const decks = new Map(plan.decks.map(deck => [deck.id, deck]));
  const rows: RankingRow[] = [];
  const failures: RankingShard['failures'] = [];
  const started = Date.now();
  const planned = Math.ceil((plan.cases.length - index) / count);
  console.log(`ALL_DECKS_START worker=${index} planned=${planned}`);
  for (let caseIndex = index; caseIndex < plan.cases.length; caseIndex += count) {
    const scenario = plan.cases[caseIndex];
    try {
      rows.push({ caseIndex, result: simulateRankingCase(scenario, decks) });
    } catch (error) {
      const message = error instanceof Error ? error.stack ?? error.message : String(error);
      failures.push({ caseIndex, scenario, message });
      console.error(`ALL_DECKS_FAILURE worker=${index} caseIndex=${caseIndex} key=${scenario.key} message=${message}`);
    }
    const completed = rows.length + failures.length;
    if (completed % 128 === 0 || completed === planned) {
      console.log(`ALL_DECKS_PROGRESS worker=${index} completed=${completed}/${planned} failures=${failures.length} elapsedMs=${Date.now() - started}`);
    }
  }
  assert.equal(sourceHash(), plan.sourceHash, 'Source changed during the run');
  assert.equal(rows.length + failures.length, planned);
  const shard: RankingShard = { index, count, sourceHash: plan.sourceHash,
    elapsedMs: Date.now() - started, rows, failures };
  writeFileSync(destination, JSON.stringify(shard) + '\n', { flag: 'wx' });
  console.log(`ALL_DECKS_WORKER_COMPLETE worker=${index} successful=${rows.length} failures=${failures.length}`);
  if (failures.length) process.exitCode = 2;
}

function main(args: string[]): void {
  const [action, directoryArg, index, count] = args;
  assert(directoryArg, 'Usage: all-decks-ranking.ts init <directory> | worker <directory> <index> <count>');
  const directory = path.resolve(root, directoryArg);
  if (action === 'init' && args.length === 2) {
    assert(!existsSync(directory), 'Refusing to overwrite an existing run');
    const plan = createRankingPlan();
    mkdirSync(directory, { recursive: true });
    writeFileSync(path.join(directory, 'plan.json'), JSON.stringify(plan) + '\n', { flag: 'wx' });
    console.log(JSON.stringify({ decks: plan.decks.map(deck => ({ id: deck.id, name: deck.name })),
      planned: plan.cases.length, sourceHash: plan.sourceHash, balanceVersion: plan.balanceVersion }));
  } else if (action === 'worker' && args.length === 4) runWorker(directory, Number(index), Number(count));
  else throw new Error('Invalid ranking arguments');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main(process.argv.slice(2));