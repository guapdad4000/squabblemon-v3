import { spawn, spawnSync } from 'node:child_process';
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ARM_MANIFEST_NAME,
  BASELINE_MANIFEST_NAME,
  BASELINE_SNAPSHOT_RELATIVE_ROOT,
  CREW_DECK,
  JsonRecord,
  OPPONENT_IDS,
  RESULTS_RELATIVE_ROOT,
  REVISION_ARMS,
  REVISION_V31_CONTROL_VERSION,
  REVISION_V32_CANDIDATE_VERSION,
  REVISION_SOURCE_FILES,
  SNAPSHOT_RELATIVE_ROOT,
  assertArmKitIsolation,
  assertExactCrewAndRuntimeKits,
  assertSourceMatchesOutsideApprovedRegions,
  assertMatchedCaseMaps,
  assertOnlyAllowedEngineFilesDiffer,
  engineSourceFileListAt,
  engineSourceHashes,
  findSourceLineBlock,
  findSourceRegion,
  insist,
  sha256,
  sourceFingerprintsAt,
  sharedMovementGateFingerprintsAt,
  stableEqual,
  stableHash,
  variantSourceFingerprint,
  type RevisionArm,
  type ApprovedSourceRegion,
} from './squabblehouse-counter-revisionChecks';

type Feature = 'cashier' | 'griddle' | 'janitor' | 'version';
type SourceHunk = {
  oldStart: number;
  oldCount: number;
  newStart: number;
  oldLines: string[];
  newLines: string[];
  changedOldLines: string[];
  changedNewLines: string[];
  changedOldLineNumbers: number[];
  changedNewLineNumbers: number[];
  text: string;
  features: Feature[];
};
type ChangedFile = { file: string; hunks: SourceHunk[] };

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const baselineRoot = path.join(workspaceRoot, BASELINE_SNAPSHOT_RELATIVE_ROOT);
const originalBaselineRoot = path.join(workspaceRoot, '.local/squabblehouse-counterbenchmark-v30');
const candidateEngineRoot = path.join(workspaceRoot, 'lib/squabblemon-engine');
const experimentRoot = path.join(workspaceRoot, SNAPSHOT_RELATIVE_ROOT);
const resultRoot = path.join(workspaceRoot, RESULTS_RELATIVE_ROOT);
const allowedEngineChanges = [
  'lib/squabblemon-engine/src/afterHoursWave.ts',
  'lib/squabblemon-engine/src/gameEngine.ts',
  'lib/squabblemon-engine/src/multiplayer.ts',
  'lib/squabblemon-engine/src/squabblehouseWave.ts',
] as const;
const singleFeatureByArm: Partial<Record<RevisionArm, Feature>> = {
  'cashier-only': 'cashier',
  'griddle-only': 'griddle',
  'janitor-only': 'janitor',
};
const descriptions: Record<RevisionArm, string> = {
  'corrected-original': 'v30 Cashier, Griddle, and Janitor counter logic on frozen corrected-v31 shared movement and legal rules',
  'current-v31': 'Exact frozen v31 control, before the three proposed counter revisions',
  'cashier-only': 'Frozen current-v31 control plus only the proposed Cashier revision',
  'griddle-only': 'Frozen current-v31 control plus only the proposed Griddle Master revision',
  'janitor-only': 'Frozen current-v31 control plus only the proposed Janitor revision',
  'combined-v32': 'Exact frozen root v32 candidate containing the combined proposed revisions',
};
function parseArgs() {
  const args = process.argv.slice(2);
  const options = ['--prepare-variants', '--preflight', '--pilot', '--shard', '--merge', '--verify'];
  const actions = options.filter(option => args.includes(option));
  insist(actions.length === 1, `Choose exactly one action: ${options.join(', ')}`);
  const get = (key: string) => {
    const index = args.indexOf(key);
    return index < 0 ? undefined : args[index + 1];
  };
  const arm = get('--arm') as RevisionArm | undefined;
  if (actions[0] !== '--prepare-variants' && actions[0] !== '--verify') {
    insist(arm && REVISION_ARMS.includes(arm), '--arm must name one of the six frozen experiment arms');
  }
  return { args, action: actions[0], arm };
}

function sourceFileHashes(sourceRoot: string): Record<string, string> {
  const files = engineSourceFileListAt(sourceRoot);
  return Object.fromEntries(files.map(file => [file, sha256(readFileSync(path.join(sourceRoot, file)))]));
}

function counterRegionsFor(file: string, source: string): ApprovedSourceRegion[] {
  if (file.endsWith('/afterHoursWave.ts')) {
    return [findSourceLineBlock(source, 'janitor-card-definition', "['janitor',", 1, 'janitor')];
  }
  if (file.endsWith('/squabblehouseWave.ts')) {
    return [
      findSourceLineBlock(source, 'griddle-card-definition', "['griddle-master',", 2, 'griddle'),
      findSourceLineBlock(source, 'cashier-card-definition', "['squabblehouse-cashier',", 2, 'cashier'),
    ];
  }
  if (file.endsWith('/multiplayer.ts')) {
    return [
      findSourceLineBlock(source, 'online-rules-version', 'export const ONLINE_RULES_VERSION', 1, 'version'),
      findSourceLineBlock(source, 'card-balance-version', 'export const CARD_BALANCE_VERSION', 1, 'version'),
    ];
  }
  if (!file.endsWith('/gameEngine.ts')) return [];

  const fieldMarker = 'janitorReversals?:';
  const fieldIndex = source.indexOf(fieldMarker);
  insist(fieldIndex >= 0 && source.indexOf(fieldMarker, fieldIndex + 1) < 0,
    'Expected exactly one Janitor charge state field');
  let commentStart = source.lastIndexOf('/**', fieldIndex);
  while (commentStart > 0) {
    const previousStart = source.lastIndexOf('/**', commentStart - 1);
    if (previousStart < 0) break;
    const previousEnd = source.indexOf('*/', previousStart);
    if (previousEnd < 0 || previousEnd >= commentStart
      || source.slice(previousEnd + 2, commentStart).trim() !== '') break;
    commentStart = previousStart;
  }
  const lastCommentStart = source.lastIndexOf('/**', fieldIndex);
  const lastCommentEnd = source.indexOf('*/', lastCommentStart);
  insist(commentStart >= 0 && lastCommentStart >= commentStart && lastCommentEnd >= 0
    && lastCommentEnd < fieldIndex && source.slice(lastCommentEnd + 2, fieldIndex).trim() === '',
  'Janitor charge state field must remain adjacent to its complete documentation block');
  const nextField = source.indexOf('  lastMovedAlly?:', fieldIndex);
  insist(nextField > fieldIndex && source.indexOf('  lastMovedAlly?:', nextField + 1) < 0,
    'Could not bound the Janitor charge state field');
  return [
    { name: 'janitor-charge-state-type', start: commentStart, end: nextField, feature: 'janitor' },
    findSourceRegion(source, 'janitor-status-mark',
      '  const janitorMarks =',
      '    ...janitorMarks,\n',
      'janitor'),
    findSourceRegion(source, 'janitor-burn-charge',
      '    const janitorReversal = damage > 0 && currentBurning.burnSource',
      '    if (janitorReversal) {',
      'janitor'),
    findSourceRegion(source, 'janitor-hostile-classification',
      '  const attemptedTarget = findCard(attempted, target.instanceId);',
      '  const appealed = creativeAppeal(m, attempted, target, source, creativeTools()) ?? attempted;',
      'janitor'),
    findSourceRegion(source, 'janitor-reversal-function',
      'function reverseWithJanitor(',
      '\nfunction openTabDeparture(',
      'janitor'),
    findSourceRegion(source, 'janitor-return-charge',
      '  if (source.owner !== target.owner && isSquabblehouseStaffCharacter(target)) {',
      '  const before = m, printed = cards[target.cardId], hand = target.owner === \'player\' ? \'playerHand\' : \'cpuHand\';',
      'janitor'),
    findSourceRegion(source, 'cashier-ability-branch',
      "else if (source.cardId === 'squabblehouse-cashier') {",
      "else if (source.cardId === 'waffle-warlord') {",
      'cashier'),
    findSourceRegion(source, 'griddle-ability-branch',
      "else if (source.cardId === 'griddle-master') {",
      "else if (source.cardId === 'inmate-reformed') {",
      'griddle'),
  ];
}

function featureForChangedLine(
  source: string,
  ranges: readonly ApprovedSourceRegion[],
  lineNumber: number,
  file: string,
): { region: string; feature: Feature } {
  const lineStart = source.lastIndexOf('\n', source.split('\n').slice(0, lineNumber - 1).join('\n').length) + 1;
  const lineEndIndex = source.indexOf('\n', lineStart);
  const lineEnd = lineEndIndex < 0 ? source.length : lineEndIndex + 1;
  const matches = ranges.filter(region => lineStart < region.end && lineEnd > region.start);
  insist(matches.length === 1 && matches[0].feature,
    `Changed source line ${lineNumber} is outside one exact approved counter region in ${file}`);
  return { region: matches[0].name, feature: matches[0].feature as Feature };
}

function classifyHunkByApprovedRegion(
  file: string,
  hunk: SourceHunk,
  baseline: string,
  candidate: string,
  baselineRegions: readonly ApprovedSourceRegion[],
  candidateRegions: readonly ApprovedSourceRegion[],
): void {
  const changedRegions = [
    ...hunk.changedOldLineNumbers.map(line => featureForChangedLine(baseline, baselineRegions, line, file)),
    ...hunk.changedNewLineNumbers.map(line => featureForChangedLine(candidate, candidateRegions, line, file)),
  ];
  insist(changedRegions.length > 0, `Source hunk has no changed lines in ${file}`);
  const regionNames = new Set(changedRegions.map(region => region.region));
  const features = [...new Set(changedRegions.map(region => region.feature))];
  insist(regionNames.size === 1 && features.length === 1,
    `Source hunk crosses approved counter regions or features in ${file}: ${[...regionNames].join(', ')}`);
  hunk.features = features;
}

function verifyFrozenEngineGitArchive(
  commit: string,
  expectedEngineHashes: Record<string, string>,
): JsonRecord {
  insist(/^[0-9a-f]{40}$/.test(commit), 'Frozen v31 snapshot is missing its snapshot-time Git commit');
  const archive = spawnSync('git', ['archive', '--format=tar', commit, 'lib/squabblemon-engine'], {
    cwd: workspaceRoot,
    maxBuffer: 64 * 1024 * 1024,
  });
  insist(archive.status === 0 && Buffer.isBuffer(archive.stdout),
    `Could not create the frozen v31 Git archive at ${commit}: ${archive.stderr?.toString() ?? ''}`);
  const listing = spawnSync('tar', ['-tf', '-'], {
    input: archive.stdout,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  insist(listing.status === 0, `Could not inspect the frozen v31 Git archive: ${listing.stderr ?? ''}`);
  const archiveFiles = String(listing.stdout).split('\n').filter(file => file && !file.endsWith('/')).sort();
  const tree = spawnSync('git', ['ls-tree', '-r', '--name-only', commit, '--', 'lib/squabblemon-engine'], {
    cwd: workspaceRoot,
    encoding: 'utf8',
  });
  insist(tree.status === 0, `Could not inspect the frozen v31 Git tree: ${tree.stderr ?? ''}`);
  const gitTreeFiles = String(tree.stdout).split('\n').filter(Boolean).sort();
  insist(stableEqual(archiveFiles, gitTreeFiles),
    'Snapshot-time Git archive file set differs from its frozen Git tree');
  const archiveHashes = Object.fromEntries(archiveFiles.map(file => {
    const extracted = spawnSync('tar', ['-xOf', '-', file], {
      input: archive.stdout,
      maxBuffer: 64 * 1024 * 1024,
    });
    insist(extracted.status === 0 && Buffer.isBuffer(extracted.stdout),
      `Could not extract ${file} from the frozen v31 Git archive: ${extracted.stderr?.toString() ?? ''}`);
    const archiveHash = sha256(extracted.stdout);
    const snapshotPath = path.join(baselineRoot, file);
    insist(existsSync(snapshotPath) && sha256(readFileSync(snapshotPath)) === archiveHash,
      `Snapshot-time Git archive content differs from the frozen v31 snapshot: ${file}`);
    return [file, archiveHash];
  }));
  const hashedEngineSources = Object.fromEntries(Object.keys(expectedEngineHashes)
    .map(file => [file, archiveHashes[file]]));
  insist(stableEqual(hashedEngineSources, expectedEngineHashes),
    'Snapshot-time Git archive content does not match all 59 recursively frozen v31 engine hashes');
  return {
    sourceGitCommit: commit,
    archiveSha256: sha256(archive.stdout),
    archiveFileCount: archiveFiles.length,
    engineSourceFileCount: Object.keys(hashedEngineSources).length,
    engineSourceSha256: hashedEngineSources,
    archiveContentSha256: archiveHashes,
  };
}

function validateFrozenBaseline(): JsonRecord {
  insist(existsSync(baselineRoot), `Frozen v31 snapshot is missing at ${baselineRoot}`);
  const manifestPath = path.join(baselineRoot, BASELINE_MANIFEST_NAME);
  insist(existsSync(manifestPath), `Frozen v31 snapshot manifest is missing at ${manifestPath}`);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as JsonRecord;
  const actualEngineHashes = engineSourceHashes(sourceFingerprintsAt(baselineRoot, []));
  insist(Object.keys(actualEngineHashes).length === 59
    && stableEqual(actualEngineHashes, manifest.engineSourceSha256),
  'Frozen v31 engine hashes no longer match the accepted freeze manifest');
  const verifiedGitArchive = verifyFrozenEngineGitArchive(
    manifest.sourceGitCommit as string,
    actualEngineHashes,
  );
  const acceptedPath = path.join(workspaceRoot, manifest.acceptedReportRelativePath);
  insist(existsSync(acceptedPath)
    && sha256(readFileSync(acceptedPath)) === manifest.acceptedReportSha256,
  'Accepted frozen v31 report fingerprint no longer matches; preserving it is mandatory');
  for (const [file, expectedHash] of Object.entries(manifest.snapshotSupportSourceSha256 as Record<string, string>)) {
    if (file === 'scripts/package.json') continue;
    const currentPath = path.join(workspaceRoot, file);
    if (!existsSync(currentPath)) continue;
    insist(sha256(readFileSync(currentPath)) === expectedHash,
      `Frozen experiment support source has changed since v31: ${file}`);
  }
  const frozenPackage = JSON.parse(readFileSync(path.join(baselineRoot, 'scripts/package.json'), 'utf8')) as JsonRecord;
  const currentPackage = JSON.parse(readFileSync(path.join(workspaceRoot, 'scripts/package.json'), 'utf8')) as JsonRecord;
  insist(stableEqual({ ...currentPackage, scripts: frozenPackage.scripts }, frozenPackage),
    'Only the root scripts test registration may differ from the frozen v31 scripts package');
  insist(typeof currentPackage.scripts?.test === 'string'
    && currentPackage.scripts.test.includes('./src/squabblehouse-counter-revision.test.ts'),
  'Root scripts package has not registered the focused revision harness test');
  return { ...manifest, verifiedGitArchive };
}

function parseUnifiedHunks(diffOutput: string): SourceHunk[] {
  const lines = diffOutput.split('\n');
  const hunks: SourceHunk[] = [];
  let current: SourceHunk | undefined;
  let oldLineNumber = 0;
  let newLineNumber = 0;
  const finish = () => {
    if (!current) return;
    const sourceText = [...current.oldLines, ...current.newLines].join('\n');
    current.text = sourceText;
    hunks.push(current);
    current = undefined;
  };
  for (const line of lines) {
    const match = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,\d+)? @@/);
    if (match) {
      finish();
      oldLineNumber = Number(match[1]);
      newLineNumber = Number(match[3]);
      current = {
        oldStart: Number(match[1]),
        oldCount: match[2] === undefined ? 1 : Number(match[2]),
        newStart: Number(match[3]),
        oldLines: [],
        newLines: [],
        changedOldLines: [],
        changedNewLines: [],
        changedOldLineNumbers: [],
        changedNewLineNumbers: [],
        text: '',
        features: [],
      };
      continue;
    }
    if (!current) continue;
    if (line.startsWith('-')) {
      current.oldLines.push(line.slice(1));
      current.changedOldLines.push(line.slice(1));
      current.changedOldLineNumbers.push(oldLineNumber++);
    } else if (line.startsWith('+')) {
      current.newLines.push(line.slice(1));
      current.changedNewLines.push(line.slice(1));
      current.changedNewLineNumbers.push(newLineNumber++);
    } else if (line.startsWith(' ')) {
      current.oldLines.push(line.slice(1));
      current.newLines.push(line.slice(1));
      oldLineNumber++;
      newLineNumber++;
    }
    else if (line.startsWith('\\')) continue;
    else if (line.startsWith('---') || line.startsWith('+++')) continue;
  }
  finish();
  return hunks;
}

function collectCandidateChanges(baseHashes: Record<string, string>): ChangedFile[] {
  const candidateHashes = sourceFileHashes(workspaceRoot);
  assertOnlyAllowedEngineFilesDiffer(baseHashes, candidateHashes, allowedEngineChanges);
  const files: ChangedFile[] = [];
  for (const file of Object.keys(baseHashes).sort()) {
    if (baseHashes[file] === candidateHashes[file]) continue;
    insist(allowedEngineChanges.includes(file as typeof allowedEngineChanges[number]),
      `Unexpected engine file changed: ${file}`);
    const baselineSource = readFileSync(path.join(baselineRoot, file), 'utf8');
    const candidateSource = readFileSync(path.join(workspaceRoot, file), 'utf8');
    const baselineRegions = counterRegionsFor(file, baselineSource);
    const candidateRegions = counterRegionsFor(file, candidateSource);
    insist(baselineRegions.length > 0 && candidateRegions.length > 0,
      `Changed engine file has no exact approved counter regions: ${file}`);
    assertSourceMatchesOutsideApprovedRegions(file, baselineSource, candidateSource, baselineRegions, candidateRegions);
    const context = file.endsWith('/gameEngine.ts') ? '-U2' : '-U0';
    const diff = spawnSync('diff', [context, '--', path.join(baselineRoot, file), path.join(workspaceRoot, file)], {
      encoding: 'utf8',
    });
    insist(diff.status === 1, `Could not inspect candidate source diff for ${file}: ${diff.stderr ?? ''}`);
    const hunks = parseUnifiedHunks(diff.stdout ?? '');
    insist(hunks.length > 0, `Changed source file did not yield auditable hunks: ${file}`);
    for (const hunk of hunks) {
      classifyHunkByApprovedRegion(
        file,
        hunk,
        baselineSource,
        candidateSource,
        baselineRegions,
        candidateRegions,
      );
      const cardFeatures = hunk.features.filter(feature => feature !== 'version');
      insist(cardFeatures.length <= 1,
        `A source hunk combines counter revisions and cannot prove isolated arms (${file}: ${cardFeatures.join(', ')})`);
    }
    files.push({ file, hunks });
  }
  const changedFeatures = new Set(files.flatMap(entry => entry.hunks.flatMap(hunk => hunk.features)));
  for (const feature of ['cashier', 'griddle', 'janitor'] as const) {
    insist(changedFeatures.has(feature), `Root v32 candidate is missing the ${feature} revision hunk`);
  }
  return files;
}

function applyHunks(base: string, hunks: readonly SourceHunk[], include: (hunk: SourceHunk) => boolean): string {
  const sourceLines = base.split('\n');
  const output: string[] = [];
  let cursor = 0;
  for (const hunk of hunks) {
    const start = hunk.oldCount === 0 ? hunk.oldStart : hunk.oldStart - 1;
    insist(start >= cursor && start + hunk.oldCount <= sourceLines.length,
      `Overlapping or out-of-range source proof hunk at original line ${hunk.oldStart}`);
    const actualOld = sourceLines.slice(start, start + hunk.oldCount);
    insist(stableEqual(actualOld, hunk.oldLines),
      `Source proof context mismatch at original line ${hunk.oldStart}`);
    output.push(...sourceLines.slice(cursor, start));
    output.push(...(include(hunk) ? hunk.newLines : hunk.oldLines));
    cursor = start + hunk.oldCount;
  }
  output.push(...sourceLines.slice(cursor));
  return output.join('\n');
}

function applyFeatureDelta(
  outputRoot: string,
  changes: readonly ChangedFile[],
  selectedFeature: Feature | 'combined',
): Record<string, string[]> {
  const proof: Record<string, string[]> = {};
  for (const change of changes) {
    const baselinePath = path.join(baselineRoot, change.file);
    const outputPath = path.join(outputRoot, change.file);
    const selectedHashes: string[] = [];
    const next = applyHunks(readFileSync(baselinePath, 'utf8'), change.hunks, hunk => {
      const featureChanges = hunk.features.filter(feature => feature !== 'version');
      const include = hunk.features.includes('version')
        || selectedFeature === 'combined'
        || (selectedFeature !== 'version' && featureChanges.includes(selectedFeature));
      if (include) selectedHashes.push(sha256(hunk.text));
      return include;
    });
    writeFileSync(outputPath, next);
    proof[change.file] = selectedHashes;
  }
  return proof;
}

function replaceConditionalBranch(target: string, source: string, cardId: string, nextCardId: string): string {
  const startMarker = `else if (source.cardId === '${cardId}') {`;
  const endMarker = `else if (source.cardId === '${nextCardId}') {`;
  const unique = (value: string, marker: string) => {
    const index = value.indexOf(marker);
    insist(index >= 0 && value.indexOf(marker, index + 1) < 0,
      `Expected exactly one ${marker} boundary while restoring ${cardId}`);
    return index;
  };
  const targetStart = unique(target, startMarker);
  const targetEnd = unique(target, endMarker);
  const sourceStart = unique(source, startMarker);
  const sourceEnd = unique(source, endMarker);
  insist(targetEnd > targetStart && sourceEnd > sourceStart, `Could not isolate exact ${cardId} counter branch`);
  return target.slice(0, targetStart) + source.slice(sourceStart, sourceEnd) + target.slice(targetEnd);
}

function tupleLines(source: string, marker: string, lineCount: number): string[] {
  const sourceLines = source.split('\n');
  const matches = sourceLines
    .map((line, index) => line.includes(marker) ? index : -1)
    .filter(index => index >= 0);
  insist(matches.length === 1, `Could not isolate exactly one card definition ${marker}`);
  const sourceIndex = matches[0];
  const block = sourceLines.slice(sourceIndex, sourceIndex + lineCount);
  insist(block.length === lineCount && block[0].includes(marker)
    && (lineCount === 1 || block[1].trimStart().startsWith("'")),
  `Card definition does not match its complete ${lineCount}-line tuple boundary: ${marker}`);
  return block;
}

function replaceTupleBlock(target: string, source: string, marker: string, lineCount: number): string {
  const sourceBlock = tupleLines(source, marker, lineCount);
  const targetLines = target.split('\n');
  const matches = targetLines
    .map((line, index) => line.includes(marker) ? index : -1)
    .filter(index => index >= 0);
  insist(matches.length === 1, `Could not isolate exactly one target card definition ${marker}`);
  const targetIndex = matches[0];
  insist(targetLines.slice(targetIndex, targetIndex + lineCount).length === lineCount
    && (lineCount === 1 || targetLines[targetIndex + 1].trimStart().startsWith("'")),
  `Target card definition does not match its complete ${lineCount}-line tuple boundary: ${marker}`);
  targetLines.splice(targetIndex, lineCount, ...sourceBlock);
  return targetLines.join('\n');
}

function replaceJanitorCounterFormula(target: string, source: string): string {
  const targetRange = findSourceRegion(
    target, 'janitor-harm-formula', '  const harmful = ', ';\n  if (harmful) {', 'janitor',
  );
  const sourceRange = findSourceRegion(
    source, 'janitor-harm-formula', '  const harmful = ', ';\n  if (harmful) {', 'janitor',
  );
  return target.slice(0, targetRange.start)
    + source.slice(sourceRange.start, sourceRange.end)
    + target.slice(targetRange.end);
}

function correctedOriginalGameRegions(source: string, includeReturnInterception: boolean): ApprovedSourceRegion[] {
  const formula = findSourceRegion(
    source, 'janitor-harm-formula', '  const harmful = ', ';\n  if (harmful) {', 'janitor',
  );
  const returnStart = '  if (source.owner !== target.owner && isSquabblehouseStaffCharacter(target)) {';
  const returnEnd = '  const before = m, printed = cards[target.cardId], hand = target.owner === \'player\' ? \'playerHand\' : \'cpuHand\';';
  let returnRegion: ApprovedSourceRegion;
  if (includeReturnInterception) {
    returnRegion = findSourceRegion(source, 'janitor-return-interception', returnStart, returnEnd, 'janitor');
  } else {
    const anchor = source.indexOf(returnEnd);
    insist(anchor >= 0 && source.indexOf(returnEnd, anchor + 1) < 0,
      'Could not anchor removed Janitor return interception in corrected-original');
    returnRegion = { name: 'janitor-return-interception', start: anchor, end: anchor, feature: 'janitor' };
  }
  return [
    formula,
    returnRegion,
    findSourceRegion(source, 'cashier-ability-branch',
      "else if (source.cardId === 'squabblehouse-cashier') {",
      "else if (source.cardId === 'waffle-warlord') {", 'cashier'),
    findSourceRegion(source, 'griddle-ability-branch',
      "else if (source.cardId === 'griddle-master') {",
      "else if (source.cardId === 'inmate-reformed') {", 'griddle'),
  ];
}

function janitorCounterFormula(source: string): string {
  const start = source.indexOf('  const harmful = ');
  const end = source.indexOf(';\n  if (harmful) {', start);
  insist(start >= 0 && end > start, 'Could not fingerprint the Janitor harmful-effect classification formula');
  return source.slice(start, end + 1);
}

function removeStaffReturnInterception(source: string): string {
  const marker = '  if (source.owner !== target.owner && isSquabblehouseStaffCharacter(target)) {';
  const begin = source.indexOf(marker);
  insist(begin >= 0 && source.indexOf(marker, begin + 1) < 0,
    'Expected exactly one v31 Janitor forced-return interception to remove from corrected-original');
  const nextStatement = '  const before = m, printed = cards[target.cardId], hand = target.owner === \'player\' ? \'playerHand\' : \'cpuHand\';';
  const end = source.indexOf(nextStatement, begin);
  insist(end > begin, 'Janitor forced-return interception is not an isolated returnToHand block');
  const interception = source.slice(begin, end);
  insist(interception.includes('const reversed = reverseWithJanitor(')
    && interception.trimEnd().endsWith('}'),
  'Refusing to remove unexpected code adjacent to the Janitor return interception');
  const prefix = source.slice(Math.max(0, begin - 400), begin);
  insist(prefix.includes('const departure = openTabDeparture(m, target);')
    && prefix.includes('if (departure.stopped) return m;'),
  'Corrected-original must retain the current global Open Tab and return-route gates');
  const corrected = source.slice(0, begin) + source.slice(end);
  const returnStart = corrected.indexOf('function returnToHand(');
  const returnEnd = corrected.indexOf('\nfunction ', returnStart + 1);
  const returnBody = corrected.slice(returnStart, returnEnd < 0 ? undefined : returnEnd);
  insist(!returnBody.includes('reverseWithJanitor'),
    'Corrected-original returnToHand must not retain a Janitor forced-return interception');
  return corrected;
}

function prepareCorrectedOriginal(sourceRoot: string): Record<string, string[]> {
  insist(existsSync(originalBaselineRoot), `Frozen v30 counterbenchmark snapshot is missing: ${originalBaselineRoot}`);
  const v30Root = path.join(originalBaselineRoot, 'lib/squabblemon-engine');
  const gameFile = 'lib/squabblemon-engine/src/gameEngine.ts';
  const waveFile = 'lib/squabblemon-engine/src/squabblehouseWave.ts';
  const janitorFile = 'lib/squabblemon-engine/src/afterHoursWave.ts';
  const currentGame = readFileSync(path.join(baselineRoot, gameFile), 'utf8');
  const originalGame = readFileSync(path.join(v30Root, 'src/gameEngine.ts'), 'utf8');
  let patchedGame = replaceConditionalBranch(currentGame, originalGame, 'squabblehouse-cashier', 'waffle-warlord');
  patchedGame = replaceConditionalBranch(patchedGame, originalGame, 'griddle-master', 'inmate-reformed');
  patchedGame = replaceJanitorCounterFormula(patchedGame, originalGame);
  const restoredFormula = janitorCounterFormula(patchedGame);
  insist(stableEqual(restoredFormula, janitorCounterFormula(originalGame)),
    'Corrected-original did not restore the complete authentic v30 Janitor harmful-effect formula');
  insist(!/hostileMove|execution|isSquabblehouseStaffCharacter/.test(restoredFormula),
    'Corrected-original Janitor formula still explicitly recognizes v31 staff movement or execution interception');
  patchedGame = removeStaffReturnInterception(patchedGame);
  assertSourceMatchesOutsideApprovedRegions(
    gameFile,
    currentGame,
    patchedGame,
    correctedOriginalGameRegions(currentGame, true),
    correctedOriginalGameRegions(patchedGame, false),
  );
  writeFileSync(path.join(sourceRoot, gameFile), patchedGame);
  let patchedWave = readFileSync(path.join(baselineRoot, waveFile), 'utf8');
  const originalWave = readFileSync(path.join(v30Root, 'src/squabblehouseWave.ts'), 'utf8');
  patchedWave = replaceTupleBlock(patchedWave, originalWave, "['squabblehouse-cashier'", 2);
  patchedWave = replaceTupleBlock(patchedWave, originalWave, "['griddle-master'", 2);
  assertSourceMatchesOutsideApprovedRegions(
    waveFile,
    readFileSync(path.join(baselineRoot, waveFile), 'utf8'),
    patchedWave,
    counterRegionsFor(waveFile, readFileSync(path.join(baselineRoot, waveFile), 'utf8')),
    counterRegionsFor(waveFile, patchedWave),
  );
  writeFileSync(path.join(sourceRoot, waveFile), patchedWave);
  const originalJanitor = readFileSync(path.join(v30Root, 'src/afterHoursWave.ts'), 'utf8');
  const currentJanitor = readFileSync(path.join(baselineRoot, janitorFile), 'utf8');
  const patchedJanitor = replaceTupleBlock(currentJanitor, originalJanitor, "['janitor'", 1);
  assertSourceMatchesOutsideApprovedRegions(
    janitorFile,
    currentJanitor,
    patchedJanitor,
    counterRegionsFor(janitorFile, currentJanitor),
    counterRegionsFor(janitorFile, patchedJanitor),
  );
  writeFileSync(path.join(sourceRoot, janitorFile), patchedJanitor);
  const branchSha = (start: string, end: string) => {
    const startIndex = originalGame.indexOf(start);
    const endIndex = originalGame.indexOf(end, startIndex);
    insist(startIndex >= 0 && endIndex > startIndex, `Could not fingerprint original source branch ${start}`);
    return sha256(originalGame.slice(startIndex, endIndex));
  };
  return {
    [gameFile]: [
      `old-v30-cashier-branch:${branchSha("else if (source.cardId === 'squabblehouse-cashier')", "else if (source.cardId === 'waffle-warlord')")}`,
      `old-v30-griddle-branch:${branchSha("else if (source.cardId === 'griddle-master')", "else if (source.cardId === 'inmate-reformed')")}`,
      `old-v30-janitor-harm-formula:${sha256(restoredFormula)}`,
      'remove-v31-staff-return-intercept; preserve shared movement/route/Open Tab gates',
    ],
    [waveFile]: [
      `old-v30-cashier-tuple:${sha256(tupleLines(originalWave, "['squabblehouse-cashier'", 2).join('\n'))}`,
      `old-v30-griddle-tuple:${sha256(tupleLines(originalWave, "['griddle-master'", 2).join('\n'))}`,
    ],
    [janitorFile]: [`old-v30-janitor-tuple:${sha256(tupleLines(originalJanitor, "['janitor'", 1).join('\n'))}`],
  };
}

function assertVersionStamp(sourceRoot: string, expected: number): void {
  const source = readFileSync(path.join(sourceRoot, 'lib/squabblemon-engine/src/multiplayer.ts'), 'utf8');
  const cardVersion = source.match(/export const CARD_BALANCE_VERSION\s*=\s*(\d+)/)?.[1];
  const onlineVersion = source.match(/export const ONLINE_RULES_VERSION\s*=\s*(\d+)/)?.[1];
  insist(Number(cardVersion) === expected && Number(onlineVersion) === expected,
    `Candidate engine version stamps must both equal v${expected}; found ${cardVersion}/${onlineVersion}`);
}

function copyBaselineSnapshot(destination: string): void {
  mkdirSync(destination, { recursive: true });
  cpSync(path.join(baselineRoot, 'lib'), path.join(destination, 'lib'), { recursive: true, dereference: false });
  cpSync(path.join(baselineRoot, 'scripts'), path.join(destination, 'scripts'), { recursive: true, dereference: false });
  copyFileSync(path.join(baselineRoot, 'tsconfig.base.json'), path.join(destination, 'tsconfig.base.json'));
  cpSync(path.join(baselineRoot, 'node_modules'), path.join(destination, 'node_modules'), { recursive: true, dereference: false });
  const moduleLink = path.join(destination, 'node_modules/@workspace/squabblemon-engine');
  rmSync(moduleLink, { recursive: true, force: true });
  symlinkSync(path.join(destination, 'lib/squabblemon-engine'), moduleLink, 'dir');
  for (const file of REVISION_SOURCE_FILES) {
    const relative = path.join(destination, file);
    if (!existsSync(path.dirname(relative))) mkdirSync(path.dirname(relative), { recursive: true });
    copyFileSync(path.join(workspaceRoot, file), relative);
  }
}

function preflightSnapshot(destination: string, manifest: JsonRecord): JsonRecord {
  const result = spawnSync(process.execPath, [
    '--import',
    'tsx',
    path.join(destination, 'scripts/src/squabblehouse-counter-revision-worker.ts'),
    '--preflight',
  ], { cwd: destination, encoding: 'utf8', timeout: 90_000 });
  insist(result.status === 0,
    `Isolated arm import/preflight probe failed for ${manifest.arm}: ${result.stderr || result.stdout}`);
  const preflightPath = path.join(resultRoot, manifest.arm as string, 'preflight.json');
  return JSON.parse(readFileSync(preflightPath, 'utf8')) as JsonRecord;
}

function prepareVariants(): void {
  const frozenManifest = validateFrozenBaseline();
  insist(!existsSync(experimentRoot),
    `Variant snapshot destination already exists; refusing overwrite: ${experimentRoot}`);
  assertVersionStamp(baselineRoot, REVISION_V31_CONTROL_VERSION);
  assertVersionStamp(workspaceRoot, REVISION_V32_CANDIDATE_VERSION);
  const baselineHashes = sourceFileHashes(baselineRoot);
  const changes = collectCandidateChanges(baselineHashes);
  const sharedMovementGateSha256 = sharedMovementGateFingerprintsAt(baselineRoot);
  mkdirSync(experimentRoot, { recursive: true });
  const candidateFingerprintBefore = stableHash(sourceFileHashes(workspaceRoot));
  const prepared: Record<string, JsonRecord> = {};
  const armRoots = new Map<RevisionArm, string>();
  try {
    for (const arm of REVISION_ARMS) {
      const destination = path.join(experimentRoot, arm);
      copyBaselineSnapshot(destination);
      armRoots.set(arm, destination);
      const engineRoot = path.join(destination, 'lib/squabblemon-engine');
      let proof: Record<string, string[]> = {};
      if (arm === 'combined-v32') {
        rmSync(engineRoot, { recursive: true, force: true });
        cpSync(candidateEngineRoot, engineRoot, { recursive: true, dereference: false });
        proof = Object.fromEntries(changes.map(change => [change.file, change.hunks.map(hunk => sha256(hunk.text))]));
      } else if (arm === 'corrected-original') {
        proof = prepareCorrectedOriginal(destination);
      } else if (arm !== 'current-v31') {
        proof = applyFeatureDelta(destination, changes, singleFeatureByArm[arm]!);
      }
      const isV31Arm = arm === 'current-v31' || arm === 'corrected-original';
      if (!isV31Arm) assertVersionStamp(destination, REVISION_V32_CANDIDATE_VERSION);
      if (isV31Arm) assertVersionStamp(destination, REVISION_V31_CONTROL_VERSION);
      const engineHashes = engineSourceHashes(sourceFingerprintsAt(destination, []));
      const sourceFingerprints = sourceFingerprintsAt(destination);
      insist(stableEqual(sharedMovementGateFingerprintsAt(destination), sharedMovementGateSha256),
        `Arm ${arm} changed frozen shared route, capacity, lock, or legal movement gates`);
      const versionMetadata = {
        cardBalanceVersion: isV31Arm ? REVISION_V31_CONTROL_VERSION : REVISION_V32_CANDIDATE_VERSION,
        onlineRulesVersion: isV31Arm ? REVISION_V31_CONTROL_VERSION : REVISION_V32_CANDIDATE_VERSION,
        balanceLabSchemaVersion: 2,
      };
      const variantFingerprint = variantSourceFingerprint(arm, engineHashes, versionMetadata);
      const manifest: JsonRecord = {
        schemaVersion: 1,
        arm,
        description: descriptions[arm],
        snapshotRoot: destination,
        sourceRootKind: arm === 'current-v31'
          ? 'immutable-frozen-v31-control'
          : arm === 'corrected-original'
            ? 'selectively-restored-v30-counter-logic-on-frozen-v31'
            : arm === 'combined-v32'
              ? 'exact-root-v32-candidate'
              : 'v31-plus-selected-v32-counter-hunks',
        sourceGitCommit: frozenManifest.sourceGitCommit ?? null,
        sourceRootCommit: null,
        frozenBaselineGitCommit: frozenManifest.sourceGitCommit ?? null,
        verifiedFrozenV31GitArchive: frozenManifest.verifiedGitArchive,
        experimentWorkspaceRoot: workspaceRoot,
        acceptedReportSha256: frozenManifest.acceptedReportSha256,
        frozenV31EngineSourceSha256: frozenManifest.engineSourceSha256,
        engineSourceSha256: engineHashes,
        sourceFingerprints,
        sharedMovementGateSha256,
        versionMetadata,
        variantSourceFingerprint: variantFingerprint,
        engineImportBinding: {
          data: path.join(destination, 'lib/squabblemon-engine/src/data.ts'),
          balanceLab: path.join(destination, 'lib/squabblemon-engine/src/balanceLab.ts'),
          multiplayer: path.join(destination, 'lib/squabblemon-engine/src/multiplayer.ts'),
        },
        enginePackage: JSON.parse(readFileSync(path.join(engineRoot, 'package.json'), 'utf8')),
        selectedSourceHunkSha256: proof,
        candidateRootEngineSourceSha256: sourceFileHashes(workspaceRoot),
        exactCrew: CREW_DECK,
        fixedOpponents: OPPONENT_IDS,
        sourceSupportFiles: REVISION_SOURCE_FILES,
      };
      writeFileSync(path.join(destination, ARM_MANIFEST_NAME), `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
      prepared[arm] = { manifest, engineHashes, sourceFingerprints };
    }
    insist(stableHash(sourceFileHashes(workspaceRoot)) === candidateFingerprintBefore,
      'Root v32 candidate changed during arm snapshot preparation');
    const preflights: JsonRecord[] = [];
    for (const arm of REVISION_ARMS) {
      const preflight = preflightSnapshot(armRoots.get(arm)!, prepared[arm].manifest);
      insist(preflight.preflightPassed === true
        && preflight.variantSourceFingerprint === prepared[arm].manifest.variantSourceFingerprint,
      `Preflight output did not confirm exact source fingerprint for ${arm}`);
      preflights.push(preflight);
    }
    assertExactCrewAndRuntimeKits(preflights);
    assertArmKitIsolation(preflights);
    writeFileSync(path.join(experimentRoot, 'preparation-manifest.json'), `${JSON.stringify({
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      frozenV31EngineSourceSha256: frozenManifest.engineSourceSha256,
      frozenBaselineGitCommit: frozenManifest.sourceGitCommit ?? null,
      verifiedFrozenV31GitArchive: frozenManifest.verifiedGitArchive,
      rootV32CandidateEngineSourceSha256: sourceFileHashes(workspaceRoot),
      sourceChangeWhitelist: allowedEngineChanges,
      sharedMovementGateSha256,
      sourceHunkClassification: changes.map(change => ({
        file: change.file,
        hunks: change.hunks.map(hunk => ({
          sha256: sha256(hunk.text),
          features: hunk.features,
          changedLinesSha256: sha256(JSON.stringify({
            old: hunk.changedOldLines,
            next: hunk.changedNewLines,
          })),
        })),
      })),
      arms: Object.fromEntries(REVISION_ARMS.map(arm => [arm, {
        snapshotRoot: armRoots.get(arm),
        variantSourceFingerprint: prepared[arm].manifest.variantSourceFingerprint,
        engineSourceSha256: prepared[arm].engineHashes,
      }])),
    }, null, 2)}\n`, { flag: 'wx' });
    console.log(JSON.stringify({
      variants: REVISION_ARMS.map(arm => ({
        arm,
        snapshot: armRoots.get(arm),
        fingerprint: prepared[arm].manifest.variantSourceFingerprint,
      })),
      preparedRoot: experimentRoot,
      sourceChangeFiles: changes.map(change => change.file),
      preflightPassedForEveryArm: true,
    }, null, 2));
  } catch (error) {
    throw error;
  }
}

function assertArmSnapshot(arm: RevisionArm): string {
  const snapshot = path.join(experimentRoot, arm);
  const manifestPath = path.join(snapshot, ARM_MANIFEST_NAME);
  insist(existsSync(manifestPath), `Arm ${arm} is not prepared: ${manifestPath}`);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as JsonRecord;
  insist(manifest.arm === arm && path.resolve(manifest.snapshotRoot) === snapshot,
    `Arm ${arm} snapshot manifest identity mismatch`);
  insist(stableEqual(sourceFingerprintsAt(snapshot), manifest.sourceFingerprints),
    `Arm ${arm} source fingerprints changed after immutable snapshot preparation`);
  return snapshot;
}

function runWorker(arm: RevisionArm, workerArgs: string[]): void {
  const snapshot = assertArmSnapshot(arm);
  const result = spawnSync(process.execPath, [
    '--import',
    'tsx',
    path.join(snapshot, 'scripts/src/squabblehouse-counter-revision-worker.ts'),
    ...workerArgs,
  ], { cwd: snapshot, encoding: 'utf8', timeout: 300_000, maxBuffer: 64 * 1024 * 1024 });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  insist(result.status === 0, `Frozen worker exited ${result.status ?? result.signal}: ${result.stderr}`);
}

function runPreflight(arm: RevisionArm): void {
  const snapshot = assertArmSnapshot(arm);
  const outputPath = path.join(resultRoot, arm, 'preflight.json');
  if (!existsSync(outputPath)) {
    runWorker(arm, ['--preflight']);
    return;
  }
  const saved = JSON.parse(readFileSync(outputPath, 'utf8')) as JsonRecord;
  const manifest = JSON.parse(readFileSync(path.join(snapshot, ARM_MANIFEST_NAME), 'utf8')) as JsonRecord;
  insist(saved.preflightPassed === true && saved.arm === arm
    && saved.variantSourceFingerprint === manifest.variantSourceFingerprint,
  `Write-once preflight output does not match the frozen ${arm} arm`);
  console.log(JSON.stringify({ arm, preflight: outputPath, reusedWriteOnce: true }, null, 2));
}

async function runShards(arm: RevisionArm, args: readonly string[]): Promise<void> {
  const policy = args[args.indexOf('--policy') + 1];
  const schedule = args[args.indexOf('--schedule') + 1];
  insist(['greedy', 'seeded-legal'].includes(policy), '--shard requires --policy greedy|seeded-legal');
  insist(['primary', 'holdout'].includes(schedule), '--shard requires --schedule primary|holdout');
  insist(schedule !== 'holdout' || policy === 'greedy', 'Revision confirmation is greedy-only');
  const selectedOpponent = args.includes('--opponent') ? args[args.indexOf('--opponent') + 1] : undefined;
  const opponents = selectedOpponent ? [selectedOpponent] : [...OPPONENT_IDS];
  insist(opponents.every(opponent => OPPONENT_IDS.includes(opponent as typeof OPPONENT_IDS[number])),
    '--opponent must name a frozen opponent ID');
  const tasks = opponents.map(opponent => ({
    opponent,
    childArgs: ['--shard', '--opponent', opponent, '--policy', policy, '--schedule', schedule],
  }));
  insist(tasks.length <= 3 && new Set(tasks.map(task => task.opponent)).size === tasks.length,
    'Shard runner concurrency must be at most three workers with distinct opponents');
  const lockDirectory = path.join(resultRoot, '.active-arm-run');
  try {
    mkdirSync(lockDirectory);
  } catch {
    throw new Error(`Another revision shard batch is active; finish arms serially before starting ${arm}`);
  }
  try {
    writeFileSync(path.join(lockDirectory, 'lock.json'), `${JSON.stringify({
      arm, opponents, policy, schedule, pid: process.pid, startedAt: new Date().toISOString(),
    }, null, 2)}\n`, { flag: 'wx' });
    const snapshot = assertArmSnapshot(arm);
    const results = tasks.map(task => ({
      ...task,
      child: spawn(process.execPath, [
        '--import', 'tsx',
        path.join(snapshot, 'scripts/src/squabblehouse-counter-revision-worker.ts'),
        ...task.childArgs,
      ], { cwd: snapshot, stdio: ['ignore', 'pipe', 'pipe'] }),
    }));
    const logs = results.map(result => new Promise<void>((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      result.child.stdout?.on('data', chunk => { stdout += chunk.toString(); });
      result.child.stderr?.on('data', chunk => { stderr += chunk.toString(); });
      result.child.on('error', reject);
      result.child.on('close', code => {
        if (stdout) process.stdout.write(stdout);
        if (stderr) process.stderr.write(stderr);
        if (code !== 0) reject(new Error(`${result.opponent} shard worker failed with code ${code}: ${stderr}`));
        else resolve();
      });
    }));
    await Promise.all(logs);
  } finally {
    rmSync(lockDirectory, { recursive: true, force: true });
  }
}

function verifyMergedReports(): void {
  const reports = REVISION_ARMS.map(arm => {
    const snapshot = assertArmSnapshot(arm);
    const reportPath = path.join(resultRoot, arm, 'diner/current-rules.json');
    insist(existsSync(reportPath), `Missing merged full result for ${arm}: ${reportPath}`);
    const report = JSON.parse(readFileSync(reportPath, 'utf8')) as JsonRecord;
    const armManifest = JSON.parse(readFileSync(path.join(snapshot, ARM_MANIFEST_NAME), 'utf8')) as JsonRecord;
    insist(report.arm === arm && report.pilot === false, `${arm} report is not its unique full merged report`);
    insist(report.versionMetadata?.variantSourceFingerprint === armManifest.variantSourceFingerprint,
      `${arm} report fingerprint does not match its prepared source`);
    insist(stableEqual(report.versionMetadata?.engineSourceSha256, armManifest.engineSourceSha256),
      `${arm} report engine hashes do not match its arm source`);
    return report;
  });
  assertMatchedCaseMaps(reports);
  assertExactCrewAndRuntimeKits(reports);
  assertArmKitIsolation(reports);
  const verification = {
    schemaVersion: 1,
    experiment: 'six-arm-squabblehouse-counter-revision',
    verified: true,
    completedAt: new Date().toISOString(),
    arms: REVISION_ARMS,
    uniqueCasesPerArm: reports[0].simulationAccounting.uniqueRequestedMatchups,
    expectedCasesPerArm: 1008,
    shardCountPerArm: expectedShards(reports[0]),
    exactCaseKeyCoverage: true,
    identicalCaseKeysAcrossArms: true,
    identicalCrewOrderAndOpponentLists: true,
    nonselectedAbilityIsolation: true,
    exactEngineHashesAndFingerprintsChecked: true,
    duplicateExecutionsAreValidationReplays: true,
  };
  const output = path.join(resultRoot, 'verification.json');
  writeFileSync(output, `${JSON.stringify(verification, null, 2)}\n`, { flag: 'wx' });
  console.log(JSON.stringify({ verification: output, uniqueCasesPerArm: verification.uniqueCasesPerArm }, null, 2));
}

function expectedShards(report: JsonRecord): number {
  return Array.isArray(report.blocks) ? report.blocks.length : 0;
}

async function main(): Promise<void> {
  const options = parseArgs();
  if (options.action === '--prepare-variants') {
    prepareVariants();
    return;
  }
  if (options.action === '--verify') {
    verifyMergedReports();
    return;
  }
  const arm = options.arm!;
  if (options.action === '--preflight') runPreflight(arm);
  else if (options.action === '--pilot') runWorker(arm, ['--pilot']);
  else if (options.action === '--merge') runWorker(arm, ['--merge']);
  else await runShards(arm, options.args);
}

void main().catch(error => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});