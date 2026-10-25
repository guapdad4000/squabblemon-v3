import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BALANCE_LAB_SCHEMA_VERSION,
  classifyBalanceAbilityEvent,
  isSuccessfulBalanceAbilityEvent,
  classifyBalanceSquabblePlay,
  observeBalanceCards,
  runBalanceMatrix,
  simulateBalanceMatch,
  type BalanceDeck,
} from '@workspace/squabblemon-engine/balanceLab';
import {
  createCardInstance,
  createMatch,
  playCard,
  playTurnCard,
  type EffectLogEntry,
  type Match,
  type Owner,
} from '@workspace/squabblemon-engine/gameEngine';
import { summarizeCards } from './squabblehouse-balance-sweep';

const telemetryDeck = (...cardIds: string[]): BalanceDeck => ({
  id: 'telemetry-fixture',
  name: 'Telemetry fixture',
  cardIds,
});

function fixture(owner: Owner, cardId: string, squabbleByOwner = true): Match {
  let match = createMatch('squabblehouse-shift', 'squabblehouse-shift');
  const enemy: Owner = owner === 'player' ? 'cpu' : 'player';
  const source = createCardInstance(cardId, owner, 'telemetry-fixture', 0);
  const target = createCardInstance('cornball', enemy, 'telemetry-enemy', 0);
  target.lane = 0;
  match = {
    ...match,
    phase: owner === 'player' ? 'player' : 'cpu-reveal',
    playerHand: owner === 'player' ? [source] : [],
    cpuHand: owner === 'cpu' ? [source] : [],
    playerMotion: 20,
    cpuMotion: 20,
    boards: [[target], [], []],
    ...(squabbleByOwner ? { squabbleByOwner: { player: false, cpu: false } } : {}),
  };
  return match;
}

function playEvent(match: Match, owner: Owner, cardId: string, squabble = false): {
  match: Match;
  event: EffectLogEntry;
} {
  const source = (owner === 'player' ? match.playerHand : match.cpuHand).find(card => card.cardId === cardId);
  assert.ok(source, `${owner} fixture has ${cardId} in hand`);
  const result = playCard(match, owner, source.instanceId, 0, squabble);
  const event = result.effectLog.find(entry => entry.type === 'play' && entry.cardId === cardId && entry.owner === owner);
  assert.ok(event, `engine emitted ${owner} ${cardId} play`);
  return { match: result, event };
}

test('schema 2 classifies real Squabblehouse play transitions structurally for both owners', () => {
  assert.equal(BALANCE_LAB_SCHEMA_VERSION, 2);
  for (const cardId of ['squabble-house-manager', 'squabblehouse-security', 'squabblehouse-teknician']) {
    for (const owner of ['player', 'cpu'] as const) {
      const { event: normal } = playEvent(fixture(owner, cardId), owner, cardId);
      const { event: activated } = playEvent(fixture(owner, cardId), owner, cardId, true);
      assert.equal(classifyBalanceSquabblePlay(normal), 'normal', `${owner} ${cardId} normal play`);
      assert.equal(classifyBalanceSquabblePlay(activated), 'activated', `${owner} ${cardId} Squabble`);

      // Presentation copy (including the engine's Squabble wording) cannot change attribution.
      assert.equal(classifyBalanceSquabblePlay({ ...normal, note: activated.note }), 'normal');
      assert.equal(classifyBalanceSquabblePlay({ ...activated, note: normal.note }), 'activated');
      const normalObservation = observeBalanceCards(
        playEvent(fixture(owner, cardId), owner, cardId).match,
        owner,
        telemetryDeck(cardId),
      )[0];
      const squabbleObservation = observeBalanceCards(
        playEvent(fixture(owner, cardId), owner, cardId, true).match,
        owner,
        telemetryDeck(cardId),
      )[0];
      assert.equal(normalObservation.squabbleEvidence.normalPlays, 1);
      assert.equal(squabbleObservation.squabbleEvidence.activatedPlays, 1);
      assert.equal(normalObservation.squabbles, 0, 'Squabblehouse in the card name is not an activation');
      assert.equal(squabbleObservation.squabbles, 1, 'a real Squabble is counted once');
      assert.equal(
        normalObservation.squabbleEvidence.activatedPlays
          + normalObservation.squabbleEvidence.normalPlays
          + normalObservation.squabbleEvidence.unknownPlays,
        normalObservation.played,
      );
      assert.equal(
        squabbleObservation.squabbleEvidence.activatedPlays
          + squabbleObservation.squabbleEvidence.normalPlays
          + squabbleObservation.squabbleEvidence.unknownPlays,
        squabbleObservation.played,
      );
    }
  }

  // Legacy player transcripts carry only squabbleUsed; both-owner transcripts carry the
  // symmetric owner flags. A CPU transcript with neither activation field is unknown.
  const legacyNormal = playEvent(fixture('player', 'squabble-house-manager', false), 'player', 'squabble-house-manager').event;
  const legacyActivated = playEvent(fixture('player', 'squabble-house-manager', false), 'player', 'squabble-house-manager', true).event;
  assert.equal(classifyBalanceSquabblePlay(legacyNormal), 'normal');
  assert.equal(classifyBalanceSquabblePlay(legacyActivated), 'activated');
  const missingFlags: EffectLogEntry = {
    ...legacyNormal,
    owner: 'cpu',
    replay: {
      before: { ...legacyNormal.replay.before, squabbleByOwner: undefined },
      after: { ...legacyNormal.replay.after, squabbleByOwner: undefined },
    },
  };
  assert.equal(classifyBalanceSquabblePlay(missingFlags), 'unknown');
});

test('Teknician attribution follows real revealed staff echoes, distinguishing no target and no effect', () => {
  for (const owner of ['player', 'cpu'] as const) {
    const enemy: Owner = owner === 'player' ? 'cpu' : 'player';
    const base = fixture(owner, 'squabblehouse-teknician');
    const manager = createCardInstance('squabble-house-manager', owner, 'telemetry-staff', 0);
    const technician = createCardInstance('squabblehouse-teknician', owner, 'telemetry-fixture', 0);
    const opponent = createCardInstance('cornball', enemy, 'telemetry-opponent', 0);
    opponent.lane = 0;

    // Actual first play records Manager's reveal; the following Technician play repeats it.
    const ready: Match = {
      ...base,
      boards: [[opponent], [], []],
      playerHand: owner === 'player' ? [manager, technician] : [],
      cpuHand: owner === 'cpu' ? [manager, technician] : [],
      playerMotion: 20,
      cpuMotion: 20,
    };
    const afterManager = playTurnCard(ready, owner, manager.instanceId, 0);
    const afterTechnician = playTurnCard(afterManager, owner, technician.instanceId, 0);
    const technicianPlay = afterTechnician.effectLog.find(entry =>
      entry.type === 'play' && entry.cardInstanceId === technician.instanceId);
    const wrapper = afterTechnician.effectLog.find(entry =>
      entry.type === 'ability' && entry.cardInstanceId === technician.instanceId);
    assert.ok(technicianPlay);
    assert.ok(wrapper);
    assert.equal(classifyBalanceAbilityEvent(wrapper, afterTechnician.effectLog)?.outcome, 'nested-effect');
    assert.equal(classifyBalanceAbilityEvent(wrapper)?.outcome, 'unknown', 'a wrapper alone cannot prove its nested outcome');

    // The echo event is logged separately; its wrapper frame begins after that event, so the
    // legacy one-frame delta heuristic misses the successful nested state change.
    const observations = observeBalanceCards(afterTechnician, owner, telemetryDeck('squabblehouse-teknician'));
    const observed = observations[0];
    assert.equal(observed.abilityEvidence.baseNestedEffectEvents, 1);
    assert.equal(observed.abilitySuccesses, 0);
    assert.equal(observed.abilityTriggers, 1);

    // Manager remains an eligible staff target even when it has no enemy to affect. That is
    // different from a Technician played with no staff reveal in its history.
    const noEnemyBase = fixture(owner, 'squabblehouse-teknician');
    const noEnemyManager = createCardInstance('squabble-house-manager', owner, 'telemetry-no-effect', 0);
    const noEnemyTechnician = createCardInstance('squabblehouse-teknician', owner, 'telemetry-no-effect', 1);
    const noEnemyReady: Match = {
      ...noEnemyBase,
      boards: [[], [], []],
      playerHand: owner === 'player' ? [noEnemyManager, noEnemyTechnician] : [],
      cpuHand: owner === 'cpu' ? [noEnemyManager, noEnemyTechnician] : [],
      playerMotion: 20,
      cpuMotion: 20,
    };
    const noEnemyAfterStaff = playTurnCard(noEnemyReady, owner, noEnemyManager.instanceId, 0);
    const noEnemyAfterTech = playTurnCard(noEnemyAfterStaff, owner, noEnemyTechnician.instanceId, 0);
    const noEffectWrapper = noEnemyAfterTech.effectLog.find(entry =>
      entry.type === 'ability' && entry.cardInstanceId === noEnemyTechnician.instanceId);
    assert.ok(noEffectWrapper);
    assert.equal(classifyBalanceAbilityEvent(noEffectWrapper, noEnemyAfterTech.effectLog)?.outcome, 'nested-no-observed-effect');

    const noStaff = fixture(owner, 'squabblehouse-teknician');
    const alone = playEvent(noStaff, owner, 'squabblehouse-teknician');
    const aloneAbility = alone.match.effectLog.find(entry =>
      entry.type === 'ability' && entry.cardInstanceId === alone.event.cardInstanceId);
    assert.ok(aloneAbility);
    assert.match(aloneAbility.note, /no eligible friendly Squabblehouse staff/i);
    assert.equal(classifyBalanceAbilityEvent(aloneAbility, alone.match.effectLog)?.outcome, 'no-observed-effect');
    const noStaffObservation = observeBalanceCards(
      alone.match,
      owner,
      telemetryDeck('squabblehouse-teknician'),
    )[0];
    assert.equal(noStaffObservation.abilityEvidence.baseNoObservedEffectEvents, 1);

    // With the echo event omitted from a transcript, the settled wrapper is not promoted to
    // direct success; an adjacent settled frame makes its missing causal attribution explicit.
    const ambiguous = afterTechnician.effectLog.filter(entry =>
      entry.sequence < wrapper.sequence && entry.sequence !== technicianPlay.sequence);
    assert.equal(classifyBalanceAbilityEvent(wrapper, ambiguous)?.outcome, 'unknown');
    const transcriptMissingPlay: Match = {
      ...afterTechnician,
      effectLog: afterTechnician.effectLog.filter(entry => entry.sequence !== technicianPlay.sequence),
    };
    assert.equal(
      observeBalanceCards(transcriptMissingPlay, owner, telemetryDeck('squabblehouse-teknician'))[0]
        .abilityEvidence.baseUnknownEvents,
      1,
    );
  }
});

test('observation preserves raw counters, isolates real upgrade events, and never mutates engine logs', () => {
  const upgraded = createMatch('compound', 'compound', {
    player: { plug: { xp: 2800, level: 8, moveTier: 3 } },
  });
  const plug = upgraded.playerHand.find(card => card.cardId === 'plug');
  assert.ok(plug);
  const ready: Match = {
    ...upgraded,
    playerHand: [plug],
    cpuHand: [],
    playerMotion: 20,
    phase: 'player',
  };
  const result = playCard(ready, 'player', plug.instanceId, 0);
  const before = JSON.stringify(result);
  const observations = observeBalanceCards(result, 'player', telemetryDeck('plug'));
  assert.equal(JSON.stringify(result), before, 'observation must not mutate match state or source effect logs');

  const plugObservation = observations[0];
  assert.equal(plugObservation.played, 1);
  assert.equal(plugObservation.abilityTriggers, 4, 'legacy raw count includes base and three upgrade events');
  assert.equal(plugObservation.abilitySuccesses, 4, 'legacy delta heuristic remains unmodified');
  assert.equal(plugObservation.abilityEvidence.baseEvents, 1);
  assert.equal(plugObservation.abilityEvidence.baseDirectEffectEvents, 1);
  assert.equal(plugObservation.abilityEvidence.upgradeEvents, 3);
  assert.equal(plugObservation.abilityEvidence.upgradeAppliedEvents, 3);
  assert.equal(
    plugObservation.abilityEvidence.baseDirectEffectEvents
      + plugObservation.abilityEvidence.baseNoObservedEffectEvents
      + plugObservation.abilityEvidence.baseNestedEffectEvents
      + plugObservation.abilityEvidence.baseNestedNoObservedEffectEvents
      + plugObservation.abilityEvidence.baseUnknownEvents,
    plugObservation.abilityEvidence.baseEvents,
  );
  assert.equal(
    plugObservation.abilityEvidence.baseEvents + plugObservation.abilityEvidence.upgradeEvents,
    plugObservation.abilityTriggers,
  );

  const tenCardFixture = telemetryDeck(
    'squabble-house-manager', 'plug', 'waterboy', 'squabblehouse-security', 'squabblehouse-teknician',
    'griddle-master', 'inmate-reformed', 'janitor', 'laundry', 'nail',
  );
  const report = runBalanceMatrix({
    id: 'telemetry-summary',
    decks: [tenCardFixture, { ...tenCardFixture, id: 'telemetry-opponent' }],
    districtSeeds: ['telemetry-summary'],
    rotations: [0],
    tiers: [0],
    includeMirrors: false,
    minimumSampleSize: 1,
    allowSquabble: false,
  });
  assert.equal(report.telemetrySchemaVersion, 2);
  assert.equal(report.cards.length > 0, true);
  assert.equal(report.cards.every(card => card.abilitySuccessRate === null), true);
});

test('the sweep carries structured evidence for both crews without restoring a mixed reliability ratio', () => {
  const deck = telemetryDeck(
    'squabble-house-manager', 'plug', 'waterboy', 'squabblehouse-security', 'squabblehouse-teknician',
    'griddle-master', 'inmate-reformed', 'janitor', 'laundry', 'nail',
  );
  const result = simulateBalanceMatch({
    deckA: deck, deckB: { ...deck, id: 'telemetry-opponent' }, districtSeed: 'telemetry-consumer',
    rotation: 0, tier: 3, seat: 'a-player',
  });
  for (const side of ['a', 'b'] as const) {
    const observations = side === 'a' ? result.cardsA : result.cardsB;
    const summary = summarizeCards([result, result], side);
    for (const observation of observations) {
      const card = summary[observation.cardId];
      assert.equal(card.abilitySuccessRateWhenObserved, null);
      assert.equal(card.abilityTriggersObserved, null);
      assert.equal(card.legacyObserverAbilityTriggersObserved, observation.abilityTriggers * 2);
      assert.equal(card.legacyObserverMechanicallySuccessfulAbilityEvents, observation.abilitySuccesses * 2);
      assert.match(card.abilitySuccessMetricLimitation, /Unavailable/);
      for (const key of Object.keys(observation.abilityEvidence) as (keyof typeof observation.abilityEvidence)[]) {
        assert.equal(card.abilityEvidence?.[key], observation.abilityEvidence[key] * 2);
      }
      assert.equal(card.squabbleEvidence?.activatedPlays, observation.squabbleEvidence.activatedPlays * 2);
    }
    // Old raw reports remain readable, but missing evidence is unknown, never fabricated zeros.
    const historical = {
      ...result,
      cardsA: result.cardsA.map(({ abilityEvidence: _ability, squabbleEvidence: _squabble, ...raw }) => raw),
      cardsB: result.cardsB.map(({ abilityEvidence: _ability, squabbleEvidence: _squabble, ...raw }) => raw),
    } as unknown as typeof result;
    const mixed = summarizeCards([result, historical], side);
    for (const card of Object.values(mixed)) {
      assert.equal(card.abilityEvidence, null);
      assert.equal(card.squabbleEvidence, null);
      assert.equal(card.squabbles, null);
      assert.equal(card.abilitySuccessRateWhenObserved, null);
    }
  }
});

test('current ability evidence ignores object key order while retaining legacy counters and real changes', () => {
  const played = playEvent(fixture('player', 'ptang'), 'player', 'ptang');
  const template = played.match.effectLog.find(event => event.type === 'ability' && event.cardId === 'ptang')!;
  assert(template);
  const card = createCardInstance('waterboy', 'player', 'order-fixture', 0);
  card.lane = 0; card.roles = ['Support', 'Movement'];
  const reordered = Object.fromEntries(Object.entries(card).reverse()) as typeof card;
  const state = template.replay.before;
  const event: EffectLogEntry = { ...template, note: 'Belt Check: waiting for its condition or blocked.',
    resources: { before: template.resources.before, after: template.resources.before },
    replay: { before: { ...state, boards: [[card], [], []] }, after: { ...state, boards: [[reordered], [], []] } } };
  assert.equal(isSuccessfulBalanceAbilityEvent(event), true, 'historical JSON-string heuristic stays available explicitly');
  assert.equal(classifyBalanceAbilityEvent(event)?.outcome, 'no-observed-effect');
  const changed: EffectLogEntry = { ...event, replay: { ...event.replay, after: { ...event.replay.after,
    boards: [[{ ...reordered, powerModifier: reordered.powerModifier + 1 }], [], []] } } };
  assert.equal(classifyBalanceAbilityEvent(changed)?.outcome, 'direct-effect');
  const changedOrder: EffectLogEntry = { ...event, replay: { ...event.replay, after: { ...event.replay.after,
    boards: [[{ ...reordered, roles: [...reordered.roles!].reverse() }], [], []] } } };
  assert.equal(classifyBalanceAbilityEvent(changedOrder)?.outcome, 'direct-effect', 'array ordering remains meaningful JSON data');
});

test('exact Ptang/Waterboy stress probes do not turn equivalent snapshot order into an effect', async () => {
  const { inventory, simulateSweepCase, scenario } = await import('./fullBalanceSweepCore');
  const inv = inventory(), decks = new Map([...inv.decks, ...inv.probes, inv.historicalRed].map(deck => [deck.id, deck]));
  for (const target of ['delivery', 'transplant']) {
    const test = scenario({ stage: 'catalog-probe', a: `probe-${target}`, b: 'focused-blue-set', policy: 'seeded-legal',
      seed: 'base-pvp-b64-r64-beta-v64-corrected-base-probe-0', rotation: 0, tierA: 0, tierB: 0, seat: 'b-player', target });
    let observed = false;
    const result = simulateSweepCase(test, decks, match => {
      const event = match.effectLog.find(entry => entry.sequence === 75 && entry.cardId === 'ptang' && entry.type === 'ability');
      if (!event) return;
      observed = true;
      assert.equal(isSuccessfulBalanceAbilityEvent(event), true, 'explicit legacy heuristic exposes the old false positive');
      assert.equal(classifyBalanceAbilityEvent(event, match.effectLog)?.outcome, 'no-observed-effect');
    });
    assert(observed, `${target}: diagnosed actual event must be exercised`);
    const ptang = result.cardsA.find(card => card.cardId === 'ptang')!;
    assert.equal(ptang.abilityEvidence.baseDirectEffectEvents, 0);
    assert.equal(ptang.abilityEvidence.baseNoObservedEffectEvents, 2);
  }
});
