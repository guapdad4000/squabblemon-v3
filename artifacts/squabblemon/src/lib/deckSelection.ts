import { useCallback, useEffect, useMemo, useState } from 'react';

const SELECTION_EVENT = 'squabblemon:deck-selection';
const STORAGE_PREFIX = 'squabblemon:last-deck:v1:';

export interface DeckSelectionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function deckSelectionStorageKey(profileId: string) {
  return `${STORAGE_PREFIX}${encodeURIComponent(profileId)}`;
}

export function resolveDeckSelection(
  profileId: string,
  availableDeckIds: readonly string[],
  preferredId?: string | null,
  storage?: DeckSelectionStorage | null,
) {
  if (preferredId && availableDeckIds.includes(preferredId)) return preferredId;
  try {
    const saved = storage?.getItem(deckSelectionStorageKey(profileId));
    if (saved && availableDeckIds.includes(saved)) return saved;
  } catch {
    // Selection persistence is optional when storage is unavailable.
  }
  return availableDeckIds[0] ?? '';
}

export function persistDeckSelection(
  profileId: string,
  deckId: string,
  availableDeckIds: readonly string[],
  storage?: DeckSelectionStorage | null,
) {
  if (!deckId || !availableDeckIds.includes(deckId)) return false;
  try {
    const key = deckSelectionStorageKey(profileId);
    if (storage?.getItem(key) === deckId) return true;
    storage?.setItem(key, deckId);
    if (typeof window !== 'undefined' && storage === getDeckSelectionStorage()) {
      window.dispatchEvent(new CustomEvent(SELECTION_EVENT, { detail: { profileId, deckId } }));
    }
    return true;
  } catch {
    return false;
  }
}

export const getDeckSelectionStorage = () => {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
};

export function usePersistentDeckSelection(
  profileId: string,
  availableDeckIds: readonly string[],
  preferredId?: string | null,
) {
  const signature = availableDeckIds.join('\u001f');
  const ids = useMemo(() => [...availableDeckIds], [signature]);
  const [selection, setSelection] = useState(() => ({
    profileId,
    id: resolveDeckSelection(profileId, ids, preferredId, getDeckSelectionStorage()),
  }));
  const resolvedId = selection.profileId === profileId && ids.includes(selection.id)
    ? selection.id
    : resolveDeckSelection(profileId, ids, preferredId, getDeckSelectionStorage());

  useEffect(() => {
    if (selection.profileId !== profileId || selection.id !== resolvedId) {
      setSelection({ profileId, id: resolvedId });
    }
  }, [ids, profileId, resolvedId, selection]);

  useEffect(() => {
    const update = (deckId: string | null) => {
      if (!deckId || !ids.includes(deckId)) return;
      setSelection(previous => previous.profileId === profileId && previous.id === deckId ? previous : { profileId, id: deckId });
    };
    const local = (event: Event) => { const detail = (event as CustomEvent<{ profileId: string; deckId: string }>).detail; if (detail?.profileId === profileId) update(detail.deckId); };
    const remote = (event: StorageEvent) => { if (event.key === deckSelectionStorageKey(profileId)) update(event.newValue); };
    window.addEventListener(SELECTION_EVENT, local);
    window.addEventListener('storage', remote);
    return () => { window.removeEventListener(SELECTION_EVENT, local); window.removeEventListener('storage', remote); };
  }, [ids, profileId]);

  const selectDeck = useCallback((deckId: string) => {
    if (!ids.includes(deckId)) return;
    setSelection({ profileId, id: deckId });
    persistDeckSelection(profileId, deckId, ids, getDeckSelectionStorage());
  }, [ids, profileId]);

  return [resolvedId, selectDeck] as const;
}