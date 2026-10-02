import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  cards,
  decks,
} from '@workspace/squabblemon-engine/data';
import {
  BALANCE_LAB_SCHEMA_VERSION,
  type BalanceDeck,
  type BalanceMatchResult,
  type BalanceTier,
} from '@workspace/squabblemon-engine/balanceLab';
import { CARD_BALANCE_VERSION, ONLINE_RULES_VERSION } from '@workspace/squabblemon-engine/multiplayer';
import {
  capturedCrewSummary,
  getDefaults,
  kit,
  runBlock,
  sha256,
  summarize,
  SHELL_ORDER_KEY,
} from './squabblehouse-balance-sweep';
import { assertSweepTelemetry } from './balance-sweep-telemetry';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const outputRoot = path.join(root, 'scripts/results/squabblehouse-diner-comparison');
const opponentIds = ['focus-wonderland', 'focus-fire-guap', 'focus-wiz'] as const;
const tiers = [0, 3] as const satisfies readonly BalanceTier[];
const primarySeeds = makeSeeds(12, 'squabblehouse-primary-district');
const primaryRotations = [0, 2, 5] as const;
const holdoutSeeds = makeSeeds(6, 'squabblehouse-diner-confirmation-district');
const holdoutRotations = [1, 6] as const;

// Independently authored comparison recipe; do not source it from the evolving saved deck.
export const CURRENT_BASELINE_IDS = [
  'squabble-house-manager', 'plug', 'waterboy', 'squabblehouse-security',
  'squabblehouse-teknician', 'griddle-master', 'inmate-reformed', 'janitor',
  'laundry', 'nail',
] as const;
// Exact current authored recipe: nine staff cards plus the Side of Hands support card.
// Keep this independently frozen and assert it against the current saved recipe below.
export const DINER_CREW_IDS = [
  'squabble-house-manager', 'squabblehouse-bus-boy', 'squabblehouse-cashier',
  'squabblehouse-security', 'squabblehouse-teknician', 'griddle-master',
  'inmate-reformed', 'janitor', 'waffle-warlord', 'sideofhands',
] as const;
export const CREWS = {
  'current-baseline': {
    // Match the existing staff harness's deck identity to minimize label-derived instance-ID differences.
    id: 'squabblehouse-staff-shell',
    name: 'Frozen pre-diner staff/utility baseline',
    cardIds: CURRENT_BASELINE_IDS,
    orderKey: SHELL_ORDER_KEY,
  },
  diner: {
    id: 'squabblehouse-staff-shell',
    name: 'Current SQUABBLEHOUSE SHIFT: nine staff and Side of Hands support',
    cardIds: DINER_CREW_IDS,
    orderKey: SHELL_ORDER_KEY,
  },
} as const satisfies Record<string, BalanceDeck>;
export const CREW_ROLE_LABELS = {
  'current-baseline': 'frozen-original-staff-shell',
  diner: 'authored-current-shift-nine-staff-plus-support',
} as const satisfies Record<keyof typeof CREWS, string>;

type CrewName = keyof typeof CREWS;
type ScheduleKind = 'primary' | 'holdout';
type Shard = `${typeof opponentIds[number]}:${'greedy' | 'seeded-legal'}:${ScheduleKind}`;
type Split = ReturnType<typeof summarize>['splits'];
type Block = {
  matchup: string;
  policy: 'greedy' | 'seeded-legal';
  schedule: {
    set: 'pilot' | 'primary' | 'fresh-holdout';
    seeds: readonly string[];
    rotations: readonly number[];
    tiers: readonly number[];
    mirroredSeats: boolean;
    allowSquabble: boolean;
  };
  expectedMatches: number;
  matrix: unknown;
  matrixParity: Record<string, boolean>;
  rawResults: BalanceMatchResult[];
  crewCardEventObservations: unknown[];
  rawFailures: unknown[];
  cardSummaries: {
    shell: ReturnType<typeof summarize>;
    opponent: ReturnType<typeof summarize>;
    sourceAttributedCrewEvents: Record<string, unknown>;
  };
};

function makeSeeds(count: number, prefix: string): string[] {
  return Array.from({ length: count }, (_, index) => `${prefix}-${String(index + 1).padStart(2, '0')}`);
}

export function validateDinerRoster(cardIds: readonly string[]): void {
  if (cardIds.length !== 10 || new Set(cardIds).size !== 10) throw new Error('Diner comparison roster must contain exactly ten unique cards');
  const unknown = cardIds.filter(id => !cards[id]);
  if (unknown.length) throw new Error(`Diner comparison roster has unknown runtime cards: ${unknown.join(', ')}`);
  if (cardIds.some(id => id === 'cane-corso-red' || id === 'blue-nose-pit')) throw new Error('Diner comparison roster cannot include dog/gang cards');
  const authoredRecipe = decks.find(deck => deck.id === 'squabblehouse-shift');
  if (!authoredRecipe || authoredRecipe.cards.join('|') !== DINER_CREW_IDS.join('|')) {
    throw new Error('Current SQUABBLEHOUSE SHIFT must exactly match the separately frozen nine-staff-plus-Side-of-Hands comparison crew');
  }
  if (cardIds.join('|') !== DINER_CREW_IDS.join('|')) {
    throw new Error('Diner comparison roster must retain the exact authored SQUABBLEHOUSE SHIFT card identities and slot order');
  }
  if (!cardIds.includes('sideofhands' as never) || cards.sideofhands.kind !== 'support') {
    throw new Error('Diner crew must retain Side of Hands as a support card, not reclassify it as staff');
  }
}

export function getSchedules(pilot = false) {
  if (pilot) return {
    primarySeeds: makeSeeds(1, 'squabblehouse-diner-pilot-district'),
    primaryRotations: [0],
    holdoutSeeds: [],
    holdoutRotations: [...holdoutRotations],
    tiers: [...tiers],
    policies: ['greedy'] as const,
  };
  return {
    primarySeeds: [...primarySeeds],
    primaryRotations: [...primaryRotations],
    holdoutSeeds: [...holdoutSeeds],
    holdoutRotations: [...holdoutRotations],
    tiers: [...tiers],
    policies: ['greedy', 'seeded-legal'] as const,
  };
}

export function sourceFingerprints(): Record<string, string> {
  const files = [
    'lib/squabblemon-engine/package.json',
    'lib/squabblemon-engine/src/balanceLab.ts',
    'lib/squabblemon-engine/src/data.ts',
    'lib/squabblemon-engine/src/gameEngine.ts',
    'lib/squabblemon-engine/src/districts.ts',
    'lib/squabblemon-engine/src/squabblehouseWave.ts',
    'lib/squabblemon-engine/src/creativeReworks.ts',
    'lib/squabblemon-engine/src/rosterBalance.ts',
    'lib/squabblemon-engine/src/multiplayer.ts',
    'scripts/src/balance-sweep-telemetry.ts',
    'scripts/src/squabblehouse-balance-sweep.ts',
    'scripts/src/squabblehouse-diner-comparison.ts',
  ];
  return Object.fromEntries(files.map(file => [file, sha256(readFileSync(path.join(root, file)))]));
}

function scheduleFingerprint(fingerprints: Record<string, string>, opponents: readonly BalanceDeck[]) {
  return sha256(JSON.stringify({
    fingerprints,
    opponents,
    primary: { seeds: primarySeeds, rotations: primaryRotations, tiers, policies: ['greedy', 'seeded-legal'] },
    holdout: { seeds: holdoutSeeds, rotations: holdoutRotations, tiers, policy: 'greedy' },
    allowSquabble: true,
    orderKey: SHELL_ORDER_KEY,
    comparisonCrews: CREWS,
    crewRoleLabels: CREW_ROLE_LABELS,
  }));
}

export function parseShard(value: string): { opponent: typeof opponentIds[number]; policy: 'greedy' | 'seeded-legal'; schedule: ScheduleKind } {
  const parts = value.split(':');
  if (parts.length !== 3 || !opponentIds.includes(parts[0] as typeof opponentIds[number])
    || !['greedy', 'seeded-legal'].includes(parts[1]) || !['primary', 'holdout'].includes(parts[2])) {
    throw new Error('--shard must be <focus-wonderland|focus-fire-guap|focus-wiz>:<greedy|seeded-legal>:<primary|holdout>');
  }
  if (parts[2] === 'holdout' && parts[1] !== 'greedy') throw new Error('Confirmation holdout is greedy-only');
  return { opponent: parts[0] as typeof opponentIds[number], policy: parts[1] as 'greedy' | 'seeded-legal', schedule: parts[2] as ScheduleKind };
}

function frozenRostersAndSchedule(pilot = false) {
  const schedules = getSchedules(pilot);
  const opponents = getDefaults();
  return {
    frozenCrews: Object.entries(CREWS).map(([crew, deck]) => ({
      crew, id: deck.id, name: deck.name, orderKey: deck.orderKey,
      exactCardIds: deck.cardIds,
      runtimeCurve: deck.cardIds.map(id => ({ id, name: cards[id].name, cost: cards[id].cost })),
    })),
    canonicalCurrentOpponents: opponents.map(deck => ({ id: deck.id, name: deck.name, exactCardIds: deck.cardIds })),
    schedule: pilot
      ? { pilot: true, ...schedules, seats: 'mirrored', policies: ['greedy'] }
      : { ...schedules, seats: 'mirrored', holdoutPolicy: 'greedy' },
    uniqueCasesPerCrew: pilot ? 12 : 1008,
    uniquePairedCases: pilot ? 24 : 2016,
    matrixAndRawNote: 'runBalanceMatrix and raw simulateBalanceMatch are duplicate concordance executions, not independent samples.',
  };
}

type MatchCase = Pick<BalanceMatchResult, 'districtSeed' | 'rotation' | 'tier' | 'seat'>;
function caseKey(match: MatchCase): string {
  return `${match.districtSeed}\u0000${match.rotation}\u0000${match.tier}\u0000${match.seat}`;
}

export function assertCompleteBlock(
  block: {
    matchup: string;
    policy: string;
    expectedMatches: number;
    schedule: { set: string; seeds: readonly string[]; rotations: readonly number[]; tiers: readonly number[]; mirroredSeats: boolean; allowSquabble: boolean };
    matrix: unknown;
    matrixParity: Record<string, boolean>;
    rawResults: readonly MatchCase[] & readonly { deckAId?: string; deckBId?: string; telemetrySchemaVersion?: number }[];
    rawFailures: readonly unknown[];
    observations?: readonly unknown[];
    crewCardEventObservations?: readonly unknown[];
  },
  crew: BalanceDeck,
  opponent: BalanceDeck,
  policy: 'greedy' | 'seeded-legal',
  seeds: readonly string[],
  rotations: readonly number[],
  schedule: 'pilot' | 'primary' | 'fresh-holdout',
): Set<string> {
  const expectedSeeds = schedule === 'pilot' ? makeSeeds(1, 'squabblehouse-diner-pilot-district')
    : schedule === 'primary' ? primarySeeds : holdoutSeeds;
  const expectedRotations = schedule === 'pilot' ? [0]
    : schedule === 'primary' ? primaryRotations : holdoutRotations;
  const expectedPolicy = schedule === 'fresh-holdout' ? 'greedy' : policy;
  if (policy !== expectedPolicy) throw new Error(`${schedule} schedule has forbidden policy ${policy}`);
  if (JSON.stringify(seeds) !== JSON.stringify(expectedSeeds) || JSON.stringify(rotations) !== JSON.stringify(expectedRotations)) {
    throw new Error(`${schedule} block requested unexpected seed/rotation axes`);
  }
  const expectedCount = expectedSeeds.length * expectedRotations.length * tiers.length * 2;
  if (block.expectedMatches !== expectedCount) throw new Error(`${schedule} expectedMatches must be exactly ${expectedCount}`);
  if (block.matchup !== `${crew.id}-vs-${opponent.id}` || block.policy !== policy) throw new Error('Block identity does not match its frozen crew/opponent/policy');
  if (block.schedule.set !== schedule
    || JSON.stringify(block.schedule.seeds) !== JSON.stringify(expectedSeeds)
    || JSON.stringify(block.schedule.rotations) !== JSON.stringify(expectedRotations)
    || JSON.stringify(block.schedule.tiers) !== JSON.stringify(tiers)
    || block.schedule.mirroredSeats !== true || block.schedule.allowSquabble !== true) {
    throw new Error(`${schedule} block metadata does not match its exact paired axes`);
  }
  const matrix = block.matrix as { matchCount: number; successfulMatches: number; failedMatches: number; failures: unknown[] };
  if (!matrix || matrix.matchCount !== expectedCount || matrix.successfulMatches !== expectedCount || matrix.failedMatches !== 0
    || !Array.isArray(matrix.failures) || matrix.failures.length !== 0) {
    throw new Error(`${schedule} matrix must have exactly ${expectedCount} attempts/successes and zero failures`);
  }
  if (block.rawFailures.length !== 0) throw new Error(`${schedule} raw simulation has failures`);
  if (block.rawResults.length !== expectedCount) throw new Error(`${schedule} raw match count must be exactly ${expectedCount}`);
  const observations = block.observations ?? block.crewCardEventObservations ?? [];
  if (observations.length !== expectedCount) throw new Error(`${schedule} needs one raw observation per successful match`);
  if (!block.matrixParity || ['successfulMatches', 'failedMatches', 'deckAOutcomeCounts', 'deckBOutcomeCounts'].some(key => block.matrixParity[key] !== true)) {
    throw new Error(`${schedule} matrix/raw parity flags are not all true`);
  }
  const keys = new Set<string>();
  const expectedRotationSet = new Set<number>(expectedRotations);
  for (const result of block.rawResults) {
    if (result.deckAId !== crew.id || result.deckBId !== opponent.id || result.telemetrySchemaVersion !== BALANCE_LAB_SCHEMA_VERSION) {
      throw new Error(`${schedule} raw match has wrong crew/opponent identity or telemetry schema`);
    }
    if (!expectedSeeds.includes(result.districtSeed) || !expectedRotationSet.has(result.rotation)
      || !tiers.includes(result.tier) || !(['a-player', 'b-player'] as const).includes(result.seat)) {
      throw new Error(`${schedule} raw match has an unexpected seed, rotation, tier, or seat`);
    }
    const key = caseKey(result);
    if (keys.has(key)) throw new Error(`${schedule} has duplicate raw matchup case ${key.replaceAll('\u0000', '/')}`);
    keys.add(key);
  }
  const expectedKeys = new Set<string>();
  for (const districtSeed of expectedSeeds) for (const rotation of expectedRotations)
    for (const tier of tiers) for (const seat of ['a-player', 'b-player'] as const)
      expectedKeys.add(caseKey({ districtSeed, rotation, tier, seat }));
  if (keys.size !== expectedCount || JSON.stringify([...keys].sort()) !== JSON.stringify([...expectedKeys].sort())) {
    throw new Error(`${schedule} raw matches do not exactly cover the requested Cartesian cases`);
  }
  return keys;
}

function assertPairedBlocksHaveSameCases(baseline: Block, diner: Block): void {
  assertPairedSchedulesMatch(baseline, diner);
  const baselineKeys = new Set(baseline.rawResults.map(caseKey));
  const dinerKeys = new Set(diner.rawResults.map(caseKey));
  if (JSON.stringify([...baselineKeys].sort()) !== JSON.stringify([...dinerKeys].sort())) {
    throw new Error(`Paired raw case keys differ for ${baseline.matchup}/${baseline.policy}/${baseline.schedule.set}`);
  }
}

function buildBlock(crew: BalanceDeck, opponent: BalanceDeck, policy: 'greedy' | 'seeded-legal', seeds: string[], rotations: number[], pilot: boolean, schedule: 'pilot' | 'primary' | 'fresh-holdout'): Block {
  const raw = runBlock(
    `${crew.id}-vs-${opponent.id}`,
    crew,
    opponent,
    policy,
    seeds,
    rotations,
    pilot,
    schedule,
  );
  assertCompleteBlock({
    matchup: raw.matchup,
    policy: raw.policy,
    expectedMatches: raw.expectedMatches,
    schedule: raw.schedule,
    matrix: raw.matrix,
    matrixParity: raw.matrixParity,
    rawResults: raw.rawResults,
    rawFailures: raw.rawFailures,
    observations: raw.observations,
  }, crew, opponent, policy, seeds, rotations, schedule);
  const crewSummary = summarize(raw.rawResults, 'a');
  const opponentSummary = summarize(raw.rawResults, 'b');
  const eventSummary = capturedCrewSummary(crew, raw.rawResults, raw.observations);
  return {
    matchup: raw.matchup,
    policy: raw.policy,
    schedule: raw.schedule,
    expectedMatches: raw.expectedMatches,
    matrix: raw.matrix,
    matrixParity: raw.matrixParity,
    rawResults: raw.rawResults,
    crewCardEventObservations: raw.observations,
    rawFailures: raw.rawFailures,
    cardSummaries: {
      shell: { ...crewSummary, cards: eventSummary.cards } as ReturnType<typeof summarize>,
      opponent: opponentSummary,
      sourceAttributedCrewEvents: eventSummary.coverage,
    },
  };
}

function makeReport(crewName: CrewName, blocks: Block[], sourceHashes: Record<string, string>, scheduleHash: string, pilot: boolean) {
  const crew = CREWS[crewName] as BalanceDeck;
  const opponents = getDefaults();
  const deterministicFingerprint = crewFingerprint(scheduleHash, crewName, pilot);
  const enginePackage = JSON.parse(readFileSync(path.join(root, 'lib/squabblemon-engine/package.json'), 'utf8')) as { name: string; version: string };
  let gitCommit = 'unavailable';
  try {
    gitCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  } catch { /* Source SHA-256 fingerprints are authoritative without Git metadata. */ }
  const report = {
    schemaVersion: BALANCE_LAB_SCHEMA_VERSION,
    experiment: 'paired-current-rules-squabblehouse-diner-comparison',
    crew: crewName,
    crewRole: CREW_ROLE_LABELS[crewName],
    pilot,
    deterministicFingerprint,
    scheduleFingerprint: scheduleHash,
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    gitCommit,
    versionMetadata: {
      enginePackage, balanceLabSchemaVersion: BALANCE_LAB_SCHEMA_VERSION,
      cardBalanceVersion: CARD_BALANCE_VERSION, onlineRulesVersion: ONLINE_RULES_VERSION,
      engineSourceSha256: Object.fromEntries(Object.entries(sourceHashes).filter(([file]) => file.startsWith('lib/squabblemon-engine/'))),
    },
    configuration: {
      crew, crewRole: CREW_ROLE_LABELS[crewName], pairedComparisonCrews: CREWS, crewRoleLabels: CREW_ROLE_LABELS,
      opponents, sharedOrderKey: SHELL_ORDER_KEY,
      schedule: getSchedules(pilot),
      interpretation: [
        'Matched bot-vs-bot deck-composition evidence, not human win rates or isolated card strength.',
        'Both crews use identical opponents, district seeds, rotations, tiers, seats, policies and shared orderKey.',
        'The diner crew is the exact current SQUABBLEHOUSE SHIFT: nine staff cards plus Side of Hands, which remains a support card rather than staff.',
        'Ability event counts are descriptive only; eligibility denominators and reliability are unknown.',
      ],
      sourceFingerprints: sourceHashes,
    },
    runtimeCardKits: Object.fromEntries([...new Set([...crew.cardIds, ...opponents.flatMap(deck => deck.cardIds)])].map(id => [id, kit(id)])),
    blocks,
    failures: blocks.flatMap(block => [
      ...((block.matrix as { failures: unknown[] }).failures ?? []).map(failure => ({ matchup: block.matchup, policy: block.policy, source: 'runBalanceMatrix', failure })),
      ...block.rawFailures.map(failure => ({ matchup: block.matchup, policy: block.policy, source: 'simulateBalanceMatch', failure })),
    ]),
    simulationAccounting: {
      uniqueRequestedMatchups: blocks.reduce((n, block) => n + block.expectedMatches, 0),
      rawRetainedSamples: blocks.reduce((n, block) => n + block.rawResults.length, 0),
      matrixValidationReplays: blocks.reduce((n, block) => n + (block.matrix as { matchCount: number }).matchCount, 0),
      engineSimulationAttempts: blocks.reduce((n, block) => n + (block.matrix as { matchCount: number }).matchCount + block.rawResults.length + block.rawFailures.length, 0),
      note: 'Matrix and raw captured executions are duplicate validations for each unique requested case, not independent samples.',
    },
  };
  assertSweepTelemetry(report);
  return report;
}

export function assertShardPayload(payload: any, crewName: CrewName, spec: string, expectedScheduleFingerprint: string): void {
  if (payload.crew !== crewName || payload.shard !== spec) throw new Error('Wrong crew/shard identity');
  if (payload.scheduleFingerprint !== expectedScheduleFingerprint) throw new Error('Refusing stale or mixed-version shard; schedule/source fingerprint changed');
  if (payload.report?.deterministicFingerprint !== payload.deterministicFingerprint
    || payload.deterministicFingerprint !== crewFingerprint(expectedScheduleFingerprint, crewName, false)) {
    throw new Error('Refusing mixed crew, engine, schedule, or configuration fingerprint');
  }
  const report = payload.report;
  const expectedSourceFingerprints = sourceFingerprints();
  if (JSON.stringify(report.configuration?.sourceFingerprints) !== JSON.stringify(expectedSourceFingerprints)
    || JSON.stringify(report.configuration?.crew) !== JSON.stringify(CREWS[crewName])
    || report.crewRole !== CREW_ROLE_LABELS[crewName]
    || JSON.stringify(report.configuration?.pairedComparisonCrews) !== JSON.stringify(CREWS)
    || JSON.stringify(report.configuration?.crewRoleLabels) !== JSON.stringify(CREW_ROLE_LABELS)) {
    throw new Error('Refusing shard with stale source fingerprints or mismatched frozen crew roles/rosters');
  }
  if (!Array.isArray(report.failures) || report.failures.length !== 0) throw new Error('Refusing shard with recorded failures');
  const schedule = spec.split(':')[2];
  if (report.blocks.length !== 1 || report.blocks[0].schedule.set !== (schedule === 'holdout' ? 'fresh-holdout' : 'primary')) {
    throw new Error('Invalid schedule block in shard');
  }
  const [opponentId, policy] = spec.split(':');
  const opponent = getDefaults().find(candidate => candidate.id === opponentId);
  if (!opponent) throw new Error(`Unknown opponent in shard ${spec}`);
  assertCompleteBlock(
    report.blocks[0],
    CREWS[crewName] as BalanceDeck,
    opponent,
    policy as 'greedy' | 'seeded-legal',
    schedule === 'holdout' ? [...holdoutSeeds] : [...primarySeeds],
    schedule === 'holdout' ? [...holdoutRotations] : [...primaryRotations],
    schedule === 'holdout' ? 'fresh-holdout' : 'primary',
  );
  const count = report.blocks[0].expectedMatches;
  const accounting = report.simulationAccounting;
  if (accounting?.uniqueRequestedMatchups !== count || accounting?.rawRetainedSamples !== count
    || accounting?.matrixValidationReplays !== count || accounting?.engineSimulationAttempts !== count * 2) {
    throw new Error('Refusing shard with incomplete simulation accounting');
  }
}

export function crewFingerprint(scheduleHash: string, crewName: CrewName, pilot: boolean): string {
  return sha256(JSON.stringify({
    scheduleFingerprint: scheduleHash,
    crewName,
    crewRole: CREW_ROLE_LABELS[crewName],
    crew: CREWS[crewName],
    pairedComparisonCrews: CREWS,
    crewRoleLabels: CREW_ROLE_LABELS,
    pilot,
  }));
}

export function assertPairedSchedulesMatch(baseline: any, diner: any): void {
  if (JSON.stringify(baseline.schedule) !== JSON.stringify(diner.schedule)
    || baseline.policy !== diner.policy || baseline.expectedMatches !== diner.expectedMatches) {
    throw new Error('Paired schedule mismatch');
  }
}

function runPilot() {
  validateDinerRoster(DINER_CREW_IDS);
  const fingerprints = sourceFingerprints();
  const scheduleHash = scheduleFingerprint(fingerprints, getDefaults());
  console.log(JSON.stringify({
    ...frozenRostersAndSchedule(true),
    sourceFingerprints: fingerprints,
    scheduleFingerprint: scheduleHash,
  }, null, 2));
  const schedules = getSchedules(true);
  const blocksByCrew: Record<CrewName, Block[]> = { 'current-baseline': [], diner: [] };
  for (const opponent of getDefaults()) {
    for (const crewName of Object.keys(CREWS) as CrewName[]) {
      blocksByCrew[crewName].push(buildBlock(CREWS[crewName] as BalanceDeck, opponent, 'greedy', [...schedules.primarySeeds], [...schedules.primaryRotations], true, 'pilot'));
    }
    assertPairedBlocksHaveSameCases(blocksByCrew['current-baseline'].at(-1)!, blocksByCrew.diner.at(-1)!);
  }
  mkdirSync(outputRoot, { recursive: true });
  for (const crewName of Object.keys(CREWS) as CrewName[]) {
    const report = makeReport(crewName, blocksByCrew[crewName], fingerprints, scheduleHash, true);
    const directory = path.join(outputRoot, crewName);
    mkdirSync(directory, { recursive: true });
    writeFileSync(path.join(directory, 'pilot.json'), `${JSON.stringify(report, null, 2)}\n`);
  }
  console.log(JSON.stringify({ pilotReports: ['current-baseline/pilot.json', 'diner/pilot.json'], uniqueCasesPerCrew: 12, pairedUniqueCases: 24 }, null, 2));
}

function runShard(shardSpec: string) {
  const shard = parseShard(shardSpec);
  const fingerprints = sourceFingerprints();
  const opponents = getDefaults();
  const opponent = opponents.find(deck => deck.id === shard.opponent)!;
  const scheduleHash = scheduleFingerprint(fingerprints, opponents);
  const seeds = shard.schedule === 'primary' ? primarySeeds : holdoutSeeds;
  const rotations = shard.schedule === 'primary' ? primaryRotations : holdoutRotations;
  const scheduleName = shard.schedule === 'primary' ? 'primary' : 'fresh-holdout';
  console.log(JSON.stringify({
    ...frozenRostersAndSchedule(false),
    sourceFingerprints: fingerprints,
    scheduleFingerprint: scheduleHash,
  }, null, 2));
  const shardBlocks = {} as Record<CrewName, Block>;
  for (const crewName of Object.keys(CREWS) as CrewName[]) {
    const crew = CREWS[crewName] as BalanceDeck;
    shardBlocks[crewName] = buildBlock(crew, opponent, shard.policy, [...seeds], [...rotations], false, scheduleName);
  }
  assertPairedBlocksHaveSameCases(shardBlocks['current-baseline'], shardBlocks.diner);
  const shardReports = {} as Record<CrewName, ReturnType<typeof makeReport>>;
  for (const crewName of Object.keys(CREWS) as CrewName[]) {
    shardReports[crewName] = makeReport(crewName, [shardBlocks[crewName]], fingerprints, scheduleHash, false);
  }
  for (const crewName of Object.keys(CREWS) as CrewName[]) {
    const block = shardBlocks[crewName];
    const report = shardReports[crewName];
    const directory = path.join(outputRoot, crewName);
    mkdirSync(directory, { recursive: true });
    const chunkFile = `chunk-${shard.opponent}-${shard.policy}-${shard.schedule}.json`;
    const payload = { crew: crewName, shard: shardSpec, scheduleFingerprint: scheduleHash, deterministicFingerprint: report.deterministicFingerprint, report };
    writeFileSync(path.join(directory, chunkFile), `${JSON.stringify(payload, null, 2)}\n`);
    console.log(JSON.stringify({ crew: crewName, chunk: `scripts/results/squabblehouse-diner-comparison/${crewName}/${chunkFile}`, expectedMatches: block.expectedMatches, rawSuccessfulMatches: block.rawResults.length, failures: block.rawFailures.length }, null, 2));
  }
}

function assertMergedReportComplete(report: Record<string, any>, crewName: CrewName): void {
  const expected: { opponent: string; policy: 'greedy' | 'seeded-legal'; schedule: 'primary' | 'holdout' }[] = [
    ...opponentIds.flatMap(opponent => (['greedy', 'seeded-legal'] as const).map(policy => ({ opponent, policy, schedule: 'primary' as const }))),
    ...opponentIds.map(opponent => ({ opponent, policy: 'greedy' as const, schedule: 'holdout' as const })),
  ];
  if (report.shardCount !== 9 || report.blocks.length !== 9) throw new Error(`${crewName} merged report must contain exactly nine shards/blocks`);
  if (!Array.isArray(report.failures) || report.failures.length !== 0) throw new Error(`${crewName} merged report contains failures`);
  const expectedKeys = new Set(expected.map(entry => `${entry.opponent}:${entry.policy}:${entry.schedule}`));
  const seenBlocks = new Set<string>();
  const seenCases = new Set<string>();
  let uniqueCases = 0;
  for (const block of report.blocks as Block[]) {
    const opponent = opponentIds.find(id => block.matchup === `${CREWS[crewName].id}-vs-${id}`);
    if (!opponent) throw new Error(`${crewName} merged block references an unknown opponent`);
    const scheduleKind = block.schedule.set === 'fresh-holdout' ? 'holdout' : block.schedule.set;
    const key = `${opponent}:${block.policy}:${scheduleKind}`;
    if (!expectedKeys.has(key) || seenBlocks.has(key)) throw new Error(`${crewName} merged report has an unexpected/duplicate block ${key}`);
    seenBlocks.add(key);
    const expectedOpponent = getDefaults().find(deck => deck.id === opponent)!;
    const policy = block.policy as 'greedy' | 'seeded-legal';
    const isHoldout = scheduleKind === 'holdout';
    const keys = assertCompleteBlock(
      block,
      CREWS[crewName] as BalanceDeck,
      expectedOpponent,
      policy,
      isHoldout ? [...holdoutSeeds] : [...primarySeeds],
      isHoldout ? [...holdoutRotations] : [...primaryRotations],
      isHoldout ? 'fresh-holdout' : 'primary',
    );
    uniqueCases += keys.size;
    for (const caseValue of keys) {
      const globalKey = `${key}\u0000${caseValue}`;
      if (seenCases.has(globalKey)) throw new Error(`${crewName} merged report duplicates a requested case`);
      seenCases.add(globalKey);
    }
  }
  if (seenBlocks.size !== 9 || uniqueCases !== 1008) throw new Error(`${crewName} merged report must cover exactly 1,008 unique cases`);
  const accounting = report.simulationAccounting;
  if (accounting?.uniqueRequestedMatchups !== 1008 || accounting?.rawRetainedSamples !== 1008
    || accounting?.matrixValidationReplays !== 1008 || accounting?.engineSimulationAttempts !== 2016) {
    throw new Error(`${crewName} merged simulation accounting is incomplete or inconsistent`);
  }
}

function assertMergedReportsPaired(baseline: Record<string, any>, diner: Record<string, any>): void {
  const toCaseMap = (report: Record<string, any>): Map<string, Block> => new Map(report.blocks.map((block: Block) => [
    `${block.matchup}\u0000${block.policy}\u0000${block.schedule.set}`,
    block,
  ] as [string, Block]));
  const baseBlocks = toCaseMap(baseline);
  const dinerBlocks = toCaseMap(diner);
  if (baseBlocks.size !== dinerBlocks.size || baseBlocks.size !== 9) throw new Error('Merged crew reports do not contain nine paired blocks');
  for (const [key, baselineBlock] of baseBlocks) {
    const dinerBlock = dinerBlocks.get(key);
    if (!dinerBlock) throw new Error(`Diner merged report is missing paired block ${key}`);
    assertPairedBlocksHaveSameCases(baselineBlock, dinerBlock);
  }
}

function mergeShards() {
  const expected: Shard[] = [
    ...opponentIds.flatMap(id => ['greedy', 'seeded-legal'].map(policy => `${id}:${policy}:primary` as Shard)),
    ...opponentIds.map(id => `${id}:greedy:holdout` as Shard),
  ];
  const sourceHashes = sourceFingerprints();
  const scheduleHash = scheduleFingerprint(sourceHashes, getDefaults());
  const allPayloads = {} as Record<CrewName, Record<string, any>[]>;
  for (const crewName of Object.keys(CREWS) as CrewName[]) {
    allPayloads[crewName] = expected.map(spec => {
      const [opponent, policy, schedule] = spec.split(':');
      const file = path.join(outputRoot, crewName, `chunk-${opponent}-${policy}-${schedule}.json`);
      let payload: any;
      try { payload = JSON.parse(readFileSync(file, 'utf8')); }
      catch (error) { throw new Error(`Missing or unreadable ${crewName} shard ${path.relative(root, file)}: ${error instanceof Error ? error.message : String(error)}`); }
      try { assertShardPayload(payload, crewName, spec, scheduleHash); }
      catch (error) { throw new Error(`${error instanceof Error ? error.message : String(error)} in ${file}`); }
      return payload;
    });
  }
  for (let index = 0; index < expected.length; index += 1) {
    const baseline = allPayloads['current-baseline'][index].report.blocks[0];
    const diner = allPayloads.diner[index].report.blocks[0];
    try { assertPairedSchedulesMatch(baseline, diner); }
    catch { throw new Error(`Paired schedule mismatch for ${expected[index]}`); }
  }
  const mergedReports = {} as Record<CrewName, Record<string, any>>;
  for (const crewName of Object.keys(CREWS) as CrewName[]) {
    const reports = allPayloads[crewName].map(payload => payload.report);
    const report = {
      ...reports[0],
      startedAt: reports.map(value => value.startedAt).sort()[0],
      completedAt: reports.map(value => value.completedAt).sort().at(-1),
      blocks: reports.flatMap(value => value.blocks),
      failures: reports.flatMap(value => value.failures),
      shardCount: reports.length,
      simulationAccounting: {
        uniqueRequestedMatchups: reports.flatMap(value => value.blocks).reduce((sum, block) => sum + block.expectedMatches, 0),
        rawRetainedSamples: reports.flatMap(value => value.blocks).reduce((sum, block) => sum + block.rawResults.length, 0),
        matrixValidationReplays: reports.flatMap(value => value.blocks).reduce((sum, block) => sum + (block.matrix as { matchCount: number }).matchCount, 0),
        engineSimulationAttempts: reports.flatMap(value => value.blocks).reduce((sum, block) => sum + (block.matrix as { matchCount: number }).matchCount + block.rawResults.length + block.rawFailures.length, 0),
        note: 'Raw samples are unique requested cells; matrix results are duplicate concordance executions, not additional independent samples.',
      },
    };
    assertMergedReportComplete(report, crewName);
    assertSweepTelemetry(report);
    mergedReports[crewName] = report;
  }
  assertMergedReportsPaired(mergedReports['current-baseline'], mergedReports.diner);
  for (const crewName of Object.keys(CREWS) as CrewName[]) {
    writeFileSync(path.join(outputRoot, crewName, 'current-rules.json'), `${JSON.stringify(mergedReports[crewName], null, 2)}\n`);
  }
  console.log(JSON.stringify({
    mergedShards: expected.length,
    uniqueCasesPerCrew: 1008,
    pairedUniqueCases: 2016,
    crewFiles: ['current-baseline/current-rules.json', 'diner/current-rules.json'],
  }, null, 2));
}

function main() {
  validateDinerRoster(DINER_CREW_IDS);
  const args = process.argv.slice(2);
  const pilot = args.includes('--pilot');
  const preflight = args.includes('--preflight');
  const merge = args.includes('--merge');
  const shardIndex = args.indexOf('--shard');
  const shardSpec = shardIndex < 0 ? undefined : args[shardIndex + 1];
  const allowed = new Set(['--pilot', '--preflight', '--merge', '--shard']);
  if (args.some((arg, index) => arg.startsWith('--') && !allowed.has(arg))
    || args.some((arg, index) => arg === '--shard' && (!args[index + 1] || args[index + 1].startsWith('--')))) {
    throw new Error('Supported CLI: --preflight, --pilot, --shard <opponent:policy:primary|holdout>, --merge');
  }
  if ([pilot, preflight, merge, shardSpec !== undefined].filter(Boolean).length !== 1) {
    throw new Error('Choose exactly one of --preflight, --pilot, --shard, or --merge; unsharded full runs are intentionally disabled.');
  }
  if (preflight) {
    console.log(JSON.stringify({ ...frozenRostersAndSchedule(false), sourceFingerprints: sourceFingerprints(), scheduleFingerprint: scheduleFingerprint(sourceFingerprints(), getDefaults()) }, null, 2));
  } else if (pilot) runPilot();
  else if (merge) mergeShards();
  else runShard(shardSpec!);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}