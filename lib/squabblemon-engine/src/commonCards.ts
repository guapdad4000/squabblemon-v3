import type { AbilityUpgradeEffect, Card } from './data';

/** Neighborhood Commons: inexpensive bodies and straightforward support effects. */
const definitions = [
  ['youngbull', 'young-bull', 'Young Bull', 'Fire', 2, 2, 'Step Up', 'On Reveal: Gain +1 Hand. If an enemy is here, also apply 1 Burn to the highest-Hands enemy here.', 'Pressure'],
  ['transplant', 'racially-ambiguous-transplant', 'Racially Ambiguous Transplant', 'Air', 1, 1, 'New Here', 'If you have no other cards here, gain +1 Hands.', 'Opener'],
  ['tayaty', 'bad-lil-cousin-tayaty', 'Bad Lil Cousin Tayaty', 'Fire', 1, 1, 'Act Up', 'On Reveal: Echo the last On Reveal ability that resolved this round. Gain +1 Hand.', 'Combo'],
  ['edgar', 'edgar', 'Edgar', 'Normal', 2, 2, 'Gang Check', 'If another friendly card costing 2 or less is here, gain +1 Hands.', 'Pressure'],
  ['nguyen', 'nguyen', 'Nguyen', 'Electric', 2, 2, 'Side Project', 'If you have a friendly card in another district, gain +1 Hands.', 'Tempo'],
  ['manman', 'man-man', 'Man-Man', 'Earth', 3, 3, 'All Hands', 'If at least two other friendly cards are here, gain +2 Hands.', 'Pressure'],
  ['pinaynurse', 'pinay-nurse', 'Pinay Nurse', 'Light', 2, 2, 'Check In', 'Give your lowest-Hands other ally here +2 Hands and cleanse its freeze and silence.', 'Support'],
  ['honestthot', 'honest-thot', 'Honest Thot', 'Air', 1, 2, 'Air Bond', 'Ongoing: While Honest Thot is in your hand, your other Air characters gain +1 Hand at round end.', 'Sustain', 'Air'],
  ['earthy', 'earthy-sugar-foot', 'Earthy Sugar Foot', 'Plant', 1, 1, 'Grounded', 'Give your lowest-Hands other card here +1 Hands.', 'Support'],
  ['abuela', 'abuela', 'Abuela', 'Light', 4, 4, 'Light Bond', 'Ongoing: While Abuela is in your hand, your other Light characters gain +1 Hand at round end.', 'Sustain', 'Light'],
  ['icecream', 'ice-cream-truck', 'Ice Cream Truck', 'Water', 3, 2, 'Water Bond', 'Ongoing: While Ice Cream Truck is in your hand, your other Water characters gain +1 Hand at round end.', 'Sustain', 'Water'],
] as const;

export const neighborhoodCommonIds = definitions.map(([id]) => id);
export const commonUpgradeEffects: Record<string, readonly AbilityUpgradeEffect[]> = Object.fromEntries(
  neighborhoodCommonIds.map(id => [id, [0, 1, 2].map(() => ({ kind: 'self-power' as const, amount: 1 as const, trigger: 'base-success' as const }))]),
);
export const neighborhoodCommons: Record<string, Card> = Object.fromEntries(definitions.map(
  ([engineId, id, name, type, cost, power, ability, effect, role, elementalBond]) => [engineId, {
    id, name, type, cost, power, ability,
    effect: /^(On Reveal|Ongoing):/.test(effect) ? effect : `On Reveal: ${effect}`,
    roles: [role],
    ...(elementalBond ? { elementalBond } : {}),
    abilityUpgrades: [2, 5, 8].map((unlockLevel, index) => ({
      id: `${engineId}:upgrade:${index + 1}`, name: `${ability} ${['Practice', 'Confidence', 'Mastery'][index]}`,
      description: elementalBond
        ? 'While this card is in your hand, one bonded ally gains an additional +1 Hand at round end.'
        : 'After the base ability succeeds, this card gains +1 Hands.',
      unlockLevel, effect: commonUpgradeEffects[engineId][index],
    })),
  }],
));
