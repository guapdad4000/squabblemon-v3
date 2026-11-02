import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { closeSync, mkdtempSync, openSync, readFileSync, rmSync } from 'node:fs';
import { appendFile, cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { collectPreflight, parseArguments } from './kumite-pvp-preflight.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(root, 'scripts/kumite-pvp-preflight.mjs');
const engineDirectory = 'lib/squabblemon-engine/src';
function run(args, cwd = root) {
  // File-backed capture also works on local sandboxes that cannot poll child pipes.
  const directory = mkdtempSync(path.join(os.tmpdir(), 'kumite-preflight-cli-'));
  const stdoutFile = path.join(directory, 'stdout');
  const stderrFile = path.join(directory, 'stderr');
  const stdoutFd = openSync(stdoutFile, 'w');
  const stderrFd = openSync(stderrFile, 'w');
  const childEnv = { ...process.env };
  delete childEnv.NODE_TEST_CONTEXT;
  try {
    const result = spawnSync(process.execPath, [cli, ...args], {
      cwd, env: childEnv, timeout: 30_000, stdio: ['ignore', stdoutFd, stderrFd],
    });
    assert.ifError(result.error);
    return { ...result, stdout: readFileSync(stdoutFile, 'utf8'), stderr: readFileSync(stderrFile, 'utf8') };
  } finally {
    closeSync(stdoutFd);
    closeSync(stderrFd);
    rmSync(directory, { recursive: true, force: true });
  }
}

test('argument errors cannot become approval or supplied-evidence overrides', () => {
  for (const args of [
    ['--approve'], ['--evidence', 'proof.json'], ['--ready'], ['--json=true'],
    ['--output'], ['--output', '--json'], ['--require-ready', '--require-ready'],
    ['--json', 'unexpected'],
  ]) assert.throws(() => parseArguments(args), /argument|requires/i);
  assert.deepEqual(parseArguments(['--json', '--output', 'report.json', '--require-ready']), {
    json: true, output: 'report.json', requireReady: true, help: false,
  });
  const unknown = run(['--approve']);
  assert.equal(unknown.status, 2);
  assert.equal(unknown.stdout, '');
  assert.match(unknown.stderr, /Unknown argument: --approve/);
});

test('JSON and saved artifact agree; required readiness fails closed for unexecuted hosted proof', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'kumite-preflight-output-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const output = path.join(directory, 'created-parent', 'report.json');
  // Invoke outside the repository to prove resolution follows the script, not cwd.
  const result = run(['--json', '--output', output, '--require-ready'], directory);
  assert.equal(result.status, 1, result.stderr);
  assert.equal(result.stderr, '');
  assert.equal(await readFile(output, 'utf8'), result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.assessment, 'source inspected');
  assert.equal(report.sourceRoot, root);
  assert.equal(report.overall.ready, false);
  assert.equal(report.overall.status, 'blocked');
  assert.equal(report.cardGate.engineReadiness.supportedCards + report.cardGate.unsupportedCards.length,
    report.cardGate.engineReadiness.totalCards);
  for (const id of ['hosted-transport', 'durable-store-and-lease', 'human-matchmaking-and-lifecycle',
    'authoritative-result-receipts', 'authenticated-two-client', 'physical-device', 'staging-deployment']) {
    assert.equal(report.pvpRequirements.find((entry) => entry.id === id)?.status, 'unverified');
    assert.ok(report.overall.blockerIds.includes(id));
  }
  assert.equal(report.fingerprints.releaseManifestMatchesSource, true);
  assert.match(report.fingerprints.catalogSignatureSha256, /^[a-f0-9]{64}$/);
  assert.match(report.fingerprints.behaviorSourceSha256, /^[a-f0-9]{64}$/);
  assert.match(report.fingerprints.loadedSourceSha256, /^[a-f0-9]{64}$/);
  assert.ok(Object.hasOwn(report.cardGate, 'fullCatalogEvidence'));
});

test('default audit is successful but explicitly blocked; help and write failures have distinct outcomes', async (t) => {
  const audit = run([]);
  assert.equal(audit.status, 0, audit.stderr);
  assert.match(audit.stdout, /^Kumite Breakthrough PvP: BLOCKED/);
  assert.match(audit.stdout, /Full-catalog evidence:/);
  assert.match(audit.stdout, /Hosted PvP requirements \(unverified/);
  const help = run(['--help']);
  assert.equal(help.status, 0);
  assert.match(help.stdout, /Usage:/);
  assert.doesNotMatch(help.stdout, /^Kumite Breakthrough PvP:/m);
  const directory = await mkdtemp(path.join(os.tmpdir(), 'kumite-preflight-write-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const failure = run(['--json', '--output', directory]);
  assert.equal(failure.status, 2);
  assert.equal(failure.stdout, '');
  assert.match(failure.stderr, /preflight failed:.*EISDIR/);
});

test('live canonical additions and behavior edits invalidate reports without cached counts or stale-source approval', async (t) => {
  const fixture = await mkdtemp(path.join(os.tmpdir(), 'kumite-preflight-freshness-'));
  t.after(() => rm(fixture, { recursive: true, force: true }));
  await cp(path.join(root, engineDirectory), path.join(fixture, engineDirectory), { recursive: true });
  const before = await collectPreflight(fixture);
  const canonicalFile = path.join(fixture, engineDirectory, 'data.ts');
  // Synthetic canonical fixture: no adapter is supplied, so admission must fail closed.
  await appendFile(canonicalFile, `\ncardCatalog.push({ ...cardCatalog[0],
    id: 'preflight-new-canonical', catalogId: 'preflight-new-canonical',
    name: 'New canonical fixture fighter' });\n`);
  const added = await collectPreflight(fixture);
  assert.equal(added.cardGate.engineReadiness.totalCards, before.cardGate.engineReadiness.totalCards + 1);
  assert.equal(added.cardGate.engineReadiness.supportedCards, before.cardGate.engineReadiness.supportedCards);
  assert.deepEqual(added.cardGate.unsupportedCards.find((card) => card.cardId === 'preflight-new-canonical'), {
    cardId: 'preflight-new-canonical', name: 'New canonical fixture fighter', kind: 'character',
    reason: 'This fighter has no reviewed Breakthrough ability conversion.',
  });
  assert.notEqual(added.fingerprints.catalogSignatureSha256, before.fingerprints.catalogSignatureSha256);
  assert.notEqual(added.fingerprints.loadedSourceSha256, before.fingerprints.loadedSourceSha256);
  assert.equal(added.cardGate.ready, false);
  assert.equal(added.overall.ready, false);

  // Even an otherwise inert edit matters to the exact release source manifest.
  const behaviorFile = path.join(fixture, engineDirectory, 'breakthroughRoom.ts');
  await appendFile(behaviorFile, '\n// changed after the recorded release manifest\n');
  const stale = await collectPreflight(fixture);
  assert.equal(stale.fingerprints.releaseManifestMatchesSource, false);
  const changedModule = stale.fingerprints.behaviorModules.find((entry) => entry.file === 'breakthroughRoom.ts');
  assert.equal(changedModule.matchesDeclared, false);
  assert.equal(changedModule.sha256, createHash('sha256').update(await readFile(behaviorFile)).digest('hex'));
  assert.notEqual(stale.fingerprints.behaviorSourceSha256, added.fingerprints.behaviorSourceSha256);
  assert.equal(stale.cardGate.ready, false);
  assert.equal(stale.overall.ready, false);
  assert.ok(stale.overall.blockerIds.includes('card-release-gate'));
});
