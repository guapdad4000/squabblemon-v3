import type { Card } from '../data';
import type { CardInstance } from '../gameEngine';
import { LUIGION_POWERED } from '../../../../lib/squabblemon-engine/src/neighborhoodWave';

export const BUDDY_EARTH_COPY = {
  ability: 'Earth Squabble',
  effect: 'Squabble: Double base Hands and transform from Plant into Earth. For two rounds, friendly Earth characters (including BUDDY) gain +2 Hands and enemies lose 1 Hand. The Earth form remains after those temporary modifiers expire. This form does not plant Buds or provide the normal district discount.',
} as const;

/** Resolve only printed form identity/copy; live stats, status, and timers stay authoritative. */
export function presentCardForm<T extends Card>(card: T): T {
  const instance = card as T & Partial<CardInstance>;
  const copy = instance.cardId === 'buddy' && instance.buddyForm === 'squabble-earth'
    ? BUDDY_EARTH_COPY
    : instance.cardId === 'luigion' && card.id === LUIGION_POWERED.id ? LUIGION_POWERED : null;
  if (!copy || Object.entries(copy).every(([key, value]) => (card as unknown as Record<string, unknown>)[key] === value)) return card;
  return { ...card, ...copy };
}
