import React from 'react';
import { SUMMON_ARTWORK } from '@workspace/squabblemon-engine/battleArtwork';
import { getCardArtworkId, getCardImage } from '../lib/assets';
import { cards } from '../data';
import { getEffectiveCardPower, type CardInstance, type Match } from '../gameEngine';
import './summon-details.css';

export function SummonDetails({ card, match }: { card: CardInstance; match?: Match }) {
  const identity = card.cardId ?? card.id;
  const originId = card.buddyBud?.sourceInstanceId ?? card.smileBomb?.sourceInstanceId;
  const origin = match?.boards.flat().find(c => c.instanceId === originId);
  const sourceEvent = match?.effectLog?.find(e => e.targets.some(t => t.cardInstanceId === card.instanceId && !t.before && t.after));
  const creator = origin?.name ?? cards[card.deck?.replace(/^summon:/, '') ?? '']?.name
    ?? (sourceEvent ? cards[sourceEvent.cardId]?.name : undefined) ?? SUMMON_ARTWORK[identity]?.creator;
  const due = card.buddyBud?.sproutsAtRound ?? card.smileBomb?.detonatesAtRound;
  const remaining = due !== undefined && match ? Math.max(0, due - match.round) : null;
  const duration = card.buddyBud?.sprouted ? 'Sprouted · no target'
    : due !== undefined ? `${card.buddyBud ? 'Sprouts' : 'Explodes'} ${remaining === 0 ? 'this round' : remaining !== null ? `in ${remaining} round${remaining === 1 ? '' : 's'}` : `in round ${due}`}`
    : identity === 'burnt-plate' ? 'Clears at round end' : 'Until removed';
  const statuses = Object.entries(card.statuses ?? {}).filter(([, value]) => Boolean(value)).map(([name, value]) => `${name.replace(/([A-Z])/g, ' $1').toLowerCase()}${typeof value === 'number' ? ` ×${value}` : ''}`);
  return <article className="summon-details" data-testid="summon-details" onClick={event => event.stopPropagation()}>
    <div className="summon-details__portrait"><img className="collector-portrait--inspector" src={getCardImage(getCardArtworkId(card))} alt={card.name}/></div>
    <div className="summon-details__copy">
      <p className="summon-details__eyebrow">{card.owner === 'cpu' ? 'The Opps’ summon' : 'Your summon'}</p>
      <h2>{card.name}</h2>{creator && <p className="summon-details__creator">Created by {creator}</p>}
      <dl><div><dt>Lane Hands</dt><dd>{card.hazard ? 0 : getEffectiveCardPower(card)}</dd></div><div><dt>Duration</dt><dd>{duration}</dd></div></dl>
      <h3>{card.ability}</h3><p>{card.effect}</p>
      {card.hazard && <p className="summon-details__note">Adds no lane Hands.</p>}
      {statuses.length > 0 && <p className="summon-details__note">{statuses.join(' · ')}</p>}
    </div>
  </article>;
}
