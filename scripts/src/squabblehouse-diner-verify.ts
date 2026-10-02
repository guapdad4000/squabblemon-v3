/**
 * Mandatory independent acceptance gate for paired comparison readouts.
 *
 * Full acceptance (after merging the unchanged runner's 18 shard JSON files):
 *   pnpm --filter @workspace/scripts exec tsx src/squabblehouse-diner-verify.ts --merged
 * Or validate the 18 unmerged shard files directly:
 *   pnpm --filter @workspace/scripts exec tsx src/squabblehouse-diner-verify.ts --shards
 *
 * `pilot-fixture` is a programmatic unit-test-only validation mode. The CLI
 * always requires the exact full 1,008 cases per crew and never accepts pilots.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BALANCE_LAB_SCHEMA_VERSION,
} from '@workspace/squabblemon-engine/balanceLab';
import { CARD_BALANCE_VERSION, ONLINE_RULES_VERSION } from '@workspace/squabblemon-engine/multiplayer';
import {
  CREWS,
  CREW_ROLE_LABELS,
  crewFingerprint,
  getSchedules,
  validateDinerRoster,
} from './squabblehouse-diner-comparison';
import { getDefaults } from './squabblehouse-balance-sweep';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const comparisonRoot = path.join(root, 'scripts/results/squabblehouse-diner-comparison');
const crewNames = ['current-baseline', 'diner'] as const;
type CrewName = typeof crewNames[number];
type ValidationMode = 'full' | 'pilot-fixture';
type RecordValue = Record<string, any>;
const opponentIds = ['focus-wonderland', 'focus-fire-guap', 'focus-wiz'] as const;
const primaryPolicyIds = ['greedy', 'seeded-legal'] as const;
const expectedShardNames = [
  ...opponentIds.flatMap(opponent => primaryPolicyIds.map(policy => `${opponent}-${policy}-primary`)),
  ...opponentIds.map(opponent => `${opponent}-greedy-holdout`),
];
const sourceFiles = [
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
const pilotExpectedSeeds = ['squabblehouse-diner-pilot-district-01'];
const pilotExpectedRotations = [0];
const pilotExpectedTiers = [0, 3];
const seats = ['a-player', 'b-player'] as const;

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function insist(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function stableEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function axisKey(value: RecordValue): string {
  return `${value.districtSeed}\u0000${value.rotation}\u0000${value.tier}\u0000${value.seat}`;
}

export function currentSourceFingerprints(): Record<string, string> {
  return Object.fromEntries(sourceFiles.map(file => [
    file,
    sha256(readFileSync(path.join(root, file))),
  ]));
}

export function expectedScheduleFingerprint(fingerprints = currentSourceFingerprints()): string {
  const schedules = getSchedules(false);
  const opponents = getDefaults();
  return sha256(JSON.stringify({
    fingerprints,
    opponents,
    primary: {
      seeds: schedules.primarySeeds,
      rotations: schedules.primaryRotations,
      tiers: [0, 3],
      policies: ['greedy', 'seeded-legal'],
    },
    holdout: {
      seeds: schedules.holdoutSeeds,
      rotations: schedules.holdoutRotations,
      tiers: [0, 3],
      policy: 'greedy',
    },
    allowSquabble: true,
    orderKey: 'squabblehouse-balance-shell-v1',
    comparisonCrews: CREWS,
    crewRoleLabels: CREW_ROLE_LABELS,
  }));
}

function currentEnginePackage(): RecordValue {
  return JSON.parse(readFileSync(path.join(root, 'lib/squabblemon-engine/package.json'), 'utf8'));
}

function assertSourceFingerprints(report: RecordValue, expected: Record<string, string>): void {
  const actual = report.configuration?.sourceFingerprints;
  insist(actual && typeof actual === 'object' && !Array.isArray(actual), 'Report is missing source fingerprint map');
  insist(stableEqual(Object.keys(actual).sort(), Object.keys(expected).sort()), 'Report source fingerprint paths do not match current frozen source manifest');
  for (const file of sourceFiles) insist(actual[file] === expected[file], `Source SHA-256 mismatch: ${file}`);
  const expectedEngine = Object.fromEntries(Object.entries(expected).filter(([file]) => file.startsWith('lib/squabblemon-engine/')));
  insist(stableEqual(report.versionMetadata?.engineSourceSha256, expectedEngine), 'Engine-source SHA-256 metadata does not match the frozen engine files');
}

function assertReportIdentity(report: RecordValue, crewName: CrewName, expectedSources: Record<string, string>, scheduleFingerprint: string, pilot: boolean): void {
  const deck = CREWS[crewName];
  insist(report.schemaVersion === BALANCE_LAB_SCHEMA_VERSION, `${crewName} report has an unexpected telemetry schema`);
  insist(report.versionMetadata?.balanceLabSchemaVersion === BALANCE_LAB_SCHEMA_VERSION, `${crewName} report balance schema does not match`);
  insist(report.versionMetadata?.cardBalanceVersion === CARD_BALANCE_VERSION, `${crewName} report card balance version does not match current engine`);
  insist(report.versionMetadata?.onlineRulesVersion === ONLINE_RULES_VERSION, `${crewName} report online rules version does not match current engine`);
  insist(stableEqual(report.versionMetadata?.enginePackage, currentEnginePackage()), `${crewName} report engine package metadata does not match`);
  insist(report.crew === crewName, `Wrong crew role in ${crewName} report`);
  insist(report.crewRole === CREW_ROLE_LABELS[crewName], `Wrong provided crew role label for ${crewName}`);
  insist(report.pilot === pilot, `${crewName} report pilot/full mode mismatch`);
  insist(report.experiment === 'paired-current-rules-squabblehouse-diner-comparison', `${crewName} report is not from the paired diner comparison`);
  insist(stableEqual(report.configuration?.crew, deck), `${crewName} exact frozen roster, shared deck ID, name, or orderKey changed`);
  insist(report.configuration?.crewRole === CREW_ROLE_LABELS[crewName], `${crewName} configuration role label mismatch`);
  insist(stableEqual(report.configuration?.pairedComparisonCrews, CREWS), `${crewName} report does not bind both frozen crew maps`);
  insist(stableEqual(report.configuration?.crewRoleLabels, CREW_ROLE_LABELS), `${crewName} report does not bind both crew roles`);
  insist(stableEqual(report.configuration?.sharedOrderKey, 'squabblehouse-balance-shell-v1'), `${crewName} shared orderKey mismatch`);
  insist(stableEqual(report.configuration?.opponents, getDefaults()), `${crewName} opponent rosters/order changed`);
  insist(report.scheduleFingerprint === scheduleFingerprint, `${crewName} deterministic schedule fingerprint mismatch`);
  insist(report.deterministicFingerprint === crewFingerprint(scheduleFingerprint, crewName, pilot), `${crewName} role/source deterministic fingerprint mismatch`);
  assertSourceFingerprints(report, expectedSources);
  insist(Array.isArray(report.blocks), `${crewName} report is missing blocks`);
  insist(Array.isArray(report.failures) && report.failures.length === 0, `${crewName} report contains recorded failures`);
  const expectedSchedule = getSchedules(pilot);
  insist(stableEqual(report.configuration?.schedule, expectedSchedule), `${crewName} configured schedule axes/order are not current`);
}

function fullBlocksForCrew(report: RecordValue, crewName: CrewName): RecordValue[] {
  const expected = new Map<string, string>();
  for (const opponent of opponentIds) {
    for (const policy of primaryPolicyIds) expected.set(`${opponent}:${policy}:primary`, 'primary');
    expected.set(`${opponent}:greedy:holdout`, 'fresh-holdout');
  }
  const blocks = report.blocks as RecordValue[];
  insist(report.shardCount === 9, `${crewName} merged report must declare exactly nine shards`);
  insist(blocks.length === expected.size, `${crewName} must contain exactly nine schedule blocks`);
  const seen = new Set<string>();
  for (const block of blocks) {
    const match = /^squabblehouse-staff-shell-vs-(focus-wonderland|focus-fire-guap|focus-wiz)$/.exec(block.matchup ?? '');
    insist(match, `${crewName} block has an unexpected matchup/opponent`);
    const opponent = match[1];
    const scheduleKind = block.schedule?.set === 'fresh-holdout' ? 'holdout' : block.schedule?.set;
    const key = `${opponent}:${block.policy}:${scheduleKind}`;
    insist(expected.has(key), `${crewName} has an unexpected or wrong-policy block ${key}`);
    insist(!seen.has(key), `${crewName} contains duplicate block ${key}`);
    seen.add(key);
    insist(block.schedule?.mirroredSeats === true && block.schedule?.allowSquabble === true, `${crewName} ${key} is not mirrored with SQUABBLE enabled`);
  }
  insist(seen.size === expected.size, `${crewName} has missing opponent/policy/schedule blocks`);
  return blocks;
}

function expectedAxes(scheduleKind: 'primary' | 'holdout') {
  const schedules = getSchedules(false);
  return {
    seeds: scheduleKind === 'primary' ? schedules.primarySeeds : schedules.holdoutSeeds,
    rotations: scheduleKind === 'primary' ? schedules.primaryRotations : schedules.holdoutRotations,
    tiers: [0, 3],
  };
}

function validateBlock(block: RecordValue, crewName: CrewName, mode: ValidationMode, expectedOpponent: string): { caseKeys: Set<string>; uniqueCaseCount: number } {
  const expectedSchedule = block.schedule?.set;
  const scheduleKind = expectedSchedule === 'fresh-holdout' ? 'holdout' : expectedSchedule;
  insist(scheduleKind === 'primary' || scheduleKind === 'holdout' || (mode === 'pilot-fixture' && scheduleKind === 'pilot'),
    `${crewName} block has an unsupported schedule set`);
  const axes = scheduleKind === 'pilot'
    ? { seeds: pilotExpectedSeeds, rotations: pilotExpectedRotations, tiers: pilotExpectedTiers }
    : expectedAxes(scheduleKind);
  const expectedCount = axes.seeds.length * axes.rotations.length * axes.tiers.length * seats.length;
  const expectedMatches = mode === 'full' ? scheduleKind === 'primary' ? 144 : 48 : expectedCount;
  insist(block.expectedMatches === expectedMatches, `${crewName} ${block.matchup}/${block.policy}/${scheduleKind} expectedMatches must be ${expectedMatches}`);
  insist(stableEqual(block.schedule?.seeds, axes.seeds), `${crewName} block seed axis mismatch`);
  insist(stableEqual(block.schedule?.rotations, axes.rotations), `${crewName} block rotation axis mismatch`);
  insist(stableEqual(block.schedule?.tiers, axes.tiers), `${crewName} block tier axis mismatch`);
  insist(block.schedule?.mirroredSeats === true && block.schedule?.allowSquabble === true, `${crewName} block seat/SQUABBLE settings mismatch`);
  insist(Array.isArray(block.rawFailures) && block.rawFailures.length === 0, `${crewName} block has raw simulation failures`);
  insist(Array.isArray(block.crewCardEventObservations) && block.crewCardEventObservations.length === expectedCount, `${crewName} block lacks one raw observation per requested case`);
  insist(block.matrixParity && ['successfulMatches', 'failedMatches', 'deckAOutcomeCounts', 'deckBOutcomeCounts'].every(key => block.matrixParity[key] === true),
    `${crewName} block matrix/raw parity flags are not all true`);
  const matrix = block.matrix;
  insist(matrix && matrix.telemetrySchemaVersion === BALANCE_LAB_SCHEMA_VERSION, `${crewName} block matrix schema mismatch`);
  insist(matrix.successfulMatches === expectedCount, `${crewName} block matrix successes do not equal expected cases`);
  insist(matrix.failedMatches === 0, `${crewName} block has matrix failures`);
  insist(matrix.matchCount === expectedCount, `${crewName} block matrix attempted count is incomplete`);
  insist(Array.isArray(matrix.failures) && matrix.failures.length === 0, `${crewName} block has matrix failure details`);
  insist(Array.isArray(block.rawResults) && block.rawResults.length === expectedCount, `${crewName} block raw match count is incomplete`);
  const rawCases = new Set<string>();
  for (const result of block.rawResults as RecordValue[]) {
    insist(result.telemetrySchemaVersion === BALANCE_LAB_SCHEMA_VERSION, `${crewName} raw match schema mismatch`);
    insist(axes.seeds.includes(result.districtSeed), `${crewName} raw match has an unexpected district seed`);
    insist(axes.rotations.includes(result.rotation), `${crewName} raw match has an unexpected rotation`);
    insist(axes.tiers.includes(result.tier), `${crewName} raw match has an unexpected tier`);
    insist(seats.includes(result.seat), `${crewName} raw match has an unexpected seat`);
    insist(result.deckAId === CREWS[crewName].id, `${crewName} raw match has wrong crew deck ID`);
    insist(result.deckBId === expectedOpponent, `${crewName} raw match has wrong opponent deck ID`);
    const key = axisKey(result);
    insist(!rawCases.has(key), `${crewName} block contains duplicate raw case ${key.replaceAll('\u0000', '/')}`);
    rawCases.add(key);
  }
  const expectedCases = new Set<string>();
  for (const seed of axes.seeds) for (const rotation of axes.rotations)
    for (const tier of axes.tiers) for (const seat of seats)
      expectedCases.add(axisKey({ districtSeed: seed, rotation, tier, seat }));
  insist(rawCases.size === expectedCount && stableEqual([...rawCases].sort(), [...expectedCases].sort()),
    `${crewName} block is missing or duplicating Cartesian schedule cases`);
  return { caseKeys: rawCases, uniqueCaseCount: rawCases.size };
}

function validateAccounting(report: RecordValue, crewName: CrewName, expectedCases: number): void {
  const accounting = report.simulationAccounting;
  insist(accounting?.uniqueRequestedMatchups === expectedCases, `${crewName} unique requested count must be ${expectedCases}`);
  insist(accounting?.rawRetainedSamples === expectedCases, `${crewName} retained raw sample count must be ${expectedCases}`);
  insist(accounting?.matrixValidationReplays === expectedCases, `${crewName} matrix replay count must be ${expectedCases}`);
  insist(accounting?.engineSimulationAttempts === expectedCases * 2, `${crewName} engine attempts must count raw plus matrix validation executions`);
}

export function verifyComparisonReports(
  baseline: RecordValue,
  diner: RecordValue,
  mode: ValidationMode = 'full',
): RecordValue {
  const pilot = mode === 'pilot-fixture';
  const sources = currentSourceFingerprints();
  const scheduleFingerprint = expectedScheduleFingerprint(sources);
  validateDinerRoster(CREWS.diner.cardIds);
  assertReportIdentity(baseline, 'current-baseline', sources, scheduleFingerprint, pilot);
  assertReportIdentity(diner, 'diner', sources, scheduleFingerprint, pilot);
  const byCrew: Record<CrewName, RecordValue[]> = {
    'current-baseline': pilot ? baseline.blocks : fullBlocksForCrew(baseline, 'current-baseline'),
    diner: pilot ? diner.blocks : fullBlocksForCrew(diner, 'diner'),
  };
  if (pilot) {
    for (const crew of crewNames) insist(byCrew[crew].length === 3, `${crew} pilot fixture must contain one greedy block per opponent`);
    for (const crew of crewNames) {
      for (const block of byCrew[crew]) {
        insist(block.policy === 'greedy' && block.schedule?.set === 'pilot', `${crew} pilot fixture must be greedy-only`);
        insist(opponentIds.some(opponent => block.matchup === `${CREWS[crew].id}-vs-${opponent}`), `${crew} pilot fixture has wrong opponent`);
      }
    }
  }
  const blockMaps = {} as Record<CrewName, Map<string, RecordValue>>;
  const caseMaps = {} as Record<CrewName, Map<string, Set<string>>>;
  let perCrewUnique = {} as Record<CrewName, number>;
  for (const crew of crewNames) {
    blockMaps[crew] = new Map();
    caseMaps[crew] = new Map();
    let count = 0;
    for (const block of byCrew[crew]) {
      const opponent = opponentIds.find(id => block.matchup === `${CREWS[crew].id}-vs-${id}`);
      insist(opponent, `${crew} block has an unmatched opponent`);
      const schedule = block.schedule?.set === 'fresh-holdout' ? 'holdout' : block.schedule?.set;
      const blockKey = `${opponent}\u0000${block.policy}\u0000${schedule}`;
      insist(!blockMaps[crew].has(blockKey), `${crew} duplicate block remains`);
      blockMaps[crew].set(blockKey, block);
      const validated = validateBlock(block, crew, mode, opponent);
      caseMaps[crew].set(blockKey, validated.caseKeys);
      count += validated.uniqueCaseCount;
    }
    perCrewUnique[crew] = count;
    validateAccounting(crew === 'current-baseline' ? baseline : diner, crew, mode === 'full' ? 1008 : count);
  }
  if (!pilot) {
    insist(blockMaps['current-baseline'].size === 9 && blockMaps.diner.size === 9, 'Full validation requires exactly nine blocks per crew');
    insist(perCrewUnique['current-baseline'] === 1008 && perCrewUnique.diner === 1008, 'Full validation requires exactly 1,008 unique cases per crew');
    insist(perCrewUnique['current-baseline'] + perCrewUnique.diner === 2016, 'Full paired unique case count must be 2,016');
  }
  insist(blockMaps['current-baseline'].size === blockMaps.diner.size, 'Crew block counts differ');
  for (const [key, baselineBlock] of blockMaps['current-baseline']) {
    const dinerBlock = blockMaps.diner.get(key);
    insist(dinerBlock, `Diner report is missing paired block ${key.replaceAll('\u0000', ':')}`);
    insist(baselineBlock.policy === dinerBlock.policy
      && stableEqual(baselineBlock.schedule, dinerBlock.schedule)
      && baselineBlock.expectedMatches === dinerBlock.expectedMatches,
    `Crew schedule axes do not pair for block ${key.replaceAll('\u0000', ':')}`);
    const baseCases = caseMaps['current-baseline'].get(key)!;
    const dinerCases = caseMaps.diner.get(key)!;
    insist(stableEqual([...baseCases].sort(), [...dinerCases].sort()), `Paired case keys differ for ${key.replaceAll('\u0000', ':')}`);
  }
  return {
    verified: true,
    mode,
    completedAt: new Date().toISOString(),
    deterministicScheduleFingerprint: scheduleFingerprint,
    sourceFingerprints: sources,
    crewRoles: CREW_ROLE_LABELS,
    exactShardCountPerCrew: pilot ? null : 9,
    uniqueCasesPerCrew: perCrewUnique,
    totalPairedUniqueCases: perCrewUnique['current-baseline'] + perCrewUnique.diner,
    matrixFailures: 0,
    rawFailures: 0,
    matrixRawParity: 'all match blocks have all four parity flags true; matrix and raw counts equal each exact Cartesian schedule',
    accountingNote: 'Matrix validation replays are duplicate concordance executions and are not additional independent samples.',
  };
}

export function expectedShardMap(): Map<string, { opponent: string; policy: string; schedule: 'primary' | 'holdout' }> {
  const entries: [string, { opponent: string; policy: string; schedule: 'primary' | 'holdout' }][] = [];
  for (const opponent of opponentIds) {
    for (const policy of primaryPolicyIds) {
      entries.push([`${opponent}-${policy}-primary`, { opponent, policy, schedule: 'primary' }]);
    }
    entries.push([`${opponent}-greedy-holdout`, { opponent, policy: 'greedy', schedule: 'holdout' }]);
  }
  return new Map(entries);
}

function assembleShardReports(directory: string, crewName: CrewName, sources: Record<string, string>, scheduleFingerprint: string): RecordValue {
  const crewDirectory = path.join(directory, crewName);
  const expected = expectedShardMap();
  insist(existsSync(crewDirectory), `Missing shard directory for ${crewName}: ${crewDirectory}`);
  const actualChunkNames = readdirSync(crewDirectory).filter(name => name.startsWith('chunk-') && name.endsWith('.json')).map(name => name.slice('chunk-'.length, -'.json'.length)).sort();
  insist(stableEqual(actualChunkNames, [...expected.keys()].sort()), `${crewName} must have exactly the nine expected primary/holdout shard JSON files`);
  const reports: RecordValue[] = [];
  for (const [shardName, axes] of expected) {
    const file = path.join(crewDirectory, `chunk-${shardName}.json`);
    let payload: RecordValue;
    try { payload = JSON.parse(readFileSync(file, 'utf8')); }
    catch (error) { throw new Error(`Cannot read ${crewName} shard ${file}: ${error instanceof Error ? error.message : String(error)}`); }
    insist(payload.crew === crewName && payload.shard === `${axes.opponent}:${axes.policy}:${axes.schedule}`, `Shard identity mismatch: ${file}`);
    insist(payload.scheduleFingerprint === scheduleFingerprint, `Shard schedule/source fingerprint mismatch: ${file}`);
    insist(payload.deterministicFingerprint === crewFingerprint(scheduleFingerprint, crewName, false), `Shard crew/role fingerprint mismatch: ${file}`);
    insist(payload.report?.deterministicFingerprint === payload.deterministicFingerprint, `Shard report fingerprint mismatch: ${file}`);
    assertReportIdentity(payload.report, crewName, sources, scheduleFingerprint, false);
    insist(payload.report.blocks?.length === 1, `Shard must contain exactly one block: ${file}`);
    const [block] = payload.report.blocks;
    insist(block.matchup === `${CREWS[crewName].id}-vs-${axes.opponent}` && block.policy === axes.policy, `Shard block opponent/policy mismatch: ${file}`);
    insist(block.schedule?.set === (axes.schedule === 'holdout' ? 'fresh-holdout' : 'primary'), `Shard schedule kind mismatch: ${file}`);
    reports.push(payload.report);
  }
  const blocks = reports.flatMap(report => report.blocks);
  return {
    ...reports[0],
    blocks,
    failures: reports.flatMap(report => report.failures),
    simulationAccounting: {
      uniqueRequestedMatchups: reports.reduce((sum, report) => sum + report.simulationAccounting.uniqueRequestedMatchups, 0),
      rawRetainedSamples: reports.reduce((sum, report) => sum + report.simulationAccounting.rawRetainedSamples, 0),
      matrixValidationReplays: reports.reduce((sum, report) => sum + report.simulationAccounting.matrixValidationReplays, 0),
      engineSimulationAttempts: reports.reduce((sum, report) => sum + report.simulationAccounting.engineSimulationAttempts, 0),
    },
    shardCount: reports.length,
  };
}

function readMergedReport(directory: string, crewName: CrewName): RecordValue {
  const file = path.join(directory, crewName, 'current-rules.json');
  try { return JSON.parse(readFileSync(file, 'utf8')); }
  catch (error) { throw new Error(`Cannot read merged ${crewName} report ${file}: ${error instanceof Error ? error.message : String(error)}`); }
}

function main() {
  const args = process.argv.slice(2);
  const mode = args[0];
  const directory = args[1] ? path.resolve(args[1]) : comparisonRoot;
  if ((mode !== '--merged' && mode !== '--shards') || args.length > 2) {
    throw new Error('Usage: tsx src/squabblehouse-diner-verify.ts --merged [comparison-output-root] | --shards [comparison-output-root]. The CLI is full-sweep-only.');
  }
  const sources = currentSourceFingerprints();
  const scheduleHash = expectedScheduleFingerprint(sources);
  const reports = mode === '--merged'
    ? {
      'current-baseline': readMergedReport(directory, 'current-baseline'),
      diner: readMergedReport(directory, 'diner'),
    }
    : {
      'current-baseline': assembleShardReports(directory, 'current-baseline', sources, scheduleHash),
      diner: assembleShardReports(directory, 'diner', sources, scheduleHash),
    };
  const verification = verifyComparisonReports(reports['current-baseline'], reports.diner, 'full');
  const verificationDirectory = path.join(directory, 'verification');
  mkdirSync(verificationDirectory, { recursive: true });
  const verificationFile = path.join(verificationDirectory, 'current-verification.json');
  writeFileSync(verificationFile, `${JSON.stringify({ ...verification, inputMode: mode.slice(2), inputRoot: path.relative(root, directory) }, null, 2)}\n`);
  console.log(JSON.stringify({ passed: true, verificationFile: path.relative(root, verificationFile), uniqueCasesPerCrew: 1008, pairedUniqueCases: 2016 }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}