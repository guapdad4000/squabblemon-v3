/** Prepare artwork ahead of the scroll position without retaining every card face. */
export const COLLECTION_CARD_VIEWPORT_BUFFER = 640;

export type CollectionCardVisibility = { cardId: string; visible: boolean };

/** Batch observer entries into one update, including removals when a card leaves. */
export function updateCollectionCardViewport(
  current: ReadonlySet<string>,
  entries: readonly CollectionCardVisibility[],
): ReadonlySet<string> {
  let next: Set<string> | undefined;
  for (const { cardId, visible } of entries) {
    if (!cardId || (next ?? current).has(cardId) === visible) continue;
    next ??= new Set(current);
    if (visible) next.add(cardId);
    else next.delete(cardId);
  }
  return next ?? current;
}
