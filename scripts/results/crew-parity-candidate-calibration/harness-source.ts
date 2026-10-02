import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { RankingCase, RankingPlan, RankingRow } from './all-decks-ranking';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const FOCUS = ['focused-blue-set', 'focus-detective', 'element-plant', 'element-dark', 'element-earth'];
export const SEEDS = Array.from({ length: 4 }, (_, i) => `crew-parity-v36-holdout-${String(i + 1).padStart(2, '0')}`);
export const BASE_HASH = '2f2060093f84c46998ed52ff3e06e3c9a70ade5415254c348b3b0aa6d6c0dc05';
const BASE = path.join(ROOT, 'scripts/results/all-decks-v35-no-guap');
const FROZEN = path.join(ROOT, '.local/crew-parity-v35-source');
const PROTOCOL = path.join(ROOT, 'scripts/results/crew-parity-protocol');
const script = fileURLToPath(import.meta.url);
export const digest = (value: string | Buffer): string => createHash('sha256').update(value).digest('hex');
const json = <T>(file: string): T => JSON.parse(readFileSync(file, 'utf8')) as T;
const save = (file: string, value: unknown): void => {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
};
type Archive = { sourceHash: string; sourceFiles: string[]; supportFiles: string[]; files: Record<string, string>; root: string };
type Binding = { module: string; resolved: string };
type Provenance = { sourceRoot: string; sourceHash: string; files: Record<string, string>; bindings: Binding[] };
export type Plan = RankingPlan & {
  protocol: 'crew-parity-paired-v1'; arm: 'before' | 'candidate'; block: 'calibration' | 'holdout';
  focusIds: string[]; harnessHash: string; protocolHash: string;
  provenance: Provenance; baselineFiles: Record<string, string>;
};
export type Shard = {
  index: number; count: number; sourceHash: string; harnessHash: string; planHash: string;
  protocolHash: string; elapsedMs: number; rows: RankingRow[]; failures: unknown[];
};
type Runtime = typeof import('./all-decks-ranking');
const baseline = (): RankingPlan => json(path.join(BASE, 'plan.json'));
const baselineFiles = (): Record<string, string> => Object.fromEntries(readdirSync(BASE).sort()
  .map(name => [name, digest(readFileSync(path.join(BASE, name)))]));
const harnessHash = (): string => digest(readFileSync(script));
const protocolHash = (): string => digest(readFileSync(path.join(PROTOCOL, 'baseline-ready.json')));

/** Canonical full-league orientation is retained; mutual target pairs occur once. */
export function casesFor(decks: RankingPlan['decks'], schedule: RankingPlan['schedule']): RankingCase[] {
  const cases: RankingCase[] = [];
  for (let a = 0; a < decks.length; a++) for (let b = a + 1; b < decks.length; b++) {
    if (!FOCUS.includes(decks[a].id) && !FOCUS.includes(decks[b].id)) continue;
    for (const policy of schedule.policies) for (const seed of schedule.seeds)
      for (const rotation of schedule.rotations) for (const tier of schedule.tiers) for (const seat of schedule.seats) {
        const axes = { a: decks[a].id, b: decks[b].id, policy, seed, rotation, tier, seat };
        cases.push({ ...axes, key: [axes.a, axes.b, policy, seed, rotation, tier, seat].join('|') });
      }
  }
  return cases;
}

export function validatePlan(plan: Plan): void {
  const original = baseline();
  assert.equal(plan.protocol, 'crew-parity-paired-v1');
  assert(['before', 'candidate'].includes(plan.arm));
  assert(['calibration', 'holdout'].includes(plan.block));
  assert.equal(plan.evidenceReuse, undefined);
  assert.deepEqual(plan.focusIds, FOCUS);
  assert.deepEqual(plan.decks, original.decks, 'Complete ordered rosters/IDs/order keys changed');
  assert.equal(plan.decks.length, 37);
  assert.equal(new Set(plan.decks.map(d => d.id)).size, 37);
  assert.deepEqual(plan.excludedCardIds, ['guap']);
  for (const d of plan.decks) {
    assert.equal(d.cardIds.length, 10);
    assert.equal(new Set(d.cardIds).size, 10);
    assert(!d.cardIds.includes('guap'));
  }
  assert.deepEqual(plan.schedule, { ...original.schedule, seeds: plan.block === 'holdout' ? SEEDS : original.schedule.seeds });
  assert.deepEqual(original.schedule, {
    seeds: ['all-decks-ranking-fresh-a', 'all-decks-ranking-fresh-b'],
    rotations: [0], tiers: [0, 3], seats: ['a-player', 'b-player'],
    policies: ['greedy', 'seeded-legal'], allowSquabble: true,
  });
  assert.deepEqual(plan.cases, casesFor(plan.decks, plan.schedule), 'Incomplete or mixed case keys');
  assert.equal(new Set(plan.cases.map(c => c.key)).size, plan.cases.length);
  assert.equal(plan.cases.length, plan.block === 'holdout' ? 5440 : 2720);
  for (const id of FOCUS) assert.equal(plan.cases.filter(c => c.a === id || c.b === id).length,
    plan.block === 'holdout' ? 1152 : 576);
  assert.equal(plan.provenance.sourceHash, plan.sourceHash);
  if (plan.arm === 'before') {
    assert.equal(plan.sourceHash, BASE_HASH);
    assert.equal(plan.balanceVersion, 35); assert.equal(plan.rulesVersion, 35);
    assert.equal(plan.provenance.sourceRoot, FROZEN);
  }
}

async function runtime(sourceRoot: string): Promise<Runtime> {
  return await import(pathToFileURL(path.join(sourceRoot, 'scripts/src/all-decks-ranking.ts')).href) as Runtime;
}

/** Probe resolution from BOTH importers: ranking and the dynamically imported web data. */
function bindings(sourceRoot: string): Binding[] {
  const result: Binding[] = [];
  for (const importer of ['scripts/src/all-decks-ranking.ts', 'artifacts/squabblemon/src/data.ts']) {
    for (const name of ['data', 'balanceLab', 'multiplayer']) {
      const module = `@workspace/squabblemon-engine/${name}`;
      // import.meta.resolve's parent parameter is not enabled on all Node versions.
      // createRequire.resolve uses the same package exports and importer ancestry.
      const resolved = realpathSync(resolveFrom(path.join(sourceRoot, importer), module));
      assert.equal(resolved, path.join(sourceRoot, 'lib/squabblemon-engine/src', `${name}.ts`),
        `Import contamination: ${importer} ${module}`);
      result.push({ module: `${importer}:${module}`, resolved });
    }
  }
  return result;
}

import { createRequire } from 'node:module';
const resolveFrom = (importer: string, module: string): string => createRequire(importer).resolve(module);

async function provenance(sourceRoot: string): Promise<Provenance> {
  const manifest = json<Archive>(path.join(FROZEN, 'source-archive.json'));
  const files = Object.fromEntries([...manifest.sourceFiles, ...manifest.supportFiles, 'package.json'].sort()
    .map(file => [file, digest(readFileSync(path.join(sourceRoot, file)))]));
  const r = await runtime(sourceRoot);
  return { sourceRoot, sourceHash: r.sourceHash(), files, bindings: bindings(sourceRoot) };
}

async function ready(): Promise<void> {
  const archive = json<Archive>(path.join(FROZEN, 'source-archive.json'));
  assert.equal(archive.sourceHash, BASE_HASH);
  for (const [file, hash] of Object.entries(archive.files))
    assert.equal(digest(readFileSync(path.join(FROZEN, file))), hash, `Frozen archive changed: ${file}`);
  const r = await runtime(FROZEN), p = r.createRankingPlan(), old = baseline();
  assert.equal(r.sourceHash(), BASE_HASH);
  assert.equal(old.sourceHash, BASE_HASH);
  for (const field of ['decks', 'cases', 'schedule', 'excludedCardIds', 'balanceVersion', 'rulesVersion'] as const)
    assert.deepEqual(p[field], old[field]);
  assert.equal(p.balanceVersion, 35); assert.equal(p.rulesVersion, 35);
  assert.equal(p.decks.length, 37);
  // Seed declaration is made before any outcome access. Scan existing plans only.
  function checkPlans(directory: string): void {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) checkPlans(file);
      else if (entry.name === 'plan.json') {
        const contents = readFileSync(file, 'utf8');
        assert(SEEDS.every(seed => !contents.includes(seed)), `Holdout seed already planned: ${file}`);
      }
    }
  }
  checkPlans(path.join(ROOT, 'scripts/results'));
  const bound = await provenance(FROZEN);
  assert.deepEqual(bound.files, { ...archive.files, 'package.json': digest(readFileSync(path.join(FROZEN, 'package.json'))) });
  save(path.join(PROTOCOL, 'baseline-ready.json'), {
    ready: true, createdAt: new Date().toISOString(), sourceHash: BASE_HASH,
    balanceVersion: 35, rulesVersion: 35, focusIds: FOCUS, holdoutSeeds: SEEDS,
    holdoutCasesPerArm: 5440, holdoutAppearancesPerSubject: 1152,
    calibrationCasesPerArm: 2720, historicalCalibrationOnly: true,
    archiveHash: digest(readFileSync(path.join(FROZEN, 'source-archive.json'))),
    provenance: bound, baselineFiles: baselineFiles(),
  });
  console.log('CREW_PARITY_BASELINE_READY');
}

async function createPlan(arm: Plan['arm'], block: Plan['block']): Promise<Plan> {
  const declaration = json<{ ready: boolean; sourceHash: string; archiveHash: string;
    provenance: Provenance; baselineFiles: Record<string, string>; focusIds: string[]; holdoutSeeds: string[] }>(
    path.join(PROTOCOL, 'baseline-ready.json'));
  assert.equal(declaration.ready, true);
  assert.equal(declaration.sourceHash, BASE_HASH);
  assert.deepEqual(declaration.focusIds, FOCUS);
  assert.deepEqual(declaration.holdoutSeeds, SEEDS);
  assert.equal(digest(readFileSync(path.join(FROZEN, 'source-archive.json'))), declaration.archiveHash,
    'Frozen original archive provenance changed');
  assert.deepEqual(baselineFiles(), declaration.baselineFiles, 'Immutable historical evidence changed');
  assert.deepEqual(await provenance(FROZEN), declaration.provenance, 'Frozen baseline source or dependency binding changed');
  const original = baseline(), sourceRoot = arm === 'before' ? FROZEN : ROOT;
  const r = await runtime(sourceRoot), p = r.createRankingPlan();
  assert.deepEqual(p.decks, original.decks, 'Gameplay edit changed comparison rosters');
  if (arm === 'candidate' && block === 'holdout') await assertFinalCandidate();
  const schedule = { ...original.schedule, seeds: block === 'holdout' ? [...SEEDS] : [...original.schedule.seeds] };
  const plan: Plan = { ...p, decks: original.decks, schedule, cases: casesFor(original.decks, schedule),
    protocol: 'crew-parity-paired-v1', arm, block, focusIds: [...FOCUS], harnessHash: harnessHash(),
    protocolHash: protocolHash(), provenance: await provenance(sourceRoot), baselineFiles: baselineFiles() };
  validatePlan(plan);
  return plan;
}

async function freezeCandidate(): Promise<void> {
  const r = await runtime(ROOT), p = r.createRankingPlan(), bound = await provenance(ROOT);
  assert.notEqual(p.sourceHash, BASE_HASH, 'Candidate still matches v35');
  assert.deepEqual(p.decks, baseline().decks);
  assert.equal(p.balanceVersion, 36); assert.equal(p.rulesVersion, 36);
  save(path.join(PROTOCOL, 'candidate-frozen.json'), {
    frozenAt: new Date().toISOString(), balanceVersion: p.balanceVersion, rulesVersion: p.rulesVersion,
    protocolHash: protocolHash(), harnessHash: harnessHash(), provenance: bound,
    sources: Object.fromEntries(Object.keys(bound.files).map(file => [file, readFileSync(path.join(ROOT, file), 'utf8')])),
  });
  await assertFinalCandidate();
  console.log('CREW_PARITY_CANDIDATE_FROZEN');
}

async function assertFinalCandidate(): Promise<void> {
  const marker = json<{ provenance: Provenance; protocolHash: string; harnessHash: string;
    sources: Record<string, string> }>(path.join(PROTOCOL, 'candidate-frozen.json'));
  assert.equal(marker.protocolHash, protocolHash());
  assert.equal(marker.harnessHash, harnessHash());
  assert.deepEqual(await provenance(ROOT), marker.provenance, 'Final candidate changed after freeze');
  assert.deepEqual(Object.keys(marker.sources).sort(), Object.keys(marker.provenance.files).sort());
  for (const [file, text] of Object.entries(marker.sources)) assert.equal(digest(text), marker.provenance.files[file]);
}

async function load(directory: string): Promise<Plan> {
  const plan = json<Plan>(path.join(directory, 'plan.json'));
  const current = await createPlan(plan.arm, plan.block);
  assert.deepEqual({ ...plan, generatedAt: '' }, { ...current, generatedAt: '' },
    'Source, resolution, archive, harness, protocol, baseline or schedule changed');
  const archive = json<Provenance & { sources: Record<string, string> }>(path.join(directory, 'source-archive.json'));
  assert.deepEqual({ sourceRoot: archive.sourceRoot, sourceHash: archive.sourceHash, files: archive.files, bindings: archive.bindings },
    plan.provenance);
  assert.deepEqual(Object.keys(archive.sources).sort(), Object.keys(archive.files).sort());
  for (const [file, text] of Object.entries(archive.sources)) assert.equal(digest(text), archive.files[file]);
  assert.equal(digest(readFileSync(path.join(directory, 'harness-source.ts'))), plan.harnessHash);
  return plan;
}

async function init(directory: string, arm: Plan['arm'], block: Plan['block']): Promise<void> {
  assert(!existsSync(directory), 'Refuse existing evidence directory');
  assert(!(arm === 'before' && block === 'calibration'), 'Historical calibration must not be rerun');
  const plan = await createPlan(arm, block);
  mkdirSync(directory, { recursive: true });
  save(path.join(directory, 'plan.json'), plan);
  save(path.join(directory, 'source-archive.json'), { ...plan.provenance,
    sources: Object.fromEntries(Object.keys(plan.provenance.files).map(file =>
      [file, readFileSync(path.join(plan.provenance.sourceRoot, file), 'utf8')])) });
  writeFileSync(path.join(directory, 'harness-source.ts'), readFileSync(script), { flag: 'wx' });
  await load(directory);
  console.log(`CREW_PARITY_INIT arm=${arm} block=${block} cases=${plan.cases.length}`);
}

async function worker(directory: string, index: number, count: number): Promise<void> {
  assert(Number.isInteger(count) && count > 0 && Number.isInteger(index) && index >= 0 && index < count);
  const plan = await load(directory);
  const destination = path.join(directory, `worker-${index}.json`);
  assert(!existsSync(destination), 'Refuse overwrite');
  // An exclusive claim prevents concurrent duplicate workers, even before completion.
  writeFileSync(path.join(directory, `worker-${index}.claim`), `${process.pid}\n`, { flag: 'wx' });
  const planHash = digest(readFileSync(path.join(directory, 'plan.json')));
  const r = await runtime(plan.provenance.sourceRoot);
  const rows: RankingRow[] = [], failures: unknown[] = [], started = Date.now();
  const decks = new Map(plan.decks.map(d => [d.id, d]));
  for (let caseIndex = index; caseIndex < plan.cases.length; caseIndex += count) {
    try { rows.push({ caseIndex, result: r.simulateRankingCase(plan.cases[caseIndex], decks) }); }
    catch (error) { failures.push({ caseIndex, key: plan.cases[caseIndex].key, message: String(error) }); }
    if ((rows.length + failures.length) % 128 === 0) console.log(`PROGRESS worker=${index} cases=${rows.length + failures.length}`);
  }
  await load(directory);
  assert.equal(digest(readFileSync(path.join(directory, 'plan.json'))), planHash);
  save(destination, { index, count, sourceHash: plan.sourceHash, harnessHash: plan.harnessHash,
    protocolHash: plan.protocolHash, planHash, elapsedMs: Date.now() - started, rows, failures } satisfies Shard);
  console.log(`COMPLETE worker=${index} cases=${rows.length} failures=${failures.length}`);
  if (failures.length) process.exitCode = 2;
}

/** Foreground supervisor, intended for the shell tool's explicit background task mode. */
async function workers(directory: string, count: number): Promise<void> {
  assert.equal(count, 7, 'Protocol uses seven workers');
  await load(directory);
  const statuses = await Promise.all(Array.from({ length: count }, (_, index) => new Promise<number>((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', 'tsx', script, 'worker', path.relative(ROOT, directory),
      String(index), String(count)], { cwd: path.join(ROOT, 'scripts'), stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (signal) reject(Error(`Worker ${index} terminated: ${signal}`));
      else resolve(code ?? 1);
    });
  })));
  assert(statuses.every(code => code === 0), 'One or more workers failed; results are not accepted');
  // Validate completeness without aggregating or displaying outcome scores.
  await accepted(directory);
  console.log('CREW_PARITY_ALL_WORKERS_COMPLETE workers=7 complete=true');
}

export function merge(plan: Plan, shards: Shard[], count: number, planHash: string,
  validate: Runtime['validateRankingResult']): RankingRow[] {
  validatePlan(plan);
  assert(Number.isInteger(count) && count > 0);
  assert.equal(shards.length, count, 'Partial evidence');
  assert.equal(new Set(shards.map(s => s.index)).size, count, 'Duplicate workers');
  for (const s of shards) {
    assert(Number.isInteger(s.index) && s.index >= 0 && s.index < count);
    assert.equal(s.count, count);
    for (const field of ['sourceHash', 'harnessHash', 'protocolHash'] as const) assert.equal(s[field], plan[field], `Mixed ${field}`);
    assert.equal(s.planHash, planHash, 'Mixed plan');
    assert(Number.isFinite(s.elapsedMs) && s.elapsedMs >= 0);
    assert.equal(s.failures.length, 0, 'Failed evidence');
    assert.deepEqual(s.rows.map(row => row.caseIndex), plan.cases.map((_, i) => i).filter(i => i % count === s.index),
      'Missing, duplicate, misplaced or reordered rows');
    for (const row of s.rows) {
      assert.equal(row.reusedFrom, undefined, 'Fresh evidence reused');
      validate(plan.cases[row.caseIndex], row.result);
      assert.equal(row.result.districtIds.length, 3);
      assert(row.result.districtIds.every(id => typeof id === 'string' && id.length > 0));
    }
  }
  return shards.flatMap(s => s.rows).sort((a, b) => a.caseIndex - b.caseIndex);
}

async function accepted(directory: string): Promise<{ plan: Plan; rows: RankingRow[]; files: Record<string, string> }> {
  const plan = await load(directory);
  const files = readdirSync(directory).filter(n => /^worker-.*\.json$/.test(n)).sort();
  assert(files.length > 0);
  assert.deepEqual(files, Array.from({ length: files.length }, (_, i) => `worker-${i}.json`).sort());
  const shards = files.map(name => {
    const s = json<Shard>(path.join(directory, name)); assert.equal(name, `worker-${s.index}.json`); return s;
  });
  const r = await runtime(plan.provenance.sourceRoot);
  return { plan, rows: merge(plan, shards, shards.length, digest(readFileSync(path.join(directory, 'plan.json'))), r.validateRankingResult),
    files: Object.fromEntries(['plan.json', 'source-archive.json', 'harness-source.ts', ...files].map(name =>
      [name, digest(readFileSync(path.join(directory, name)))])) };
}

/** Read the original 10,656 cases only as historical calibration BEFORE. */
async function historical(): Promise<{ plan: Plan; rows: RankingRow[]; files: Record<string, string> }> {
  const old = baseline(), r = await runtime(FROZEN), plan = await createPlan('before', 'calibration');
  assert.equal(old.sourceHash, BASE_HASH);
  const names = readdirSync(BASE).filter(n => /^worker-.*\.json$/.test(n)).sort();
  assert.deepEqual(names, Array.from({ length: 7 }, (_, i) => `worker-${i}.json`).sort());
  const rows: RankingRow[] = [];
  for (const name of names) {
    const shard = json<{ index: number; count: number; sourceHash: string; failures: unknown[]; rows: RankingRow[] }>(path.join(BASE, name));
    assert.equal(name, `worker-${shard.index}.json`); assert.equal(shard.count, 7);
    assert.equal(shard.sourceHash, BASE_HASH); assert.equal(shard.failures.length, 0);
    assert.deepEqual(shard.rows.map(row => row.caseIndex), old.cases.map((_, i) => i).filter(i => i % 7 === shard.index));
    for (const row of shard.rows) {
      assert.equal(row.reusedFrom, undefined); r.validateRankingResult(old.cases[row.caseIndex], row.result);
      rows.push(row);
    }
  }
  assert.equal(rows.length, old.cases.length);
  const byKey = new Map(rows.map(row => [old.cases[row.caseIndex].key, row.result]));
  assert.equal(byKey.size, old.cases.length);
  return { plan, rows: plan.cases.map((c, caseIndex) => { const result = byKey.get(c.key); assert(result); return { caseIndex, result }; }),
    files: baselineFiles() };
}

export function paired(plan: Plan, before: RankingRow[], after: RankingRow[]) {
  assert.equal(before.length, plan.cases.length); assert.equal(after.length, before.length);
  assert.deepEqual(before.map(r => r.caseIndex), plan.cases.map((_, i) => i));
  assert.deepEqual(after.map(r => r.caseIndex), before.map(r => r.caseIndex));
  const score = (row: RankingRow, id: string): number => row.result.logicalWinner === 'draw' ? 0.5
    : plan.cases[row.caseIndex][row.result.logicalWinner] === id ? 1 : 0;
  const rate = (values: number[]) => {
    const wins = values.filter(s => s === 1).length, draws = values.filter(s => s === 0.5).length;
    return { games: values.length, wins, losses: values.length - wins - draws, draws,
      score: wins + draws / 2, scoreRate: (wins + draws / 2) / values.length };
  };
  return FOCUS.map(id => {
    const split = (predicate: (c: RankingCase) => boolean) => {
      const indices = plan.cases.map((c, i) => ({ c, i })).filter(({ c }) => (c.a === id || c.b === id) && predicate(c)).map(({ i }) => i);
      assert(indices.length > 0);
      const b = indices.map(i => score(before[i], id)), a = indices.map(i => score(after[i], id));
      const beforeRate = rate(b), afterRate = rate(a);
      return { before: beforeRate, after: afterRate, deltaScorePoints: afterRate.score - beforeRate.score,
        deltaPercentagePoints: 100 * (afterRate.scoreRate - beforeRate.scoreRate),
        pairedImproved: a.filter((s, i) => s > b[i]).length,
        pairedWorsened: a.filter((s, i) => s < b[i]).length,
        pairedUnchanged: a.filter((s, i) => s === b[i]).length,
        transitions: Object.fromEntries([0, 0.5, 1].flatMap(x => [0, 0.5, 1].map(y =>
          [`${x}->${y}`, a.filter((s, i) => b[i] === x && s === y).length]))) };
    };
    const mutual = (c: RankingCase) => FOCUS.includes(c.a) && FOCUS.includes(c.b);
    return { deckId: id, all: split(() => true), shared32NonfocusOpponents: split(c => !mutual(c)),
      mutualTargetMatches: split(mutual),
      byTier: plan.schedule.tiers.map(tier => ({ tier, label: tier === 0 ? 'base' : 'upgraded', ...split(c => c.tier === tier) })),
      byPolicy: plan.schedule.policies.map(policy => ({ policy, ...split(c => c.policy === policy) })),
      bySeat: (['player', 'cpu'] as const).map(seat => ({ seat,
        ...split(c => ((c.a === id) === (c.seat === 'a-player')) === (seat === 'player')) })),
      bySeed: plan.schedule.seeds.map(seed => ({ seed, ...split(c => c.seed === seed) })),
      byOpponent: plan.decks.filter(d => d.id !== id).map(d => ({ opponent: d.id,
        ...split(c => c.a === d.id || c.b === d.id) })),
    };
  });
}

async function report(beforeDir: string, candidateDir: string, output: string): Promise<void> {
  assert(!existsSync(output), 'Refuse existing report');
  const candidate = await accepted(candidateDir);
  assert.equal(candidate.plan.arm, 'candidate');
  if (candidate.plan.block === 'holdout') await assertFinalCandidate();
  const before = beforeDir === 'historical' ? await historical() : await accepted(beforeDir);
  assert.equal(before.plan.arm, 'before');
  for (const field of ['block', 'decks', 'cases', 'schedule', 'focusIds', 'harnessHash', 'protocolHash', 'baselineFiles'] as const)
    assert.deepEqual(before.plan[field], candidate.plan[field], `Unpaired ${field}`);
  const subjects = paired(candidate.plan, before.rows, candidate.rows);
  const summary = { protocol: candidate.plan.protocol, block: candidate.plan.block,
    uniqueCasesPerArm: candidate.rows.length, historicalBefore: beforeDir === 'historical',
    before: { sourceHash: before.plan.sourceHash, provenance: before.plan.provenance, evidenceHashes: before.files },
    candidate: { sourceHash: candidate.plan.sourceHash, provenance: candidate.plan.provenance, evidenceHashes: candidate.files },
    harnessHash: candidate.plan.harnessHash, protocolHash: candidate.plan.protocolHash,
    finalCandidateMarkerHash: candidate.plan.block === 'holdout'
      ? digest(readFileSync(path.join(PROTOCOL, 'candidate-frozen.json'))) : null,
    pairing: 'Identical keys, complete ordered rosters, engine IDs, order keys, canonical A/B and all axes',
    limitations: ['Fixed-crew greedy and seeded-legal bot scores; draws are half a point, not human winrates.',
      'Does not rerank 37 crews, optimize decks, or establish causal strength of individual cards.',
      '32 nonfocus/shared opponents are separated from mutual target matches; mutual pairs simulated once.',
      'Calibration is tuning/historical data; predeclared holdout must remain unopened until the final candidate is frozen.',
      'Seed labels do not imply unique district layouts or independent samples. GUAP excluded; SQUABBLE enabled.'],
    subjects };
  // Preserve same-key paired outcomes as auditable evidence, not just aggregate rates.
  const pairedRows = candidate.plan.cases.map((c, i) => ({ key: c.key, before: before.rows[i].result,
    candidate: candidate.rows[i].result }));
  save(path.join(output, 'paired-cases.json'), pairedRows);
  save(path.join(output, 'summary.json'), summary);
  save(path.join(output, 'evidence-manifest.json'), {
    summaryHash: digest(readFileSync(path.join(output, 'summary.json'))),
    pairedCasesHash: digest(readFileSync(path.join(output, 'paired-cases.json'))),
    before: before.files, candidate: candidate.files });
  console.log(`CREW_PARITY_REPORT_COMPLETE cases=${candidate.rows.length}`);
}

function evidencePath(value: string): string {
  const directory = path.resolve(ROOT, value);
  assert(path.relative(path.join(ROOT, 'scripts/results'), directory).startsWith('crew-parity-'),
    'Only new scripts/results/crew-parity-* output is allowed');
  return directory;
}
async function main(args: string[]): Promise<void> {
  const [action, a, b, c] = args;
  if (action === 'ready' && args.length === 1) await ready();
  else if (action === 'freeze-candidate' && args.length === 1) await freezeCandidate();
  else if (action === 'init' && args.length === 4) {
    assert(b === 'before' || b === 'candidate'); assert(c === 'holdout' || c === 'calibration');
    await init(evidencePath(a), b, c);
  } else if (action === 'worker' && args.length === 4) await worker(evidencePath(a), Number(b), Number(c));
  else if (action === 'workers' && args.length === 3) await workers(evidencePath(a), Number(b));
  else if (action === 'report' && args.length === 4)
    await report(a === 'historical' ? a : evidencePath(a), evidencePath(b), evidencePath(c));
  else throw Error('Usage: ready | freeze-candidate | init <directory> <before|candidate> <calibration|holdout> | worker <directory> <index> <count> | workers <directory> 7 | report <beforeDirectory|historical> <candidateDirectory> <newReportDirectory>');
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  await main(process.argv.slice(2));