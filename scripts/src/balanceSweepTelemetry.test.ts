import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { BalanceMatchResult } from '@workspace/squabblemon-engine/balanceLab';
import { assertSweepTelemetry } from './balance-sweep-telemetry';

function reportFixture() {
  const card = {
    played: 2, abilityTriggers: 3,
    abilityEvidence: {
      baseEvents: 2, baseDirectEffectEvents: 0, baseNoObservedEffectEvents: 0,
      baseNestedEffectEvents: 1, baseNestedNoObservedEffectEvents: 0, baseUnknownEvents: 1,
      upgradeEvents: 1, upgradeAppliedEvents: 1,
    },
    squabbleEvidence: { activatedPlays: 0, normalPlays: 1, unknownPlays: 1 },
    abilitySuccessRate: null, abilitySuccessRateWhenObserved: null,
  };
  return {
    schemaVersion: 2, versionMetadata: { balanceLabSchemaVersion: 2 },
    blocks: [{
      matrix: { telemetrySchemaVersion: 2, cards: [structuredClone(card)] },
      rawResults: [{ telemetrySchemaVersion: 2, cardsA: [structuredClone(card)], cardsB: [structuredClone(card)] }],
      cardSummaries: {
        shell: { cards: { teknician: structuredClone(card) } },
        opponent: { cards: { teknician: structuredClone(card) } },
      },
      crewCardEventObservations: [{ events: [{
        type: 'ability', abilityEvidence: {
          attribution: 'base', outcome: 'unknown', nestedEventSequences: [],
        },
      }] }],
    }],
  };
}

test('report validation accepts explicit unknown counts and rejects schema-1 shards', () => {
  const report = reportFixture();
  assert.doesNotThrow(() => assertSweepTelemetry(report));
  report.versionMetadata.balanceLabSchemaVersion = 1;
  assert.throws(() => assertSweepTelemetry(report), /Unsupported telemetry schema/);
});

test('report validation rejects missing evidence anywhere in shards or merged outputs', () => {
  const mutations = [
    (report: any) => { delete report.blocks[0].rawResults[0].telemetrySchemaVersion; },
    (report: any) => { delete report.blocks[0].rawResults[0].cardsA[0].abilityEvidence; },
    (report: any) => { delete report.blocks[0].rawResults[0].cardsB[0].squabbleEvidence.unknownPlays; },
    (report: any) => { delete report.blocks[0].matrix.cards[0].abilityEvidence.baseUnknownEvents; },
    (report: any) => { delete report.blocks[0].cardSummaries.opponent.cards.teknician.abilityEvidence; },
    (report: any) => { delete report.blocks[0].crewCardEventObservations[0].events[0].abilityEvidence; },
    (report: any) => { report.blocks[0].cardSummaries.shell.cards.teknician.abilitySuccessRateWhenObserved = 0.5; },
    (report: any) => { report.blocks[0].matrix.cards[0].abilitySuccessRate = 0.5; },
    (report: any) => { report.blocks[0].rawResults[0].cardsA[0].squabbleEvidence.unknownPlays = 0; },
  ];
  for (const mutate of mutations) {
    const report = reportFixture();
    mutate(report);
    assert.throws(() => assertSweepTelemetry(report));
  }
  const merged = { ...reportFixture(), blocks: [...reportFixture().blocks, ...reportFixture().blocks] };
  delete (merged.blocks[1].rawResults[0].cardsA[0] as any).abilityEvidence;
  assert.throws(() => assertSweepTelemetry(merged), /Missing structured telemetry/);
});

test('the saved staff decision report has current evidence and preserves every historical raw outcome', () => {
  const filename = 'squabblehouse-staff-balance-current-rules.json';
  const current = JSON.parse(readFileSync(new URL(`../results/squabblehouse-staff-balance/${filename}`, import.meta.url), 'utf8'));
  const historical = JSON.parse(readFileSync(new URL(`../results/squabblehouse-staff-balance/history/schema-1/${filename}`, import.meta.url), 'utf8'));
  assertSweepTelemetry(current);
  assert.equal(current.shardCount, 9);
  assert.equal(current.blocks.length, 9);
  assert.equal(current.simulationAccounting.rawRetainedSamples, 1008);
  assert.equal(current.failures.length, 0);
  assert.deepEqual(current.configuration.shell, historical.configuration.shell);
  assert.deepEqual(current.configuration.opponents, historical.configuration.opponents);
  for (const field of ['cardBalanceVersion', 'onlineRulesVersion', 'enginePackage']) {
    assert.deepEqual(current.versionMetadata[field], historical.versionMetadata[field]);
  }
  const gameplay = (match: BalanceMatchResult) => {
    const { telemetrySchemaVersion: _schema, telemetrySemantics: _semantics, cardsA, cardsB, ...outcome } = match;
    const cards = (observations: BalanceMatchResult['cardsA']) => observations.map(({
      abilityEvidence: _ability, squabbleEvidence: _squabble, squabbles: _correctedCount, ...raw
    }) => raw);
    return { ...outcome, cardsA: cards(cardsA), cardsB: cards(cardsB) };
  };
  let nestedEffects = 0;
  for (const block of current.blocks) {
    const prior = historical.blocks.find((old: any) => old.matchup === block.matchup
      && old.policy === block.policy && old.schedule.set === block.schedule.set);
    assert.ok(prior, 'same matchup, policy, and schedule retained');
    assert.deepEqual(block.schedule, prior.schedule);
    assert.deepEqual(block.rawResults.map(gameplay), prior.rawResults.map(gameplay),
      'only descriptive telemetry may change, not raw game outcomes or legacy event counters');
    const captured = (captures: any[]) => captures.map(capture => ({
      ...capture,
      events: capture.events.map(({ abilityEvidence: _evidence, ...raw }: any) => raw),
    }));
    assert.deepEqual(captured(block.crewCardEventObservations), prior.crewCardEventObservations,
      'original source-attributed event outcomes and notes remain unchanged');
    nestedEffects += block.matrix.cards.reduce((sum: number, card: any) => sum + card.abilityEvidence.baseNestedEffectEvents, 0);
  }
  assert.ok(nestedEffects > 0, 'current report includes proven nested staff effects');
});