/** Playing a card leaves its slot free; the next draw fills a free slot without moving held cards. */
export function reconcileHandSlots(
  previous: ReadonlyArray<string | null>,
  hand: readonly string[],
): Array<string | null> {
  const remaining = new Set(hand);
  const slots = Array.from({ length: 4 }, (_, slot) => {
    const id = previous[slot];
    if (!id || !remaining.delete(id)) return null;
    return id;
  });
  for (const id of hand) {
    if (!remaining.has(id)) continue;
    const slot = slots.indexOf(null);
    if (slot < 0) break;
    slots[slot] = id;
    remaining.delete(id);
  }
  return slots;
}
import type { PlayerState } from '@workspace/squabblemon-engine/breakthrough';

/** A waiting fighter keeps its original slot until entry or cancellation. */
export function handOccupants(player: PlayerState): string[] {
  return [
    ...player.hand,
    ...(player.reinforcements ?? []).map((r) => r.cardId),
  ];
}
