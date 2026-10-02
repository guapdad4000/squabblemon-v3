import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cards } from '@workspace/squabblemon-engine/data';
import {
  createDefaultBalanceDecks,
  greedyBalancePolicy,
  seededLegalBalancePolicy,
  simulateBalanceMatch,
  type BalanceDeck,
  type BalanceMatchResult,
  type BalanceSeat,
  type BalanceTier,
} from '@workspace/squabblemon-engine/balanceLab';
import { getEffectiveCardPower, type Match, type Owner } from '@workspace/squabblemon-engine';
import { CARD_BALANCE_VERSION, ONLINE_RULES_VERSION } from '@workspace/squabblemon-engine/multiplayer';
import { renderDeckBalanceAudit } from './deck-balance-audit-report';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const auditDirectory = path.join(root, 'scripts/results/deck-balance-v33-onshift');
export const dinerId = 'starter-squabblehouse-shift';
const policies = { greedy: greedyBalancePolicy, 'seeded-legal': seededLegalBalancePolicy };
type PolicyName = keyof typeof policies;
export type AuditCase = {
  key: string;
  phase: 'league' | 'counter-screen' | 'confirmation';
  policy: PolicyName;
  a: string;
  b: string;
  seed: string;
  rotation: number;
  tier: BalanceTier;
  seat: BalanceSeat;
};
export type DinerTrace = {
  managerPlayed: boolean;
  peakManagerHands: number;
  peakManagerAura: number;
  finalManagerHands: number;
  finalManagerAura: number;
  finalStaff: number;
  events: {
    sequence: number; round: number; cardId: string; type: string; note: string;
    targets: { cardId: string; beforePower: number | null; afterPower: number | null; departureCause?: string }[];
  }[];
};
export type AuditRow = { scenario: AuditCase; result: BalanceMatchResult; dinerTrace?: DinerTrace };
export type AuditPlan = {
  generatedAt: string;
  balanceVersion: number;
  rulesVersion: number;
  sourceHash: string;
  decks: BalanceDeck[];
  leagueIds: string[];
  counterIds: string[];
  cases: AuditCase[];
  replay?: { originalDirectory: string; originalSourceHash: string };
};
export type AuditShard = {
  index: number; count: number; sourceHash: string; elapsedMs?: number;
  rows: AuditRow[]; failures: { scenario: AuditCase; message: string }[];
};

function sourceHash(): string {
  const files: string[] = [];
  function visit(directory: string) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (entry.name.endsWith('.ts')) files.push(file);
    }
  }
  visit(path.join(root, 'lib/squabblemon-engine/src'));
  files.push(fileURLToPath(import.meta.url), path.join(root, 'scripts/src/deck-balance-audit-report.ts'));
  const hash = createHash('sha256');
  for (const file of files.sort()) hash.update(path.relative(root, file)).update('\0').update(readFileSync(file)).update('\0');
  return hash.digest('hex');
}

export function createAuditPlan(): AuditPlan {
  if (Number(CARD_BALANCE_VERSION) !== 33 || Number(ONLINE_RULES_VERSION) !== 33) throw new Error('This audit requires the approved v33 diner rules');
  const defaults = createDefaultBalanceDecks();
  const leagueIds = [
    ...defaults.filter(deck => deck.id.startsWith('starter-')).map(deck => deck.id),
    'focus-wonderland', 'focus-wiz', 'focus-fire-guap',
  ];
  const counterIds = [
    'focus-earth-tax', 'focus-detective', 'focus-poison-entry',
    'focus-cellblock', 'focus-counterplay-coherent', 'focus-late-scaling',
  ];
  const decks = [...leagueIds, ...counterIds].map(id => {
    const deck = defaults.find(candidate => candidate.id === id);
    if (!deck || deck.cardIds.length !== 10 || new Set(deck.cardIds).size !== 10
      || deck.cardIds.some(cardId => !cards[cardId])) throw new Error(`Invalid ten-card runtime crew: ${id}`);
    return deck;
  });
  const cases: AuditCase[] = [];
  function append(phase: AuditCase['phase'], a: string, b: string, seedCount: number, rotations: number[]) {
    for (const policy of Object.keys(policies) as PolicyName[]) for (let index = 1; index <= seedCount; index++) {
      const seed = `deck-balance-v33-onshift-${phase === 'confirmation' ? 'fresh' : 'primary'}-${String(index).padStart(2, '0')}`;
      for (const rotation of rotations) for (const tier of [0, 3] as const) for (const seat of ['a-player', 'b-player'] as const) {
        const key = [phase, policy, a, b, seed, rotation, tier, seat].join('|');
        cases.push({ key, phase, policy, a, b, seed, rotation, tier, seat });
      }
    }
  }
  for (let a = 0; a < leagueIds.length; a++) for (let b = a + 1; b < leagueIds.length; b++) {
    append('league', leagueIds[a], leagueIds[b], 2, [0, 5]);
  }
  for (const opponent of counterIds) append('counter-screen', dinerId, opponent, 2, [0, 5]);
  for (const opponent of [...leagueIds, ...counterIds].filter(id => id !== dinerId)) {
    append('confirmation', dinerId, opponent, 4, [2, 7]);
  }
  if (leagueIds.length !== 12 || cases.length !== 3392 || new Set(cases.map(item => item.key)).size !== cases.length) {
    throw new Error('Audit must contain twelve league crews and exactly 3,392 unique cases');
  }
  return {
    generatedAt: new Date().toISOString(), balanceVersion: CARD_BALANCE_VERSION,
    rulesVersion: ONLINE_RULES_VERSION, sourceHash: sourceHash(), decks, leagueIds, counterIds, cases,
  };
}

function captureDiner(match: Readonly<Match>, owner: Owner, deck: BalanceDeck): DinerTrace {
  let peakManagerHands = 0;
  let peakManagerAura = 0;
  for (const event of match.effectLog) for (const frame of [event.replay.before, event.replay.after]) {
    for (const card of frame.boards.flat()) if (card.owner === owner && card.cardId === 'squabble-house-manager') {
      peakManagerHands = Math.max(peakManagerHands, getEffectiveCardPower(card));
      peakManagerAura = Math.max(peakManagerAura, card.continuousPower ?? 0);
    }
  }
  const board = match.boards.flat().filter(card => card.owner === owner);
  const managers = board.filter(card => card.cardId === 'squabble-house-manager');
  const events = match.effectLog.filter(event => event.owner === owner && deck.cardIds.includes(event.cardId));
  return {
    managerPlayed: events.some(event => event.type === 'play' && event.cardId === 'squabble-house-manager'),
    peakManagerHands, peakManagerAura,
    finalManagerHands: managers.reduce((sum, card) => sum + getEffectiveCardPower(card), 0),
    finalManagerAura: managers.reduce((sum, card) => sum + (card.continuousPower ?? 0), 0),
    finalStaff: board.filter(card => deck.cardIds.includes(card.cardId) && card.kind !== 'support').length,
    events: events.map(event => ({
      sequence: event.sequence, round: event.round, cardId: event.cardId, type: event.type, note: event.note,
      targets: event.targets.map(target => ({
        cardId: target.cardId, beforePower: target.before?.power ?? null,
        afterPower: target.after?.power ?? null, departureCause: target.departureCause,
      })),
    })),
  };
}

export function assertSameSchedule(plan: AuditPlan, current: AuditPlan) {
  for (const field of ['balanceVersion', 'rulesVersion', 'decks', 'leagueIds', 'counterIds', 'cases'] as const) {
    if (JSON.stringify(plan[field]) !== JSON.stringify(current[field])) throw new Error(`Original audit ${field} changed`);
  }
}

export function selectOriginalFailures(plan: AuditPlan, shards: readonly AuditShard[]): AuditCase[] {
  if (!shards.length) throw new Error('Original shards are required');
  const seen = new Set<string>();
  const failed = new Set<string>();
  for (let index = 0; index < shards.length; index++) {
    const shard = shards[index];
    if (shard.index !== index || shard.count !== shards.length || shard.sourceHash !== plan.sourceHash) {
      throw new Error(`Incompatible original worker ${index}`);
    }
    const expected = plan.cases.filter((_, caseIndex) => caseIndex % shards.length === index);
    const expectedByKey = new Map(expected.map(scenario => [scenario.key, scenario]));
    for (const { scenario } of [...shard.rows, ...shard.failures]) {
      if (seen.has(scenario.key) || JSON.stringify(scenario) !== JSON.stringify(expectedByKey.get(scenario.key))) {
        throw new Error('Mismatched or repeated original audit case');
      }
      seen.add(scenario.key);
    }
    if (shard.rows.length + shard.failures.length !== expected.length) throw new Error(`Missing original worker cases: ${index}`);
    for (const failure of shard.failures) {
      if (typeof failure.message !== 'string' || !failure.message) throw new Error('Missing original failure message');
      failed.add(failure.scenario.key);
    }
  }
  if (seen.size !== plan.cases.length) throw new Error('Incomplete original Cartesian audit');
  if (!failed.size) throw new Error('Original audit has no failures to replay');
  return plan.cases.filter(scenario => failed.has(scenario.key));
}

function originalReplay(directory: string, current: AuditPlan) {
  const original = JSON.parse(readFileSync(path.join(directory, 'plan.json'), 'utf8')) as AuditPlan;
  assertSameSchedule(original, current);
  const first = JSON.parse(readFileSync(path.join(directory, 'worker-0.json'), 'utf8')) as AuditShard;
  if (!Number.isInteger(first.count) || first.count < 1) throw new Error('Invalid original worker count');
  const shards = Array.from({ length: first.count }, (_, index) =>
    JSON.parse(readFileSync(path.join(directory, `worker-${index}.json`), 'utf8')) as AuditShard);
  const cases = selectOriginalFailures(original, shards);
  const findingsPath = path.join(directory, 'findings.json');
  if (existsSync(findingsPath)) {
    const findings = JSON.parse(readFileSync(findingsPath, 'utf8')) as { failures: AuditShard['failures'] };
    const ordered = (failures: AuditShard['failures']) => failures.map(failure => JSON.stringify(failure)).sort();
    if (JSON.stringify(ordered(findings.failures)) !== JSON.stringify(ordered(shards.flatMap(shard => shard.failures)))) {
      throw new Error('Original findings disagree with shard failures');
    }
  }
  return { cases, originalSourceHash: original.sourceHash };
}

export function loadPlan(directory = auditDirectory): AuditPlan {
  const plan = JSON.parse(readFileSync(path.join(directory, 'plan.json'), 'utf8')) as AuditPlan;
  const current = createAuditPlan();
  if (plan.sourceHash !== current.sourceHash) throw new Error('Source changed; refuse mixed-version audit');
  if (plan.replay) {
    const replay = originalReplay(plan.replay.originalDirectory, current);
    if (replay.originalSourceHash !== plan.replay.originalSourceHash) throw new Error('Original replay source changed');
    assertSameSchedule(plan, { ...current, cases: replay.cases });
  } else assertSameSchedule(plan, current);
  return plan;
}

function runWorker(index: number, count: number, directory = auditDirectory) {
  if (!Number.isInteger(index) || !Number.isInteger(count) || count < 1 || index < 0 || index >= count) {
    throw new Error('Worker needs zero-based index and positive count');
  }
  const plan = loadPlan(directory);
  const scenarios = plan.cases.filter((_, caseIndex) => caseIndex % count === index);
  const destination = path.join(directory, `worker-${index}.json`);
  if (existsSync(destination)) throw new Error(`Refusing to overwrite completed shard ${destination}`);
  const started = Date.now();
  const rows: AuditRow[] = [];
  const failures: { scenario: AuditCase; message: string }[] = [];
  for (const scenario of scenarios) {
    const deckA = plan.decks.find(deck => deck.id === scenario.a)!;
    const deckB = plan.decks.find(deck => deck.id === scenario.b)!;
    const diner = deckA.id === dinerId ? deckA : deckB.id === dinerId ? deckB : undefined;
    const aOwner: Owner = scenario.seat === 'a-player' ? 'player' : 'cpu';
    const dinerOwner: Owner = diner?.id === deckA.id ? aOwner : aOwner === 'player' ? 'cpu' : 'player';
    try {
      let dinerTrace: DinerTrace | undefined;
      const result = simulateBalanceMatch({
        deckA, deckB, districtSeed: scenario.seed, rotation: scenario.rotation, tier: scenario.tier,
        seat: scenario.seat, policy: policies[scenario.policy], allowSquabble: true,
        observeComplete: diner ? match => { dinerTrace = captureDiner(match, dinerOwner, diner); } : undefined,
      });
      rows.push({ scenario, result, ...(dinerTrace ? { dinerTrace } : {}) });
    } catch (error) {
      failures.push({ scenario, message: error instanceof Error ? error.stack ?? error.message : String(error) });
    }
    const done = rows.length + failures.length;
    if (done % 64 === 0 || done === scenarios.length) console.log(`AUDIT worker=${index} progress=${done}/${scenarios.length} failures=${failures.length} elapsedMs=${Date.now() - started}`);
  }
  if (plan.sourceHash !== sourceHash()) throw new Error('Engine changed while worker was running');
  writeFileSync(destination, JSON.stringify({ index, count, sourceHash: plan.sourceHash, elapsedMs: Date.now() - started, rows, failures }), { flag: 'wx' });
  console.log(`AUDIT_WORKER_COMPLETE index=${index} successful=${rows.length} failures=${failures.length}`);
  if (failures.length) process.exitCode = 2;
}

export function collectCompleteRows(plan: AuditPlan, shards: readonly AuditShard[]): AuditRow[] {
  const count = shards.length;
  if (!count) throw new Error('Workers are required');
  const rows: AuditRow[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < count; index++) {
    const shard = shards[index];
    if (shard.index !== index || shard.count !== count || shard.sourceHash !== plan.sourceHash || shard.failures.length) {
      throw new Error(`Incomplete, failed or incompatible worker ${index}`);
    }
    const expected = plan.cases.filter((_, caseIndex) => caseIndex % count === index);
    if (shard.rows.length !== expected.length) throw new Error(`Missing worker cases: ${index}`);
    for (let offset = 0; offset < expected.length; offset++) {
      const row = shard.rows[offset];
      if (JSON.stringify(row.scenario) !== JSON.stringify(expected[offset]) || seen.has(row.scenario.key)) throw new Error('Mismatched or repeated audit case');
      if (row.result.deckAId !== row.scenario.a || row.result.deckBId !== row.scenario.b
        || row.result.districtSeed !== row.scenario.seed || row.result.seat !== row.scenario.seat
        || row.result.tier !== row.scenario.tier || row.result.rotation !== row.scenario.rotation) throw new Error('Runtime result axes mismatch');
      if (!['a', 'b', 'draw'].includes(row.result.logicalWinner)) throw new Error('Invalid runtime logical winner');
      seen.add(row.scenario.key);
      rows.push(row);
    }
  }
  if (seen.size !== plan.cases.length) throw new Error('Incomplete Cartesian audit');
  return rows;
}

function mergeWorkers(count: number, directory = auditDirectory) {
  if (!Number.isInteger(count) || count < 1) throw new Error('Merge needs positive worker count');
  const plan = loadPlan(directory);
  const summaryPath = path.join(directory, plan.replay ? 'replay-summary.json' : 'summary.json');
  const reportPath = path.join(directory, 'report.md');
  if (existsSync(summaryPath) || existsSync(reportPath)) throw new Error('Refusing to overwrite merged evidence');
  const rows = collectCompleteRows(plan, Array.from({ length: count }, (_, index) =>
    JSON.parse(readFileSync(path.join(directory, `worker-${index}.json`), 'utf8')) as AuditShard));
  if (plan.sourceHash !== sourceHash()) throw new Error('Source changed while merging');
  if (plan.replay) {
    writeFileSync(summaryPath, JSON.stringify({
      sourceHash: plan.sourceHash, originalSourceHash: plan.replay.originalSourceHash,
      successfulMatches: rows.length, failedMatches: 0, cases: rows.map(row => row.scenario.key),
    }, null, 2) + '\n', { flag: 'wx' });
    console.log(`AUDIT_REPLAY_VERIFIED_COMPLETE cases=${rows.length} failures=0 hash=${plan.sourceHash}`);
    return;
  }
  // Never feed a partial failure replay to the full-sample report renderer.
  assertSameSchedule(plan, createAuditPlan());
  const report = renderDeckBalanceAudit(plan, rows);
  writeFileSync(summaryPath, JSON.stringify(report.data, null, 2) + '\n', { flag: 'wx' });
  const markdown = report.markdown.replace(
    'No game, deck, database or balance values changed.',
    'No deck, database or balance values changed; corrected engine/harness source identity is bound above.',
  );
  writeFileSync(reportPath, markdown, { flag: 'wx' });
  console.log(markdown);
  console.log(`AUDIT_VERIFIED_COMPLETE cases=${rows.length} failures=0 hash=${plan.sourceHash}`);
}

export function parseAuditArguments(argv: readonly string[]) {
  const args = [...argv];
  let directory = auditDirectory;
  const out = args.indexOf('--out');
  if (out !== -1) {
    if (!args[out + 1] || args[out + 1].startsWith('--')) throw new Error('--out requires a directory');
    directory = path.resolve(args[out + 1]);
    args.splice(out, 2);
  }
  const valid = (args[0] === '--init' && (args.length === 1 || (args.length === 3 && args[1] === '--from-plan')))
    || (args[0] === '--init-failures' && args.length === 2 && !args[1].startsWith('--'))
    || (args[0] === '--worker' && args.length === 3)
    || (args[0] === '--merge' && args.length === 2);
  if (!valid) throw new Error('Usage: deck-balance-audit.ts [--out <directory>] --init [--from-plan <original-plan>] | --init-failures <original-directory> | --worker <index> <count> | --merge <count>');
  return { args, directory };
}

export function runAuditCli(argv: readonly string[]) {
  const { args, directory } = parseAuditArguments(argv);
  if (args[0] === '--init' || args[0] === '--init-failures') {
    if (existsSync(directory)) throw new Error('Audit output already exists; do not overwrite prior evidence');
    const plan = createAuditPlan();
    if (args[0] === '--init-failures') {
      const originalDirectory = path.resolve(args[1]);
      const replay = originalReplay(originalDirectory, plan);
      plan.cases = replay.cases;
      plan.replay = { originalDirectory, originalSourceHash: replay.originalSourceHash };
    } else if (args[1] === '--from-plan') {
      const original = JSON.parse(readFileSync(path.resolve(args[2]), 'utf8')) as AuditPlan;
      assertSameSchedule(original, plan);
      // Copy the exact original ordered schedule and crew definitions, never rebuild a subset.
      Object.assign(plan, { decks: original.decks, leagueIds: original.leagueIds, counterIds: original.counterIds, cases: original.cases });
    }
    mkdirSync(directory, { recursive: true });
    writeFileSync(path.join(directory, 'plan.json'), JSON.stringify(plan, null, 2) + '\n', { flag: 'wx' });
    console.log(`AUDIT_INITIALIZED cases=${plan.cases.length} decks=${plan.decks.length} hash=${plan.sourceHash}`);
  } else if (args[0] === '--worker') runWorker(Number(args[1]), Number(args[2]), directory);
  else mergeWorkers(Number(args[1]), directory);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runAuditCli(process.argv.slice(2));
}