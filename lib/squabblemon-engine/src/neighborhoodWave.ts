import type { AbilityUpgradeEffect, Card, CardRarity } from './data';

export const NEIGHBORHOOD_WAVE = [
  ['hair-stylist', 'Hair Stylist', 'Uncommon', 'Air', 2, 2, 'Blowout', 'On Reveal: Cleanse your weakest other ally here and give it +1 Hand.', 'Support'],
  ['stylist', 'Stylist', 'Rare', 'Light', 3, 3, 'Fresh Fit', 'On Reveal: Give your weakest other ally here +1 Hand and Protect.', 'Support'],
  ['demario', 'Demario', 'Rare', 'Plant', 3, 3, 'Mushroom Delivery', 'On Reveal: Summon a 1-Hand Mushroom here if you have fewer than 4 friendly cards here (including Demario).', 'Support'],
  ['luigion', 'Luigion', 'Rare', 'Normal', 2, 2, 'Power-Up', 'On Reveal: Gain +1 Hand if another friendly character is here. When played with Squabble, transform into Powered Luigion; consume at most one friendly Demario Mushroom here for +2 Hands.', 'Growth'],
  ['black-cowboy', 'Black Cowboy', 'Epic', 'Earth', 3, 3, 'Lasso', 'On Reveal: Pull the weakest enemy from another district here. Protection, immunity and movement locks can stop this. Requires fewer than 4 enemies here.', 'Movement'],
] as const;

export const neighborhoodWaveUpgradeEffects: Record<string, readonly AbilityUpgradeEffect[]> = Object.fromEntries(
  NEIGHBORHOOD_WAVE.map(([id]) => [id, [0, 1, 2].map(() => ({ kind: 'self-power' as const, amount: 1 as const, trigger: 'base-success' as const }))]),
);
export const neighborhoodWaveRarities: Record<string, CardRarity> = Object.fromEntries(NEIGHBORHOOD_WAVE.map(([id, , rarity]) => [id, rarity]));
export const neighborhoodWaveCards: Record<string, Card> = Object.fromEntries(NEIGHBORHOOD_WAVE.map(
  ([id, name, , type, cost, power, ability, effect, role]) => [id, {
    id, name, type, cost, power, ability, effect, kind: 'character', roles: [role], artworkLayout: 'portrait',
    abilityUpgrades: [2, 5, 8].map((unlockLevel, index) => ({
      id: `${id}:upgrade:${index + 1}`, name: `${ability} ${['Practice', 'Confidence', 'Mastery'][index]}`,
      description: 'The first time the base ability succeeds this match, gain +1 Hand.', unlockLevel,
      effect: neighborhoodWaveUpgradeEffects[id][index],
    })),
  }],
));

/** Battle-only art and token definitions never enter the collectible registry. */
export const LUIGION_POWERED = {
  id: 'luigion-powered', name: 'Powered Luigion',
  ability: 'Powered Up',
  effect: 'Squabble doubled base Hands. On Reveal: Gain +1 Hand if another friendly character is here. Consumes at most one friendly Demario Mushroom here for +2 Hands.',
} as const;
export const DEMARIO_MUSHROOM: Card = {
  id: 'demario-mushroom', name: 'Demario Mushroom', type: 'Plant', cost: 0, power: 1,
  kind: 'token', ability: 'Local Power-Up', artworkLayout: 'portrait',
  effect: 'Battle-only summon. A friendly Luigion played with Squabble in this district may consume this Mushroom for +2 Hands.',
  abilityUpgrades: [],
};