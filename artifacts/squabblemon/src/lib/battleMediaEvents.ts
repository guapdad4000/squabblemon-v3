import type { EffectLogEntry } from '@workspace/squabblemon-engine/gameEngine';

/** A Fire event can include friendly buffs or blocked enemies; neither is a hit. */
export function fireAttackTargetIds(effect: Pick<EffectLogEntry, 'kind' | 'owner' | 'targets'>) {
  return new Set(effect.kind !== 'fire' ? [] : effect.targets.filter(target =>
    target.owner !== effect.owner && (
      (target.before && target.after && target.after.basePower + target.after.powerModifier < target.before.basePower + target.before.powerModifier) || (target.before && !target.after)
      || (target.after?.statuses.burnStacks ?? 0) > (target.before?.statuses.burnStacks ?? 0)
    )).map(target => target.cardInstanceId));
}

/** A played Squabble belongs to that instance, regardless of later power changes. */
export function squabbledCardIds(events: readonly EffectLogEntry[], throughSequence = Infinity) {
  return new Set(events.filter(event => event.sequence <= throughSequence && event.type === 'play'
    && event.note.includes('SQUABBLE')).map(event => event.cardInstanceId));
}
