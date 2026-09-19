import type { AbilityUpgradeEffect, Card, CardRarity } from './data';

// The first friends-beta expansion. Every character has an explicit rarity,
// a bounded reveal effect, and the same three-tier training budget.
export const BLOCK_EXPANSION = [
  ['bodegacat', 'bodega-cat', 'Bodega Cat', 'Common', 'Normal', 1, 1, 'Counter Claim', 'If you have no other friendly cards here, gain +1 Hands.', 'Opener'],
  ['crossingguard', 'crossing-guard', 'Crossing Guard', 'Common', 'Light', 2, 2, 'Safe Crossing', 'Protect your lowest-Hands other ally here from one targeted hostile ability.', 'Support'],
  ['laundry', 'laundromat-regular', 'Laundromat Regular', 'Common', 'Water', 2, 2, 'Fresh Cycle', 'Cleanse your lowest-Hands frozen or silenced ally here. If cleansed, give it +1 Hands.', 'Support'],
  ['busker', 'corner-busker', 'Corner Busker', 'Common', 'Air', 2, 1, 'Loose Change', 'Give each of your other 1-Cost cards here +1 Hands.', 'Support'],
  ['cornercoach', 'corner-coach', 'Corner Coach', 'Common', 'Fire', 3, 3, 'Run It Back', 'Give your lowest-Hands other ally here +2 Hands.', 'Support'],
  ['nightcashier', 'night-cashier', 'Night Cashier', 'Common', 'Electric', 2, 2, 'Late Shift', 'On round 4 or later, restore 1 Motion.', 'Tempo'],
  ['dogwalker', 'dog-walker', 'Dog Walker', 'Common', 'Normal', 2, 2, 'Walk the Pack', 'If at least two other friendly cards are here, gain +2 Hands.', 'Pressure'],
  ['mural', 'mural-apprentice', 'Mural Apprentice', 'Common', 'Poison', 2, 2, 'Fresh Color', 'If another friendly card with a different type is here, give the highest-Hands enemy here -1 Hands. If no enemy is here, gain +1 Hands instead.', 'Disruption'],
  ['chessregular', 'chess-regular', 'Chess Regular', 'Common', 'Dark', 3, 3, 'Quiet Fork', 'If exactly one enemy is here, give it -2 Hands.', 'Disruption'],
  ['gardener', 'rooftop-gardener', 'Rooftop Gardener', 'Common', 'Plant', 1, 1, 'Neighborhood Roots', 'If you have a friendly card in another district, gain +1 Hands.', 'Tempo'],
  ['piratedj', 'pirate-radio-dj', 'Pirate Radio DJ', 'Rare', 'Electric', 3, 2, 'Citywide Signal', 'Give your lowest-Hands friendly card in each other district +1 Hands.', 'Support'],
  ['dancecaptain', 'dance-circle-captain', 'Dance Circle Captain', 'Rare', 'Fire', 3, 3, 'Whole Block Moving', 'If you have a friendly card in all three districts, gain +3 Hands.', 'Pressure'],
  ['nightmedic', 'night-shift-medic', 'Night Shift Medic', 'Rare', 'Light', 3, 4, 'All Clear', 'Cleanse freeze and silence from every other friendly card here.', 'Support'],
  ['subwaymagician', 'subway-magician', 'Subway Magician', 'Rare', 'Dark', 4, 3, 'Now You See Me', 'Silence the highest-Hands enemy here, then move to your weakest other district.', 'Movement'],
  ['ogdominican', 'og-dominican', 'OG Dominican', 'Rare', 'Air', 3, 3, 'Block Shortcut', 'Move to your weakest other district. If moved, gain +2 Hands.', 'Movement'],
  ['conductor', 'last-train-conductor', 'Last Train Conductor', 'Mythical', 'Water', 4, 3, 'Last Stop', 'Move your lowest-Hands other ally here to your weakest other district. If moved, give it +3 Hands.', 'Movement'],
  ['midnightmayor', 'midnight-mayor', 'Midnight Mayor', 'Mythical', 'Dark', 3, 2, 'Keys to the City', 'Gain +1 Hands for each different friendly card type here, up to +3.', 'Pressure'],
  ['bigzoey', 'big-zoey', 'Big Zoey', 'Legendary', 'Earth', 3, 2, 'Hold the Block', 'Give your lowest-Hands other ally here +2 Hands and the lowest-Hands enemy here -2 Hands.', 'Disruption'],
  ['leroy', 'leroy', 'Leroy', 'Mythical', 'Light', 5, 5, 'Golden Glow', 'If your board has at least three different friendly card types, gain +1 Hands and give the highest-Hands enemy here -3 Hands.', 'Disruption'],
  ['partytitan', 'block-party-titan', 'Block Party Titan', 'Mythical', 'Earth', 6, 7, 'Everybody Outside', 'Give your lowest-Hands other friendly card in each district +1 Hands.', 'Support'],
] as const;

export const expansionUpgradeEffects: Record<string, readonly AbilityUpgradeEffect[]> = Object.fromEntries(
  BLOCK_EXPANSION.map(([id]) => [id, [0, 1, 2].map(() => ({kind: 'self-power' as const, amount: 1 as const, trigger: 'base-success' as const}))]),
);
export const expansionRarities: Record<string, CardRarity> = Object.fromEntries(BLOCK_EXPANSION.map(([id, , , rarity]) => [id, rarity]));
export const expansionCards: Record<string, Card> = Object.fromEntries(BLOCK_EXPANSION.map(
  ([engineId, id, name, , type, cost, power, ability, effect, role]) => [engineId, {
    id, name, type, cost, power, ability, effect: `On Reveal: ${effect}`, kind: 'character', roles: [role],
    abilityUpgrades: [2, 5, 8].map((unlockLevel, index) => ({
      id: `${engineId}:upgrade:${index + 1}`, name: `${ability} ${['Practice', 'Confidence', 'Mastery'][index]}`,
      description: 'After the base ability succeeds, this card gains +1 Hands.',
      unlockLevel, effect: expansionUpgradeEffects[engineId][index],
    })),
  }],
));
