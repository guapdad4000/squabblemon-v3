import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

export const REVISION_ARMS = [
  'corrected-original',
  'current-v31',
  'cashier-only',
  'griddle-only',
  'janitor-only',
  'combined-v32',
] as const;
export type RevisionArm = typeof REVISION_ARMS[number];
export const REVISION_V31_CONTROL_VERSION = 31;
export const REVISION_V32_CANDIDATE_VERSION = 32;
export const OPPONENT_IDS = ['focus-wonderland', 'focus-fire-guap', 'focus-wiz'] as const;
export type OpponentId = typeof OPPONENT_IDS[number];
export const POLICIES = ['greedy', 'seeded-legal'] as const;
export type PolicyId = typeof POLICIES[number];
export const SCHEDULES = ['primary', 'holdout'] as const;
export type ScheduleId = typeof SCHEDULES[number];
export const TIERS = [0, 3] as const;
export const PRIMARY_SEEDS = Array.from(
  { length: 12 },
  (_, index) => `squabblehouse-primary-district-${String(index + 1).padStart(2, '0')}`,
);
export const PRIMARY_ROTATIONS = [0, 2, 5] as const;
export const HOLDOUT_SEEDS = Array.from(
  { length: 6 },
  (_, index) => `squabblehouse-counter-revision-confirmation-district-${String(index + 1).padStart(2, '0')}`,
);
export const HOLDOUT_ROTATIONS = [1, 6] as const;
export const PILOT_SEEDS = ['squabblehouse-counter-revision-pilot-district-01'] as const;
export const PILOT_ROTATIONS = [0] as const;
export const CREW_CARD_IDS = [
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
export const CREW_DECK = {
  id: 'squabblehouse-staff-shell',
  name: 'Current SQUABBLEHOUSE SHIFT: nine staff and Side of Hands support',
  cardIds: CREW_CARD_IDS,
  orderKey: 'squabblehouse-balance-shell-v1',
} as const;
export const RESULTS_RELATIVE_ROOT = 'scripts/results/squabblehouse-counter-revision-comparison';
export const SNAPSHOT_RELATIVE_ROOT = '.local/squabblehouse-counter-revision-v32';
export const BASELINE_SNAPSHOT_RELATIVE_ROOT = '.local/squabblehouse-counter-revision-v31';
export const BASELINE_MANIFEST_NAME = '.squabblehouse-counter-revision-v31-snapshot.json';
export const ARM_MANIFEST_NAME = '.squabblehouse-counter-revision-arm.json';
export const REVISION_SOURCE_FILES = [
  'scripts/src/squabblehouse-counter-revision.ts',
  'scripts/src/squabblehouse-counter-revision-worker.ts',
  'scripts/src/squabblehouse-counter-revision-fixtures.ts',
  'scripts/src/squabblehouse-counter-revisionChecks.ts',
  'scripts/src/squabblehouse-balance-sweep.ts',
  'scripts/src/balance-sweep-telemetry.ts',
  'scripts/package.json',
  'scripts/tsconfig.json',
  'tsconfig.base.json',
] as const;

export type JsonRecord = Record<string, any>;
export type ScheduledCase = {
  districtSeed: string;
  rotation: number;
  tier: number;
  seat: 'a-player' | 'b-player';
};

export function insist(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function stableEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function sha256(data: string | Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}

export function stableHash(value: unknown): string {
  return sha256(JSON.stringify(value));
}

export type ApprovedSourceRegion = {
  name: string;
  start: number;
  end: number;
  feature?: string;
};

export function findSourceRegion(
  source: string,
  name: string,
  startMarker: string,
  endMarker: string,
  feature?: string,
): ApprovedSourceRegion {
  const uniqueIndex = (marker: string) => {
    const index = source.indexOf(marker);
    insist(index >= 0 && source.indexOf(marker, index + 1) < 0,
      `Expected one source boundary marker for ${name}: ${marker}`);
    return index;
  };
  const start = uniqueIndex(startMarker);
  const end = uniqueIndex(endMarker);
  insist(end > start, `Invalid approved source boundary order for ${name}`);
  return { name, start, end, feature };
}

export function findSourceLineBlock(
  source: string,
  name: string,
  marker: string,
  lineCount: number,
  feature?: string,
): ApprovedSourceRegion {
  const first = source.indexOf(marker);
  insist(first >= 0 && source.indexOf(marker, first + 1) < 0,
    `Expected one source line marker for ${name}: ${marker}`);
  const start = source.lastIndexOf('\n', first - 1) + 1;
  let end = start;
  for (let index = 0; index < lineCount; index++) {
    const lineEnd = source.indexOf('\n', end);
    end = lineEnd < 0 ? source.length : lineEnd + 1;
    insist(end > start, `Source line block ended early for ${name}`);
  }
  return { name, start, end, feature };
}

export function assertSourceMatchesOutsideApprovedRegions(
  file: string,
  baseline: string,
  candidate: string,
  baselineRegions: readonly ApprovedSourceRegion[],
  candidateRegions: readonly ApprovedSourceRegion[],
): void {
  const normalize = (source: string, regions: readonly ApprovedSourceRegion[]) => {
    let cursor = 0;
    let normalized = '';
    const names = new Set<string>();
    for (const region of regions) {
      insist(!names.has(region.name), `Duplicate approved source region ${region.name} in ${file}`);
      names.add(region.name);
      insist(Number.isInteger(region.start) && Number.isInteger(region.end)
        && region.start >= cursor && region.end >= region.start && region.end <= source.length,
      `Approved source regions overlap or are out of order in ${file}: ${region.name}`);
      normalized += source.slice(cursor, region.start) + `\u0000approved:${region.name}\u0000`;
      cursor = region.end;
    }
    return normalized + source.slice(cursor);
  };
  insist(stableEqual(baselineRegions.map(region => region.name), candidateRegions.map(region => region.name)),
    `Approved source region order or membership changed in ${file}`);
  insist(normalize(baseline, baselineRegions) === normalize(candidate, candidateRegions),
    `Non-counter source changed outside exact approved counter regions in ${file}`);
}

function walkTypeScriptFiles(directory: string): string[] {
  if (!existsSync(directory) || !statSync(directory).isDirectory()) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return walkTypeScriptFiles(fullPath);
    return entry.isFile() && entry.name.endsWith('.ts') ? [fullPath] : [];
  });
}

export function engineSourceFileListAt(sourceRoot: string): string[] {
  return [
    'lib/squabblemon-engine/package.json',
    ...walkTypeScriptFiles(path.join(sourceRoot, 'lib/squabblemon-engine/src'))
      .map(file => path.relative(sourceRoot, file)),
  ].sort();
}

export function sourceFingerprintsAt(sourceRoot: string, supportFiles: readonly string[] = REVISION_SOURCE_FILES): Record<string, string> {
  const files = [...new Set([...engineSourceFileListAt(sourceRoot), ...supportFiles])].sort();
  return Object.fromEntries(files.map(file => {
    const sourcePath = path.join(sourceRoot, file);
    insist(existsSync(sourcePath), `Required fingerprinted source is missing: ${sourcePath}`);
    return [file, sha256(readFileSync(sourcePath))];
  }));
}

export function engineSourceHashes(fingerprints: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(fingerprints).filter(([file]) => file.startsWith('lib/squabblemon-engine/')));
}

function sourceRegion(source: string, startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  insist(start >= 0 && end > start,
    `Shared movement-gate source region could not be isolated: ${startMarker} -> ${endMarker}`);
  return source.slice(start, end);
}

function sourceLine(source: string, marker: string): string {
  const lines = source.split('\n');
  const matches = lines.filter(line => line.includes(marker));
  insist(matches.length === 1, `Expected one shared movement-gate source line for ${marker}`);
  return matches[0];
}

export function sharedMovementGateFingerprintsAt(sourceRoot: string): Record<string, string> {
  const file = path.join(sourceRoot, 'lib/squabblemon-engine/src/gameEngine.ts');
  const source = readFileSync(file, 'utf8');
  const line = (marker: string) => sourceLine(source, marker);
  const region = (start: string, end: string) => sourceRegion(source, start, end);
  const returnToHand = region('function returnToHand(', 'function nextRound');
  const returnGates = [
    'if (squabblehouseMovementLocked(m, target)) return m;',
    'const departure = openTabDeparture(m, target);',
    'if (departure.stopped) return m;',
  ].map(marker => {
    insist(returnToHand.includes(marker), `Shared movement return gate is missing: ${marker}`);
    return marker;
  });
  return {
    movementLockPredicate: sha256(line('const squabblehouseMovementLocked =')),
    staffIdentityPredicate: sha256(line('const isSquabblehouseStaffCharacter =')),
    movementCapacity: sha256(region('function movementCapacityAvailable(', 'const move = (')),
    moveLegalAndCapacityGates: sha256(region('const move = (', 'const lowestFriendlyLane =')),
    forcedMoveLegalGates: sha256(region('const forceMoveUnshielded =', '/** INITIATION:')),
    hostileMoveRouteGate: sha256(region('const forceEnemyMove =', 'const forceMoveUnshielded =')),
    userRouteLegality: sha256(region('function canMoveTo(', 'function undercovaReaction(')),
    pairedMoveRouteLegality: sha256(region('function moveRouteLegal(', 'function undercovaReaction(')),
    openTabDepartureGate: sha256(region('function openTabDeparture(', 'const targetEnemy =')),
    handReturnSharedGates: sha256(returnGates.join('\n')),
  };
}

export function scheduleFor(schedule: ScheduleId | 'pilot') {
  if (schedule === 'pilot') {
    return { seeds: PILOT_SEEDS, rotations: PILOT_ROTATIONS, kind: 'pilot' as const };
  }
  if (schedule === 'primary') {
    return { seeds: PRIMARY_SEEDS, rotations: PRIMARY_ROTATIONS, kind: 'primary' as const };
  }
  return { seeds: HOLDOUT_SEEDS, rotations: HOLDOUT_ROTATIONS, kind: 'holdout' as const };
}

export function expectedMatches(schedule: ScheduleId | 'pilot'): number {
  const axes = scheduleFor(schedule);
  return axes.seeds.length * axes.rotations.length * TIERS.length * 2;
}

export function expectedCasesPerArm(): number {
  return OPPONENT_IDS.length * (
    POLICIES.length * expectedMatches('primary') + expectedMatches('holdout')
  );
}

export function caseKey(value: ScheduledCase): string {
  return `${value.districtSeed}\u0000${value.rotation}\u0000${value.tier}\u0000${value.seat}`;
}

export function expectedCaseKeys(schedule: ScheduleId | 'pilot'): string[] {
  const axes = scheduleFor(schedule);
  return axes.seeds.flatMap(districtSeed => axes.rotations.flatMap(rotation => TIERS.flatMap(tier =>
    (['a-player', 'b-player'] as const).map(seat => caseKey({ districtSeed, rotation, tier, seat })),
  )));
}

function outcomeCounts(results: readonly JsonRecord[], side: 'a' | 'b') {
  return results.reduce((counts, result) => {
    if (result.logicalWinner === 'draw') counts.draws++;
    else if (result.logicalWinner === side) counts.wins++;
    else counts.losses++;
    counts.games++;
    return counts;
  }, { games: 0, wins: 0, losses: 0, draws: 0 });
}

export function validateRawMatrixParity(block: JsonRecord, crewId: string, opponentId: string): void {
  const matrix = block.matrix as JsonRecord | undefined;
  const rawResults = block.rawResults as JsonRecord[] | undefined;
  const rawFailures = block.rawFailures as unknown[] | undefined;
  insist(matrix && Array.isArray(rawResults) && Array.isArray(rawFailures), 'Block is missing matrix/raw simulation data');
  const matrixCrew = matrix.decks?.find((deck: JsonRecord) => deck.deckId === crewId);
  const matrixOpponent = matrix.decks?.find((deck: JsonRecord) => deck.deckId === opponentId);
  const crewOutcomes = outcomeCounts(rawResults, 'a');
  const opponentOutcomes = outcomeCounts(rawResults, 'b');
  const parity = {
    successfulMatches: matrix.successfulMatches === rawResults.length,
    failedMatches: matrix.failedMatches === rawFailures.length,
    crewOutcomes: !!matrixCrew && ['games', 'wins', 'losses', 'draws'].every(key =>
      matrixCrew[key] === crewOutcomes[key as keyof typeof crewOutcomes]),
    opponentOutcomes: !!matrixOpponent && ['games', 'wins', 'losses', 'draws'].every(key =>
      matrixOpponent[key] === opponentOutcomes[key as keyof typeof opponentOutcomes]),
  };
  insist(Object.values(parity).every(Boolean), `Raw/matrix parity failed: ${JSON.stringify(parity)}`);
  insist(block.matrixParity && block.matrixParity.successfulMatches === true
    && block.matrixParity.failedMatches === true
    && block.matrixParity.deckAOutcomeCounts === true
    && block.matrixParity.deckBOutcomeCounts === true,
  'Runner did not retain all four raw/matrix parity checks');
}

export function validateBlock(
  block: JsonRecord,
  opponentId: OpponentId,
  policy: PolicyId,
  schedule: ScheduleId | 'pilot',
): Set<string> {
  const axes = scheduleFor(schedule);
  const expectedSet = axes.kind === 'holdout' ? 'fresh-holdout' : axes.kind;
  const expectedCount = expectedMatches(schedule);
  insist(block.matchup === `${CREW_DECK.id}-vs-${opponentId}` && block.policy === policy,
    'Block crew/opponent/policy identity mismatch');
  insist(block.schedule?.set === expectedSet
    && stableEqual(block.schedule.seeds, axes.seeds)
    && stableEqual(block.schedule.rotations, axes.rotations)
    && stableEqual(block.schedule.tiers, TIERS)
    && block.schedule.mirroredSeats === true
    && block.schedule.allowSquabble === true,
  `${schedule} block axes or settings mismatch`);
  insist(block.expectedMatches === expectedCount && block.rawResults?.length === expectedCount,
    `${schedule} block must contain exactly ${expectedCount} raw cases`);
  insist(block.rawFailures?.length === 0, `${schedule} raw simulations contain failures`);
  const matrix = block.matrix as JsonRecord;
  insist(matrix.telemetrySchemaVersion === 2 && matrix.matchCount === expectedCount
    && matrix.successfulMatches === expectedCount && matrix.failedMatches === 0
    && Array.isArray(matrix.failures) && matrix.failures.length === 0,
  `${schedule} aggregate matrix must have exact count/schema and no failures`);
  insist(Array.isArray(block.crewCardEventObservations)
    && block.crewCardEventObservations.length === expectedCount,
  `${schedule} block is missing raw-match crew observations`);
  const keys = new Set<string>();
  for (const result of block.rawResults as JsonRecord[]) {
    insist(result.deckAId === CREW_DECK.id && result.deckBId === opponentId,
      `${schedule} raw case has a changed crew or opponent`);
    insist(result.logicalWinner === 'a' || result.logicalWinner === 'b' || result.logicalWinner === 'draw',
      `${schedule} raw case has invalid winner`);
    insist(axes.seeds.includes(result.districtSeed)
      && (axes.rotations as readonly number[]).includes(result.rotation)
      && (TIERS as readonly number[]).includes(result.tier)
      && (result.seat === 'a-player' || result.seat === 'b-player'),
    `${schedule} raw case is outside its seed/rotation/tier/seat schedule`);
    const key = caseKey(result as ScheduledCase);
    insist(!keys.has(key), `${schedule} raw cases contain duplicate Cartesian key ${key.replaceAll('\u0000', '/')}`);
    keys.add(key);
  }
  insist(stableEqual([...keys].sort(), expectedCaseKeys(schedule).sort()),
    `${schedule} block does not match exact Cartesian case-key coverage`);
  validateRawMatrixParity(block, CREW_DECK.id, opponentId);
  return keys;
}

export function shardName(opponent: OpponentId, policy: PolicyId, schedule: ScheduleId): string {
  return `${opponent}:${policy}:${schedule}`;
}

export function expectedShardNames(): string[] {
  return [
    ...OPPONENT_IDS.flatMap(opponent => POLICIES.map(policy => shardName(opponent, policy, 'primary'))),
    ...OPPONENT_IDS.map(opponent => shardName(opponent, 'greedy', 'holdout')),
  ];
}

export function blockCaseMap(report: JsonRecord): Map<string, Set<string>> {
  insist(report.arm && REVISION_ARMS.includes(report.arm as RevisionArm), 'Merged report has an unknown arm');
  insist(Array.isArray(report.blocks) && report.blocks.length === 9, 'Merged arm report must contain exactly nine blocks');
  insist(Array.isArray(report.failures) && report.failures.length === 0, 'Merged arm report contains failures');
  const seen = new Set<string>();
  const caseMap = new Map<string, Set<string>>();
  for (const block of report.blocks as JsonRecord[]) {
    const opponent = OPPONENT_IDS.find(id => block.matchup === `${CREW_DECK.id}-vs-${id}`);
    insist(opponent, 'Merged report has an unexpected opponent');
    const schedule: ScheduleId = block.schedule?.set === 'fresh-holdout' ? 'holdout' : block.schedule?.set;
    insist(SCHEDULES.includes(schedule), 'Merged report has an invalid schedule');
    const spec = shardName(opponent, block.policy, schedule);
    insist(expectedShardNames().includes(spec) && !seen.has(spec), `Unexpected or duplicate shard block ${spec}`);
    seen.add(spec);
    caseMap.set(spec, validateBlock(block, opponent, block.policy, schedule));
  }
  insist(stableEqual([...seen].sort(), expectedShardNames().sort()), 'Merged report does not contain the nine required blocks');
  const total = [...caseMap.values()].reduce((sum, keys) => sum + keys.size, 0);
  insist(total === expectedCasesPerArm(), `Merged report has ${total} unique case keys; expected ${expectedCasesPerArm()}`);
  insist(report.simulationAccounting?.uniqueRequestedMatchups === total
    && report.simulationAccounting?.rawRetainedSamples === total
    && report.simulationAccounting?.matrixValidationReplays === total
    && report.simulationAccounting?.engineSimulationAttempts === total * 2,
  'Matrix/raw duplicate-validation accounting is not exact');
  return caseMap;
}

export function assertMatchedCaseMaps(reports: readonly JsonRecord[]): void {
  insist(reports.length === REVISION_ARMS.length, `Expected exactly ${REVISION_ARMS.length} arm reports`);
  const maps = reports.map(report => blockCaseMap(report));
  const first = maps[0];
  for (let index = 1; index < maps.length; index++) {
    insist(stableEqual([...maps[index].keys()].sort(), [...first.keys()].sort()),
      `Arm ${reports[index].arm} shard set differs from ${reports[0].arm}`);
    for (const [blockKey, keys] of first) {
      insist(stableEqual([...keys].sort(), [...maps[index].get(blockKey)!].sort()),
        `Arm ${reports[index].arm} case keys differ for ${blockKey}`);
    }
  }
}

export function assertExactCrewAndRuntimeKits(reports: readonly JsonRecord[]): void {
  const baseline = reports.find(report => report.arm === 'current-v31');
  insist(baseline, 'Missing frozen current-v31 control report');
  const expectedRuntimeIds = [...new Set([
    ...CREW_CARD_IDS,
    ...(baseline.configuration?.opponents ?? []).flatMap((deck: JsonRecord) => deck.cardIds ?? []),
  ])].sort();
  insist(stableEqual(Object.keys(baseline.runtimeCardKits ?? {}).sort(), expectedRuntimeIds),
    'Current-v31 report has missing or unexpected runtime crew/opponent kits');
  for (const report of reports) {
    insist(stableEqual(report.configuration?.crew, CREW_DECK),
      `${report.arm} does not use the exact frozen crew deck/order`);
    insist(stableEqual(report.configuration?.opponents, baseline.configuration?.opponents),
      `${report.arm} changed opponent IDs or deck lists`);
    const controlKits = baseline.runtimeCardKits as JsonRecord;
    const armKits = report.runtimeCardKits as JsonRecord;
    insist(stableEqual(Object.keys(armKits).sort(), Object.keys(controlKits).sort()),
      `${report.arm} runtime kit roster differs from v31 control`);
    insist(stableEqual(Object.keys(armKits).sort(), expectedRuntimeIds),
      `${report.arm} has missing or unexpected runtime crew/opponent kits`);
    for (const cardId of Object.keys(controlKits)) {
      const control = controlKits[cardId] as JsonRecord;
      const actual = armKits[cardId] as JsonRecord;
      if (!CREW_CARD_IDS.includes(cardId as typeof CREW_CARD_IDS[number])
        || !['squabblehouse-cashier', 'griddle-master', 'janitor'].includes(cardId)) {
        insist(stableEqual(actual, control), `${report.arm} changed unselected runtime kit ${cardId}`);
        continue;
      }
      const immutableFields = ['id', 'name', 'kind', 'type', 'cost', 'power', 'roles', 'elementalBond',
        'abilityUpgradeCount', 'rarity'];
      for (const key of immutableFields) {
        insist(stableEqual(actual[key], control[key]), `${report.arm} changed ${key} for ${cardId}`);
      }
      insist(stableEqual(
        (actual.abilityUpgrades ?? []).map((upgrade: JsonRecord) => ({
          id: upgrade.id, unlockLevel: upgrade.unlockLevel, effect: upgrade.effect,
        })),
        (control.abilityUpgrades ?? []).map((upgrade: JsonRecord) => ({
          id: upgrade.id, unlockLevel: upgrade.unlockLevel, effect: upgrade.effect,
        })),
      ), `${report.arm} changed upgrade mechanics or unlocks for ${cardId}`);
    }
  }
}

export function assertArmKitIsolation(reports: readonly JsonRecord[]): void {
  const baseline = reports.find(report => report.arm === 'current-v31');
  insist(baseline, 'Missing frozen current-v31 control report');
  const selections: Record<RevisionArm, readonly string[]> = {
    'corrected-original': ['squabblehouse-cashier', 'griddle-master', 'janitor'],
    'current-v31': [],
    'cashier-only': ['squabblehouse-cashier'],
    'griddle-only': ['griddle-master'],
    'janitor-only': ['janitor'],
    'combined-v32': ['squabblehouse-cashier', 'griddle-master', 'janitor'],
  };
  for (const report of reports) {
    const selected = new Set(selections[report.arm as RevisionArm]);
    const controlKits = baseline.runtimeCardKits as JsonRecord;
    const armKits = report.runtimeCardKits as JsonRecord;
    for (const cardId of CREW_CARD_IDS) {
      if (!['squabblehouse-cashier', 'griddle-master', 'janitor'].includes(cardId) || !selected.has(cardId)) {
        for (const key of ['ability', 'effect']) {
          insist(stableEqual(armKits[cardId]?.[key], controlKits[cardId]?.[key]),
            `${report.arm} changed nonselected ${key} on ${cardId}`);
        }
      }
    }
  }
}

export function assertOnlyAllowedEngineFilesDiffer(
  baseline: Record<string, string>,
  candidate: Record<string, string>,
  allowedPaths: readonly string[],
): void {
  const baselineNames = Object.keys(baseline).sort();
  const candidateNames = Object.keys(candidate).sort();
  insist(stableEqual(baselineNames, candidateNames), 'Engine recursive source file set changed between variants');
  const unexpected = baselineNames.filter(file => baseline[file] !== candidate[file] && !allowedPaths.includes(file));
  insist(unexpected.length === 0, `Unexpected engine source changes outside whitelist: ${unexpected.join(', ')}`);
}

export function assertResolvedImportsWithinSnapshot(
  snapshotRoot: string,
  resolvedImports: Record<string, string>,
): void {
  for (const moduleName of ['data', 'balanceLab', 'multiplayer']) {
    const actualPath = resolvedImports[moduleName];
    const expectedPath = path.resolve(snapshotRoot, 'lib/squabblemon-engine/src',
      moduleName === 'balanceLab' ? 'balanceLab.ts' : `${moduleName}.ts`);
    insist(actualPath && path.resolve(actualPath) === expectedPath,
      `${moduleName} import contamination: resolved ${actualPath ?? 'missing'}, expected ${expectedPath}`);
  }
}

export function assertShardIdentity(payload: JsonRecord, expected: {
  arm: RevisionArm;
  shard: string;
  variantSourceFingerprint: string;
}): void {
  insist(payload.arm === expected.arm && payload.shard === expected.shard,
    'Shard arm or opponent/policy/schedule identity mismatch');
  insist(payload.variantSourceFingerprint === expected.variantSourceFingerprint,
    'Cross-hash, stale, or mixed-source shard fingerprint');
}

export function variantSourceFingerprint(
  arm: RevisionArm,
  engineFingerprints: Record<string, string>,
  versionMetadata: JsonRecord,
): string {
  return stableHash({
    arm,
    engineFingerprints,
    versionMetadata,
    crew: CREW_DECK,
    opponents: OPPONENT_IDS,
    primary: { seeds: PRIMARY_SEEDS, rotations: PRIMARY_ROTATIONS, tiers: TIERS, policies: POLICIES },
    holdout: { seeds: HOLDOUT_SEEDS, rotations: HOLDOUT_ROTATIONS, tiers: TIERS, policy: 'greedy' },
    seats: 'mirrored',
    allowSquabble: true,
  });
}