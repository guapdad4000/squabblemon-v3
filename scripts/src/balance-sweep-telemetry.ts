import { BALANCE_LAB_SCHEMA_VERSION } from '@workspace/squabblemon-engine/balanceLab';

/** Reject stale observer output before it can become a current decision artifact. */
export function assertSweepTelemetry(value: unknown): void {
  const object = (input: unknown, label: string): Record<string, unknown> => {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error(`Missing structured telemetry: ${label}`);
    return input as Record<string, unknown>;
  };
  const array = (input: unknown, label: string): unknown[] => {
    if (!Array.isArray(input)) throw new Error(`Missing structured telemetry: ${label}`);
    return input;
  };
  const schema = (input: unknown, label: string) => {
    if (input !== BALANCE_LAB_SCHEMA_VERSION) throw new Error(`Unsupported telemetry schema at ${label}; expected ${BALANCE_LAB_SCHEMA_VERSION}, got ${input}`);
  };
  const cardEvidence = (input: unknown, label: string) => {
    const card = object(input, label);
    const ability = object(card.abilityEvidence, `${label}.abilityEvidence`);
    const squabble = object(card.squabbleEvidence, `${label}.squabbleEvidence`);
    for (const key of ['baseEvents', 'baseDirectEffectEvents', 'baseNoObservedEffectEvents',
      'baseNestedEffectEvents', 'baseNestedNoObservedEffectEvents', 'baseUnknownEvents',
      'upgradeEvents', 'upgradeAppliedEvents']) {
      if (!Number.isInteger(ability[key]) || (ability[key] as number) < 0) throw new Error(`Missing or invalid evidence count: ${label}.abilityEvidence.${key}`);
    }
    for (const key of ['activatedPlays', 'normalPlays', 'unknownPlays']) {
      if (!Number.isInteger(squabble[key]) || (squabble[key] as number) < 0) throw new Error(`Missing or invalid evidence count: ${label}.squabbleEvidence.${key}`);
    }
    const baseTotal = ['baseDirectEffectEvents', 'baseNoObservedEffectEvents', 'baseNestedEffectEvents',
      'baseNestedNoObservedEffectEvents', 'baseUnknownEvents'].reduce((sum, key) => sum + (ability[key] as number), 0);
    const eventTotal = (ability.baseEvents as number) + (ability.upgradeEvents as number);
    const playTotal = (squabble.activatedPlays as number) + (squabble.normalPlays as number) + (squabble.unknownPlays as number);
    if (baseTotal !== ability.baseEvents
        || eventTotal !== (card.abilityTriggers ?? card.legacyObserverAbilityTriggersObserved)
        || playTotal !== (card.played ?? card.plays)) throw new Error(`Inconsistent structured telemetry totals: ${label}`);
  };
  const report = object(value, 'report');
  schema(report.schemaVersion, 'report.schemaVersion');
  schema(object(report.versionMetadata, 'versionMetadata').balanceLabSchemaVersion, 'versionMetadata.balanceLabSchemaVersion');
  const blocks = array(report.blocks, 'blocks');
  if (!blocks.length) throw new Error('Missing structured telemetry: no report blocks');
  for (const [index, input] of blocks.entries()) {
    const label = `blocks[${index}]`;
    const block = object(input, label);
    const matrix = object(block.matrix, `${label}.matrix`);
    schema(matrix.telemetrySchemaVersion, `${label}.matrix.telemetrySchemaVersion`);
    for (const card of array(matrix.cards, `${label}.matrix.cards`)) {
      cardEvidence(card, `${label}.matrix.cards`);
      if (object(card, 'matrix card').abilitySuccessRate !== null) throw new Error('Unsupported ability reliability ratio in matrix');
    }
    for (const input of array(block.rawResults, `${label}.rawResults`)) {
      const raw = object(input, 'raw match');
      schema(raw.telemetrySchemaVersion, 'raw match.telemetrySchemaVersion');
      for (const side of ['cardsA', 'cardsB']) {
        for (const card of array(raw[side], `raw match.${side}`)) cardEvidence(card, `raw match.${side}`);
      }
    }
    const summaries = object(block.cardSummaries, `${label}.cardSummaries`);
    for (const side of ['shell', 'opponent']) {
      const cards = object(object(summaries[side], `summary.${side}`).cards, `summary.${side}.cards`);
      for (const card of Object.values(cards)) {
        cardEvidence(card, `summary.${side}.cards`);
        if (object(card, 'summary card').abilitySuccessRateWhenObserved !== null) throw new Error('Unsupported ability reliability ratio in card summary');
      }
    }
    for (const capture of array(block.crewCardEventObservations, `${label}.crewCardEventObservations`)) {
      for (const entry of array(object(capture, 'capture').events, 'capture.events')) {
        const event = object(entry, 'captured event');
        if (event.type === 'ability') {
          const evidence = object(event.abilityEvidence, 'captured ability attribution');
          if (!['base', 'upgrade'].includes(String(evidence.attribution))
              || !['direct-effect', 'no-observed-effect', 'nested-effect', 'nested-no-observed-effect', 'unknown'].includes(String(evidence.outcome))
              || !Array.isArray(evidence.nestedEventSequences)) throw new Error('Missing structured telemetry: captured ability attribution');
        }
      }
    }
  }
}