const LIST_CONTEXT_PREFIX = 'squabblemon:deck-list-context:v1:';

export interface DeckListContext {
  selectedDeckId: string;
  scrollTop: number;
}

export function deckListContextKey(profileId: string) {
  return `${LIST_CONTEXT_PREFIX}${encodeURIComponent(profileId)}`;
}

export function saveDeckListContext(profileId: string, context: DeckListContext, storage: Storage | null) {
  try {
    storage?.setItem(deckListContextKey(profileId), JSON.stringify(context));
  } catch {
    // Context restoration is optional when session storage is unavailable.
  }
}

export function readDeckListContext(profileId: string, storage: Storage | null): DeckListContext | null {
  try {
    const value = storage?.getItem(deckListContextKey(profileId));
    if (!value) return null;
    const parsed = JSON.parse(value) as Partial<DeckListContext>;
    return typeof parsed.selectedDeckId === 'string' && Number.isFinite(parsed.scrollTop)
      ? { selectedDeckId: parsed.selectedDeckId, scrollTop: Math.max(0, Number(parsed.scrollTop)) }
      : null;
  } catch {
    return null;
  }
}

export function decksPath() {
  return '/game/decks';
}

export function deckEditorPath(deckId: string) {
  return `/game/decks/${encodeURIComponent(deckId)}`;
}

export function deckTestPath(deckId: string) {
  return `${deckEditorPath(deckId)}/test`;
}