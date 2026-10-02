import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  CREW_CARD_IDS,
  CREW_DECK,
  HOLDOUT_SEEDS,
  OPPONENT_IDS,
  POLICIES,
  PRIMARY_SEEDS,
  REVISION_ARMS,
  assertArmKitIsolation,
  assertExactCrewAndRuntimeKits,
  assertOnlyAllowedEngineFilesDiffer,
  assertSourceMatchesOutsideApprovedRegions,
  assertResolvedImportsWithinSnapshot,
  assertShardIdentity,
  caseKey,
  expectedCaseKeys,
  expectedCasesPerArm,
  expectedMatches,
  expectedShardNames,
  findSourceRegion,
  sharedMovementGateFingerprintsAt,
  stableEqual,
  validateBlock,
  type JsonRecord,
} from './squabblehouse-counter-revisionChecks';

function pilotBlock(
  changes: {
    rawResults?: JsonRecord[];
    matrix?: JsonRecord;
    opponent?: string;
  } = {},
): JsonRecord {
  const opponent = changes.opponent ?? OPPONENT_IDS[0];
  const expected = expectedCaseKeys('pilot').map((key, index) => {
    const [districtSeed, rotation, tier, seat] = key.split('\u0000');
    return {
      deckAId: CREW_DECK.id,
      deckBId: opponent,
      districtSeed,
      rotation: Number(rotation),
      tier: Number(tier),
      seat,
      logicalWinner: (['a', 'b', 'draw', 'a'] as const)[index],
    };
  });
  const results: JsonRecord[] = changes.rawResults ?? expected;
  const counts = results.reduce((value: { games: number; wins: number; losses: number; draws: number }, result) => {
    value.games++;
    if (result.logicalWinner === 'draw') value.draws++;
    else if (result.logicalWinner === 'a') value.wins++;
    else value.losses++;
    return value;
  }, { games: 0, wins: 0, losses: 0, draws: 0 });
  const opponentCounts = {
    games: counts.games,
    wins: results.filter(result => result.logicalWinner === 'b').length,
    losses: results.filter(result => result.logicalWinner === 'a').length,
    draws: counts.draws,
  };
  return {
    matchup: `${CREW_DECK.id}-vs-${opponent}`,
    policy: 'greedy',
    schedule: {
      set: 'pilot',
      seeds: ['squabblehouse-counter-revision-pilot-district-01'],
      rotations: [0],
      tiers: [0, 3],
      mirroredSeats: true,
      allowSquabble: true,
    },
    expectedMatches: 4,
    rawResults: results,
    rawFailures: [],
    crewCardEventObservations: [{}, {}, {}, {}],
    matrixParity: {
      successfulMatches: true,
      failedMatches: true,
      deckAOutcomeCounts: true,
      deckBOutcomeCounts: true,
    },
    matrix: changes.matrix ?? {
      telemetrySchemaVersion: 2,
      matchCount: 4,
      successfulMatches: 4,
      failedMatches: 0,
      failures: [],
      decks: [
        { deckId: CREW_DECK.id, ...counts },
        { deckId: opponent, ...opponentCounts },
      ],
    },
  };
}

function kit(cardId: string, ability: string, effect: string) {
  return {
    id: cardId,
    name: cardId,
    kind: 'character',
    type: 'Fire',
    cost: 3,
    power: 3,
    rarity: 'Rare',
    ability,
    effect,
    roles: ['Pressure'],
    elementalBond: null,
    abilityUpgradeCount: 3,
    abilityUpgrades: [{ id: `${cardId}:upgrade:1` }, { id: `${cardId}:upgrade:2` }, { id: `${cardId}:upgrade:3` }],
  };
}

function verificationReports() {
  const versions = Object.fromEntries(REVISION_ARMS.map(arm => [arm, {
    arm,
    configuration: {
      crew: CREW_DECK,
      opponents: OPPONENT_IDS.map(id => ({ id, cardIds: [`${id}-card-1`, `${id}-card-2`] })),
    },
    runtimeCardKits: Object.fromEntries([
      ...CREW_CARD_IDS.map(cardId => [cardId, kit(cardId, cardId, `${cardId} text`)]),
      ...OPPONENT_IDS.flatMap(id => [`${id}-card-1`, `${id}-card-2`]
        .map(cardId => [cardId, kit(cardId, cardId, `${cardId} text`)])),
    ]),
  }]));
  for (const report of Object.values(versions)) {
    report.runtimeCardKits['squabblehouse-cashier'] = kit('squabblehouse-cashier', 'Open Tab', 'Current cashier text');
    report.runtimeCardKits['griddle-master'] = kit('griddle-master', 'Cracked Plate', 'Current griddle text');
    report.runtimeCardKits.janitor = kit('janitor', 'Turn It Around', 'Current janitor text');
  }
  versions['cashier-only'].runtimeCardKits['squabblehouse-cashier'].effect = 'Revision cashier text';
  versions['griddle-only'].runtimeCardKits['griddle-master'].effect = 'Revision griddle text';
  versions['janitor-only'].runtimeCardKits.janitor.effect = 'Revision janitor text';
  versions['combined-v32'].runtimeCardKits['squabblehouse-cashier'].effect = 'Revision cashier text';
  versions['combined-v32'].runtimeCardKits['griddle-master'].effect = 'Revision griddle text';
  versions['combined-v32'].runtimeCardKits.janitor.effect = 'Revision janitor text';
  versions['corrected-original'].runtimeCardKits['squabblehouse-cashier'].effect = 'Original cashier text';
  versions['corrected-original'].runtimeCardKits['griddle-master'].effect = 'Original griddle text';
  versions['corrected-original'].runtimeCardKits.janitor.effect = 'Original janitor text';
  return Object.values(versions);
}

test('revision case schedule freezes the existing primary matrix and new confirmation seeds', () => {
  assert.equal(PRIMARY_SEEDS.length, 12);
  assert.deepEqual(HOLDOUT_SEEDS, Array.from(
    { length: 6 },
    (_, index) => `squabblehouse-counter-revision-confirmation-district-${String(index + 1).padStart(2, '0')}`,
  ));
  assert.deepEqual(POLICIES, ['greedy', 'seeded-legal']);
  assert.equal(expectedMatches('primary'), 144);
  assert.equal(expectedMatches('holdout'), 48);
  assert.equal(expectedCasesPerArm(), 1008);
  assert.deepEqual(expectedShardNames(), [
    ...OPPONENT_IDS.flatMap(opponent => POLICIES.map(policy => `${opponent}:${policy}:primary`)),
    ...OPPONENT_IDS.map(opponent => `${opponent}:greedy:holdout`),
  ]);
});

test('case-key validation accepts complete pilot coverage and rejects missing/duplicate cases', () => {
  const valid = pilotBlock();
  assert.equal(validateBlock(valid, OPPONENT_IDS[0], 'greedy', 'pilot').size, 4);

  const missing = { ...valid, rawResults: valid.rawResults.slice(0, 3) };
  assert.throws(() => validateBlock(missing, OPPONENT_IDS[0], 'greedy', 'pilot'), /exactly 4 raw cases/);

  const duplicateResults = [...valid.rawResults, valid.rawResults[0]];
  const duplicate = { ...valid, expectedMatches: 5, rawResults: duplicateResults };
  assert.throws(() => validateBlock(duplicate, OPPONENT_IDS[0], 'greedy', 'pilot'), /must contain exactly 4 raw cases/);

  const duplicateWithinCount = {
    ...valid,
    rawResults: [valid.rawResults[0], valid.rawResults[0], valid.rawResults[2], valid.rawResults[3]],
  };
  assert.throws(() => validateBlock(duplicateWithinCount, OPPONENT_IDS[0], 'greedy', 'pilot'), /duplicate Cartesian key/);
});

test('case validation rejects changed opponent, altered axes, and matrix/stat parity', () => {
  const valid = pilotBlock();
  const changedOpponent = pilotBlock({ opponent: OPPONENT_IDS[1] });
  assert.throws(() => validateBlock(changedOpponent, OPPONENT_IDS[0], 'greedy', 'pilot'), /identity mismatch/);

  const alteredAxes = {
    ...valid,
    schedule: { ...valid.schedule, rotations: [1] },
  };
  assert.throws(() => validateBlock(alteredAxes, OPPONENT_IDS[0], 'greedy', 'pilot'), /axes or settings mismatch/);

  const alteredStats = {
    ...valid,
    matrix: {
      ...valid.matrix,
      decks: [{ ...valid.matrix.decks[0], wins: valid.matrix.decks[0].wins + 1 }, valid.matrix.decks[1]],
    },
  };
  assert.throws(() => validateBlock(alteredStats, OPPONENT_IDS[0], 'greedy', 'pilot'), /Raw\/matrix parity failed/);
});

test('engine source whitelist rejects unexpected file edits and preserves baseline file set', () => {
  const baseline = {
    'lib/squabblemon-engine/src/gameEngine.ts': 'baseline-game',
    'lib/squabblemon-engine/src/data.ts': 'baseline-data',
  };
  const allowed = { ...baseline, 'lib/squabblemon-engine/src/gameEngine.ts': 'revision-game' };
  assert.doesNotThrow(() => assertOnlyAllowedEngineFilesDiffer(
    baseline,
    allowed,
    ['lib/squabblemon-engine/src/gameEngine.ts'],
  ));
  assert.throws(() => assertOnlyAllowedEngineFilesDiffer(
    baseline,
    { ...allowed, 'lib/squabblemon-engine/src/data.ts': 'unexpected-data-change' },
    ['lib/squabblemon-engine/src/gameEngine.ts'],
  ), /outside whitelist/);
  assert.throws(() => assertOnlyAllowedEngineFilesDiffer(
    baseline,
    { ...allowed, 'lib/squabblemon-engine/src/new-engine-file.ts': 'unexpected-file' },
    ['lib/squabblemon-engine/src/gameEngine.ts'],
  ), /file set changed/);
});

test('counter source regions reject adjacent hostileEffect and returnToHand edits', () => {
  const baseline = [
    'function hostileEffect() {',
    '  const attempted = apply(target);',
    '  const attemptedTarget = findCard(attempted, target.instanceId);',
    '  const harmful = !attemptedTarget;',
    '  if (harmful) reverseWithJanitor(m, target, source.owner);',
    '  const appealed = creativeAppeal(m, attempted);',
    '  return appealed;',
    '}',
    'function returnToHand() {',
    '  if (squabblehouseMovementLocked(m, target)) return m;',
    '  const departure = openTabDeparture(m, target);',
    '  if (departure.stopped) return m;',
    '  if (source.owner !== target.owner && isSquabblehouseStaffCharacter(target)) {',
    '    const reversed = reverseWithJanitor(m, target, source.owner);',
    '    if (reversed) return reversed;',
    '  }',
    '  const before = m;',
    '  return before;',
    '}',
  ].join('\n');
  const regionsFor = (source: string) => [
    findSourceRegion(source, 'janitor-hostile-classification',
      '  const attemptedTarget =', '  const appealed ='),
    findSourceRegion(source, 'janitor-return-interception',
      '  if (source.owner !== target.owner && isSquabblehouseStaffCharacter(target)) {',
      '  const before = m;'),
  ];
  const candidate = baseline
    .replace('const harmful = !attemptedTarget;', 'const harmful = !attemptedTarget && !execution;')
    .replace('reverseWithJanitor(m, target, source.owner);', 'reverseWithJanitor(m, target, source.owner, charge);');
  assert.doesNotThrow(() => assertSourceMatchesOutsideApprovedRegions(
    'fixture-gameEngine.ts', baseline, candidate, regionsFor(baseline), regionsFor(candidate),
  ));

  const hostileAdjacentEdit = baseline.replace(
    'const attempted = apply(target);',
    'const attempted = apply(target, changedSharedPipeline);',
  );
  assert.throws(() => assertSourceMatchesOutsideApprovedRegions(
    'fixture-gameEngine.ts', baseline, hostileAdjacentEdit,
    regionsFor(baseline), regionsFor(hostileAdjacentEdit),
  ), /outside exact approved counter regions/);

  const returnGateEdit = baseline.replace(
    'if (departure.stopped) return m;',
    'if (departure.stopped) return recordMovement(m);',
  );
  assert.throws(() => assertSourceMatchesOutsideApprovedRegions(
    'fixture-gameEngine.ts', baseline, returnGateEdit,
    regionsFor(baseline), regionsFor(returnGateEdit),
  ), /outside exact approved counter regions/);

  const returnBodyEdit = baseline.replace('return before;', 'return settleCapacity(before);');
  assert.throws(() => assertSourceMatchesOutsideApprovedRegions(
    'fixture-gameEngine.ts', baseline, returnBodyEdit,
    regionsFor(baseline), regionsFor(returnBodyEdit),
  ), /outside exact approved counter regions/);
});

test('worker import resolution must stay inside the arm snapshot', () => {
  const snapshot = '/isolated/arm';
  assert.doesNotThrow(() => assertResolvedImportsWithinSnapshot(snapshot, {
    data: `${snapshot}/lib/squabblemon-engine/src/data.ts`,
    balanceLab: `${snapshot}/lib/squabblemon-engine/src/balanceLab.ts`,
    multiplayer: `${snapshot}/lib/squabblemon-engine/src/multiplayer.ts`,
  }));
  assert.throws(() => assertResolvedImportsWithinSnapshot(snapshot, {
    data: '/home/runner/workspace/lib/squabblemon-engine/src/data.ts',
    balanceLab: `${snapshot}/lib/squabblemon-engine/src/balanceLab.ts`,
    multiplayer: `${snapshot}/lib/squabblemon-engine/src/multiplayer.ts`,
  }), /import contamination/);
});

test('shared movement gate fingerprints detect capacity or return-route drift', () => {
  const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const original = readFileSync(path.join(sourceRoot, 'lib/squabblemon-engine/src/gameEngine.ts'), 'utf8');
  const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), 'revision-movement-gates-'));
  const enginePath = path.join(temporaryRoot, 'lib/squabblemon-engine/src/gameEngine.ts');
  mkdirSync(path.dirname(enginePath), { recursive: true });
  try {
    writeFileSync(enginePath, original);
    const expected = sharedMovementGateFingerprintsAt(temporaryRoot);
    assert.ok(expected.movementCapacity);
    assert.ok(expected.openTabDepartureGate);
    assert.ok(expected.handReturnSharedGates);

    writeFileSync(enginePath, original.replace(
      'filter(candidate => !vacating.has(candidate.instanceId)).length < 4;',
      'filter(candidate => !vacating.has(candidate.instanceId)).length <= 4;',
    ));
    const changedCapacity = sharedMovementGateFingerprintsAt(temporaryRoot);
    assert.notEqual(changedCapacity.movementCapacity, expected.movementCapacity);

    writeFileSync(enginePath, original.replace(
      'const departure = openTabDeparture(m, target);',
      'const departure = { match: m, stopped: false };',
    ));
    assert.throws(() => sharedMovementGateFingerprintsAt(temporaryRoot), /return gate is missing/);
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test('shard identity rejects cross-fingerprint merges', () => {
  const shard = {
    arm: 'cashier-only',
    shard: 'focus-wonderland:greedy:primary',
    variantSourceFingerprint: 'source-hash-a',
  };
  assert.doesNotThrow(() => assertShardIdentity(shard, {
    arm: 'cashier-only',
    shard: 'focus-wonderland:greedy:primary',
    variantSourceFingerprint: 'source-hash-a',
  }));
  assert.throws(() => assertShardIdentity(shard, {
    arm: 'cashier-only',
    shard: 'focus-wonderland:greedy:primary',
    variantSourceFingerprint: 'source-hash-b',
  }), /Cross-hash/);
});

test('all arms preserve the exact crew, opponent kits, rarity, costs, Hands, and upgrades', () => {
  const reports = verificationReports();
  assert.doesNotThrow(() => assertExactCrewAndRuntimeKits(reports));
  assert.doesNotThrow(() => assertArmKitIsolation(reports));
  assert.equal(stableEqual(CREW_CARD_IDS, CREW_DECK.cardIds), true);

  const changedEconomy = verificationReports();
  changedEconomy.find(report => report.arm === 'cashier-only')!.runtimeCardKits['squabblehouse-cashier'].cost++;
  assert.throws(() => assertExactCrewAndRuntimeKits(changedEconomy), /changed cost/);

  const changedUpgrade = verificationReports();
  changedUpgrade.find(report => report.arm === 'janitor-only')!.runtimeCardKits.janitor.abilityUpgrades[0].effect = {
    kind: 'self-power', amount: 999, trigger: 'base-success',
  };
  assert.throws(() => assertExactCrewAndRuntimeKits(changedUpgrade), /changed upgrade mechanics/);

  const changedOpponent = verificationReports();
  changedOpponent.find(report => report.arm === 'combined-v32')!.configuration.opponents[0].cardIds[0] = 'different-opponent-card';
  assert.throws(() => assertExactCrewAndRuntimeKits(changedOpponent), /changed opponent IDs or deck lists/);

  const nonselectedChanged = verificationReports();
  nonselectedChanged.find(report => report.arm === 'cashier-only')!.runtimeCardKits['griddle-master'].effect = 'Changed unrelated card';
  assert.throws(() => assertArmKitIsolation(nonselectedChanged), /nonselected effect/);
});
