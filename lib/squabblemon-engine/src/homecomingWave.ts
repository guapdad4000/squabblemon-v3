import type { AbilityUpgradeEffect, Card, CardRarity } from './data';

/** Additive roster entries. Counter and Concrete retain their existing save IDs. */
export const HOMECOMING_WAVE = [
  ['lola', 'lola', 'Lola', 'Epic', 'Plant', 3, 3, 'Kain Muna!', 'On Reveal: Invite your weakest movable ally from each other district here. Cleanse each arrival and give it +1 Hand. At round end, send guests home with another +1 if they return. Needs space.', 'Support'],
  ['repoman', 'repo-man', 'Repo Man', 'Epic', 'Dark', 4, 4, 'Tow & Collect', 'On Reveal: Tow the enemy with the most bonus Hands from another district here. If it arrives, give up to 3 of its bonus Hands to your weakest ally here. Protection, immunity and movement rules apply.', 'Disruption'],
  ['madhatter', 'mad-hatter', 'Mad Hatter', 'Rare', 'Air', 2, 3, 'Change Places!', 'On Reveal: Return your weakest other ally here to hand with +1 Hand and −1 Motion on its next play (minimum 1). If there is room, pull your strongest movable ally from another district here. The cheaper guest also gains +3 Hands; the other gains Protection if still on the board. Equal costs: +1 Hand each. If alone here, gain +2 Hands.', 'Movement'],
] as const;
export const homecomingUpgradeEffects: Record<string, readonly AbilityUpgradeEffect[]> = Object.fromEntries(
  HOMECOMING_WAVE.map(([id]) => [id, [0, 1, 2].map(() => ({ kind: 'self-power' as const, amount: 1 as const, trigger: 'base-success' as const }))]),
);
export const homecomingRarities: Record<string, CardRarity> = Object.fromEntries(HOMECOMING_WAVE.map(([id, , , rarity]) => [id, rarity]));
export const homecomingCards: Record<string, Card> = Object.fromEntries(HOMECOMING_WAVE.map(
  ([engineId, id, name, , type, cost, power, ability, effect, role]) => [engineId, {
    id, name, type, cost, power, ability, effect, kind: 'character', roles: [role],
    abilityUpgrades: [2, 5, 8].map((unlockLevel, index) => ({
      id: engineId + ':upgrade:' + (index + 1), name: ability + ' ' + ['Practice', 'Confidence', 'Mastery'][index],
      description: 'The first time the base ability succeeds this match, gain +1 Hand.',
      unlockLevel, effect: homecomingUpgradeEffects[engineId][index],
    })),
  }],
));
