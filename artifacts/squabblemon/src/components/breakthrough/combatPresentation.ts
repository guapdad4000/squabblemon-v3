import type { TimedFxEvent } from './batch4Effects';

export const DAMAGE_READ_MS = 1250;
export const BASE_IMPACT_MS = 1450;
const live = (event: TimedFxEvent, now: number, duration: number) =>
  now >= event.born && now - event.born < duration;
const sameContact = (a: TimedFxEvent, b: TimedFxEvent) =>
  a.lane === b.lane &&
  a.side === b.side &&
  Math.abs((a.position ?? 0.5) - (b.position ?? 0.5)) < 0.025 &&
  Math.abs(a.born - b.born) < 100;

/** Each recipient keeps its own real amount. Burn is a label, never a second damage debit. */
export function combatNumbers(events: TimedFxEvent[], now: number) {
  const numbers = events.filter(
    (event) =>
      ['damage', 'collision-damage', 'buff', 'mend'].includes(event.type) &&
      event.lane !== undefined &&
      (event.amount ?? 0) > 0 &&
      live(event, now, DAMAGE_READ_MS),
  );
  return numbers.map((event) => {
    const damage = event.type === 'damage' || event.type === 'collision-damage';
    const burn =
      damage &&
      (event.damageKind === 'burn' ||
        events.some(
          (other) => other.type === 'burn' && sameContact(other, event),
        ));
    const ko =
      damage &&
      !!event.targetUnitId &&
      events.some(
        (other) =>
          other.type === 'defeat' &&
          other.targetUnitId === event.targetUnitId &&
          Math.abs(other.born - event.born) < 100,
      );
    const stack = numbers.filter(
      (other) => other.id < event.id && sameContact(other, event),
    ).length;
    return {
      event,
      damage,
      burn,
      ko,
      heavy: damage && (event.amount ?? 0) >= 4,
      text: `${damage ? '−' : '+'}${event.amount}`,
      label: ko
        ? 'K.O.'
        : burn
          ? 'BURN'
          : event.type === 'mend'
            ? 'MEND'
            : !damage
              ? 'BOOST'
              : '',
      left: event.side === 'opponent' ? 68 : 32,
      position: Math.max(
        0,
        Math.min(0.96, (event.position ?? 0.5) + 0.02 + stack * 0.05),
      ),
    };
  });
}

/** One original impact animation at each contact; collision recipients retain separate numbers. */
export function combatContacts(events: TimedFxEvent[], now: number) {
  const result: TimedFxEvent[] = [];
  for (const event of events) {
    if (
      event.lane === undefined ||
      event.position === undefined ||
      !['hit', 'damage'].includes(event.type) ||
      (event.type === 'damage' && !(event.amount && event.amount > 0)) ||
      !live(event, now, 620)
    )
      continue;
    const position = event.position;
    if (
      !result.some(
        (other) =>
          other.lane === event.lane &&
          Math.abs(other.position! - position) < 0.04 &&
          Math.abs(other.born - event.born) < 100,
      )
    )
      result.push(event);
  }
  return result;
}

export function baseImpacts(events: TimedFxEvent[], now: number) {
  return events.filter(
    (event) =>
      event.type === 'breach' &&
      event.lane !== undefined &&
      event.side !== undefined &&
      live(event, now, BASE_IMPACT_MS),
  );
}

/** Keeps the explosion inside the playfield, away from the HUD and the hand. */
export function baseImpactEdge(side: TimedFxEvent['side']) {
  return side === 'player' ? 'top' : 'bottom';
}

/** One permanent smoke marker per breached base/lane, bounded to six for a match. */
export function damagedBaseSmoke(
  existing: TimedFxEvent[],
  incoming: TimedFxEvent[],
) {
  const marks = new Map(
    existing.map((event) => [`${event.side}/${event.lane}`, event]),
  );
  for (const event of incoming) {
    if (
      event.type !== 'breach' ||
      event.lane === undefined ||
      event.side === undefined
    )
      continue;
    const key = `${event.side}/${event.lane}`;
    if (!marks.has(key)) marks.set(key, event);
  }
  return [...marks.values()];
}
