import type { AbilityUpgradeEffect, Card, CardRarity } from './data';

// Standalone City Legends keep the first block expansion's 10/5/5 rarity split intact.
export const MYTHIC_LEGENDS = [
  ['dragonflyjones', 'dragonfly-jones', 'Dragonfly Jones', 'Air', 2, 3, 'Secret Technique', 'Target the enemy here with the most removable bonus Hands, otherwise the highest-cost enemy costing 4 or more, otherwise the strongest enemy. Hit it for 4 if it has bonus Hands or costs 4 or more; otherwise hit it for 2. Gain +1 Hand only if damage lands.', 'Disruption'],
  ['shonuff', 'sho-nuff', "Sho'Nuff", 'Dark', 3, 4, "Who's the Master?", 'Confiscate up to 5 removable bonus Hands from the enemy here with the most bonus Hands and gain the amount actually taken. If no enemy has bonus Hands, hit the strongest enemy here for 3. Confiscation never takes printed Hands or creates healing credit. Protection and immunity apply.', 'Disruption'],
  ['yasuke', 'yasuke', 'Yasuke', 'Light', 2, 4, 'Black Blade', 'Give your weakest unprotected other ally here +2 Hands and Protection, then hit the strongest enemy here for 2. Protection and immunity apply to the hit.', 'Support'],
  ['mansamusa', 'mansa-musa', 'Mansa Musa', 'Earth', 4, 4, 'Gold Road', 'Give your weakest other friendly character in each district +1 Hand, or +2 if that ally is Earth. Your next card in another district costs 1 less Motion.', 'Support'],
  ['tron', 'tron', 'TRON', 'Electric', 3, 2, 'For the Hood', 'Give up to three lowest-Hands other friendly characters here +1 Hands each. If all three gained Hands, restore 1 Motion.', 'Support'],
  ['johnhenry', 'john-henry', 'John Henry', 'Earth', 5, 6, 'Steel Driver', 'Gain +1 Hand for each other friendly Earth character across the board, up to +4. If at least two are here, give the strongest enemy here -2 Hands.', 'Pressure'],
  ['ashlee', 'ashlee', 'Ashlee', 'Plant', 5, 3, 'Jet Set', 'Drop Guyana the gorilla (+4, uncounterable) into your weakest friendly district. Give every other friendly character in Ashlee\'s district +1 Hand. Give the highest-Hands enemy on the board -1 Hand. If Plant allies occupy at least two districts, give your lowest-Hands Plant ally in each occupied district +2 Hands.', 'Pressure'],
  ['captainjigga', 'captain-jigga', 'Captain Jigga', 'Air', 5, 4, 'Cabin Gang', 'Send two 2-Hand Stewards here. Each targets a different highest-Hands enemy for -2 Hands and gives your lowest-Hands other Air character here +1 Hand.', 'Disruption'],
  ['counter', 'counter', 'Shotta', 'Dark', 3, 3, 'Wheel & Come Again', 'Hit the strongest enemy here for 2. Ongoing: After you play another character in a different district, fire 1 at its strongest enemy. Two encores per match, at most one per round.', 'Disruption'],
] as const;

export const mythicLegendRarities: Record<string, CardRarity> = Object.fromEntries(
  MYTHIC_LEGENDS.map(([id]) => [id, 'Mythical']),
);

export const mythicLegendUpgradeEffects: Record<string, readonly AbilityUpgradeEffect[]> = Object.fromEntries(
  MYTHIC_LEGENDS.map(([id]) => [id, id === 'ashlee'
    ? [{ kind: 'self-power' as const, amount: 1 as const, trigger: 'base-success' as const }, { kind: 'target-power' as const, amount: 1 as const, target: 'friendly' as const, trigger: 'base-success' as const }, { kind: 'self-power' as const, amount: 1 as const, trigger: 'base-success' as const }]
    : id === 'captainjigga'
      ? [{ kind: 'self-power' as const, amount: 1 as const, trigger: 'base-success' as const }, { kind: 'target-power' as const, amount: -1 as const, target: 'enemy' as const, trigger: 'base-success' as const }, { kind: 'self-power' as const, amount: 1 as const, trigger: 'base-success' as const }]
      : [0, 1, 2].map(() => ({ kind: 'self-power' as const, amount: 1 as const, trigger: 'base-success' as const }))]),
);

export const mythicLegendCards: Record<string, Card> = Object.fromEntries(MYTHIC_LEGENDS.map(
  ([engineId, id, name, type, cost, power, ability, effect, role]) => [engineId, {
    id, name, type, cost, power, ability, effect: `On Reveal: ${effect}`, kind: 'character', roles: [role],
    ...(engineId === 'captainjigga' ? { artworkLayout: 'portrait' as const } : {}),
    abilityUpgrades: [2, 5, 8].map((unlockLevel, index) => ({
      id: `${engineId}:upgrade:${index + 1}`, name: `${ability} ${['Practice', 'Confidence', 'Mastery'][index]}`,
      description: engineId === 'counter' ? 'Once per match, after a successful shot, gain +1 Hand.' : mythicLegendUpgradeEffects[engineId][index].kind === 'target-power'
        ? mythicLegendUpgradeEffects[engineId][index].target === 'friendly'
          ? 'After the base ability succeeds, one affected ally gains +1 Hand.'
          : 'After the base ability succeeds, one affected enemy loses 1 Hand.'
        : ['dragonflyjones', 'shonuff', 'yasuke'].includes(engineId)
          ? 'Once per match, after the base ability succeeds, this card gains +1 Hand.'
          : 'After the base ability succeeds, this card gains +1 Hand.',
      unlockLevel, effect: mythicLegendUpgradeEffects[engineId][index],
    })),
  }],
));
