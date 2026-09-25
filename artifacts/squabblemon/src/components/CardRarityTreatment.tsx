import React from 'react';
import {
  CARD_RARITY_DEFINITIONS,
  catalogCardByEngineId,
  catalogCardById,
  type CardRarity,
} from '../data';

export function getCardRarity(cardId: string, kind?: 'character' | 'support' | 'token' | 'blockbuster'): CardRarity {
  // Summons are board-only cards, so they have no collectible catalog entry.
  if (kind === 'token') return cardId === 'smile-bomb' ? 'Common' : 'Mythical';
  const card = catalogCardById[cardId] ?? catalogCardByEngineId[cardId];
  if (!card) throw new Error(`Cannot render rarity for unknown card ${cardId}`);
  return card.rarity;
}

export function getRarityClass(rarity: CardRarity): string {
  return `card-rarity card-rarity-${rarity.toLowerCase()}`;
}

export function CardRarityTreatment({ rarity, compact = false }: { rarity: CardRarity; compact?: boolean }) {
  return (
    <div className="card-rarity-glow" aria-hidden="true" />
  );
}
