import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, symlinkSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { workspaceRoot, criticalSuites, requiredSourceChecks, frontendBuildChecks, executeChecks, runCheck, assertStableReleaseIdentity, runReleaseChecks,
  defaultTestTimeoutMs, defaultTestProcessTimeoutMs, defaultCommandTimeoutMs } from './release-checks.mjs';
const require = createRequire(import.meta.url);
const tsx = pathToFileURL(require.resolve('tsx', { paths: [path.join(workspaceRoot, 'artifacts/squabblemon')] })).href;
const childEnv = { ...process.env }; delete childEnv.NODE_TEST_CONTEXT;
function fixture(t) {
  const dir = mkdtempSync(path.join(tmpdir(), 'release-gate-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}
function testFile(dir, source) {
  const file = path.join(dir, 'critical.test.mjs'); writeFileSync(file, source); return file;
}
function testGate(file) { return { id: 'fixture-critical', kind: 'tests', files: [file] }; }
function markerGate(dir) { return { id: 'must-not-build', kind: 'command', args: ['-e', `require('fs').writeFileSync(${JSON.stringify(path.join(dir, 'built'))}, 'built')`] }; }

test('required inventory covers recovery, films and rewards and both builds share the same path', () => {
  const files = new Set(criticalSuites.flatMap(suite => suite.files));
  for (const file of ['lib/pullPayment.test.ts', 'lib/packJournal.test.ts', 'lib/shopJournal.test.ts', 'lib/shopDestination.test.ts', 'lib/finishCounter.test.ts', 'lib/packGymFilm.test.ts', 'lib/rewardReceipts.test.ts', 'components/MonthlyLoginTrack.test.tsx', 'kumiteExpansion.test.ts', 'kumiteClock.test.ts']) {
    assert.ok(files.has(`artifacts/squabblemon/src/${file}`));
  }
  assert.ok(files.has('artifacts/api-server/src/lib/kumiteMastery.test.ts'));
  for (const file of files) assert.ok(existsSync(path.join(workspaceRoot, file)), `Missing inventoried test ${file}`);
  const local = JSON.parse(readFileSync(path.join(workspaceRoot, 'artifacts/squabblemon/package.json'), 'utf8')).scripts.build;
  assert.equal(local, 'node ../../scripts/release-checks.mjs --build');
  const netlify = readFileSync(path.join(workspaceRoot, 'scripts/build-netlify.mjs'), 'utf8');
  assert.match(netlify, /import \{ runReleaseChecks \} from '\.\/release-checks.mjs'/);
  assert.match(netlify, /runReleaseChecks\(\{ build: true, env \}\)/);
  assert.ok(!netlify.includes("'node_modules/vite/bin/vite.js'"), 'Netlify must not bypass shared frontend build');
  const source = requiredSourceChecks().map(check => check.id);
  assert.deepEqual(frontendBuildChecks().map(check => check.id), [...source, 'frontend-bundle', 'story-delivery-budget', 'entry-budget', 'emitted-css-and-panels']);
});

test('real registered tests pass and expose exact no-skip counts', t => {
  const dir = fixture(t), file = testFile(dir, "import test from 'node:test'; test('actual assertion', () => {});\n");
  const result = runCheck(testGate(file), { quiet: true });
  assert.equal(result.status, 'passed'); assert.equal(result.counts.tests, 1); assert.equal(result.counts.skipped, 0);
});

for (const [name, source, message] of [
  ['failed helper', "import test from 'node:test'; import assert from 'node:assert/strict'; test('reject changed charge', () => assert.equal(2,1));", /Critical tests failed/],
  ['skipped helper', "import test from 'node:test'; test.skip('required recovery', () => {});", /skipped: 1/],
  ['todo helper', "import test from 'node:test'; test.todo('required payout');", /todo: 1/],
  ['empty helper file', 'export const noTests = true;', /registered no test cases/],
  ['cancelled helper', "import test from 'node:test'; test('unfinished recovery', () => new Promise(() => {}));", /Critical tests failed/],
]) {
  test(`${name} blocks the build even when Node would otherwise exit zero`, t => {
    const dir = fixture(t), file = testFile(dir, source);
    // A short per-test limit keeps the never-settling case fast; Node 24 would
    // otherwise wait forever instead of cancelling it when the loop drains.
    assert.throws(() => executeChecks([testGate(file), markerGate(dir)], check => runCheck(check, { quiet: true, testTimeoutMs: 2000 })), message);
    assert.equal(existsSync(path.join(dir, 'built')), false);
  });
}

test('every required check is bounded by default and the limits leave headroom', () => {
  assert.ok(defaultTestTimeoutMs >= 60_000, 'per-test limit must exceed the slowest suite');
  assert.ok(defaultTestProcessTimeoutMs > defaultTestTimeoutMs, 'process limit must exceed the per-test limit');
  assert.ok(defaultCommandTimeoutMs >= 5 * 60_000, 'command limit must allow a full Vite build');
});

test('a never-settling required test fails by its per-test limit on every Node version', t => {
  const dir = fixture(t), file = testFile(dir, "import test from 'node:test'; test('unfinished recovery', () => new Promise(() => {}));");
  const started = Date.now();
  assert.throws(() => runCheck(testGate(file), { quiet: true, testTimeoutMs: 1000 }), /Critical tests failed/);
  assert.ok(Date.now() - started < 30_000, 'the gate must not wait for the event loop to drain');
});

test('a hung test process or command is killed and fails the gate instead of stalling the build', t => {
  const dir = fixture(t);
  const hungTests = testFile(dir, "import test from 'node:test'; test('holds the process', () => { setInterval(() => {}, 1000); });");
  assert.throws(() => executeChecks([{ ...testGate(hungTests), timeoutMs: 1500 }, markerGate(dir)], check => runCheck(check, { quiet: true })), /fixture-critical timed out after 1500 ms/);
  assert.equal(existsSync(path.join(dir, 'built')), false);
  const hungCommand = { id: 'hung-command', kind: 'command', args: ['-e', 'setInterval(() => {}, 1000)'], timeoutMs: 1500 };
  assert.throws(() => runCheck(hungCommand, { quiet: true }), /hung-command timed out after 1500 ms and was killed/);
});

test('a missing required file and an explicitly skipped result cannot become a passed gate', t => {
  const dir = fixture(t);
  assert.throws(() => runCheck(testGate(path.join(dir, 'missing.mjs')), { quiet: true }), /Required test is missing/);
  assert.throws(() => executeChecks([{ id: 'required' }], () => ({ id: 'required', status: 'skipped' })), /did not pass/);
  assert.throws(() => executeChecks([{ id: 'required' }], () => undefined), /did not pass/);
  assert.throws(() => executeChecks([]), /empty/);
});

test('actual stale story music blocks the gate without editing runtime metadata', t => {
  const dir = fixture(t), app = path.join(dir, 'artifacts/squabblemon');
  mkdirSync(path.join(app, 'scripts'), { recursive: true }); mkdirSync(path.join(app, 'src'));
  writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
  symlinkSync(path.join(workspaceRoot, 'lib'), path.join(dir, 'lib'), 'dir');
  const script = path.join(app, 'scripts/generate-story-music-routes.ts');
  copyFileSync(path.join(workspaceRoot, 'artifacts/squabblemon/scripts/generate-story-music-routes.ts'), script);
  const routes = path.join(app, 'src/storyMusicRoutes.json');
  copyFileSync(path.join(workspaceRoot, 'artifacts/squabblemon/src/storyMusicRoutes.json'), routes);
  const check = { id: 'story-music', kind: 'command', args: ['--import', tsx, script, '--check'] };
  assert.equal(runCheck(check, { quiet: true }).status, 'passed');
  writeFileSync(routes, '{}\n');
  const actual = spawnSync(process.execPath, check.args, { cwd: workspaceRoot, env: childEnv, encoding: 'utf8' });
  assert.notEqual(actual.status, 0); assert.match(actual.stderr, /Story music routes are stale/);
  assert.throws(() => executeChecks([check, markerGate(dir)], step => runCheck(step, { quiet: true })), /story-music failed/);
  assert.equal(existsSync(path.join(dir, 'built')), false);
});

test('actual forbidden or missing emitted CSS blocks the gate after bundling', t => {
  const dir = fixture(t), styles = path.join(dir, 'styles'); mkdirSync(styles);
  const check = { id: 'emitted-css-and-panels', kind: 'command', args: ['artifacts/squabblemon/scripts/check-style-invalidation.mjs', styles] };
  assert.throws(() => runCheck(check, { quiet: true }), /emitted-css-and-panels failed/);
  writeFileSync(path.join(styles, 'app.css'), '.prose :not(:where([class~="not-prose"],[class~="not-prose"] *)){color:red}');
  const actual = spawnSync(process.execPath, check.args, { cwd: workspaceRoot, env: childEnv, encoding: 'utf8' });
  assert.notEqual(actual.status, 0); assert.match(actual.stderr, /CSS invalidation guard failed/);
  assert.throws(() => executeChecks([check, markerGate(dir)], step => runCheck(step, { quiet: true })), /emitted-css-and-panels failed/);
  assert.equal(existsSync(path.join(dir, 'built')), false);
  writeFileSync(path.join(styles, 'app.css'), '.panel-section:not(.profile-progress-paper,.profile-badges-paper){color:black}');
  assert.equal(runCheck(check, { quiet: true }).status, 'passed');
});

test('CLI rejects filter/skip options and incomplete evidence arguments', () => {
  for (const args of [['--skip'], ['--test-name-pattern=one'], ['--evidence'], ['--inventory', '--build']]) {
    const result = spawnSync(process.execPath, ['scripts/release-checks.mjs', ...args], { cwd: workspaceRoot, env: childEnv, encoding: 'utf8' });
    assert.notEqual(result.status, 0, args.join(' '));
  }
});

test('heavy tiers identify native concurrency, migration replay and shared-wallet browser obligations', () => {
  const inventory = JSON.parse(readFileSync(path.join(workspaceRoot, 'scripts/release-check-inventory.json'), 'utf8'));
  for (const id of ['payments', 'flexible-pulls', 'monthly-login', 'ranked-clout', 'online-retirement', 'migration-replay', 'social', 'mail', 'event-feedback']) {
    const entry = inventory.nativeDatabase.find(item => item.id === id); assert.ok(entry?.when && entry.command && entry.evidence);
  }
  assert.ok(inventory.browser.find(entry => entry.id === 'shared-wallet-recovery')?.commands.length >= 3);
  assert.match(inventory.policy, /Missing prerequisites, failures and unexpected skips are blockers/);
});


test('revision, tracked changes and new untracked source changes invalidate a verification', () => {
  const before = { baseCommit: 'base', trackedDiffSha256: 'diff', criticalInputHashes: { test: 'hash' }, untrackedSourceHashes: { helper: 'hash' } };
  assert.doesNotThrow(() => assertStableReleaseIdentity(before, structuredClone(before)));
  for (const [key, value] of Object.entries({ baseCommit: 'next', trackedDiffSha256: 'changed', criticalInputHashes: { test: 'new' }, untrackedSourceHashes: { helper: 'new' } })) {
    assert.throws(() => assertStableReleaseIdentity(before, { ...before, [key]: value }), /source changed/);
  }
});

test('an invocation that cannot verify its revision replaces stale passed evidence with failure', t => {
  const root = fixture(t), evidenceFile = path.join(root, 'evidence.json');
  writeFileSync(evidenceFile, '{"status":"passed","baseCommit":"obsolete"}');
  assert.throws(() => runReleaseChecks({ root, evidenceFile }), /Git revision/);
  const record = JSON.parse(readFileSync(evidenceFile, 'utf8'));
  assert.equal(record.status, 'failed'); assert.equal(record.baseCommit, undefined);
  assert.match(record.failure, /Git revision/); assert.deepEqual(record.results, []);
});
