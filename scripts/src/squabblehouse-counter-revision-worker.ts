import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CARD_RARITY_DEFINITIONS,
  cards,
  decks,
  rarityByEngineId,
} from '@workspace/squabblemon-engine/data';
import {
  BALANCE_LAB_SCHEMA_VERSION,
  type BalanceDeck,
  type BalanceMatchResult,
} from '@workspace/squabblemon-engine/balanceLab';
import { CARD_BALANCE_VERSION, ONLINE_RULES_VERSION } from '@workspace/squabblemon-engine/multiplayer';
import {
  capturedCrewSummary,
  getDefaults,
  runBlock,
  summarize,
} from './squabblehouse-balance-sweep';
import { runCounterRevisionFixtures } from './squabblehouse-counter-revision-fixtures';
import {
  ARM_MANIFEST_NAME,
  CREW_CARD_IDS,
  CREW_DECK,
  HOLDOUT_SEEDS,
  JsonRecord,
  OPPONENT_IDS,
  PILOT_SEEDS,
  POLICIES,
  PRIMARY_SEEDS,
  REVISION_ARMS,
  REVISION_V31_CONTROL_VERSION,
  REVISION_V32_CANDIDATE_VERSION,
  REVISION_SOURCE_FILES,
  RESULTS_RELATIVE_ROOT,
  SCHEDULES,
  TIERS,
  assertExactCrewAndRuntimeKits,
  assertResolvedImportsWithinSnapshot,
  assertShardIdentity,
  blockCaseMap,
  engineSourceHashes,
  expectedCasesPerArm,
  expectedMatches,
  expectedShardNames,
  insist,
  scheduleFor,
  sha256,
  shardName,
  sourceFingerprintsAt,
  sharedMovementGateFingerprintsAt,
  stableEqual,
  validateBlock,
  variantSourceFingerprint,
  type OpponentId,
  type PolicyId,
  type RevisionArm,
  type ScheduleId,
} from './squabblehouse-counter-revisionChecks';

type Action = 'preflight' | 'pilot' | 'shard' | 'merge';

const snapshotRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const manifestPath = path.join(snapshotRoot, ARM_MANIFEST_NAME);
const manifest = existsSync(manifestPath)
  ? JSON.parse(readFileSync(manifestPath, 'utf8')) as JsonRecord
  : (() => { throw new Error(`Snapshot arm manifest is missing: ${manifestPath}`); })();
const args = process.argv.slice(2);

function readArgument(name: string): string | undefined {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
}

function parseAction(): Action {
  const actions = ['--preflight', '--pilot', '--shard', '--merge'].filter(option => args.includes(option));
  insist(actions.length === 1, 'Worker requires exactly one of --preflight, --pilot, --shard, or --merge');
  return actions[0].slice(2) as Action;
}

function insistArmManifest(): void {
  insist(manifest.schemaVersion === 1 && REVISION_ARMS.includes(manifest.arm as RevisionArm),
    'Snapshot arm manifest has an unsupported schema or arm');
  insist(path.resolve(manifest.snapshotRoot) === snapshotRoot,
    'Worker source root does not match the stamped standalone snapshot path');
  insist(manifest.engineImportBinding && typeof manifest.engineImportBinding === 'object',
    'Arm manifest is missing validated engine import bindings');
}

function assertImportBinding(): Record<string, string> {
  const resolved = {
    data: realpathSync(fileURLToPath(import.meta.resolve('@workspace/squabblemon-engine/data'))),
    balanceLab: realpathSync(fileURLToPath(import.meta.resolve('@workspace/squabblemon-engine/balanceLab'))),
    multiplayer: realpathSync(fileURLToPath(import.meta.resolve('@workspace/squabblemon-engine/multiplayer'))),
  };
  assertResolvedImportsWithinSnapshot(snapshotRoot, resolved);
  insist(stableEqual(resolved, manifest.engineImportBinding),
    'Engine import bindings differ from the paths validated while preparing this arm');
  return resolved;
}

function assertSourceFreeze(): Record<string, string> {
  insistArmManifest();
  const fingerprints = sourceFingerprintsAt(snapshotRoot);
  insist(stableEqual(fingerprints, manifest.sourceFingerprints),
    'Refusing to continue: frozen engine/shared harness source fingerprints changed');
  insist(stableEqual(sharedMovementGateFingerprintsAt(snapshotRoot), manifest.sharedMovementGateSha256),
    'Frozen route, capacity, movement-lock, or return-legal gates changed in this arm');
  const engineHashes = engineSourceHashes(fingerprints);
  insist(Object.keys(engineHashes).length === 59
    && stableEqual(engineHashes, manifest.engineSourceSha256),
  'Arm engine no longer matches its complete recursive frozen source hash map');
  const runtimeVersion = {
    cardBalanceVersion: CARD_BALANCE_VERSION,
    onlineRulesVersion: ONLINE_RULES_VERSION,
    balanceLabSchemaVersion: BALANCE_LAB_SCHEMA_VERSION,
  };
  const expectedEngineVersion = manifest.arm === 'current-v31' || manifest.arm === 'corrected-original'
    ? REVISION_V31_CONTROL_VERSION
    : REVISION_V32_CANDIDATE_VERSION;
  insist(runtimeVersion.cardBalanceVersion === expectedEngineVersion
    && runtimeVersion.onlineRulesVersion === expectedEngineVersion,
  `Arm ${manifest.arm} must import the revision harness's v${expectedEngineVersion} engine control/candidate`);
  insist(stableEqual(runtimeVersion, manifest.versionMetadata),
    `Imported engine versions do not match the arm manifest: ${JSON.stringify(runtimeVersion)}`);
  insist(manifest.variantSourceFingerprint === variantSourceFingerprint(
    manifest.arm,
    engineHashes,
    runtimeVersion,
  ), 'Arm source/schedule fingerprint does not match the frozen engine');
  return fingerprints;
}

function assertCrewAndOpponents(): BalanceDeck[] {
  const authoredCrew = decks.find(deck => deck.id === 'squabblehouse-shift');
  insist(authoredCrew?.cards.join('|') === CREW_CARD_IDS.join('|'),
    'Authored SQUABBLEHOUSE SHIFT changed from the exact nine-staff-plus-Side-of-Hands roster');
  for (const cardId of CREW_CARD_IDS) insist(cards[cardId], `Unknown diner crew card ${cardId}`);
  insist(cards.sideofhands.kind === 'support', 'Side of Hands is no longer a support card');
  const opponents = getDefaults();
  insist(stableEqual(opponents.map(deck => deck.id), OPPONENT_IDS),
    'Canonical opponent IDs or ordering differ from the frozen experiment');
  for (const opponent of opponents) {
    insist(opponent.cardIds.length === 10 && new Set(opponent.cardIds).size === 10,
      `Opponent ${opponent.id} has an invalid deck list`);
  }
  return opponents;
}

function runtimeKits(opponents: readonly BalanceDeck[]): JsonRecord {
  const ids = [...new Set([...CREW_CARD_IDS, ...opponents.flatMap(deck => deck.cardIds)])].sort();
  return Object.fromEntries(ids.map(cardId => {
    const card = cards[cardId];
    insist(card, `Runtime kit is missing ${cardId}`);
    const rarityName = rarityByEngineId[cardId as keyof typeof rarityByEngineId];
    return [cardId, {
      id: card.id,
      name: card.name,
      kind: card.kind ?? 'character',
      rarity: rarityName,
      rarityDefinition: CARD_RARITY_DEFINITIONS[rarityName],
      type: card.type,
      cost: card.cost,
      power: card.power,
      ability: card.ability,
      effect: card.effect,
      roles: card.roles ?? [],
      elementalBond: card.elementalBond ?? null,
      abilityUpgrades: card.abilityUpgrades,
      abilityUpgradeCount: card.abilityUpgrades?.length ?? 0,
    }];
  }));
}

function reportRoot(): string {
  return path.resolve(manifest.experimentWorkspaceRoot, RESULTS_RELATIVE_ROOT, manifest.arm);
}

function scheduleFingerprint(fingerprints: Record<string, string>, opponents: readonly BalanceDeck[]): string {
  return variantSourceFingerprint(manifest.arm, engineSourceHashes(fingerprints), {
    cardBalanceVersion: CARD_BALANCE_VERSION,
    onlineRulesVersion: ONLINE_RULES_VERSION,
    balanceLabSchemaVersion: BALANCE_LAB_SCHEMA_VERSION,
  }) + sha256(JSON.stringify(opponents));
}

function buildBlock(
  opponent: BalanceDeck,
  policy: PolicyId,
  schedule: ScheduleId | 'pilot',
) {
  const axes = scheduleFor(schedule);
  const raw = runBlock(
    `${CREW_DECK.id}-vs-${opponent.id}`,
    CREW_DECK as BalanceDeck,
    opponent,
    policy,
    axes.seeds,
    axes.rotations,
    schedule === 'pilot',
    schedule === 'pilot' ? 'pilot' : schedule === 'holdout' ? 'fresh-holdout' : 'primary',
  );
  const block = {
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
      crew: summarize(raw.rawResults, 'a'),
      opponent: summarize(raw.rawResults, 'b'),
      sourceAttributedCrewEvents: capturedCrewSummary(CREW_DECK as BalanceDeck, raw.rawResults, raw.observations).coverage,
    },
  };
  validateBlock(block, opponent.id as OpponentId, policy, schedule);
  return block;
}

function writeOnce(destination: string, payload: unknown): void {
  mkdirSync(path.dirname(destination), { recursive: true });
  writeFileSync(destination, `${JSON.stringify(payload, null, 2)}\n`, { flag: 'wx' });
}

function makeReport(
  blocks: ReturnType<typeof buildBlock>[],
  fingerprints: Record<string, string>,
  opponents: readonly BalanceDeck[],
  pilot: boolean,
) {
  const scheduleHash = scheduleFingerprint(fingerprints, opponents);
  const rawCount = blocks.reduce((total, block) => total + block.rawResults.length, 0);
  const matrixCount = blocks.reduce((total, block) => total + block.matrix.matchCount, 0);
  const failures = blocks.flatMap(block => [
    ...((block.matrix.failures ?? []) as unknown[]).map(failure => ({
      matchup: block.matchup, policy: block.policy, source: 'runBalanceMatrix', failure,
    })),
    ...block.rawFailures.map(failure => ({
      matchup: block.matchup, policy: block.policy, source: 'simulateBalanceMatch', failure,
    })),
  ]);
  const report = {
    schemaVersion: BALANCE_LAB_SCHEMA_VERSION,
    experiment: 'six-arm-squabblehouse-counter-revision',
    arm: manifest.arm as RevisionArm,
    armDescription: manifest.description,
    pilot,
    deterministicFingerprint: sha256(JSON.stringify({
      arm: manifest.arm,
      variantSourceFingerprint: manifest.variantSourceFingerprint,
      pilot,
    })),
    scheduleFingerprint: scheduleHash,
    variantSourceFingerprint: manifest.variantSourceFingerprint,
    gitCommit: manifest.sourceGitCommit ?? null,
    sourceRoot: snapshotRoot,
    sourceRootKind: manifest.sourceRootKind,
    sourceRootCommit: manifest.sourceRootCommit ?? null,
    versionMetadata: {
      enginePackage: manifest.enginePackage,
      balanceLabSchemaVersion: BALANCE_LAB_SCHEMA_VERSION,
      cardBalanceVersion: CARD_BALANCE_VERSION,
      onlineRulesVersion: ONLINE_RULES_VERSION,
      engineSourceSha256: engineSourceHashes(fingerprints),
      sourceRootCommit: manifest.sourceRootCommit ?? null,
      variantSourceFingerprint: manifest.variantSourceFingerprint,
    },
    configuration: {
      arm: manifest.arm,
      sourceIdentity: {
        sourceRoot: snapshotRoot,
        sourceRootKind: manifest.sourceRootKind,
        sourceGitCommit: manifest.sourceGitCommit ?? null,
        sourceRootCommit: manifest.sourceRootCommit ?? null,
        variantSourceFingerprint: manifest.variantSourceFingerprint,
      },
      sourceFingerprints: fingerprints,
      crew: CREW_DECK,
      crewRole: 'same-authored-nine-staff-plus-side-of-hands',
      opponents,
      orderKey: CREW_DECK.orderKey,
      schedule: {
        pilot,
        primarySeeds: pilot ? PILOT_SEEDS : PRIMARY_SEEDS,
        primaryRotations: pilot ? [0] : [0, 2, 5],
        holdoutSeeds: pilot ? [] : HOLDOUT_SEEDS,
        holdoutRotations: [1, 6],
        tiers: TIERS,
        policies: pilot ? ['greedy'] : POLICIES,
        holdoutPolicy: 'greedy',
        seats: 'mirrored',
        allowSquabble: true,
      },
      interpretation: [
        'Matched bot-vs-bot evidence uses the exact authored nine-staff-plus-Side-of-Hands SQUABBLEHOUSE SHIFT.',
        'Every arm uses the same corrected movement/legal/economy rules except the three explicitly selected ability regions.',
        'Primary uses the existing twelve primary seeds; revision confirmation uses six new revision-specific seeds.',
        'Raw captures and matrix execution are duplicate validations of the same requested cases, not independent samples.',
        'Ability event counts are descriptive, not opportunity-adjusted rates or isolated human win-rate estimates.',
      ],
    },
    runtimeCardKits: runtimeKits(opponents),
    blocks,
    failures,
    simulationAccounting: {
      uniqueRequestedMatchups: blocks.reduce((total, block) => total + block.expectedMatches, 0),
      rawRetainedSamples: rawCount,
      matrixValidationReplays: matrixCount,
      engineSimulationAttempts: rawCount + matrixCount,
      note: 'Matrix and raw captured executions validate the same requested cases; they are not independent samples.',
    },
  };
  return report;
}

function runPreflight(): void {
  const fingerprints = assertSourceFreeze();
  const imports = assertImportBinding();
  const opponents = assertCrewAndOpponents();
  const behavioralFixtures = runCounterRevisionFixtures(manifest.arm as RevisionArm);
  insist(manifest.experimentWorkspaceRoot, 'Arm manifest is missing the shared results workspace root');
  const result = {
    schemaVersion: 1,
    preflightPassed: true,
    arm: manifest.arm,
    armDescription: manifest.description,
    sourceRoot: snapshotRoot,
    sourceRootKind: manifest.sourceRootKind,
    sourceGitCommit: manifest.sourceGitCommit ?? null,
    engineSourceSha256: engineSourceHashes(fingerprints),
    sourceFingerprints: fingerprints,
    sharedMovementGateSha256: sharedMovementGateFingerprintsAt(snapshotRoot),
    resolvedEngineImports: imports,
    versionMetadata: {
      cardBalanceVersion: CARD_BALANCE_VERSION,
      onlineRulesVersion: ONLINE_RULES_VERSION,
      balanceLabSchemaVersion: BALANCE_LAB_SCHEMA_VERSION,
    },
    variantSourceFingerprint: manifest.variantSourceFingerprint,
    schedule: {
      primary: { seeds: PRIMARY_SEEDS, rotations: [0, 2, 5], tiers: TIERS, policies: POLICIES },
      holdout: { seeds: HOLDOUT_SEEDS, rotations: [1, 6], tiers: TIERS, policy: 'greedy' },
      mirroredSeats: true,
      pilotCases: 12,
      uniqueCasesPerArm: expectedCasesPerArm(),
    },
    crew: CREW_DECK,
    opponents: opponents.map(({ id, cardIds, orderKey }) => ({ id, cardIds, orderKey })),
    configuration: {
      crew: CREW_DECK,
      opponents,
    },
    runtimeCardKits: runtimeKits(opponents),
    behavioralFixtures,
  };
  writeOnce(path.join(reportRoot(), 'preflight.json'), result);
  console.log(JSON.stringify({ arm: manifest.arm, preflight: path.join(reportRoot(), 'preflight.json'), engineVersion: CARD_BALANCE_VERSION }, null, 2));
}

function runPilot(): void {
  const fingerprints = assertSourceFreeze();
  assertImportBinding();
  const opponents = assertCrewAndOpponents();
  const blocks = opponents.map(opponent => buildBlock(opponent, 'greedy', 'pilot'));
  insist(blocks.reduce((total, block) => total + block.expectedMatches, 0) === 12,
    'Pilot must contain twelve unique cases: three opponents × four mirrored/tier cases');
  const report = makeReport(blocks, fingerprints, opponents, true);
  writeOnce(path.join(reportRoot(), 'pilot.json'), report);
  console.log(JSON.stringify({ arm: manifest.arm, pilot: path.join(reportRoot(), 'pilot.json'), uniqueCases: 12 }, null, 2));
}

function parseShard(): { opponent: OpponentId; policy: PolicyId; schedule: ScheduleId } {
  const opponent = readArgument('--opponent') as OpponentId | undefined;
  const policy = readArgument('--policy') as PolicyId | undefined;
  const schedule = readArgument('--schedule') as ScheduleId | undefined;
  insist(opponent && OPPONENT_IDS.includes(opponent), '--opponent must be one of the three frozen opponent IDs');
  insist(policy && POLICIES.includes(policy), '--policy must be greedy or seeded-legal');
  insist(schedule && SCHEDULES.includes(schedule), '--schedule must be primary or holdout');
  insist(schedule !== 'holdout' || policy === 'greedy', 'Revision confirmation holdout is greedy-only');
  return { opponent, policy, schedule };
}

function runShard(): void {
  const shard = parseShard();
  const fingerprints = assertSourceFreeze();
  assertImportBinding();
  const opponents = assertCrewAndOpponents();
  const opponent = opponents.find(candidate => candidate.id === shard.opponent)!;
  const block = buildBlock(opponent, shard.policy, shard.schedule);
  const report = makeReport([block], fingerprints, opponents, false);
  const filename = `chunk-${shard.opponent}-${shard.policy}-${shard.schedule}.json`;
  const directory = path.join(reportRoot(), 'diner');
  const destination = path.join(directory, filename);
  writeOnce(destination, {
    arm: manifest.arm,
    shard: shardName(shard.opponent, shard.policy, shard.schedule),
    variantSourceFingerprint: manifest.variantSourceFingerprint,
    scheduleFingerprint: report.scheduleFingerprint,
    deterministicFingerprint: report.deterministicFingerprint,
    report,
  });
  console.log(JSON.stringify({
    arm: manifest.arm,
    shard: shardName(shard.opponent, shard.policy, shard.schedule),
    file: destination,
    uniqueCases: block.expectedMatches,
    rawRetainedSamples: block.rawResults.length,
    matrixValidationReplays: block.matrix.matchCount,
  }, null, 2));
}

function verifyShard(
  payload: JsonRecord,
  shardSpec: string,
  fingerprints: Record<string, string>,
  opponents: readonly BalanceDeck[],
): ReturnType<typeof buildBlock> {
  const [opponentId, policyId, scheduleId] = shardSpec.split(':') as [OpponentId, PolicyId, ScheduleId];
  assertShardIdentity(payload, {
    arm: manifest.arm as RevisionArm,
    shard: shardSpec,
    variantSourceFingerprint: manifest.variantSourceFingerprint,
  });
  const report = payload.report as JsonRecord;
  insist(report?.blocks?.length === 1, 'Each shard must contain exactly one block');
  insist(stableEqual(report.configuration?.sourceFingerprints, fingerprints),
    'Shard source fingerprint map does not match its arm');
  insist(report.variantSourceFingerprint === undefined || report.versionMetadata?.variantSourceFingerprint === manifest.variantSourceFingerprint,
    'Shard report metadata does not match its arm fingerprint');
  insist(payload.scheduleFingerprint === report.scheduleFingerprint, 'Shard/report schedule fingerprint mismatch');
  insist(report.scheduleFingerprint === scheduleFingerprint(fingerprints, opponents),
    'Shard report opponent/source schedule fingerprint is stale');
  insist(payload.deterministicFingerprint === report.deterministicFingerprint, 'Shard/report deterministic fingerprint mismatch');
  const opponent = opponents.find(candidate => candidate.id === opponentId);
  insist(opponent, `Unknown shard opponent ${opponentId}`);
  const [block] = report.blocks as ReturnType<typeof buildBlock>[];
  validateBlock(block, opponentId, policyId, scheduleId);
  insist(report.failures?.length === 0, 'Shard report contains simulation failures');
  insist(report.simulationAccounting?.uniqueRequestedMatchups === block.expectedMatches
    && report.simulationAccounting?.rawRetainedSamples === block.expectedMatches
    && report.simulationAccounting?.matrixValidationReplays === block.expectedMatches
    && report.simulationAccounting?.engineSimulationAttempts === block.expectedMatches * 2,
  'Shard simulation accounting is not exact');
  return block;
}

function mergeShards(): void {
  const fingerprints = assertSourceFreeze();
  assertImportBinding();
  const opponents = assertCrewAndOpponents();
  const directory = path.join(reportRoot(), 'diner');
  insist(existsSync(directory), `Missing shard directory ${directory}`);
  const expectedNames = expectedShardNames()
    .map(spec => `chunk-${spec.replaceAll(':', '-')}.json`).sort();
  const actualNames = readdirSync(directory).filter(file => file.startsWith('chunk-') && file.endsWith('.json')).sort();
  insist(stableEqual(actualNames, expectedNames),
    `Arm must have exactly nine expected shards; actual: ${actualNames.join(', ')}`);
  const blocks = expectedShardNames().map(spec => {
    const filename = `chunk-${spec.replaceAll(':', '-')}.json`;
    const payload = JSON.parse(readFileSync(path.join(directory, filename), 'utf8')) as JsonRecord;
    return verifyShard(payload, spec, fingerprints, opponents);
  });
  const report = makeReport(blocks, fingerprints, opponents, false) as JsonRecord;
  report.shardCount = blocks.length;
  report.simulationAccounting = {
    uniqueRequestedMatchups: blocks.reduce((total, block) => total + block.expectedMatches, 0),
    rawRetainedSamples: blocks.reduce((total, block) => total + block.rawResults.length, 0),
    matrixValidationReplays: blocks.reduce((total, block) => total + block.matrix.matchCount, 0),
    engineSimulationAttempts: blocks.reduce((total, block) => total + block.matrix.matchCount + block.rawResults.length + block.rawFailures.length, 0),
    note: 'Matrix and raw captured executions are duplicate validations per unique requested case, not independent samples.',
  };
  const caseMap = blockCaseMap(report);
  insist(caseMap.size === 9 && expectedCasesPerArm() === 1008, 'Merged arm report does not cover the exact frozen schedule');
  writeOnce(path.join(directory, 'current-rules.json'), report);
  console.log(JSON.stringify({ arm: manifest.arm, merged: path.join(directory, 'current-rules.json'), uniqueCases: 1008 }, null, 2));
}

function main(): void {
  insistArmManifest();
  const action = parseAction();
  if (action === 'preflight') runPreflight();
  else if (action === 'pilot') runPilot();
  else if (action === 'shard') runShard();
  else mergeShards();
}

main();