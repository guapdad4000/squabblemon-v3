import type { AbilityUpgradeEffect, Card, CardRarity } from './data';

/** Original street characters plus the two creator Mythicals. */
export const STREET_WAVE = [
  ['homelessyn', 'homeless-yn', 'Homeless YN', 'Common', 'Earth', 2, 2, 'Still Standing', 'If enemies outnumber your other friendly cards here, gain +2 Hands.', 'Comeback'],
  ['sportsprodigy', 'sports-prodigy', 'Sports Prodigy', 'Rare', 'Electric', 3, 3, 'Next Up', 'If you are losing this district, gain +2 Hands and give the highest-Hands enemy here -1 Hands.', 'Comeback'],
  ['fein', 'fein', 'Fein', 'Common', 'Poison', 1, 1, 'One More', 'If an enemy is here, gain +1 Hands.', 'Pressure'],
  ['alchy', 'alchy', 'Alchy', 'Common', 'Water', 2, 3, 'Last Round', 'On round 4 or later, gain +1 Hands.', 'Closer'],
  ['stud', 'stud', 'STUD', 'Rare', 'Earth', 3, 3, 'Hold You Down', 'Give your lowest-Hands other friendly character here +1 Hands and protect it from one targeted hostile ability.', 'Support'],
  ['gothkid', 'goth-kid', 'Goth Kid', 'Uncommon', 'Dark', 2, 2, 'Dead Air', 'Silence the lowest-Hands enemy here with a printed cost of 2 or less.', 'Disruption'],
  ['stonerjr', 'stoner-jr', 'Stoner Jr.', 'Common', 'Plant', 1, 2, 'Chill Out', 'Cleanse your lowest-Hands frozen or silenced friendly character here. If cleansed, give it +1 Hands.', 'Support'],
  ['stonersr', 'stoner-sr', 'Stoner Sr.', 'Rare', 'Plant', 3, 2, 'OG Session', 'Cleanse freeze and silence from every other friendly character here. Each cleansed character gains +1 Hands.', 'Support'],
  ['divorceddad', 'divorced-dad', 'Divorced Dad', 'Uncommon', 'Normal', 3, 3, 'My Weekend', 'If no other friendly character is here and an enemy is here, gain +2 Hands.', 'Pressure'],
  ['bblnice', 'bbl-nice', 'BBL Nice', 'Uncommon', 'Light', 3, 2, 'Good Company', 'Give every other friendly character here +1 Hands.', 'Support'],
  ['bbldemon', 'bbl-demon', 'BBL Demon', 'Epic', 'Fire', 4, 4, 'Problem Energy', 'Give every enemy here -1 Hands.', 'Disruption'],
  ['break', 'break-dancer', 'Break', 'Uncommon', 'Air', 2, 2, 'Floor Sweep', 'Move your lowest-Hands other friendly character here to your weakest other district. If moved, give it +1 Hands.', 'Movement'],
  ['krump', 'krump-dancer', 'Krump', 'Rare', 'Fire', 3, 3, 'Chest Pop', 'If an enemy is here, gain +1 Hands and give the highest-Hands enemy here -1 Hands.', 'Disruption'],
  ['bboy', 'bboy', 'Bboy', 'Uncommon', 'Air', 2, 2, 'Windmill', 'Move to your weakest other district. If moved, give the lowest-Hands other friendly character there +1 Hands.', 'Movement'],
  ['yunghustle', 'yung-hustle', 'Yung Hustle', 'Common', 'Electric', 1, 1, 'Side Hustle', 'If a friendly character is in another district, restore 1 Motion, up to 9.', 'Tempo'],
  ['failedrapper', 'failed-rapper', 'Failed Rapper', 'Common', 'Air', 2, 1, 'One More Verse', 'Give every other friendly character here costing 2 or less +1 Hands.', 'Support'],
  ['failedathlete', 'failed-athlete', 'Failed Athlete', 'Uncommon', 'Earth', 3, 2, 'Comeback Season', 'On round 4 or later, if you are losing this district, gain +3 Hands.', 'Comeback'],
  ['incel', 'incel', 'Incel', 'Common', 'Dark', 2, 3, 'Solo Queue', 'If no other friendly cards are here, gain +1 Hands.', 'Pressure'],
  ['redpill', 'red-pill', 'Red Pill', 'Epic', 'Dark', 3, 3, 'Echo Chamber', 'Silence the highest-Hands enemy here. If it was already silenced, gain +2 Hands instead.', 'Disruption'],
  ['simmy', 'simmy', 'Simmy', 'Mythical', 'Poison', 4, 4, 'Heartbreak', 'Give the highest-Hands enemy here -3 Hands and your lowest-Hands other friendly character here +2 Hands.', 'Disruption'],
  ['foodz', 'foodz', 'Foodz', 'Mythical', 'Light', 3, 2, "What's Crackin'!", 'Cleanse every other friendly character on your board. Give your lowest-Hands other friendly character in each district +1 Hands.', 'Support'],
] as const;

export const streetWaveUpgradeEffects: Record<string, readonly AbilityUpgradeEffect[]> = Object.fromEntries(
  STREET_WAVE.map(([id]) => [id, [0, 1, 2].map(() => ({ kind: 'self-power' as const, amount: 1 as const, trigger: 'base-success' as const }))]),
);
export const streetWaveRarities: Record<string, CardRarity> = Object.fromEntries(STREET_WAVE.map(([id, , , rarity]) => [id, rarity]));
export const streetWaveCards: Record<string, Card> = Object.fromEntries(STREET_WAVE.map(
  ([engineId, id, name, , type, cost, power, ability, effect, role]) => [engineId, {
    id, name, type, cost, power, ability, effect: `On Reveal: ${effect}`, kind: 'character', roles: [role],
    ...(engineId === 'simmy' ? { artworkLayout: 'portrait' as const, entryVfx: { accent: '#ef285d' }, portraitAccent: '#ef285d' } : {}),
    ...(engineId === 'foodz' ? { entryVfx: { accent: '#ffce45' }, portraitAccent: '#ffce45' } : {}),
    abilityUpgrades: [2, 5, 8].map((unlockLevel, index) => ({
      id: `${engineId}:upgrade:${index + 1}`, name: `${ability} ${['Practice', 'Confidence', 'Mastery'][index]}`,
      description: 'After the base ability succeeds, this card gains +1 Hands.',
      unlockLevel, effect: streetWaveUpgradeEffects[engineId][index],
    })),
  }],
));
