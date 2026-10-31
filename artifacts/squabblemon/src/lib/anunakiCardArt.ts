import { getAssetUrl } from './assets';

// Presentation IDs are intentionally local: card artwork is referenced on the
// public shell and must not eagerly load the gameplay catalog. The collectible
// test asserts this list matches the engine roster.
export const ANUNAKI_ARTWORK_IDS = ['nabu', 'enki', 'utu', 'ninhursag', 'inanna', 'yakub', 'enlil', 'ereshkigal', 'caucus-mountaineer', 'anu'] as const;
const ids = new Set<string>(ANUNAKI_ARTWORK_IDS);

/** Character identity, not Normal element, opts the expansion into its scenery. */
export function anunakiCardScene(card: { id?: string; cardId?: string }): string | undefined {
  const id = card.cardId ?? card.id;
  return id && ids.has(id) ? getAssetUrl('assets/card-wallpapers/anunaki-temple.webp') : undefined;
}
