import React from 'react';
import { getMatchDistricts, getDistrictCardBonusForMatch, getDistrictSharedBonus, getEffectiveCardPower, getStoryLaneBonus, type CardInstance, type Match } from '../gameEngine';

export function BattlePowerBreakdown({ card, match }: { card: CardInstance; match: Match }) {
  const inPlay = card.lane !== null;
  const district = inPlay ? getDistrictCardBonusForMatch(match, card, card.lane!) : 0;
  const raw = card.basePower + card.powerModifier;
  const effective = getEffectiveCardPower(card);
  const suppression = effective - raw;
  const shared = inPlay ? getStoryLaneBonus(match, card.owner, card.lane!) + getDistrictSharedBonus(match, card.owner, card.lane!) : 0;
  return <section className="battle-power-breakdown" data-testid="battle-power-breakdown" aria-label="Current battle Hands">
    <header>{card.owner === 'player' ? 'Your' : 'Rival'} character · {inPlay ? getMatchDistricts(match)[card.lane!].name : 'In hand'}</header>
    <dl><div><dt>Base Hands</dt><dd>{card.basePower}</dd></div><div><dt>Buffs / penalties</dt><dd>{card.powerModifier > 0 ? '+' : ''}{card.powerModifier}</dd></div>
      {suppression !== 0 && <div><dt>{card.statuses.frozen ? 'Frozen suppression' : 'Minimum Hands adjustment'}</dt><dd>{suppression > 0 ? '+' : ''}{suppression}</dd></div>}
      <div><dt>Current card Hands</dt><dd>{effective}</dd></div><div><dt>District bonus / penalty</dt><dd>{district > 0 ? '+' : ''}{district}</dd></div><div className="power-total"><dt>Contribution to district</dt><dd>{inPlay ? effective + district : 'Not deployed'}</dd></div></dl>
    {shared !== 0 && <p>District-wide rule: {shared > 0 ? '+' : ''}{shared}. Applied once to the lane, not to each card.</p>}
    {match.districtRuntime?.detainedCardIds.includes(card.instanceId) && <p>COUNTY JAIL: held here for the rest of the match. This card cannot move.</p>}
    {match.timedEffects.some(effect => effect.kind === 'salon-protection' && effect.targetInstanceId === card.instanceId) && <p>NAIL SALON: blocks this card’s next targeted enemy ability. Protection follows it when it moves.</p>}
    {card.lastEffectNote && <p>{card.lastEffectNote}</p>}
  </section>;
}
