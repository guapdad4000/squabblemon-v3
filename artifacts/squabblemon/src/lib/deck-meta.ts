import { cards, decks, rarityByEngineId, CARD_RARITY_DEFINITIONS, type CardRarity, type Deck } from '@workspace/squabblemon-engine/data';

const RARITY_ORDER: Record<string, number> = {
  SuperCommon: -1,
  Common: 0,
  Uncommon: 1,
  Rare: 2,
  Epic: 3,
  Legendary: 4,
  Mythical: 5,
};

function getCardFileId(engineId: string): string {
  return cards[engineId]?.id ?? engineId;
}

function getCardDisplayName(engineId: string): string {
  return cards[engineId]?.name ?? engineId;
}

function getCardRarityOrder(engineId: string): number {
  const r = (rarityByEngineId as Record<string, string>)[engineId] ?? 'Common';
  return RARITY_ORDER[r] ?? 0;
}

export interface DeckCover {
  /** Engine key of the cover card (e.g. "oink"). */
  engineId: string;
  /** Asset file id used by getCardImage (e.g. "officer-oink"). */
  fileId: string;
  /** Display name (e.g. "Officer Oink"). */
  name: string;
  /** Rarity label (e.g. "Epic"). */
  rarity: string;
  /** Rarity cue (◆ count) from rarityByEngineId. */
  rarityCue: string;
}

/**
 * Naruto-style: the deck's "box art" is its rarest card.
 * Ties resolve to the first card in the deck's pool.
 * Falls back to the deck's hero if the pool is somehow empty.
 */
export function getDeckCover(deck: Deck): DeckCover {
  let bestEngineId = deck.hero;
  let bestScore = -Infinity;
  for (const cardId of deck.cards) {
    const score = getCardRarityOrder(cardId);
    if (score > bestScore) {
      bestScore = score;
      bestEngineId = cardId;
    }
  }
  const rarity = (rarityByEngineId as Record<string, string>)[bestEngineId] ?? 'Common';
  return {
    engineId: bestEngineId,
    fileId: getCardFileId(bestEngineId),
    name: getCardDisplayName(bestEngineId),
    rarity,
    rarityCue: CARD_RARITY_DEFINITIONS[rarity as CardRarity].cue,
  };
}

export type DeckAccent = { color: string; ink: string; name: string };

/**
 * One accent per deck archetype, like Snap's card-frame color treatment.
 * Tweak these to taste — they tint the cover band, the big CTA, and chips.
 */
const ACCENT_BY_DECK: Record<string, DeckAccent> = {
  block: { color: '#d9aa4b', ink: '#0a0a0a', name: 'gold' },      // Turf Control
  slide: { color: '#38bdf8', ink: '#0a0a0a', name: 'cyan' },      // Movement
  combo: { color: '#a855f7', ink: '#ffffff', name: 'violet' },     // Combo
  receipts: { color: '#f97316', ink: '#0a0a0a', name: 'orange' }, // Disruption
  crashout: { color: '#ef4444', ink: '#ffffff', name: 'crimson' },// Comeback
  vibes: { color: '#22c55e', ink: '#0a0a0a', name: 'green' },     // Sustain
  compound: { color: '#14b8a6', ink: '#0a0a0a', name: 'teal' },   // Growth
};

export function getDeckAccent(deckId: string): DeckAccent {
  return ACCENT_BY_DECK[deckId] ?? ACCENT_BY_DECK.block;
}

/** Built-in "default" deck the player falls back to when nothing is selected. */
export const DEFAULT_DECK_ID = 'block';

export function getDefaultDeck(): Deck {
  return decks.find((deck) => deck.id === DEFAULT_DECK_ID) ?? decks[0];
}
