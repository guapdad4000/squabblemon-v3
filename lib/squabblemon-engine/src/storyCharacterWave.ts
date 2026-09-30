import type { AbilityUpgradeEffect, Card, CardRarity } from './data';

/** Story character cards are also regular collectible cards for saved crews. */
export const STORY_CHARACTER_WAVE = [
  ['ganger-blue', 'Ganger Blue', 'Epic', 'Water', 3, 3, 'Blue Side Cover',
    'On Reveal: Give your weakest other ally in another district +2 Hands and Protection. If there is no other ally in another district, gain +1 Hand.', 'Support'],
  ['ganger-red', 'Ganger Red', 'Epic', 'Fire', 3, 4, 'Red Side Retaliation',
    'On Reveal: Deal 2 damage to the strongest enemy here. If damage lands, gain +1 Hand.', 'Disruption'],
  ['snitch', 'Snitch', 'Mythical', 'Dark', 3, 3, 'Loose Lips',
    'On Reveal: Silence the strongest enemy here. If it is already Silenced, Weaken it instead. Protection and immunity can block the effect.', 'Disruption'],
  ['cracked-head', 'Cracked Head', 'Legendary', 'Earth', 5, 5, 'Block Crowned',
    'On Reveal: Deal 1 damage to each enemy here, up to 3 enemies. Gain +1 Hand for each enemy damaged, up to +2.', 'Disruption'],
] as const;

export const storyCharacterWaveUpgradeEffects: Record<string, readonly AbilityUpgradeEffect[]> = Object.fromEntries(
  STORY_CHARACTER_WAVE.map(([id]) => [id, [0, 1, 2].map(() => ({
    kind: 'self-power' as const, amount: 1 as const, trigger: 'base-success' as const,
  }))]),
);

export const storyCharacterWaveRarities: Record<string, CardRarity> = Object.fromEntries(
  STORY_CHARACTER_WAVE.map(([id, , rarity]) => [id, rarity]),
);

export const storyCharacterWaveCards: Record<string, Card> = Object.fromEntries(
  STORY_CHARACTER_WAVE.map(([id, name, , type, cost, power, ability, effect, role]) => [id, {
    id, name, type, cost, power, ability, effect, kind: 'character', roles: [role], artworkLayout: 'portrait',
    abilityUpgrades: [2, 5, 8].map((unlockLevel, index) => ({
      id: `${id}:upgrade:${index + 1}`,
      name: `${ability} ${['Practice', 'Confidence', 'Mastery'][index]}`,
      description: `The first time the base ability succeeds this match, this card gains +1 Hand.`,
      unlockLevel,
      effect: storyCharacterWaveUpgradeEffects[id][index],
    })),
  }]),
);