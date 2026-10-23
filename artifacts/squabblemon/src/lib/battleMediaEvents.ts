import type { EffectLogEntry } from '@workspace/squabblemon-engine/gameEngine';

/** A Fire event can include friendly buffs or blocked enemies; neither is a hit. */
export function fireAttackTargetIds(effect: Pick<EffectLogEntry, 'kind' | 'owner' | 'targets'>) {
  return new Set(effect.kind !== 'fire' ? [] : effect.targets.filter(target =>
    target.owner !== effect.owner && (
      (target.before && target.after && target.after.basePower + target.after.powerModifier < target.before.basePower + target.before.powerModifier) || (target.before && !target.after)
      || (target.after?.statuses.burnStacks ?? 0) > (target.before?.statuses.burnStacks ?? 0)
    )).map(target => target.cardInstanceId));
}

/** Burn lands with the shared hit even when it adds stacks without immediate damage. */
export function burnApplicationTargetIds(effect: Pick<EffectLogEntry, 'owner' | 'targets'>) {
  return new Set(effect.targets.filter(target => target.owner !== effect.owner && target.before && target.after
    && (target.after.statuses.burnStacks ?? 0) > (target.before.statuses.burnStacks ?? 0))
    .map(target => target.cardInstanceId));
}

/** A played Squabble belongs to that instance, regardless of later power changes. */
export function squabbledCardIds(events: readonly EffectLogEntry[], throughSequence = Infinity) {
  return new Set(events.filter(event => event.sequence <= throughSequence && event.type === 'play'
    && event.note.includes('SQUABBLE')).map(event => event.cardInstanceId));
}

export const DEFEAT_CONTACT_MS = 2920;
export const DEFEAT_GHOST_MS = 2760;
/** Neutral departures (return, transformation, aura loss) are not defeated fighters. */
export function hasDefeatedCard(effect: Pick<EffectLogEntry, 'source' | 'targets'>) {
  return [effect.source, ...effect.targets].some(p => p?.before && !p.after && !p.departureCause);
}
/** Hold presentation only; 80ms lets the final painted pose settle before cleanup. */
export function completeDefeatBeat(effect: Pick<EffectLogEntry, 'source' | 'targets'>, normalMs: number, contactMs = DEFEAT_CONTACT_MS) {
  return hasDefeatedCard(effect) ? Math.max(normalMs, contactMs) + DEFEAT_GHOST_MS + 80 : normalMs;
}
