import type { AbilityUpgradeEffect, Card, CardRarity } from './data';

/** Original fictional characters; catalog rarity never modifies combat stats. */
export const CELLBLOCK_WAVE = [
  ['inmate-crafty', 'Inmate Crafty', 'Uncommon', 'Normal', 2, 2, 'Make Do', 'On Reveal: If a friendly support card is here, gain +2 Hands.', 'Growth'],
  ['inmate-boyfriend', 'Inmate Boyfriend', 'Rare', 'Light', 3, 3, 'Looking Out', 'On Reveal: Give your weakest other ally here +2 Hands.', 'Support'],
  ['inmate-informant', 'Inmate Informant', 'Rare', 'Dark', 3, 3, 'Quiet Tip', 'On Reveal: Give the strongest enemy here -2 Hands. Protection and immunity can block this.', 'Disruption'],
  ['inmate-contraband', 'Inmate Contraband', 'Uncommon', 'Normal', 2, 2, 'Hidden Stash', 'On Reveal: If another friendly character is here, restore 1 Motion, up to the Motion cap.', 'Support'],
  ['lebron-james', 'Regular guy named LeBron James', 'Mythical', 'Normal', 4, 4, 'Regular Guy', 'A fictional regular guy. On Reveal: Cleanse and Protect your weakest other ally here. If you are losing this district after arrival, also gain +1 Hand.', 'Support'],
] as const;

export const cellblockWaveUpgradeEffects: Record<string, readonly AbilityUpgradeEffect[]> = Object.fromEntries(
  CELLBLOCK_WAVE.map(([id]) => [id, [0, 1, 2].map(() => ({ kind: 'self-power' as const, amount: 1 as const, trigger: 'base-success' as const }))]),
);
export const cellblockWaveRarities: Record<string, CardRarity> = Object.fromEntries(CELLBLOCK_WAVE.map(([id, , rarity]) => [id, rarity]));
export const cellblockWaveCards: Record<string, Card> = Object.fromEntries(CELLBLOCK_WAVE.map(
  ([id, name, , type, cost, power, ability, effect, role]) => [id, {
    id, name, type, cost, power, ability, effect, kind: 'character', roles: [role], artworkLayout: 'portrait',
    abilityUpgrades: [2, 5, 8].map((unlockLevel, index) => ({
      id: `${id}:upgrade:${index + 1}`, name: `${ability} ${['Practice', 'Confidence', 'Mastery'][index]}`,
      description: 'The first time the base ability succeeds this match, gain +1 Hand.', unlockLevel,
      effect: cellblockWaveUpgradeEffects[id][index],
    })),
  }],
));