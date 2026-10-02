import assert from 'node:assert/strict';
import test from 'node:test';
import { BALANCE_LAB_SCHEMA_VERSION } from '@workspace/squabblemon-engine/balanceLab';
import { CARD_BALANCE_VERSION, ONLINE_RULES_VERSION } from '@workspace/squabblemon-engine/multiplayer';
import {
  CREWS,
  CREW_ROLE_LABELS,
  crewFingerprint,
  getSchedules,
} from './squabblehouse-diner-comparison';
import { getDefaults } from './squabblehouse-balance-sweep';
import {
  currentSourceFingerprints,
  expectedShardMap,
  expectedScheduleFingerprint,
  verifyComparisonReports,
} from './squabblehouse-diner-verify';

const root = new URL('../../', import.meta.url);
const enginePackage = JSON.parse(await (await import('node:fs/promises')).readFile(new URL('lib/squabblemon-engine/package.json', root), 'utf8'));
const opponentIds = ['focus-wonderland', 'focus-fire-guap', 'focus-wiz'];

function pilotFixture(crewName: 'current-baseline' | 'diner') {
  const sourceFingerprints = currentSourceFingerprints();
  const scheduleFingerprint = expectedScheduleFingerprint(sourceFingerprints);
  const crew = CREWS[crewName];
  const opponents = getDefaults();
  const blocks = opponents.map(opponent => {
    const rawResults = [];
    for (const tier of [0, 3]) for (const seat of ['a-player', 'b-player']) rawResults.push({
      telemetrySchemaVersion: BALANCE_LAB_SCHEMA_VERSION,
      districtSeed: 'squabblehouse-diner-pilot-district-01',
      rotation: 0,
      tier,
      seat,
      deckAId: crew.id,
      deckBId: opponent.id,
    });
    return {
      matchup: `${crew.id}-vs-${opponent.id}`,
      policy: 'greedy',
      schedule: {
        set: 'pilot',
        seeds: ['squabblehouse-diner-pilot-district-01'],
        rotations: [0],
        tiers: [0, 3],
        mirroredSeats: true,
        allowSquabble: true,
      },
      expectedMatches: 4,
      matrix: {
        telemetrySchemaVersion: BALANCE_LAB_SCHEMA_VERSION,
        successfulMatches: 4,
        failedMatches: 0,
        matchCount: 4,
        failures: [],
      },
      matrixParity: {
        successfulMatches: true,
        failedMatches: true,
        deckAOutcomeCounts: true,
        deckBOutcomeCounts: true,
      },
      rawResults,
      rawFailures: [],
      crewCardEventObservations: [{}, {}, {}, {}],
    };
  });
  return {
    schemaVersion: BALANCE_LAB_SCHEMA_VERSION,
    experiment: 'paired-current-rules-squabblehouse-diner-comparison',
    crew: crewName,
    crewRole: CREW_ROLE_LABELS[crewName],
    pilot: true,
    deterministicFingerprint: crewFingerprint(scheduleFingerprint, crewName, true),
    scheduleFingerprint,
    versionMetadata: {
      enginePackage,
      balanceLabSchemaVersion: BALANCE_LAB_SCHEMA_VERSION,
      cardBalanceVersion: CARD_BALANCE_VERSION,
      onlineRulesVersion: ONLINE_RULES_VERSION,
      engineSourceSha256: Object.fromEntries(Object.entries(sourceFingerprints).filter(([file]) => file.startsWith('lib/squabblemon-engine/'))),
    },
    configuration: {
      crew,
      crewRole: CREW_ROLE_LABELS[crewName],
      pairedComparisonCrews: CREWS,
      crewRoleLabels: CREW_ROLE_LABELS,
      sharedOrderKey: 'squabblehouse-balance-shell-v1',
      opponents,
      schedule: getSchedules(true),
      sourceFingerprints,
    },
    failures: [],
    blocks,
    simulationAccounting: {
      uniqueRequestedMatchups: 12,
      rawRetainedSamples: 12,
      matrixValidationReplays: 12,
      engineSimulationAttempts: 24,
    },
  };
}

function pairedPilot() {
  return [pilotFixture('current-baseline'), pilotFixture('diner')] as const;
}

test('explicit pilot-fixture mode accepts a complete small matched fixture only', () => {
  const [baseline, diner] = pairedPilot();
  const result = verifyComparisonReports(baseline, diner, 'pilot-fixture');
  assert.equal(result.verified, true);
  assert.deepEqual(result.uniqueCasesPerCrew, { 'current-baseline': 12, diner: 12 });
  assert.equal(result.totalPairedUniqueCases, 24);
  assert.throws(() => verifyComparisonReports(baseline, diner, 'full'), /full|1,008|nine|144/);
});

test('shard filenames map exact opponent, policy, and schedule combinations', () => {
  const shards = expectedShardMap();
  const expected = [
    ['focus-wonderland-greedy-primary', 'focus-wonderland', 'greedy', 'primary'],
    ['focus-wonderland-seeded-legal-primary', 'focus-wonderland', 'seeded-legal', 'primary'],
    ['focus-wonderland-greedy-holdout', 'focus-wonderland', 'greedy', 'holdout'],
    ['focus-fire-guap-greedy-primary', 'focus-fire-guap', 'greedy', 'primary'],
    ['focus-fire-guap-seeded-legal-primary', 'focus-fire-guap', 'seeded-legal', 'primary'],
    ['focus-fire-guap-greedy-holdout', 'focus-fire-guap', 'greedy', 'holdout'],
    ['focus-wiz-greedy-primary', 'focus-wiz', 'greedy', 'primary'],
    ['focus-wiz-seeded-legal-primary', 'focus-wiz', 'seeded-legal', 'primary'],
    ['focus-wiz-greedy-holdout', 'focus-wiz', 'greedy', 'holdout'],
  ] as const;
  assert.equal(shards.size, expected.length);
  for (const [filename, opponent, policy, schedule] of expected) {
    assert.deepEqual(shards.get(filename), { opponent, policy, schedule });
  }
});

test('fails closed when matrix and raw executions share a matching failed case', () => {
  const [baseline, diner] = pairedPilot();
  for (const report of [baseline, diner]) {
    const block = report.blocks[0];
    block.matrix.failedMatches = 1;
    block.matrix.successfulMatches = 3;
    (block.rawFailures as Record<string, unknown>[]).push({ districtSeed: 'squabblehouse-diner-pilot-district-01', rotation: 0, tier: 0, seat: 'a-player', message: 'injected failure' });
    block.rawResults.pop();
    block.crewCardEventObservations.pop();
    block.matrixParity.failedMatches = true;
    block.matrixParity.successfulMatches = true;
  }
  assert.throws(() => verifyComparisonReports(baseline, diner, 'pilot-fixture'), /raw simulation failures|matrix failures|successfulMatches|count is incomplete/);
});

test('rejects unmatched paired case axes and duplicate raw cases', () => {
  {
    const [baseline, diner] = pairedPilot();
    diner.blocks[0].rawResults[0].seat = 'b-player';
    assert.throws(() => verifyComparisonReports(baseline, diner, 'pilot-fixture'), /duplicate raw case|Cartesian schedule cases|Paired case keys differ/);
  }
  {
    const [baseline, diner] = pairedPilot();
    const block = baseline.blocks[0];
    block.rawResults[1] = { ...block.rawResults[0] };
    assert.throws(() => verifyComparisonReports(baseline, diner, 'pilot-fixture'), /duplicate raw case/);
  }
});