import type { AbilityUpgradeEffect, Card, CardRarity } from './data';
import type { Lane } from './gameEngine';

/**
 * Triple OG set. The two Triple OGs are set leaders and neither can be talked
 * down (their reveal ignores Silence). Blue stays on the left and Red stays
 * on the right, though both may enter their home district through location locks.
 * Initiation marks a district so the next character played there joins the set
 * already standing in it. The two inmates are the cheap street-level pieces.
 */
export type GangColor = 'blue' | 'red';

/** Cards that count as a set presence for Initiation, including the existing story gangers. */
export const GANG_BY_CARD_ID: Record<string, GangColor> = {
  'triple-og-blue': 'blue', 'look-out': 'blue', blueside1: 'blue', 'ganger-blue': 'blue',
  'triple-og-red': 'red', 'block-spinner': 'red', redside1: 'red', 'ganger-red': 'red',
};

export const GANG_LABEL: Record<GangColor, string> = { blue: 'Blue Set', red: 'Red Set' };
export const GANG_ACCENT: Record<GangColor, string> = { blue: '#2f6fe0', red: '#d3352f' };

/** Home-side lanes for the two mythical leaders. */
export const TRIPLE_OG_LANE: Record<string, Lane> = { 'triple-og-blue': 0, 'triple-og-red': 2 };
/** True only for the two Mythical Triple OGs; legacy side OGs keep ordinary placement rules. */
export const isMythicalTripleOg = (cardId: string): boolean =>
  cardId === 'triple-og-blue' || cardId === 'triple-og-red';
/** Neither OG's reveal can be shut down by Silence, Freeze, or Weaken. */
export const UNSILENCEABLE_CARD_IDS = ['triple-og-blue', 'triple-og-red'] as const;
/** The Blue OG never loses Hands, matching OG Blue's existing protection. */
export const CANNOT_LOSE_HANDS_CARD_IDS = ['blueside1', 'triple-og-blue'] as const;

const definitions = [
  ['triple-og-blue', 'triple-og-blue', 'CLUE COOKY', 'Mythical', 'Water', 4, 6, 'Homage', 'character',
    "Only playable in the left district, even when its location adds Motion or the lane is locked. On Reveal: If you are losing this district, every other friendly character on the board pays homage — each gives up 1 Hand and CLUE COOKY takes all of it. Then send the weakest enemy here to your strongest district with -1 Hand. CLUE COOKY cannot lose Hands, and this ability cannot be Silenced.",
    'Pressure'],
  ['triple-og-red', 'triple-og-red', 'RED PUNCH', 'Mythical', 'Fire', 4, 3, 'Roll Call', 'character',
    "Only playable in the right district, even when its location adds Motion or the lane is locked. On Reveal: Give every other character in this district, allies included, -1 Hand, and gain +1 Hand for each one that takes it. Anyone RED PUNCH cannot touch is moved to another district out of respect. This ability cannot be Silenced.",
    'Disruption'],
  ['initiation', 'initiation', 'INITIATION', 'Legendary', 'Dark', 1, 0, 'Marked Territory', 'support',
    "On Reveal: Mark this district as your territory. The next character you play here is put on by the set you already have here: it takes their colors and gains +1 Hand. With no set of yours here, it still gains +1 Hand. The mark holds until it is used.",
    'Support'],
  ['block-spinner', 'block-spinner', 'BLOCK SPINNER', 'Epic', 'Fire', 1, 2, 'Spin the Block', 'character',
    'On Reveal: Put 1 Burn on one enemy here, and leave the block spinning: the next enemy played here takes 1 Burn too.',
    'Disruption'],
  ['look-out', 'look-out', 'LOOK OUT', 'Epic', 'Air', 1, 2, 'On Point', 'character',
    'On Reveal: Watch the block. The next district your opponent plays into is called out, and your next card there costs 1 less Motion.',
    'Tempo'],
] as const;

export const tripleOgIds = definitions.map(([engineId]) => engineId);

export const tripleOgRarities: Record<string, CardRarity> = Object.fromEntries(
  definitions.map(([engineId, , , rarity]) => [engineId, rarity]),
);

export const tripleOgUpgradeEffects: Record<string, readonly AbilityUpgradeEffect[]> = Object.fromEntries(
  definitions.map(([engineId]) => [engineId, [0, 1, 2].map(() => engineId === 'initiation'
    ? { kind: 'target-power' as const, amount: 1 as const, target: 'friendly' as const, trigger: 'base-success' as const }
    : { kind: 'self-power' as const, amount: 1 as const, trigger: 'base-success' as const })]),
);

export const tripleOgCards: Record<string, Card> = Object.fromEntries(definitions.map(
  ([engineId, id, name, , type, cost, power, ability, kind, effect, role]) => [engineId, {
    id, name, type, cost, power, ability, effect, kind, roles: [role],
    artworkLayout: 'portrait' as const,
    entryVfx: { accent: GANG_ACCENT[GANG_BY_CARD_ID[id] ?? 'blue'] },
    portraitAccent: id === 'initiation' ? '#8c1f2b' : GANG_ACCENT[GANG_BY_CARD_ID[id] ?? 'blue'],
    abilityUpgrades: [2, 5, 8].map((unlockLevel, index) => ({
      id: `${engineId}:upgrade:${index + 1}`,
      name: `${ability} ${['Practice', 'Confidence', 'Mastery'][index]}`,
      description: tripleOgUpgradeEffects[engineId][index].kind === 'target-power'
        ? 'After the base ability succeeds, one affected ally gains +1 Hand.'
        : 'After the base ability succeeds, this card gains +1 Hand.',
      unlockLevel, effect: tripleOgUpgradeEffects[engineId][index],
    })),
  }],
));
