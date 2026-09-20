import type { AbilityUpgradeEffect, Card, CardRarity } from './data';

const definitions = [
  ['energydrink', 'energy-drink', 'Energy Drink', 'Common', 'Fire', 1, 'Second Wind', 'Restore 3 Motion, up to the 9-Motion cap.', 'Tempo'],
  ['charger', 'phone-charger', 'Phone Charger', 'Common', 'Electric', 1, 'Refund', 'On Reveal: Restore 1 Motion for each friendly character here, up to 3.', 'Tempo'],
  ['firstaid', 'first-aid-kit', 'First Aid Kit', 'Uncommon', 'Light', 2, 'Patch Up', 'Cleanse freeze and silence from every friendly character here.', 'Support'],
  ['boombox', 'boombox', 'Boombox', 'Uncommon', 'Air', 2, 'Turn It Up', 'Give every friendly character here +1 Hands.', 'Support'],
  ['subwaymap', 'subway-map', 'Subway Map', 'Common', 'Air', 0, 'Alternate Route', 'Move your lowest-Hands friendly character here to your weakest other district. If moved, give it +1 Hands.', 'Movement'],
  ['workboots', 'work-boots', 'Buttahs', 'Common', 'Earth', 1, 'Stand Firm', 'Give your lowest-Hands friendly character here +2 Hands and protect it from one targeted hostile ability.', 'Support'],
] as const;

export const supportCardIds = definitions.map(([id]) => id);
export const supportRarities: Record<string, CardRarity> = Object.fromEntries(definitions.map(([id, , , rarity]) => [id, rarity]));
export const supportUpgradeEffects: Record<string, readonly AbilityUpgradeEffect[]> = Object.fromEntries(definitions.map(([id]) => [id,
  [0, 1, 2].map(() => id === 'energydrink' || id === 'charger'
    ? { kind: 'self-power' as const, amount: 1 as const, trigger: 'base-success' as const }
    : { kind: 'target-power' as const, amount: 1 as const, target: 'friendly' as const, trigger: 'base-success' as const }),
]));
export const supportCards: Record<string, Card> = Object.fromEntries(definitions.map(([engineId, id, name, , type, cost, ability, effect, role]) => [engineId, {
  id, name, type, cost, power: 0, kind: 'support', ability, effect: `On Reveal: ${effect}`, roles: [role],
  abilityUpgrades: [2, 5, 8].map((unlockLevel, index) => ({
    id: `${engineId}:upgrade:${index + 1}`, name: `${ability} ${['Practice', 'Confidence', 'Mastery'][index]}`,
    description: supportUpgradeEffects[engineId][index].kind === 'target-power'
      ? 'After the base ability succeeds, one affected ally gains +1 Hands.'
      : 'After the base ability succeeds, this card gains +1 Hands.',
    unlockLevel, effect: supportUpgradeEffects[engineId][index],
  })),
}]));
