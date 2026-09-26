import type { AbilityUpgradeEffect, Card, CardRarity } from './data';

/** First bond wave: rarity is collection metadata, never an ability condition. */
export const ELEMENTAL_WAVE = [
  ['puddle', 'puddle-runner', 'Puddle Runner', 'Common', 'Water', 1, 1, 'Fresh Start', 'Cleanse your lowest-Hands frozen or silenced other ally here. If cleansed, give it +1 Hand.', 'Support'],
  ['raincaller', 'rain-caller', 'Rain Caller', 'Rare', 'Water', 3, 3, 'Water Bond', 'Ongoing: While Rain Caller is in your hand, your other Water characters gain +1 Hand at round end.', 'Sustain', 'Water'],
  ['hydrant', 'hydrant-medic', 'Hydrant Medic', 'Uncommon', 'Water', 3, 3, 'Open Hydrant', 'Cleanse Freeze, Silence, Burn, Weaken, and Lock from every other ally here. Each cleansed ally gains +1 Hand.', 'Support'],
  ['floodgate', 'floodgate-captain', 'Floodgate Captain', 'Epic', 'Water', 5, 5, 'Clear the Block', 'Cleanse your lowest-Hands affected other ally in each district. Each cleansed ally gains +2 Hands.', 'Support'],
  ['seedvendor', 'seed-vendor', 'Seed Vendor', 'Common', 'Plant', 1, 1, 'First Sprout', 'Give your lowest-Hands other Plant ally here +1 Hand.', 'Growth'],
  ['vinekeeper', 'sidewalk-vinekeeper', 'Sidewalk Vinekeeper', 'Rare', 'Plant', 3, 3, 'Plant Bond', 'Ongoing: While Sidewalk Vinekeeper is in your hand, your other Plant characters gain +1 Hand at round end.', 'Growth', 'Plant'],
  ['mosskeeper', 'moss-keeper', 'Moss Keeper', 'Uncommon', 'Plant', 3, 3, 'Root Support', 'Give your lowest-Hands other Plant ally on the board +2 Hands.', 'Growth'],
  ['canopy', 'canopy-auntie', 'Canopy Auntie', 'Epic', 'Plant', 5, 5, 'Full Canopy', 'Give every other Plant ally here +1 Hand. If you have Plant allies in all three districts, give your lowest-Hands Plant ally in each district another +1 Hand.', 'Growth'],
  ['circuityn', 'circuit-yn', 'Circuit YN', 'Common', 'Electric', 1, 1, 'Jump Start', 'If another Electric ally is in another district, restore 1 Motion, up to 9.', 'Tempo'],
  ['switchboard', 'switchboard-tech', 'Switchboard Tech', 'Rare', 'Electric', 3, 3, 'Electric Bond', 'Ongoing: While Switchboard Tech is in your hand, your other Electric characters gain +1 Hand at round end.', 'Tempo', 'Electric'],
  ['flashcourier', 'flash-courier', 'Flash Courier', 'Uncommon', 'Electric', 2, 2, 'Open Circuit', 'Your next card in another district costs 1 less Motion.', 'Tempo'],
  ['powerstation', 'power-station-operator', 'Power Station Operator', 'Epic', 'Electric', 5, 5, 'Grid Surge', 'Give your lowest-Hands other Electric ally in each other district +1 Hand. If you helped an ally, restore 1 Motion, up to 9.', 'Tempo'],
  ['gustscout', 'gust-scout', 'Gust Scout', 'Common', 'Air', 1, 1, 'Catch a Draft', 'Move to your weakest other district. If moved, gain +1 Hand.', 'Movement'],
  ['roofrunner', 'rooftop-runner', 'Rooftop Runner', 'Rare', 'Air', 3, 3, 'Air Bond', 'Ongoing: While Rooftop Runner is in your hand, your other Air characters gain +1 Hand at round end.', 'Movement', 'Air'],
  ['blockmessenger', 'block-messenger', 'Block Messenger', 'Uncommon', 'Air', 3, 3, 'Quick Route', 'Move your lowest-Hands other ally here to your weakest other district. If moved, give it +1 Hand.', 'Movement'],
  ['skyline', 'skyline-captain', 'Skyline Captain', 'Epic', 'Air', 5, 5, 'Skyline Shift', 'Move your lowest-Hands other Air ally here to your weakest other district. If moved, give it +2 Hands.', 'Movement'],
] as const;

export const elementalWaveUpgradeEffects: Record<string, readonly AbilityUpgradeEffect[]> = Object.fromEntries(
  ELEMENTAL_WAVE.map(([id]) => [id, [0, 1, 2].map(() => ({ kind: 'self-power' as const, amount: 1 as const, trigger: 'base-success' as const }))]),
);
export const elementalWaveRarities: Record<string, CardRarity> = Object.fromEntries(ELEMENTAL_WAVE.map(([id, , , rarity]) => [id, rarity]));
export const elementalWaveCards: Record<string, Card> = Object.fromEntries(ELEMENTAL_WAVE.map(
  ([engineId, id, name, , type, cost, power, ability, effect, role, elementalBond]) => [engineId, {
    id, name, type, cost, power, ability,
    effect: /^(On Reveal|Ongoing):/.test(effect) ? effect : `On Reveal: ${effect}`,
    kind: 'character', roles: [role],
    ...(elementalBond ? { elementalBond } : {}),
    entryVfx: { accent: { Water: '#60a5fa', Plant: '#4ade80', Electric: '#22d3ee', Air: '#a78bfa' }[type] },
    portraitAccent: { Water: '#60a5fa', Plant: '#4ade80', Electric: '#22d3ee', Air: '#a78bfa' }[type],
    abilityUpgrades: [2, 5, 8].map((unlockLevel, index) => ({
      id: `${engineId}:upgrade:${index + 1}`, name: `${ability} ${['Practice', 'Confidence', 'Mastery'][index]}`,
      description: elementalBond
        ? 'While this card is in your hand, one bonded ally gains an additional +1 Hand at round end.'
        : 'After the base ability succeeds, this card gains +1 Hand.',
      unlockLevel, effect: elementalWaveUpgradeEffects[engineId][index],
    })),
  }],
));