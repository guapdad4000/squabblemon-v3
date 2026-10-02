import assert from 'node:assert/strict';
import test from 'node:test';
import { BALANCE_LAB_SCHEMA_VERSION } from '@workspace/squabblemon-engine/balanceLab';
import { cards, decks } from '@workspace/squabblemon-engine/data';
import { getDefaults } from './squabblehouse-balance-sweep';
import {
  assertCompleteBlock,
  assertPairedSchedulesMatch,
  assertShardPayload,
  CREWS,
  CREW_ROLE_LABELS,
  CURRENT_BASELINE_IDS,
  DINER_CREW_IDS,
  crewFingerprint,
  getSchedules,
  outputRoot,
  parseShard,
  sourceFingerprints,
  validateDinerRoster,
} from './squabblehouse-diner-comparison';

test('diner crew is an independently authored legal ten-card staff roster', () => {
  assert.deepEqual(DINER_CREW_IDS, [
    'squabble-house-manager', 'squabblehouse-bus-boy', 'squabblehouse-cashier',
    'squabblehouse-security', 'squabblehouse-teknician', 'griddle-master',
    'inmate-reformed', 'janitor', 'waffle-warlord', 'sideofhands',
  ]);
  validateDinerRoster(DINER_CREW_IDS);
  assert.equal(new Set(DINER_CREW_IDS).size, 10);
  assert.ok(!(DINER_CREW_IDS as readonly string[]).some(id => id === 'cane-corso-red' || id === 'blue-nose-pit'));
  assert.equal(DINER_CREW_IDS.at(-1), 'sideofhands');
  assert.equal(cards.sideofhands.kind, 'support');
  assert.ok(cards.sideofhands.roles?.includes('Support'));
  const savedRecipe = decks.find(deck => deck.id === 'squabblehouse-shift');
  assert.ok(savedRecipe);
  assert.deepEqual(savedRecipe.cards, DINER_CREW_IDS, 'authored current recipe is bound to exact frozen comparison order');
  assert.throws(() => validateDinerRoster([...DINER_CREW_IDS.slice(0, 9), 'plug']), /exact authored SQUABBLEHOUSE SHIFT/);
  assert.throws(() => validateDinerRoster([...DINER_CREW_IDS.slice(0, 9), 'cane-corso-red']), /dog\/gang/);
  assert.throws(() => validateDinerRoster(DINER_CREW_IDS.slice(0, 9)), /exactly ten/);
});

test('current baseline is independently frozen and never mutates historical staff shell', () => {
  assert.deepEqual(CURRENT_BASELINE_IDS, [
    'squabble-house-manager', 'plug', 'waterboy', 'squabblehouse-security',
    'squabblehouse-teknician', 'griddle-master', 'inmate-reformed', 'janitor',
    'laundry', 'nail',
  ]);
  assert.deepEqual(CREWS['current-baseline'].cardIds, CURRENT_BASELINE_IDS);
  assert.notDeepEqual(CURRENT_BASELINE_IDS, DINER_CREW_IDS);
  assert.equal(CREWS['current-baseline'].id, 'squabblehouse-staff-shell');
  assert.equal(CREWS.diner.id, CREWS['current-baseline'].id, 'same engine deck ID minimizes label-derived instance-ID differences');
  assert.notDeepEqual(CREWS.diner.cardIds, CREWS['current-baseline'].cardIds);
  assert.notEqual(CREW_ROLE_LABELS.diner, CREW_ROLE_LABELS['current-baseline']);
  assert.notEqual(crewFingerprint('same-schedule', 'diner', false), crewFingerprint('same-schedule', 'current-baseline', false));
  assert.equal(CREWS['current-baseline'].orderKey, CREWS.diner.orderKey);
  assert.equal(CREWS['current-baseline'].orderKey, 'squabblehouse-balance-shell-v1');
});

test('primary and fresh confirmation schedules preserve matched axes and intended counts', () => {
  const full = getSchedules();
  assert.equal(full.primarySeeds.length, 12);
  assert.deepEqual(full.primaryRotations, [0, 2, 5]);
  assert.deepEqual(full.tiers, [0, 3]);
  assert.deepEqual(full.policies, ['greedy', 'seeded-legal']);
  assert.equal(full.holdoutSeeds.length, 6);
  assert.deepEqual(full.holdoutRotations, [1, 6]);
  assert.ok(full.holdoutSeeds.every(seed => /^squabblehouse-diner-confirmation-district-0[1-6]$/.test(seed)));
  assert.ok(!full.holdoutSeeds.some(seed => seed.startsWith('squabblehouse-staff-validation-district-')));
  assert.equal(12 * 3 * 2 * 2 * 3 * 2, 864, 'primary cases per crew');
  assert.equal(6 * 2 * 2 * 2 * 3, 144, 'holdout cases per crew');
  assert.equal(864 + 144, 1008);
  assert.equal(1008 * 2, 2016, 'paired crew cases; matrix replay is not included');

  const pilot = getSchedules(true);
  assert.equal(pilot.primarySeeds.length, 1);
  assert.equal(pilot.primaryRotations.length, 1);
  assert.deepEqual(pilot.policies, ['greedy']);
  assert.deepEqual(pilot.holdoutSeeds, []);
});

test('shard CLI validates axes and confines each crew to its own result directory', () => {
  assert.deepEqual(parseShard('focus-wonderland:greedy:primary'), {
    opponent: 'focus-wonderland', policy: 'greedy', schedule: 'primary',
  });
  assert.deepEqual(parseShard('focus-wiz:greedy:holdout'), {
    opponent: 'focus-wiz', policy: 'greedy', schedule: 'holdout',
  });
  assert.throws(() => parseShard('focus-wiz:seeded-legal:holdout'), /greedy-only/);
  assert.throws(() => parseShard('unknown:greedy:primary'), /--shard must be/);
  assert.notEqual(`${outputRoot}/current-baseline`, `${outputRoot}/diner`);
});

test('resume/merge rejects changed source versions, crew identity, and nonpaired schedules', () => {
  const scheduleFingerprint = 'frozen-schedule-hash';
  const valid = {
    crew: 'diner',
    shard: 'focus-wonderland:greedy:primary',
    scheduleFingerprint,
    deterministicFingerprint: crewFingerprint(scheduleFingerprint, 'diner', false),
    report: {
      deterministicFingerprint: crewFingerprint(scheduleFingerprint, 'diner', false),
      crew: 'diner',
      crewRole: 'authored-current-shift-nine-staff-plus-support',
      configuration: {
        crew: CREWS.diner,
        sourceFingerprints: sourceFingerprints(),
        pairedComparisonCrews: CREWS,
        crewRoleLabels: CREW_ROLE_LABELS,
      },
      blocks: [{
        schedule: {
          set: 'primary', seeds: Array.from({ length: 12 }, (_, index) => `squabblehouse-primary-district-${String(index + 1).padStart(2, '0')}`),
          rotations: [0, 2, 5], tiers: [0, 3], mirroredSeats: true, allowSquabble: true,
        },
        matchup: `${CREWS.diner.id}-vs-focus-wonderland`,
        policy: 'greedy',
        expectedMatches: 144,
        matrix: { matchCount: 144, successfulMatches: 144, failedMatches: 0, failures: [] },
        matrixParity: { successfulMatches: true, failedMatches: true, deckAOutcomeCounts: true, deckBOutcomeCounts: true },
        rawResults: Array.from({ length: 144 }, (_, index) => {
          const seed = `squabblehouse-primary-district-${String(Math.floor(index / 12) + 1).padStart(2, '0')}`;
          const rotation = [0, 2, 5][Math.floor((index % 12) / 4)];
          const tier = [0, 3][Math.floor((index % 4) / 2)];
          const seat = index % 2 === 0 ? 'a-player' : 'b-player';
          return { districtSeed: seed, rotation, tier, seat, deckAId: CREWS.diner.id, deckBId: 'focus-wonderland', telemetrySchemaVersion: BALANCE_LAB_SCHEMA_VERSION };
        }),
        rawFailures: [],
        observations: Array.from({ length: 144 }, () => ({})),
      }],
      failures: [],
      simulationAccounting: { uniqueRequestedMatchups: 144, rawRetainedSamples: 144, matrixValidationReplays: 144, engineSimulationAttempts: 288 },
    },
  };
  assert.doesNotThrow(() => assertShardPayload(valid, 'diner', valid.shard, scheduleFingerprint));
  assert.throws(() => assertShardPayload(valid, 'diner', valid.shard, 'new-engine-hash'), /stale or mixed-version/);
  assert.throws(() => assertShardPayload(valid, 'current-baseline', valid.shard, scheduleFingerprint), /identity/);
  assert.throws(() => assertPairedSchedulesMatch(
    { schedule: { seeds: ['a'] }, policy: 'greedy', expectedMatches: 2 },
    { schedule: { seeds: ['b'] }, policy: 'greedy', expectedMatches: 2 },
  ), /Paired schedule mismatch/);
});

test('runner refuses paired blocks with matched matrix/raw failures despite true parity flags', () => {
  const seeds = ['squabblehouse-diner-pilot-district-01'];
  const rotations = [0];
  const pilotTiers = [0, 3] as const;
  const rawResults = [0, 1, 2, 3].map(index => ({
    districtSeed: seeds[0],
    rotation: 0,
    tier: index < 2 ? pilotTiers[0] : pilotTiers[1],
    seat: index % 2 === 0 ? 'a-player' as const : 'b-player' as const,
    deckAId: CREWS.diner.id,
    deckBId: 'focus-wonderland',
    telemetrySchemaVersion: BALANCE_LAB_SCHEMA_VERSION,
  }));
  const validBlock = {
    matchup: `${CREWS.diner.id}-vs-focus-wonderland`,
    policy: 'greedy',
    expectedMatches: 4,
    schedule: { set: 'pilot', seeds, rotations, tiers: [0, 3], mirroredSeats: true, allowSquabble: true },
    matrix: { matchCount: 4, successfulMatches: 4, failedMatches: 0, failures: [] },
    matrixParity: { successfulMatches: true, failedMatches: true, deckAOutcomeCounts: true, deckBOutcomeCounts: true },
    rawResults,
    rawFailures: [],
    observations: [{}, {}, {}, {}],
  };
  assert.equal(assertCompleteBlock(validBlock, CREWS.diner, getDefaults()[0], 'greedy', seeds, rotations, 'pilot').size, 4);

  const failedBlock = {
    ...validBlock,
    matrix: { matchCount: 4, successfulMatches: 3, failedMatches: 1, failures: [{ seed: seeds[0], rotation: 0, tier: 0, seat: 'a-player' }] },
    rawResults: rawResults.slice(1),
    rawFailures: [{ districtSeed: seeds[0], rotation: 0, tier: 0, seat: 'a-player', message: 'injected' }],
    observations: [{}, {}, {}],
  };
  assert.throws(
    () => assertCompleteBlock(failedBlock, CREWS.diner, getDefaults()[0], 'greedy', seeds, rotations, 'pilot'),
    /matrix must have exactly|raw simulation has failures/,
  );
});