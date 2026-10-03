import type { AbilityUpgradeEffect, Card, CardRarity } from './data';

/** Squabblehouse collection identities and authored combat summaries. */
export const SQUABBLEHOUSE_WAVE = [
  ['squabblehouse-security', 'SquabbleHouse Security', 'Legendary', 'Normal', 3, 4, 'Keep the Peace',
    'On Reveal: The strongest enemy here loses 2 Hands. Ongoing: the first enemy played or moved into this district each round loses 1 Hand, and Security gains 1 Hand. Protection, immunity, and movement locks can stop the hostile effect.'],
  ['squabblehouse-teknician', 'SquabbleHouse Teknician', 'Mythical', 'Electric', 5, 5, 'Run It Back',
    'On Reveal: Repeat the latest other friendly Squabblehouse staff On Reveal once (including Bus Boy, Cashier, and Waffle Warlord). The first other staff played into this district each round also repeats its On Reveal once. No eligible staff means no repeat; ongoing Janitor, dogs, and Teknicians are excluded.'],
  ['griddle-master', 'SquabbleHouse Griddle Master', 'Rare', 'Fire', 3, 3, 'Hot Off the Griddle',
    'On Reveal: Hit strongest enemy: strip Protection; deal 3 (5 if burning) damage + 1 Burn. Immunity/defenses apply.'],
  ['inmate-reformed', 'SquabbleHouse Inmate Reformed', 'Rare', 'Normal', 3, 3, 'Second Chance',
    'On Reveal: If another friendly Squabblehouse staff member is here, gain 2 Hands. The strongest enemy here loses 1 Hand either way. Protection and immunity can block the hostile effect.'],
  ['squabblehouse-bus-boy', 'SquabbleHouse Bus Boy', 'Uncommon', 'Water', 1, 2, 'Clear the Table',
    'On Reveal: Move your lowest-Hands other friendly Squabblehouse staff member here to your weakest other district; if it arrives, it gains +1 Hand. Ongoing: At round start, attempt one counterable move to an adjacent lane, reversing direction at the edges. After a successful arrival, cleanse Weakened from all other friendly characters there and give the weakest other friendly character there +1 Hand. Frozen, locked, detained, movement-locked, or full destinations can stop a move.'],
  ['squabblehouse-cashier', 'SquabbleHouse Cashier', 'Rare', 'Earth', 2, 3, 'Pay Your Tab',
    'On Reveal: Through next round: lock strongest enemy character (no moves/returns); Open Tab stops one legal enemy exit/return/round. Arrivals ignored. Defenses apply; echoes extend expiry, never recharge.'],
  ['waffle-warlord', 'SquabbleHouse Waffle Warlord', 'Legendary', 'Fire', 5, 5, 'All-Star Hands',
    'On Reveal: Give the weakest other friendly Squabblehouse staff member in each staffed district +1 Hand, or +2 Hands if you have staff in all three districts. Waffle Warlord is excluded from its own bonus.'],
  ['cane-corso-red', 'Cane Corso (Red)', 'Rare', 'Fire', 2, 3, 'Red-Line Bodyguard',
    'When played, walk one adjacent lane toward your Red Triple OG. On Reveal and at each round start: while in your Red Triple OG’s district, the strongest enemy here loses 1 Hand once this round. Walk one adjacent lane toward Red OG at round start. If Red OG is attacked, jump to it from anywhere and tank one counterable attack per round. Disabled or movement-locked dogs cannot jump.'],
  ['blue-nose-pit', 'Blue-Nose Pit', 'Rare', 'Water', 2, 2, 'Blue-Nose Backup',
    'When played, walk one adjacent lane toward your Blue Triple OG. On Reveal and at each round start: while in your Blue Triple OG’s district, give it +1 Hand and your weakest Blue Set ally in another district +2 Hands, once this round. Walk one adjacent lane toward Blue OG at round start. If Blue OG is attacked, jump to it from anywhere and tank one counterable attack per round. Disabled or movement-locked dogs cannot jump; Blue OG keeps its immunity to Hands loss.'],
] as const;

export const squabblehouseRarityById: Record<string, CardRarity> = Object.fromEntries(
  SQUABBLEHOUSE_WAVE.map(([id, , rarity]) => [id, rarity]),
);

/** Keep this distinct from the engine's matching OG rules; faction is catalog metadata. */
export const squabblehouseFactionById: Record<string, string> = Object.fromEntries(
  SQUABBLEHOUSE_WAVE.map(([id]) => [id, 'Squabblehouse']),
);
export const squabblehouseStaffCardIds = new Set([
  'squabblehouse-security', 'squabblehouse-teknician', 'griddle-master', 'inmate-reformed',
  'squabble-house-manager', 'squabblehouse-bus-boy', 'squabblehouse-cashier', 'waffle-warlord', 'janitor',
  'squabblecook', 'squabbleserver',
]);

export const squabblehouseUpgradeEffects: Record<string, readonly AbilityUpgradeEffect[]> = Object.fromEntries(
  SQUABBLEHOUSE_WAVE.map(([id]) => [id, [0, 1, 2].map(() => ({
    kind: 'self-power' as const, amount: 1 as const, trigger: 'base-success' as const,
  }))]),
);

export const squabblehouseWaveCards: Record<string, Card> = Object.fromEntries(
  SQUABBLEHOUSE_WAVE.map(([id, name, , type, cost, power, ability, effect]) => [id, {
    id, name, type, cost, power, ability, effect, kind: 'character', roles: ['Pressure'], artworkLayout: 'portrait',
    abilityUpgrades: [2, 5, 8].map((unlockLevel, index) => ({
      id: `${id}:upgrade:${index + 1}`,
      name: `${ability} ${['Practice', 'Confidence', 'Mastery'][index]}`,
      description: `After ${ability} succeeds, this card gains +1 Hand (once per match).`,
      unlockLevel,
      effect: squabblehouseUpgradeEffects[id][index],
    })),
  }]),
);
