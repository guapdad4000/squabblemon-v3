import type { AbilityUpgradeEffect, Card, CardRarity } from './data';

/** Original fictional characters; rarity is catalog metadata and never changes combat rules. */
export const AFTER_HOURS_WAVE = [
  ['sugarfoot', 'Sugarfoot', 'Uncommon', 'Dark', 2, 2, 'Sweet Weakness', 'On Reveal: Weaken the strongest enemy here. If it was already Weakened, gain +1 Hand.', 'Disruption'],
  ['yn-gokarter', 'YN Gokarter', 'Rare', 'Electric', 2, 2, 'Victory Lap', 'On Reveal: Move to your weakest other open district. If the move succeeds, give the weakest other ally there +1 Hand.', 'Movement'],
  ['yn-atv-lord', 'YN ATV Lord', 'Epic', 'Earth', 3, 4, 'Trail Guide', 'On Reveal: Move your weakest other ally here to your weakest other open district. If the move succeeds, give it +1 Hand.', 'Movement'],
  ['janitor', 'SquabbleHouse Janitor', 'Uncommon', 'Water', 3, 3, 'Turn It Around', 'Ongoing: Two charges/district/round separately reverse first enemy Hands loss/harmful status on any ally and first enemy-forced move/return/execution on staff; +2 Hands each. Duplicates share both; damage deaths use harm.', 'Support'],
  ['homeless-wiseman', 'Homeless Wiseman', 'Legendary', 'Light', 4, 4, "Told You.", "On Reveal: Predict the enemy's weakest open district from the public board through next round. Their next character played there is Weakened; played elsewhere, your next character in the predicted district costs 2 less Motion (minimum 1) through next round. One prediction per side. Protection and immunity can block Weaken.", 'Disruption'],
  ['juneteenth-chair-guy', 'Juneteenth Chair Guy', 'Mythical', 'Fire', 5, 5, 'Fold-Out Justice', 'On Reveal: Give the strongest enemy here -2 Hands, then Protect your weakest other ally here. Protection and immunity can block the hit.', 'Disruption'],
  ['squabble-house-manager', 'SquabbleHouse Manager', 'Legendary', 'Normal', 1, 2, 'Home Advantage',
    'On Reveal: If an enemy is here, gain +1 Hand. Ongoing: Gain +1 Hand for each other friendly Squabblehouse staff member anywhere on the board; Manager does not count himself. The first enemy played or moved here each round loses 1 Hand. Protection, immunity, and movement locks can stop the hostile effect.',
    'Pressure'],
] as const;

export const afterHoursWaveUpgradeEffects: Record<string, readonly AbilityUpgradeEffect[]> = Object.fromEntries(
  AFTER_HOURS_WAVE.map(([id]) => [id, [0, 1, 2].map(() => ({ kind: 'self-power' as const, amount: 1 as const, trigger: 'base-success' as const }))]),
);
export const afterHoursWaveRarities: Record<string, CardRarity> = Object.fromEntries(AFTER_HOURS_WAVE.map(([id, , rarity]) => [id, rarity]));
export const afterHoursWaveCards: Record<string, Card> = Object.fromEntries(AFTER_HOURS_WAVE.map(
  ([id, name, , type, cost, power, ability, effect, role]) => [id, {
    id, name, type, cost, power, ability, effect, kind: 'character', roles: [role], artworkLayout: 'portrait',
    abilityUpgrades: [2, 5, 8].map((unlockLevel, index) => ({
      id: `${id}:upgrade:${index + 1}`, name: `${ability} ${['Practice', 'Confidence', 'Mastery'][index]}`,
      description: 'The first time the base ability succeeds this match, gain +1 Hand.', unlockLevel,
      effect: afterHoursWaveUpgradeEffects[id][index],
    })),
  }],
));
