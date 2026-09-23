import type { AbilityUpgradeEffect, Card, CardRarity } from './data';

export const NEIGHBORHOOD_WAVE = [
  ['hair-stylist', 'Hair Stylist', 'Uncommon', 'Air', 2, 2, 'Blowout', 'On Reveal: Cleanse your weakest other ally here and give it +1 Hand.', 'Support'],
  ['stylist', 'Stylist', 'Rare', 'Light', 3, 3, 'Fresh Fit', 'On Reveal: Give your weakest other ally here +1 Hand and Protect.', 'Support'],
  ['demario', 'Demario', 'Rare', 'Plant', 2, 2, 'Mushroom Delivery', 'On Reveal: Summon a 1-Hand Mushroom here if you have fewer than 4 friendly cards here. The next other friendly character played here consumes one Mushroom for +1 Hand; normal or Powered Luigion gets +2 on reveal. Echoes never consume Mushrooms.', 'Support'],
  ['luigion', 'Luigion', 'Rare', 'Normal', 2, 2, 'Power-Up', 'On Reveal: Gain +1 Hand, then give your weakest other friendly character here +1 Hand; if none, gain a second +1. Consume at most one local friendly Mushroom for +2 Hands per deployment, never on echoes. Squabble transforms into Powered Luigion: the Mushroom replaces the solo +1, then jump to your weakest other open district for +1 Hand if the move succeeds.', 'Growth'],
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
  effect: 'Squabble doubled base Hands. On Reveal: Gain +1 Hand and give your weakest other friendly character here +1. Consume one local friendly Mushroom for +2; if no Mushroom or other character, gain another +1. Then jump to your weakest other open district for +1 if successful. Echoes never consume Mushrooms or jump.',
} as const;
export const DEMARIO_MUSHROOM: Card = {
  id: 'demario-mushroom', name: 'Demario Mushroom', type: 'Plant', cost: 0, power: 1,
  kind: 'token', ability: 'Local Power-Up', artworkLayout: 'portrait',
  effect: 'Battle-only summon. The next friendly character played here consumes one Mushroom for +1 Hand. Normal or Powered Luigion consumes it on reveal for +2 instead. Echoes never consume Mushrooms.',
  abilityUpgrades: [],
};