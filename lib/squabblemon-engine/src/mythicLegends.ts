import type { AbilityUpgradeEffect, Card, CardRarity } from './data';

// Standalone City Legends keep the first block expansion's 10/5/5 rarity split intact.
export const MYTHIC_LEGENDS = [
  ['dragonflyjones', 'dragonfly-jones', 'Dragonfly Jones', 'Air', 2, 3, 'Secret Technique', 'If an enemy here costs 4 or more, give the highest-cost enemy -2 Hands and gain +1 Hands. Otherwise gain +1 Hands.', 'Disruption'],
  ['shonuff', 'sho-nuff', "Sho'Nuff", 'Dark', 3, 4, "Who's the Master?", 'Take up to 2 bonus Hands from the enemy here with the most bonus Hands. If no enemy has bonus Hands, give the highest-Hands enemy here -1 Hands instead.', 'Disruption'],
  ['yasuke', 'yasuke', 'Yasuke', 'Light', 2, 4, 'Black Blade', 'Protect your lowest-Hands unprotected other ally here from one targeted hostile ability. Give the highest-Hands enemy here -1 Hands.', 'Support'],
  ['mansamusa', 'mansa-musa', 'Mansa Musa', 'Earth', 5, 5, 'Gold Road', 'Give your lowest-Hands other ally in each district +1 Hands. Your next card in another district costs 1 less Motion.', 'Support'],
  ['tron', 'tron', 'TRON', 'Electric', 3, 3, 'For the Hood', 'Give up to three lowest-Hands other friendly characters here +1 Hands each. If at least two gained Hands, restore 1 Motion.', 'Support'],
  ['johnhenry', 'john-henry', 'John Henry', 'Rock', 5, 5, 'Steel Driver', 'Gain +1 Hands for each other friendly character here, up to +3. If at least two are here, give the highest-Hands enemy -1 Hands.', 'Pressure'],
  ['ashlee', 'ashlee', 'Ashlee', 'Air', 5, 3, 'Jet Set', 'Drop Guyana the gorilla (+4, uncounterable) into your weakest friendly district. Give every other friendly character in Ashlee\'s district +1 Hand. Give the highest-Hands enemy on the board -1 Hand.', 'Pressure'],
  ['captainjigga', 'captain-jigga', 'Captain Jigga', 'Air', 5, 4, 'Cabin Gang', 'Send two 2-Hand Steward tokens. Each targets a different highest-Hands enemy for -2 Hands.', 'Disruption'],
  ['counter', 'counter', 'Counter', 'Dark', 4, 2, 'Mirror', 'Gain +X Hands where X is the printed cost of the highest-cost enemy on the board (up to +4). Apply Protect to Counter for the match.', 'Disruption'],
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
      description: mythicLegendUpgradeEffects[engineId][index].kind === 'target-power'
        ? mythicLegendUpgradeEffects[engineId][index].target === 'friendly'
          ? 'After the base ability succeeds, one affected ally gains +1 Hand.'
          : 'After the base ability succeeds, one affected enemy loses 1 Hand.'
        : 'After the base ability succeeds, this card gains +1 Hand.',
      unlockLevel, effect: mythicLegendUpgradeEffects[engineId][index],
    })),
  }],
));
