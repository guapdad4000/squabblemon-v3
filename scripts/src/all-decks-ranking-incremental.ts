import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import {
  createRankingPlan, loadRankingPlan, root, simulateRankingCase, sourceHash, validateRankingResult,
  verifyIncrementalRows, type RankingPlan, type RankingRow, type RankingShard,
} from './all-decks-ranking';
import { mergeRankingShards, writeRankingReport } from './all-decks-ranking-report';

export { verifyIncrementalRows } from './all-decks-ranking';
const digest = (content: string): string => createHash('sha256').update(content).digest('hex');
const cacheFile = 'reused-evidence.json';

/** Labels/IDs, full ordered rosters, draw keys and every scheduled axis must match. */
export function selectReusableRows(previous: RankingPlan, current: RankingPlan, rows: RankingRow[]): RankingRow[] {
  for (const field of ['balanceVersion', 'rulesVersion', 'schedule', 'cases'] as const)
    assert.deepEqual(previous[field], current[field], `${field} changed; cannot reuse evidence`);
  assert.equal(rows.length, previous.cases.length, 'Incomplete original evidence');
  assert.equal(new Set(rows.map(row => row.caseIndex)).size, rows.length, 'Duplicate original case');
  const unchanged = new Set(current.decks.filter(deck =>
    isDeepStrictEqual(deck, previous.decks.find(original => original.id === deck.id))).map(deck => deck.id));
  return rows.filter(row => {
    assert(Number.isInteger(row.caseIndex) && row.caseIndex >= 0 && row.caseIndex < previous.cases.length);
    assert.equal(row.reusedFrom, undefined, 'Chained reuse is not supported');
    const scenario = previous.cases[row.caseIndex];
    validateRankingResult(scenario, row.result);
    return unchanged.has(scenario.a) && unchanged.has(scenario.b);
  });
}

/** Reconstruct the original audit hash: only its two archived harness files may differ. */
function verifyOriginalSource(directory: string, plan: RankingPlan): void {
  const archived = JSON.parse(readFileSync(path.join(directory, 'runner-sources.json'), 'utf8')) as {
    sourceHash: string; sources: Record<string, string>;
  };
  const harness = ['scripts/src/all-decks-ranking.ts', 'scripts/src/all-decks-ranking-decks.ts'];
  assert.equal(archived.sourceHash, plan.sourceHash);
  assert.deepEqual(Object.keys(archived.sources).sort(), [...harness].sort(), 'Unsupported original harness archive');
  const files = [...harness, 'scripts/src/element-balance-audit-decks.ts',
    'artifacts/squabblemon/src/lib/deckWorkshop.ts', 'artifacts/squabblemon/src/data.ts'].map(file => path.join(root, file));
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (file.endsWith('.ts')) files.push(file);
    }
  };
  visit(path.join(root, 'lib/squabblemon-engine/src'));
  const hash = createHash('sha256');
  for (const file of files.sort()) {
    const relative = path.relative(root, file);
    hash.update(relative).update('\0').update(archived.sources[relative] ?? readFileSync(file)).update('\0');
  }
  assert.equal(hash.digest('hex'), plan.sourceHash, 'Engine or shared inputs changed; run a fresh full league');
}

function init(directory: string, sourceDirectory: string): void {
  assert(!existsSync(directory), 'Refusing to overwrite an existing run');
  const sourcePlanText = readFileSync(path.join(sourceDirectory, 'plan.json'), 'utf8');
  const previous = JSON.parse(sourcePlanText) as RankingPlan;
  assert(!previous.evidenceReuse, 'Chained reuse is not supported');
  verifyOriginalSource(sourceDirectory, previous);
  const summary = JSON.parse(readFileSync(path.join(sourceDirectory, 'summary.json'), 'utf8')) as {
    sourceHash: string; planHash: string; workerCount: number; workers: { index: number; evidenceHash: string }[];
  };
  assert.equal(summary.sourceHash, previous.sourceHash);
  assert.equal(summary.planHash, digest(sourcePlanText), 'Original plan changed');
  assert(Number.isSafeInteger(summary.workerCount) && summary.workerCount > 0);
  const files = readdirSync(sourceDirectory).filter(file => /^worker-.*\.json$/.test(file)).sort();
  assert.deepEqual(files, Array.from({ length: summary.workerCount }, (_, i) => `worker-${i}.json`).sort());
  const texts = files.map(file => readFileSync(path.join(sourceDirectory, file), 'utf8'));
  const shards = texts.map((text, i) => {
    const shard = JSON.parse(text) as RankingShard;
    assert.equal(files[i], `worker-${shard.index}.json`);
    assert.equal(digest(text), summary.workers.find(worker => worker.index === shard.index)?.evidenceHash,
      'Original worker evidence changed');
    return shard;
  });
  const rows = mergeRankingShards(previous, shards, summary.workerCount);
  const plan = createRankingPlan();
  const reusable = selectReusableRows(previous, plan, rows);
  const cache = JSON.stringify(reusable) + '\n';
  plan.evidenceReuse = {
    sourceDirectory: path.relative(root, sourceDirectory), sourceHash: previous.sourceHash,
    sourcePlanHash: digest(sourcePlanText), sourceWorkerHashes: texts.map(digest),
    cacheHash: digest(cache), reusedGames: reusable.length, rerunGames: plan.cases.length - reusable.length,
  };
  assert.equal(sourceHash(), plan.sourceHash, 'Source changed while preparing the run');
  mkdirSync(directory, { recursive: true });
  writeFileSync(path.join(directory, cacheFile), cache, { flag: 'wx' });
  writeFileSync(path.join(directory, 'plan.json'), JSON.stringify(plan) + '\n', { flag: 'wx' });
  const sourceFiles = ['scripts/src/all-decks-ranking.ts', 'scripts/src/all-decks-ranking-decks.ts',
    'scripts/src/all-decks-ranking-incremental.ts'];
  writeFileSync(path.join(directory, 'runner-sources.json'), JSON.stringify({
    sourceHash: plan.sourceHash,
    sources: Object.fromEntries(sourceFiles.map(file => [file, readFileSync(path.join(root, file), 'utf8')])),
  }, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ event: 'GUAP_FREE_INIT', decks: plan.decks.length,
    excludedCardIds: plan.excludedCardIds, reused: reusable.length, rerun: plan.evidenceReuse.rerunGames,
    sourceHash: plan.sourceHash }));
}

function readCache(directory: string, plan: RankingPlan): RankingRow[] {
  assert(plan.evidenceReuse, 'Missing reuse metadata');
  const text = readFileSync(path.join(directory, cacheFile), 'utf8');
  assert.equal(digest(text), plan.evidenceReuse.cacheHash, 'Cached evidence changed');
  const rows = JSON.parse(text) as RankingRow[];
  assert.equal(rows.length, plan.evidenceReuse.reusedGames);
  assert.equal(new Set(rows.map(row => row.caseIndex)).size, rows.length);
  for (const row of rows) {
    assert.equal(row.reusedFrom, undefined);
    validateRankingResult(plan.cases[row.caseIndex], row.result);
  }
  return rows;
}

function worker(directory: string, index: number, count: number): void {
  assert(Number.isInteger(count) && count > 0 && Number.isInteger(index) && index >= 0 && index < count);
  const plan = loadRankingPlan(directory);
  const reusable = new Map(readCache(directory, plan).map(row => [row.caseIndex, row]));
  const destination = path.join(directory, `worker-${index}.json`);
  assert(!existsSync(destination), 'Refusing to overwrite completed evidence');
  const decks = new Map(plan.decks.map(deck => [deck.id, deck]));
  const rows: RankingRow[] = [], failures: RankingShard['failures'] = [];
  const started = Date.now();
  let simulated = 0, reused = 0;
  for (let caseIndex = index; caseIndex < plan.cases.length; caseIndex += count) {
    const scenario = plan.cases[caseIndex], cached = reusable.get(caseIndex);
    try {
      if (cached) {
        rows.push({ ...cached, reusedFrom: plan.evidenceReuse!.sourceHash });
        reused++;
      } else {
        rows.push({ caseIndex, result: simulateRankingCase(scenario, decks) });
        simulated++;
        if (simulated % 32 === 0) console.log(`GUAP_FREE_PROGRESS worker=${index} simulated=${simulated} reused=${reused} failures=${failures.length}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.stack ?? error.message : String(error);
      failures.push({ caseIndex, scenario, message });
      console.error(`GUAP_FREE_FAILURE worker=${index} caseIndex=${caseIndex} message=${message}`);
    }
  }
  assert.equal(sourceHash(), plan.sourceHash, 'Source changed during the run');
  assert.equal(rows.length + failures.length, Math.ceil((plan.cases.length - index) / count));
  // Verify the cached input remained unchanged throughout execution.
  readCache(directory, plan);
  const shard: RankingShard = { index, count, sourceHash: plan.sourceHash,
    elapsedMs: Date.now() - started, rows, failures };
  writeFileSync(destination, JSON.stringify(shard) + '\n', { flag: 'wx' });
  console.log(`GUAP_FREE_WORKER_COMPLETE worker=${index} simulated=${simulated} reused=${reused} failures=${failures.length}`);
  if (failures.length) process.exitCode = 2;
}

function report(directory: string, count: number): void {
  const plan = loadRankingPlan(directory);
  const shards = Array.from({ length: count }, (_, i) =>
    JSON.parse(readFileSync(path.join(directory, `worker-${i}.json`), 'utf8')) as RankingShard);
  const rows = mergeRankingShards(plan, shards, count);
  verifyIncrementalRows(plan, rows, readCache(directory, plan));
  writeRankingReport(directory, count);
}

function directory(argument: string | undefined): string {
  assert(argument && !path.isAbsolute(argument), 'Expected a workspace-relative directory');
  const result = path.resolve(root, argument);
  assert(!path.relative(root, result).startsWith('..'), 'Directory must remain inside the workspace');
  return result;
}

function main(args: string[]): void {
  const [action, destination, argument, count] = args;
  if (action === 'init' && args.length === 3) init(directory(destination), directory(argument));
  else if (action === 'worker' && args.length === 4) worker(directory(destination), Number(argument), Number(count));
  else if (action === 'report' && args.length === 3) report(directory(destination), Number(argument));
  else throw new Error('Usage: all-decks-ranking-incremental.ts init <directory> <original-directory> | worker <directory> <index> <count> | report <directory> <count>');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main(process.argv.slice(2));