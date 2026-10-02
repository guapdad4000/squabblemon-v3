import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import {
  BALANCE_LAB_SCHEMA_VERSION,
  type BalanceDeck,
  type BalanceMatchResult,
  type BalanceTier,
} from '@workspace/squabblemon-engine/balanceLab';
import { cardCatalog, cards, decks } from '@workspace/squabblemon-engine/data';
import { CARD_BALANCE_VERSION, ONLINE_RULES_VERSION } from '@workspace/squabblemon-engine/multiplayer';
import {
  capturedCrewSummary,
  getDefaults,
  kit,
  sha256,
  summarize,
  SHELL_ORDER_KEY,
} from './squabblehouse-balance-sweep';
import { assertSweepTelemetry } from './balance-sweep-telemetry';

export { SHELL_ORDER_KEY };

export const OLD_ENGINE_COMMIT = 'b3387f68bc3c7ac5e85a536a327e700222ab5fd0';
export const OLD_CARD_BALANCE_VERSION = 30;
export const NEW_CARD_BALANCE_VERSION = 31;
export const outputRelativeRoot = 'scripts/results/squabblehouse-counter-comparison';
export const acceptedDinerRelativePath = 'scripts/results/squabblehouse-diner-comparison/diner/current-rules.json';
export const DINER_CREW_IDS = [
  'squabble-house-manager',
  'squabblehouse-bus-boy',
  'squabblehouse-cashier',
  'squabblehouse-security',
  'squabblehouse-teknician',
  'griddle-master',
  'inmate-reformed',
  'janitor',
  'waffle-warlord',
  'sideofhands',
] as const;
export const CREW = {
  id: 'squabblehouse-staff-shell',
  name: 'Current SQUABBLEHOUSE SHIFT: nine staff and Side of Hands support',
  cardIds: DINER_CREW_IDS,
  orderKey: SHELL_ORDER_KEY,
} as const satisfies BalanceDeck;
export const CREW_ROLE = 'same-authored-squabblehouse-shift-nine-staff-plus-support';
export const PHASE_CREW_ROLES = {
  before: 'before-v30-same-authored-diner-crew',
  after: 'after-v31-same-authored-diner-crew',
} as const;
export const MATCH_PAIR_ID = 'squabblehouse-diner-v30-v31-same-crew-shell-v1';
export const SNAPSHOT_MANIFEST = '.squabblehouse-counterbenchmark-snapshot.json';
export const opponentIds = ['focus-wonderland', 'focus-fire-guap', 'focus-wiz'] as const;
export const primaryPolicies = ['greedy', 'seeded-legal'] as const;
export const tiers = [0, 3] as const satisfies readonly BalanceTier[];
export const primarySeeds = Array.from({ length: 12 }, (_, index) => `squabblehouse-primary-district-${String(index + 1).padStart(2, '0')}`);
export const primaryRotations = [0, 2, 5] as const;
export const holdoutSeeds = Array.from({ length: 6 }, (_, index) => `squabblehouse-counter-confirmation-district-${String(index + 1).padStart(2, '0')}`);
export const holdoutRotations = [1, 6] as const;
export const changedAbilityCardIds = ['griddle-master', 'squabblehouse-cashier', 'janitor'] as const;

export type Phase = 'before' | 'after';
export type ScheduleKind = 'primary' | 'holdout';
export type Policy = typeof primaryPolicies[number];
export type Shard = `${typeof opponentIds[number]}:${Policy}:${ScheduleKind}`;
export type JsonRecord = Record<string, any>;
export type Block = {
  matchup: string;
  policy: Policy;
  schedule: {
    set: 'pilot' | 'primary' | 'fresh-holdout';
    seeds: readonly string[];
    rotations: readonly number[];
    tiers: readonly number[];
    mirroredSeats: boolean;
    allowSquabble: boolean;
  };
  expectedMatches: number;
  matrix: JsonRecord;
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

export function insist(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function stableEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function walkSourceFiles(directory: string): string[] {
  if (!existsSync(directory) || !statSync(directory).isDirectory()) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return walkSourceFiles(fullPath);
    return entry.isFile() && entry.name.endsWith('.ts') ? [fullPath] : [];
  });
}

export function sourceFileListAt(sourceRoot: string): string[] {
  const engineFiles = [
    'lib/squabblemon-engine/package.json',
    ...walkSourceFiles(path.join(sourceRoot, 'lib/squabblemon-engine/src'))
      .map(file => path.relative(sourceRoot, file)),
  ];
  const scriptCandidates = [
    'scripts/package.json',
    'scripts/tsconfig.json',
    'tsconfig.base.json',
    ...walkSourceFiles(path.join(sourceRoot, 'scripts/src'))
      .map(file => path.relative(sourceRoot, file)),
  ];
  const scriptFiles = scriptCandidates.filter(file => existsSync(path.join(sourceRoot, file)));
  return [...new Set([...engineFiles, ...scriptFiles])].sort();
}

export function sourceFingerprintsAt(sourceRoot: string): Record<string, string> {
  return Object.fromEntries(sourceFileListAt(sourceRoot).map(file => {
    const sourcePath = path.join(sourceRoot, file);
    return [file, sha256(readFileSync(sourcePath))];
  }));
}

export const sharedHarnessSourceFiles = [
  'scripts/src/squabblehouse-balance-sweep.ts',
  'scripts/src/balance-sweep-telemetry.ts',
  'scripts/src/counterbenchmarkChecks.ts',
  'scripts/src/squabblehouse-counterbenchmark.ts',
  'scripts/src/squabblehouse-counterbenchmark.test.ts',
] as const;

export function assertSharedHarnessFingerprintMatch(
  actual: Record<string, string>,
  expected: Record<string, string>,
  phase: Phase,
): void {
  for (const file of sharedHarnessSourceFiles) {
    insist(actual[file] && expected[file] && actual[file] === expected[file],
      `${phase} shared harness fingerprint changed or is missing ${file}`);
  }
}

export function engineSourceHashes(fingerprints: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(fingerprints).filter(([file]) => file.startsWith('lib/squabblemon-engine/')));
}

export function assertFrozenV30EngineHashes(
  actual: Record<string, string>,
  fixedArchive: Record<string, string>,
): void {
  insist(stableEqual(actual, fixedArchive),
    'Before v30 full recursive engine source tree does not match the fixed Git archive');
}

const legacyAcceptedEngineFiles = [
  'lib/squabblemon-engine/package.json',
  'lib/squabblemon-engine/src/balanceLab.ts',
  'lib/squabblemon-engine/src/data.ts',
  'lib/squabblemon-engine/src/gameEngine.ts',
  'lib/squabblemon-engine/src/districts.ts',
  'lib/squabblemon-engine/src/squabblehouseWave.ts',
  'lib/squabblemon-engine/src/creativeReworks.ts',
  'lib/squabblemon-engine/src/rosterBalance.ts',
  'lib/squabblemon-engine/src/multiplayer.ts',
] as const;

export function legacyAcceptedEngineHashes(fingerprints: Record<string, string>): Record<string, string> {
  return Object.fromEntries(legacyAcceptedEngineFiles.map(file => [file, fingerprints[file]]));
}

export function enginePackageAt(sourceRoot: string): JsonRecord {
  return JSON.parse(readFileSync(path.join(sourceRoot, 'lib/squabblemon-engine/package.json'), 'utf8')) as JsonRecord;
}

export function getDefaultsAndValidate(): BalanceDeck[] {
  const opponents = getDefaults();
  insist(stableEqual(opponents.map(opponent => opponent.id), opponentIds), 'Canonical counterbenchmark opponents are missing or reordered');
  for (const opponent of opponents) {
    insist(opponent.cardIds.length === 10 && new Set(opponent.cardIds).size === 10, `Opponent ${opponent.id} has an invalid roster`);
    insist(opponent.orderKey === undefined || typeof opponent.orderKey === 'string', `Opponent ${opponent.id} has an invalid ordering key`);
  }
  return opponents;
}

export function assertCrewIdentity(actual: BalanceDeck, expected: BalanceDeck = CREW): void {
  insist(stableEqual(actual, expected), 'Diner counterbenchmark roster, deck ID, name, or slot order mismatch');
  insist(actual.cardIds.length === 10 && new Set(actual.cardIds).size === 10, 'Diner counterbenchmark crew must contain ten unique cards');
  insist(actual.cardIds.join('|') === DINER_CREW_IDS.join('|'), 'Diner counterbenchmark roster/slot order changed');
  for (const cardId of actual.cardIds) insist(cards[cardId], `Diner counterbenchmark has unknown runtime card ${cardId}`);
  insist(!actual.cardIds.some(cardId => cardId === 'cane-corso-red' || cardId === 'blue-nose-pit'), 'Diner counterbenchmark cannot contain dog/gang cards');
  insist(cards.sideofhands.kind === 'support', 'Side of Hands must remain a support card in the diner roster');
  const authoredRecipe = decks.find(deck => deck.id === 'squabblehouse-shift');
  insist(authoredRecipe?.cards.join('|') === DINER_CREW_IDS.join('|'), 'Current SQUABBLEHOUSE SHIFT differs from the frozen nine-staff-plus-support roster');
}

export function checkPhaseVersion(phase: Phase, cardBalanceVersion: number, onlineRulesVersion: number): void {
  const expected = phase === 'before' ? OLD_CARD_BALANCE_VERSION : NEW_CARD_BALANCE_VERSION;
  insist(cardBalanceVersion === expected, `${phase} phase expected card-balance version ${expected}, got ${cardBalanceVersion}`);
  insist(onlineRulesVersion === expected, `${phase} phase expected online-rules version ${expected}, got ${onlineRulesVersion}`);
}

export function assertSourceFingerprintMatch(
  actual: Record<string, string>,
  expected: Record<string, string>,
  phase: Phase,
): void {
  insist(stableEqual(actual, expected), `${phase} report source fingerprints changed`);
}

export function assertOpponentIdentity(actual: readonly BalanceDeck[], expected: readonly BalanceDeck[]): void {
  insist(stableEqual(actual, expected), 'Before/after opponent IDs, rosters, or ordering mismatch');
}

export function assertRuntimeKitPair(
  before: JsonRecord,
  after: JsonRecord,
  crewCardIds: readonly string[] = DINER_CREW_IDS,
  opponentCardIds: readonly string[] = [],
): void {
  insist(stableEqual(Object.keys(before).sort(), Object.keys(after).sort()), 'Before/after runtime kit card IDs differ');
  const crewIds = new Set(crewCardIds);
  const opponentIds = new Set(opponentCardIds);
  const expectedIds = [...new Set([...crewCardIds, ...opponentCardIds])].sort();
  insist(stableEqual(Object.keys(before).sort(), expectedIds), 'Runtime kits are missing or include unexpected crew/opponent cards');
  for (const cardId of Object.keys(before)) {
    if (opponentIds.has(cardId) || !crewIds.has(cardId) || !changedAbilityCardIds.includes(cardId as typeof changedAbilityCardIds[number])) {
      insist(stableEqual(before[cardId], after[cardId]),
        `Before/after runtime kit changed outside selected crew ability metadata: ${cardId}`);
      continue;
    }
    const beforeStats = JSON.parse(JSON.stringify(before[cardId])) as JsonRecord;
    const afterStats = JSON.parse(JSON.stringify(after[cardId])) as JsonRecord;
    for (const kit of [beforeStats, afterStats]) {
      delete kit.ability;
      delete kit.effect;
      delete kit.abilityUpgradeCount;
      delete kit.abilityUpgrades;
    }
    insist(stableEqual(beforeStats, afterStats),
      `Before/after crew kit changed beyond ability metadata for ${cardId} (including printed stats, cost, or rarity)`);
  }
  for (const cardId of changedAbilityCardIds) {
    insist(crewIds.has(cardId) && before[cardId] && after[cardId],
      `Runtime kit pair is missing selected crew ability card ${cardId}`);
    const beforeAbility = {
      ability: before[cardId].ability,
      effect: before[cardId].effect,
      abilityUpgradeCount: before[cardId].abilityUpgradeCount,
      abilityUpgrades: before[cardId].abilityUpgrades,
    };
    const afterAbility = {
      ability: after[cardId].ability,
      effect: after[cardId].effect,
      abilityUpgradeCount: after[cardId].abilityUpgradeCount,
      abilityUpgrades: after[cardId].abilityUpgrades,
    };
    insist(!stableEqual(beforeAbility, afterAbility),
      `Expected selected crew ability metadata to differ for ${cardId}`);
  }
}

export function assertAcceptedV30Metadata(report: JsonRecord, acceptedReportPath: string): void {
  insist(report.experiment === 'paired-current-rules-squabblehouse-diner-comparison' && report.crew === 'diner',
    'The accepted v30 reference must be the accepted paired diner report');
  insist(report.versionMetadata?.cardBalanceVersion === OLD_CARD_BALANCE_VERSION
    && report.versionMetadata?.onlineRulesVersion === OLD_CARD_BALANCE_VERSION,
  'Accepted diner reference is not a v30 balance/rules report');
  insist(stableEqual(report.configuration?.crew?.cardIds, DINER_CREW_IDS)
    && report.configuration?.crew?.orderKey === SHELL_ORDER_KEY,
  'Accepted DINER v30 report does not have the exact shared diner roster and shell-v1 orderKey');
  insist(statSync(acceptedReportPath).isFile(), `Accepted diner report is missing: ${acceptedReportPath}`);
}

export function assertAcceptedV30Report(
  report: JsonRecord,
  acceptedReportPath: string,
  archivedFingerprints: Record<string, string>,
): void {
  assertAcceptedV30Metadata(report, acceptedReportPath);
  insist(stableEqual(report.versionMetadata?.engineSourceSha256, legacyAcceptedEngineHashes(archivedFingerprints)),
    'The archived v30 engine source SHA-256 does not match the accepted DINER v30 report');
}

export function scheduleFingerprint(
  phase: Phase,
  fingerprints: Record<string, string>,
  sourceIdentity: JsonRecord,
  opponents: readonly BalanceDeck[],
): string {
  return sha256(JSON.stringify({
    phase,
    sourceIdentity,
    fingerprints,
    opponents,
    crew: CREW,
    crewRole: CREW_ROLE,
    phaseCrewRole: PHASE_CREW_ROLES[phase],
    matchPairId: MATCH_PAIR_ID,
    primary: { seeds: primarySeeds, rotations: primaryRotations, tiers, policies: primaryPolicies },
    holdout: { seeds: holdoutSeeds, rotations: holdoutRotations, tiers, policy: 'greedy' },
    allowSquabble: true,
    orderKey: SHELL_ORDER_KEY,
  }));
}

export function checkImportBinding(sourceRoot: string, importMetaResolve: (specifier: string) => string): Record<string, string> {
  const resolved = {
    data: importMetaResolve('@workspace/squabblemon-engine/data'),
    balanceLab: importMetaResolve('@workspace/squabblemon-engine/balanceLab'),
    multiplayer: importMetaResolve('@workspace/squabblemon-engine/multiplayer'),
  };
  const realResolved = Object.fromEntries(Object.entries(resolved).map(([name, file]) => [name, path.resolve(file)]));
  for (const [moduleName, resolvedPath] of Object.entries(realResolved)) {
    const expectedPath = path.resolve(sourceRoot, 'lib/squabblemon-engine/src', `${moduleName === 'balanceLab' ? 'balanceLab' : moduleName}.ts`);
    insist(resolvedPath === expectedPath, `${moduleName} import resolved to ${resolvedPath}, not the ${sourceRoot} snapshot engine ${expectedPath}`);
  }
  return realResolved;
}

export function assertCompleteBlock(
  block: Block | JsonRecord,
  crew: BalanceDeck,
  opponent: BalanceDeck,
  policy: Policy,
  seeds: readonly string[],
  rotations: readonly number[],
  schedule: 'pilot' | ScheduleKind,
): Set<string> {
  const expectedSet = schedule === 'pilot' ? 'pilot' : schedule === 'holdout' ? 'fresh-holdout' : 'primary';
  const expectedCount = seeds.length * rotations.length * tiers.length * 2;
  insist(block.matchup === `${crew.id}-vs-${opponent.id}` && block.policy === policy, 'Block crew/opponent/policy identity mismatch');
  insist(block.schedule?.set === expectedSet
    && stableEqual(block.schedule.seeds, seeds)
    && stableEqual(block.schedule.rotations, rotations)
    && stableEqual(block.schedule.tiers, tiers)
    && block.schedule.mirroredSeats === true
    && block.schedule.allowSquabble === true,
  `${expectedSet} block schedule/roster settings do not match the frozen case axes`);
  insist(block.expectedMatches === expectedCount, `${expectedSet} block expectedMatches must be exactly ${expectedCount}`);
  const matrix = block.matrix as JsonRecord | undefined;
  insist(matrix && matrix.telemetrySchemaVersion === BALANCE_LAB_SCHEMA_VERSION
    && matrix.matchCount === expectedCount && matrix.successfulMatches === expectedCount && matrix.failedMatches === 0
    && Array.isArray(matrix.failures) && matrix.failures.length === 0,
  `${expectedSet} matrix must have exact schema, successes, and zero failures`);
  insist(block.rawFailures?.length === 0, `${expectedSet} raw simulation has failures`);
  insist(block.rawResults?.length === expectedCount, `${expectedSet} raw match count must be exactly ${expectedCount}`);
  insist(block.crewCardEventObservations?.length === expectedCount, `${expectedSet} needs one observation per raw match`);
  const keys = new Set<string>();
  const rotationSet = new Set(rotations);
  for (const result of block.rawResults as BalanceMatchResult[]) {
    insist(result.deckAId === crew.id && result.deckBId === opponent.id
      && result.telemetrySchemaVersion === BALANCE_LAB_SCHEMA_VERSION,
    `${expectedSet} raw result has wrong crew/opponent/schema`);
    insist(result.logicalWinner === 'a' || result.logicalWinner === 'b' || result.logicalWinner === 'draw',
      `${expectedSet} raw result has an invalid logical winner`);
    insist(seeds.includes(result.districtSeed) && rotationSet.has(result.rotation)
      && tiers.includes(result.tier as 0 | 3)
      && (result.seat === 'a-player' || result.seat === 'b-player'),
    `${expectedSet} raw result is outside expected seeds, rotations, tiers, or seats`);
    const key = caseKey(result);
    insist(!keys.has(key), `${expectedSet} contains duplicate Cartesian case ${key.replaceAll('\u0000', '/')}`);
    keys.add(key);
  }
  const expectedKeys = new Set<string>();
  for (const seed of seeds) for (const rotation of rotations) for (const tier of tiers) {
    for (const seat of ['a-player', 'b-player'] as const) expectedKeys.add(caseKey({ districtSeed: seed, rotation, tier, seat }));
  }
  insist(keys.size === expectedCount && stableEqual([...keys].sort(), [...expectedKeys].sort()),
    `${expectedSet} raw results are missing or outside exact Cartesian case keys`);
  assertRawMatrixParity(block, crew, opponent);
  return keys;
}

function outcomeCounts(results: readonly BalanceMatchResult[], side: 'a' | 'b') {
  return results.reduce((counts, result) => {
    if (result.logicalWinner === 'draw') counts.draws += 1;
    else if (result.logicalWinner === side) counts.wins += 1;
    else counts.losses += 1;
    counts.games += 1;
    return counts;
  }, { games: 0, wins: 0, losses: 0, draws: 0 });
}

export function assertRawMatrixParity(block: Block | JsonRecord, crew: BalanceDeck, opponent: BalanceDeck): void {
  const matrix = block.matrix as JsonRecord;
  const rawResults = block.rawResults as BalanceMatchResult[];
  const rawFailures = block.rawFailures as unknown[];
  const matrixA = matrix.decks?.find((deck: JsonRecord) => deck.deckId === crew.id);
  const matrixB = matrix.decks?.find((deck: JsonRecord) => deck.deckId === opponent.id);
  const expectedA = outcomeCounts(rawResults, 'a');
  const expectedB = outcomeCounts(rawResults, 'b');
  const deckAOutcomeCounts = !!matrixA && ['games', 'wins', 'losses', 'draws'].every(key => matrixA[key] === expectedA[key as keyof typeof expectedA]);
  const deckBOutcomeCounts = !!matrixB && ['games', 'wins', 'losses', 'draws'].every(key => matrixB[key] === expectedB[key as keyof typeof expectedB]);
  const computedParity = {
    successfulMatches: matrix.successfulMatches === rawResults.length,
    failedMatches: matrix.failedMatches === rawFailures.length,
    deckAOutcomeCounts,
    deckBOutcomeCounts,
  };
  insist(block.matrixParity && Object.entries(computedParity).every(([key, matches]) => matches && block.matrixParity[key] === matches),
    `Matrix/raw outcome parity does not match the actual raw results: ${JSON.stringify({ computedParity, reportedParity: block.matrixParity })}`);
}

export function assertReportIdentity(
  report: JsonRecord,
  phase: Phase,
  fingerprints: Record<string, string>,
  scheduleHash: string,
  pilot: boolean,
): void {
  checkPhaseVersion(phase, report.versionMetadata?.cardBalanceVersion, report.versionMetadata?.onlineRulesVersion);
  insist(report.schemaVersion === BALANCE_LAB_SCHEMA_VERSION
    && report.versionMetadata?.balanceLabSchemaVersion === BALANCE_LAB_SCHEMA_VERSION,
  `${phase} report balanceLab schema mismatch`);
  insist(report.experiment === 'paired-squabblehouse-counterbenchmark-v30-v31'
    && report.phase === phase
    && report.phaseCrewRole === PHASE_CREW_ROLES[phase]
    && report.crewRole === CREW_ROLE
    && report.matchPairId === MATCH_PAIR_ID,
  `${phase} report phase, crew role, or pair identity mismatch`);
  assertCrewIdentity(report.configuration?.crew as BalanceDeck);
  insist(stableEqual(report.configuration?.crew, CREW)
    && report.configuration?.crewRole === CREW_ROLE
    && report.configuration?.phaseCrewRole === PHASE_CREW_ROLES[phase]
    && report.configuration?.matchPairId === MATCH_PAIR_ID,
  `${phase} report has a mismatched diner roster, phase role, or pair identity`);
  insist(report.configuration?.sharedOrderKey === SHELL_ORDER_KEY, `${phase} report orderKey is not shell-v1`);
  assertSourceFingerprintMatch(report.configuration?.sourceFingerprints, fingerprints, phase);
  insist(stableEqual(report.versionMetadata?.engineSourceSha256, engineSourceHashes(fingerprints)), `${phase} report engine source hashes mismatch`);
  insist(report.scheduleFingerprint === scheduleHash, `${phase} report schedule/source fingerprint mismatch`);
  const expectedDeterministicFingerprint = sha256(JSON.stringify({
    phase,
    scheduleFingerprint: scheduleHash,
    crew: CREW,
    crewRole: CREW_ROLE,
    phaseCrewRole: PHASE_CREW_ROLES[phase],
    matchPairId: MATCH_PAIR_ID,
    pilot,
  }));
  insist(report.deterministicFingerprint === expectedDeterministicFingerprint, `${phase} report deterministic fingerprint mismatch`);
  assertOpponentIdentity(report.configuration?.opponents, getDefaultsAndValidate());
  insist(Array.isArray(report.failures) && report.failures.length === 0, `${phase} report contains failures`);
}

export function expectedScheduleFor(shard: { schedule: ScheduleKind }) {
  return shard.schedule === 'primary'
    ? { seeds: primarySeeds, rotations: primaryRotations, schedule: 'primary' as const }
    : { seeds: holdoutSeeds, rotations: holdoutRotations, schedule: 'holdout' as const };
}

export function expectedShardSpecs(): Shard[] {
  return [
    ...opponentIds.flatMap(opponent => primaryPolicies.map(policy => `${opponent}:${policy}:primary` as Shard)),
    ...opponentIds.map(opponent => `${opponent}:greedy:holdout` as Shard),
  ];
}

export function caseKey(match: Pick<BalanceMatchResult, 'districtSeed' | 'rotation' | 'tier' | 'seat'>): string {
  return `${match.districtSeed}\u0000${match.rotation}\u0000${match.tier}\u0000${match.seat}`;
}

export function assertMatchedCaseMaps(
  beforeCaseMap: ReadonlyMap<string, ReadonlySet<string>>,
  afterCaseMap: ReadonlyMap<string, ReadonlySet<string>>,
): void {
  insist(beforeCaseMap.size === 9 && afterCaseMap.size === 9, 'Before and after must each contain exactly nine paired opponent/policy/schedule blocks');
  insist(stableEqual([...beforeCaseMap.keys()].sort(), [...afterCaseMap.keys()].sort()), 'Before/after opponent, policy, or schedule block keys mismatch');
  for (const [blockKey, beforeKeys] of beforeCaseMap) {
    const afterKeys = afterCaseMap.get(blockKey);
    insist(afterKeys, `After report is missing paired case block ${blockKey}`);
    insist(stableEqual([...beforeKeys].sort(), [...afterKeys].sort()), `Before/after Cartesian case keys differ for ${blockKey}`);
  }
}

export function blockCaseMap(report: JsonRecord, phase: Phase): Map<string, Set<string>> {
  const expectedSpecs = expectedShardSpecs();
  const expectedSpecSet = new Set(expectedSpecs);
  insist(report.shardCount === 9 && report.blocks?.length === 9, `${phase} merged report must have exactly nine shard blocks`);
  insist(Array.isArray(report.failures) && report.failures.length === 0, `${phase} merged report contains failures`);
  const seenBlocks = new Set<string>();
  const caseMap = new Map<string, Set<string>>();
  let total = 0;
  for (const block of report.blocks as Block[]) {
    const opponentId = opponentIds.find(id => block.matchup === `${CREW.id}-vs-${id}`);
    insist(opponentId, `${phase} merged report references an unknown opponent`);
    const schedule = block.schedule.set === 'fresh-holdout' ? 'holdout' : block.schedule.set;
    const spec = `${opponentId}:${block.policy}:${schedule}`;
    insist(expectedSpecSet.has(spec as Shard) && !seenBlocks.has(spec), `${phase} merged report has unexpected or duplicate block ${spec}`);
    seenBlocks.add(spec);
    const parsed = { opponent: opponentId, policy: block.policy, schedule } as { opponent: typeof opponentIds[number]; policy: Policy; schedule: ScheduleKind };
    const axes = expectedScheduleFor(parsed);
    const opponent = getDefaultsAndValidate().find(candidate => candidate.id === opponentId)!;
    const keys = assertCompleteBlock(block, CREW, opponent, parsed.policy, axes.seeds, axes.rotations, axes.schedule);
    caseMap.set(spec, keys);
    total += keys.size;
  }
  insist(seenBlocks.size === expectedSpecs.length && total === 1008, `${phase} merged report must cover exactly 1,008 unique case keys`);
  insist(report.simulationAccounting?.uniqueRequestedMatchups === 1008
    && report.simulationAccounting?.rawRetainedSamples === 1008
    && report.simulationAccounting?.matrixValidationReplays === 1008
    && report.simulationAccounting?.engineSimulationAttempts === 2016,
  `${phase} merged report simulation accounting is not exactly 1,008 unique / 2,016 executions`);
  return caseMap;
}

export function buildReport(phase: Phase, blocks: Block[], fingerprints: Record<string, string>, scheduleHash: string, pilot: boolean, sourceIdentity: JsonRecord, sourceRoot: string): JsonRecord {
  const opponents = getDefaultsAndValidate();
  const enginePackage = enginePackageAt(sourceRoot);
  const report = {
    schemaVersion: BALANCE_LAB_SCHEMA_VERSION,
    experiment: 'paired-squabblehouse-counterbenchmark-v30-v31',
    phase,
    phaseCrewRole: PHASE_CREW_ROLES[phase],
    crewRole: CREW_ROLE,
    matchPairId: MATCH_PAIR_ID,
    pilot,
    deterministicFingerprint: sha256(JSON.stringify({
      phase,
      scheduleFingerprint: scheduleHash,
      crew: CREW,
      crewRole: CREW_ROLE,
      phaseCrewRole: PHASE_CREW_ROLES[phase],
      matchPairId: MATCH_PAIR_ID,
      pilot,
    })),
    scheduleFingerprint: scheduleHash,
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    gitCommit: sourceIdentity.sourceRootCommit,
    sourceRoot,
    sourceRootKind: sourceIdentity.sourceRootKind,
    versionMetadata: {
      enginePackage,
      balanceLabSchemaVersion: BALANCE_LAB_SCHEMA_VERSION,
      cardBalanceVersion: CARD_BALANCE_VERSION,
      onlineRulesVersion: ONLINE_RULES_VERSION,
      engineSourceSha256: engineSourceHashes(fingerprints),
      sourceRootCommit: sourceIdentity.sourceRootCommit,
    },
    configuration: {
      phase,
      sourceIdentity,
      sourceFingerprints: fingerprints,
      crew: CREW,
      crewRole: CREW_ROLE,
      phaseCrewRole: PHASE_CREW_ROLES[phase],
      matchPairId: MATCH_PAIR_ID,
      opponents,
      sharedOrderKey: SHELL_ORDER_KEY,
      schedule: {
        pilot,
        primarySeeds: pilot ? ['squabblehouse-counter-pilot-district-01'] : primarySeeds,
        primaryRotations: pilot ? [0] : primaryRotations,
        holdoutSeeds: pilot ? [] : holdoutSeeds,
        holdoutRotations,
        tiers,
        policies: pilot ? ['greedy'] : primaryPolicies,
        holdoutPolicy: 'greedy',
        seats: 'mirrored',
        allowSquabble: true,
      },
      interpretation: [
        'Matched bot-vs-bot composition evidence for the exact same authored SQUABBLEHOUSE SHIFT roster under engine v30 and v31; not human win rates or isolated card strength.',
        'Both phases share deck ID, roster slot order, orderKey shell-v1, opponents, seeds, rotations, tiers, mirrored seats, and policy.',
        'Before and after source roots and engine versions are intentionally different and separately fingerprinted; shard resumes cannot cross source changes.',
        'Fresh confirmation district seeds were unconsumed before this experiment and are greedy-only.',
        'Ability event counts are descriptive only; eligibility denominators and reliability are unknown.',
      ],
    },
    runtimeCardKits: runtimeKitsFor([...new Set([...CREW.cardIds, ...opponents.flatMap(deck => deck.cardIds)])]),
    blocks,
    failures: blocks.flatMap(block => [
      ...((block.matrix.failures ?? []) as unknown[]).map(failure => ({ matchup: block.matchup, policy: block.policy, source: 'runBalanceMatrix', failure })),
      ...block.rawFailures.map(failure => ({ matchup: block.matchup, policy: block.policy, source: 'simulateBalanceMatch', failure })),
    ]),
    simulationAccounting: {
      uniqueRequestedMatchups: blocks.reduce((total, block) => total + block.expectedMatches, 0),
      rawRetainedSamples: blocks.reduce((total, block) => total + block.rawResults.length, 0),
      matrixValidationReplays: blocks.reduce((total, block) => total + block.matrix.matchCount, 0),
      engineSimulationAttempts: blocks.reduce((total, block) => total + block.matrix.matchCount + block.rawResults.length + block.rawFailures.length, 0),
      note: 'Matrix and raw captured executions are duplicate validations per unique requested case, not independent samples.',
    },
  };
  assertSweepTelemetry(report);
  return report;
}

export function runtimeKitsFor(cardIds: readonly string[]): JsonRecord {
  const byEngineId = new Map(cardCatalog.map(card => [card.engineId, card]));
  return Object.fromEntries(cardIds.map(id => {
    const card = cards[id];
    const catalogCard = byEngineId.get(id);
    insist(catalogCard, `Runtime catalog entry is missing rarity metadata for ${id}`);
    return [id, {
      ...kit(id),
      rarity: catalogCard.rarity,
      abilityUpgrades: card.abilityUpgrades.map(upgrade => ({
        id: upgrade.id,
        name: upgrade.name,
        description: upgrade.description,
        unlockLevel: upgrade.unlockLevel,
        effect: upgrade.effect,
      })),
    }];
  }));
}