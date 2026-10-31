import type { AbilityUpgradeEffect, Card, CardRarity } from './data';

/** Deck-writing clients advertise support before altering Anunaki lineups. */
export const ANUNAKI_DECK_CAPABILITY_HEADER = 'x-squabblemon-deck-catalog';
export const ANUNAKI_DECK_CAPABILITY = 'anunaki-v1';

/** Draft numbers; keep the unlock event disabled until gameplay, presentation and balance are verified. */
const roster = [
  ['nabu', 'Nabu', 'Rare', 1, 2, 'I Got Receipts', 'On Reveal: Place an Ancient Tablet here.'],
  ['enki', 'Enki', 'Epic', 2, 3, 'The Blueprint', 'On Reveal: Place an Ancient Tablet here. Give your weakest other ally here +2 Hands.'],
  ['utu', 'Utu', 'Legendary', 1, 2, 'Into the Light', 'On Reveal: If an enemy is here, give the strongest enemy −1 Hand; consume your Tablet here for another −1. Otherwise place an Ancient Tablet here.'],
  ['ninhursag', 'Ninhursag', 'Legendary', 2, 3, 'The Maker’s Touch', 'On Reveal: Place an Ancient Tablet here. When your Tablet here is consumed, gain +2 Hands and cleanse a debuffed other ally here.'],
  ['inanna', 'Inanna', 'Epic', 2, 3, 'Catch These Divine Hands', 'On Reveal: Consume your Ancient Tablet here to gain +4 Hands. If there is none, gain +1 Hand.'],
  ['yakub', 'Yakub', 'Legendary', 2, 1, 'Tapped In With the Ancient Text', 'On Reveal: Summon a free Caucus Mountaineer here (two if you SQUABBLE Yakub), without their On Reveal.'],
  ['enlil', 'Enlil', 'Legendary', 4, 4, 'Storm Warning', 'On Reveal: Give the strongest enemy here −2 Hands. Consume your Ancient Tablet here to make that −4 instead.'],
  ['ereshkigal', 'Ereshkigal', 'Legendary', 3, 3, 'Downstairs With Me', 'On Reveal: Give the weakest enemy here −2 Hands. Consume your Ancient Tablet here to gain +3 Hands.'],
  ['caucus-mountaineer', 'Caucus Mountaineer', 'Epic', 2, 3, 'Lab Accident', 'On Reveal: Deal 1 damage to the strongest enemy here. If the hit lands, 35% chance to summon another Caucus that repeats this effect, up to 8 extras. At the end of each round, gain +1 Hands if your Ancient Tablet is here.'],
  ['anu', 'Anu', 'Mythical', 6, 8, 'The Original Plan', 'Costs 2 less Motion by spending one of your Ancient Tablets (this district first). On Reveal: Consume your remaining Tablets for +3 Hands each, or gain +2 if none remain.'],
] as const;
export const anunakiUpgradeEffects: Record<string, readonly AbilityUpgradeEffect[]> = Object.fromEntries(roster.map(([id]) => [id, Array.from({length: 3}, () => ({kind: 'self-power' as const, amount: 1 as const, trigger: 'base-success' as const}))]));
export const anunakiRarities: Record<string, CardRarity> = Object.fromEntries(roster.map(([id, , rarity]) => [id, rarity]));
export const anunakiCards: Record<string, Card> = Object.fromEntries(roster.map(([id, name, , cost, power, ability, effect]) => [id, {
  id, name, type: 'Normal', cost, power, ability, effect, kind: 'character', artworkLayout: 'portrait',
  entryVfx: {accent: '#2ede8c'}, portraitAccent: '#2ede8c',
  abilityUpgrades: [2, 5, 8].map((unlockLevel, index) => ({id: `${id}:upgrade:${index + 1}`, name: `${ability} ${['Practice', 'Confidence', 'Mastery'][index]}`, description: 'The first time the base ability succeeds this match, gain +1 Hand.', unlockLevel, effect: anunakiUpgradeEffects[id][index]})),
}]));

/** This roster is reserved for the event and future dedicated acquisition. */
export const isAnunakiCardId = (id: string): boolean => Object.hasOwn(anunakiCards, id);
