import type { AbilityUpgradeEffect, Card, CardRarity } from './data';

/** First draftable identity wave for Water, Electric, Plant, and Air. */
export const ELEMENTAL_BOND_WAVE = [
  ['riptidebruiser', 'riptide-bruiser', 'Riptide Bruiser', 'Common', 'Water', 1, 2, 'Breaker Wave', 'On Reveal: Give the highest-Hands enemy here -1 Hands.', 'Pressure'],
  ['stillwatermedic', 'stillwater-medic', 'Stillwater Medic', 'Uncommon', 'Water', 2, 2, 'Clear Waters', 'On Reveal: Cleanse your lowest-Hands frozen or silenced ally here. If cleansed, give it +1 Hands.', 'Support'],
  ['monsoonanchor', 'monsoon-anchor', 'Monsoon Anchor', 'Rare', 'Water', 3, 3, 'Water Bond', 'Ongoing: While Monsoon Anchor is in your hand, your other Water characters gain +1 Hand at round end.', 'Sustain', 'Water'],
  ['rainmaker', 'rainmaker', 'Rainmaker', 'Epic', 'Water', 4, 4, 'Healing Rain', 'On Reveal: Give your lowest-Hands other ally across the board +2 Hands.', 'Support'],

  ['batteryback', 'battery-back', 'Battery Back', 'Common', 'Electric', 1, 2, 'Spare Charge', 'On Reveal: If you have an ally in another district, restore 1 Motion, up to 9.', 'Tempo'],
  ['circuitcaptain', 'circuit-captain', 'Circuit Captain', 'Epic', 'Electric', 4, 4, 'Electric Bond', 'Ongoing: While Circuit Captain is in your hand, your other Electric characters gain +1 Hand at round end.', 'Tempo', 'Electric'],
  ['wiretap', 'wiretap', 'Wiretap', 'Rare', 'Electric', 2, 2, 'Open Frequency', 'On Reveal: Your next card in another district costs 1 less Motion.', 'Tempo'],
  ['livewire', 'livewire', 'Livewire', 'Uncommon', 'Electric', 3, 2, 'Cross-City Current', 'On Reveal: Move to your weakest other district. If the move succeeds, gain +1 Hands.', 'Movement'],

  ['sprout', 'sprout', 'Sprout', 'Common', 'Plant', 1, 2, 'First Growth', 'On Reveal: If another friendly character is here, gain +1 Hands.', 'Growth'],
  ['rootnurse', 'root-nurse', 'Root Nurse', 'Uncommon', 'Plant', 2, 2, 'Root Remedy', 'On Reveal: Cleanse your lowest-Hands frozen or silenced ally here. If cleansed, give it +1 Hands.', 'Support'],
  ['canopykeeper', 'canopy-keeper', 'Canopy Keeper', 'Rare', 'Plant', 3, 3, 'Plant Bond', 'Ongoing: While Canopy Keeper is in your hand, your other Plant characters gain +1 Hand at round end.', 'Growth', 'Plant'],
  ['gardenwall', 'garden-wall', 'Garden Wall', 'Epic', 'Plant', 4, 4, 'Sheltering Shade', 'On Reveal: Give your lowest-Hands other ally here +2 Hands and Protect it from one targeted hostile ability.', 'Support'],

  ['gust', 'gust', 'Gust', 'Common', 'Air', 1, 2, 'Catch a Breeze', 'On Reveal: Move to your weakest other district.', 'Movement'],
  ['crosswind', 'crosswind', 'Crosswind', 'Uncommon', 'Air', 2, 2, 'Shift the Scene', 'On Reveal: Move your lowest-Hands other ally here to your weakest other district. If it moves, give it +1 Hands.', 'Movement'],
  ['slipstream', 'slipstream', 'Slipstream', 'Rare', 'Air', 3, 3, 'Air Bond', 'Ongoing: While Slipstream is in your hand, your other Air characters gain +1 Hand at round end.', 'Movement', 'Air'],
  ['cloudbreak', 'cloudbreak', 'Cloudbreak', 'Epic', 'Air', 4, 4, 'Clear Skies', 'On Reveal: Give your lowest-Hands other ally across the board +2 Hands.', 'Support'],
] as const;

export const elementalBondWaveUpgradeEffects: Record<string, readonly AbilityUpgradeEffect[]> = Object.fromEntries(
  ELEMENTAL_BOND_WAVE.map(([id]) => [id, [0, 1, 2].map(() => ({ kind: 'self-power' as const, amount: 1 as const, trigger: 'base-success' as const }))]),
);
export const elementalBondWaveRarities: Record<string, CardRarity> = Object.fromEntries(
  ELEMENTAL_BOND_WAVE.map(([id, , , rarity]) => [id, rarity]),
);
const ELEMENT_ACCENTS: Record<string, string> = {
  Water: '#60a5fa',
  Electric: '#22d3ee',
  Plant: '#4ade80',
  Air: '#a78bfa',
};
export const elementalBondWaveCards: Record<string, Card> = Object.fromEntries(
  ELEMENTAL_BOND_WAVE.map(([id, catalogId, name, , type, cost, power, ability, effect, role, elementalBond]) => {
    const accent = ELEMENT_ACCENTS[type];
    return [id, {
      id: catalogId, name, type, cost, power, ability, effect, kind: 'character', roles: [role],
      artworkLayout: 'portrait', ...(elementalBond ? { elementalBond } : {}),
      entryVfx: { accent }, portraitAccent: accent,
      abilityUpgrades: [2, 5, 8].map((unlockLevel, index) => ({
        id: `${id}:upgrade:${index + 1}`,
        name: `${ability} ${['Practice', 'Confidence', 'Mastery'][index]}`,
        description: elementalBond
          ? 'While this card is in your hand, one bonded ally gains an additional +1 Hand at round end.'
          : `After ${ability} succeeds, this card gains +1 Hand.`,
        unlockLevel,
        effect: elementalBondWaveUpgradeEffects[id][index],
      })),
    }];
  }),
);