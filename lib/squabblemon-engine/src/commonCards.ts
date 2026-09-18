import type { AbilityUpgradeEffect, Card } from './data';

/** Neighborhood Commons: inexpensive bodies and straightforward support effects. */
const definitions = [
  ['youngbull', 'young-bull', 'Young Bull', 'Fire', 2, 3, 'Step Up', 'If an enemy is here, gain +1 Hands.', 'Pressure'],
  ['transplant', 'racially-ambiguous-transplant', 'Racially Ambiguous Transplant', 'Air', 1, 1, 'New Here', 'If you have no other cards here, gain +1 Hands.', 'Opener'],
  ['tayaty', 'bad-lil-cousin-tayaty', 'Bad Lil Cousin Tayaty', 'Fire', 1, 1, 'Act Up', 'Give the lowest-Hands enemy here -1 Hands.', 'Disruption'],
  ['edgar', 'edgar', 'Edgar', 'Normal', 2, 2, 'Crew Check', 'If another friendly card costing 2 or less is here, gain +1 Hands.', 'Pressure'],
  ['nguyen', 'nguyen', 'Nguyen', 'Electric', 2, 2, 'Side Project', 'If you have a friendly card in another district, gain +1 Hands.', 'Tempo'],
  ['manman', 'man-man', 'Man-Man', 'Earth', 3, 3, 'All Hands', 'If at least two other friendly cards are here, gain +2 Hands.', 'Pressure'],
  ['pinaynurse', 'pinay-nurse', 'Pinay Nurse', 'Light', 2, 2, 'Check In', 'Give your lowest-Hands other ally here +1 Hands and cleanse its freeze and silence.', 'Support'],
  ['honestthot', 'honest-thot', 'Honest Thot', 'Air', 2, 1, 'Real Talk', 'Silence the lowest-Hands enemy here.', 'Disruption'],
  ['earthy', 'earthy-sugar-foot', 'Earthy Sugar Foot', 'Plant', 1, 1, 'Grounded', 'Give your lowest-Hands other card here +1 Hands.', 'Support'],
  ['abuela', 'abuela', 'Abuela', 'Light', 4, 4, 'Eat Something', 'Give your lowest-Hands other card here +2 Hands.', 'Support'],
  ['icecream', 'ice-cream-truck', 'Ice Cream Truck', 'Water', 3, 2, 'Treat the Block', 'Give every other friendly card here +1 Hands.', 'Support'],
] as const;

export const neighborhoodCommonIds = definitions.map(([id]) => id);
export const commonUpgradeEffects: Record<string, readonly AbilityUpgradeEffect[]> = Object.fromEntries(
  neighborhoodCommonIds.map(id => [id, [0, 1, 2].map(() => ({ kind: 'self-power' as const, amount: 1 as const, trigger: 'base-success' as const }))]),
);
export const neighborhoodCommons: Record<string, Card> = Object.fromEntries(definitions.map(
  ([engineId, id, name, type, cost, power, ability, effect, role]) => [engineId, {
    id, name, type, cost, power, ability, effect: `On Reveal: ${effect}`, roles: [role],
    abilityUpgrades: [2, 5, 8].map((unlockLevel, index) => ({
      id: `${engineId}:upgrade:${index + 1}`, name: `${ability} ${['Practice', 'Confidence', 'Mastery'][index]}`,
      description: 'After the base ability succeeds, this card gains +1 Hands.',
      unlockLevel, effect: commonUpgradeEffects[engineId][index],
    })),
  }],
));
