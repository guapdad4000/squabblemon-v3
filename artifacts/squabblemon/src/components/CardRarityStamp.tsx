import React from 'react';
import { CARD_RARITY_DEFINITIONS, type CardRarity } from '../data';
import '../styles/card-rarity-stamp.css';

/** Full rarity names read as collectible tiers, never letter grades on a fighter. */
export function CardRarityStamp({rarity, compact = false}: {rarity: CardRarity; compact?: boolean}) {
  const label = CARD_RARITY_DEFINITIONS[rarity].label;
  return <span className="rarity-stamp" data-rarity={rarity} data-compact={compact || undefined}
    role="img" aria-label={`${label} rarity`} title={`${label} rarity`}>
    <span className="rarity-stamp__label" aria-hidden="true">{label}</span>
  </span>;
}
