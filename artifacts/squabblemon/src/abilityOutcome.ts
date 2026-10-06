import type { EffectLogEntry, EventParticipant, ReplayState } from './gameEngine';

type OutcomeEvent = Pick<EffectLogEntry, 'type'> & { kind: EffectLogEntry['kind'] | 'fizzle' } & Partial<Pick<EffectLogEntry,
  'source' | 'targets' | 'resources' | 'scores' | 'replay'>>;

const changed = (before: unknown, after: unknown) => JSON.stringify(before) !== JSON.stringify(after);

function participantChanged(participant: EventParticipant, event: OutcomeEvent) {
  const { before, after } = participant;
  if (!before || !after) return before !== after;
  // A defender spending a shield or receiving a "blocked" marker is feedback
  // for an unsuccessful attack, not a successful special by the attacker.
  const consumedShield = event.replay?.before.timedEffects.some(shield =>
    (shield.kind === 'church-protection' || shield.kind === 'salon-protection')
    && shield.targetInstanceId === participant.cardInstanceId
    && !event.replay?.after.timedEffects.some(active => active.id === shield.id));
  const state = (value: typeof before) => ({
    lane: value.lane, owner: value.owner, basePower: value.basePower,
    powerModifier: value.powerModifier, power: value.power,
    statuses: { ...value.statuses, blocked: false,
      protected: consumedShield && before.statuses.protected && !after.statuses.protected ? false : value.statuses.protected },
    maryCents: value.maryCents, maryElephant: value.maryElephant,
    buddyForm: value.buddyForm, buddyGrowthAtRound: value.buddyGrowthAtRound,
    buddyEarthExpiresAtRound: value.buddyEarthExpiresAtRound, buddyBud: value.buddyBud,
  });
  return changed(state(before), state(after));
}

/** Presentation reads the resolved event, never its prose or just its element. */
export function abilityTookEffect(event: OutcomeEvent): boolean {
  if (event.type !== 'ability' || event.kind === 'blocked' || event.kind === 'fizzle' || event.kind === 'story') return false;
  if ([event.source, ...(event.targets ?? [])].some(p => p && participantChanged(p, event))) return true;
  if (event.resources && changed(event.resources.before, event.resources.after)) return true;
  if (event.scores && changed(event.scores.before, event.scores.after)) return true;
  if (!event.replay) return false;
  const { before, after } = event.replay;
  // Draws, summons, transformations, and copied/delayed abilities can succeed
  // without changing a participant's current score.
  const consumedShields = new Set(before.timedEffects.filter(shield =>
    (shield.kind === 'church-protection' || shield.kind === 'salon-protection')
    && !after.timedEffects.some(active => active.id === shield.id)).map(shield => shield.targetInstanceId));
  const roster = (state: ReplayState) => [state.playerHand, state.cpuHand, ...state.boards].map(zone =>
    zone.map(card => [card.instanceId, card.cardId, card.basePower, card.powerModifier,
      { ...card.statuses, blocked: false, protected: consumedShields.has(card.instanceId) ? false : card.statuses.protected },
      card.copiedAbilityCardId, card.bankedMotion,
      card.aliceReady, card.buddyGrowthAtRound, card.buddyBud, card.smileBomb]));
  if (changed(roster(before), roster(after))) return true;
  for (const key of ['discountTokens', 'timedEffects', 'creativeMarks', 'districtTraps', 'lingeringScents'] as const) {
    // Consuming protection during a blocked attack must not trigger its video.
    const visible = (item: unknown) => key !== 'creativeMarks' || !/^((mi|sl)-ledger-)/.test((item as { kind?: string }).kind ?? '');
    if (after[key]?.some(item => visible(item) && !before[key]?.some(old => !changed(old, item)))) return true;
  }
  return changed(before.plugDiscountLane, after.plugDiscountLane)
    || changed(before.afterParty, after.afterParty);
}

export function abilityFailed(event: OutcomeEvent): boolean {
  return event.type === 'ability' && event.kind !== 'story' && !abilityTookEffect(event);
}

export const FAILED_ABILITY_BEAT_MS = 260;
