import { CONTROL_ADAPTERS } from './breakthroughControl';
import { SPECIAL_ADAPTERS } from './breakthroughSpecials';
import { FACTION_ADAPTERS } from './breakthroughFactions';
import { CONTRACT_ADAPTERS } from './breakthroughContracts';
import { REACTION_ADAPTERS } from './breakthroughReactions';
import { SUMMON_ADAPTERS } from './breakthroughSummons';
import { HOUSE_ADAPTERS } from './breakthroughHouse';
import { NEIGHBORHOOD_ADAPTERS } from './breakthroughNeighborhood';
import { BLOCKBUSTER_ADAPTERS } from './breakthroughBlockbusters';
import { COMMUNITY_ADAPTERS } from './breakthroughCommunity';
import { MUSIC_ADAPTERS } from './breakthroughMusic';
import { FITNESS_ADAPTERS } from './breakthroughFitness';
import { NETWORK_ADAPTERS } from './breakthroughNetwork';
import { SUPPORT_ADAPTERS } from './breakthroughSupports';
import {
  MUSIC_CHARACTER_IDS,
  FITNESS_CHARACTER_IDS,
} from './musicIndustryWave';
import { FAMILY_IDS } from './selectedWave';
import { HOMELESS_CHARACTER_IDS } from './homelessFamily';
import { squabblehouseStaffCardIds } from './squabblehouseWave';
import { GANG_BY_CARD_ID } from './tripleOgs';
import {
  cardCatalog,
  starterRecipes,
  validateSavedDeck,
  type CatalogCard,
} from './data';
import {
  ABILITY_DESCRIPTIONS,
  BREAKTHROUGH_RULESET,
  type FighterDefinition,
} from './breakthrough';
import {
  BREAKTHROUGH_RULE_INPUT_SHA256,
  evaluateBreakthroughRelease,
} from './breakthroughRelease';

/** Canonical IDs and explicit reviewed mechanics only. Stats, names, printed rules,
 * elements and art identity always come from the final catalog after overrides. */
type Adapter = Pick<
  FighterDefinition,
  | 'ability'
  | 'action'
  | 'tacticalRoles'
  | 'triggers'
  | 'choice'
  | 'cannotLoseHands'
  | 'cannotBeSilenced'
  | 'allowedLanes'
>;
export const BREAKTHROUGH_ADAPTERS: Readonly<Record<string, Adapter>> = {
  'bushedo-brown': {
    ability: 'personal-security',
  },
  'franklin-duke': {
    ability: 'read-the-strike',
  },
  'chonk-lee': {
    ability: 'no-mercy',
  },
  'dragonfly-jones': {
    ability: 'secret-technique',
  },
  'undercova-brotha': {
    ability: 'inside-man',
  },
  'sho-nuff': {
    ability: 'whos-the-master',
  },
  leroy: {
    ability: 'golden-glow',
  },
  yasuke: {
    ability: 'black-blade',
  },
  hooper: {
    ability: 'ankle-breaker',
  },
  'racially-ambiguous-transplant': {
    ability: 'new-here',
  },
  'homeless-yn': {
    ability: 'still-standing',
  },
  plug: {
    ability: 'connections',
  },
  'pinay-nurse': {
    ability: 'check-in',
  },
  'all-jokes-roaster': {
    ability: 'ratios-receipts',
  },
  kyle: {
    ability: 'smile-bombs',
  },
  abuela: {
    ability: 'eat-something',
  },
  guap: {
    ability: 'finnam',
  },
  buddy: {
    ability: 'buddy-buds',
  },
  'snow-bunny': {
    ability: 'cold-shoulder',
  },
  teacher: {
    ability: 'still-rapping',
  },
  cornball: {
    ability: 'small-time-heat',
    tacticalRoles: ['control'],
  },
  rastamon: {
    ability: 'good-vibes',
    tacticalRoles: ['support'],
  },
  edgar: {
    ability: 'hairline-link',
    tacticalRoles: [],
  },
  nguyen: {
    ability: 'squad-check',
    tacticalRoles: [],
  },
  'man-man': {
    ability: 'deep-crew',
    tacticalRoles: [],
  },
  'og-uncle': {
    ability: 'old-head',
    tacticalRoles: [],
  },
  'young-bull': {
    ability: 'bull-rush',
    tacticalRoles: ['control'],
  },
  'bikelife-yn': {
    ability: 'ride-out',
    tacticalRoles: [],
  },
  'cool-vibe-yn': {
    ability: 'bring-the-vibe',
    tacticalRoles: ['support'],
  },
  'water-boy': {
    ability: 'water-break',
    tacticalRoles: ['support'],
  },
  'dr-fade': {
    ability: 'fade-and-coach',
    tacticalRoles: ['support', 'control'],
  },
  'officer-oink': {
    ability: 'badge-sweep',
    tacticalRoles: ['control'],
  },
  folks: {
    ability: 'whole-block-hot',
    tacticalRoles: ['support', 'control'],
  },
  'block-party-titan': {
    ability: 'block-party',
    tacticalRoles: ['support'],
  },
  'john-henry': {
    ability: 'iron-driver',
    tacticalRoles: [],
  },
  'mr-mc-hands': {
    ability: 'double-knuckle',
    tacticalRoles: ['control'],
  },
  'big-zoey': {
    ability: 'big-zoey-transfer',
    tacticalRoles: ['support', 'control'],
  },
  'barber-bro': {
    ability: 'clean-cut',
    tacticalRoles: ['support', 'control'],
  },
  'church-auntie': {
    ability: 'church-shield',
    tacticalRoles: ['support'],
  },
  wifey: {
    ability: 'side-eye',
    tacticalRoles: ['support', 'control'],
  },
  'bus-pass': {
    ability: 'transfer-ticket',
    action: {
      target: 'none',
      requiresFriendlyFighter: false,
    },
    tacticalRoles: ['support'],
  },
  'soul-food': {
    ability: 'full-plate',
    action: {
      target: 'weakest-afflicted-ally',
      requiresFriendlyFighter: true,
    },
    tacticalRoles: ['support'],
  },
  'cognac-bottle': {
    ability: 'liquid-courage',
    action: {
      target: 'weakest-ally',
      requiresFriendlyFighter: true,
    },
    tacticalRoles: ['support'],
  },
  'baby-momma': {
    ability: 'mama-bear',
    tacticalRoles: ['control'],
  },
  'closet-nerd': {
    ability: 'unaware',
    tacticalRoles: ['control'],
  },
  ...SUPPORT_ADAPTERS,
  ...NETWORK_ADAPTERS,
  ...FITNESS_ADAPTERS,
  ...MUSIC_ADAPTERS,
  ...COMMUNITY_ADAPTERS,
  ...BLOCKBUSTER_ADAPTERS,
  ...HOUSE_ADAPTERS,
  ...NEIGHBORHOOD_ADAPTERS,
  ...SUMMON_ADAPTERS,
  ...REACTION_ADAPTERS,
  ...CONTRACT_ADAPTERS,
  ...FACTION_ADAPTERS,
  ...CONTROL_ADAPTERS,
  ...SPECIAL_ADAPTERS,
};
export interface BreakthroughCompatibility {
  cardId: string;
  name: string;
  kind: string;
  supported: boolean;
  reason: string | null;
}
export function breakthroughCardCompatibility(
  cardId: string,
): BreakthroughCompatibility {
  const card = cardCatalog.find((c) => c.catalogId === cardId),
    adapter = BREAKTHROUGH_ADAPTERS[cardId];
  if (!card)
    return {
      cardId,
      name: cardId,
      kind: 'unknown',
      supported: false,
      reason: 'Unknown canonical card ID.',
    };
  const kind = card.kind ?? 'character';
  const supported =
    !!adapter &&
    !!adapter.ability &&
    adapter.ability !== 'none' &&
    !!ABILITY_DESCRIPTIONS[adapter.ability] &&
    ((kind === 'character' && card.power > 0) ||
      ((kind === 'support' || kind === 'blockbuster') &&
        card.power === 0 &&
        (kind === 'blockbuster' || !!adapter.action)));
  const reason = supported
    ? null
    : kind === 'token'
      ? 'Tokens cannot enter a saved crew.'
      : kind === 'blockbuster'
        ? 'Blockbuster actions do not have a reviewed Breakthrough conversion.'
        : kind === 'support'
          ? 'This support has no reviewed Breakthrough action.'
          : 'This fighter has no reviewed Breakthrough ability conversion.';
  return { cardId, name: card.name, kind, supported, reason };
}
export const BREAKTHROUGH_COMPATIBILITY: readonly BreakthroughCompatibility[] =
  cardCatalog.map((c) => breakthroughCardCompatibility(c.catalogId));
export function buildBreakthroughRoster(
  resolveArt: (card: CatalogCard) => string = (card) =>
    `/assets/characters/${card.artworkId}.webp`,
): FighterDefinition[] {
  return Object.keys(BREAKTHROUGH_ADAPTERS).map((id) => {
    const card = cardCatalog.find((c) => c.catalogId === id),
      adapter = BREAKTHROUGH_ADAPTERS[id];
    if (
      !card ||
      !breakthroughCardCompatibility(id).supported ||
      !adapter.ability
    )
      throw new Error(`Invalid Breakthrough adapter: ${id}`);
    return {
      id: card.catalogId,
      name: card.name,
      cost: card.cost,
      hands: card.power,
      kind:
        card.kind === 'support' || card.kind === 'blockbuster'
          ? card.kind
          : 'character',
      ...(adapter.choice ? { choice: adapter.choice } : {}),
      element: card.type,
      engineId: card.engineId,
      faction: card.faction,
      crewTags: [...new Set(card.crewTags)],
      traits: [
        ...(MUSIC_CHARACTER_IDS.includes(card.engineId)
          ? ['music' as const]
          : []),
        ...(FITNESS_CHARACTER_IDS.includes(card.engineId)
          ? ['fitness' as const]
          : []),
        ...(FAMILY_IDS.includes(card.engineId) ? ['family' as const] : []),
        ...((HOMELESS_CHARACTER_IDS as readonly string[]).includes(
          card.engineId,
        )
          ? ['homeless' as const]
          : []),
        ...(squabblehouseStaffCardIds.has(card.engineId)
          ? ['squabblehouse' as const]
          : []),
      ],
      ...(GANG_BY_CARD_ID[card.engineId]
        ? { gangColor: GANG_BY_CARD_ID[card.engineId] }
        : {}),
      triggers: adapter.triggers
        ? [...adapter.triggers]
        : [
              'home-advantage',
              'keep-the-peace',
              'run-it-back',
              'clear-the-table',
            ].includes(adapter.ability ?? '')
          ? ['entrance', 'ongoing']
          : [
                'compound-interest',
                'network-boost',
                'buddy-buds',
                'inside-man',
                'side-eye',
                'church-shield',
                'bodyweight',
                'double-dutch',
                'one-more-rep',
                'no-days-off',
                'one-last-shot',
                'next-up',
                'tour-money',
                'sixteen-bars',
                'everybody-watching',
                'save-me-some',
                'still-hot',
                'big-sister',
                'built-different',
                'home-advantage',
                'keep-the-peace',
                'run-it-back',
                'clear-the-table',
                'turn-it-around',
              ].includes(adapter.ability ?? '')
            ? ['ongoing']
            : ['city-tour', 'no-equipment-needed', 'whole-set'].includes(
                  adapter.ability ?? '',
                )
              ? ['entrance', 'ongoing', 'held']
              : ['entrance'],
      abilityName: card.ability,
      printedDescription: card.effect,
      ability: adapter.ability,
      ...(adapter.cannotLoseHands ? { cannotLoseHands: true } : {}),
      ...(adapter.cannotBeSilenced ? { cannotBeSilenced: true } : {}),
      ...(adapter.allowedLanes
        ? { allowedLanes: [...adapter.allowedLanes] }
        : {}),
      description: ABILITY_DESCRIPTIONS[adapter.ability],
      art: resolveArt(card),
      ...(adapter.action
        ? { action: { ...adapter.action } }
        : card.kind === 'blockbuster'
          ? {
              action: {
                target: 'none' as const,
                requiresFriendlyFighter: false,
              },
            }
          : {}),
      ...(adapter.tacticalRoles
        ? { tacticalRoles: [...adapter.tacticalRoles] }
        : {}),
    };
  });
}
export const BREAKTHROUGH_ROSTER = buildBreakthroughRoster();
export function resolveBreakthroughCard(
  cardId: string,
): FighterDefinition | undefined {
  return BREAKTHROUGH_ROSTER.find((c) => c.id === cardId);
}
export function validateBreakthroughDeck(
  cardIds: string[],
  ownedCardIds: string[],
  heroCardId?: string | null,
) {
  const base = validateSavedDeck(cardIds, ownedCardIds, heroCardId);
  const unsupportedCards = cardIds
    .map(breakthroughCardCompatibility)
    .filter((c) => !c.supported && c.kind !== 'unknown')
    .map((c) => ({ cardId: c.cardId, name: c.name, reason: c.reason! }));
  return {
    ...base,
    valid: base.valid && unsupportedCards.length === 0,
    issues: [
      ...base.issues,
      ...unsupportedCards.map((c) => `${c.name}: ${c.reason}`),
    ],
    unsupportedCardIds: unsupportedCards.map((c) => c.cardId),
    unsupportedCards,
  };
}
export const BREAKTHROUGH_STARTER_IDS = [
  'block',
  'slide',
  'receipts',
  'crashout',
  'vibes',
  'compound',
  'combo',
  'voltage',
  'fitness-circuit',
  'fitness-routes',
  'music-tour',
  'music-industry',
  'sunday-dinner',
  'community-table',
  'squabblehouse-shift',
] as const;
export const BREAKTHROUGH_STARTER_DECKS = starterRecipes.filter((recipe) =>
  (BREAKTHROUGH_STARTER_IDS as readonly string[]).includes(recipe.id),
);

/** Reconciled against final canonical definitions on every admission; newly added cards fail closed. */
export function getBreakthroughLaunchCoverage() {
  return {
    ruleset: BREAKTHROUGH_RULESET,
    catalogSignature: JSON.stringify([
      BREAKTHROUGH_RULESET,
      BREAKTHROUGH_RULE_INPUT_SHA256,
      cardCatalog,
      BREAKTHROUGH_ADAPTERS,
    ]),
    cards: BREAKTHROUGH_COMPATIBILITY.map((card) => ({
      cardId: card.cardId,
      supported:
        card.supported &&
        !!BREAKTHROUGH_ADAPTERS[card.cardId]?.ability &&
        BREAKTHROUGH_ADAPTERS[card.cardId].ability !== 'none',
    })),
  };
}
export function getBreakthroughLaunchReadiness() {
  return evaluateBreakthroughRelease(getBreakthroughLaunchCoverage());
}
