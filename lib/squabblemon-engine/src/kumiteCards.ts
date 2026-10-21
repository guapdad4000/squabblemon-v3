import type { AbilityUpgradeEffect, Card, CardRarity } from './data';

export const KUMITE_EXCLUSIVE_CARD_IDS = ['bushedo-brown', 'franklin-duke', 'chonk-lee'] as const;
export const isKumiteExclusiveCard = (id: string) => (KUMITE_EXCLUSIVE_CARD_IDS as readonly string[]).includes(id);
export const KUMITE_CARD_REWARDS = [
  { id: 'kumite:card:bushedo-brown:v1', cardId: 'bushedo-brown', name: 'Bushedo Brown', requirement: 'Complete 1 full fight', metric: 'completedMatches', required: 1 },
  { id: 'kumite:card:franklin-duke:v1', cardId: 'franklin-duke', name: 'Franklin Duke', requirement: 'Win 1 full fight', metric: 'matchWins', required: 1 },
  { id: 'kumite:card:chonk-lee:v1', cardId: 'chonk-lee', name: 'Chonk Lee', requirement: 'Win 1 full final', metric: 'championships', required: 1 },
  { id: 'kumite:card:dragonfly-jones:v1', cardId: 'dragonfly-jones', name: 'Dragonfly Jones', requirement: 'Win 3 full fights', metric: 'matchWins', required: 3 },
  { id: 'kumite:card:p-tang:v1', cardId: 'p-tang', name: 'P. Tang', requirement: 'Win 4 full fights', metric: 'matchWins', required: 4 },
  { id: 'kumite:card:undercova-brotha:v1', cardId: 'undercova-brotha', name: 'Undercova Brotha', requirement: 'Win 5 full fights', metric: 'matchWins', required: 5 },
  { id: 'kumite:card:sho-nuff:v1', cardId: 'sho-nuff', name: "Sho'Nuff", requirement: 'Win 8 full fights', metric: 'matchWins', required: 8 },
  { id: 'kumite:card:leroy:v1', cardId: 'leroy', name: 'Leroy', requirement: 'Win 2 full finals', metric: 'championships', required: 2 },
  { id: 'kumite:card:yasuke:v1', cardId: 'yasuke', name: 'Yasuke', requirement: 'Win 3 full finals', metric: 'championships', required: 3 },
] as const;

/** The illustrated lineup and server grants share one milestone contract. */
export const KUMITE_LINEUP_REWARDS = KUMITE_CARD_REWARDS;

const definitions = [
  ['bushedo-brown', 'Bushedo Brown', 'Rare', 'Air', 3, 4, 'Personal Security', 'On Reveal: Give your weakest other ally here +2 Hands and Protection. Confiscate up to 4 removable bonus Hands from the enemy here with the most bonus; if no enemy has bonus, hit the strongest enemy here for 2. Confiscation never takes printed Hands or creates healing credit. Protection and immunity apply.', 'Support', '#c5daf5'],
  ['franklin-duke', 'Franklin Duke', 'Epic', 'Light', 4, 6, 'Read The Strike', 'On Reveal: If the strongest enemy here has more Hands than Franklin Duke or has removable bonus Hands, hit it for 4 and gain +3 Hands only if damage lands. Otherwise, give your weakest ally in another district +3 Hands and Protection.', 'Pressure', '#fbd85b'],
  ['chonk-lee', 'Chonk Lee', 'Legendary', 'Earth', 5, 7, 'No Mercy', 'On Reveal: Hit the strongest enemy in each district for 2. Gain +1 Hand for each enemy actually damaged, up to +3. Protection and immunity block both the hit and its reward.', 'Disruption', '#d75943'],
] as const;

export const kumiteCardRarities: Record<string, CardRarity> = Object.fromEntries(definitions.map(([id, , rarity]) => [id, rarity]));
export const kumiteCardUpgradeEffects: Record<string, readonly AbilityUpgradeEffect[]> = Object.fromEntries(definitions.map(([id]) =>
  [id, [0, 1, 2].map(() => ({ kind: 'self-power' as const, amount: 1 as const, trigger: 'base-success' as const }))]));
export const kumiteCards: Record<string, Card> = Object.fromEntries(definitions.map(([id, name, , type, cost, power, ability, effect, role, accent]) =>
  [id, { id, name, type, cost, power, ability, effect, kind: 'character', roles: [role], artworkLayout: 'portrait',
    entryVfx: { accent }, portraitAccent: accent,
    abilityUpgrades: [2, 5, 8].map((unlockLevel, index) => ({ id: `${id}:upgrade:${index + 1}`,
      name: `${ability} ${['Practice', 'Discipline', 'Mastery'][index]}`, unlockLevel,
      description: 'Once per match, after the printed ability succeeds, gain +1 Hand.', effect: kumiteCardUpgradeEffects[id][index] })),
  }]));
