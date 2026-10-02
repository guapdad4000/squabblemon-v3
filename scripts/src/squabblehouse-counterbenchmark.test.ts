import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import test from 'node:test';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BALANCE_LAB_SCHEMA_VERSION, type BalanceDeck } from '@workspace/squabblemon-engine/balanceLab';
import { getDefaults } from './squabblehouse-balance-sweep';
import {
  assertCompleteBlock,
  assertCrewIdentity,
  assertFrozenV30EngineHashes,
  assertOpponentIdentity,
  assertRawMatrixParity,
  assertRuntimeKitPair,
  assertSharedHarnessFingerprintMatch,
  assertSourceFingerprintMatch,
  checkPhaseVersion,
  CREW,
  engineSourceHashes,
  legacyAcceptedEngineHashes,
  sourceFileListAt,
  sourceFingerprintsAt,
  sharedHarnessSourceFiles,
} from './counterbenchmarkChecks';

const opponent = getDefaults()[0];
const seeds = ['squabblehouse-counter-pilot-fixture-01'];
const rotations = [0];

function validBlock() {
  const cases = [
    { districtSeed: seeds[0], rotation: 0, tier: 0, seat: 'a-player' },
    { districtSeed: seeds[0], rotation: 0, tier: 0, seat: 'b-player' },
    { districtSeed: seeds[0], rotation: 0, tier: 3, seat: 'a-player' },
    { districtSeed: seeds[0], rotation: 0, tier: 3, seat: 'b-player' },
  ];
  return {
    matchup: `${CREW.id}-vs-${opponent.id}`,
    policy: 'greedy',
    schedule: {
      set: 'pilot',
      seeds,
      rotations,
      tiers: [0, 3],
      mirroredSeats: true,
      allowSquabble: true,
    },
    expectedMatches: 4,
    matrix: {
      telemetrySchemaVersion: BALANCE_LAB_SCHEMA_VERSION,
      matchCount: 4,
      successfulMatches: 4,
      failedMatches: 0,
      failures: [],
      decks: [
        { deckId: CREW.id, games: 4, wins: 4, losses: 0, draws: 0 },
        { deckId: opponent.id, games: 4, wins: 0, losses: 4, draws: 0 },
      ],
    },
    matrixParity: {
      successfulMatches: true,
      failedMatches: true,
      deckAOutcomeCounts: true,
      deckBOutcomeCounts: true,
    },
    rawResults: cases.map(match => ({
      ...match,
      deckAId: CREW.id,
      deckBId: opponent.id,
      logicalWinner: 'a',
      telemetrySchemaVersion: BALANCE_LAB_SCHEMA_VERSION,
    })),
    rawFailures: [],
    crewCardEventObservations: [{ events: [] }, { events: [] }, { events: [] }, { events: [] }],
  };
}

test('counterbenchmark fixture accepts an exact mirrored Cartesian block with raw/matrix tally agreement', () => {
  assert.equal(assertCompleteBlock(validBlock(), CREW, opponent, 'greedy', seeds, rotations, 'pilot').size, 4);
});

test('counterbenchmark fixtures reject parity lies, wrong raw tallies, missing/duplicate cases, and failures', () => {
  const parityLie = validBlock();
  parityLie.matrixParity.deckAOutcomeCounts = false;
  assert.throws(() => assertCompleteBlock(parityLie, CREW, opponent, 'greedy', seeds, rotations, 'pilot'), /Matrix\/raw outcome parity/);

  const mismatchedTally = validBlock();
  mismatchedTally.matrix.decks[0].wins = 3;
  assert.throws(() => assertRawMatrixParity(mismatchedTally, CREW, opponent), /actual raw results/);

  const invalidWinner = validBlock();
  invalidWinner.rawResults[0].logicalWinner = 'unknown' as 'a';
  assert.throws(() => assertCompleteBlock(invalidWinner, CREW, opponent, 'greedy', seeds, rotations, 'pilot'), /invalid logical winner/);

  const missingCase = validBlock();
  missingCase.rawResults.pop();
  assert.throws(() => assertCompleteBlock(missingCase, CREW, opponent, 'greedy', seeds, rotations, 'pilot'), /raw match count/);

  const duplicateCase = validBlock();
  duplicateCase.rawResults[3] = { ...duplicateCase.rawResults[2] };
  assert.throws(() => assertCompleteBlock(duplicateCase, CREW, opponent, 'greedy', seeds, rotations, 'pilot'), /duplicate Cartesian case/);

  const rawFailure = validBlock();
  (rawFailure.rawFailures as unknown[]).push({ error: 'simulation rejected' });
  assert.throws(() => assertCompleteBlock(rawFailure, CREW, opponent, 'greedy', seeds, rotations, 'pilot'), /raw simulation has failures/);

  const matrixFailure = validBlock();
  matrixFailure.matrix.failedMatches = 1;
  (matrixFailure.matrix.failures as unknown[]).push({ error: 'matrix simulation rejected' });
  assert.throws(() => assertCompleteBlock(matrixFailure, CREW, opponent, 'greedy', seeds, rotations, 'pilot'), /zero failures/);
});

test('counterbenchmark fixture binds phase versions, exact crew/opponents, and frozen fingerprints', () => {
  assert.doesNotThrow(() => checkPhaseVersion('before', 30, 30));
  assert.doesNotThrow(() => checkPhaseVersion('after', 31, 31));
  assert.throws(() => checkPhaseVersion('before', 31, 31), /expected card-balance version 30/);
  assert.throws(() => checkPhaseVersion('after', 30, 30), /expected card-balance version 31/);

  assert.doesNotThrow(() => assertCrewIdentity(CREW));
  assert.throws(() => assertCrewIdentity({ ...CREW, cardIds: [...CREW.cardIds].reverse() }), /roster, deck ID, name, or slot order mismatch/);

  const opponentMutation = getDefaults();
  opponentMutation[0] = { ...opponentMutation[0], cardIds: [...opponentMutation[0].cardIds].reverse() };
  assert.throws(() => assertOpponentIdentity(opponentMutation, getDefaults()), /opponent IDs, rosters, or ordering mismatch/);

  const expectedSources = Object.fromEntries(sharedHarnessSourceFiles.map(file => [file, `sha-${file}`]));
  assert.doesNotThrow(() => assertSharedHarnessFingerprintMatch(expectedSources, { ...expectedSources }, 'before'));
  assert.throws(() => assertSharedHarnessFingerprintMatch(
    { ...expectedSources, [sharedHarnessSourceFiles[1]]: 'omitted-or-mutated' },
    expectedSources,
    'before',
  ), /shared harness fingerprint changed/);
  assert.doesNotThrow(() => assertSourceFingerprintMatch({ ...expectedSources }, expectedSources, 'before'));
  assert.throws(() => assertSourceFingerprintMatch({ ...expectedSources, engine: 'new-hash' }, expectedSources, 'before'), /source fingerprints changed/);
});

test('recursive source fingerprints include nested engine helpers and all shared harness dependencies', () => {
  const sourceRoot = mkdtempSync(path.join(os.tmpdir(), 'counterbenchmark-fingerprints-'));
  const write = (relativePath: string, contents: string) => {
    const destination = path.join(sourceRoot, relativePath);
    mkdirSync(path.dirname(destination), { recursive: true });
    writeFileSync(destination, contents);
  };
  try {
    write('lib/squabblemon-engine/package.json', '{}');
    write('lib/squabblemon-engine/src/afterHoursWave.ts', 'export const wave = 1;');
    write('lib/squabblemon-engine/src/newHelpers/newRunnerHelper.ts', 'export const helper = 1;');
    for (const file of [
      'lib/squabblemon-engine/src/balanceLab.ts',
      'lib/squabblemon-engine/src/data.ts',
      'lib/squabblemon-engine/src/gameEngine.ts',
      'lib/squabblemon-engine/src/districts.ts',
      'lib/squabblemon-engine/src/squabblehouseWave.ts',
      'lib/squabblemon-engine/src/creativeReworks.ts',
      'lib/squabblemon-engine/src/rosterBalance.ts',
      'lib/squabblemon-engine/src/multiplayer.ts',
    ]) write(file, `export const file = '${file}';`);
    write('scripts/package.json', '{}');
    write('scripts/tsconfig.json', '{}');
    write('tsconfig.base.json', '{}');
    write('scripts/src/checks/nestedCheck.ts', 'export const check = 1;');
    for (const file of sharedHarnessSourceFiles) write(file, `export const harness = '${file}';`);

    const files = sourceFileListAt(sourceRoot);
    const first = sourceFingerprintsAt(sourceRoot);
    const fullEngine = engineSourceHashes(first);
    const historicalSubset = legacyAcceptedEngineHashes(first);
    assert.ok(files.includes('lib/squabblemon-engine/src/afterHoursWave.ts'));
    assert.ok(files.includes('lib/squabblemon-engine/src/newHelpers/newRunnerHelper.ts'));
    assert.ok(files.includes('scripts/src/checks/nestedCheck.ts'));
    for (const file of sharedHarnessSourceFiles) assert.ok(files.includes(file));
    assert.ok(fullEngine['lib/squabblemon-engine/src/newHelpers/newRunnerHelper.ts']);
    assert.equal(Object.hasOwn(historicalSubset, 'lib/squabblemon-engine/src/newHelpers/newRunnerHelper.ts'), false);
    assert.deepEqual(Object.keys(historicalSubset).length, 9);

    write('lib/squabblemon-engine/src/newHelpers/newRunnerHelper.ts', 'export const helper = 2;');
    const second = sourceFingerprintsAt(sourceRoot);
    assert.notEqual(
      engineSourceHashes(first)['lib/squabblemon-engine/src/newHelpers/newRunnerHelper.ts'],
      engineSourceHashes(second)['lib/squabblemon-engine/src/newHelpers/newRunnerHelper.ts'],
    );
    assert.deepEqual(legacyAcceptedEngineHashes(second), historicalSubset);
    assert.doesNotThrow(() => checkPhaseVersion('before', 30, 30));
    assert.throws(
      () => assertFrozenV30EngineHashes(engineSourceHashes(second), fullEngine),
      /Before v30 full recursive engine source tree does not match the fixed Git archive/,
    );
  } finally {
    rmSync(sourceRoot, { recursive: true, force: true });
  }
});

test('runtime kits freeze opponent stats and permit only the three selected crew ability metadata changes', () => {
  const makeKit = (id: string) => ({
    id,
    name: id,
    type: 'staff',
    cost: 4,
    power: 5,
    ability: `${id} old ability`,
    effect: `${id} old effect`,
    roles: ['support'],
    elementalBond: null,
    abilityUpgradeCount: 1,
    rarity: 'rare',
    abilityUpgrades: [{ id: 'upgrade', effect: `${id} old upgrade` }],
  });
  const before = Object.fromEntries(CREW.cardIds.map(id => [id, makeKit(id)]));
  const after = JSON.parse(JSON.stringify(before)) as Record<string, ReturnType<typeof makeKit>>;
  for (const id of ['griddle-master', 'squabblehouse-cashier', 'janitor']) {
    after[id].ability = `${id} new ability`;
    after[id].effect = `${id} new effect`;
    after[id].abilityUpgrades[0].effect = `${id} new upgrade`;
  }
  assert.doesNotThrow(() => assertRuntimeKitPair(before, after, CREW.cardIds));

  const printedStatMutation = JSON.parse(JSON.stringify(after)) as Record<string, ReturnType<typeof makeKit>>;
  printedStatMutation['squabblehouse-cashier'].cost += 1;
  assert.throws(() => assertRuntimeKitPair(before, printedStatMutation, CREW.cardIds), /printed stats, cost, or rarity/);

  const opponentMutation = JSON.parse(JSON.stringify(before)) as Record<string, ReturnType<typeof makeKit>>;
  opponentMutation['squabblehouse-cashier'].ability = 'different opponent ability';
  assert.throws(() => assertRuntimeKitPair(before, opponentMutation, CREW.cardIds, ['squabblehouse-cashier']), /changed outside selected crew ability metadata/);

  const incompleteKits = JSON.parse(JSON.stringify(before)) as Record<string, ReturnType<typeof makeKit>>;
  delete incompleteKits['squabblehouse-bus-boy'];
  assert.throws(() => assertRuntimeKitPair(incompleteKits, incompleteKits, CREW.cardIds), /missing or include unexpected/);
});

test('test source root is resolved relative to this fixture', () => {
  const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  assert.ok(readFileSync(path.join(sourceRoot, 'scripts/src/counterbenchmarkChecks.ts'), 'utf8').includes('sourceFingerprintsAt'));
});