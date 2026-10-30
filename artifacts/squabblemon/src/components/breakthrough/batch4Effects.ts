import type {
  BattleEvent,
  Side,
} from '@workspace/squabblemon-engine/breakthrough';
import { BATCH4_FX, type Batch4FxName } from './assets/supplied-fx/batch4';
import { DAMAGE_READ_MS } from './combatPresentation';

export type TimedFxEvent = BattleEvent & { born: number };
export function hazardDisplaySide(kind: 'bomb' | 'bud', owner: Side): Side {
  return kind === 'bud' ? owner : owner === 'player' ? 'opponent' : 'player';
}
const cues: Partial<Record<string, Batch4FxName>> = {
  deploy: 'summon',
  hit: 'hitDust',
  escape: 'moveDust',
  push: 'moveDust',
  lunch: 'lunch',
  mend: 'lunch',
  cleanse: 'cleanse',
  'bud-sprout': 'growth',
};
export function batch4Cue(event: BattleEvent): Batch4FxName | undefined {
  if (event.type === 'bud-sprout' && event.text === 'EMPTY BUD') return;
  if (event.type === 'mend' && !(event.amount && event.amount > 0)) return;
  return cues[event.type];
}
export function visualEventLifetime(event: BattleEvent): number {
  if (event.type === 'defeat') return 3380;
  if (['damage', 'collision-damage'].includes(event.type)) return 2920;
  if (event.type === 'buff') return DAMAGE_READ_MS;
  const cue = batch4Cue(event);
  return cue
    ? BATCH4_FX[cue].durationMs
    : ['breach', 'last-stand', 'bomb-planted', 'bud-planted'].includes(
          event.type,
        )
      ? BATCH4_FX.banner.durationMs
      : 1000;
}
/** Coalesce redundant cues at one contact; a burst never becomes a stack of overlays. */
export function batch4Cues(events: TimedFxEvent[], now: number) {
  const latest = new Map<string, { event: TimedFxEvent; name: Batch4FxName }>();
  for (const event of events) {
    const name = batch4Cue(event);
    if (
      !name ||
      event.lane === undefined ||
      event.position === undefined ||
      now - event.born >= BATCH4_FX[name].durationMs
    )
      continue;
    latest.set(
      `${name}/${event.lane}/${event.side}/${Math.round(event.position * 10)}`,
      { event, name },
    );
  }
  return [...latest.values()]
    .sort((a, b) => a.event.id - b.event.id)
    .slice(-10);
}
export function batch4Announcement(events: TimedFxEvent[], now: number) {
  const candidates = events.filter(
    (event) => now - event.born < BATCH4_FX.banner.durationMs,
  );
  const major = candidates
    .filter((event) => event.type === 'breach' || event.type === 'last-stand')
    .at(-1);
  const event =
    major ??
    candidates
      .filter(
        (event) =>
          event.type === 'bomb-planted' || event.type === 'bud-planted',
      )
      .at(-1);
  if (!event) return;
  const text =
    event.type === 'breach'
      ? event.side === 'player'
        ? 'BASE BREACHED'
        : 'THE OPPS BROKE THROUGH'
      : event.type === 'last-stand'
        ? 'LAST STAND'
        : event.type === 'bomb-planted'
          ? 'SMILE BOMBS ARMED'
          : 'GROWING THE BLOCK';
  return { event, text };
}
