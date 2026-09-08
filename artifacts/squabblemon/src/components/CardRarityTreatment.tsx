import React from 'react';
import {
  CARD_RARITY_DEFINITIONS,
  catalogCardByEngineId,
  catalogCardById,
  type CardRarity,
} from '../data';

export function getCardRarity(cardId: string): CardRarity {
  const card = catalogCardById[cardId] ?? catalogCardByEngineId[cardId];
  if (!card) throw new Error(`Cannot render rarity for unknown card ${cardId}`);
  return card.rarity;
}

export function getRarityClass(rarity: CardRarity): string {
  return `card-rarity card-rarity-${rarity.toLowerCase()}`;
}

export function CardRarityTreatment({ rarity, compact = false }: { rarity: CardRarity; compact?: boolean }) {
  const definition = CARD_RARITY_DEFINITIONS[rarity];
  return (
    <>
      <div className="card-rarity-glow" aria-hidden="true" />
      <span
        className={`card-rarity-label ${compact ? 'card-rarity-label-compact' : ''}`}
        aria-label={definition.accessibilityLabel}
        title={definition.accessibilityLabel}
      >
        <span aria-hidden="true">{definition.cue}</span> {definition.name}
      </span>
    </>
  );
}