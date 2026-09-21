import React from 'react';
import { getEquippedVariant, getVariantKind } from './CardVariantTreatment';
import { getCardImage } from '../data';
import { getEffectiveCardPower, type Match } from '../gameEngine';

export function BattleVictory({
  match,
  winner,
  equippedVariants,
}: {
  equippedVariants?: Record<string, string>;
  match: Match;
  winner: 'player' | 'cpu' | 'draw' | null;
}) {
  if (!winner || winner === 'draw') return null;
  const crew = match.boards
    .flat()
    .filter((card) => card.owner === winner)
    .sort((a, b) => getEffectiveCardPower(b) - getEffectiveCardPower(a))
    .slice(0, 3);
  if (!crew.length) return null;
  return (
    <section className={`winning-crew winning-crew--${winner}`} aria-label="Winning gang" data-testid="winning-crew">
      <div className="winning-crew__light" aria-hidden="true" />
      {crew.map((card, index) => (
        <figure key={card.instanceId} style={{ '--crew-delay': `${index * 100}ms` } as React.CSSProperties}>
          <img
            className={`variant-portrait-${winner === 'player' ? (getVariantKind(getEquippedVariant(equippedVariants, card.id)) ?? 'base') : 'base'}`}
            src={getCardImage(card.id, winner === 'player' ? getEquippedVariant(equippedVariants, card.id) : undefined)}
            alt={card.name}
          />
          <figcaption>
            {card.name}
            <span>
              {index === 0 ? 'Top Hands' : 'Winning gang'} · {getEffectiveCardPower(card)}
            </span>
          </figcaption>
        </figure>
      ))}
    </section>
  );
}
