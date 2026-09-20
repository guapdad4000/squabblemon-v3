import type { AbilityUpgradeEffect, Card } from './data';

/** Cheap everyday characters and items for spending the rest of a turn's Motion. */
const definitions = [
  ['shiesty', 'shiesty-yn', 'Shiesty YN', 'Dark', 1, 1, 'Mean Mug', '50% chance to summon another Shiesty YN here. Each summoned copy repeats this effect, up to 8 extra.', 'character', 'Pressure'],
  ['torta', 'torta', 'Torta', 'Earth', 2, 2, 'Earth Bond', 'Ongoing: While Torta is in your hand, your other Earth characters gain +1 Hand at round end.', 'character', 'Sustain'],
  ['waterboy', 'water-boy', 'Water Boy', 'Water', 1, 1, 'Cold Water', 'If another friendly card is here, gain +1 Motion.', 'character', 'Tempo'],
  ['buspass', 'bus-pass', 'Bus Pass', 'Air', 0, 0, 'All-Day Transfer', 'Your next card costs 1 less Motion.', 'support', 'Support'],
  ['cognac', 'cognac-bottle', 'Cognac Bottle', 'Fire', 1, 0, 'Liquid Courage', 'Give your lowest-Hands friendly character here +2 Hands.', 'support', 'Support'],
  ['bustdown', 'bust-down-watch', 'Bust-Down Watch', 'Light', 1, 0, 'Wrist Check', 'Protect your lowest-Hands friendly character here from one targeted hostile ability.', 'support', 'Support'],
  ['soulfood', 'soul-food', 'Soul Food', 'Plant', 1, 0, 'Full Plate', 'Give your lowest-Hands friendly character here +1 Hands and cleanse its freeze and silence.', 'support', 'Support'],
  ['concrete', 'concrete', 'Concrete', 'Rock', 1, 1, 'Rock Bond', 'Ongoing: While Concrete is in your hand, your other Rock characters gain +1 Hand at round end.', 'character', 'Sustain'],
] as const;

export const superCommonIds = definitions.map(([id]) => id);
export const superCommonUpgradeEffects: Record<string, readonly AbilityUpgradeEffect[]> = Object.fromEntries(
  definitions.map(([id, , , , , , , , kind]) => [id, [0, 1, 2].map(() =>
    kind === 'support' && id !== 'buspass'
      ? { kind: 'target-power' as const, amount: 1 as const, target: 'friendly' as const, trigger: 'base-success' as const }
      : { kind: 'self-power' as const, amount: 1 as const, trigger: 'base-success' as const },
  )]),
);

export const superCommonCards: Record<string, Card> = Object.fromEntries(definitions.map(
  ([engineId, id, name, type, cost, power, ability, effect, kind, role]) => [engineId, {
    id, name, type, cost, power, kind, ability, effect: `On Reveal: ${effect}`, roles: [role],
    abilityUpgrades: [2, 5, 8].map((unlockLevel, index) => ({
      id: `${engineId}:upgrade:${index + 1}`, name: `${ability} ${['Practice', 'Confidence', 'Mastery'][index]}`,
      description: superCommonUpgradeEffects[engineId][index].kind === 'target-power'
        ? 'After the base ability succeeds, the affected ally gains +1 Hands.'
        : 'After the base ability succeeds, this card gains +1 Hands.',
      unlockLevel, effect: superCommonUpgradeEffects[engineId][index],
    })),
  }],
));
