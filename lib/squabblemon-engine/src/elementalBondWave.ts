import type { AbilityUpgradeEffect, Card, CardRarity } from './data';

/** First draftable identity wave for Water, Electric, Plant, and Air. */
export const ELEMENTAL_BOND_WAVE = [
  ["riptidebruiser", "riptide-bruiser", "Gator Boy", "Common", "Water", 1, 2, "Emotional Support Gator", "On Reveal: Give the highest-Hands enemy here -1 Hands. If its Hands fall, gain +1 Hand.", "Pressure"],
  ["stillwatermedic", "stillwater-medic", "Hot Tub Hottie", "Uncommon", "Water", 2, 3, "Soak Your Problems", "On Reveal: Cleanse your lowest-Hands frozen or silenced ally here and give it +1 Hand. If cleansed, gain +1 Hand.", "Support"],
  ["monsoonanchor", "monsoon-anchor", "Gas Station Sushi Chef", "Rare", "Water", 3, 3, "Trust the Cooler", "Ongoing: While in your hand, your other Water characters gain +1 Hand at round end. On Reveal: Weaken the strongest enemy here.", "Disruption", "Water"],
  ["rainmaker", "rainmaker", "Energy Drink Freak", "Epic", "Water", 4, 4, "Fourth Can, No Plan", "On Reveal: Lose 2 Hands, then restore 3 Motion, up to 9.", "Tempo"],
  ["batteryback", "battery-back", "Game Developer", "Common", "Electric", 1, 2, "Works on My Machine", "On Reveal: Repair your lowest-Hands ally in another district with a negative Hands modifier: give it +1 Hand and restore 1 Motion, up to 9.", "Support"],
  ["circuitcaptain", "circuit-captain", "Electrician Foreman", "Epic", "Electric", 4, 4, "Everybody on the Clock", "Ongoing: While in your hand, your other Electric characters gain +1 Hand at round end.", "Tempo", "Electric"],
  ["wiretap", "wiretap", "E.V. Enthusiast", "Rare", "Electric", 2, 2, "Actually, It Charges Free", "On Reveal: Your next card in another district costs 1 less Motion. If you have no other character here, restore 1 Motion, up to 9.", "Tempo"],
  ["livewire", "livewire", "Dominican Phone Salesman", "Uncommon", "Electric", 3, 2, "Switch Carriers", "On Reveal: Move to your weakest other district. If you move, gain +1 Hand and your next card in a different district from your new location costs 1 less Motion.", "Movement"],
  ["sprout", "sprout", "OG Vegan", "Common", "Plant", 1, 1, "I Brought My Own Plate", "On Reveal: Give your lowest-Hands other Plant ally here +1 Hand. If one is here, also gain +1 Hand.", "Growth"],
  ["rootnurse", "root-nurse", "Matcha Freak", "Uncommon", "Plant", 2, 2, "Ceremonial Grade Crashout", "On Reveal: If you have at least 4 Motion left after playing this card, gain +2 Hands. Otherwise, cleanse your lowest-Hands frozen or silenced ally here and give it +1 Hand.", "Growth"],
  ["canopykeeper", "canopy-keeper", "Performative Male", "Rare", "Plant", 3, 3, "Feminist Literature, Unopened", "Ongoing: While in your hand, your other Plant characters gain +1 Hand at round end.", "Growth", "Plant"],
  ["gardenwall", "garden-wall", "A Spare Gus", "Epic", "Plant", 4, 4, "Personal Space Is Seasonal", "On Reveal: Give the strongest enemy in another district -2 Hands, then give your weakest other ally here +1 Hand.", "Pressure"],
  ["gust", "gust", "Big City Pigeon", "Common", "Air", 1, 2, "Run Your Breadcrumbs", "On Reveal: Move to your weakest other district. If you move, give the weakest enemy there -1 Hand.", "Movement"],
  ["crosswind", "crosswind", "Baby Crying on an Airplane", "Uncommon", "Air", 2, 2, "No Quiet Section", "On Reveal: Weaken the strongest enemy here. Move your weakest other ally here to your weakest other district.", "Disruption"],
  ["slipstream", "slipstream", "The Flight Plug", "Rare", "Air", 3, 3, "Cousin at the Gate", "Ongoing: While in your hand, your other Air characters gain +1 Hand at round end.", "Movement", "Air"],
  ["cloudbreak", "cloudbreak", "Airheaded Model", "Epic", "Air", 4, 4, "Wrong Gate, Great Lighting", "On Reveal: Move to your weakest other district. If you move, give your weakest ally left in the original district +2 Hands.", "Movement"],
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