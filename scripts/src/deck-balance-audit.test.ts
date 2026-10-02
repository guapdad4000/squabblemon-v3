import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  assertSameSchedule, auditDirectory, collectCompleteRows, createAuditPlan, dinerId,
  loadPlan, parseAuditArguments, runAuditCli, selectOriginalFailures,
  type AuditPlan, type AuditRow, type AuditShard,
} from './deck-balance-audit';
import { rateFor } from './deck-balance-audit-report';
import { CARD_BALANCE_VERSION, ONLINE_RULES_VERSION } from '@workspace/squabblemon-engine/multiplayer';

// Read fresh copies of immutable archived evidence, never regenerate it with current rules.
const archivedPlan = (): AuditPlan =>
  JSON.parse(readFileSync(path.join(auditDirectory, 'plan.json'), 'utf8')) as AuditPlan;

test('archived audit freezes complete league and counter schedules with fresh confirmation', () => {
  const plan = archivedPlan();
  assert.equal(plan.balanceVersion, 33);
  assert.equal(plan.rulesVersion, 33);
  assert.equal(plan.decks.length, 18);
  assert.equal(plan.leagueIds.length, 12);
  assert.equal(plan.cases.length, 3392);
  assert.equal(new Set(plan.cases.map(item => item.key)).size, 3392);
  assert.equal(plan.cases.filter(item => item.phase === 'league').length, 2112);
  assert.equal(plan.cases.filter(item => item.phase === 'counter-screen').length, 192);
  assert.equal(plan.cases.filter(item => item.phase === 'confirmation').length, 1088);
  assert.equal(plan.cases.filter(item => item.a === dinerId || item.b === dinerId).length, 1632);
  for (const opponent of plan.decks.filter(deck => deck.id !== dinerId)) {
    const cases = plan.cases.filter(item => (item.a === dinerId && item.b === opponent.id)
      || (item.b === dinerId && item.a === opponent.id));
    assert.equal(cases.length, 96, opponent.id);
    assert.equal(cases.filter(item => item.tier === 0).length, 48);
    assert.equal(cases.filter(item => item.policy === 'greedy').length, 48);
    assert.equal(cases.filter(item => item.phase === 'confirmation').length, 64);
    assert.equal(new Set(cases.filter(item => item.phase !== 'confirmation').map(item => item.seed)).size, 2);
    assert.equal(new Set(cases.filter(item => item.phase === 'confirmation').map(item => item.seed)).size, 4);
  }
  const primary = new Set(plan.cases.filter(item => item.phase !== 'confirmation').map(item => item.seed));
  for (const item of plan.cases.filter(item => item.phase === 'confirmation')) assert(!primary.has(item.seed));
  for (const item of plan.cases) assert(item.seed.startsWith('deck-balance-v33-onshift-'));
});

test('schedule compatibility rejects changed versions, crew definitions, and ordered axes', () => {
  const plan = archivedPlan();
  assertSameSchedule(plan, archivedPlan());
  for (const field of ['balanceVersion', 'rulesVersion', 'decks', 'leagueIds', 'counterIds', 'cases'] as const) {
    const changed = archivedPlan();
    if (field === 'balanceVersion' || field === 'rulesVersion') changed[field] = 34;
    else changed[field].reverse();
    assert.throws(() => assertSameSchedule(plan, changed), new RegExp(`${field} changed`));
  }
});

test('deck rates map both logical sides correctly and count draws as half points', () => {
  const row = (a: string, b: string, winner: 'a' | 'b' | 'draw') => ({
    scenario: { a, b }, result: { logicalWinner: winner },
  }) as AuditRow;
  const rows = [row('diner', 'opponent', 'a'), row('opponent', 'diner', 'b'), row('diner', 'opponent', 'draw'),
    row('diner', 'opponent', 'b'), row('other', 'third', 'a')];
  assert.deepEqual(rateFor(rows, 'diner'), { games: 4, wins: 2, losses: 1, draws: 1, winRate: 0.5, scoreRate: 0.625 });
  assert.equal(rateFor(rows, 'opponent').scoreRate, 0.375);
  assert.equal(rateFor(rows, 'missing').games, 0);
});

test('CLI output selection preserves default and rejects malformed options', () => {
  assert.equal(parseAuditArguments(['--init']).directory, auditDirectory);
  assert.equal(parseAuditArguments(['--out', './new-evidence', '--merge', '8']).directory, path.resolve('new-evidence'));
  assert.deepEqual(parseAuditArguments(['--worker', '0', '8', '--out', './new-evidence']).args, ['--worker', '0', '8']);
  for (const args of [['--out'], ['--out', '--init'], ['--init', '--out', 'a', '--out', 'b'], ['--skip-failures']]) {
    assert.throws(() => parseAuditArguments(args));
  }
});

test('original replay selects all eighteen failures in exact original plan order', () => {
  const plan = archivedPlan();
  const shards = Array.from({ length: 8 }, (_, index) =>
    JSON.parse(readFileSync(path.join(auditDirectory, `worker-${index}.json`), 'utf8')) as AuditShard);
  assertSameSchedule(plan, archivedPlan());
  const selected = selectOriginalFailures(plan, shards);
  const failed = new Set(shards.flatMap(shard => shard.failures.map(failure => failure.scenario.key)));
  assert.equal(selected.length, 18);
  assert.deepEqual(selected, plan.cases.filter(scenario => failed.has(scenario.key)));
  assert.throws(() => selectOriginalFailures(plan, shards.slice(1)), /Incompatible/);
  const changed = structuredClone(shards);
  changed[0].failures[0].scenario.rotation = 999;
  assert.throws(() => selectOriginalFailures(plan, changed), /Mismatched/);
  const missing = structuredClone(shards);
  missing[0].rows.pop();
  assert.throws(() => selectOriginalFailures(plan, missing), /Missing/);
  const mixed = structuredClone(shards);
  mixed[1].sourceHash = 'other';
  assert.throws(() => selectOriginalFailures(plan, mixed), /Incompatible/);
});

test('current runtime refuses incompatible historical v33 initialization and loading without overwriting evidence', () => {
  const historical = archivedPlan();
  assert.notDeepEqual(
    [CARD_BALANCE_VERSION, ONLINE_RULES_VERSION],
    [historical.balanceVersion, historical.rulesVersion],
    'This rejection test requires runtime rules incompatible with the archived v33 audit',
  );
  const requiresV33 = /requires the approved v33 diner rules/;
  assert.throws(() => createAuditPlan(), requiresV33);
  assert.throws(() => loadPlan(auditDirectory), requiresV33);
  const temp = mkdtempSync(path.join(os.tmpdir(), 'deck-audit-test-'));
  try {
    const directory = path.join(temp, 'full');
    assert.throws(() => runAuditCli(['--out', directory, '--init']), requiresV33);
    assert.throws(() => runAuditCli(['--out', directory, '--init', '--from-plan', path.join(auditDirectory, 'plan.json')]), requiresV33);
    assert.equal(existsSync(directory), false);
    assert.throws(() => runAuditCli(['--out', temp, '--init']), /already exists/);
    const plan = archivedPlan();
    plan.sourceHash = 'changed';
    writeFileSync(path.join(temp, 'plan.json'), JSON.stringify(plan));
    // Version rejection must precede source checks, even for an altered archive.
    assert.throws(() => loadPlan(temp), requiresV33);
    const replay = path.join(temp, 'failed-cases');
    assert.throws(() => runAuditCli(['--init-failures', auditDirectory, '--out', replay]), requiresV33);
    assert.equal(existsSync(replay), false);
    assert.throws(() => runAuditCli(['--out', replay, '--merge', '0']), /positive worker count/);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test('merger rejects failures, missing/repeated cases, wrong axes, and mixed sources', () => {
  const current = archivedPlan();
  const plan = { ...current, cases: current.cases.slice(0, 2) };
  const rows = plan.cases.map(scenario => ({
    scenario,
    result: {
      deckAId: scenario.a, deckBId: scenario.b, districtSeed: scenario.seed,
      seat: scenario.seat, tier: scenario.tier, rotation: scenario.rotation, logicalWinner: 'draw',
    },
  })) as AuditRow[];
  const shard: AuditShard = { index: 0, count: 1, sourceHash: plan.sourceHash, rows, failures: [] };
  assert.equal(collectCompleteRows(plan, [shard]).length, 2);
  assert.throws(() => collectCompleteRows(plan, []), /required/);
  assert.throws(() => collectCompleteRows(plan, [{ ...shard, sourceHash: 'mixed' }]), /incompatible/);
  assert.throws(() => collectCompleteRows(plan, [{ ...shard, failures: [{ scenario: plan.cases[0], message: 'failed' }] }]), /failed/);
  assert.throws(() => collectCompleteRows(plan, [{ ...shard, rows: rows.slice(1) }]), /Missing/);
  assert.throws(() => collectCompleteRows(plan, [{ ...shard, rows: [rows[0], rows[0]] }]), /Mismatched/);
  const wrong = structuredClone(shard);
  wrong.rows[0] = { ...wrong.rows[0], result: { ...wrong.rows[0].result, rotation: 999 } };
  assert.throws(() => collectCompleteRows(plan, [wrong]), /axes mismatch/);
  for (const winner of [undefined, null, 'player', 'cpu', 'invalid']) {
    const invalid = structuredClone(shard);
    Object.assign(invalid.rows[0].result, { logicalWinner: winner });
    assert.throws(() => collectCompleteRows(plan, [invalid]), /logical winner/);
  }
  for (const winner of ['a', 'b', 'draw'] as const) {
    const valid = structuredClone(shard);
    valid.rows[0] = { ...valid.rows[0], result: { ...valid.rows[0].result, logicalWinner: winner } };
    assert.equal(collectCompleteRows(plan, [valid]).length, 2);
  }
});