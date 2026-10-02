import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BalanceDeck } from '@workspace/squabblemon-engine/balanceLab';
import { CARD_BALANCE_VERSION, ONLINE_RULES_VERSION } from '@workspace/squabblemon-engine/multiplayer';
import {
  capturedCrewSummary,
  runBlock,
  summarize,
} from './squabblehouse-balance-sweep';
import {
  assertAcceptedV30Metadata,
  assertAcceptedV30Report,
  assertCompleteBlock,
  assertCrewIdentity,
  assertFrozenV30EngineHashes,
  assertMatchedCaseMaps,
  assertOpponentIdentity,
  assertReportIdentity,
  assertRuntimeKitPair,
  assertSharedHarnessFingerprintMatch,
  blockCaseMap,
  buildReport,
  checkPhaseVersion,
  enginePackageAt,
  engineSourceHashes,
  expectedScheduleFor,
  expectedShardSpecs,
  getDefaultsAndValidate,
  legacyAcceptedEngineHashes,
  outputRelativeRoot,
  acceptedDinerRelativePath,
  OLD_ENGINE_COMMIT,
  OLD_CARD_BALANCE_VERSION,
  NEW_CARD_BALANCE_VERSION,
  PHASE_CREW_ROLES,
  CREW,
  CREW_ROLE,
  MATCH_PAIR_ID,
  SNAPSHOT_MANIFEST,
  opponentIds,
  primaryPolicies,
  primarySeeds,
  primaryRotations,
  holdoutSeeds,
  holdoutRotations,
  tiers,
  type Block,
  type JsonRecord,
  type Phase,
  type Policy,
  type ScheduleKind,
  scheduleFingerprint,
  sharedHarnessSourceFiles,
  sourceFingerprintsAt,
  stableEqual,
  SHELL_ORDER_KEY,
  insist,
} from './counterbenchmarkChecks';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
function gitCommitAt(directory: string): string {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: directory, encoding: 'utf8' }).trim();
  } catch {
    return 'unavailable';
  }
}

function readSnapshotManifest(sourceRoot = root): JsonRecord | null {
  const manifestPath = path.join(sourceRoot, SNAPSHOT_MANIFEST);
  if (!existsSync(manifestPath)) return null;
  return JSON.parse(readFileSync(manifestPath, 'utf8')) as JsonRecord;
}

function workspaceOutputRoot(): string {
  const manifest = readSnapshotManifest();
  return path.resolve(manifest?.workspaceRoot ?? root);
}

function fixedArchiveEngineHashes(workspaceRoot: string): Record<string, string> {
  const repositoryRoot = path.resolve(workspaceRoot);
  const actualRepositoryRoot = path.resolve(execFileSync('git', ['rev-parse', '--show-toplevel'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  }).trim());
  insist(actualRepositoryRoot === repositoryRoot, `Fixed v30 source root must be the Git repository root: ${repositoryRoot}`);
  const resolvedCommit = execFileSync('git', ['rev-parse', '--verify', `${OLD_ENGINE_COMMIT}^{commit}`], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  }).trim();
  insist(resolvedCommit === OLD_ENGINE_COMMIT, `Fixed v30 Git archive commit is unavailable: ${OLD_ENGINE_COMMIT}`);
  const archive = execFileSync('git', [
    'archive',
    '--format=tar',
    OLD_ENGINE_COMMIT,
    'lib/squabblemon-engine',
  ], { cwd: repositoryRoot, maxBuffer: 512 * 1024 * 1024 });
  const verificationRoot = mkdtempSync(path.join(path.dirname(repositoryRoot), '.squabblehouse-v30-engine-archive-'));
  try {
    execFileSync('tar', ['-xf', '-', '-C', verificationRoot], { input: archive, maxBuffer: 512 * 1024 * 1024 });
    return engineSourceHashes(sourceFingerprintsAt(verificationRoot));
  } finally {
    rmSync(verificationRoot, { recursive: true, force: true });
  }
}

function assertBeforeEngineIntegrity(
  sourceRoot: string,
  fingerprints: Record<string, string>,
  manifest: JsonRecord,
): void {
  insist(manifest.snapshotCommit === OLD_ENGINE_COMMIT, `Before snapshot commit must be ${OLD_ENGINE_COMMIT}`);
  insist(typeof manifest.workspaceRoot === 'string', 'Before snapshot manifest is missing the Git workspace root');
  insist(typeof manifest.snapshotRoot === 'string' && path.resolve(manifest.snapshotRoot) === path.resolve(sourceRoot),
    'Before snapshot manifest source root does not match the archived engine tree');
  insist(typeof manifest.acceptedDinerReportPath === 'string', 'Before snapshot manifest is missing the accepted DINER report path');
  insist(manifest.archivedEngineSourceSha256 && typeof manifest.archivedEngineSourceSha256 === 'object'
    && !Array.isArray(manifest.archivedEngineSourceSha256),
  'Before snapshot manifest is missing the complete fixed-archive engine hash map');
  const workspaceRoot = path.resolve(manifest.workspaceRoot);
  const archiveEngineHashes = fixedArchiveEngineHashes(workspaceRoot);
  assertFrozenV30EngineHashes(engineSourceHashes(fingerprints), archiveEngineHashes);
  assertFrozenV30EngineHashes(manifest.archivedEngineSourceSha256, archiveEngineHashes);

  const acceptedReportPath = path.join(workspaceRoot, acceptedDinerRelativePath);
  insist(path.resolve(manifest.acceptedDinerReportPath) === acceptedReportPath,
    'Before snapshot manifest accepted DINER report path is not the canonical workspace report');
  const acceptedText = readFileSync(acceptedReportPath, 'utf8');
  insist(createHash('sha256').update(acceptedText).digest('hex') === manifest.acceptedDinerReportSha256,
    'Accepted v30 DINER report changed after snapshot preparation');
  const acceptedReport = JSON.parse(acceptedText) as JsonRecord;
  assertAcceptedV30Report(acceptedReport, acceptedReportPath, fingerprints);
  insist(stableEqual(manifest.acceptedDinerEngineSourceSha256, reportEngineSourceHashes(acceptedReport)),
    'Before snapshot manifest historical nine-file hashes do not match the accepted DINER report');
}

function assertWorkspaceFrozenV30Snapshot(): void {
  const snapshotRoot = path.join(root, '.local/squabblehouse-counterbenchmark-v30');
  const manifest = readSnapshotManifest(snapshotRoot);
  insist(manifest, 'The fixed v30 source snapshot is missing from the workspace');
  assertBeforeEngineIntegrity(snapshotRoot, sourceFingerprintsAt(snapshotRoot), manifest);
}

function phaseOutputRoot(phase: Phase): string {
  return path.join(workspaceOutputRoot(), outputRelativeRoot, phase);
}

function getSourceIdentity(phase: Phase, fingerprints: Record<string, string>): JsonRecord {
  const manifest = phase === 'before' ? readSnapshotManifest() : null;
  if (phase === 'before') {
    insist(manifest, 'Before phase must run from the selectively archived v30 source snapshot');
    insist(manifest.snapshotCommit === OLD_ENGINE_COMMIT, `Before snapshot commit must be ${OLD_ENGINE_COMMIT}`);
    assertBeforeEngineIntegrity(root, fingerprints, manifest);
    return {
      phase,
      sourceRootKind: 'git-archive',
      sourceRoot: root,
      sourceRootCommit: manifest.snapshotCommit,
      acceptedDinerReportPath: manifest.acceptedDinerReportPath,
      acceptedDinerReportSha256: manifest.acceptedDinerReportSha256,
      acceptedDinerEngineSourceSha256: manifest.acceptedDinerEngineSourceSha256,
      engineSourceSha256: engineSourceHashes(fingerprints),
      enginePackage: enginePackageAt(root),
      cardBalanceVersion: CARD_BALANCE_VERSION,
      onlineRulesVersion: ONLINE_RULES_VERSION,
    };
  }
  assertWorkspaceFrozenV30Snapshot();
  return {
    phase,
    sourceRootKind: 'live-checkout',
    sourceRoot: root,
    sourceRootCommit: gitCommitAt(root),
    engineSourceSha256: engineSourceHashes(fingerprints),
    enginePackage: enginePackageAt(root),
    cardBalanceVersion: CARD_BALANCE_VERSION,
    onlineRulesVersion: ONLINE_RULES_VERSION,
  };
}

function assertImportBinding(sourceRoot: string): Record<string, string> {
  const resolved = {
    data: realpathSync(fileURLToPath(import.meta.resolve('@workspace/squabblemon-engine/data'))),
    balanceLab: realpathSync(fileURLToPath(import.meta.resolve('@workspace/squabblemon-engine/balanceLab'))),
    multiplayer: realpathSync(fileURLToPath(import.meta.resolve('@workspace/squabblemon-engine/multiplayer'))),
  };
  for (const [moduleName, resolvedPath] of Object.entries(resolved)) {
    const expectedPath = realpathSync(path.join(sourceRoot, 'lib/squabblemon-engine/src', `${moduleName === 'balanceLab' ? 'balanceLab' : moduleName}.ts`));
    insist(resolvedPath === expectedPath, `${moduleName} import resolved to ${resolvedPath}, not the ${sourceRoot} snapshot engine ${expectedPath}`);
  }
  return resolved;
}

function prepareSnapshot(destinationArgument?: string): void {
  const acceptedReportPath = path.join(root, acceptedDinerRelativePath);
  insist(existsSync(acceptedReportPath), `Cannot prepare v30 snapshot without accepted DINER report ${acceptedReportPath}`);
  const acceptedReportText = readFileSync(acceptedReportPath, 'utf8');
  const acceptedReport = JSON.parse(acceptedReportText) as JsonRecord;
  const snapshotRoot = path.resolve(root, destinationArgument ?? '.local/squabblehouse-counterbenchmark-v30');
  const archiveArgs = [
    'archive',
    '--format=tar',
    OLD_ENGINE_COMMIT,
    'lib/squabblemon-engine',
    'scripts/src',
    'scripts/package.json',
    'scripts/tsconfig.json',
    'tsconfig.base.json',
  ];
  const archive = execFileSync('git', archiveArgs, { cwd: root, maxBuffer: 512 * 1024 * 1024 });
  mkdirSync(path.dirname(snapshotRoot), { recursive: true });
  const archiveVerificationRoot = mkdtempSync(path.join(path.dirname(snapshotRoot), '.squabblehouse-v30-archive-'));
  try {
    execFileSync('tar', ['-xf', '-', '-C', archiveVerificationRoot], { input: archive, maxBuffer: 512 * 1024 * 1024 });
    const archiveFingerprints = sourceFingerprintsAt(archiveVerificationRoot);
    const archiveEngineHashes = engineSourceHashes(archiveFingerprints);
    const acceptedEngineHashes = reportEngineSourceHashes(acceptedReport);
    assertAcceptedV30Metadata(acceptedReport, acceptedReportPath);
    insist(stableEqual(acceptedEngineHashes, legacyAcceptedEngineHashes(archiveFingerprints)),
      'The fixed v30 Git archive does not match the historical accepted DINER v30 engine hashes');
    insist(acceptedReport.versionMetadata?.cardBalanceVersion === OLD_CARD_BALANCE_VERSION
      && acceptedReport.versionMetadata?.onlineRulesVersion === OLD_CARD_BALANCE_VERSION,
    'Accepted DINER report must have balance/rules version 30');

    const existingManifest = readSnapshotManifest(snapshotRoot);
    if (existsSync(snapshotRoot)) {
      insist(existingManifest?.snapshotCommit === OLD_ENGINE_COMMIT,
        `Refusing to update a non-v30 snapshot at ${snapshotRoot}`);
      const existingFingerprints = sourceFingerprintsAt(snapshotRoot);
      insist(stableEqual(engineSourceHashes(existingFingerprints), archiveEngineHashes),
        'Refusing to update the v30 harness because the snapshot engine tree differs from the fixed Git archive');
      assertFrozenV30EngineHashes(existingManifest.archivedEngineSourceSha256, archiveEngineHashes);
      insist(existingManifest.acceptedDinerReportSha256 === createHash('sha256').update(acceptedReportText).digest('hex'),
        'Refusing to update the v30 harness because its accepted DINER report stamp changed');
    } else {
      mkdirSync(snapshotRoot);
      execFileSync('tar', ['-xf', '-', '-C', snapshotRoot], { input: archive, maxBuffer: 512 * 1024 * 1024 });
    }

    for (const file of sharedHarnessSourceFiles) {
      const destination = path.join(snapshotRoot, file);
      mkdirSync(path.dirname(destination), { recursive: true });
      copyFileSync(path.join(root, file), destination);
    }

    const sharedNodeModules = path.join(root, 'node_modules');
    const snapshotNodeModules = path.join(snapshotRoot, 'node_modules');
    const snapshotWorkspaceModules = path.join(snapshotNodeModules, '@workspace');
    mkdirSync(snapshotWorkspaceModules, { recursive: true });
    for (const dependency of ['.pnpm', '.bin', 'tsx', 'typescript']) {
      const source = path.join(sharedNodeModules, dependency);
      const destination = path.join(snapshotNodeModules, dependency);
      if (existsSync(source) && !existsSync(destination) && !lstatSync(destination, { throwIfNoEntry: false })) {
        execFileSync('ln', ['-s', source, destination]);
      }
    }
    const engineLink = path.join(snapshotWorkspaceModules, 'squabblemon-engine');
    if (!existsSync(engineLink) && !lstatSync(engineLink, { throwIfNoEntry: false })) {
      execFileSync('ln', ['-s', path.join(snapshotRoot, 'lib/squabblemon-engine'), engineLink]);
    }

    const snapshotFingerprints = sourceFingerprintsAt(snapshotRoot);
    insist(stableEqual(engineSourceHashes(snapshotFingerprints), archiveEngineHashes),
      'Snapshot harness update unexpectedly changed the archived v30 engine tree');
    insist(stableEqual(legacyAcceptedEngineHashes(snapshotFingerprints), acceptedEngineHashes),
      'The copied v30 source snapshot does not match the historical DINER v30 engine hashes');
    const acceptedReportSha256 = createHash('sha256').update(acceptedReportText).digest('hex');
    const manifest = {
      ...(existingManifest ?? {}),
      schemaVersion: 1,
      snapshotCommit: OLD_ENGINE_COMMIT,
      sourceRootKind: 'git-archive',
      archivePaths: ['lib/squabblemon-engine', 'scripts/src', 'scripts/package.json', 'scripts/tsconfig.json', 'tsconfig.base.json']
        .filter(file => existsSync(path.join(snapshotRoot, file))),
      workspaceRoot: root,
      snapshotRoot,
      acceptedDinerReportPath: path.resolve(acceptedReportPath),
      acceptedDinerReportSha256: acceptedReportSha256,
      acceptedDinerEngineSourceSha256: acceptedEngineHashes,
      archivedEngineSourceSha256: archiveEngineHashes,
    };
    writeFileSync(path.join(snapshotRoot, SNAPSHOT_MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(JSON.stringify({
      preparedSnapshot: snapshotRoot,
      snapshotCommit: OLD_ENGINE_COMMIT,
      engineBoundTo: path.join(snapshotRoot, 'lib/squabblemon-engine'),
      acceptedDinerReportSha256: manifest.acceptedDinerReportSha256,
      sourceFingerprintsMatchAcceptedV30: true,
      fullRecursiveEngineFileCount: Object.keys(archiveEngineHashes).length,
      sharedHarnessCopies: sharedHarnessSourceFiles,
      includedPaths: manifest.archivePaths,
      excluded: ['all artifacts', 'all scripts/results', 'current engine sources'],
    }, null, 2));
  } finally {
    rmSync(archiveVerificationRoot, { recursive: true, force: true });
  }
}

function reportEngineSourceHashes(report: JsonRecord): Record<string, string> {
  const engine = report.versionMetadata?.engineSourceSha256;
  insist(engine && typeof engine === 'object' && !Array.isArray(engine), 'Accepted diner report is missing engine source SHA-256 metadata');
  return engine as Record<string, string>;
}

function preflight(phase: Phase): void {
  const fingerprints = sourceFingerprintsAt(root);
  const sourceIdentity = getSourceIdentity(phase, fingerprints);
  checkPhaseVersion(phase, CARD_BALANCE_VERSION, ONLINE_RULES_VERSION);
  assertCrewIdentity(CREW);
  const opponents = getDefaultsAndValidate();
  const resolvedEngineImports = assertImportBinding(root);
  if (phase === 'before') {
    const manifest = readSnapshotManifest()!;
    const reportPath = manifest.acceptedDinerReportPath as string;
    const acceptedText = readFileSync(reportPath, 'utf8');
    insist(createHash('sha256').update(acceptedText).digest('hex') === manifest.acceptedDinerReportSha256,
      'Accepted v30 DINER report changed after snapshot preparation');
    const accepted = JSON.parse(acceptedText) as JsonRecord;
    assertAcceptedV30Report(accepted, reportPath, fingerprints);
    insist(stableEqual(manifest.acceptedDinerEngineSourceSha256, sourceIdentity.acceptedDinerEngineSourceSha256),
      'Before engine hashes do not match the accepted diner report hash stamp');
    const checkoutFingerprints = sourceFingerprintsAt(workspaceOutputRoot());
    assertSharedHarnessFingerprintMatch(fingerprints, checkoutFingerprints, phase);
  } else {
    const oldReportPath = path.join(root, acceptedDinerRelativePath);
    const oldReport = JSON.parse(readFileSync(oldReportPath, 'utf8')) as JsonRecord;
    assertAcceptedV30Metadata(oldReport, oldReportPath);
    const oldSnapshotRoot = path.join(root, '.local/squabblehouse-counterbenchmark-v30');
    const oldSnapshotManifest = readSnapshotManifest(oldSnapshotRoot);
    insist(oldSnapshotManifest?.snapshotCommit === OLD_ENGINE_COMMIT, 'After preflight cannot verify the frozen v30 source snapshot');
    const oldEngineFingerprints = sourceFingerprintsAt(oldSnapshotRoot);
    assertBeforeEngineIntegrity(oldSnapshotRoot, oldEngineFingerprints, oldSnapshotManifest);
    insist(!stableEqual(engineSourceHashes(fingerprints), engineSourceHashes(oldEngineFingerprints)),
      'After v31 engine source fingerprints must differ from the complete frozen v30 engine tree');
    assertSharedHarnessFingerprintMatch(fingerprints, oldEngineFingerprints, phase);
  }
  const scheduleHash = scheduleFingerprint(phase, fingerprints, sourceIdentity, opponents);
  const outputDirectory = phaseOutputRoot(phase);
  mkdirSync(outputDirectory, { recursive: true });
  const result = {
    preflightSchemaVersion: 2,
    preflightRefreshReason: 'Refreshed after splitting the runner/checks and expanding recursive engine plus shared harness fingerprints.',
    preflightPassed: true,
    phase,
    sourceIdentity,
    sourceFingerprints: fingerprints,
    resolvedEngineImports,
    workspaceOutputRoot: workspaceOutputRoot(),
    comparisonOutputRoot: outputDirectory,
    scheduleFingerprint: scheduleHash,
      fullRecursiveEngineFileCount: Object.keys(engineSourceHashes(fingerprints)).length,
      sharedHarnessSourceFiles,
    acceptedDinerV30ReportSha256: phase === 'before' ? readSnapshotManifest()!.acceptedDinerReportSha256 : undefined,
    matchedAxes: {
      shell: CREW,
      crewRole: CREW_ROLE,
      phaseCrewRole: PHASE_CREW_ROLES[phase],
      orderKey: SHELL_ORDER_KEY,
      opponents,
      primary: { seeds: primarySeeds, rotations: primaryRotations, tiers, policies: primaryPolicies },
      freshHoldout: { seeds: holdoutSeeds, rotations: holdoutRotations, tiers, policy: 'greedy' },
      uniqueCasesPerPhase: 1008,
    },
  };
  const preflightFile = path.join(outputDirectory, 'preflight.json');
  writeFileSync(preflightFile, `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' });
  console.log(JSON.stringify({ preflight: preflightFile, phase, engineVersion: CARD_BALANCE_VERSION, scheduleFingerprint: scheduleHash, boundEngine: resolvedEngineImports }, null, 2));
}

function parseShard(value: string): { opponent: typeof opponentIds[number]; policy: Policy; schedule: ScheduleKind } {
  const parts = value.split(':');
  if (parts.length !== 3
    || !opponentIds.includes(parts[0] as typeof opponentIds[number])
    || !primaryPolicies.includes(parts[1] as Policy)
    || !(['primary', 'holdout'] as const).includes(parts[2] as ScheduleKind)) {
    throw new Error('--shard must be <focus-wonderland|focus-fire-guap|focus-wiz>:<greedy|seeded-legal>:<primary|holdout>');
  }
  if (parts[2] === 'holdout' && parts[1] !== 'greedy') throw new Error('Fresh confirmation holdout is greedy-only');
  return { opponent: parts[0] as typeof opponentIds[number], policy: parts[1] as Policy, schedule: parts[2] as ScheduleKind };
}

function buildBlock(
  opponent: BalanceDeck,
  policy: Policy,
  schedule: 'pilot' | ScheduleKind,
): Block {
  const pilot = schedule === 'pilot';
  const seeds = pilot ? ['squabblehouse-counter-pilot-district-01']
    : schedule === 'primary' ? primarySeeds : holdoutSeeds;
  const rotations = pilot ? [0] : schedule === 'primary' ? primaryRotations : holdoutRotations;
  const blockSchedule = schedule === 'holdout' ? 'fresh-holdout' : schedule;
  const raw = runBlock(
    `${CREW.id}-vs-${opponent.id}`,
    CREW,
    opponent,
    policy,
    seeds,
    rotations,
    pilot,
    blockSchedule,
  );
  const block: Block = {
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
      shell: summarize(raw.rawResults, 'a'),
      opponent: summarize(raw.rawResults, 'b'),
      sourceAttributedCrewEvents: capturedCrewSummary(CREW, raw.rawResults, raw.observations).coverage,
    },
  };
  assertCompleteBlock(block, CREW, opponent, policy, seeds, rotations, schedule);
  return block;
}

function makeReport(phase: Phase, blocks: Block[], fingerprints: Record<string, string>, scheduleHash: string, pilot: boolean): JsonRecord {
  return buildReport(phase, blocks, fingerprints, scheduleHash, pilot, getSourceIdentity(phase, fingerprints), root);
}

function shardFileName(shard: string): string {
  return `chunk-${shard.replaceAll(':', '-')}.json`;
}

function runShard(phase: Phase, shardText: string): void {
  const shard = parseShard(shardText);
  const fingerprints = sourceFingerprintsAt(root);
  const sourceIdentity = getSourceIdentity(phase, fingerprints);
  checkPhaseVersion(phase, CARD_BALANCE_VERSION, ONLINE_RULES_VERSION);
  const opponents = getDefaultsAndValidate();
  const opponent = opponents.find(candidate => candidate.id === shard.opponent)!;
  const scheduleHash = scheduleFingerprint(phase, fingerprints, sourceIdentity, opponents);
  const axes = expectedScheduleFor(shard);
  const block = buildBlock(opponent, shard.policy, axes.schedule);
  const report = makeReport(phase, [block], fingerprints, scheduleHash, false);
  const scheduleKind = shard.schedule === 'holdout' ? 'fresh-holdout' : 'primary';
  insist(block.schedule.set === scheduleKind, 'Shard generated the wrong schedule block kind');
  const directory = path.join(phaseOutputRoot(phase), 'diner');
  mkdirSync(directory, { recursive: true });
  const destination = path.join(directory, shardFileName(shardText));
  const payload = {
    phase,
    shard: shardText,
    scheduleFingerprint: scheduleHash,
    deterministicFingerprint: report.deterministicFingerprint,
    report,
  };
  writeFileSync(destination, `${JSON.stringify(payload, null, 2)}\n`, { flag: 'wx' });
  console.log(JSON.stringify({
    phase,
    shard: shardText,
    file: destination,
    expectedMatches: block.expectedMatches,
    rawMatches: block.rawResults.length,
    failures: report.failures.length,
    scheduleFingerprint: scheduleHash,
  }, null, 2));
}

function runPilot(phase: Phase): void {
  const fingerprints = sourceFingerprintsAt(root);
  const sourceIdentity = getSourceIdentity(phase, fingerprints);
  checkPhaseVersion(phase, CARD_BALANCE_VERSION, ONLINE_RULES_VERSION);
  assertCrewIdentity(CREW);
  const opponents = getDefaultsAndValidate();
  const scheduleHash = scheduleFingerprint(phase, fingerprints, sourceIdentity, opponents);
  const blocks = opponents.map(opponent => buildBlock(opponent, 'greedy', 'pilot'));
  for (const block of blocks) {
    insist(block.expectedMatches === 4, 'Pilot block must contain one seed × rotation × two tiers × two mirrored seats');
  }
  const report = makeReport(phase, blocks, fingerprints, scheduleHash, true);
  const directory = path.join(phaseOutputRoot(phase), 'diner');
  mkdirSync(directory, { recursive: true });
  const destination = path.join(directory, 'pilot.json');
  writeFileSync(destination, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
  console.log(JSON.stringify({ phase, pilot: destination, opponents: blocks.length, uniqueCases: 12 }, null, 2));
}

function verifyShardPayload(
  payload: JsonRecord,
  phase: Phase,
  shardText: string,
  fingerprints: Record<string, string>,
  scheduleHash: string,
): Block {
  const shard = parseShard(shardText);
  insist(payload.phase === phase && payload.shard === shardText, 'Shard phase or opponent/policy identity mismatch');
  insist(payload.scheduleFingerprint === scheduleHash, 'Refusing stale, cross-phase, or mixed-source shard fingerprint');
  const report = payload.report as JsonRecord;
  insist(report && report.blocks?.length === 1, 'Shard must contain exactly one block');
  assertReportIdentity(report, phase, fingerprints, scheduleHash, false);
  insist(payload.deterministicFingerprint === report.deterministicFingerprint, 'Shard/report deterministic fingerprints mismatch');
  const schedule = expectedScheduleFor(shard);
  const opponent = getDefaultsAndValidate().find(candidate => candidate.id === shard.opponent)!;
  const [block] = report.blocks as Block[];
  assertCompleteBlock(block, CREW, opponent, shard.policy, schedule.seeds, schedule.rotations, schedule.schedule);
  const expectedFailureCount = 0;
  insist(report.failures.length === expectedFailureCount, 'Shard report contains failures');
  insist(report.simulationAccounting?.uniqueRequestedMatchups === block.expectedMatches
    && report.simulationAccounting?.rawRetainedSamples === block.expectedMatches
    && report.simulationAccounting?.matrixValidationReplays === block.expectedMatches
    && report.simulationAccounting?.engineSimulationAttempts === block.expectedMatches * 2,
  'Shard simulation accounting is inconsistent');
  return block;
}

function mergeShards(phase: Phase): void {
  const fingerprints = sourceFingerprintsAt(root);
  const sourceIdentity = getSourceIdentity(phase, fingerprints);
  checkPhaseVersion(phase, CARD_BALANCE_VERSION, ONLINE_RULES_VERSION);
  const opponents = getDefaultsAndValidate();
  const scheduleHash = scheduleFingerprint(phase, fingerprints, sourceIdentity, opponents);
  const directory = path.join(phaseOutputRoot(phase), 'diner');
  insist(existsSync(directory), `Missing ${phase} shard directory ${directory}`);
  const expected = expectedShardSpecs();
  const expectedNames = expected.map(shardFileName).sort();
  const actualNames = execFileSync('find', [directory, '-maxdepth', '1', '-type', 'f', '-name', 'chunk-*.json', '-printf', '%f\\n'], { encoding: 'utf8' })
    .trim().split('\n').filter(Boolean).sort();
  insist(stableEqual(actualNames, expectedNames), `${phase} must have exactly the nine expected shards; got ${actualNames.join(', ')}`);
  const blocks: Block[] = [];
  for (const shardText of expected) {
    const file = path.join(directory, shardFileName(shardText));
    const payload = JSON.parse(readFileSync(file, 'utf8')) as JsonRecord;
    blocks.push(verifyShardPayload(payload, phase, shardText, fingerprints, scheduleHash));
  }
  const report = makeReport(phase, blocks, fingerprints, scheduleHash, false);
  report.shardCount = blocks.length;
  report.simulationAccounting = {
    uniqueRequestedMatchups: blocks.reduce((total, block) => total + block.expectedMatches, 0),
    rawRetainedSamples: blocks.reduce((total, block) => total + block.rawResults.length, 0),
    matrixValidationReplays: blocks.reduce((total, block) => total + block.matrix.matchCount, 0),
    engineSimulationAttempts: blocks.reduce((total, block) => total + block.matrix.matchCount + block.rawResults.length + block.rawFailures.length, 0),
    note: 'Matrix and raw captured executions are duplicate validations per unique requested case, not independent samples.',
  };
  assertReportIdentity(report, phase, fingerprints, scheduleHash, false);
  validateMergedReport(report, phase);
  const mergedPath = path.join(directory, 'current-rules.json');
  writeFileSync(mergedPath, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
  console.log(JSON.stringify({ merged: mergedPath, phase, shards: blocks.length, uniqueCases: 1008 }, null, 2));
}

function validateMergedReport(report: JsonRecord, phase: Phase): Map<string, Set<string>> {
  const sourceRoot = report.sourceRoot as string;
  insist(typeof sourceRoot === 'string' && path.resolve(sourceRoot) === path.resolve(report.configuration?.sourceIdentity?.sourceRoot),
    `${phase} report source-root stamp mismatch`);
  const fingerprints = sourceFingerprintsAt(sourceRoot);
  if (phase === 'before') {
    const manifest = readSnapshotManifest(sourceRoot);
    insist(manifest, 'Before merged report has no frozen v30 snapshot manifest');
    assertBeforeEngineIntegrity(sourceRoot, fingerprints, manifest);
  }
  const identity = getStoredSourceIdentity(report, phase, fingerprints);
  checkPhaseVersion(phase, report.versionMetadata?.cardBalanceVersion, report.versionMetadata?.onlineRulesVersion);
  const scheduleHash = scheduleFingerprint(phase, fingerprints, identity, report.configuration?.opponents);
  assertReportIdentity(report, phase, fingerprints, scheduleHash, false);
  insist(report.sourceRootKind === identity.sourceRootKind, `${phase} source root kind mismatch`);
  if (phase === 'before') {
    insist(report.versionMetadata?.sourceRootCommit === OLD_ENGINE_COMMIT, 'Before report does not identify the required frozen v30 commit');
  }
  return blockCaseMap(report, phase);
}

function getStoredSourceIdentity(report: JsonRecord, phase: Phase, fingerprints: Record<string, string>): JsonRecord {
  const identity = report.configuration?.sourceIdentity as JsonRecord | undefined;
  insist(identity?.phase === phase && identity.sourceRoot === report.sourceRoot, `${phase} source identity is missing or mismatched`);
  insist(stableEqual(identity.engineSourceSha256, engineSourceHashes(fingerprints)), `${phase} source identity engine hashes mismatch`);
  return identity;
}

function verifyComparison(): void {
  const beforePath = path.join(workspaceOutputRoot(), outputRelativeRoot, 'before/diner/current-rules.json');
  const afterPath = path.join(workspaceOutputRoot(), outputRelativeRoot, 'after/diner/current-rules.json');
  const before = JSON.parse(readFileSync(beforePath, 'utf8')) as JsonRecord;
  const after = JSON.parse(readFileSync(afterPath, 'utf8')) as JsonRecord;
  const beforeCases = validateMergedReport(before, 'before');
  const afterCases = validateMergedReport(after, 'after');
  insist(before.matchPairId === after.matchPairId && before.matchPairId === MATCH_PAIR_ID, 'Before/after pair identity mismatch');
  assertCrewIdentity(before.configuration?.crew as BalanceDeck);
  assertCrewIdentity(after.configuration?.crew as BalanceDeck);
  insist(stableEqual(before.configuration?.crew, after.configuration?.crew), 'Before/after diner roster, deck ID, name, or slot order mismatch');
  insist(before.crewRole === after.crewRole && before.crewRole === CREW_ROLE, 'Before/after crew role mismatch');
  insist(before.phaseCrewRole !== after.phaseCrewRole, 'Before/after phase roles must be distinct');
  insist(before.versionMetadata.cardBalanceVersion === OLD_CARD_BALANCE_VERSION
    && after.versionMetadata.cardBalanceVersion === NEW_CARD_BALANCE_VERSION,
  'Counterbenchmark must pair engine versions 30 and 31');
  insist(!stableEqual(before.versionMetadata.engineSourceSha256, after.versionMetadata.engineSourceSha256),
    'Counterbenchmark source roots must fingerprint different engine versions');
  assertOpponentIdentity(before.configuration?.opponents, after.configuration?.opponents);
  assertSharedHarnessFingerprintMatch(
    before.configuration?.sourceFingerprints,
    after.configuration?.sourceFingerprints,
    'before',
  );
  assertRuntimeKitPair(
    before.runtimeCardKits,
    after.runtimeCardKits,
    CREW.cardIds,
    before.configuration.opponents.flatMap((deck: BalanceDeck) => deck.cardIds),
  );
  insist(stableEqual(before.configuration?.sharedOrderKey, after.configuration?.sharedOrderKey)
    && before.configuration?.sharedOrderKey === SHELL_ORDER_KEY,
  'Before/after shared deck orderKey mismatch');
  assertMatchedCaseMaps(beforeCases, afterCases);
  const verification = {
    verified: true,
    completedAt: new Date().toISOString(),
    experiment: 'paired-squabblehouse-counterbenchmark-v30-v31',
    matchPairId: MATCH_PAIR_ID,
    phaseRoles: { before: before.phaseCrewRole, after: after.phaseCrewRole },
    engineVersions: {
      before: before.versionMetadata.cardBalanceVersion,
      after: after.versionMetadata.cardBalanceVersion,
    },
    sourceRoots: {
      before: { path: before.sourceRoot, kind: before.sourceRootKind, commit: before.versionMetadata.sourceRootCommit },
      after: { path: after.sourceRoot, kind: after.sourceRootKind, commit: after.versionMetadata.sourceRootCommit },
    },
    crew: CREW,
    sharedOrderKey: SHELL_ORDER_KEY,
    exactShardCountPerPhase: 9,
    uniqueCasesPerPhase: { before: 1008, after: 1008 },
    matchedCartesianBlocks: 9,
    totalUniqueVersionedCases: 2016,
    matrixFailures: 0,
    rawFailures: 0,
    matrixRawParity: 'All blocks have exact Cartesian keys, zero failures, and matrix success/failure/outcome tallies independently recomputed from raw results.',
    runtimeKitPair: 'Opponent kits match byte-for-byte including printed stats, cost, and rarity; crew kits differ only in ability metadata for the three selected cards.',
    accountingNote: 'Each phase records 1,008 requested cases; matrix replays validate raw samples and are not independent cases.',
  };
  const directory = path.join(workspaceOutputRoot(), outputRelativeRoot, 'verification');
  mkdirSync(directory, { recursive: true });
  const destination = path.join(directory, 'counter-verification.json');
  writeFileSync(destination, `${JSON.stringify(verification, null, 2)}\n`, { flag: 'wx' });
  console.log(JSON.stringify({ verified: true, verification: destination, uniqueCasesPerPhase: 1008, totalUniqueVersionedCases: 2016 }, null, 2));
}

function parseArguments(args: string[]): {
  phase?: Phase;
  action: 'prepare-snapshot' | 'preflight' | 'pilot' | 'shard' | 'merge' | 'verify';
  shard?: string;
  snapshotDestination?: string;
} {
  if (args[0] === '--prepare-snapshot') {
    if (args.length > 2) throw new Error('Usage: --prepare-snapshot [snapshot-path]');
    return { action: 'prepare-snapshot', snapshotDestination: args[1] };
  }
  const phaseIndex = args.indexOf('--phase');
  const phaseValue = phaseIndex >= 0 ? args[phaseIndex + 1] : undefined;
  if (phaseValue !== 'before' && phaseValue !== 'after') {
    throw new Error('A phase is required: --phase before|after');
  }
  const phase = phaseValue as Phase;
  const actions = [
    ['--preflight', 'preflight'],
    ['--pilot', 'pilot'],
    ['--shard', 'shard'],
    ['--merge', 'merge'],
    ['--verify', 'verify'],
  ] as const;
  const selected = actions.filter(([flag]) => args.includes(flag));
  if (selected.length !== 1) throw new Error('Choose exactly one action: --preflight | --pilot | --shard <spec> | --merge | --verify');
  const [flag, action] = selected[0];
  let shard: string | undefined;
  if (flag === '--shard') {
    const index = args.indexOf('--shard');
    shard = args[index + 1];
    if (!shard) throw new Error('--shard requires <opponent>:<policy>:<primary|holdout>');
    parseShard(shard);
  }
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === '--phase') index += 1;
    else if (value === '--shard') index += 1;
    else if (value !== flag) throw new Error(`Unexpected argument ${value}`);
  }
  return { phase, action, shard };
}

function main(): void {
  const parsed = parseArguments(process.argv.slice(2));
  if (parsed.action === 'prepare-snapshot') {
    prepareSnapshot(parsed.snapshotDestination);
    return;
  }
  const phase = parsed.phase!;
  if (parsed.action === 'preflight') preflight(phase);
  else if (parsed.action === 'pilot') runPilot(phase);
  else if (parsed.action === 'shard') runShard(phase, parsed.shard!);
  else if (parsed.action === 'merge') mergeShards(phase);
  else verifyComparison();
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}