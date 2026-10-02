import type { AbilityUpgradeEffect, Card, CardRarity } from './data';

/** Side-Oz collection identities are stable even when portrait art changes. */
export const SIDE_OZ_WAVE = [
  ['redside1', 'red-side-1', 'Red Plaid Petey', 'Common', 'Fire', 1, 2, 'Take the Shortcut', 'On Reveal: Move to your weakest other open district. If you move, gain +1 Hand. Your next Red Side card costs 1 less Motion.', 'Movement', 'Red Side'],
  ['redside2', 'red-side-2', 'OG Red Night', 'Legendary', 'Fire', 2, 3, 'Eyes on the Crossing', 'On Reveal and at the start of the next two rounds: Steal 1 Hand from the strongest enemy here and gain it. If no enemy is here, take 1 Hand from your strongest other ally here with at least 2 Hands, if possible. One attempt per round, maximum three turns. Protection and immunity can block enemy steals.', 'Disruption', 'Red Side'],
  ['redside3', 'red-side-3', 'Red Robber', 'Epic', 'Earth', 2, 3, 'Check In', 'On Reveal: Deal 1 damage to the strongest enemy here. 50% chance to summon one Red Robber in a random other open district; it deals 1 damage there but cannot summon again.', 'Disruption', 'Red Side'],
  ['redside4', 'red-side-4', 'Red Hexer', 'Rare', 'Dark', 3, 4, 'Bad Omen', 'On Reveal: Weaken the strongest enemy here. Protection can block the status.', 'Disruption', 'Red Side'],
  ['redside5', 'red-side-5', 'Ruby Shades', 'Epic', 'Light', 3, 4, 'Raise the Colors', 'On Reveal: Give your weakest other ally anywhere +2 Hands. If you have no other ally, gain +1 Hand and Weaken the strongest enemy here.', 'Growth', 'Red Side'],
  ['blueside1', 'blue-side-1', 'OG Blue', 'Legendary', 'Water', 1, 2, 'Crossfire', 'On Reveal: Deal 3 damage to the strongest enemy in another district. Gain +1 Hand for each friendly Blue Side card on the board, including this one, plus +1 for each other district containing a friendly Blue Set card (up to +2 extra). This card cannot lose Hands.', 'Disruption', 'Blue Side'],
  ['blueside2', 'blue-side-2', 'lil Blue', 'Uncommon', 'Earth', 1, 2, 'Stand Behind Me', 'On Reveal: Gain +1 Hand. The next ally you deploy gains Protection.', 'Support', 'Blue Side'],
  ['blueside3', 'blue-side-3', 'Blue Scarf crashout', 'Epic', 'Air', 2, 3, 'Clear the Route', 'On Reveal and each new round: Move your weakest other ally in each district one district over. Each turn, a 50/50 roll either gives moved allies +1 Hand or steals 1 Hand from an enemy for each moved ally.', 'Movement', 'Blue Side'],
  ['blueside4', 'blue-side-4', 'Blue loco', 'Epic', 'Water', 3, 4, 'Steady Nerves', 'On Reveal: Cleanse Freeze and Silence from your weakest affected ally here and give it +2 Hands. Otherwise, Protect your weakest unprotected ally here and gain +1 Hand.', 'Support', 'Blue Side'],
  ['blueside5', 'blue-side-5', 'Blue Big Trippin', 'Epic', 'Electric', 3, 4, 'Measured Strike', 'On Reveal: Weaken the strongest enemy here. If it lands, gain +1 Hand. When destroyed, your next deployed card gains +1 Hand.', 'Disruption', 'Blue Side'],
  ['wickedwitch', 'wicked-witch', 'Wicked Witch', 'Legendary', 'Dark', 4, 5, 'Voice of the West', 'On Reveal: Deal 2 damage to each enemy with bonus Hands here; gain +1 Hand for each affected enemy. Summon one Flying Monkeys here if there is space.', 'Disruption', 'The Wiz'],
  ['flyingmonkeys', 'flying-monkeys', 'Flying Monkeys', 'Legendary', 'Air', 4, 5, 'Snatch and Scatter', 'On Reveal: Move the weakest enemy here to their weakest other open district and give it 1 Burn. Protection, movement locks, and a full district can stop the move.', 'Movement', 'The Wiz'],
] as const;

export const sideOzWaveUpgradeEffects: Record<string, readonly AbilityUpgradeEffect[]> = Object.fromEntries(
  SIDE_OZ_WAVE.map(([engineId]) => [engineId, [0, 1, 2].map(() => ({
    kind: 'self-power' as const, amount: 1 as const, trigger: 'base-success' as const,
  }))]),
);
export const sideOzWaveRarities: Record<string, CardRarity> = Object.fromEntries(
  SIDE_OZ_WAVE.map(([engineId, , , rarity]) => [engineId, rarity]),
);
export const sideOzWaveFactions: Record<string, string> = Object.fromEntries(
  SIDE_OZ_WAVE.map(([engineId, , , , , , , , , , faction]) => [engineId, faction]),
);
export const sideOzWaveCards: Record<string, Card> = Object.fromEntries(
  SIDE_OZ_WAVE.map(([engineId, id, name, , type, cost, power, ability, effect, role]) => [engineId, {
    id, name, type, cost, power, ability, effect, kind: 'character', roles: [role],
    abilityUpgrades: [2, 5, 8].map((unlockLevel, index) => ({
      id: `${engineId}:upgrade:${index + 1}`,
      name: `${ability} ${['Practice', 'Confidence', 'Mastery'][index]}`,
      description: `After ${ability} succeeds, this card gains +1 Hand (once per match).`,
      unlockLevel,
      effect: sideOzWaveUpgradeEffects[engineId][index],
    })),
  }]),
);