import type { AbilityUpgradeEffect, Card, CardRarity } from './data';

export const KUMITE_EXCLUSIVE_CARD_IDS = ['bushedo-brown', 'franklin-duke', 'chonk-lee'] as const;
export const isKumiteExclusiveCard = (id: string) => (KUMITE_EXCLUSIVE_CARD_IDS as readonly string[]).includes(id);
export const KUMITE_CARD_REWARDS = [
  { id: 'kumite:card:bushedo-brown:v1', cardId: 'bushedo-brown', name: 'Bushedo Brown', requirement: 'Complete 1 full fight', metric: 'completedMatches', required: 1 },
  { id: 'kumite:card:franklin-duke:v1', cardId: 'franklin-duke', name: 'Franklin Duke', requirement: 'Win 1 full fight', metric: 'matchWins', required: 1 },
  { id: 'kumite:card:chonk-lee:v1', cardId: 'chonk-lee', name: 'Chonk Lee', requirement: 'Win 1 full final', metric: 'championships', required: 1 },
  { id: 'kumite:card:dragonfly-jones:v1', cardId: 'dragonfly-jones', name: 'Dragonfly Jones', requirement: 'Win 3 full fights', metric: 'matchWins', required: 3 },
  { id: 'kumite:card:undercova-brotha:v1', cardId: 'undercova-brotha', name: 'Undercova Brotha', requirement: 'Win 5 full fights', metric: 'matchWins', required: 5 },
  { id: 'kumite:card:sho-nuff:v1', cardId: 'sho-nuff', name: "Sho'Nuff", requirement: 'Win 8 full fights', metric: 'matchWins', required: 8 },
  { id: 'kumite:card:leroy:v1', cardId: 'leroy', name: 'Leroy', requirement: 'Win 2 full finals', metric: 'championships', required: 2 },
  { id: 'kumite:card:yasuke:v1', cardId: 'yasuke', name: 'Yasuke', requirement: 'Win 3 full finals', metric: 'championships', required: 3 },
] as const;

export const KUMITE_LINEUP_REWARDS = [
  ...KUMITE_CARD_REWARDS.slice(0, 5),
  { id: 'kumite:card:p-tang:v1', cardId: 'p-tang', name: 'P. Tang', requirement: 'Win 4 full fights', metric: 'matchWins' as const, required: 4 },
  ...KUMITE_CARD_REWARDS.slice(5),
] as const;

const definitions = [
  ['bushedo-brown', 'Bushedo Brown', 'Rare', 'Air', 3, 3, 'Personal Security', 'On Reveal: Protect your weakest other ally here. If the strongest enemy here has more Hands than Bushedo Brown, give that enemy -1 Hand.', 'Support', '#c5daf5'],
  ['franklin-duke', 'Franklin Duke', 'Epic', 'Light', 4, 4, 'Read The Strike', 'On Reveal: If the strongest enemy here has more Hands than Franklin Duke, give that enemy -2 Hands and gain +2 Hands if the hit lands. Otherwise, give your weakest ally in another district +1 Hand.', 'Pressure', '#fbd85b'],
  ['chonk-lee', 'Chonk Lee', 'Legendary', 'Earth', 5, 5, 'No Mercy', 'On Reveal: Give the strongest enemy in each other district -1 Hand. Gain +1 Hand for each enemy actually hit, up to +2. Protection and immunity can block the hit and its gain.', 'Disruption', '#d75943'],
] as const;

export const kumiteCardRarities: Record<string, CardRarity> = Object.fromEntries(definitions.map(([id, , rarity]) => [id, rarity]));
export const kumiteCardUpgradeEffects: Record<string, readonly AbilityUpgradeEffect[]> = Object.fromEntries(definitions.map(([id]) =>
  [id, [0, 1, 2].map(() => ({ kind: 'self-power' as const, amount: 1 as const, trigger: 'base-success' as const }))]));
export const kumiteCards: Record<string, Card> = Object.fromEntries(definitions.map(([id, name, , type, cost, power, ability, effect, role, accent]) =>
  [id, { id, name, type, cost, power, ability, effect, kind: 'character', roles: [role], artworkLayout: 'portrait',
    entryVfx: { accent }, portraitAccent: accent,
    abilityUpgrades: [2, 5, 8].map((unlockLevel, index) => ({ id: `${id}:upgrade:${index + 1}`,
      name: `${ability} ${['Practice', 'Discipline', 'Mastery'][index]}`, unlockLevel,
      description: 'After the printed ability succeeds, gain +1 Hand.', effect: kumiteCardUpgradeEffects[id][index] })),
  }]));
