import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const frontend = 'artifacts/squabblemon';
const sourceTest = name => `${frontend}/src/${name}`;
const require = createRequire(import.meta.url);
const sha256 = value => createHash('sha256').update(value).digest('hex');

// Bounded execution: a hung check must fail the gate, never stall a build.
// Node 24 does not cancel a never-settling test when its event loop drains
// (Node 22 does), so every test gets an explicit per-test limit, and every
// check process gets a hard wall-clock limit. Defaults are well above the
// slowest observed suite (~21 s) and Vite build (~40 s) on a 2-core host.
export const defaultTestTimeoutMs = 2 * 60 * 1000;
export const defaultTestProcessTimeoutMs = 10 * 60 * 1000;
export const defaultCommandTimeoutMs = 15 * 60 * 1000;

// Required on every local frontend build and every Netlify build. Add new
// critical helpers here, not to a separate optional npm test list.
export const criticalSuites = [
  { id: 'purchase-recovery', files: [
    'lib/pullPayment.test.ts', 'lib/packJournal.test.ts', 'lib/shopJournal.test.ts',
    'lib/shopDestination.test.ts', 'lib/finishCounter.test.ts', 'lib/matchRecovery.test.ts',
  ].map(sourceTest) },
  { id: 'gacha-lifecycle', files: [
    'lib/packGymFinale.test.ts', 'lib/packGymFilm.test.ts', 'lib/packRewardRarity.test.ts',
    'lib/packRewardArtwork.test.tsx', 'components/GachaRevealSequence.test.tsx',
  ].map(sourceTest) },
  { id: 'reward-presentation', files: [
    'lib/rewardReceipts.test.ts', 'lib/rewardBroadcast.test.ts', 'lib/resultBroadcastEligibility.test.ts',
    'lib/notificationCatalog.test.ts', 'lib/loadingScenes.test.ts',
    'components/AccountCheckInCalendar.test.tsx', 'components/MonthlyLoginTrack.test.tsx',
    'components/fadecade/bossRaidPresentation.test.ts',
    'components/fadecade/anunakiRaidPresentation.test.tsx',
    'components/fadecade/raidCardChoices.test.ts',
  ].map(sourceTest) },
  // React's act-based lifecycle tests need its test runtime even on a production build host.
  { id: 'battle-render-lifecycle', nodeEnv: 'test', files: [
    'battlePreview.test.ts', 'components/MultiplayerBattle.projection.test.tsx',
    'components/BattleIdleMotion.performance.test.tsx', 'components/BattleFxImage.lifecycle.test.tsx',
    'components/BattleAttack.death.test.tsx',
  ].map(sourceTest) },
  { id: 'battle-runtime', nodeEnv: 'test', files: [
    'replayCodec.test.ts', 'lib/battleComputation.test.ts', 'lib/battleComputation.hooks.test.ts', 'lib/menuRefresh.test.ts', 'lib/notificationBackground.test.ts',
  ].map(sourceTest) },
  { id: 'story-delivery-contract', files: [
    sourceTest('lib/story/chapterCatalog.test.ts'), `${frontend}/scripts/check-story-delivery.test.mjs`,
  ] },
  { id: 'kumite-breakthrough', nodeEnv: 'test', files: [
    'lib/squabblemon-engine/breakthrough.test.ts',
    'lib/squabblemon-engine/breakthroughActions.test.ts',
    'lib/squabblemon-engine/breakthroughSupports.test.ts',
    'lib/squabblemon-engine/breakthroughNetwork.test.ts',
    'lib/squabblemon-engine/breakthroughFitness.test.ts',
    'lib/squabblemon-engine/breakthroughMusic.test.ts',
    'lib/squabblemon-engine/breakthroughCommunity.test.ts',
    'lib/squabblemon-engine/breakthroughHouse.test.ts',
    'lib/squabblemon-engine/breakthroughSummons.test.ts',
    'lib/squabblemon-engine/breakthroughReactions.test.ts',
    'lib/squabblemon-engine/breakthroughContracts.test.ts',
    'lib/squabblemon-engine/breakthroughFactions.test.ts',
    'lib/squabblemon-engine/breakthroughControl.test.ts',
    'lib/squabblemon-engine/breakthroughControlIntegration.test.ts',
    'lib/squabblemon-engine/breakthroughSpecials.test.ts',
    'lib/squabblemon-engine/breakthroughSpecials.integration.test.ts',
    'lib/squabblemon-engine/breakthroughFullCatalog.test.ts',
    'lib/squabblemon-engine/breakthroughLookup.test.ts',
    'lib/squabblemon-engine/breakthroughNeighborhood.test.ts',
    'lib/squabblemon-engine/breakthroughBlockbusters.test.ts',
    'lib/squabblemon-engine/breakthroughExpansionBatch.test.ts',
    'lib/squabblemon-engine/breakthroughCatalog.test.ts',
    'lib/squabblemon-engine/breakthroughWave2.test.ts',
    'lib/squabblemon-engine/breakthroughPeriodic.test.ts',
    'lib/squabblemon-engine/breakthroughRoom.test.ts',
    'lib/squabblemon-engine/breakthroughRelease.test.ts',
    sourceTest('components/breakthrough/practiceDecks.test.ts'),
    sourceTest('components/breakthrough/productionBoundary.test.ts'),
    sourceTest('components/breakthrough/handSlots.test.ts'),
    sourceTest('components/breakthrough/deploymentInput.test.ts'),
    sourceTest('components/breakthrough/combatPresentation.test.ts'),
    sourceTest('components/breakthrough/laneGeometry.test.ts'),
    sourceTest('components/breakthrough/useDeploymentDrag.test.ts'),
    sourceTest('components/breakthrough/BreakthroughArena.lifecycle.test.tsx'),
    sourceTest('components/breakthrough/FlameBaseHealth.lifecycle.test.tsx'),
    sourceTest('components/breakthrough/mediaBudget.test.ts'),
    sourceTest('components/breakthrough/BreakthroughHowToPlay.test.tsx'),
    sourceTest('lib/preparedPatches.test.ts'),
    sourceTest('components/profile/FighterPortrait.test.tsx'),
    sourceTest('lib/battlePortrait.test.tsx'),
    sourceTest('lib/deckJourney.test.ts'),
    sourceTest('lib/dojoReminder.test.ts'),
    sourceTest('components/kumite/KumiteOpponentSearch.test.tsx'),
    sourceTest('components/kumite/KumiteMatchMedia.lifecycle.test.tsx'),
    sourceTest('components/kumite/KumiteSearchBackdrop.lifecycle.test.tsx'),
    sourceTest('components/breakthrough/ResultStage.test.tsx'),
    'artifacts/squabblemon/e2e/kumite-entry-handoff.test.ts',
  ] },
  { id: 'kumite-expansion', files: [
    sourceTest('kumiteExpansion.test.ts'), sourceTest('kumiteClock.test.ts'),
    'artifacts/api-server/src/lib/kumiteMastery.test.ts',
  ] },
  { id: 'featured-banner-rules', files: [
    'artifacts/api-server/src/lib/featuredBanners.test.ts',
    'artifacts/api-server/src/lib/collectionEconomy.test.ts',
    'artifacts/api-server/src/lib/pullBanners.test.ts',
  ] },
  { id: 'anunaki-expansion', files: [
    'storyAnunaki.test.ts', 'anunakiRaid.test.ts', 'anunakiEvent.test.ts',
    'anunakiCosmetics.test.ts', 'specialMoves.test.ts', 'lib/chromaBattery.test.ts',
  ].map(sourceTest) },
  { id: 'rookie-guidance', files: ['lib/tutorialVoice.test.ts', 'components/DrFadeWelcome.test.tsx', 'components/tutorialGuidance.test.ts'].map(sourceTest) },
  { id: 'payment-boundaries', files: [
    'artifacts/api-server/src/lib/payments/provider.test.ts',
    'artifacts/api-server/src/lib/payments/geography.test.ts',
    'artifacts/api-server/src/lib/payments/storeSmokeCheck.test.ts',
  ] },
  { id: 'release-guard-regressions', files: [
    'scripts/build-netlify.test.mjs', 'scripts/release-checks.test.mjs', 'scripts/boot-assets.test.mjs',
    'scripts/check-netlify-migrations.test.mjs', 'scripts/database-test-tiers.test.mjs',
    `${frontend}/scripts/check-entry-bundle.test.mjs`,
    `${frontend}/scripts/check-style-invalidation.test.mjs`,
  ] },
];

function tsxLoader(root = workspaceRoot) {
  return pathToFileURL(require.resolve('tsx', { paths: [path.join(root, frontend)] })).href;
}

export function requiredSourceChecks(root = workspaceRoot) {
  return [
    ...criticalSuites.map(suite => ({ ...suite, kind: 'tests' })),
    { id: 'story-music', kind: 'command', cwd: frontend, args: ['--import', tsxLoader(root), 'scripts/generate-story-music-routes.ts', '--check'] },
    { id: 'story-delivery-source', kind: 'command', cwd: frontend, args: ['--import', tsxLoader(root), 'scripts/generate-story-delivery.ts', '--check'] },
  ];
}

export function frontendBuildChecks(root = workspaceRoot) {
  return [
    ...requiredSourceChecks(root),
    { id: 'frontend-bundle', kind: 'command', args: ['node_modules/vite/bin/vite.js', 'build', '--config', `${frontend}/vite.config.ts`] },
    { id: 'story-delivery-budget', kind: 'command', cwd: frontend, args: ['scripts/check-story-delivery.mjs'] },
    { id: 'entry-budget', kind: 'command', cwd: frontend, args: ['scripts/check-entry-bundle.mjs'] },
    { id: 'emitted-css-and-panels', kind: 'command', cwd: frontend, args: ['scripts/check-style-invalidation.mjs'] },
  ];
}

function assertProcessFinished(result, id, timeoutMs) {
  if (result.error?.code === 'ETIMEDOUT') {
    throw new Error(`${id} timed out after ${timeoutMs} ms and was killed; a hung check cannot pass the gate.`);
  }
  if (result.error) throw result.error;
}

export function assertStrictTestResult(result, files, cwd) {
  if (result.error) throw result.error;
  if (result.signal || result.status !== 0) throw new Error(`Critical tests failed (${result.signal || `exit ${result.status ?? 'unknown'}`}).`);
  const events = String(result.stdout ?? '').split('\n').filter(line => line.startsWith('RELEASE_TEST_EVENT '))
    .map(line => JSON.parse(line.slice('RELEASE_TEST_EVENT '.length)));
  const summary = events.findLast(event => event.type === 'test:summary' && !event.data.file)?.data;
  if (!summary?.success || !summary.counts?.tests) throw new Error('Critical tests did not report a successful nonempty suite.');
  for (const key of ['failed', 'cancelled', 'skipped', 'todo']) {
    if (summary.counts[key] !== 0) throw new Error(`Critical tests reported ${key}: ${summary.counts[key] ?? 'missing'}.`);
  }
  const registeredFiles = new Set(events.filter(event => ['test:pass', 'test:fail'].includes(event.type)
    && event.data.file && event.data.name !== event.data.file && event.data.details?.type !== 'suite')
    .map(event => path.resolve(event.data.file)));
  for (const file of files) {
    if (!registeredFiles.has(path.resolve(cwd, file))) throw new Error(`Critical test file registered no test cases: ${file}`);
  }
  return summary.counts;
}

export function runCheck(check, { root = workspaceRoot, env = process.env, quiet = false,
  testTimeoutMs = check.testTimeoutMs ?? defaultTestTimeoutMs,
  timeoutMs = check.timeoutMs ?? (check.kind === 'tests' ? defaultTestProcessTimeoutMs : defaultCommandTimeoutMs) } = {}) {
  const cwd = path.resolve(root, check.cwd ?? '.');
  const files = check.files?.map(file => path.resolve(root, file));
  if (files) for (const file of files) if (!existsSync(file)) throw new Error(`Required test is missing: ${file}`);
  const args = check.kind === 'tests' ? [
    '--import', path.join(root, 'scripts/battle-test-css.mjs'), '--import', tsxLoader(root),
    '--test', '--test-concurrency=2', `--test-timeout=${testTimeoutMs}`,
    `--test-reporter=${path.join(root, 'scripts/release-test-reporter.mjs')}`, ...files,
  ] : check.args;
  const started = Date.now();
  // No database access belongs to this fast tier. Native tests have separate,
  // guarded commands in release-check-inventory.json.
  const childEnv = { ...env, DATABASE_URL: '' };
  if (check.kind === 'tests' && check.nodeEnv) childEnv.NODE_ENV = check.nodeEnv;
  delete childEnv.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, args, { cwd, env: childEnv, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
    timeout: timeoutMs, killSignal: 'SIGKILL' });
  let counts;
  try {
    assertProcessFinished(result, check.id, timeoutMs);
    if (check.kind === 'tests') counts = assertStrictTestResult(result, files, cwd);
    else {
      if (result.signal || result.status !== 0) throw new Error(`${check.id} failed (${result.signal || `exit ${result.status ?? 'unknown'}`}).`);
    }
  } catch (error) {
    if (!quiet) process.stderr.write(`${result.stdout ?? ''}${result.stderr ?? ''}`);
    throw error;
  }
  if (!quiet) {
    if (counts) console.log(`PASS ${check.id}: ${counts.tests} tests, zero failures/skips/todos.`);
    else process.stdout.write(`${result.stdout ?? ''}${result.stderr ?? ''}`);
  }
  return { id: check.id, status: 'passed', elapsedMs: Date.now() - started, ...(counts && { counts }) };
}

export function executeChecks(checks, execute = check => runCheck(check)) {
  if (!checks.length || new Set(checks.map(check => check.id)).size !== checks.length) throw new Error('Release check inventory is empty or has duplicate IDs.');
  const results = [];
  for (const check of checks) {
    const result = execute(check);
    if (result?.id !== check.id || result.status !== 'passed') throw new Error(`Required check ${check.id} did not pass; skipped or missing results block the gate.`);
    results.push(result);
  }
  return results;
}

function releaseIdentity(root) {
  const git = args => {
    const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
    if (result.status !== 0) throw new Error('Cannot bind release verification to a Git revision.');
    return result.stdout;
  };
  const untrackedSourceFiles = git(['ls-files', '--others', '--exclude-standard', '-z', '--',
    'lib', 'artifacts/api-server/src', 'artifacts/squabblemon/src', 'artifacts/squabblemon/scripts', 'artifacts/squabblemon/public', 'netlify', 'scripts/src',
    ':(glob)artifacts/squabblemon/*', ':(glob)artifacts/api-server/*',
    ':(glob)scripts/*.mjs', ':(glob)scripts/*.json', ':(glob)*.json', ':(glob)*.toml',
  ]).split('\0').filter(Boolean).sort();
  return { baseCommit: git(['rev-parse', 'HEAD']).trim(), workingTreeStatus: git(['status', '--porcelain']),
    untrackedSourceHashes: Object.fromEntries(untrackedSourceFiles.map(file => [file, sha256(readFileSync(path.join(root, file)))])),
    trackedDiffSha256: sha256(git(['diff', '--binary', 'HEAD'])),
    criticalInputHashes: Object.fromEntries([...new Set(criticalSuites.flatMap(suite => suite.files).concat([
      'scripts/release-checks.mjs', 'scripts/release-test-reporter.mjs', 'scripts/release-check-inventory.json',
      'scripts/build-netlify.mjs', 'package.json', `${frontend}/package.json`,
      `${frontend}/scripts/generate-story-music-routes.ts`, `${frontend}/src/storyMusicRoutes.json`,
      `${frontend}/scripts/generate-story-delivery.ts`, `${frontend}/scripts/check-story-delivery.mjs`, `${frontend}/src/lib/story/generated/index.json`,
    ]))].map(file => [file, sha256(readFileSync(path.join(root, file)))])) };
}

export function assertStableReleaseIdentity(before, after) {
  for (const key of ['baseCommit', 'trackedDiffSha256', 'criticalInputHashes', 'untrackedSourceHashes']) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) throw new Error('Release source changed during verification; rerun against frozen source.');
  }
}

export function runReleaseChecks({ build = false, root = workspaceRoot, env = process.env,
  evidenceFile = path.join(root, '.cache/release-gates', build ? 'build.json' : 'source.json') } = {}) {
  const record = { schemaVersion: 1, status: 'running', tier: build ? 'required-build' : 'required-source',
    startedAt: new Date().toISOString(), node: process.version, results: [],
    limitations: ['Local source/build evidence only; no hosted deployment, native database, browser, device or live transaction is implied.',
      'baseCommit is the Git base; trackedDiffSha256, untrackedSourceHashes and criticalInputHashes record this working candidate.'],
    additionalTiers: 'scripts/release-check-inventory.json' };
  const save = () => {
    mkdirSync(path.dirname(path.resolve(evidenceFile)), { recursive: true });
    writeFileSync(evidenceFile, `${JSON.stringify(record, null, 2)}\n`);
  };
  // Replace an earlier passed record before starting: a later failed invocation
  // must not leave a stale green result at the advertised evidence path.
  save();
  try {
    Object.assign(record, releaseIdentity(root));
    executeChecks(build ? frontendBuildChecks(root) : requiredSourceChecks(root), check => {
      const result = runCheck(check, { root, env });
      record.results.push(result);
      return result;
    });
    assertStableReleaseIdentity(record, releaseIdentity(root));
    record.status = 'passed';
    record.verifiedAt = new Date().toISOString();
    save();
    console.log(`PASS required ${build ? 'build' : 'source'} release gate at ${record.baseCommit}${record.workingTreeStatus ? ' (working changes recorded)' : ''}. Native database/browser tiers remain separate. Evidence: ${evidenceFile}`);
    return record;
  } catch (error) {
    record.status = 'failed';
    record.failure = error instanceof Error ? error.message : String(error);
    record.finishedAt = new Date().toISOString();
    save();
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2);
    if (args.includes('--inventory')) {
      if (args.length !== 1) throw new Error('--inventory cannot be combined with other options.');
      console.log(JSON.stringify({ required: frontendBuildChecks().map(check => ({ id: check.id, kind: check.kind, files: check.files })),
        additional: JSON.parse(readFileSync(new URL('./release-check-inventory.json', import.meta.url), 'utf8')) }, null, 2));
    } else {
      const evidenceIndex = args.indexOf('--evidence');
      const evidenceFile = evidenceIndex >= 0 ? args[evidenceIndex + 1] : undefined;
      if (evidenceIndex >= 0 && (!evidenceFile || evidenceFile.startsWith('--'))) throw new Error('--evidence requires a file path.');
      const remaining = evidenceIndex < 0 ? args : args.filter((_, index) => index !== evidenceIndex && index !== evidenceIndex + 1);
      if (remaining.some(arg => arg !== '--build') || remaining.length > 1) throw new Error('Use --build, --inventory, or --evidence PATH; release checks cannot be filtered or skipped.');
      runReleaseChecks({ build: args.includes('--build'), evidenceFile });
    }
  } catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }
}
