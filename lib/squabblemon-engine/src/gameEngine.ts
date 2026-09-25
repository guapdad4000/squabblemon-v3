import { canonicalElement, cards, catalogCardByEngineId, catalogIdsToEngineIds, decks, DECK_SIZE, MAX_MOTION, districts as legacyDistricts, type Card, type Deck } from './data';
import { validateDistrictSnapshot, type DistrictSnapshot, type DistrictDisplay } from './districts';
import { expansionCards } from './blockExpansion';
import { streetWaveCards } from './streetWave';
import { mythicLegendCards } from './mythicLegends';
import { characterWaveCards } from './characterWave';
import { fairytaleCards } from './fairytaleWave';
import { neighborhoodWaveCards, DEMARIO_MUSHROOM, LUIGION_POWERED } from './neighborhoodWave';
import { cellblockWaveCards } from './cellblockWave';
import { afterHoursWaveCards } from './afterHoursWave';
import { elementalBondWaveCards } from './elementalBondWave';
export { createDistrictSnapshot, validateDistrictSnapshot, DISTRICT_CATALOG } from './districts';
export type { DistrictSnapshot, DistrictId, DistrictDisplay } from './districts';
import {
  createAbilityUpgradeSnapshot, snapshotUpgradesForCard, validateAbilityUpgradeSnapshot,
  type AbilityUpgradeSnapshot,
} from "./abilityUpgrades";
import type { CardProgressionMap } from "./cardProgression";
export {
  createAbilityUpgradeSnapshot, snapshotUpgradesForCard, unlockedAbilityUpgrades,
  validateAbilityUpgradeSnapshot, ABILITY_UPGRADE_SNAPSHOT_VERSION,
} from "./abilityUpgrades";
export type { AbilityUpgradeSnapshot, CardAbilityUpgradeSnapshot } from "./abilityUpgrades";

export type Owner = 'player' | 'cpu';
export type Phase = 'player' | 'cpu-reveal' | 'resolved' | 'complete';
export type Lane = 0 | 1 | 2;
export type StoryTrigger =
  | { readonly kind: "round"; readonly atLeast: number }
  | { readonly kind: "total-power"; readonly owner: Owner; readonly atLeast: number }
  | { readonly kind: "districts-held"; readonly owner: Owner; readonly atLeast: number };
export type StoryEffect =
  | { readonly kind: "motion"; readonly owner: Owner; readonly amount: number }
  | { readonly kind: "reinforcement"; readonly owner: Owner; readonly cardId: string }
  | { readonly kind: "lane-power"; readonly owner: Owner | "both"; readonly lane: Lane; readonly amount: number }
  | { readonly kind: "lane-lock"; readonly owner: Owner | "both"; readonly lanes: readonly Lane[] };
export const DEFAULT_MATCH_ROUND_LIMIT = 6;
export type StoryObjectiveCriterion =
  | { readonly kind: "win" }
  | { readonly kind: "districts-held"; readonly owner: Owner; readonly atLeast: number }
  | { readonly kind: "specific-districts-held"; readonly owner: Owner; readonly lanes: readonly Lane[] }
  | { readonly kind: "squabble-used"; readonly owner: Owner; readonly used: boolean }
  | { readonly kind: "motion-remaining"; readonly owner: Owner; readonly atLeast: number }
  | { readonly kind: "cards-moved"; readonly owner: Owner; readonly atLeast: number };
export type StoryStarObjective = {
  readonly id: string;
  readonly description: string;
  /** Missing only on encounters saved before objective criteria were introduced. */
  readonly criterion?: StoryObjectiveCriterion;
};
export type StoryEncounterSnapshot = {
  readonly id: string;
  readonly activity?: { readonly kind: string; readonly seed: string; readonly normalized: boolean; readonly previousCardIds?: readonly string[] };
  readonly enemy: {
    readonly id: string;
    readonly name: string;
    readonly portraitAssetId: string;
    readonly deckId: string;
    readonly cardIds: readonly string[];
    readonly behaviorProfile: string;
  };
  readonly battlefieldAssetId: string;
  readonly cinematic?: {
    readonly videoAssetId: string;
    readonly posterAssetId: string;
    readonly environmentAssetId: string;
  };
  readonly passive?: {
    readonly name: string;
    readonly description: string;
  };
  readonly soundHooks: Readonly<Record<string, string>>;
  /** Defaults to six for legacy snapshots and standard matches. */
  readonly roundLimit?: number;
  readonly modifiers?: {
    readonly startingMotion?: Partial<Readonly<Record<Owner, number>>>;
    readonly handSize?: Partial<Readonly<Record<Owner, number>>>;
    readonly laneLocks?: readonly { readonly round: number; readonly owner: Owner | "both"; readonly lanes: readonly Lane[] }[];
    readonly roundMotionDeltas?: readonly { readonly round: number; readonly owner: Owner; readonly amount: number }[];
    readonly lanePowerBonuses?: readonly { readonly owner: Owner | "both"; readonly lane: Lane; readonly amount: number }[];
    readonly reinforcements?: readonly { readonly round: number; readonly owner: Owner; readonly cardId: string }[];
  };
  readonly phases?: readonly {
    readonly id: string;
    readonly name: string;
    readonly description?: string;
    readonly trigger: StoryTrigger;
    readonly onEnter?: readonly StoryEffect[];
  }[];
  readonly starObjectives?: readonly StoryStarObjective[];
};
export type StoryRuntime = {
  activePhaseIndex: number;
  appliedEffectIds: string[];
  lanePowerBonuses: { owner: Owner | "both"; lane: Lane; amount: number }[];
  laneLocks: { owner: Owner | "both"; lanes: Lane[] }[];
};
export type Statuses = { frozen: boolean; silenced: boolean; protected: boolean; blocked: boolean; uncounterable: boolean; weakened: boolean; locked: boolean; boosted: boolean; burnStacks: number };
export type CardInstance = Card & {
  instanceId: string; cardId: string; owner: Owner; lane: Lane | null; playedRound: number | null;
  basePower: number; powerModifier: number; moved: boolean; statuses: Statuses; lastEffectNote: string;
  /** Imposter keeps Scammer's identity/artwork while adopting a printed passive. */
  copiedAbilityCardId?: string;
  networkBoosts?: number;
  /** Homeless Legend may refuse destruction once per match. */
  legendSaved?: boolean;
  recoverableDamage?: number;
  idolId?: string;
  fanRound?: number;
  waveTrainingUsed?: boolean;
  /** A Luigion deployment can consume only one Mushroom, never from an echo. */
  luigionMushroomUsed?: boolean;
  waveOnce?: Partial<Record<'alice' | 'bonnetgirl' | 'undercova' | 'oz', boolean>>;
  waveRounds?: Partial<Record<'tinman' | 'lion' | 'ronald' | 'trapvamp' | 'squabblecook', number>>;
  aliceReady?: boolean;
  bankedMotion?: number;
  burnSource?: { instanceId: string; owner: Owner };
  wildInvestment?: number;
  wildEmptyWallet?: boolean;
  /** Owner is the occupied enemy side; sourceOwner receives any kill credit. */
  smileBomb?: { sourceInstanceId: string; sourceOwner: Owner; detonatesAtRound: number };
  /** One FINNAM! resolution per owner per round, including echoes. */
  guapRound?: number;
};

export type EffectKind = 'ability' | 'fire' | 'water' | 'move' | 'blocked' | 'story';
export type EffectLogEntry = {
  sequence: number; round: number; type: EventType; timing: 'instant' | 'timed';
  duration: EventDuration | null; source: EventParticipant | null; targets: EventParticipant[];
  scores: { before: ScoreState[]; after: ScoreState[] };
  resources: { before: ResourceState; after: ResourceState };
  state: { before: RoundState; after: RoundState };
  replay: { before: ReplayState; after: ReplayState };
  // Kept as presentation fields so existing battle UI can consume the authoritative event stream.
  cardInstanceId: string; cardId: string; owner: Owner; lane: Lane; kind: EffectKind; note: string;
  /** Present only for a card-growth upgrade resolution, never client supplied. */
  abilityMetadata?: {
    readonly upgradeId: string; readonly upgradeName: string; readonly sourceCardId: string;
    readonly sourceInstanceId: string; readonly targetInstanceIds: readonly string[];
    readonly result: "applied";
  };
};
export type ReplayState = Pick<Match,
  'round' | 'phase' | 'playerHand' | 'cpuHand' | 'boards' | 'playerMotion' | 'cpuMotion' |
  'playerDrawIndex' | 'cpuDrawIndex' | 'squabbleUsed' | 'plugDiscountLane' |
  'cheapBuffsUsed' | 'timedEffects' | 'discountTokens' | 'nextDiscountOrder' | 'landlordTaxUsed' |
  'districtTraps' | 'janitorReversals' | 'lastMovedAlly' | 'roundMovedIds' | 'entranceHistory' | 'guapRounds' | 'cheshireRounds' | 'electricPlays' | 'leaderRounds' | 'pendingLeaderReactions' | 'lingeringScents' | 'sneakerTriggered' | 'storyRuntime' | 'abilityUpgradeSnapshot' | 'squabbleByOwner' | 'districtSnapshot' | 'districtRuntime'
>;

export type TimedEffect = {
  id: string; kind: 'wifey-protection' | 'church-protection' | 'nail-mitigation' | 'salon-protection'; sourceInstanceId: string; owner: Owner; lane: Lane;
  targetInstanceId?: string; startsAtRound: number; expiresAtRound: number; expiration: 'round-start' | 'match-complete';
};
export type DiscountToken = {
  id: string; owner: Owner; sourceInstanceId: string; eligibility: 'any' | 'printed-two-cost' | 'printed-four-plus' | 'another-district' | 'electric-delivery' | 'homecoming' | 'poison-character';
  targetLane?: Lane;
  targetInstanceId?: string;
  sourceLane: Lane | null; createdOrder: number;
  expiresAfterRound?: number;
};
export type DistrictRuntime = {
  plays: Record<Owner, [number, number, number]>;
  roundPlays: Record<Owner, [number, number, number]>;
  trailing: Record<Owner, [boolean, boolean, boolean]>;
  trappedCardIds: string[];
  detainedCardIds: string[];
};
const freshDistrictRuntime = (): DistrictRuntime => ({
  plays: { player: [0, 0, 0], cpu: [0, 0, 0] }, roundPlays: { player: [0, 0, 0], cpu: [0, 0, 0] },
  trailing: { player: [false, false, false], cpu: [false, false, false] }, trappedCardIds: [], detainedCardIds: [],
});
const SUPPRESS_PRESENTATION_EVENTS = Symbol("squabblemon.search-without-presentation-events");
type LeaderKind = 'church' | 'nightmedic' | 'piratedj' | 'promoter' | 'gamer' | 'counter'
  | 'streetapostle' | 'fangirl' | 'asphaltapostle' | 'passportbro';
type LeaderReaction = { kind: LeaderKind; owner: Owner; sourceInstanceId: string; targetInstanceId: string; amount?: number; triggerLane?: Lane };
export type LingeringScent = { owner: Owner; lane: Lane; source: CardInstance; expiresAfterRound: number; triggeredRound?: number };
export type DistrictTrap = { kind: 'stakeout' | 'dmv' | 'wiseman'; owner: Owner; lane: Lane; source: CardInstance; expiresAfterRound: number };
export type Match = {
  districtTraps?: DistrictTrap[];
  /** One shared Turn It Around trigger per friendly district each round. */
  janitorReversals?: { owner: Owner; lane: Lane; round: number; sourceInstanceId: string; targetInstanceId: string }[];
  lastMovedAlly?: Partial<Record<Owner, { instanceId: string; round: number }>>;
  /** Successful board moves in the current round; unlike CardInstance.moved this expires each round. */
  roundMovedIds?: Record<Owner, string[]>;
  cheshireRounds?: Partial<Record<Owner, number>>;
  /** Per side, per leader ability: copies cannot multiply the once-per-round reward. */
  leaderRounds?: Partial<Record<Owner, Partial<Record<LeaderKind, number>>>>;
  electricPlays?: Partial<Record<Owner, { round: number; count: number }>>;
  /** Reactions settle after the triggering action, separately from its upgrade checks. */
  pendingLeaderReactions?: LeaderReaction[];
  lingeringScents?: LingeringScent[];
  [SUPPRESS_PRESENTATION_EVENTS]?: true;
  /** Absent only for pre-location matches and their legacy transcripts. */
  districtSnapshot?: DistrictSnapshot;
  districtRuntime?: DistrictRuntime;
  /** Present only in human-vs-human matches; solo transcript semantics stay unchanged. */
  squabbleByOwner?: Record<Owner, boolean>;
  round: number; phase: Phase; playerDeck: string; cpuDeck: string; playerHand: CardInstance[]; cpuHand: CardInstance[];
  playerCardIds: string[]; cpuCardIds: string[];
  boards: [CardInstance[], CardInstance[], CardInstance[]]; playerMotion: number; cpuMotion: number;
  playerDrawIndex: number; cpuDrawIndex: number; squabbleUsed: boolean; plugDiscountLane: Record<Owner, Lane | null>;
  cheapBuffsUsed: Record<Owner, number>; effectLog: EffectLogEntry[]; nextEventSequence: number; timedEffects: TimedEffect[];
  discountTokens: DiscountToken[]; nextDiscountOrder: number; landlordTaxUsed: Record<Owner, Record<Lane, boolean>>;
  sneakerTriggered: Record<Owner, boolean>;
  /** Engine-internal Echo primitive. Tracks the last card whose On Reveal resolved this round. */
  lastRevealedCardId: string | null;
  /** Resolved entrance sources retained for Oz's once-per-match historical echo. */
  entranceHistory?: string[];
  guapRounds?: Partial<Record<Owner, number>>;
  storyEncounter?: StoryEncounterSnapshot; storyRuntime?: StoryRuntime;
  abilityUpgradeSnapshot: AbilityUpgradeSnapshot;
};
/** Search copies skip expensive presentation snapshots while preserving rules. */
export function suppressMatchPresentationEvents(match: Match): Match {
  return {
    ...match,
    [SUPPRESS_PRESENTATION_EVENTS]: true,
    effectLog: [],
  };
}
const lane = (n: number): Lane => n as Lane;
const emptyStatuses = (): Statuses => ({ frozen: false, silenced: false, protected: false, blocked: false, uncounterable: false, weakened: false, locked: false, boosted: false, burnStacks: 0 });
const abilityCardId = (card: CardInstance) => card.copiedAbilityCardId ?? card.cardId;
export const createCardInstance = (cardId: string, owner: Owner, deck = 'custom', index = 0): CardInstance => {
  const card = cards[cardId];
  if (!card) throw new Error(`Unknown card ${cardId}`);
  return { ...card, cardId, instanceId: `${owner}:${deck}:${index}:${cardId}`, owner, deck, lane: null, playedRound: null, basePower: card.power, powerModifier: 0, moved: false, statuses: emptyStatuses(), lastEffectNote: 'Ready in hand.' };
};
const deckById = (id: string): Deck => {
  const deck = decks.find((item) => item.id === id);
  if (!deck) throw new Error(`Unknown deck ${id}`);
  return deck;
};

export function createMatch(
  playerDeck: string,
  cpuDeck: string,
  progression?: { readonly player?: CardProgressionMap; readonly cpu?: CardProgressionMap },
  suppliedAbilityUpgradeSnapshot?: AbilityUpgradeSnapshot,
  districtSnapshot?: DistrictSnapshot,
): Match {
  const p = deckById(playerDeck), c = deckById(cpuDeck);
  return createMatchFromEngineCards(p.id, p.cards, c.id, c.cards, undefined, progression, suppliedAbilityUpgradeSnapshot, districtSnapshot);
}

export function createMatchFromEngineCards(
  playerDeck: string,
  playerCardIds: string[],
  cpuDeck: string,
  cpuCardIds: string[],
  storyEncounter?: StoryEncounterSnapshot,
  progression?: { readonly player?: CardProgressionMap; readonly cpu?: CardProgressionMap },
  suppliedAbilityUpgradeSnapshot?: AbilityUpgradeSnapshot,
  districtSnapshot?: DistrictSnapshot,
): Match {
  for (const [owner, ids] of [['Player', playerCardIds], ['CPU', cpuCardIds]] as const) {
    if (ids.length !== DECK_SIZE || new Set(ids).size !== DECK_SIZE) throw new Error(`${owner} deck must contain ten unique cards`);
  }
  for (const cardId of [...playerCardIds, ...cpuCardIds]) {
    if (!cards[cardId]) throw new Error(`Unknown card ${cardId}`);
  }
  const playerHandSize = storyEncounter?.modifiers?.handSize?.player ?? 5;
  const cpuHandSize = storyEncounter?.modifiers?.handSize?.cpu ?? 5;
  const abilityUpgradeSnapshot = suppliedAbilityUpgradeSnapshot
    ? validateAbilityUpgradeSnapshot(suppliedAbilityUpgradeSnapshot, playerCardIds, cpuCardIds)
    : createAbilityUpgradeSnapshot(playerCardIds, cpuCardIds, progression);
  let match: Match = {
    round: 1, phase: "player", playerDeck, cpuDeck,
    playerHand: playerCardIds.slice(0, playerHandSize).map((id, i) => createCardInstance(id, "player", playerDeck, i)),
    cpuHand: cpuCardIds.slice(0, cpuHandSize).map((id, i) => createCardInstance(id, "cpu", cpuDeck, i)),
    playerCardIds: [...playerCardIds], cpuCardIds: [...cpuCardIds],
    boards: [[], [], []],
    playerMotion: Math.min(MAX_MOTION, Math.max(0, storyEncounter?.modifiers?.startingMotion?.player ?? 2)),
    cpuMotion: Math.min(MAX_MOTION, Math.max(0, storyEncounter?.modifiers?.startingMotion?.cpu ?? 2)),
    playerDrawIndex: playerHandSize, cpuDrawIndex: cpuHandSize,
    squabbleUsed: false, plugDiscountLane: { player: null, cpu: null }, cheapBuffsUsed: { player: 0, cpu: 0 },
    effectLog: [], nextEventSequence: 1, timedEffects: [], discountTokens: [], nextDiscountOrder: 1,
    landlordTaxUsed: { player: { 0: false, 1: false, 2: false }, cpu: { 0: false, 1: false, 2: false } },
    sneakerTriggered: { player: false, cpu: false },
    lastRevealedCardId: null,
    roundMovedIds: { player: [], cpu: [] },
    entranceHistory: [],
    guapRounds: {},
    abilityUpgradeSnapshot,
    ...(districtSnapshot ? { districtSnapshot: validateDistrictSnapshot(districtSnapshot), districtRuntime: freshDistrictRuntime() } : {}),
    ...(storyEncounter ? {
      storyEncounter,
      storyRuntime: { activePhaseIndex: -1, appliedEffectIds: [], lanePowerBonuses: [], laneLocks: [] },
    } : {}),
  };
  match = refreshDistrictRound(applyStoryEffects(match));
  return match;
}

export function createMatchFromCatalog(
  playerDeck: string,
  playerCatalogCardIds: string[],
  cpuDeck: string,
  progression?: { readonly player?: CardProgressionMap; readonly cpu?: CardProgressionMap },
  districtSnapshot?: DistrictSnapshot,
): Match {
  const cpu = deckById(cpuDeck);
  return createMatchFromEngineCards(
    playerDeck,
    catalogIdsToEngineIds(playerCatalogCardIds),
    cpu.id,
    cpu.cards,
    undefined,
    progression,
    undefined,
    districtSnapshot,
  );
}

export function getEffectiveCardPower(card: CardInstance): number {
  return card.hazard || card.statuses.frozen ? 0 : Math.max(0, card.basePower + card.powerModifier);
}
export const effectiveCardPower = getEffectiveCardPower;
export function getLaneScore(cardsInLane: CardInstance[], laneIndex: number): number {
  return cardsInLane.reduce((total, card) => {
    if (card.hazard) return total;
    const district = laneIndex === 0 && (card.type === 'Fire' || card.type === 'Dark') ? 2
      : laneIndex === 1 && card.roles?.includes('Disruption') ? 2
      : laneIndex === 2 && card.type === 'Electric' ? 3 : 0;
    return total + getEffectiveCardPower(card) + district;
  }, 0);
}
export function getDistrictCardBonus(card: Pick<CardInstance, "type" | "roles" | "hazard">, laneIndex: Lane): number {
  if (card.hazard) return 0;
  return laneIndex === 0 && (card.type === "Fire" || card.type === "Dark") ? 2
    : laneIndex === 1 && card.roles?.includes("Disruption") ? 2
    : laneIndex === 2 && card.type === "Electric" ? 3
    : 0;
}
export function getStoryLaneBonus(match: Match, owner: Owner, laneIndex: Lane): number {
  const base = match.storyEncounter?.modifiers?.lanePowerBonuses ?? [];
  const entered = match.storyRuntime?.lanePowerBonuses ?? [];
  return [...base, ...entered]
    .filter((bonus) => bonus.lane === laneIndex && (bonus.owner === owner || bonus.owner === "both"))
    .reduce((total, bonus) => total + bonus.amount, 0);
}
export function getLaneScoreForMatch(match: Match, cardsInLane: CardInstance[], laneIndex: Lane, owner?: Owner): number {
  cardsInLane = cardsInLane.filter(card => !card.hazard);
  const resolvedOwner = owner ?? cardsInLane[0]?.owner;
  const power = match.districtSnapshot
    ? cardsInLane.reduce((total, card) => total + getEffectiveCardPower(card) + getDistrictCardBonusForMatch(match, card, laneIndex, cardsInLane), 0)
    : getLaneScore(cardsInLane, laneIndex);
  return power + (resolvedOwner ? getDistrictSharedBonus(match, resolvedOwner, laneIndex, cardsInLane) + getStoryLaneBonus(match, resolvedOwner, laneIndex) : 0);
}
export function getDistrictCardBonusForMatch(match: Match, card: CardInstance, laneIndex: Lane, allies = match.boards[laneIndex].filter(c => c.owner === card.owner)): number {
  if (card.hazard) return 0;
  allies = allies.filter(ally => !ally.hazard);
  if (!match.districtSnapshot) return getDistrictCardBonus(card, laneIndex);
  if (card.statuses.frozen) return 0;
  const effect = match.districtSnapshot.locations[laneIndex].effect;
  if (effect.kind === 'champion-only') {
    const champion = highest(allies.filter(c => !c.statuses.frozen));
    return champion?.instanceId === card.instanceId ? 0 : -getEffectiveCardPower(card);
  }
  if (effect.kind === 'cost-power') return card.cost - getEffectiveCardPower(card);
  if (effect.kind === 'expensive') return card.cost >= effect.minimumCost ? effect.amount : 0;
  if (effect.kind === 'penthouse') return match.round >= effect.changesAtRound ? effect.crew : allies.length === 1 ? effect.solo : 0;
  // Location penalties suppress scoring, never destroy a card or make it negative.
  const penalty = (amount: number) => -Math.min(getEffectiveCardPower(card), amount);
  if (effect.kind === 'dive-discount') return penalty(effect.penalty);
  if (effect.kind === 'spotlight') return allies.at(-1)?.instanceId === card.instanceId ? effect.bonus : penalty(effect.penalty);
  if (effect.kind === 'cheap-crew') return card.cost <= effect.maximumCost ? Math.min(effect.maximumBonus, Math.max(0, allies.length - 1)) : 0;
  if (effect.kind === 'outnumber') {
    const enemies = match.boards[laneIndex].filter(c => !c.hazard && c.owner !== card.owner).length;
    return allies.length > enemies ? effect.bonus : allies.length < enemies ? penalty(effect.penalty) : 0;
  }
  return 0;
}
export function getDistrictSharedBonus(match: Match, owner: Owner, laneIndex: Lane, allies = match.boards[laneIndex].filter(c => c.owner === owner)): number {
  allies = allies.filter(ally => !ally.hazard);
  const effect = match.districtSnapshot?.locations[laneIndex].effect;
  const local = effect?.kind === 'diversity' && new Set(allies.map(c => canonicalElement(c.type))).size >= effect.types ? effect.amount : 0;
  let broadcast = 0;
  for (const [i, district] of (match.districtSnapshot?.locations ?? []).entries()) {
    const rule = district.effect;
    if (i !== laneIndex && rule.kind === 'broadcast'
      && inLane(match, owner, i as Lane).length === rule.requiredAllies) broadcast += rule.amount;
  }
  return local + broadcast;
}
export function getMatchDistricts(match?: Match | null, owner: Owner = 'player'): DistrictDisplay[] {
  if (!match?.districtSnapshot) return legacyDistricts.map((d, i) => ({ ...d, id: `legacy-${i}`, accent: '#fbbf24', status: '' }));
  return match.districtSnapshot.locations.map((d, i) => {
    const effect = d.effect, runtime = match.districtRuntime!;
    let status = '';
    if (effect.kind === 'first-discount') status = runtime.plays[owner][i] ? 'Your discount used' : 'Your first-play discount ready';
    if (effect.kind === 'comeback') status = runtime.roundPlays[owner][i] ? 'First play used this round' : runtime.trailing[owner][i] ? `Your comeback: +${effect.amount} ready` : 'You did not start behind';
    if (effect.kind === 'detain-first') status = runtime.plays[owner][i] ? 'Your first arrival recorded' : 'Your first arrival will be held';
    if (effect.kind === 'penthouse') status = match.round < effect.changesAtRound ? `Solo +${effect.solo} · Gang +${effect.crew} in R${effect.changesAtRound}` : `Party is on · +${effect.crew} per card`;
    if (effect.kind === 'diversity') status = `${new Set(match.boards[i].filter(c => !c.hazard && c.owner === owner).map(c => canonicalElement(c.type))).size}/${effect.types} card types in your gang`;
    if (effect.kind === 'late-arrival') status = match.round < effect.startsAtRound ? `Spotlight starts R${effect.startsAtRound}` : runtime.roundPlays[owner][i] ? 'Your spotlight used this round' : `Your spotlight: +${effect.amount} ready`;
    if (effect.kind === 'subway') status = runtime.roundPlays[owner][i] ? 'Your ride used this round' : `Next stop: ${match.districtSnapshot!.locations[(i + 1) % 3].name}`;
    if (effect.kind === 'outnumber') {
      const allies = match.boards[i].filter(c => !c.hazard && c.owner === owner).length, enemies = match.boards[i].filter(c => !c.hazard).length - allies;
      status = `${allies} vs ${enemies} cards · ${allies > enemies ? `+${effect.bonus}` : allies < enemies ? `−${effect.penalty}` : 'No modifier'}`;
    }
    if (effect.kind === 'spotlight') status = `Spotlight: ${match.boards[i].filter(c => !c.hazard && c.owner === owner).at(-1)?.name ?? 'your next arrival'}`;
    if (effect.kind === 'dive-discount') status = 'Cheap entry · Hands returns when you leave';
    if (effect.kind === 'cheap-crew') status = `Your cheap cards: +${Math.min(effect.maximumBonus, Math.max(0, match.boards[i].filter(c => !c.hazard && c.owner === owner).length - 1))} each`;
    if (effect.kind === 'tithe') status = runtime.roundPlays[owner][i] ? 'Your tithe paid this round' : `Next play: +${effect.tax} Motion / +${effect.amount} Hands`;
    if (effect.kind === 'salon-protection') status = runtime.roundPlays[owner][i] ? 'Your appointment used this round' : 'Your first-play protection ready';
    if (effect.kind === 'crew-cleanse') status = runtime.roundPlays[owner][i] ? 'Your cleanup used this round' : 'Your gang cleanup ready';
    if (effect.kind === 'champion-only') status = 'Only one champion scores per side';
    if (effect.kind === 'round-growth') status = match.round < 6 ? 'Next round: every card here grows +1' : 'Final harvest complete';
    if (effect.kind === 'pawn-sacrifice') status = runtime.roundPlays[owner][i] ? 'Your trade used this round' : 'Your next play trades your weakest ally';
    if (effect.kind === 'broadcast') status = inLane(match, owner, i as Lane).length === effect.requiredAllies ? 'ON AIR · +3 to both other lanes' : 'Exactly 2 allies needed to broadcast';
    if (effect.kind === 'silence-arrival') status = 'Direct plays enter Silenced';
    if (effect.kind === 'flood') status = match.round < effect.atRound ? 'Flood arrives at round 4' : 'Flood has passed';
    if (effect.kind === 'close-lane') status = match.round < effect.atRound ? 'Gates close at round 4' : 'CLOSED · Movement only';
    if (effect.kind === 'market-draw') status = runtime.roundPlays[owner][i] ? 'Your draw used this round' : 'Your next play draws a card';
    if (effect.kind === 'cost-power') status = 'Printed Motion becomes district Hands';
    if (effect.kind === 'feed-neighbors') status = runtime.roundPlays[owner][i] ? 'Your meal served this round' : 'Your next play feeds the other lanes';
    if (effect.kind === 'rush-hour') status = runtime.roundPlays.player[i] + runtime.roundPlays.cpu[i] > 0 ? 'Traffic cleared this round' : 'Next play pushes both gangs right';
    return { ...d, status };
  });
}
function refreshDistrictRound(match: Match): Match {
  if (!match.districtRuntime) return match;
  const scores = getDistrictResults(match);
  return { ...match, districtRuntime: { ...match.districtRuntime,
    roundPlays: { player: [0, 0, 0], cpu: [0, 0, 0] },
    trailing: { player: scores.map(s => s.player < s.cpu) as [boolean, boolean, boolean], cpu: scores.map(s => s.cpu < s.player) as [boolean, boolean, boolean] },
  } };
}
export function getDistrictResults(match: Match) {
  return match.boards.map((cardsInLane, i) => {
    const player = getLaneScoreForMatch(match, cardsInLane.filter((c) => c.owner === "player"), i as Lane, "player");
    const cpu = getLaneScoreForMatch(match, cardsInLane.filter((c) => c.owner === "cpu"), i as Lane, "cpu");
    return { lane: i as Lane, player, cpu, winner: player === cpu ? "draw" as const : player > cpu ? "player" as const : "cpu" as const };
  });
}
export function getMatchRoundLimit(value?: Match | StoryEncounterSnapshot | null): number {
  const snapshot = value && "round" in value ? value.storyEncounter : value;
  const configured = snapshot?.roundLimit;
  return Number.isInteger(configured) && configured! >= 1 && configured! <= DEFAULT_MATCH_ROUND_LIMIT
    ? configured!
    : DEFAULT_MATCH_ROUND_LIMIT;
}
export function getMatchWinner(match: Match): Owner | 'draw' | null {
  const results = getDistrictResults(match), player = results.filter((r) => r.winner === 'player').length, cpu = results.filter((r) => r.winner === 'cpu').length;
  if (player >= 2) return 'player';
  if (cpu >= 2) return 'cpu';
  return match.round >= getMatchRoundLimit(match) && match.phase === 'complete' ? 'draw' : null;
}
export type StoryObjectiveEvaluation = StoryStarObjective & { readonly achieved: boolean };

const legacyStoryObjectiveCriterion = (objective: StoryStarObjective): StoryObjectiveCriterion | null => {
  if (objective.criterion) return objective.criterion;
  if (objective.id === "win") return { kind: "win" };
  if (objective.id === "districts") return { kind: "districts-held", owner: "player", atLeast: 3 };
  if (objective.id === "squabble") return { kind: "squabble-used", owner: "player", used: false };
  return null;
};

const historicallyMovedCardIds = (match: Match, owner: Owner): Set<string> => {
  // Keep final-card flags for legacy snapshots, then add every authoritative
  // board-to-board lane transition so later destruction cannot erase credit.
  const moved = new Set(match.boards.flat()
    .filter(card => card.owner === owner && card.moved)
    .map(card => card.instanceId));
  for (const event of match.effectLog) {
    if (event.kind !== "move") continue;
    for (const participant of [event.source, ...event.targets]) {
      if (!participant || participant.owner !== owner) continue;
      const beforeLane = participant.before?.lane;
      const afterLane = participant.after?.lane;
      if (beforeLane !== null && beforeLane !== undefined
        && afterLane !== null && afterLane !== undefined
        && beforeLane !== afterLane) moved.add(participant.cardInstanceId);
    }
  }
  return moved;
};
/** Evaluates saved and current story objectives from the final authoritative match state. */
export function evaluateStoryStarObjectives(
  match: Match,
  objectives: readonly StoryStarObjective[] = match.storyEncounter?.starObjectives ?? [],
): StoryObjectiveEvaluation[] {
  const won = match.phase === "complete" && getMatchWinner(match) === "player";
  const results = getDistrictResults(match);
  const usedSquabble = (owner: Owner) => match.squabbleByOwner?.[owner] ?? (owner === "player" ? match.squabbleUsed : false);
  return objectives.map((objective) => {
    const criterion = legacyStoryObjectiveCriterion(objective);
    let achieved = false;
    if (won && criterion) {
      switch (criterion.kind) {
        case "win": achieved = true; break;
        case "districts-held":
          achieved = results.filter((result) => result.winner === criterion.owner).length >= criterion.atLeast;
          break;
        case "specific-districts-held":
          achieved = criterion.lanes.every((target) => results[target]?.winner === criterion.owner);
          break;
        case "squabble-used": achieved = usedSquabble(criterion.owner) === criterion.used; break;
        case "motion-remaining": achieved = (criterion.owner === "player" ? match.playerMotion : match.cpuMotion) >= criterion.atLeast; break;
        case "cards-moved":
          achieved = historicallyMovedCardIds(match, criterion.owner).size >= criterion.atLeast;
          break;
      }
    }
    return { ...objective, achieved };
  });
}

export const getStoryStars = (match: Match): number =>
  evaluateStoryStarObjectives(match).filter((objective) => objective.achieved).length;
const activeLandlord = (match: Match, owner: Owner, targetLane: Lane) =>
  inLane(match, owner === "player" ? "cpu" : "player", targetLane)
    .some((card) => abilityCardId(card) === "landlord" && activeAbility(card));
const tokenEligible = (token: DiscountToken, card: CardInstance, targetLane: Lane) =>
  (token.eligibility === "homecoming" && token.targetInstanceId === card.instanceId)
  || token.eligibility === "any"
  || (token.eligibility === "printed-two-cost" && card.cost === 2)
  || (token.eligibility === "printed-four-plus" && card.cost >= 4)
  || (token.eligibility === "another-district" && token.sourceLane !== targetLane)
  || (token.eligibility === 'electric-delivery' && token.targetLane === targetLane
    && card.type === 'Electric' && (card.kind ?? 'character') === 'character' && !card.hazard)
  || (token.eligibility === 'poison-character'
    && card.type === 'Poison' && (card.kind ?? 'character') === 'character' && !card.hazard);
const discountFor = (match: Match, owner: Owner, card: CardInstance, targetLane: Lane) =>
  [...(match.discountTokens ?? [])].filter(token => token.expiresAfterRound === undefined || token.expiresAfterRound >= match.round)
    .sort((a, b) => Number(b.eligibility === 'electric-delivery') - Number(a.eligibility === 'electric-delivery')
      || a.createdOrder - b.createdOrder || a.id.localeCompare(b.id))
    .find((token) => token.owner === owner && tokenEligible(token, card, targetLane));
const districtDiscount = (match: Match, owner: Owner, card: CardInstance, targetLane: Lane): number => {
  const effect = match.districtSnapshot?.locations[targetLane].effect;
  return effect?.kind === 'dive-discount' || (effect?.kind === 'first-discount' && match.districtRuntime?.plays[owner][targetLane] === 0)
    ? Math.min(effect.amount, Math.max(0, card.cost - effect.minimum)) : 0;
};
const districtTax = (match: Match, owner: Owner, targetLane: Lane): number => {
  const effect = match.districtSnapshot?.locations[targetLane].effect;
  return effect?.kind === 'tithe' && match.districtRuntime?.roundPlays[owner][targetLane] === 0 ? effect.tax : 0;
};
export function getLegalCardCost(match: Match, owner: Owner, card: CardInstance, targetLane: Lane): number {
  const legacyDiscount = (match.discountTokens ?? []).length === 0
    && match.plugDiscountLane[owner] !== null && match.plugDiscountLane[owner] !== targetLane;
  const discount = discountFor(match, owner, card, targetLane) || legacyDiscount;
  const taxed = activeLandlord(match, owner, targetLane) && !(match.landlordTaxUsed?.[owner]?.[targetLane] ?? false);
  return Math.max(discountFor(match, owner, card, targetLane)?.eligibility === "homecoming" ? 1 : 0, card.cost - (discount ? 1 : districtDiscount(match, owner, card, targetLane))) + (taxed ? 1 : 0) + districtTax(match, owner, targetLane) + (dmvTax(match, owner, targetLane) ? 1 : 0);
}
export function getCardCostExplanation(match: Match, owner: Owner, card: CardInstance, targetLane: Lane): string {
  const token = discountFor(match, owner, card, targetLane);
  const legacy = !token && (match.discountTokens ?? []).length === 0 && match.plugDiscountLane[owner] !== null && match.plugDiscountLane[owner] !== targetLane;
  const taxed = activeLandlord(match, owner, targetLane) && !(match.landlordTaxUsed?.[owner]?.[targetLane] ?? false);
  const parts = [`${card.cost} base`];
  if (token || legacy) parts.push("−1 discount");
  if (!token && !legacy && districtDiscount(match, owner, card, targetLane)) parts.push(match.districtSnapshot?.locations[targetLane].effect.kind === 'dive-discount' ? "−1 Dive Bar discount" : "−1 Bodega opening discount");
  if (token?.eligibility === "homecoming") parts.push("Homecoming minimum 1 Motion");
  if (dmvTax(match, owner, targetLane)) parts.push("+1 Take a Number");
  if (taxed) parts.push("+1 Rent Due tax");
  if (districtTax(match, owner, targetLane)) parts.push("+1 Corrupt Church tithe");
  return parts.join(" · ");
}
const dmvTax = (m: Match, owner: Owner, lane: Lane) => (m.districtTraps ?? []).some(t => t.kind === "dmv" && t.owner !== owner && t.lane === lane && t.expiresAfterRound >= m.round);
export type CharacterDistrictMark = { owner: Owner; lane: Lane; text: string };
export function getCharacterDistrictMarks(match: Match): CharacterDistrictMark[] {
  const janitorMarks = ([0, 1, 2] as Lane[]).flatMap(targetLane =>
    (['player', 'cpu'] as Owner[]).flatMap(owner => {
      const janitor = inLane(match, owner, targetLane)
        .filter(card => abilityCardId(card) === 'janitor' && activeAbility(card))
        .sort((a, b) => a.instanceId.localeCompare(b.instanceId))[0];
      if (!janitor) return [];
      const spent = (match.janitorReversals ?? []).some(item =>
        item.owner === owner && item.lane === targetLane && item.round === match.round);
      return [{ owner, lane: targetLane, text: `Turn It Around · ${spent ? 'spent this round' : 'first hostile effect becomes +2 Hands'}` }];
    }));
  return [
    ...janitorMarks,
    ...(match.districtTraps ?? []).filter(t => t.expiresAfterRound >= match.round).map(t => ({ owner: t.owner, lane: t.lane,
      text: t.kind === 'wiseman' ? 'Wiseman prediction · next enemy character here takes −2 Hands and Weaken'
        : (t.kind === 'stakeout' ? 'Stakeout · next enemy entrance canceled' : 'Take a Number · next enemy: +1 Motion') + ' · through R' + t.expiresAfterRound })),
    ...(match.lingeringScents ?? []).filter(s => s.expiresAfterRound >= match.round).map(s => ({
      owner: s.owner, lane: s.lane, text: 'Scent · ' + (s.triggeredRound === match.round ? 'spent this round' : 'next enemy: 2 Burn') + ' · through R' + s.expiresAfterRound,
    })),
    ...match.discountTokens.filter(t => t.eligibility === 'electric-delivery' && t.targetLane !== undefined).map(t => ({
      owner: t.owner, lane: t.targetLane!, text: 'Package · next Electric: −1 Motion / +2 Hands',
    })),
  ];
}
export const getDiscountedCardCost = getLegalCardCost;
export function canAffordSelection(match: Match, owner: Owner, instanceId: string, targetLane: Lane): boolean {
  const card = (owner === "player" ? match.playerHand : match.cpuHand).find((c) => c.instanceId === instanceId);
  return !!card && !getStoryLockedLanes(match, owner).includes(targetLane) && getLegalCardCost(match, owner, card, targetLane) <= (owner === "player" ? match.playerMotion : match.cpuMotion);
}

const activeAbility = (card: CardInstance) => !card.hazard && !card.statuses.silenced && !card.statuses.frozen && !card.statuses.weakened;
const modify = (m: Match, id: string, change: (c: CardInstance) => CardInstance, copiedGain = false): Match => {
  const before = m.boards.flat().find(c => c.instanceId === id);
  if (!before) return m;
  let after = change(before);
  const delta = after.powerModifier - before.powerModifier;
  if (abilityCardId(before) === 'homelesslegend' && delta < 0) {
    after = { ...after, recoverableDamage: (before.recoverableDamage ?? 0) + Math.min(-delta, Math.max(0, before.basePower + before.powerModifier)) };
  }
  let result = { ...m, boards: m.boards.map(items => items.map(c => c.instanceId === id ? after : c)) as Match['boards'] };
  if (delta <= 0 || before.lane === null || before.hazard) return result;
  for (const fan of m.boards.flat().filter(c => c.owner === before.owner && abilityCardId(c) === 'fangirl'
    && c.idolId === id && c.fanRound !== m.round && activeAbility(c))) {
    result = { ...result, boards: result.boards.map(items => items.map(c => c.instanceId === fan.instanceId ? { ...c, fanRound: m.round } : c)) as Match['boards'],
      pendingLeaderReactions: [...(result.pendingLeaderReactions ?? []), { kind: 'fangirl', owner: fan.owner, sourceInstanceId: fan.instanceId, targetInstanceId: fan.instanceId }] };
  }
  if (!copiedGain && before.type === 'Plant' && before.kind !== 'support'
    && result.leaderRounds?.[before.owner]?.streetapostle !== m.round) {
    const leader = m.boards.flat().find(c => c.owner === before.owner && c.instanceId !== id
      && abilityCardId(c) === 'streetapostle' && activeAbility(c));
    if (leader) result = { ...result,
      leaderRounds: { ...result.leaderRounds, [before.owner]: { ...result.leaderRounds?.[before.owner], streetapostle: m.round } },
      pendingLeaderReactions: [...(result.pendingLeaderReactions ?? []), { kind: 'streetapostle', owner: before.owner,
        sourceInstanceId: leader.instanceId, targetInstanceId: id, amount: Math.min(2, delta), triggerLane: before.lane }] };
  }
  return result;
};

const findCard = (m: Match, id: string): CardInstance | undefined =>
  [...m.playerHand, ...m.cpuHand, ...m.boards.flat()].find((c) => c.instanceId === id);
const inLane = (m: Match, owner: Owner, target: Lane) => m.boards[target].filter((c) => !c.hazard && c.owner === owner);
const highest = (items: CardInstance[]) => items.filter(card => !card.hazard).sort((a, b) => getEffectiveCardPower(b) - getEffectiveCardPower(a) || a.instanceId.localeCompare(b.instanceId))[0];
const lowest = (items: CardInstance[]) => items.filter(card => !card.hazard).sort((a, b) => getEffectiveCardPower(a) - getEffectiveCardPower(b) || a.instanceId.localeCompare(b.instanceId))[0];
const move = (m: Match, card: CardInstance, destination: Lane, note: string): Match => {
  if (card.hazard) return m;
  const sourceLane = card.lane ?? m.boards.findIndex((items) => items.some((candidate) => candidate.instanceId === card.instanceId)) as Lane;
  if (sourceLane === destination) return m;
  if (m.districtRuntime?.detainedCardIds.includes(card.instanceId)) {
    return modify(m, card.instanceId, c => ({ ...c, lastEffectNote: 'COUNTY JAIL blocked movement.' }));
  }
  if (card.statuses.locked) {
    return modify(m, card.instanceId, c => ({ ...c, lastEffectNote: 'LOCKED: cannot be moved.' }));
  }
  const effect = m.districtSnapshot?.locations[destination].effect;
  const trapBonus = effect?.kind === 'move-bonus' && !m.districtRuntime!.trappedCardIds.includes(card.instanceId) ? effect.amount : 0;
  const updated = { ...card, lane: destination, moved: true, powerModifier: card.powerModifier + trapBonus, lastEffectNote: note + (trapBonus ? ` THE TRAP: +${trapBonus} Hands.` : '') };
  if (trapBonus) m = { ...m, districtRuntime: { ...m.districtRuntime!, trappedCardIds: [...m.districtRuntime!.trappedCardIds, card.instanceId] } };
  let moved = { ...m, boards: m.boards.map((items, i) => i === sourceLane ? items.filter((c) => c.instanceId !== card.instanceId) : i === destination ? [...items, { ...updated, powerModifier: card.powerModifier }] : items) as Match['boards'] };
  if (trapBonus) moved = modify(moved, card.instanceId, c => ({ ...c, powerModifier: c.powerModifier + trapBonus }));
  moved = queueLeaderReaction(moved, 'promoter', card.instanceId, m);
  const enemy = card.owner === 'player' ? 'cpu' : 'player';
  if (getLaneScoreForMatch(m, inLane(m, card.owner, sourceLane), sourceLane, card.owner)
    < getLaneScoreForMatch(m, inLane(m, enemy, sourceLane), sourceLane, enemy)) {
    moved = queueLeaderReaction(moved, 'passportbro', card.instanceId, m);
  }
  moved = {
    ...moved,
    lastMovedAlly: { ...moved.lastMovedAlly, [card.owner]: { instanceId: card.instanceId, round: moved.round } },
    roundMovedIds: {
      player: [...new Set([...(moved.roundMovedIds?.player ?? []), ...(card.owner === 'player' ? [card.instanceId] : [])])],
      cpu: [...new Set([...(moved.roundMovedIds?.cpu ?? []), ...(card.owner === 'cpu' ? [card.instanceId] : [])])],
    },
  };
  moved = fairytaleDeparture(moved, card);
  moved = fairytaleArrival(moved, card.instanceId);
  return applyScentEntry(moved, card.instanceId);
};
const lowestFriendlyLane = (m: Match, owner: Owner, except: Lane): Lane => ([0, 1, 2] as Lane[]).filter((x) => x !== except).sort((a, b) => getLaneScoreForMatch(m, inLane(m, owner, a), a, owner) - getLaneScoreForMatch(m, inLane(m, owner, b), b, owner) || a - b)[0];

/** Ongoing effect primitives: Burn / Weaken / Lock / Boost. */
/**
 * Elemental hierarchy — the type-vs-type bonus table that makes matchups matter.
 * Fire burns Plant, Water extinguishes Fire, Plant drinks Water, Electric conducts
 * through Water, Air carries Electric, Earth grounds Electric, Light vs Dark.
 * When an attacker of type X targets a defender of type Y and X beats Y, Burn and
 * direct reductions get +1 stack. Stacking multiple bonuses caps at +1 per matchup.
 */
const ELEMENTAL_MATCHUP_BONUS: Record<string, Record<string, number>> = {
  Fire: { Plant: 1 },
  Plant: { Water: 1 },
  Water: { Fire: 1 },
  Electric: { Water: 1 },
  Air: { Electric: 1 },
  Earth: { Electric: 1 },
  Light: { Dark: 1 },
  Dark: { Light: 1 },
};
const elementalMatchupBonus = (attackerType: string, defenderType: string): number =>
  ELEMENTAL_MATCHUP_BONUS[canonicalElement(attackerType)]?.[canonicalElement(defenderType)] ?? 0;

const applyBurn = (m: Match, source: CardInstance, target: CardInstance, stacks: number, note: string): Match =>
  hostileEffect(m, source, target, (state, actual) => {
    const bonus = elementalMatchupBonus(source.type, actual.type);
    return modify(state, actual.instanceId, c => ({ ...c,
      burnSource: { instanceId: source.instanceId, owner: source.owner },
      statuses: { ...c.statuses, burnStacks: (c.statuses.burnStacks ?? 0) + stacks + bonus },
      lastEffectNote: note + (bonus ? ' (+' + bonus + ' elemental bonus)' : ''),
    }));
  }, false, false, true);
const applyWeaken = (m: Match, source: CardInstance, target: CardInstance, note: string): Match =>
  targetEnemy(m, source, target, c => ({ ...c, statuses: { ...c.statuses, weakened: true }, lastEffectNote: note }));
const applyLock = (m: Match, source: CardInstance, target: CardInstance, note: string): Match =>
  targetEnemy(m, source, target, c => ({ ...c, statuses: { ...c.statuses, locked: true }, lastEffectNote: note }));
const applyBoost = (m: Match, card: CardInstance, note: string): Match =>
  modify(m, card.instanceId, c => ({ ...c, statuses: { ...c.statuses, boosted: true }, lastEffectNote: note }));
/** Single source of truth for cleanse: remove debuffs without stripping friendly buffs. */
const cleanseStatuses = (statuses: Statuses): Statuses => ({
  ...statuses, frozen: false, silenced: false, weakened: false, locked: false, burnStacks: 0,
});
const needsCleanse = (card: CardInstance): boolean => card.statuses.frozen || card.statuses.silenced
  || card.statuses.weakened || card.statuses.locked || card.statuses.burnStacks > 0;

const queueLeaderReaction = (
  match: Match, kind: LeaderKind, targetId: string, beforeTrigger: Match = match,
): Match => {
  const target = match.boards.flat().find(card => card.instanceId === targetId);
  const type = kind === 'promoter' ? 'Air' : kind === 'piratedj' ? 'Electric'
    : kind === 'gamer' || kind === 'counter' ? 'Dark'
    : kind === 'passportbro' ? 'Water'
    : kind === 'streetapostle' ? 'Plant'
    : kind === 'asphaltapostle' ? 'Earth' : 'Light';
  if (!target || target.hazard || target.kind === 'support' || target.type !== type
    || match.leaderRounds?.[target.owner]?.[kind] === match.round) return match;
  // Check the leader at the moment of the block/cleanse. A disabled Medic cannot
  // reward her own recovery, and a later reveal cannot retroactively earn credit.
  const leader = beforeTrigger.boards.flat().find(card => !card.hazard && card.owner === target.owner
    && abilityCardId(card) === kind && (kind !== 'passportbro' || card.instanceId !== targetId) && activeAbility(card));
  if (!leader) return match;
  return {
    ...match,
    leaderRounds: { ...match.leaderRounds,
      [target.owner]: { ...match.leaderRounds?.[target.owner], [kind]: match.round } },
    pendingLeaderReactions: [...(match.pendingLeaderReactions ?? []),
      { kind, owner: target.owner, sourceInstanceId: leader.instanceId, targetInstanceId: targetId }],
  };
};

const queueDisruptionReactions = (before: Match, after: Match, source: CardInstance, targetId: string): Match => {
  const old = findCard(before, targetId), target = findCard(after, targetId);
  if (!old || !target || target.owner === source.owner || target.hazard
    || !((!old.statuses.silenced && target.statuses.silenced) || (!old.statuses.weakened && target.statuses.weakened))) return after;
  const allies = after.boards.flat().filter(c => !c.hazard && c.kind !== 'support' && c.owner === source.owner && c.type === 'Dark');
  let result = after;
  const gamerTarget = lowest(allies);
  if (gamerTarget) result = queueLeaderReaction(result, 'gamer', gamerTarget.instanceId, before);
  const counterTarget = lowest(allies.filter(c => !c.statuses.protected));
  if (counterTarget) result = queueLeaderReaction(result, 'counter', counterTarget.instanceId, before);

  return result;
};

const recordElectricPlay = (match: Match, card: CardInstance): Match => {
  if (card.type !== 'Electric' || (card.kind ?? 'character') !== 'character' || card.hazard) return match;
  const previous = match.electricPlays?.[card.owner];
  const count = (previous?.round === match.round ? previous.count : 0) + 1;
  const counted = { ...match, electricPlays: { ...match.electricPlays, [card.owner]: { round: match.round, count } } };
  if (count !== 2) return counted;
  let result = queueLeaderReaction(counted, 'piratedj', card.instanceId);
  const mailman = result.boards.flat().find(c => c.owner === card.owner && abilityCardId(c) === 'mailman' && activeAbility(c));
  if (mailman && !result.discountTokens.some(t => t.owner === card.owner && t.eligibility === 'electric-delivery')) {
    const destinations = ([0, 1, 2] as Lane[]).filter(l => l !== card.lane && !getStoryLockedLanes(result, card.owner).includes(l));
    destinations.sort((a, b) => getLaneScoreForMatch(result, inLane(result, card.owner, a), a, card.owner)
      - getLaneScoreForMatch(result, inLane(result, card.owner, b), b, card.owner) || a - b);
    if (destinations.length) {
      const before = result, order = result.nextDiscountOrder;
      result = { ...result, nextDiscountOrder: order + 1, discountTokens: [...result.discountTokens, {
        id: 'package:' + card.owner + ':' + order, owner: card.owner, sourceInstanceId: mailman.instanceId,
        eligibility: 'electric-delivery', sourceLane: card.lane, targetLane: destinations[0], createdOrder: order,
      }] };
      result = trainWaveAbility(result, mailman.instanceId);
      result = addEvent(before, result, { type: 'ability', sourceId: mailman.instanceId, owner: card.owner,
        lane: destinations[0], note: 'Express Delivery: Package waiting in district ' + (destinations[0] + 1) + ' (−1 Motion, +2 Hands for the next Electric character).' });
    }
  }
  return result;
};

const cleanseAlly = (match: Match, targetId: string, apply: (card: CardInstance) => CardInstance): Match => {
  const before = findCard(match, targetId);
  const after = modify(match, targetId, apply);
  const cleansed = findCard(after, targetId);
  return before && cleansed && needsCleanse(before) && !needsCleanse(cleansed)
    ? queueLeaderReaction(after, 'nightmedic', targetId, match) : after;
};

const settleLeaderReactions = (match: Match): Match => {
  if (!match.pendingLeaderReactions?.length) return match;
  let result = match;
  while (result.pendingLeaderReactions?.length) {
    const reaction = result.pendingLeaderReactions[0];
    const before = result;
    result = { ...result, pendingLeaderReactions: result.pendingLeaderReactions!.slice(1) };
    const target = result.boards.flat().find(c => c.instanceId === reaction.targetInstanceId);
    if (reaction.kind === 'streetapostle') {
      const recipients = ([0, 1, 2] as Lane[]).filter(l => l !== reaction.triggerLane)
        .map(l => lowest(inLane(result, reaction.owner, l).filter(c => c.type === 'Plant' && c.kind !== 'support')))
        .filter((c): c is CardInstance => !!c);
      for (const ally of recipients) result = modify(result, ally.instanceId, c => ({
        ...c, powerModifier: c.powerModifier + (reaction.amount ?? 0), lastEffectNote: 'Spread the Word: +' + reaction.amount + ' Hands.',
      }), true);
      if (recipients.length) {
        result = trainWaveAbility(result, reaction.sourceInstanceId);
        result = addEvent(before, result, { type: 'ability', sourceId: reaction.sourceInstanceId, owner: reaction.owner,
          targetIds: recipients.map(c => c.instanceId), note: 'Spread the Word copied +' + reaction.amount + ' Hands to each other Plant district.' });
      }
      continue;
    }
    if (!target) continue;
    const note = reaction.kind === 'church'
      ? 'Covered: a protection block gave ' + target.name + ' +2 Hands (once per round).'
      : reaction.kind === 'nightmedic'
      ? 'All Clear: cleansing gave ' + target.name + ' +2 Hands (once per round).'
      : reaction.kind === 'promoter'
      ? 'Guest List: moving gave ' + target.name + ' +2 Hands (once per round).'
      : reaction.kind === 'gamer'
      ? 'City Tour: successful disruption gave ' + target.name + ' +2 Hands (once per round).'
      : reaction.kind === 'piratedj'
      ? 'Citywide Signal: your second Electric play gained +1 Hand and refunded 1 Motion.'
      : reaction.kind === 'passportbro'
      ? 'Geographic Arbitrage: leaving a losing district cleansed this Water ally and gave +2 Hands.'
      : reaction.kind === 'fangirl'
      ? 'Day One: your idol gained Hands; +1 Hand (once per round).'
      : 'Mirror: successful disruption protected ' + target.name + ' (once per round).';
    if (reaction.kind === 'counter') {
      if (target.statuses.protected) continue;
      result = modify(result, target.instanceId, card => ({
        ...card, statuses: { ...card.statuses, protected: true }, lastEffectNote: note,
      }));
      result = { ...result, timedEffects: [...result.timedEffects, {
        id: 'dark-cover:' + reaction.sourceInstanceId + ':' + result.round,
        kind: 'church-protection', sourceInstanceId: reaction.sourceInstanceId,
        targetInstanceId: target.instanceId, owner: reaction.owner, lane: target.lane!,
        startsAtRound: result.round, expiresAtRound: 7, expiration: 'match-complete',
      }] };
    } else if (reaction.kind === 'passportbro') {
      result = cleanseAlly(result, target.instanceId, card => ({
        ...card, statuses: cleanseStatuses(card.statuses), powerModifier: card.powerModifier + 2, lastEffectNote: note,
      }));
    } else {
      result = modify(result, target.instanceId, card => ({
        ...card, powerModifier: card.powerModifier + (reaction.kind === 'piratedj' || reaction.kind === 'fangirl' ? 1 : 2), lastEffectNote: note,
      }));
      if (reaction.kind === 'piratedj') {
        const resource = reaction.owner === 'player' ? 'playerMotion' : 'cpuMotion';
        result = refundMotion(result, reaction.owner, 1);
      }
    }
    result = trainWaveAbility(result, reaction.sourceInstanceId);
    result = addEvent(before, result, { type: 'ability', sourceId: reaction.sourceInstanceId,
      owner: reaction.owner, targetIds: [target.instanceId], note });
  }
  return result;
};

/**
 * Round-end effects that fire as a round transitions to the next.
 * - Burn deals its stacked damage, then decays to 0.
 * - Boost grants +1 Hands to each affected card while the buff remains active.
 */
const applyOngoingRoundEndEffects = (m: Match): Match => {
  let result = m;
  // Snapshot the tick. Newly passed Burn never deals damage in this same round.
  const burningAtStart = new Set(m.boards.flat().filter(c => c.statuses.burnStacks > 0).map(c => c.instanceId));
  const smokeSources = (['player', 'cpu'] as Owner[]).map(owner =>
    m.boards.flat().find(c => c.owner === owner && abilityCardId(c) === 'godofhookah' && activeAbility(c))).filter((c): c is CardInstance => !!c);
  const burnedLanes: Partial<Record<Owner, Set<Lane>>> = {};
  for (const card of m.boards.flat().filter(c => c.statuses.burnStacks > 0)) {
    const beforeBurn = result;
    const currentBurning = result.boards.flat().find(c => c.instanceId === card.instanceId);
    if (!currentBurning) continue;
    const damage = currentBurning.statuses.uncounterable ? 0 : currentBurning.statuses.burnStacks;
    const janitorReversal = damage > 0 && currentBurning.burnSource
      ? reverseWithJanitor(result, currentBurning, currentBurning.burnSource.owner, c => ({
        ...c, statuses: { ...c.statuses, burnStacks: 0 }, burnSource: undefined,
        lastEffectNote: 'Turn It Around: enemy Burn negated; +2 Hands.',
      })) : null;
    if (janitorReversal) {
      result = janitorReversal;
      continue;
    }
    result = modify(result, card.instanceId, c => ({ ...c,
      powerModifier: c.powerModifier - damage, statuses: { ...c.statuses, burnStacks: 0 },
      lastEffectNote: 'BURN: −' + damage + ' Hands at round end.',
    }));
    if (damage > 0 && card.basePower + card.powerModifier > 0) {
      const enemy = card.owner === 'player' ? 'cpu' : 'player';
      (burnedLanes[enemy] ??= new Set()).add(card.lane!);
    }
    // Ordinary Burn keeps the engine's existing zero-Hands rules. Built Different
    // must still catch a lethal Burn reduction and use its one survival.
    if (damage > 0 && abilityCardId(card) === 'homelesslegend') result = removeDestroyedCard(result, card.instanceId);
    result = recordDamage(beforeBurn, result, card.burnSource ?? { instanceId: '', owner: card.owner === 'player' ? 'cpu' : 'player' }, currentBurning, !!card.burnSource);
  }
  for (const source of smokeSources) {
    const enemy = source.owner === 'player' ? 'cpu' : 'player';
    for (const origin of burnedLanes[source.owner] ?? []) {
      const destination = ((origin + 1) % 3) as Lane;
      const target = lowest(inLane(result, enemy, destination).filter(c => !burningAtStart.has(c.instanceId) && c.statuses.burnStacks === 0));
      if (!target) continue;
      const before = result;
      result = applyBurn(result, source, target, 1, 'Pass the Hose: 1 Burn; ticks next round.');
      if ((findCard(result, target.instanceId)?.statuses.burnStacks ?? 0) > 0) result = trainWaveAbility(result, source.instanceId);
      result = addEvent(before, result, { type: 'ability', sourceId: source.instanceId, owner: source.owner,
        targetIds: [target.instanceId], lane: destination, note: 'Pass the Hose sent 1 Burn to the next district. It waits until next round.' });
    }
  }
  for (const card of result.boards.flat()) {
    if (card.statuses.boosted) {
      result = modify(result, card.instanceId, c => ({ ...c, powerModifier: c.powerModifier + 1, lastEffectNote: 'BOOST: +1 Hands at round end.' }));
    }
  }
  // Alchy: round 4+ conditional round-end gain (+1, +2 if losing the district).
  if (result.round >= 4) {
    for (const card of result.boards.flat().filter(c => c.cardId === 'alchy' && !c.statuses.silenced && !c.statuses.frozen && !c.statuses.weakened && c.lane !== null)) {
      const cardLane = card.lane as Lane;
      const enemy = card.owner === 'player' ? 'cpu' : 'player';
      const losing = getLaneScoreForMatch(result, inLane(result, card.owner, cardLane), cardLane, card.owner) < getLaneScoreForMatch(result, inLane(result, enemy, cardLane), cardLane, enemy);
      const trainedBonus = snapshotUpgradesForCard(result.abilityUpgradeSnapshot, card.owner, card.cardId).length;
      const gain = (losing ? 2 : 1) + trainedBonus;
      result = modify(result, card.instanceId, c => ({
        ...c,
        powerModifier: c.powerModifier + gain,
        lastEffectNote: `Last Round: +${gain} Hands${losing ? ' (losing)' : ''}${trainedBonus ? `, including +${trainedBonus} trained` : ''}.`,
      }));
    }
  }
  for (const card of result.boards.flat().filter(c => abilityCardId(c) === 'homelesslegend' && activeAbility(c))) {
    const restored = Math.min(2, card.recoverableDamage ?? 0);
    if (!restored) continue;
    result = modify(result, card.instanceId, c => ({ ...c, powerModifier: c.powerModifier + restored,
      recoverableDamage: Math.max(0, (c.recoverableDamage ?? 0) - restored), lastEffectNote: 'Built Different: recovered ' + restored + ' lost Hands.' }));
    result = trainWaveAbility(result, card.instanceId);
  }
  return result;
};

/**
 * Hand-resident ongoing effects that fire at round end. GUAP set the template:
 * while an elemental-bond card is in its owner's hand, every other friendly
 * character of the same type gains +1 Hands. Each element has at least one
 * bond card so the elemental hierarchy reads at every layer.
 */
const applyOngoingRoundEndHandEffects = (m: Match): Match => {
  let result = m;
  for (const hand of [result.playerHand, result.cpuHand] as const) {
    for (const card of hand) {
      const bond = card.elementalBond && canonicalElement(card.elementalBond);
      if (!bond) continue;
      const allies = result.boards.flat().filter(c => !c.hazard && c.owner === card.owner && c.kind !== 'support' && canonicalElement(c.type) === bond && c.instanceId !== card.instanceId);
      for (const ally of allies) {
        result = modify(result, ally.instanceId, c => ({
          ...c,
          powerModifier: c.powerModifier + 1,
          lastEffectNote: `${card.name}: ${bond} bond +1 Hands.`,
        }));
      }
      // Pure hand bonds spend their trained tiers on at most three deterministic
      // extra +1 boosts per round. Dual reveal/bond cards keep their reveal upgrades.
      if (card.effect.startsWith('Ongoing:') && allies.length) {
        const trainedTargets = [...allies].sort((a, b) => getEffectiveCardPower(a) - getEffectiveCardPower(b) || a.instanceId.localeCompare(b.instanceId));
        const upgrades = snapshotUpgradesForCard(result.abilityUpgradeSnapshot, card.owner, card.cardId);
        for (let index = 0; index < upgrades.length; index++) {
          const target = trainedTargets[index % trainedTargets.length];
          result = modify(result, target.instanceId, c => ({
            ...c,
            powerModifier: c.powerModifier + 1,
            lastEffectNote: `${card.name}: trained ${bond} bond +1 Hands.`,
          }));
        }
      }
    }
  }
  return result;
};

/**
 * Token templates used by Ashlee (Guyana the gorilla) and Captain Jigga
 * (Steward). These cards never enter a deck or hand — they're fabricated
 * at ability-resolution time and dropped directly onto a board lane.
 */
export const SUMMON_TEMPLATES = {
  'demario-mushroom': DEMARIO_MUSHROOM,
  grin: { id: 'cheshire', name: 'Grin', type: 'Air', cost: 0, power: 3, ability: 'The Smile Stays', effect: 'A 3-Hand Grin left by a returning ally.', kind: 'token' as const, abilityUpgrades: [] },
  cardguard: { id: 'queen-of-hearts', name: 'Card Guard', type: 'Dark', cost: 0, power: 2, ability: 'Royal Guard', effect: 'A 2-Hand guard summoned after an execution.', kind: 'token' as const, abilityUpgrades: [] },
  'smile-bomb': {
    id: 'smile-bomb', name: 'Smile Bomb', type: 'Fire', cost: 0, power: 0,
    ability: 'Short Fuse',
    effect: 'At the start of the next round, explode for -2 Hands to one random enemy in this district. The KYLE that planted it gains +1 Hands on a hit, plus +1 more on a knockout. Adds no lane Hands.',
    kind: 'token' as const, hazard: true as const, abilityUpgrades: [],
  },
  guyana: {
    id: 'guyana',
    name: 'Guyana',
    type: 'Earth',
    cost: 0,
    power: 4,
    ability: 'Gorilla in the Room',
    effect: 'Uncounterable: ignores enemy Hands reductions.',
    kind: 'token' as const,
    abilityUpgrades: [],
  },
  steward: {
    id: 'steward',
    name: 'Steward',
    type: 'Air',
    cost: 0,
    power: 2,
    ability: 'Cabin Service',
    effect: 'On arrival: target a different highest-Hands enemy for -2 Hands and give Captain Jigga\'s lowest-Hands other friendly Air character here +1 Hand.',
    kind: 'token' as const,
    abilityUpgrades: [],
  },
} as const;

const summonCard = (
  m: Match,
  owner: Owner,
  lane: Lane,
  template: Card,
  tokenId: string,
  source: CardInstance,
  uncounterable = false,
  artworkId = template.id,
): Match => {
  const instanceId = `summon:${owner}:${source.instanceId}:${m.round}:${tokenId}:${m.nextEventSequence}:${m.boards.flat().length}`;
  const instance: CardInstance = {
    ...template,
    cardId: tokenId,
    instanceId,
    id: artworkId,
    owner,
    deck: `summon:${source.cardId}`,
    lane,
    playedRound: m.round,
    basePower: template.power,
    powerModifier: 0,
    moved: false,
    statuses: { ...emptyStatuses(), uncounterable },
    lastEffectNote: `Summoned by ${source.name}.`,
  };
  return {
    ...m,
    boards: m.boards.map((items, i) => i === lane ? [...items, instance] : items) as Match['boards'],
  };
};
const addDiscountToken = (m: Match, owner: Owner, source: CardInstance, eligibility: DiscountToken["eligibility"]): Match => {
  const order = m.nextDiscountOrder ?? 1;
  return { ...m, nextDiscountOrder: order + 1, discountTokens: [...(m.discountTokens ?? []), {
    id: `discount:${owner}:${order}`, owner, sourceInstanceId: source.instanceId, eligibility, sourceLane: source.lane, createdOrder: order,
  }] };
};
/** One hostile package: interception and Protection run once, before its effects. */
const hostileEffect = (m: Match, source: CardInstance, target: CardInstance,
  apply: (match: Match, card: CardInstance) => Match, bypassWifeyGuard = false, intercepted = false, honorImmunity = false): Match => {
  const current = m.boards.flat().find(c => c.instanceId === target.instanceId);
  if (!current) return m;
  target = current;
  if (honorImmunity && target.statuses.uncounterable) return modify(m, target.instanceId, c => ({
    ...c, lastEffectNote: 'Uncounterable: hostile ability had no effect.',
  }));
  const fan = !intercepted && m.boards.flat().find(c => c.owner === target.owner && abilityCardId(c) === 'grownfanboy'
    && c.idolId === target.instanceId && c.instanceId !== target.instanceId && c.fanRound !== m.round && activeAbility(c));
  if (fan) {
    const before = m;
    let result = modify(m, fan.instanceId, c => ({ ...c, fanRound: m.round, lastEffectNote: 'He Doesn’t Know You: intercepted the attack on ' + target.name + '.' }));
    result = hostileEffect(result, source, fan, apply, bypassWifeyGuard, true, honorImmunity);
    const hit = findCard(result, fan.instanceId);
    const tookHit = !hit || hit.powerModifier < fan.powerModifier || hit.lane !== fan.lane
      || ['frozen', 'silenced', 'weakened', 'locked'].some(k => !fan.statuses[k as keyof Statuses] && hit.statuses[k as keyof Statuses])
      || hit.statuses.burnStacks > fan.statuses.burnStacks;
    if (hit && tookHit && inLane(before, fan.owner, fan.lane!).some(c => abilityCardId(c) === 'fangirl')) {
      result = modify(result, fan.instanceId, c => ({ ...c, powerModifier: c.powerModifier + 2, lastEffectNote: 'Fan Club: took the hit with Fangirl here; +2 Hands.' }));
    }
    result = trainWaveAbility(result, fan.instanceId);
    return addEvent(before, result, { type: 'ability', sourceId: fan.instanceId, owner: fan.owner,
      targetIds: [fan.instanceId, target.instanceId], note: 'He Doesn’t Know You: intercepted the hostile ability aimed at ' + target.name + '.' });
  }
  const shield = m.timedEffects.find(e => (e.kind === 'church-protection' || e.kind === 'salon-protection') && e.targetInstanceId === target.instanceId);
  if (shield) {
    const remaining = m.timedEffects.filter(e => e.id !== shield.id);
    const cleared = modify(m, target.instanceId, c => ({ ...c, statuses: { ...c.statuses,
      protected: remaining.some(e => (e.targetInstanceId === target.instanceId && (e.kind === 'church-protection' || e.kind === 'salon-protection'))
        || (e.kind === 'wifey-protection' && e.sourceInstanceId === target.instanceId)) },
      lastEffectNote: shield.kind === 'salon-protection' ? 'NAIL SALON blocked a targeted hostile ability.' : 'Covered blocked a targeted hostile ability.' }));
    return queueLeaderReaction({ ...cleared, timedEffects: remaining }, 'church', target.instanceId, m);
  }
  const targetLane = target.lane ?? m.boards.findIndex(items => items.some(c => c.instanceId === target.instanceId)) as Lane;
  const guard = inLane(m, target.owner, targetLane).find(c => abilityCardId(c) === 'wifey' && c.statuses.protected && !c.statuses.silenced && !c.statuses.blocked);
  if (guard && !bypassWifeyGuard) return queueLeaderReaction(modify(m, guard.instanceId, c => ({
    ...c, statuses: { ...c.statuses, blocked: true }, lastEffectNote: 'Side Eye blocked a targeted effect.',
  })), 'church', target.instanceId, m);
  const attempted = apply(m, target);
  const attemptedTarget = findCard(attempted, target.instanceId);
  const harmfulStatus = attemptedTarget && (
    (!target.statuses.frozen && attemptedTarget.statuses.frozen)
    || (!target.statuses.silenced && attemptedTarget.statuses.silenced)
    || (!target.statuses.weakened && attemptedTarget.statuses.weakened)
    || (!target.statuses.locked && attemptedTarget.statuses.locked)
    || attemptedTarget.statuses.burnStacks > target.statuses.burnStacks
  );
  const harmful = !attemptedTarget || attemptedTarget.powerModifier < target.powerModifier || harmfulStatus;
  if (harmful) {
    const reversed = reverseWithJanitor(m, target, source.owner);
    if (reversed) return reversed;
  }
  const after = attempted;
  return abilityCardId(source) === 'thefeds' ? after : recordDamage(m, after, source, target);
};
/** Focused reversal shared by targeted hostile packages and enemy-sourced Burn ticks. */
function reverseWithJanitor(
  m: Match, target: CardInstance, sourceOwner: Owner,
  afterReward: (card: CardInstance) => CardInstance = card => card,
): Match | null {
  if (sourceOwner === target.owner || target.lane === null) return null;
  const targetLane = target.lane;
  const janitor = inLane(m, target.owner, targetLane)
    .filter(card => abilityCardId(card) === 'janitor' && activeAbility(card))
    .sort((a, b) => a.instanceId.localeCompare(b.instanceId))[0];
  if (!janitor || (m.janitorReversals ?? [])
    .some(item => item.owner === target.owner && item.lane === targetLane && item.round === m.round)) return null;
  const beforeReverse = m;
  let reversed: Match = {
    ...m,
    janitorReversals: [...(m.janitorReversals ?? []), {
      owner: target.owner, lane: targetLane, round: m.round,
      sourceInstanceId: janitor.instanceId, targetInstanceId: target.instanceId,
    }],
  };
  reversed = modify(reversed, target.instanceId, card => afterReward({
    ...card, powerModifier: card.powerModifier + 2,
    lastEffectNote: 'Turn It Around: hostile effect negated; +2 Hands.',
  }));
  reversed = trainWaveAbility(reversed, janitor.instanceId);
  return addEvent(beforeReverse, reversed, { type: 'ability', sourceId: janitor.instanceId, owner: janitor.owner,
    lane: targetLane, targetIds: [target.instanceId],
    note: `Turn It Around negated the first hostile effect in district ${targetLane + 1} this round; ${target.name} gained +2 Hands.` });
}
const targetEnemy = (m: Match, source: CardInstance, target: CardInstance, apply: (c: CardInstance) => CardInstance, bypassWifeyGuard = false): Match =>
  hostileEffect(m, source, target, (before, actual) =>
    queueDisruptionReactions(before, modify(before, actual.instanceId, apply), source, actual.instanceId), bypassWifeyGuard);

const trainWaveAbility = (m: Match, id: string): Match => {
  const card = m.boards.flat().find(c => c.instanceId === id);
  if (!card || !(Object.hasOwn(characterWaveCards, card.cardId) || Object.hasOwn(fairytaleCards, card.cardId) || Object.hasOwn(neighborhoodWaveCards, card.cardId) || Object.hasOwn(cellblockWaveCards, card.cardId) || Object.hasOwn(afterHoursWaveCards, card.cardId)) || card.waveTrainingUsed) return m;
  let result = modify(m, id, c => ({ ...c, waveTrainingUsed: true }));
  for (const upgrade of snapshotUpgradesForCard(m.abilityUpgradeSnapshot, card.owner, card.cardId)) {
    const before = result;
    result = modify(result, id, c => ({ ...c, powerModifier: c.powerModifier + upgrade.effect.amount,
      lastEffectNote: upgrade.name + ': +1 Hand (once per match).' }), true);
    result = addEvent(before, result, { type: 'ability', sourceId: id, owner: card.owner, targetIds: [id],
      note: upgrade.name + ': +1 Hand (once per match).', abilityMetadata: {
        upgradeId: upgrade.id, upgradeName: upgrade.name, sourceCardId: card.cardId,
        sourceInstanceId: id, targetInstanceIds: [id], result: 'applied',
      } });
  }
  return result;
};

const removeDestroyedCard = (m: Match, id: string): Match => {
  const card = findCard(m, id);
  if (!card || card.basePower + card.powerModifier > 0) return m;
  if (abilityCardId(card) === 'homelesslegend' && !card.legendSaved && activeAbility(card)) {
    // Overkill never becomes recoverable growth; the saved Hand was not lost.
    const saved = modify(m, id, c => ({ ...c, legendSaved: true, powerModifier: 1 - c.basePower,
      recoverableDamage: Math.max(0, (c.recoverableDamage ?? 0) - 1), lastEffectNote: 'Built Different: survived at 1 Hand.' }), true);
    return trainWaveAbility(saved, id);
  }
  return { ...m, boards: m.boards.map(items => items.filter(item => item.instanceId !== id)) as Match['boards'],
    timedEffects: m.timedEffects.filter(effect => effect.targetInstanceId !== id) };
};

/** Damage is evaluated on the actual recipient after interception and shields. */
const reduceHands = (m: Match, target: CardInstance, amount: number, note: string, burnStacks?: number): Match => {
  if (target.statuses.uncounterable) return modify(m, target.instanceId, c => ({ ...c, lastEffectNote: note + ' (no effect: uncounterable).' }));
  const mitigation = m.timedEffects.find(e => e.kind === 'nail-mitigation' && e.targetInstanceId === target.instanceId);
  const damage = Math.max(0, amount - (mitigation ? 1 : 0));
  let result = modify(m, target.instanceId, c => ({ ...c, powerModifier: c.powerModifier - damage,
    ...(burnStacks === undefined ? {} : { statuses: { ...c.statuses, burnStacks } }), lastEffectNote: note }));
  if (mitigation) result = { ...result, timedEffects: result.timedEffects.filter(e => e.id !== mitigation.id) };
  if (damage > 0) result = removeDestroyedCard(result, target.instanceId);
  return result;
};
const targetEnemyPowerReduction = (m: Match, source: CardInstance, target: CardInstance, amount: number, note: string): Match =>
  hostileEffect(m, source, target, (state, actual) => reduceHands(state, actual, Math.abs(amount), note), false, false, true);
const targetEnemyBurnAndPowerReduction = (
  m: Match, source: CardInstance, target: CardInstance, stacks: number, amount: number, note: string,
): Match => hostileEffect(m, source, target, (state, actual) => {
  const result = reduceHands(state, actual, Math.abs(amount), note, actual.statuses.burnStacks + stacks + elementalMatchupBonus(source.type, actual.type));
  return modify(result, actual.instanceId, c => ({ ...c, burnSource: { instanceId: source.instanceId, owner: source.owner } }));
}, false, false, true);

const forceEnemyMove = (m: Match, source: CardInstance, target: CardInstance, destination: Lane): Match =>
  hostileEffect(m, source, target, (state, actual) => forceMoveUnshielded(state, actual, destination), false, false, true);
const forceMoveUnshielded = (state: Match, actual: CardInstance, destination: Lane): Match => {
    if (actual.statuses.uncounterable || actual.statuses.locked || state.districtRuntime?.detainedCardIds.includes(actual.instanceId)
      || actual.lane === destination || getStoryLockedLanes(state, actual.owner).includes(destination)) {
      return modify(state, actual.instanceId, c => ({ ...c, lastEffectNote: 'Wrong Block: movement blocked.' }));
    }
    const apostle = actual.type === 'Earth' && state.leaderRounds?.[actual.owner]?.asphaltapostle !== state.round
      && state.boards.flat().find(c => c.owner === actual.owner && abilityCardId(c) === 'asphaltapostle' && activeAbility(c));
    if (apostle) {
      let blocked: Match = { ...state, leaderRounds: { ...state.leaderRounds,
        [actual.owner]: { ...state.leaderRounds?.[actual.owner], asphaltapostle: state.round } } };
      blocked = modify(blocked, actual.instanceId, c => ({ ...c, powerModifier: c.powerModifier + 2,
        lastEffectNote: 'Concrete Congregation blocked a forced move: +2 Hands.' }));
      return trainWaveAbility(blocked, apostle.instanceId);
    }
    return move(state, actual, destination, 'Wrong Block: forced into another district.');
};

const applyScentEntry = (m: Match, id: string): Match => {
  let result = m;
  const card = findCard(m, id);
  if (!card || card.hazard || card.lane === null) return result;
  for (const scent of m.lingeringScents ?? []) {
    if (scent.lane !== card.lane || scent.owner === card.owner || scent.expiresAfterRound < m.round || scent.triggeredRound === m.round) continue;
    const before = result;
    result = { ...result, lingeringScents: result.lingeringScents?.map(s => s === scent ? { ...s, triggeredRound: m.round } : s) };
    result = applyBurn(result, scent.source, card, 2, 'Lingering Scent: entered a scented district; 2 Burn.');
    result = addEvent(before, result, { type: 'ability', sourceId: scent.source.instanceId, owner: scent.owner,
      lane: scent.lane, targetIds: [id], note: 'Lingering Scent: first enemy entering this round was targeted with 2 Burn.' });
  }
  return result;
};

/** Shared wave hooks. Counters are marked before reactions so retaliation cannot loop. */
function grantProtection(m: Match, source: CardInstance, id: string): Match {
  const target = m.boards.flat().find(c => c.instanceId === id);
  if (!target || target.statuses.protected) return m;
  const result = modify(m, id, c => ({ ...c, statuses: { ...c.statuses, protected: true }, lastEffectNote: source.ability + ': Protection.' }));
  return { ...result, timedEffects: [...result.timedEffects, {
    id: 'wave-cover:' + source.instanceId + ':' + id + ':' + m.nextEventSequence,
    kind: 'church-protection', sourceInstanceId: source.instanceId, targetInstanceId: id,
    owner: target.owner, lane: target.lane!, startsAtRound: m.round, expiresAtRound: 99, expiration: 'match-complete',
  }] };
}
function waveRound(m: Match, id: string, key: keyof NonNullable<CardInstance['waveRounds']>): Match {
  return modify(m, id, c => ({ ...c, waveRounds: { ...c.waveRounds, [key]: m.round } }));
}
function fairytaleArrival(m: Match, id: string): Match {
  const entrant = m.boards.flat().find(c => c.instanceId === id);
  if (!entrant || entrant.hazard || entrant.lane === null) return m;
  for (const tin of inLane(m, entrant.owner, entrant.lane).filter(c => c.instanceId !== id && abilityCardId(c) === 'tinman' && activeAbility(c) && c.waveRounds?.tinman !== m.round)) {
    const before = m;
    m = waveRound(m, tin.instanceId, 'tinman');
    m = grantProtection(m, tin, id);
    if (!entrant.statuses.protected) m = trainWaveAbility(m, tin.instanceId);
    m = addEvent(before, m, { type: 'ability', sourceId: tin.instanceId, owner: tin.owner, targetIds: [id], note: 'Heart Starter: first ally entering this round gains Protection.' });
  }
  return m;
}
function fairytaleDeparture(m: Match, departed: CardInstance): Match {
  if (departed.lane === null) return m;
  for (const lion of inLane(m, departed.owner, departed.lane).filter(c => c.instanceId !== departed.instanceId && abilityCardId(c) === 'lion' && activeAbility(c) && c.waveRounds?.lion !== m.round)) {
    const before = m;
    m = waveRound(m, lion.instanceId, 'lion');
    m = modify(m, lion.instanceId, c => ({ ...c, powerModifier: c.powerModifier + 2, lastEffectNote: 'Found My Courage: an ally left; +2 Hands.' }));
    m = trainWaveAbility(m, lion.instanceId);
    m = addEvent(before, m, { type: 'ability', sourceId: lion.instanceId, owner: lion.owner, targetIds: [lion.instanceId], note: 'Found My Courage: +2 Hands, once this round.' });
  }
  return m;
}
/** Transfers and confiscation cannot become healing credit, including for Built Different. */
function modifyWithoutDamage(m: Match, target: CardInstance, apply: (c: CardInstance) => CardInstance): Match {
  const result = modify(m, target.instanceId, apply);
  return modify(result, target.instanceId, c => ({ ...c, recoverableDamage: target.recoverableDamage }));
}
function refundMotion(m: Match, owner: Owner, amount: number): Match {
  const key = owner === 'player' ? 'playerMotion' : 'cpuMotion';
  const hand = owner === 'player' ? 'playerHand' : 'cpuHand';
  const refunded = Math.max(0, Math.min(MAX_MOTION - m[key], amount));
  return { ...m, [key]: m[key] + refunded, [hand]: m[hand].map(c => abilityCardId(c) === 'powerhouse' && activeAbility(c)
    ? { ...c, bankedMotion: Math.min(3, (c.bankedMotion ?? 0) + refunded), lastEffectNote: 'Overtime: ' + Math.min(3, (c.bankedMotion ?? 0) + refunded) + '/3 refunded Motion banked.' } : c) };
}
function recordDamage(before: Match, after: Match, source: Pick<CardInstance, 'instanceId' | 'owner'>, victim: CardInstance, ability = true): Match {
  const current = after.boards.flat().find(c => c.instanceId === victim.instanceId);
  const amount = Math.max(0, Math.max(0, victim.basePower + victim.powerModifier) - Math.max(0, current ? current.basePower + current.powerModifier : 0));
  if (!amount) return after;
  let m = after;
  if (current && abilityCardId(victim) !== 'homelesslegend') m = modify(m, current.instanceId, c => ({ ...c, recoverableDamage: (c.recoverableDamage ?? 0) + amount }));
  if (source.owner === victim.owner || victim.lane === null) return m;
  const watchers = before.boards.flat().filter(c => !c.hazard && c.lane === victim.lane);
  for (const snapshot of watchers) {
    const watcher = m.boards.flat().find(c => c.instanceId === snapshot.instanceId);
    if (!watcher || !activeAbility(watcher)) continue;
    const id = abilityCardId(watcher), start = m;
    const friendly = watcher.owner === victim.owner && watcher.instanceId !== victim.instanceId;
    const targets: string[] = [];
    if (id === 'bonnetgirl' && friendly && !watcher.waveOnce?.bonnetgirl) {
      m = modify(m, watcher.instanceId, c => ({ ...c, waveOnce: { ...c.waveOnce, bonnetgirl: true }, powerModifier: c.powerModifier + 2, lastEffectNote: 'Now I’m Up: +2 Hands.' }));
      targets.push(watcher.instanceId);
    } else if (id === 'ronald' && friendly && watcher.waveRounds?.ronald !== m.round) {
      m = waveRound(m, watcher.instanceId, 'ronald');
      for (const l of [0, 1, 2] as Lane[]) {
        if (l === victim.lane) continue;
        const ally = lowest(inLane(m, watcher.owner, l));
        if (ally) { m = modify(m, ally.instanceId, c => ({ ...c, powerModifier: c.powerModifier + 1, lastEffectNote: 'Organize: +1 Hand.' })); targets.push(ally.instanceId); }
      }
    } else if (id === 'trapvamp' && ability && watcher.owner === source.owner && watcher.waveRounds?.trapvamp !== m.round) {
      m = waveRound(m, watcher.instanceId, 'trapvamp');
      m = modify(m, watcher.instanceId, c => ({ ...c, powerModifier: c.powerModifier + Math.min(2, amount), lastEffectNote: 'Paid in Blood: +' + Math.min(2, amount) + ' Hands.' }));
      targets.push(watcher.instanceId);
    } else if (id === 'squabblecook' && ability && friendly && watcher.waveRounds?.squabblecook !== m.round) {
      m = waveRound(m, watcher.instanceId, 'squabblecook');
      const attacker = m.boards.flat().find(c => c.instanceId === source.instanceId);
      if (attacker) { m = targetEnemyPowerReduction(m, watcher, attacker, 2, 'Hands on the Clock: 2 damage back to the source.'); targets.push(attacker.instanceId); }
    }
    if (targets.length) {
      m = trainWaveAbility(m, watcher.instanceId);
      m = addEvent(start, m, { type: 'ability', sourceId: watcher.instanceId, owner: watcher.owner, targetIds: targets, note: watcher.ability + ' reacted to ' + amount + ' damage.' });
    }
  }
  return m;
}
function returnToHand(m: Match, source: CardInstance, target: CardInstance, discount = false): Match {
  if (target.lane === null || (target.kind ?? 'character') !== 'character' || !m.boards.flat().some(c => c.instanceId === target.instanceId)) return m;
  const before = m, printed = cards[target.cardId], hand = target.owner === 'player' ? 'playerHand' : 'cpuHand';
  const returned: CardInstance = { ...target, ...printed, basePower: printed.power, powerModifier: 0, lane: null, playedRound: null,
    statuses: emptyStatuses(), copiedAbilityCardId: undefined, recoverableDamage: 0, burnSource: undefined, moved: false,
    lastEffectNote: 'Returned to hand by ' + source.name + '.' };
  m = { ...m, [hand]: [...m[hand], returned], boards: m.boards.map(items => items.filter(c => c.instanceId !== target.instanceId)) as Match['boards'],
    timedEffects: m.timedEffects.filter(e => e.targetInstanceId !== target.instanceId && !(e.sourceInstanceId === target.instanceId && e.kind === 'wifey-protection')),
    discountTokens: m.discountTokens.filter(t => t.targetInstanceId !== target.instanceId) };
  if (discount) {
    m = addDiscountToken(m, target.owner, source, 'homecoming');
    m = { ...m, discountTokens: m.discountTokens.map(t => t.createdOrder === m.nextDiscountOrder - 1 ? { ...t, targetInstanceId: target.instanceId } : t) };
  }
  m = fairytaleDeparture(m, target);
  const cat = before.boards.flat().find(c => c.owner === target.owner && abilityCardId(c) === 'cheshire' && activeAbility(c));
  if (cat && m.cheshireRounds?.[target.owner] !== m.round) {
    m = { ...m, cheshireRounds: { ...m.cheshireRounds, [target.owner]: m.round } };
    if (!inLane(m, target.owner, target.lane).some(c => c.cardId === 'grin')) {
      m = summonCard(m, target.owner, target.lane, SUMMON_TEMPLATES.grin, 'grin', cat, false, 'cheshire');
      m = trainWaveAbility(m, cat.instanceId);
    }
  }
  return addEvent(before, m, { type: 'ability', kind: 'move', sourceId: source.instanceId, owner: source.owner, targetIds: [target.instanceId], note: target.name + ' returned to hand.' + (discount ? ' Its next deployment costs 1 less Motion, minimum 1.' : '') });
}
function returnAliceAtRoundEnd(m: Match): Match {
  if (m.round >= getMatchRoundLimit(m)) return m;
  for (const alice of m.boards.flat().filter(c => abilityCardId(c) === 'alice' && activeAbility(c) && !c.waveOnce?.alice)) {
    m = modify(m, alice.instanceId, c => ({ ...c, waveOnce: { ...c.waveOnce, alice: true }, aliceReady: true }));
    m = returnToHand(m, alice, findCard(m, alice.instanceId)!);
  }
  return m;
}
function canMoveTo(m: Match, card: CardInstance, destination: Lane): boolean {
  return card.lane !== null && card.lane !== destination && !card.hazard && !card.statuses.locked
    && !m.districtRuntime?.detainedCardIds.includes(card.instanceId) && !getStoryLockedLanes(m, card.owner).includes(destination);
}
function undercovaReaction(m: Match, beforePlay: Match, id: string, origin: Lane, owner: Owner): Match {
  for (const previous of beforePlay.boards[origin].filter(c => c.owner !== owner && abilityCardId(c) === 'undercova')) {
    const spy = m.boards.flat().find(c => c.instanceId === previous.instanceId);
    const target = m.boards.flat().find(c => c.instanceId === id);
    if (!spy || spy.lane !== origin || !activeAbility(spy) || spy.waveOnce?.undercova) continue;
    const before = m;
    m = modify(m, spy.instanceId, c => ({ ...c, waveOnce: { ...c.waveOnce, undercova: true } }));
    if (target) m = hostileEffect(m, spy, target, (state, actual) => {
      const reduced = reduceHands(state, actual, 1, 'Inside Man: stole 1 Hand.');
      const remaining = findCard(reduced, actual.instanceId);
      const stolen = Math.min(1, Math.max(0, getEffectiveCardPower(actual) - (remaining ? getEffectiveCardPower(remaining) : 0)));
      return stolen ? modify(reduced, spy.instanceId, c => ({ ...c, powerModifier: c.powerModifier + stolen })) : reduced;
    }, false, false, true);
    const survivor = m.boards.flat().find(c => c.instanceId === spy.instanceId);
    if (survivor) {
      const destination = ([0, 1, 2] as Lane[]).filter(l => canMoveTo(m, survivor, l))
        .sort((a, b) => getLaneScoreForMatch(m, inLane(m, spy.owner, a), a, spy.owner) - getLaneScoreForMatch(m, inLane(m, spy.owner, b), b, spy.owner) || a - b)[0];
      if (destination !== undefined) m = move(m, survivor, destination, 'Inside Man: escaped after the enemy entrance.');
      if (findCard(m, spy.instanceId)?.lane !== spy.lane || findCard(m, spy.instanceId)!.powerModifier > spy.powerModifier) m = trainWaveAbility(m, spy.instanceId);
    }
    m = addEvent(before, m, { type: 'ability', kind: 'move', sourceId: spy.instanceId, owner: spy.owner, targetIds: [id, spy.instanceId], note: 'Inside Man: intercepted the deployment, then tried to escape.' });
  }
  return m;
}
function hasEntrance(c: CardInstance): boolean {
  return c.aliceReady || c.effect.includes('On Reveal:') || (!c.effect.startsWith('Ongoing:') && !['bossbabe', 'stockz', 'streamer', 'wifey', 'nail'].includes(c.cardId));
}
function resolveFairytaleAbility(m: Match, source: CardInstance, echoed: boolean): Match {
  const before = m, l = source.lane!, enemy = source.owner === 'player' ? 'cpu' : 'player';
  const id = source.cardId, targets: string[] = [];
  let succeeded = false;
  const buff = (target: CardInstance, amount: number) => { targets.push(target.instanceId); m = modify(m, target.instanceId, c => ({ ...c, powerModifier: c.powerModifier + amount })); succeeded = true; };
  if (id === 'dorothy') {
    const target = lowest(inLane(m, source.owner, l).filter(c => c.instanceId !== source.instanceId && (c.kind ?? 'character') === 'character' && c.cost <= 2));
    if (target) { targets.push(target.instanceId); m = returnToHand(m, source, target, true); succeeded = true; }
  } else if (id === 'scarecrow') {
    const ally = lowest(m.boards.flat().filter(c => c.owner === source.owner && c.lane !== l && !c.hazard && c.lane !== null && canMoveTo(m, source, c.lane) && canMoveTo(m, c, l)));
    if (ally) {
      m = move(m, source, ally.lane!, 'Wrong Turn, Right Place: swapped districts.');
      m = move(m, findCard(m, ally.instanceId)!, l, 'Wrong Turn, Right Place: swapped districts.');
      buff(findCard(m, source.instanceId)!, 1); buff(findCard(m, ally.instanceId)!, 1);
    }
  } else if (id === 'lion' && inLane(m, source.owner, l).length === 1) {
    m = grantProtection(m, source, source.instanceId); succeeded = !source.statuses.protected;
  } else if (id === 'oz' && !echoed && !source.waveOnce?.oz) {
    const historicalIds = (m.entranceHistory?.length ? m.entranceHistory : (m.lastMovedAlly?.[source.owner] ? [m.lastMovedAlly[source.owner]!.instanceId] : []));
    const eligible = historicalIds.slice().reverse()
      .map(id => m.boards.flat().find(c => c.instanceId === id))
      .find(c => c && c.owner === source.owner && c.instanceId !== source.instanceId
        && (c.kind ?? 'character') === 'character' && activeAbility(c) && hasEntrance(c)
        && !['oz', 'tayaty', 'scammer'].includes(abilityCardId(c)));
    const ally = eligible;
    if (ally) {
      m = modify(m, source.instanceId, c => ({ ...c, waveOnce: { ...c.waveOnce, oz: true } }));
      m = resolveAbility(m, ally, { echoed: true }); targets.push(ally.instanceId); succeeded = true;
      const movedThisRound = m.roundMovedIds
        ? m.roundMovedIds[source.owner]?.includes(ally.instanceId) ?? false
        : m.lastMovedAlly?.[source.owner]?.instanceId === ally.instanceId
          && m.lastMovedAlly[source.owner]!.round === m.round;
      if (movedThisRound && findCard(m, ally.instanceId)) m = modify(m, ally.instanceId, c => ({ ...c, powerModifier: c.powerModifier + 2, lastEffectNote: 'The Grand Reveal: moved ally echoed, +2 Hands.' }));
    }
  } else if (id === 'alice' && source.aliceReady && !echoed) {
    m = modify(m, source.instanceId, c => ({ ...c, aliceReady: false })); buff(source, 3);
  } else if (id === 'queenofhearts') {
    const target = lowest(inLane(m, enemy, l));
    if (target && getEffectiveCardPower(target) <= 4) {
      targets.push(target.instanceId);
      m = hostileEffect(m, source, target, (state, actual) => {
        if (getEffectiveCardPower(actual) > 4) return state;
        let result = removeDestroyedCard(modify(state, actual.instanceId, c => ({ ...c, powerModifier: -c.basePower, lastEffectNote: 'Off With Their Heads: executed.' })), actual.instanceId);
        if (!findCard(result, actual.instanceId)) { result = summonCard(result, source.owner, l, SUMMON_TEMPLATES.cardguard, 'cardguard', source, false, 'queen-of-hearts'); succeeded = true; }
        return result;
      }, false, false, true);
    }
  } else if (id === 'sherlock' || id === 'dmvworker') {
    const destination = id === 'dmvworker' ? l : ([0, 1, 2] as Lane[]).filter(x => x !== l && !getStoryLockedLanes(m, enemy).includes(x))
      .sort((a, b) => getLaneScoreForMatch(m, inLane(m, enemy, b), b, enemy) - getLaneScoreForMatch(m, inLane(m, enemy, a), a, enemy) || a - b)[0];
    if (destination !== undefined) {
      const kind = id === 'sherlock' ? 'stakeout' : 'dmv';
      m = { ...m, districtTraps: [...(m.districtTraps ?? []).filter(t => !(t.kind === kind && t.owner === source.owner && t.lane === destination)),
        { kind, owner: source.owner, lane: destination, source, expiresAfterRound: m.round + 1 }] }; succeeded = true;
    }
  } else if (id === 'watson') {
    const target = lowest(inLane(m, source.owner, l).filter(c => (c.recoverableDamage ?? 0) > 0));
    if (target) {
      const amount = Math.min(3, target.recoverableDamage!);
      m = modify(m, target.instanceId, c => ({ ...c, recoverableDamage: Math.max(0, (c.recoverableDamage ?? 0) - amount) }));
      buff(target, amount); m = grantProtection(m, source, target.instanceId);
    } else {
      const fallback = lowest(inLane(m, source.owner, l).filter(c => c.instanceId !== source.instanceId));
      if (fallback) { targets.push(fallback.instanceId); m = grantProtection(m, source, fallback.instanceId); succeeded = true; }
    }
    for (const sherlock of m.boards.flat().filter(c => c.owner === source.owner && abilityCardId(c) === 'sherlock' && activeAbility(c))) {
      if (sherlock.instanceId !== source.instanceId) { targets.push(sherlock.instanceId); m = grantProtection(m, source, sherlock.instanceId); }
    }
  } else if (id === 'thefeds') {
    const target = highest(inLane(m, enemy, l));
    if (target) {
      targets.push(target.instanceId);
      m = hostileEffect(m, source, target, (state, actual) => {
        const seized = Math.min(4, Math.max(0, actual.basePower + actual.powerModifier - actual.power));
        succeeded = seized > 0 || !actual.statuses.locked;
        return modifyWithoutDamage(state, actual, c => ({ ...c, powerModifier: c.powerModifier - seized, statuses: { ...c.statuses, locked: true }, lastEffectNote: 'Asset Seizure: removed ' + seized + ' bonus Hands; Locked.' }));
      }, false, false, true);
    }
  } else if (id === 'ptang') {
    const target = highest(inLane(m, enemy, l));
    if (target) {
      targets.push(target.instanceId);
      m = hostileEffect(m, source, target, (state, actual) => {
        let result = reduceHands(state, actual, 2, 'Belt Check: 2 damage.');
        const survivor = result.boards.flat().find(c => c.instanceId === actual.instanceId);
        if (survivor) {
          const destination = [((survivor.lane! + 1) % 3) as Lane, ((survivor.lane! + 2) % 3) as Lane].find(x => !getStoryLockedLanes(result, survivor.owner).includes(x));
          if (destination !== undefined) result = forceMoveUnshielded(result, survivor, destination);
        }
        const after = findCard(result, actual.instanceId);
        succeeded = !after || after.powerModifier < actual.powerModifier || after.lane !== actual.lane;
        return result;
      }, false, false, true);
    }
  } else if (id === 'corruptpastor') {
    for (const ally of inLane(m, source.owner, l).filter(c => c.instanceId !== source.instanceId && getEffectiveCardPower(c) > 1)) {
      m = modifyWithoutDamage(m, ally, c => ({ ...c, powerModifier: c.powerModifier - 1 }));
      buff(findCard(m, source.instanceId)!, 2); targets.push(ally.instanceId);
    }
  } else if (id === 'powerhouse' && (source.bankedMotion ?? 0) > 0) {
    for (const target of inLane(m, enemy, l)) {
      targets.push(target.instanceId);
      m = targetEnemyPowerReduction(m, source, target, source.bankedMotion!, 'Overtime: ' + source.bankedMotion + ' banked damage.');
      const after = findCard(m, target.instanceId);
      succeeded ||= !after || after.powerModifier < target.powerModifier;
    }
  } else if (id === 'squabbleserver') {
    const target = lowest(inLane(m, source.owner, l).filter(c => c.statuses.frozen || c.statuses.burnStacks > 0));
    if (target) {
      targets.push(target.instanceId);
      m = cleanseAlly(m, target.instanceId, c => ({ ...c, statuses: { ...c.statuses, frozen: false, burnStacks: 0 }, burnSource: undefined, lastEffectNote: 'Fresh Pot: Burn and Freeze cleared.' })); succeeded = true;
    }
  }
  if (succeeded && !echoed) m = trainWaveAbility(m, source.instanceId);
  return addEvent(before, m, { type: 'ability', sourceId: source.instanceId, owner: source.owner, targetIds: targets,
    note: source.ability + (succeeded ? ' resolved.' : ': waiting for its condition or blocked.') });
}

const storyLog = (before: Match, after: Match, id: string, owner: Owner, note: string): Match => {
  const logged = addEvent(before, after, { type: 'ability', owner, lane: 0, kind: 'story', note });
  if (logged[SUPPRESS_PRESENTATION_EVENTS]) return logged;
  return {
    ...logged,
    effectLog: [...logged.effectLog.slice(0, -1), {
      ...logged.effectLog.at(-1)!,
      cardInstanceId: `story:${id}`,
      cardId: 'story',
    }],
  };
};
const storyTriggerMet = (match: Match, trigger: StoryTrigger): boolean => {
  if (trigger.kind === "round") return match.round >= trigger.atLeast;
  if (trigger.kind === "total-power") {
    const total = ([0, 1, 2] as Lane[]).reduce((sum, targetLane) => sum + getLaneScoreForMatch(
      match,
      inLane(match, trigger.owner, targetLane),
      targetLane,
      trigger.owner,
    ), 0);
    return total >= trigger.atLeast;
  }
  return getDistrictResults(match).filter((result) => result.winner === trigger.owner).length >= trigger.atLeast;
};
const applyStoryEffect = (match: Match, effect: StoryEffect, effectId: string): Match => {
  if (!match.storyRuntime || match.storyRuntime.appliedEffectIds.includes(effectId)) return match;
  const before = match;
  let m: Match = {
    ...match,
    storyRuntime: {
      ...match.storyRuntime,
      appliedEffectIds: [...match.storyRuntime.appliedEffectIds, effectId],
    },
  };
  if (effect.kind === "motion") {
    const key = effect.owner === "player" ? "playerMotion" : "cpuMotion";
    m = { ...m, [key]: Math.min(MAX_MOTION, Math.max(0, m[key] + effect.amount)) };
  } else if (effect.kind === "reinforcement") {
    const key = effect.owner === "player" ? "playerHand" : "cpuHand";
    const card = createCardInstance(effect.cardId, effect.owner, `story:${m.storyEncounter!.id}:${effectId}`, 0);
    m = { ...m, [key]: [...m[key], card] };
  } else if (effect.kind === "lane-power") {
    m = { ...m, storyRuntime: { ...m.storyRuntime!, lanePowerBonuses: [...m.storyRuntime!.lanePowerBonuses, { ...effect }] } };
  } else {
    m = { ...m, storyRuntime: { ...m.storyRuntime!, laneLocks: [...m.storyRuntime!.laneLocks, { owner: effect.owner, lanes: [...effect.lanes] }] } };
  }
  return storyLog(before, m, effectId, effect.kind === "motion" || effect.kind === "reinforcement" ? effect.owner : "cpu", `Story effect ${effectId}: ${effect.kind}.`);
};
function applyStoryEffects(match: Match): Match {
  if (!match.storyEncounter || !match.storyRuntime) return match;
  let m = match;
  const snapshot = match.storyEncounter;
  for (const [index, item] of (snapshot.modifiers?.roundMotionDeltas ?? []).entries()) {
    if (item.round === m.round) m = applyStoryEffect(m, { kind: "motion", owner: item.owner, amount: item.amount }, `round-motion:${index}:${item.round}`);
  }
  for (const [index, item] of (snapshot.modifiers?.reinforcements ?? []).entries()) {
    if (item.round === m.round) m = applyStoryEffect(m, { kind: "reinforcement", owner: item.owner, cardId: item.cardId }, `reinforcement:${index}:${item.round}`);
  }
  const phases = snapshot.phases ?? [];
  let next = match.storyRuntime.activePhaseIndex + 1;
  while (next < phases.length && storyTriggerMet(m, phases[next].trigger)) {
    const phase = phases[next];
    const beforePhase = m;
    m = {
      ...m,
      storyRuntime: { ...m.storyRuntime!, activePhaseIndex: next },
    };
    m = storyLog(beforePhase, m, `phase:${phase.id}`, "cpu", `Story phase entered: ${phase.name}.`);
    for (const [effectIndex, effect] of (phase.onEnter ?? []).entries()) {
      m = applyStoryEffect(m, effect, `phase:${phase.id}:${effectIndex}`);
    }
    next += 1;
  }
  return m;
}

export function getActiveStoryPhase(match: Match): NonNullable<StoryEncounterSnapshot["phases"]>[number] | null {
  const index = match.storyRuntime?.activePhaseIndex ?? -1;
  return index >= 0 ? match.storyEncounter?.phases?.[index] ?? null : null;
}
export function getStoryLockedLanes(match: Match, owner: Owner = "player"): Lane[] {
  const scheduled = (match.storyEncounter?.modifiers?.laneLocks ?? [])
    .filter((lock) => lock.round === match.round && (lock.owner === owner || lock.owner === "both"))
    .flatMap((lock) => lock.lanes);
  const entered = (match.storyRuntime?.laneLocks ?? [])
    .filter((lock) => lock.owner === owner || lock.owner === "both")
    .flatMap((lock) => lock.lanes);
  const closed = (match.districtSnapshot?.locations ?? []).flatMap((d, i) =>
    d.effect.kind === 'close-lane' && match.round >= d.effect.atRound ? [i as Lane] : []);
  return [...new Set([...scheduled, ...entered, ...closed])].sort() as Lane[];
}
export function getStoryModifierSummaries(value: Match | StoryEncounterSnapshot): string[] {
  const snapshot = "round" in value ? value.storyEncounter : value;
  if (!snapshot) return [];
  const modifiers = snapshot.modifiers;
  const summaries: string[] = [];
  const roundLimit = getMatchRoundLimit(snapshot);
  if (roundLimit !== DEFAULT_MATCH_ROUND_LIMIT) summaries.push(`Match length: ${roundLimit} rounds`);
  if (modifiers?.startingMotion) summaries.push(`Starting Motion: player ${modifiers.startingMotion.player ?? 2}, CPU ${modifiers.startingMotion.cpu ?? 2}`);
  if (modifiers?.handSize) summaries.push(`Opening hand: player ${modifiers.handSize.player ?? 5}, CPU ${modifiers.handSize.cpu ?? 5}`);
  for (const lock of modifiers?.laneLocks ?? []) summaries.push(`Round ${lock.round}: ${lock.owner} cannot play lane${lock.lanes.length === 1 ? "" : "s"} ${lock.lanes.join(", ")}`);
  for (const delta of modifiers?.roundMotionDeltas ?? []) summaries.push(`Round ${delta.round}: ${delta.owner} Motion ${delta.amount >= 0 ? "+" : ""}${delta.amount}`);
  for (const bonus of modifiers?.lanePowerBonuses ?? []) summaries.push(`${bonus.owner} lane ${bonus.lane} Hands ${bonus.amount >= 0 ? "+" : ""}${bonus.amount}`);
  for (const reinforcement of modifiers?.reinforcements ?? []) summaries.push(`Round ${reinforcement.round}: ${reinforcement.owner} reinforces with ${reinforcement.cardId}`);
  for (const phase of snapshot.phases ?? []) summaries.push(`Phase ${phase.name}: ${phase.trigger.kind}`);
  return summaries;
}

function resolveAbility(match: Match, source: CardInstance, { echoed = false }: { echoed?: boolean } = {}): Match {
  const before = match;
  const l = source.lane!, enemy = source.owner === 'player' ? 'cpu' : 'player', kind = source.type === 'Fire' ? 'fire' : source.type === 'Water' ? 'water' : 'ability';
  let m = match;
  const targetIds = new Set<string>();
  const note = (text: string, timing: 'instant' | 'timed' = 'instant', duration: EventDuration | null = null) => {
    const changed = before.boards.flat().filter((old) => {
      const current = findCard(m, old.instanceId);
      return current && JSON.stringify(cardState(old)) !== JSON.stringify(cardState(current));
    }).map((card) => card.instanceId);
    const blocked = changed.map(id => findCard(m, id)).find(c => c?.owner !== source.owner && /blocked/.test(c?.lastEffectNote ?? ''));
    if (blocked) text += ` ${blocked.name}: ${blocked.lastEffectNote}`;
    const absorbed = [...targetIds].some(id => before.timedEffects.some(e => e.kind === 'nail-mitigation' && e.targetInstanceId === id) && !m.timedEffects.some(e => e.kind === 'nail-mitigation' && e.targetInstanceId === id));
    if (absorbed) text += ' Nail Tech absorbed 1 Hands of the reduction.';
    const arrivals = (m.districtRuntime?.trappedCardIds ?? []).filter(id => !before.districtRuntime?.trappedCardIds.includes(id));
    if (arrivals.length) text += ` THE TRAP: ${arrivals.map(id => findCard(m, id)?.name).join(', ')} gained +2 Hands.`;
    const held = [source.instanceId, ...targetIds].map(id => findCard(m, id)).filter(c => c?.lastEffectNote === 'COUNTY JAIL blocked movement.');
    if (held.length) text = `COUNTY JAIL held ${held.map(c => c!.name).join(', ')} in place. Movement did not resolve.`;
    const moved = [source.instanceId, ...targetIds, ...changed].some((id) => {
      const previous = findCard(before, id), current = findCard(m, id);
      return previous && current && previous.lane !== current.lane;
    });
    // Delayed counters may already have emitted their own authoritative transition.
    // A wrapper note starts from the settled state so replay frames never repeat it.
    const eventBefore = m.effectLog.length > before.effectLog.length ? m : before;
    m = addEvent(eventBefore, m, { type: 'ability', sourceId: source.instanceId, owner: source.owner, targetIds: [...targetIds, ...changed], note: text, kind: moved ? 'move' : kind, timing, duration });
  };
  if (source.statuses.silenced || source.statuses.frozen || source.statuses.weakened) { note('Ability did not fire (silenced, frozen, or weakened).'); return m; }
  if (Object.hasOwn(afterHoursWaveCards, source.cardId)) {
    const allies = inLane(m, source.owner, l).filter(c => c.instanceId !== source.instanceId);
    let succeeded = false;
    const addHands = (target: CardInstance, amount: number, text: string) => {
      targetIds.add(target.instanceId);
      m = modify(m, target.instanceId, c => ({ ...c, powerModifier: c.powerModifier + amount, lastEffectNote: text }));
      succeeded = true;
    };
    const openDestinations = () => ([0, 1, 2] as Lane[])
      .filter(destination => destination !== l && !getStoryLockedLanes(m, source.owner).includes(destination)
        && inLane(m, source.owner, destination).length < 4)
      .sort((a, b) => getLaneScoreForMatch(m, inLane(m, source.owner, a), a, source.owner)
        - getLaneScoreForMatch(m, inLane(m, source.owner, b), b, source.owner) || a - b);
    if (source.cardId === 'sugarfoot') {
      const target = highest(inLane(m, enemy, l));
      if (target) {
        targetIds.add(target.instanceId);
        let landed = false;
        let hitAlreadyWeakened = false;
        m = hostileEffect(m, source, target, (state, actual) => {
          landed = true;
          hitAlreadyWeakened = actual.statuses.weakened;
          return queueDisruptionReactions(state, modify(state, actual.instanceId, c => ({
            ...c, statuses: { ...c.statuses, weakened: true }, lastEffectNote: 'Sweet Weakness: Weakened.',
          })), source, actual.instanceId);
        }, false, false, true);
        if (landed && findCard(m, target.instanceId)?.lastEffectNote !== 'Turn It Around: hostile effect negated; +2 Hands.') {
          succeeded = true;
          if (hitAlreadyWeakened) addHands(findCard(m, source.instanceId)!, 1, 'Sweet Weakness: already Weakened, +1 Hand.');
        }
      }
    } else if (source.cardId === 'yn-gokarter') {
      const destination = openDestinations()[0];
      if (destination !== undefined) {
        m = move(m, findCard(m, source.instanceId)!, destination, 'Victory Lap: moved to the weakest open district.');
        if (findCard(m, source.instanceId)?.lane === destination) {
          succeeded = true;
          const target = lowest(inLane(m, source.owner, destination).filter(c => c.instanceId !== source.instanceId));
          if (target) addHands(target, 1, 'Victory Lap: +1 Hand.');
        }
      }
    } else if (source.cardId === 'yn-atv-lord') {
      const target = lowest(allies);
      const destination = openDestinations()[0];
      if (target && destination !== undefined) {
        targetIds.add(target.instanceId);
        m = move(m, target, destination, 'Trail Guide: moved to the weakest open district.');
        if (findCard(m, target.instanceId)?.lane === destination) {
          addHands(findCard(m, target.instanceId)!, 1, 'Trail Guide: successful move, +1 Hand.');
        }
      }
    } else if (source.cardId === 'homeless-wiseman') {
      const destination = ([0, 1, 2] as Lane[])
        .filter(candidate => !getStoryLockedLanes(m, enemy).includes(candidate) && inLane(m, enemy, candidate).length < 4)
        .sort((a, b) => getLaneScoreForMatch(m, inLane(m, enemy, a), a, enemy)
          - getLaneScoreForMatch(m, inLane(m, enemy, b), b, enemy) || a - b)[0];
      if (destination !== undefined) {
        m = { ...m, districtTraps: [
          ...(m.districtTraps ?? []).filter(trap => !(trap.kind === 'wiseman' && trap.owner === source.owner
            && trap.lane === destination && trap.source.instanceId === source.instanceId)),
          { kind: 'wiseman', owner: source.owner, lane: destination, source: findCard(m, source.instanceId) ?? source, expiresAfterRound: m.round + 1 },
        ] };
        succeeded = true;
      }
    } else if (source.cardId === 'juneteenth-chair-guy') {
      const target = highest(inLane(m, enemy, l));
      if (target) {
        targetIds.add(target.instanceId);
        const old = target.powerModifier;
        m = targetEnemyPowerReduction(m, source, target, 2, 'Fold-Out Justice: -2 Hands.');
        const current = findCard(m, target.instanceId);
        succeeded ||= !current || current.powerModifier < old;
      }
      const ally = lowest(allies);
      if (ally) {
        targetIds.add(ally.instanceId);
        const wasProtected = ally.statuses.protected;
        m = grantProtection(m, source, ally.instanceId);
        succeeded ||= !wasProtected && !!findCard(m, ally.instanceId)?.statuses.protected;
      }
    } else if (source.cardId === 'squabble-house-manager') {
      if (inLane(m, enemy, l).length) addHands(findCard(m, source.instanceId)!, 1, 'Home Advantage: enemy here, +1 Hand.');
    }
    note(succeeded ? `${source.ability} resolved.` : `${source.ability} found no legal target, open district, or removable status.`);
    if (succeeded) m = trainWaveAbility(m, source.instanceId);
    return !echoed ? { ...m, lastRevealedCardId: source.cardId } : m;
  }
  if (Object.hasOwn(cellblockWaveCards, source.cardId)) {
    const allies = inLane(m, source.owner, l).filter(c => c.instanceId !== source.instanceId);
    let succeeded = false;
    let resolutionNote: string | undefined;
    const buff = (target: CardInstance, amount: number) => {
      targetIds.add(target.instanceId);
      m = modify(m, target.instanceId, c => ({ ...c, powerModifier: c.powerModifier + amount,
        lastEffectNote: `${source.ability}: +${amount} Hands.` }));
      succeeded = true;
    };
    if (source.cardId === 'inmate-crafty' && allies.some(c => c.kind === 'support')) {
      buff(source, 2);
    } else if (source.cardId === 'inmate-boyfriend') {
      const target = lowest(allies);
      if (target) buff(target, 2);
      const remote = lowest(m.boards.flat().filter(c => !c.hazard && c.owner === source.owner
        && c.lane !== l && c.instanceId !== source.instanceId && (c.kind ?? 'character') === 'character'
        && ['inmate-crafty', 'inmate-boyfriend', 'inmate-informant', 'inmate-contraband'].includes(c.cardId)));
      if (remote) buff(remote, 1);
      if (target || remote) resolutionNote = 'Looking Out resolved.'
        + (target ? ` ${target.name} here gained +2 Hands.` : '')
        + (remote ? ` ${remote.name} in another district gained +1 Hand.` : '');
    } else if (source.cardId === 'inmate-informant') {
      const target = highest(inLane(m, enemy, l));
      if (target) {
        targetIds.add(target.instanceId);
        m = targetEnemyPowerReduction(m, source, target, 2, 'Quiet Tip: -2 Hands.');
        // Count actual damage (including an intercepted hit), not a consumed shield.
        succeeded = before.boards.flat().some(old => old.owner === enemy
          && (!findCard(m, old.instanceId) || findCard(m, old.instanceId)!.powerModifier < old.powerModifier));
      }
    } else if (source.cardId === 'inmate-contraband' && allies.some(c => (c.kind ?? 'character') === 'character')) {
      const key = source.owner === 'player' ? 'playerMotion' : 'cpuMotion';
      const previous = m[key];
      m = refundMotion(m, source.owner, 1);
      succeeded = m[key] > previous;
    } else if (source.cardId === 'lebron-james') {
      // Snapshot the condition before cleansing an ally changes the district score.
      const losing = getLaneScoreForMatch(m, inLane(m, source.owner, l), l, source.owner)
        < getLaneScoreForMatch(m, inLane(m, enemy, l), l, enemy);
      const target = lowest(allies);
      if (target) {
        targetIds.add(target.instanceId);
        m = cleanseAlly(m, target.instanceId, c => ({ ...c, statuses: { ...cleanseStatuses(c.statuses), protected: true },
          burnSource: undefined, lastEffectNote: 'Regular Guy: cleansed and protected.' }));
        m = { ...m, timedEffects: [...m.timedEffects.filter(e => e.id !== `regular-guy:${source.instanceId}:${target.instanceId}`), {
          id: `regular-guy:${source.instanceId}:${target.instanceId}`, kind: 'church-protection', sourceInstanceId: source.instanceId,
          targetInstanceId: target.instanceId, owner: source.owner, lane: l, startsAtRound: m.round,
          expiresAtRound: 7, expiration: 'match-complete',
        }] };
        succeeded = JSON.stringify(target.statuses) !== JSON.stringify(findCard(m, target.instanceId)!.statuses);
      }
      if (losing) buff(source, 1);
    }
    note(succeeded ? resolutionNote ?? `${source.ability} resolved.` : `${source.ability}: condition not met, effect blocked, or already at cap.`);
    if (!echoed && succeeded) m = trainWaveAbility(m, source.instanceId);
    return !echoed ? { ...m, lastRevealedCardId: source.cardId } : m;
  }
  if (Object.hasOwn(neighborhoodWaveCards, source.cardId)) {
    const allies = inLane(m, source.owner, l).filter(c => c.instanceId !== source.instanceId);
    let succeeded = false;
    let resolutionNote: string | undefined;
    if (source.cardId === 'hair-stylist' || source.cardId === 'stylist') {
      const target = lowest(allies);
      if (target) {
        targetIds.add(target.instanceId);
        if (source.cardId === 'hair-stylist') {
          m = cleanseAlly(m, target.instanceId, c => ({ ...c, statuses: cleanseStatuses(c.statuses), burnSource: undefined,
            powerModifier: c.powerModifier + 1, lastEffectNote: 'Blowout: cleansed, +1 Hand.' }));
        } else {
          m = modify(m, target.instanceId, c => ({ ...c, statuses: { ...c.statuses, protected: true },
            powerModifier: c.powerModifier + 1, lastEffectNote: 'Fresh Fit: +1 Hand and Protect.' }));
          m = { ...m, timedEffects: [...m.timedEffects, {
            id: `fresh-fit:${source.instanceId}:${target.instanceId}`, kind: 'church-protection', sourceInstanceId: source.instanceId,
            targetInstanceId: target.instanceId, owner: source.owner, lane: l, startsAtRound: m.round,
            expiresAtRound: 7, expiration: 'match-complete',
          }] };
        }
        succeeded = true;
      }
    } else if (source.cardId === 'demario' && inLane(m, source.owner, l).length < 4) {
      m = summonCard(m, source.owner, l, DEMARIO_MUSHROOM, 'demario-mushroom', source);
      const token = m.boards[l].at(-1)!;
      targetIds.add(token.instanceId);
      m = fairytaleArrival(m, token.instanceId);
      m = applyScentEntry(m, token.instanceId);
      succeeded = true;
    } else if (source.cardId === 'luigion') {
      const powered = source.id === LUIGION_POWERED.id || source.name === LUIGION_POWERED.name;
      const mushroom = !echoed && !source.luigionMushroomUsed
        ? lowest(allies.filter(c => c.cardId === 'demario-mushroom')) : undefined;
      if (mushroom) {
        targetIds.add(mushroom.instanceId);
        m = { ...m, boards: m.boards.map(items => items.filter(c => c.instanceId !== mushroom.instanceId)) as Match['boards'],
          timedEffects: m.timedEffects.filter(e => e.targetInstanceId !== mushroom.instanceId) };
        m = fairytaleDeparture(m, mushroom);
        m = modify(m, source.instanceId, c => ({ ...c, luigionMushroomUsed: true }));
      }
      const otherCharacter = lowest(allies.filter(c => !c.hazard && (c.kind ?? 'character') === 'character'
        && c.instanceId !== source.instanceId));
      // Keep the powered burst ceiling: its Mushroom replaces the solo fallback.
      const bonus = powered ? 1 + (mushroom ? 2 : otherCharacter ? 0 : 1)
        : 1 + (otherCharacter ? 0 : 1) + (mushroom ? 2 : 0);
      resolutionNote = `${source.ability}: gained +${bonus - (mushroom ? 2 : 0)} Hands.`
        + (mushroom ? ' Consumed a local friendly Mushroom for +2 Hands.' : '')
        + (otherCharacter ? ` ${otherCharacter.name} gained +1 Hand.` : '');
      m = modify(m, source.instanceId, c => ({ ...c, powerModifier: c.powerModifier + bonus,
        lastEffectNote: `Power-Up: +${bonus} Hands${mushroom ? '; consumed a local friendly Mushroom' : ''}.` }));
      if (otherCharacter) {
        targetIds.add(otherCharacter.instanceId);
        m = modify(m, otherCharacter.instanceId, c => ({ ...c, powerModifier: c.powerModifier + 1, lastEffectNote: 'Power-Up: weakest other character +1 Hand.' }));
      }
      succeeded = true;
      if (powered && !echoed) {
        const destinations = ([0, 1, 2] as Lane[]).filter(destination => destination !== l && inLane(m, source.owner, destination).length < 4)
          .sort((a, b) => getLaneScoreForMatch(m, inLane(m, source.owner, a), a, source.owner)
            - getLaneScoreForMatch(m, inLane(m, source.owner, b), b, source.owner) || a - b);
        if (destinations.length) {
          const destination = destinations[0];
          m = move(m, findCard(m, source.instanceId) ?? source, destination, 'Powered Luigion jumped to the weakest open district.');
          if (findCard(m, source.instanceId)?.lane === destination) {
            m = modify(m, source.instanceId, c => ({ ...c, powerModifier: c.powerModifier + 1, lastEffectNote: 'Powered Luigion jumped: +1 Hand.' }));
            resolutionNote += ' Jumped to the weakest open district and gained +1 Hand.';
          } else {
            resolutionNote += ' Jump was blocked; no jump bonus.';
          }
        } else {
          resolutionNote += ' No other open district; no jump bonus.';
        }
      }
    } else if (source.cardId === 'black-cowboy' && inLane(m, enemy, l).length < 4) {
      const target = lowest(m.boards.flat().filter(c => !c.hazard && c.owner === enemy && c.lane !== l));
      if (target) {
        targetIds.add(target.instanceId);
        m = forceEnemyMove(m, source, target, l);
        succeeded = findCard(m, target.instanceId)?.lane === l;
      }
    }
    note(succeeded ? resolutionNote ?? `${source.ability} resolved.` : `${source.ability} found no legal target or space.`);
    if (succeeded) m = trainWaveAbility(m, source.instanceId);
    return !echoed ? { ...m, lastRevealedCardId: source.cardId } : m;
  }
  if (Object.hasOwn(fairytaleCards, source.cardId)) {
    const result = resolveFairytaleAbility(m, source, echoed);
    return !echoed && source.effect.includes('On Reveal:')
      ? { ...result, lastRevealedCardId: source.cardId, entranceHistory: [...(result.entranceHistory ?? []).filter(id => id !== source.instanceId), source.instanceId] }
      : result;
  }
  if (source.cardId === 'rastamon') { const t = lowest(inLane(m, source.owner, l).filter((c) => c.instanceId !== source.instanceId && (c.statuses.frozen || c.statuses.silenced))); if (t) { targetIds.add(t.instanceId); m = cleanseAlly(m, t.instanceId, (c) => ({ ...c, statuses: cleanseStatuses(c.statuses), powerModifier: c.powerModifier + 2, lastEffectNote: 'Natural Cure: cleansed, +2 Hands.' })); note('Natural Cure cleansed an ally and gave it +2.'); } else note('Natural Cure found no status to cleanse.'); }
  else if (source.cardId === 'roaster') {
    const t = highest(inLane(m, enemy, l));
    if (t) {
      targetIds.add(t.instanceId);
      const amount = t.playedRound === m.round ? -3 : -2;
      m = targetEnemyBurnAndPowerReduction(m, source, t, 2, amount, `Ratio'd Receipts: 2 Burn, ${Math.abs(amount)} immediate Hands loss.`);
      note(`Ratio'd Receipts targeted ${t.name} (2 Burn + ${Math.abs(amount)} immediate Hands loss).`);
    } else note("Ratio'd Receipts found no enemy.");
  }
  else if (source.cardId === 'nerd') { const t = highest(inLane(m, enemy, l)); if (t) { targetIds.add(t.instanceId); m = targetEnemy(m, source, t, (c) => ({ ...c, statuses: { ...c.statuses, silenced: true }, lastEffectNote: 'Unaware: silenced.' }), true); note('Unaware targeted the highest enemy through Side Eye.'); } else note('Unaware found no enemy.'); }
  else if (source.cardId === 'cornball') {
    let burned = 0;
    for (const t of inLane(m, enemy, l)) {
      targetIds.add(t.instanceId);
      m = applyBurn(m, source, t, 1, 'Scare the Hoes: 1 Burn.');
      burned++;
    }
    note(burned ? `Scare the Hoes applied 1 Burn to ${burned} enemies.` : 'Scare the Hoes found no enemies.');
  }
  else if (source.cardId === 'plug') { m = addDiscountToken(m, source.owner, source, 'another-district'); m = { ...m, plugDiscountLane: { ...m.plugDiscountLane, [source.owner]: l } }; note('Connections: next card in another district costs 1 less Motion.'); }
  else if (source.cardId === 'sneaker') {
    // Steal: copy the highest-Hands enemy's printed Power onto Sneaker (capped at +7) and apply Weaken.
    const target = highest(m.boards.flat().filter(c => !c.hazard && c.owner === enemy && c.kind !== 'support'));
    if (target) {
      targetIds.add(target.instanceId);
      const bonus = Math.min(7, target.basePower);
      m = modify(m, source.instanceId, c => ({ ...c, powerModifier: c.powerModifier + bonus, lastEffectNote: `Flip Season: +${bonus} Hands (stolen from ${target.name}).` }));
      m = applyWeaken(m, source, target, 'Flip Season: Weakened.');
      note(`Flip Season stole ${bonus} Hands from ${target.name}.`);
    } else note('Flip Season found no enemy.');
  }
  else if (source.cardId === 'bossbabe') note('Network Boost watches the first two plays in other districts.');
  else if (source.cardId === 'scammer') {
    const target = highest(inLane(m, enemy, l));
    if (target) {
      targetIds.add(target.instanceId);
      const printed = cards[target.cardId] ?? target;
      m = modify(m, source.instanceId, card => ({ ...card,
        basePower: Math.min(7, target.basePower), copiedAbilityCardId: target.cardId,
        ability: printed.ability, effect: printed.effect,
        lastEffectNote: `Imposter copied ${target.name}'s base Hands and ${printed.ability}. On Reveal does not repeat.`,
      }));
      note(`Imposter copied ${target.name}'s base Hands and ${printed.ability}. On Reveal does not repeat.`);
    } else note('Imposter found no enemy to copy.');
  }
  else if (source.cardId === 'streamer') {
    // Reset the owner's cheap-play trigger counter to 0; the existing reactive logic in resolveCardPlay
    // arms up to 2 fresh Follower Frenzy triggers. This converts Streamer from "while-on-board" reactive
    // to "On Reveal trigger reset" without changing the reactive buff behavior.
    m = { ...m, cheapBuffsUsed: { ...m.cheapBuffsUsed, [source.owner]: 0 } };
    note('Follower Frenzy armed — the next 2 cheap plays gain +1 Hand.');
  }
  else if (source.cardId === 'gamer') {
    // City Tour: visit the other two districts and buff each lane's lowest-Hands friendly card.
    let buffed = 0;
    for (const targetLane of [0, 1, 2] as Lane[]) {
      if (targetLane === l) continue;
      const target = lowest(inLane(m, source.owner, targetLane));
      if (target) {
        targetIds.add(target.instanceId);
        m = modify(m, target.instanceId, c => ({ ...c, powerModifier: c.powerModifier + 1, lastEffectNote: 'City Tour: +1 Hand.' }));
        buffed++;
      }
    }
    note(buffed ? `City Tour visited ${buffed} other districts.` : 'City Tour found no allies.');
  }
  else if (source.cardId === 'stockz') { note('Compound Interest is watching your next character plays.'); }
  else if (source.cardId === 'techbro') { const supported = inLane(m, source.owner, l).some(c => c.instanceId !== source.instanceId); if (supported) { m = modify(m, source.instanceId, (c) => ({ ...c, powerModifier: c.powerModifier + 2, lastEffectNote: 'VC Funded Flex: +2 Hands.' })); note('VC Funded Flex gained +2 Hands with an ally here.'); } else note('VC Funded Flex needs another friendly card here.'); }
  else if (source.cardId === 'bikelife') { const to = lowestFriendlyLane(m, source.owner, l); m = move(m, source, to, 'Ride Out moved here, +1 Hands.'); if (findCard(m, source.instanceId)?.lane === to) m = modify(m, source.instanceId, (c) => ({ ...c, powerModifier: c.powerModifier + 1, lastEffectNote: 'Ride Out moved here, +1 Hands.' })); note('Ride Out moved Bikelife and gave +1.'); }
  else if (source.cardId === 'vibe') { const t = lowest(m.boards.flat().filter((c) => !c.hazard && c.owner === source.owner && c.instanceId !== source.instanceId && c.lane !== l)); if (t) { targetIds.add(t.instanceId); m = move(m, t, l, 'Wave Check pulled this card here, +1 Hands.'); if (findCard(m, t.instanceId)?.lane === l) { m = modify(m, t.instanceId, (c) => ({ ...c, powerModifier: c.powerModifier + 1, lastEffectNote: 'Wave Check pulled this card here, +1 Hands.' })); m = modify(m, source.instanceId, (c) => ({ ...c, powerModifier: c.powerModifier + 1, lastEffectNote: 'Wave Check: +1 Hands.' })); } note('Wave Check pulled the lowest ally here; both gained +1.'); } else note('Wave Check needs an ally in another district.'); }
  else if (source.cardId === 'hooper') { if (getLaneScoreForMatch(m, inLane(m, source.owner, l), l, source.owner) < getLaneScoreForMatch(m, inLane(m, enemy, l), l, enemy)) { const t = highest(inLane(m, enemy, l)); if (t) { targetIds.add(t.instanceId); m = targetEnemyPowerReduction(m, source, t, -2, 'Ankle Breaker: -2 Hands.'); } m = modify(m, source.instanceId, (c) => ({ ...c, powerModifier: c.powerModifier + 2, lastEffectNote: 'Ankle Breaker: +2 Hands.' })); note('Ankle Breaker flipped the pressure.'); } else note('Ankle Breaker only triggers while losing.'); }
  else if (source.cardId === 'baby') { if (inLane(m, enemy, l).length > inLane(m, source.owner, l).length) { m = modify(m, source.instanceId, (c) => ({ ...c, powerModifier: c.powerModifier + 2, lastEffectNote: 'Mama Bear: +2 Hands.' })); note('Mama Bear gained +2.'); } else note('Mama Bear found no crowd disadvantage.'); }
  else if (source.cardId === 'guap') {
    if (m.guapRounds?.[source.owner] === m.round) {
      m = modify(m, source.instanceId, c => ({ ...c, lastEffectNote: 'FINNAM!: already used this round.' }));
      note('FINNAM! already resolved this round.');
    } else {
      const allies = m.boards.flat().filter(c => !c.hazard && c.owner === source.owner
        && c.instanceId !== source.instanceId && (c.kind ?? 'character') === 'character');
      const bonus = Math.min(5, allies.length);
      m = { ...m, guapRounds: { ...m.guapRounds, [source.owner]: m.round } };
      m = modify(m, source.instanceId, c => ({ ...c, guapRound: m.round, powerModifier: c.powerModifier + bonus, lastEffectNote: `FINNAM!: +${bonus} Hands across the board.` }));
      for (const target of m.boards.flat().filter(c => !c.hazard && c.owner === enemy)) {
        targetIds.add(target.instanceId);
        m = targetEnemyPowerReduction(m, source, target, -1, 'FINNAM!: -1 Hands across the board.');
      }
      note(`FINNAM! GUAP erupted across the board (+${bonus}, -1 AOE).`);
    }
  }
  else if (source.cardId === 'oink') {
    let weakenedCount = 0;
    for (const t of inLane(m, enemy, l)) {
      targetIds.add(t.instanceId);
      m = applyWeaken(m, source, t, 'Civic Pressure: Weakened.');
      if (findCard(m, t.instanceId)?.statuses.weakened) weakenedCount++;
    }
    if (weakenedCount > 0) m = modify(m, source.instanceId, c => ({ ...c, powerModifier: c.powerModifier + weakenedCount, lastEffectNote: `Civic Pressure: +${weakenedCount} Hands.` }));
    note(`Civic Pressure weakened ${weakenedCount} enemies.`);
  }
  else if (source.cardId === 'snow') { const t = highest(inLane(m, enemy, l)); if (t) { targetIds.add(t.instanceId); m = targetEnemy(m, source, t, (c) => ({ ...c, statuses: { ...c.statuses, frozen: true }, lastEffectNote: 'Cold Shoulder: frozen.' })); note('Cold Shoulder froze the highest enemy.'); } else note('Cold Shoulder found no enemy.'); }
  else if (source.cardId === 'buddy') {
    const enemies = inLane(m, enemy, l);
    const isMythical = (card: CardInstance) => catalogCardByEngineId[card.cardId]?.rarity === 'Mythical';
    const target = highest(enemies.filter(isMythical)) ?? highest(enemies);
    if (target) {
      targetIds.add(target.instanceId);
      let hitLanded = false, mythicalHit = false;
      m = hostileEffect(m, source, target, (state, actual) => {
        const mythical = isMythical(actual);
        let after = reduceHands(state, actual, mythical ? 5 : 2,
          mythical ? 'Myth Buster: -5 Hands and Silence.' : 'Myth Buster: -2 Hands.');
        const survivor = findCard(after, actual.instanceId);
        hitLanded = !survivor || survivor.powerModifier < actual.powerModifier;
        mythicalHit = mythical && hitLanded;
        if (mythicalHit) {
          if (survivor) after = queueDisruptionReactions(after, modify(after, actual.instanceId, c => ({
            ...c, statuses: { ...c.statuses, silenced: true },
          })), source, actual.instanceId);
          after = modify(after, source.instanceId, c => ({ ...c, powerModifier: c.powerModifier + 2,
            lastEffectNote: 'Myth Buster: +2 Hands for hitting a Mythical.' }));
        }
        return after;
      }, false, false, true);
      note(hitLanded ? mythicalHit ? 'Myth Buster hit a Mythical: -5 Hands, Silence, BUDDY +2.' : 'Myth Buster: -2 Hands.' : 'Myth Buster was blocked.');
    } else note('Myth Buster found no enemy here.');
  }
  else if (source.cardId === 'folks') {
    for (const target of m.boards.flat().filter(c => !c.hazard && c.owner === enemy)) {
      targetIds.add(target.instanceId);
      m = applyBurn(m, source, target, 3, 'Whole Block Hot: 3 Burn.');
    }
    for (const ally of m.boards.flat().filter(c => !c.hazard && c.owner === source.owner && c.instanceId !== source.instanceId && c.kind !== 'support' && c.type === 'Fire')) {
      targetIds.add(ally.instanceId);
      m = modify(m, ally.instanceId, c => ({ ...c, powerModifier: c.powerModifier + 1, lastEffectNote: 'Whole Block Hot: Fire ally +1 Hand.' }));
    }
    note(targetIds.size ? 'Whole Block Hot: 3 Burn across the enemy board; other Fire allies +1 Hand.' : 'Whole Block Hot needs an enemy or another Fire ally.');
  }
  else if (source.cardId === 'drfade') {
    const hostile = highest(inLane(m, enemy, l));
    const friendly = lowest(m.boards.flat().filter(c => !c.hazard && c.owner === source.owner && c.lane !== l));
    if (hostile) {
      targetIds.add(hostile.instanceId);
      m = targetEnemyPowerReduction(m, source, hostile, -2, 'The First Lesson: -2 Hands.');
    }
    if (friendly) {
      targetIds.add(friendly.instanceId);
      m = modify(m, friendly.instanceId, c => ({ ...c, powerModifier: c.powerModifier + 2, lastEffectNote: 'Corner advice: +2 Hands.' }));
    }
    note(hostile || friendly ? 'The First Lesson: throw hands here, coach an ally across the block.' : 'Dr. Fade is holding this district. His lesson needs another fighter.');
  }
  else if (source.cardId === 'barber') {
    const friendly = lowest(inLane(m, source.owner, l).filter((c) => c.instanceId !== source.instanceId));
    const hostile = highest(inLane(m, enemy, l));
    if (friendly) { targetIds.add(friendly.instanceId); m = modify(m, friendly.instanceId, (c) => ({ ...c, powerModifier: c.powerModifier + 2, lastEffectNote: "Line Up: +2 Hands." })); }
    if (hostile) { targetIds.add(hostile.instanceId); m = targetEnemyPowerReduction(m, source, hostile, -1, "Line Up: -1 Hands."); }
    note(friendly || hostile ? "Line Up sharpened the district." : "Line Up found no other cards.");
  }
  else if (source.cardId === 'bottle') {
    if (m.round >= 4) m = modify(m, source.instanceId, (c) => ({ ...c, powerModifier: c.powerModifier + 2, lastEffectNote: "Last Call: +2 Hands." }));
    m = addDiscountToken(m, source.owner, source, "poison-character");
    const tokenOrder = m.nextDiscountOrder - 1;
    m = { ...m, discountTokens: m.discountTokens.map(token => token.createdOrder === tokenOrder ? { ...token, expiresAfterRound: m.round + 1 } : token) };
    note(`${m.round >= 4 ? "Last Call gave +2 Hands. " : ""}Last Call set aside a Poison-character discount through next round.`);
  }
  else if (source.cardId === 'church') {
    const target = lowest(inLane(m, source.owner, l).filter((c) => c.instanceId !== source.instanceId));
    if (!target) note("Covered needs another friendly card.");
    else if (target.statuses.protected) { targetIds.add(target.instanceId); m = modify(m, target.instanceId, (c) => ({ ...c, powerModifier: c.powerModifier + 2, lastEffectNote: "Covered: already protected, +2 Hands." })); note("Covered reinforced an already protected ally."); }
    else {
      targetIds.add(target.instanceId);
      m = modify(m, target.instanceId, (c) => ({ ...c, powerModifier: c.powerModifier + 2, statuses: { ...c.statuses, protected: true }, lastEffectNote: "Covered: +2 Hands and protected from one targeted hostile ability." }));
      m = { ...m, timedEffects: [...m.timedEffects, { id: `church:${source.instanceId}:${target.instanceId}`, kind: "church-protection", sourceInstanceId: source.instanceId, targetInstanceId: target.instanceId, owner: source.owner, lane: l, startsAtRound: m.round, expiresAtRound: 7, expiration: "match-complete" }] };
      note("Covered gave the lowest-Hands friendly card +2 Hands and protection.");
    }
  }
  else if (source.cardId === 'carmeet') {
    const destination = lowestFriendlyLane(m, source.owner, l);
    m = move(m, source, destination, "Sideshow moved to the weakest other district.");
    const target = findCard(m, source.instanceId)?.lane === destination ? lowest(inLane(m, source.owner, destination).filter((c) => c.instanceId !== source.instanceId)) : undefined;
    if (target) { targetIds.add(target.instanceId); m = modify(m, target.instanceId, (c) => ({ ...c, powerModifier: c.powerModifier + 1, lastEffectNote: "Sideshow: +1 Hands." })); }
    note(target ? "Sideshow moved and gave an ally +1 Hands." : "Sideshow moved to the weakest other district.");
  }
  else if (source.cardId === 'promoter') {
    const revealed = [...(enemy === "player" ? m.playerHand : m.cpuHand)].sort((a, b) => a.instanceId.localeCompare(b.instanceId))[0];
    if (!revealed) note("Guest List found no opponent hand card.");
    else { targetIds.add(revealed.instanceId); if (revealed.cost >= 4) m = addDiscountToken(m, source.owner, source, "another-district"); note(`Guest List revealed ${revealed.name} (${revealed.cost} Motion)${revealed.cost >= 4 ? " and set aside an another-district discount." : "."}`); }
  }
  else if (source.cardId === 'nail') {
    const target = lowest(inLane(m, source.owner, l).filter((c) => c.instanceId !== source.instanceId));
    if (!target) note("Fresh Set needs another friendly card.");
    else { targetIds.add(target.instanceId); m = modify(m, target.instanceId, (c) => ({ ...c, powerModifier: c.powerModifier + 2, lastEffectNote: "Fresh Set: +2 Hands." })); m = { ...m, timedEffects: [...m.timedEffects.filter((effect) => effect.kind !== "nail-mitigation" || effect.targetInstanceId !== target.instanceId), { id: `nail:${source.instanceId}:${target.instanceId}`, kind: "nail-mitigation", sourceInstanceId: source.instanceId, targetInstanceId: target.instanceId, owner: source.owner, lane: l, startsAtRound: m.round, expiresAtRound: 7, expiration: "match-complete" }] }; note("Fresh Set gave +2 Hands and reinforced the next hostile reduction."); }
  }
  else if (source.cardId === 'og') {
    const ownCount = m.boards.flat().filter((c) => !c.hazard && c.owner === source.owner).length, enemyCount = m.boards.flat().filter((c) => !c.hazard && c.owner === enemy).length;
    if (enemyCount > ownCount) m = modify(m, source.instanceId, (c) => ({ ...c, powerModifier: c.powerModifier + 3, lastEffectNote: "Back In My Day: +3 Hands." }));
    if (enemyCount >= ownCount + 3) { const target = lowest(inLane(m, enemy, l)); if (target) { targetIds.add(target.instanceId); m = targetEnemyPowerReduction(m, source, target, -1, "Back In My Day: -1 Hands."); } }
    note(enemyCount > ownCount ? "Back In My Day punished the board advantage." : "Back In My Day found no larger opposing board.");
  }
  else if (source.cardId === 'delivery') {
    const target = lowest(inLane(m, source.owner, l).filter((c) => c.instanceId !== source.instanceId && c.cost <= 2));
    if (!target) note("Drop Off needs another friendly 1- or 2-Cost card here.");
    else { targetIds.add(target.instanceId); const destination = lowestFriendlyLane(m, source.owner, l); m = move(m, target, destination, "Drop Off moved this card to the weakest other district."); note("Drop Off moved the lowest-Hands eligible ally."); }
  }
  else if (source.cardId === 'shiesty') {
    const maxExtraCopies = 8;
    let summoned = 0;
    for (let roll = 0; roll < maxExtraCopies; roll++) {
      const seed = JSON.stringify(['shiesty-chain', source.instanceId, before.round, before.nextEventSequence, l, roll, before.districtSnapshot]);
      if (seededIndex(seed, 2) !== 0) break;
      m = summonCard(m, source.owner, l, cards.shiesty, 'shiesty', source);
      const copy = m.boards[l].at(-1)!;
      targetIds.add(copy.instanceId);
      summoned++;
    }
    const capped = summoned === maxExtraCopies;
    note(summoned
      ? `Mean Mug's 50% chain summoned ${summoned} extra Shiesty YN${summoned === 1 ? '' : 's'}.${capped ? ' Chain capped at 8 extras.' : ''}`
      : "Mean Mug's 50% summon chance missed.");
  }
  else if (['youngbull', 'transplant', 'edgar', 'nguyen', 'manman'].includes(source.cardId)) {
    const allies = inLane(m, source.owner, l).filter(c => c.instanceId !== source.instanceId);
    const enemiesHere = inLane(m, enemy, l);
    const succeeds = source.cardId === 'youngbull' ? true
      : source.cardId === 'shiesty' ? m.boards.flat().length > before.boards.flat().length
      : source.cardId === 'torta' ? allies.length > 0
      : source.cardId === 'transplant' ? allies.length === 0
      : source.cardId === 'edgar' ? allies.some(c => c.cost <= 2)
      : source.cardId === 'nguyen' ? m.boards.flat().some(c => !c.hazard && c.owner === source.owner && c.lane !== l)
      : allies.length >= 2;
    const amount = source.cardId === 'manman' ? 2 : 1;
    if (succeeds) {
      m = modify(m, source.instanceId, c => ({ ...c, powerModifier: c.powerModifier + amount, lastEffectNote: `${source.ability}: +${amount} Hands.` }));
      if (source.cardId === 'youngbull') {
        const burnTarget = highest(enemiesHere);
        if (burnTarget) { targetIds.add(burnTarget.instanceId); m = applyBurn(m, source, burnTarget, 1, 'Step Up: 1 Burn.'); }
      }
    }
    note(succeeds ? `${source.ability}: +${amount} Hands${source.cardId === 'youngbull' && enemiesHere.length ? ' + 1 Burn' : ''}.` : `${source.ability}: condition not met.`);
  }
  else if (source.cardId === 'tayaty') {
    // Act Up always grants +1, then resolves the previous On Reveal with Tayaty as its source.
    m = modify(m, source.instanceId, c => ({ ...c, powerModifier: c.powerModifier + 1, lastEffectNote: 'Act Up: +1 Hand.' }));
    const echoCardId = match.lastRevealedCardId;
    const echoedCard = echoCardId && !['tayaty', 'oz'].includes(echoCardId) ? cards[echoCardId] : null;
    if (echoCardId && echoedCard) {
      const current = findCard(m, source.instanceId)!;
      const echoSource: CardInstance = { ...current, cardId: echoCardId, ability: echoedCard.ability, effect: echoedCard.effect };
      m = resolveAbility(m, echoSource, { echoed: true });
      note(`Act Up echoed ${echoedCard.name}'s ${echoedCard.ability}.`);
    } else {
      note('Act Up gained +1 Hand; there was no earlier On Reveal to echo.');
    }
  }
  else if (source.cardId === 'waterboy') {
    const supported = inLane(m, source.owner, l).some(c => c.instanceId !== source.instanceId);
    if (supported) {
      const motionKey = source.owner === 'player' ? 'playerMotion' : 'cpuMotion';
      m = refundMotion(m, source.owner, 1);
    }
    note(supported ? 'Cold Water restored 1 Motion.' : 'Cold Water needs another friendly card here.');
  }
  else if (source.cardId === 'buspass') {
    m = addDiscountToken(m, source.owner, source, 'any');
    note('All-Day Transfer: your next card costs 1 less Motion.');
  }
  else if (source.cardId === 'energydrink' || source.cardId === 'charger') {
    const eligible = inLane(m, source.owner, l).filter(c => c.instanceId !== source.instanceId && c.kind !== 'support').length;
    const key = source.owner === 'player' ? 'playerMotion' : 'cpuMotion';
    const gain = source.cardId === 'energydrink'
      ? Math.min(MAX_MOTION - m[key], 3)
      : Math.min(MAX_MOTION - m[key], Math.min(3, eligible));
    m = refundMotion(m, source.owner, gain);
    note(source.cardId === 'energydrink'
      ? `Second Wind restored ${gain} Motion (maximum ${MAX_MOTION}).`
      : `Refund restored ${gain} Motion (${eligible} friendly characters here).`);
  }
  else if (source.cardId === 'firstaid' || source.cardId === 'boombox') {
    const targets = inLane(m, source.owner, l).filter(c => c.kind !== 'support' && (source.cardId === 'boombox' || c.statuses.frozen || c.statuses.silenced));
    for (const target of targets) {
      targetIds.add(target.instanceId);
      m = cleanseAlly(m, target.instanceId, c => source.cardId === 'firstaid'
        ? { ...c, statuses: cleanseStatuses(c.statuses), lastEffectNote: 'Patch Up: cleansed.' }
        : { ...c, powerModifier: c.powerModifier + 1, lastEffectNote: 'Turn It Up: +1 Hands.' });
    }
    note(targets.length ? `${source.ability} helped ${targets.length} friendly characters.` : `${source.ability} found no eligible friendly characters.`);
  }
  else if (source.cardId === 'subwaymap' || source.cardId === 'workboots') {
    const target = lowest(inLane(m, source.owner, l).filter(c => c.kind !== 'support'));
    if (!target) note(`${source.ability} needs a friendly character here.`);
    else {
      targetIds.add(target.instanceId);
      const destination = lowestFriendlyLane(m, source.owner, l);
      if (source.cardId === 'subwaymap') m = move(m, target, destination, 'Alternate Route moved this character.');
      const succeeded = source.cardId === 'workboots' || findCard(m, target.instanceId)?.lane === destination;
      const amount = source.cardId === 'workboots' ? 2 : 1;
      if (succeeded) m = modify(m, target.instanceId, c => ({ ...c, powerModifier: c.powerModifier + amount, lastEffectNote: `${source.ability}: +${amount} Hands.` }));
      if (source.cardId === 'workboots' && !target.statuses.protected) {
        m = modify(m, target.instanceId, c => ({ ...c, statuses: { ...c.statuses, protected: true } }));
        m = { ...m, timedEffects: [...m.timedEffects, { id: `workboots:${source.instanceId}:${target.instanceId}`, kind: 'church-protection', sourceInstanceId: source.instanceId, targetInstanceId: target.instanceId, owner: source.owner, lane: l, startsAtRound: m.round, expiresAtRound: 7, expiration: 'match-complete' }] };
      }
      note(succeeded ? `${source.ability}: ${target.name} gained +${amount} Hands${source.cardId === 'workboots' ? ' and protection' : ' after moving'}.` : 'Alternate Route could not move its target.');
    }
  }
  else if (source.cardId === 'bustdown') {
    const target = lowest(inLane(m, source.owner, l).filter(c => c.kind !== 'support' && c.instanceId !== source.instanceId));
    if (target && !target.statuses.protected) {
      targetIds.add(target.instanceId);
      m = modify(m, target.instanceId, c => ({ ...c, statuses: { ...c.statuses, protected: true }, lastEffectNote: 'Wrist Check: protected from one targeted hostile ability.' }));
      m = { ...m, timedEffects: [...m.timedEffects, { id: `bustdown:${source.instanceId}:${target.instanceId}`, kind: 'church-protection', sourceInstanceId: source.instanceId, targetInstanceId: target.instanceId, owner: source.owner, lane: l, startsAtRound: m.round, expiresAtRound: 7, expiration: 'match-complete' }] };
    }
    note(!target ? 'Wrist Check needs another friendly card here.' : target.statuses.protected ? 'Wrist Check: ally is already protected.' : `Wrist Check protected ${target.name}.`);
  }
  else if (source.cardId === 'pinaynurse' || source.cardId === 'soulfood') {
    const target = lowest(inLane(m, source.owner, l).filter(c => c.instanceId !== source.instanceId && (source.cardId !== 'soulfood' || c.kind !== 'support')));
    const amount = source.cardId === 'pinaynurse' ? 2 : 1;
    if (target) {
      targetIds.add(target.instanceId);
      m = cleanseAlly(m, target.instanceId, c => ({ ...c, statuses: cleanseStatuses(c.statuses), powerModifier: c.powerModifier + amount, lastEffectNote: `${source.ability}: cleansed, +${amount} Hands.` }));
    }
    note(target ? `${source.ability} cleansed an ally and gave +${amount} Hands.` : `${source.ability} needs another friendly card here.`);
  }
  else if (['earthy', 'cognac'].includes(source.cardId)) {
    const allies = inLane(m, source.owner, l).filter(c => c.instanceId !== source.instanceId && (source.cardId !== 'cognac' || c.kind !== 'support'));
    const target = lowest(allies);
    const targets = target ? [target] : [];
    const amount = source.cardId === 'cognac' ? 2 : 1;
    for (const ally of targets) {
      targetIds.add(ally.instanceId);
      m = modify(m, ally.instanceId, c => ({ ...c, powerModifier: c.powerModifier + amount, lastEffectNote: `${source.ability}: +${amount} Hands.` }));
    }
    note(targets.length ? `${source.ability} gave ${targets.length} allies +${amount} Hands.` : `${source.ability} needs another friendly card.`);
  }
  else if (source.cardId === 'mural') {
    const diverse = inLane(m, source.owner, l).some(c => c.instanceId !== source.instanceId && canonicalElement(c.type) !== canonicalElement(source.type));
    const target = highest(inLane(m, enemy, l));
    if (diverse && target) {
      targetIds.add(target.instanceId);
      m = applyLock(m, source, target, 'Fresh Color: Locked.');
    } else {
      m = modify(m, source.instanceId, c => ({ ...c, powerModifier: c.powerModifier + 1, lastEffectNote: 'Fresh Color: +1 Hands.' }));
    }
    note(!diverse ? 'Fresh Color needs another friendly type.' : target ? 'Fresh Color Locked the highest enemy.' : 'Fresh Color gained +1 Hands with no enemy here.');
  }
  else if (['bodegacat', 'dogwalker', 'dancecaptain', 'midnightmayor'].includes(source.cardId)) {
    const allies = inLane(m, source.owner, l).filter(c => c.instanceId !== source.instanceId);
    const succeeds = source.cardId === 'bodegacat' ? allies.length === 0
      : source.cardId === 'dogwalker' ? allies.length >= 2
      : source.cardId === 'dancecaptain' ? m.boards.every(board => board.some(c => c.owner === source.owner)) : true;
    const amount = source.cardId === 'dogwalker' ? 2 : source.cardId === 'dancecaptain' ? 3
      : source.cardId === 'midnightmayor' ? Math.min(3, new Set(inLane(m, source.owner, l).map(c => canonicalElement(c.type))).size) : 1;
    if (succeeds) m = modify(m, source.instanceId, c => ({ ...c, powerModifier: c.powerModifier + amount, lastEffectNote: `${source.ability}: +${amount} Hands.` }));
    note(succeeds ? `${source.ability}: +${amount} Hands.` : `${source.ability}: condition not met.`);
  }
  else if (source.cardId === 'crossingguard') {
    const target = lowest(inLane(m, source.owner, l).filter(c => c.instanceId !== source.instanceId));
    if (target && !target.statuses.protected) {
      targetIds.add(target.instanceId);
      m = modify(m, target.instanceId, c => ({ ...c, statuses: { ...c.statuses, protected: true }, lastEffectNote: 'Safe Crossing: protected from one targeted hostile ability.' }));
      m = { ...m, timedEffects: [...m.timedEffects, { id: `crossingguard:${source.instanceId}:${target.instanceId}`, kind: 'church-protection', sourceInstanceId: source.instanceId, targetInstanceId: target.instanceId, owner: source.owner, lane: l, startsAtRound: m.round, expiresAtRound: 7, expiration: 'match-complete' }] };
    }
    note(!target ? 'Safe Crossing needs another ally here.' : target.statuses.protected ? 'Safe Crossing: ally is already protected.' : `Safe Crossing protected ${target.name}.`);
  }
  else if (source.cardId === 'laundry' || source.cardId === 'nightmedic') {
    const eligible = inLane(m, source.owner, l).filter(c => c.instanceId !== source.instanceId
      && (source.cardId === 'nightmedic' ? needsCleanse(c) : c.statuses.frozen || c.statuses.silenced));
    const target = lowest(eligible);
    const targets = source.cardId === 'nightmedic' ? eligible : target ? [target] : [];
    for (const ally of targets) {
      targetIds.add(ally.instanceId);
      m = cleanseAlly(m, ally.instanceId, c => ({ ...c, statuses: cleanseStatuses(c.statuses), powerModifier: c.powerModifier + (source.cardId === 'laundry' ? 1 : 0), lastEffectNote: `${source.ability}: cleansed.` }));
    }
    note(targets.length ? `${source.ability} cleansed ${targets.length} allies.` : `${source.ability} found no status to cleanse.`);
  }
  else if (['busker', 'cornercoach', 'piratedj', 'partytitan'].includes(source.cardId)) {
    const allies = inLane(m, source.owner, l).filter(c => c.instanceId !== source.instanceId);
    const target = lowest(allies);
    const targets = source.cardId === 'busker' ? allies.filter(c => c.cost === 1)
      : source.cardId === 'cornercoach' ? target ? [target] : []
      : ([0, 1, 2] as Lane[]).filter(targetLane => source.cardId === 'partytitan' || targetLane !== l)
        .map(targetLane => lowest(inLane(m, source.owner, targetLane).filter(c => c.instanceId !== source.instanceId))).filter((c): c is CardInstance => !!c);
    const amount = source.cardId === 'cornercoach' ? 2 : 1;
    for (const ally of targets) {
      targetIds.add(ally.instanceId);
      m = modify(m, ally.instanceId, c => ({ ...c, powerModifier: c.powerModifier + amount, lastEffectNote: `${source.ability}: +${amount} Hands.` }));
    }
    note(targets.length ? `${source.ability} gave ${targets.length} allies +${amount} Hands.` : `${source.ability} found no eligible ally.`);
  }
  else if (source.cardId === 'nightcashier') {
    if (m.round >= 4) { const motionKey = source.owner === 'player' ? 'playerMotion' : 'cpuMotion'; m = refundMotion(m, source.owner, 1); }
    note(m.round >= 4 ? 'Late Shift restored 1 Motion.' : 'Late Shift needs round 4 or later.');
  }
  else if (source.cardId === 'chessregular') {
    const enemies = inLane(m, enemy, l);
    if (enemies.length === 1) {
      const target = enemies[0];
      const stacks = getEffectiveCardPower(target) >= 3 ? 2 : 1;
      targetIds.add(target.instanceId);
      m = applyBurn(m, source, target, stacks, `Quiet Fork: ${stacks} Burn.`);
      note(`Quiet Fork applied ${stacks} Burn to the lone enemy.`);
    } else note('Quiet Fork needs exactly one enemy here.');
  }
  else if (source.cardId === 'bigzoey') {
    const ally = lowest(inLane(m, source.owner, l).filter(c => c.instanceId !== source.instanceId));
    const target = lowest(inLane(m, enemy, l));
    if (ally) { targetIds.add(ally.instanceId); m = modify(m, ally.instanceId, c => ({ ...c, powerModifier: c.powerModifier + 2, lastEffectNote: 'Hold the Block: +2 Hands.' })); }
    if (target) { targetIds.add(target.instanceId); m = targetEnemyPowerReduction(m, source, target, -2, 'Hold the Block: -2 Hands.'); }
    note(ally || target ? 'Hold the Block shifted the district.' : 'Hold the Block found no other cards.');
  }
  else if (source.cardId === 'leroy') {
    const succeeds = new Set(m.boards.flat().filter(c => !c.hazard && c.owner === source.owner).map(c => canonicalElement(c.type))).size >= 3;
    if (succeeds) {
      m = modify(m, source.instanceId, c => ({ ...c, powerModifier: c.powerModifier + 1, lastEffectNote: 'Golden Glow: +1 Hands.' }));
      const target = highest(inLane(m, enemy, l));
      if (target) { targetIds.add(target.instanceId); m = targetEnemyPowerReduction(m, source, target, -2, 'Golden Glow: -2 Hands.'); }
    }
    note(succeeds ? 'Golden Glow struck.' : 'Golden Glow needs three friendly types on your board.');
  }
  else if (source.cardId === 'dragonflyjones') {
    const target = [...inLane(m, enemy, l)].filter(c => c.cost >= 4)
      .sort((a, b) => b.cost - a.cost || getEffectiveCardPower(b) - getEffectiveCardPower(a) || a.instanceId.localeCompare(b.instanceId))[0];
    if (target) {
      targetIds.add(target.instanceId);
      m = targetEnemyPowerReduction(m, source, target, -2, 'Secret Technique: -2 Hands.');
    }
    m = modify(m, source.instanceId, c => ({ ...c, powerModifier: c.powerModifier + 1, lastEffectNote: 'Secret Technique: +1 Hands.' }));
    note(target ? 'Secret Technique punished a costly enemy.' : 'Secret Technique found no costly enemy; Dragonfly Jones gained +1 Hands.');
  }
  else if (source.cardId === 'shonuff') {
    const boosted = [...inLane(m, enemy, l)].filter(c => c.powerModifier > 0)
      .sort((a, b) => b.powerModifier - a.powerModifier || getEffectiveCardPower(b) - getEffectiveCardPower(a) || a.instanceId.localeCompare(b.instanceId))[0];
    const target = boosted ?? highest(inLane(m, enemy, l));
    if (target) {
      targetIds.add(target.instanceId);
      const amount = boosted ? Math.min(2, boosted.powerModifier) : 1;
      const previous = target.powerModifier;
      m = targetEnemyPowerReduction(m, source, target, -amount, `Who's the Master?: -${amount} Hands.`);
      const removed = previous - (findCard(m, target.instanceId)?.powerModifier ?? previous);
      if (boosted && removed > 0) m = modify(m, source.instanceId, c => ({ ...c, powerModifier: c.powerModifier + removed, lastEffectNote: `Who's the Master?: +${removed} Hands.` }));
    }
    note(!target ? "Who's the Master? found no enemy." : boosted ? "Who's the Master? challenged boosted Hands." : "Who's the Master? pressured the highest enemy.");
  }
  else if (source.cardId === 'yasuke') {
    const ally = lowest(inLane(m, source.owner, l).filter(c => c.instanceId !== source.instanceId && !c.statuses.protected));
    if (ally) {
      targetIds.add(ally.instanceId);
      m = modify(m, ally.instanceId, c => ({ ...c, statuses: { ...c.statuses, protected: true }, lastEffectNote: 'Black Blade: protected from one targeted hostile ability.' }));
      m = { ...m, timedEffects: [...m.timedEffects, { id: `yasuke:${source.instanceId}:${ally.instanceId}`, kind: 'church-protection', sourceInstanceId: source.instanceId, targetInstanceId: ally.instanceId, owner: source.owner, lane: l, startsAtRound: m.round, expiresAtRound: 7, expiration: 'match-complete' }] };
    }
    const target = highest(inLane(m, enemy, l));
    if (target) { targetIds.add(target.instanceId); m = targetEnemyPowerReduction(m, source, target, -1, 'Black Blade: -1 Hands.'); }
    note(ally && target ? 'Black Blade defended an ally and pressured the enemy.'
      : ally ? 'Black Blade defended an ally.' : target ? 'Black Blade pressured the enemy.' : 'Black Blade found no other cards.');
  }
  else if (source.cardId === 'mansamusa') {
    for (const district of [0, 1, 2] as Lane[]) {
      const ally = lowest(inLane(m, source.owner, district).filter(c => c.instanceId !== source.instanceId && c.kind !== 'support' && !c.hazard));
      if (!ally) continue;
      targetIds.add(ally.instanceId);
      const amount = ally.type === 'Earth' ? 2 : 1;
      m = modify(m, ally.instanceId, c => ({ ...c, powerModifier: c.powerModifier + amount, lastEffectNote: `Gold Road: +${amount} Hands.` }));
    }
    m = addDiscountToken(m, source.owner, source, 'another-district');
    note('Gold Road rewarded the board and opened a cheaper route to another district.');
  }
  else if (source.cardId === 'tron') {
    const allies = [...inLane(m, source.owner, l)]
      .filter(c => c.instanceId !== source.instanceId && c.kind !== 'support')
      .sort((a, b) => getEffectiveCardPower(a) - getEffectiveCardPower(b) || a.instanceId.localeCompare(b.instanceId)).slice(0, 3);
    for (const ally of allies) {
      targetIds.add(ally.instanceId);
      m = modify(m, ally.instanceId, c => ({ ...c, powerModifier: c.powerModifier + 1, lastEffectNote: 'For the Hood: +1 Hands.' }));
    }
    const motionKey = source.owner === 'player' ? 'playerMotion' : 'cpuMotion';
    if (allies.length >= 2) m = refundMotion(m, source.owner, 1);
    note(allies.length ? `For the Hood helped ${allies.length} characters${allies.length >= 2 ? ' and restored up to 1 Motion' : ''}.` : 'For the Hood needs other friendly characters here.');
  }
  else if (source.cardId === 'johnhenry') {
    const allies = m.boards.flat().filter(c => c.owner === source.owner && c.instanceId !== source.instanceId
      && c.kind !== 'support' && !c.hazard && c.type === 'Earth');
    const boost = Math.min(4, allies.length);
    if (boost) m = modify(m, source.instanceId, c => ({ ...c, powerModifier: c.powerModifier + boost, lastEffectNote: `Steel Driver: +${boost} Hands.` }));
    const target = allies.length >= 2 ? highest(inLane(m, enemy, l)) : undefined;
    if (target) {
      targetIds.add(target.instanceId);
      m = targetEnemyPowerReduction(m, source, target, -2, 'Steel Driver: -2 Hands.');
    }
    note(boost ? `Steel Driver gained +${boost} Hands${target ? ' and pressured the enemy' : ''}.` : 'Steel Driver needs a gang here.');
  }
  else if (['subwaymagician', 'ogdominican', 'conductor'].includes(source.cardId)) {
    if (source.cardId === 'subwaymagician') {
      const target = highest(inLane(m, enemy, l));
      if (target) { targetIds.add(target.instanceId); m = applyWeaken(m, source, target, 'Now You See Me: Weakened.'); }
    }
    const traveler = source.cardId === 'conductor' ? lowest(inLane(m, source.owner, l).filter(c => c.instanceId !== source.instanceId)) : source;
    if (traveler) {
      targetIds.add(traveler.instanceId);
      const destination = lowestFriendlyLane(m, source.owner, l);
      m = move(m, traveler, destination, `${source.ability}: moved to the weakest other district.`);
      const amount = source.cardId === 'conductor' ? 3 + (traveler.type === 'Water' ? 1 : 0) : source.cardId === 'ogdominican' ? 2 : 0;
      if (amount && findCard(m, traveler.instanceId)?.lane === destination) {
        m = cleanseAlly(m, traveler.instanceId, c => ({ ...c,
          ...(source.cardId === 'conductor' ? { statuses: cleanseStatuses(c.statuses) } : {}),
          powerModifier: c.powerModifier + amount,
          lastEffectNote: `${source.ability}: moved, +${amount} Hands${source.cardId === 'conductor' ? ', cleansed' : ''}.`,
        }));
      }
    }
    note(traveler ? `${source.ability} resolved.` : 'Last Stop needs another ally here.');
  }
  else if (source.cardId === 'ashlee') {
    // +1 Hand to every other friendly card already in Ashlee's district.
    const alliesHere = inLane(m, source.owner, l).filter(c => c.instanceId !== source.instanceId && c.kind !== 'support');
    for (const ally of alliesHere) {
      targetIds.add(ally.instanceId);
      m = modify(m, ally.instanceId, c => ({ ...c, powerModifier: c.powerModifier + 1, lastEffectNote: 'Jet Set: +1 Hand.' }));
    }
    const plantCrew = m.boards.flat().filter(c => !c.hazard && c.owner === source.owner && c.type === 'Plant' && c.kind !== 'support');
    const fullPlantCrew = ([0, 1, 2] as Lane[]).every(district => plantCrew.some(c => c.lane === district));
    if (fullPlantCrew) for (const district of [0, 1, 2] as Lane[]) {
      const ally = lowest(plantCrew.filter(c => c.lane === district))!;
      targetIds.add(ally.instanceId);
      m = modify(m, ally.instanceId, c => ({ ...c, powerModifier: c.powerModifier + 1,
        lastEffectNote: 'Jet Set: Plant in all three districts, +1 Hand.' }));
    }
    // Drop Guyana the gorilla into the weakest friendly district (uncounterable: shrugs off power reductions).
    const destination = lowestFriendlyLane(m, source.owner, l);
    m = summonCard(m, source.owner, destination, SUMMON_TEMPLATES.guyana, 'guyana', source, true);
    // Pressure the highest-Hands enemy on the board.
    const highestEnemy = highest(m.boards.flat().filter(c => !c.hazard && c.owner === enemy && c.kind !== 'support'));
    if (highestEnemy) {
      targetIds.add(highestEnemy.instanceId);
      m = targetEnemyPowerReduction(m, source, highestEnemy, -1, 'Jet Set: -1 Hand.');
    }
    note(`Jet Set summoned Guyana (+4, uncounterable) into district ${destination + 1}, gave +1 Hand to ${alliesHere.length} ally${alliesHere.length === 1 ? '' : 'ies'}${fullPlantCrew ? ', and gave one Plant ally in each district +1 Hand for a full Plant crew' : ''}${highestEnemy ? ', and pressured the highest-Hands enemy' : ''}.`);
  }
  else if (source.cardId === 'kyle') {
    for (let index = 0; index < 4; index++) {
      const destination = seededIndex(smileBombSeed(m, source.instanceId, index), 3) as Lane;
      m = summonCard(m, enemy, destination, SUMMON_TEMPLATES['smile-bomb'], 'smile-bomb', source);
      const bomb = m.boards[destination].at(-1)!;
      m = modify(m, bomb.instanceId, card => ({ ...card,
        smileBomb: { sourceInstanceId: source.instanceId, sourceOwner: source.owner, detonatesAtRound: m.round + 1 },
        lastEffectNote: 'Planted by KYLE. Explodes at the start of round ' + (m.round + 1) + '.',
      }));
      targetIds.add(bomb.instanceId);
    }
    note('Smile Bombs planted 4 bombs in enemy districts. Each hits one random enemy for -2 Hands next round.', 'timed',
      { unit: 'round', startsAtRound: m.round, expiresAtRound: m.round + 1, expiration: 'round-start' });
  }
  else if (source.cardId === 'captainjigga') {
    // Two Steward tokens always spawn into Jigga's lane. Each one auto-targets
    // a different highest-Hands enemy (up to 2); if no enemies are on the
    // board yet, the stewards still appear but no -2 resolves.
    const destination = l;
    const stewards: string[] = [];
    for (const artworkId of ['steward', 'steward-blue']) {
      m = summonCard(m, source.owner, destination, SUMMON_TEMPLATES.steward, 'steward', source, false, artworkId);
      stewards.push(m.boards[destination].at(-1)!.instanceId);
    }
    for (const stewardId of stewards) {
      const ally = lowest(inLane(m, source.owner, destination).filter(c => c.type === 'Air'
        && c.kind !== 'support' && c.kind !== 'token' && c.instanceId !== source.instanceId && c.instanceId !== stewardId));
      if (ally) {
        targetIds.add(ally.instanceId);
        m = modify(m, ally.instanceId, c => ({ ...c, powerModifier: c.powerModifier + 1,
          lastEffectNote: 'Cabin Gang: a Steward gave this Air ally +1 Hand.' }));
      }
    }
    const enemyPool = [...m.boards.flat().filter(c => !c.hazard && c.owner === enemy && c.kind !== 'support')]
      .sort((a, b) => getEffectiveCardPower(b) - getEffectiveCardPower(a));
    const picked: CardInstance[] = [];
    for (const candidate of enemyPool) {
      if (picked.length >= 2) break;
      if (!picked.find(p => p.instanceId === candidate.instanceId)) picked.push(candidate);
    }
    for (const target of picked) {
      targetIds.add(target.instanceId);
      m = targetEnemyPowerReduction(m, source, target, -2, 'Cabin Gang: -2 Hands.');
    }
    note(`Cabin Gang dispatched 2 stewards${picked.length ? `, ${picked.length} hit${picked.length === 1 ? '' : 's'} enemy Hands` : ' (no enemies in range)'}.`);
  }
  else if (source.cardId === 'counter') {
    // Mirror reads printed cost rather than current Hands so buffs cannot inflate it.
    const target = [...m.boards.flat().filter(c => !c.hazard && c.owner === enemy && c.kind !== 'support')]
      .sort((a, b) => b.cost - a.cost || getEffectiveCardPower(b) - getEffectiveCardPower(a) || a.instanceId.localeCompare(b.instanceId))[0];
    let bonus = 0;
    if (target) {
      targetIds.add(target.instanceId);
      bonus = Math.min(4, target.cost);
      m = modify(m, source.instanceId, c => ({ ...c, powerModifier: c.powerModifier + bonus, lastEffectNote: `Mirror: +${bonus} Hands (read ${target.name}).` }));
    }
    m = modify(m, source.instanceId, c => ({
      ...c, statuses: { ...c.statuses, protected: true },
      lastEffectNote: target ? c.lastEffectNote : 'Mirror: protected with no enemy to read.',
    }));
    m = { ...m, timedEffects: [...m.timedEffects.filter(effect => effect.id !== `counter:${source.instanceId}`), {
      id: `counter:${source.instanceId}`, kind: 'church-protection', sourceInstanceId: source.instanceId,
      targetInstanceId: source.instanceId, owner: source.owner, lane: l, startsAtRound: m.round, expiresAtRound: 7,
      expiration: 'match-complete',
    }] };
    note(target ? `Mirror read ${target.name} for +${bonus} and gained Protect.` : 'Mirror gained Protect with no enemy to read.');
  }
  else if (Object.hasOwn(characterWaveCards, source.cardId)) {
    const id = source.cardId;
    const allies = inLane(m, source.owner, l).filter(c => c.instanceId !== source.instanceId && c.kind !== 'support');
    const enemies = inLane(m, enemy, l);
    const buff = (target: CardInstance | undefined, amount: number, text = source.ability) => {
      if (!target) return;
      targetIds.add(target.instanceId);
      m = modify(m, target.instanceId, c => ({ ...c, powerModifier: c.powerModifier + amount, lastEffectNote: text + ': +' + amount + ' Hands.' }));
    };
    const protect = (target: CardInstance | undefined) => {
      if (!target || target.statuses.protected) return;
      targetIds.add(target.instanceId);
      m = modify(m, target.instanceId, c => ({ ...c, statuses: { ...c.statuses, protected: true }, lastEffectNote: source.ability + ': Protected.' }));
      m = { ...m, timedEffects: [...m.timedEffects, { id: 'wave-cover:' + source.instanceId + ':' + target.instanceId,
        kind: 'church-protection', sourceInstanceId: source.instanceId, targetInstanceId: target.instanceId,
        owner: source.owner, lane: target.lane!, startsAtRound: m.round, expiresAtRound: 7, expiration: 'match-complete' }] };
    };
    if (id === 'homelessguy') {
      if (source.wildEmptyWallet) {
        const target = highest(enemies);
        if (target) {
          targetIds.add(target.instanceId);
          m = hostileEffect(m, source, target, (state, actual) => {
            if (actual.statuses.uncounterable) return state;
            const beforePower = Math.max(0, actual.basePower + actual.powerModifier);
            let after = reduceHands(state, actual, 2, 'Nothing to Lose: up to 2 Hands stolen.');
            const remaining = findCard(after, actual.instanceId);
            const stolen = Math.max(0, Math.min(2, beforePower - (remaining ? Math.max(0, remaining.basePower + remaining.powerModifier) : 0)));
            if (stolen) after = modify(after, source.instanceId, c => ({ ...c, powerModifier: c.powerModifier + stolen }));
            return after;
          }, false, false, true);
        }
        note(target ? 'Nothing to Lose spent the last deployment Motion: attempted to steal 2 Hands.' : 'Nothing to Lose: no enemy to steal from.');
      } else {
        const amount = source.wildInvestment ?? 0;
        const key = source.owner === 'player' ? 'playerMotion' : 'cpuMotion';
        if (amount > 0) {
          m = { ...m, [key]: m[key] - amount };
          buff(findCard(m, source.instanceId), amount, 'Nothing to Lose');
        }
        note('Nothing to Lose invested ' + amount + ' extra Motion for +' + amount + ' Hands.');
      }
    } else if (id === 'fangirl' || id === 'grownfanboy') {
      const idol = highest(id === 'fangirl' ? allies : m.boards.flat().filter(c => !c.hazard && c.owner === source.owner
        && c.instanceId !== source.instanceId && c.kind !== 'support'));
      if (idol) m = modify(m, source.instanceId, c => ({ ...c, idolId: idol.instanceId, lastEffectNote: source.ability + ': idol is ' + idol.name + '.' }));
      note(idol ? source.ability + ': ' + idol.name + ' is your idol.' : source.ability + ' needs another ally when revealed.');
    } else if (id === 'lawlessyn') {
      const target = lowest(enemies);
      const destinations = ([0, 1, 2] as Lane[]).filter(d => d !== l && !getStoryLockedLanes(m, enemy).includes(d))
        .sort((a, b) => getLaneScoreForMatch(m, inLane(m, enemy, b), b, enemy) - getLaneScoreForMatch(m, inLane(m, enemy, a), a, enemy) || a - b);
      if (target && destinations.length) {
        targetIds.add(target.instanceId);
        m = forceEnemyMove(m, source, target, destinations[0]);
      }
      note(target && destinations.length ? 'Wrong Block targeted the weakest enemy for relocation.' : 'Wrong Block found no legal enemy destination.');
    } else if (id === 'streetapostle') {
      note('Spread the Word is watching for another Plant ally to gain Hands.');
    } else if (id === 'asphaltapostle') {
      const target = lowest(m.boards.flat().filter(c => c.owner === source.owner && c.instanceId !== source.instanceId
        && c.kind !== 'support' && !c.hazard && c.type === 'Earth'));
      if (target) {
        protect(target);
        m = modify(m, target.instanceId, c => ({ ...c, powerModifier: c.powerModifier + 1, lastEffectNote: 'Concrete Congregation: +1 Hands and Protected.' }));
      }
      note(target ? 'Concrete Congregation protects the weakest other Earth ally and gives it +1 Hand.' : 'Concrete Congregation found no other friendly Earth character.');
    } else if (id === 'colognecriminal') {
      const existing = m.lingeringScents?.find(s => s.owner === source.owner && s.lane === l && s.expiresAfterRound >= m.round);
      m = { ...m, lingeringScents: [...(m.lingeringScents ?? []).filter(s => s.expiresAfterRound >= m.round && !(s.owner === source.owner && s.lane === l)), {
        owner: source.owner, lane: l, source, expiresAfterRound: m.round + 1, triggeredRound: existing?.triggeredRound,
      }] };
      m = trainWaveAbility(m, source.instanceId);
      note('Lingering Scent marks this district through round ' + (m.round + 1) + '. Enemies already here are unaffected.');
    } else if (id === 'passportbro') {
      const traveler = lowest(allies);
      const destinations = ([0, 1, 2] as Lane[]).filter(d => d !== l && !getStoryLockedLanes(m, source.owner).includes(d))
        .sort((a, b) => getLaneScoreForMatch(m, inLane(m, source.owner, a), a, source.owner) - getLaneScoreForMatch(m, inLane(m, source.owner, b), b, source.owner) || a - b);
      if (traveler && destinations.length) {
        targetIds.add(traveler.instanceId);
        m = move(m, traveler, destinations[0], 'Geographic Arbitrage moved this ally.');
      }
      note(traveler && destinations.length ? 'Geographic Arbitrage sent the weakest ally to the weakest other open district.' : 'Geographic Arbitrage found no legal passenger route.');
    } else if (id === 'seafoodassassin') {
      for (const target of enemies) {
        targetIds.add(target.instanceId);
        m = hostileEffect(m, source, target, (state, actual) => reduceHands(state, actual,
          actual.statuses.burnStacks + 2, 'Extra Sauce: all accumulated Burn detonated and consumed.', 0), false, false, true);
      }
      note('Extra Sauce applied 2 Burn and immediately detonated accumulated Burn on exposed enemies here.');
    } else if (id === 'homelesslegend') {
      note('Built Different is ready to survive a lethal hit and recover lost Hands.');
    } else if (id === 'godofhookah') {
      note('Pass the Hose is watching for round-end Burn damage.');
    } else if (id === 'mailman') {
      note('Express Delivery is watching for your second Electric character each round.');
    }
  }
  else if (Object.hasOwn(streetWaveCards, source.cardId)) {
    const id = source.cardId;
    const allies = inLane(m, source.owner, l).filter(c => c.instanceId !== source.instanceId && c.kind !== 'support');
    const enemies = inLane(m, enemy, l);
    const buff = (target: CardInstance | undefined, amount: number) => {
      if (!target) return;
      targetIds.add(target.instanceId);
      m = modify(m, target.instanceId, c => ({ ...c, powerModifier: c.powerModifier + amount, lastEffectNote: `${source.ability}: +${amount} Hands.` }));
    };
    const reduce = (target: CardInstance | undefined, amount: number) => {
      if (!target) return;
      targetIds.add(target.instanceId);
      m = targetEnemyPowerReduction(m, source, target, -amount, `${source.ability}: -${amount} Hands.`);
    };
    const cleanse = (target: CardInstance, amount: number) => {
      if (source.cardId === 'foodz' ? !needsCleanse(target) : !target.statuses.frozen && !target.statuses.silenced) return;
      targetIds.add(target.instanceId);
      m = cleanseAlly(m, target.instanceId, c => ({ ...c, statuses: cleanseStatuses(c.statuses), powerModifier: c.powerModifier + amount, lastEffectNote: `${source.ability}: cleansed${amount ? `, +${amount} Hands` : ''}.` }));
    };
    const losing = () => getLaneScoreForMatch(m, inLane(m, source.owner, l), l, source.owner) < getLaneScoreForMatch(m, enemies, l, enemy);
    if (['homelessyn', 'sportsprodigy', 'fein', 'divorceddad', 'failedathlete'].includes(id)) {
      const succeeds = id === 'homelessyn' ? enemies.length > inLane(m, source.owner, l).length - 1
        : id === 'sportsprodigy' ? losing()
        : id === 'fein' ? enemies.length > 0
        : id === 'alchy' ? m.round >= 4
        : id === 'divorceddad' ? allies.length === 0 && enemies.length > 0
        : id === 'failedathlete' ? m.round >= 4 && losing()
        : inLane(m, source.owner, l).length === 1;
      const amount = id === 'failedathlete' ? 3 : id === 'sportsprodigy' || id === 'homelessyn' || id === 'divorceddad' ? 2 : 1;
      if (succeeds) {
        buff(source, amount);
        if (id === 'sportsprodigy') reduce(highest(enemies), 1);
        if (id === 'fein' && enemies.length >= 2) {
          const burnTarget = highest(enemies);
          if (burnTarget) { targetIds.add(burnTarget.instanceId); m = applyBurn(m, source, burnTarget, 1, 'One More: 1 Burn.'); }
        }
      }
    } else if (id === 'stud') {
      const target = lowest(allies);
      buff(target, 1);
      if (target && !target.statuses.protected) {
        m = modify(m, target.instanceId, c => ({ ...c, statuses: { ...c.statuses, protected: true } }));
        m = { ...m, timedEffects: [...m.timedEffects, { id: `stud:${source.instanceId}:${target.instanceId}`, kind: 'church-protection', sourceInstanceId: source.instanceId, targetInstanceId: target.instanceId, owner: source.owner, lane: l, startsAtRound: m.round, expiresAtRound: 7, expiration: 'match-complete' }] };
      }
    } else if (id === 'gothkid' || id === 'redpill') {
      const target = id === 'gothkid' ? lowest(enemies.filter(c => c.cost <= 2)) : highest(enemies);
      if (target) {
        if (id === 'gothkid') {
          targetIds.add(target.instanceId);
          m = targetEnemy(m, source, target, c => ({
            ...c,
            statuses: { ...c.statuses, silenced: true },
            lastEffectNote: `${source.ability}: Silenced.`,
          }));
        } else if (target.statuses.weakened) {
          targetIds.add(target.instanceId);
          m = targetEnemy(m, source, target, c => ({ ...c, statuses: { ...c.statuses, silenced: true }, lastEffectNote: `${source.ability}: already Weakened, silenced.` }));
          if (findCard(m, target.instanceId)?.statuses.silenced) buff(source, 2);
        } else { targetIds.add(target.instanceId); m = applyWeaken(m, source, target, `${source.ability}: Weakened.`); }
      }
    } else if (id === 'stonerjr' || id === 'stonersr') {
      const eligible = allies.filter(c => c.statuses.frozen || c.statuses.silenced);
      const targets = id === 'stonerjr' ? [lowest(eligible)].filter((c): c is CardInstance => !!c) : eligible;
      for (const target of targets) cleanse(target, 1);
    } else if (id === 'bblnice' || id === 'failedrapper') {
      for (const target of allies.filter(c => id === 'bblnice' || c.cost <= 2)) buff(target, 1);
    } else if (id === 'bbldemon') {
      for (const target of enemies) reduce(target, 1);
    } else if (id === 'break' || id === 'bboy') {
      const traveler = id === 'break' ? lowest(allies) : source;
      if (traveler) {
        targetIds.add(traveler.instanceId);
        const destination = lowestFriendlyLane(m, source.owner, l);
        m = move(m, traveler, destination, `${source.ability}: moved to the weakest other district.`);
        if (findCard(m, traveler.instanceId)?.lane === destination) {
          const target = id === 'break' ? findCard(m, traveler.instanceId)
            : lowest(inLane(m, source.owner, destination).filter(c => c.instanceId !== source.instanceId && c.kind !== 'support'));
          buff(target, 1);
        }
      }
    } else if (id === 'krump' && enemies.length) {
      buff(source, 1); reduce(highest(enemies), 1);
    } else if (id === 'yunghustle') {
      if (m.boards.flat().some(c => !c.hazard && c.owner === source.owner && c.kind !== 'support' && c.lane !== l)) {
        const key = source.owner === 'player' ? 'playerMotion' : 'cpuMotion';
        m = refundMotion(m, source.owner, 1);
      }
    } else if (id === 'simmy') {
      reduce(highest(enemies), 3); buff(lowest(allies), 2);
    } else if (id === 'foodz') {
      const crew = m.boards.flat().filter(c => !c.hazard && c.owner === source.owner && c.instanceId !== source.instanceId && c.kind !== 'support');
      const recovery = lowest(crew.filter(c => c.type === 'Light' && needsCleanse(c)));
      for (const target of crew) cleanse(target, 0);
      if (recovery) buff(findCard(m, recovery.instanceId), 1);
      for (const district of [0, 1, 2] as const) buff(lowest(inLane(m, source.owner, district).filter(c => c.instanceId !== source.instanceId && c.kind !== 'support')), 1);
    }
    const succeeded = [...targetIds].some(key => {
      const old = findCard(before, key), current = findCard(m, key);
      return old && (!current || old.lane !== current.lane || old.powerModifier !== current.powerModifier || old.statuses.frozen !== current.statuses.frozen || old.statuses.silenced !== current.statuses.silenced || old.statuses.protected !== current.statuses.protected
        || (needsCleanse(old) && !needsCleanse(current)));
    }) || m.playerMotion !== before.playerMotion || m.cpuMotion !== before.cpuMotion;
    note(succeeded ? `${source.ability} resolved.` : `${source.ability}: condition not met or effect blocked.`);
  }
  else if (Object.hasOwn(elementalBondWaveCards, source.cardId)) {
    const id = source.cardId;
    const allies = inLane(m, source.owner, l).filter(c => c.instanceId !== source.instanceId && c.kind !== 'support');
    const enemies = inLane(m, enemy, l);
    const buff = (target: CardInstance | undefined, amount: number) => {
      if (!target) return;
      targetIds.add(target.instanceId);
      m = modify(m, target.instanceId, c => ({
        ...c,
        powerModifier: c.powerModifier + amount,
        lastEffectNote: `${source.ability}: +${amount} Hands.`,
      }));
    };
    const cleanse = (target: CardInstance | undefined) => {
      if (!target || (!target.statuses.frozen && !target.statuses.silenced)) return;
      targetIds.add(target.instanceId);
      m = cleanseAlly(m, target.instanceId, c => ({
        ...c,
        statuses: cleanseStatuses(c.statuses),
        powerModifier: c.powerModifier + 1,
        lastEffectNote: `${source.ability}: cleansed, +1 Hands.`,
      }));
    };
    if (id === 'riptidebruiser') {
      const target = highest(enemies);
      if (target) {
        targetIds.add(target.instanceId);
        const reduction = 1 + elementalMatchupBonus(source.type, target.type);
        m = targetEnemyPowerReduction(m, source, target, -reduction, `${source.ability}: -${reduction} Hands.`);
      }
    } else if (id === 'stillwatermedic' || id === 'rootnurse') {
      cleanse(lowest(allies.filter(c => c.statuses.frozen || c.statuses.silenced)));
    } else if (id === 'rainmaker' || id === 'cloudbreak') {
      buff(lowest(m.boards.flat().filter(c => !c.hazard && c.owner === source.owner && c.kind !== 'support' && c.instanceId !== source.instanceId)), 2);
    } else if (id === 'batteryback') {
      if (m.boards.flat().some(c => !c.hazard && c.owner === source.owner && c.kind !== 'support' && c.lane !== l)) {
        m = refundMotion(m, source.owner, 1);
      }
    } else if (id === 'wiretap') {
      m = addDiscountToken(m, source.owner, source, 'another-district');
    } else if (id === 'livewire' || id === 'gust') {
      const destination = lowestFriendlyLane(m, source.owner, l);
      m = move(m, source, destination, `${source.ability}: moved to the weakest other district.`);
      if (findCard(m, source.instanceId)?.lane === destination && id === 'livewire') buff(findCard(m, source.instanceId), 1);
    } else if (id === 'sprout') {
      if (allies.length) buff(findCard(m, source.instanceId), 1);
    } else if (id === 'gardenwall') {
      const target = lowest(allies);
      buff(target, 2);
      if (target && !target.statuses.protected) {
        m = modify(m, target.instanceId, c => ({ ...c, statuses: { ...c.statuses, protected: true } }));
        m = { ...m, timedEffects: [...m.timedEffects, {
          id: `gardenwall:${source.instanceId}:${target.instanceId}`,
          kind: 'church-protection', sourceInstanceId: source.instanceId, targetInstanceId: target.instanceId,
          owner: source.owner, lane: l, startsAtRound: m.round, expiresAtRound: 7, expiration: 'match-complete',
        }] };
      }
    } else if (id === 'crosswind') {
      const traveler = lowest(allies);
      if (traveler) {
        targetIds.add(traveler.instanceId);
        const destination = lowestFriendlyLane(m, source.owner, l);
        m = move(m, traveler, destination, `${source.ability}: moved an ally to the weakest other district.`);
        if (findCard(m, traveler.instanceId)?.lane === destination) buff(findCard(m, traveler.instanceId), 1);
      }
    }
    const succeeded = [...targetIds].some(key => {
      const old = findCard(before, key), current = findCard(m, key);
      return old && (!current || old.lane !== current.lane || old.powerModifier !== current.powerModifier
        || JSON.stringify(old.statuses) !== JSON.stringify(current.statuses));
    }) || m.playerMotion !== before.playerMotion || m.cpuMotion !== before.cpuMotion
      || m.discountTokens.length > before.discountTokens.length;
    note(succeeded ? `${source.ability} resolved.` : `${source.ability}: condition not met or effect blocked.`);
  }
  else if (source.cardId === 'wifey') {
    const duration: EventDuration = { unit: 'round', startsAtRound: m.round, expiresAtRound: m.round + 1, expiration: 'round-start' };
    m = modify(m, source.instanceId, (c) => ({ ...c, statuses: { ...c.statuses, protected: true }, lastEffectNote: 'Side Eye is protecting this lane.' }));
    m = { ...m, timedEffects: [...m.timedEffects.filter((effect) => effect.sourceInstanceId !== source.instanceId || effect.kind === 'salon-protection'), { id: `wifey:${source.instanceId}:${m.round}`, kind: 'wifey-protection', sourceInstanceId: source.instanceId, owner: source.owner, lane: l, startsAtRound: m.round, expiresAtRound: m.round + 1, expiration: 'round-start' }] };
    note('Side Eye will block one targeted effect this round.', 'timed', duration);
  }
  const mechanicallyChanged = (id: string) => {
    const old = findCard(before, id), current = findCard(m, id);
    return !!old && (!current || old.lane !== current.lane || old.powerModifier !== current.powerModifier
      || old.basePower !== current.basePower || old.moved !== current.moved
      || old.copiedAbilityCardId !== current.copiedAbilityCardId || old.networkBoosts !== current.networkBoosts
      || JSON.stringify(old.statuses) !== JSON.stringify(current.statuses));
  };
  const protectionBlockedIds = [...targetIds].filter(id => before.timedEffects.some(e =>
    (e.kind === 'salon-protection' || e.kind === 'church-protection') && e.targetInstanceId === id
      && !m.timedEffects.some(active => active.id === e.id)));
  const changedTargetIds = [...targetIds].filter(mechanicallyChanged);
  const successfulChangedTargetIds = changedTargetIds.filter(id => !protectionBlockedIds.includes(id));
  const boardAdditionSucceeded = m.boards.flat().some(card => !findCard(before, card.instanceId));
  const movementSucceeded = [source.instanceId, ...targetIds].some(id => findCard(before, id)?.lane !== findCard(m, id)?.lane);
  const meaningfulExpansionChange = mechanicallyChanged(source.instanceId) || successfulChangedTargetIds.length > 0 || boardAdditionSucceeded;
  const isExpansion = Object.hasOwn(expansionCards, source.cardId) || Object.hasOwn(streetWaveCards, source.cardId)
    || Object.hasOwn(characterWaveCards, source.cardId)
    || Object.hasOwn(mythicLegendCards, source.cardId) || source.kind === 'support';
  const baseSucceeded = protectionBlockedIds.length ? meaningfulExpansionChange || m.playerMotion !== before.playerMotion || m.cpuMotion !== before.cpuMotion
    : source.cardId === 'shiesty' ? m.boards.flat().length > before.boards.flat().length
    : isExpansion ? meaningfulExpansionChange || m.playerMotion !== before.playerMotion || m.cpuMotion !== before.cpuMotion
      || m.discountTokens.length > before.discountTokens.length
    : match.districtSnapshot && ['bikelife', 'vibe', 'carmeet', 'delivery'].includes(source.cardId)
    ? movementSucceeded
    : source.cardId === "plug" || source.cardId === "streamer" || source.cardId === "gamer" || source.cardId === "bossbabe" || source.cardId === "stockz"
    ? true
    : mechanicallyChanged(source.instanceId)
      || successfulChangedTargetIds.length > 0 || m.discountTokens.length > before.discountTokens.length
      || m.playerMotion !== before.playerMotion || m.cpuMotion !== before.cpuMotion;
  // Fixed upgrades resolve after the printed ability in authored unlock order.  Their
  // small bounded effect budget prevents progression from changing base-card identity.
  if (!echoed && baseSucceeded && Object.hasOwn(characterWaveCards, source.cardId)) m = trainWaveAbility(m, source.instanceId);
  if (!echoed && !source.statuses.silenced && !source.statuses.frozen && baseSucceeded && !Object.hasOwn(characterWaveCards, source.cardId)) {
    for (const upgrade of snapshotUpgradesForCard(m.abilityUpgradeSnapshot, source.owner, source.cardId)) {
      const beforeUpgrade = m;
      const effect = upgrade.effect;
      const target = effect.kind === "self-power"
        ? findCard(m, source.instanceId)
        : successfulChangedTargetIds
          .map((id) => findCard(m, id))
          .find((card): card is CardInstance => !!card && card.owner === (effect.target === "friendly" ? source.owner : enemy));
      if (!target) continue;
      m = modify(m, target.instanceId, (card) => ({
        ...card,
        powerModifier: card.powerModifier + upgrade.effect.amount,
        lastEffectNote: `${upgrade.name}: ${upgrade.effect.amount >= 0 ? "+" : ""}${upgrade.effect.amount} Hands.`,
      }));
      if (upgrade.effect.amount < 0) m = removeDestroyedCard(m, target.instanceId);
      m = addEvent(beforeUpgrade, m, {
        type: "ability",
        sourceId: source.instanceId,
        owner: source.owner,
        targetIds: [target.instanceId],
        kind,
        note: `${upgrade.name} upgraded ${target.name}: ${upgrade.effect.amount >= 0 ? "+" : ""}${upgrade.effect.amount} Hands.`,
        abilityMetadata: {
          upgradeId: upgrade.id,
          upgradeName: upgrade.name,
          sourceCardId: source.cardId,
          sourceInstanceId: source.instanceId,
          targetInstanceIds: [target.instanceId],
          result: "applied",
        },
      });
    }
  }
  if (!echoed && source.effect.startsWith('On Reveal:')) {
    m = { ...m, lastRevealedCardId: source.cardId, entranceHistory: [...(m.entranceHistory ?? []).filter(id => id !== source.instanceId), source.instanceId] };
  }
  return m;
}

export function playCard(match: Match, owner: Owner, instanceId: string, targetLane: Lane, squabble = false, investment = 0): Match {
  return resolveCardPlay(match, owner, instanceId, targetLane, squabble, true, investment);
}

/** Spend Motion and resolve a card while keeping the current crew's turn open. */
function applyDistrictArrival(match: Match, owner: Owner, instanceId: string, targetLane: Lane): Match {
  const district = match.districtSnapshot?.locations[targetLane], runtime = match.districtRuntime;
  if (!district || !runtime) return match;
  const effect = district.effect;
  let after = match, note = '';
  let targetIds = [instanceId];
  if (effect.kind === 'detain-first' && runtime.plays[owner][targetLane] === 1) {
    after = { ...match, districtRuntime: { ...runtime, detainedCardIds: [...runtime.detainedCardIds, instanceId] } };
    note = `${district.name}: this side's first arrival cannot move for the rest of the fade.`;
  }
  const bonus = runtime.roundPlays[owner][targetLane] === 1
    && ((effect.kind === 'comeback' && runtime.trailing[owner][targetLane]) || (effect.kind === 'late-arrival' && match.round >= effect.startsAtRound) || effect.kind === 'tithe') ? effect.amount : 0;
  if (bonus) {
    note = `${district.name}: +${bonus} Hands for this round's first arrival.`;
    after = modify(after, instanceId, card => ({ ...card, powerModifier: card.powerModifier + bonus, lastEffectNote: note }));
  }
  if (runtime.roundPlays[owner][targetLane] === 1 && effect.kind === 'salon-protection') {
    note = `${district.name}: this arrival blocks its next targeted enemy ability.`;
    after = modify(after, instanceId, card => ({ ...card, statuses: { ...card.statuses, protected: true }, lastEffectNote: note }));
    after = { ...after, timedEffects: [...after.timedEffects, {
      id: `salon:${instanceId}`, kind: 'salon-protection', sourceInstanceId: instanceId, targetInstanceId: instanceId,
      owner, lane: targetLane, startsAtRound: match.round, expiresAtRound: 7, expiration: 'match-complete',
    }] };
  }
  if (runtime.roundPlays[owner][targetLane] === 1 && effect.kind === 'crew-cleanse') {
    targetIds = inLane(after, owner, targetLane).filter(c => c.instanceId !== instanceId
      && (c.statuses.frozen || c.statuses.silenced || c.powerModifier < 0)).map(c => c.instanceId);
    note = targetIds.length ? `${district.name}: cleared Freeze, Silence, and negative Hands from ${targetIds.length} allies.` : `${district.name}: no allies needed a cleanup.`;
    for (const id of targetIds) after = cleanseAlly(after, id, card => ({ ...card,
      powerModifier: Math.max(0, card.powerModifier), statuses: cleanseStatuses(card.statuses), lastEffectNote: note,
    }));
  }
  if (effect.kind === 'silence-arrival') {
    note = district.name + ': this card enters Silenced.';
    after = modify(after, instanceId, c => ({ ...c, statuses: { ...c.statuses, silenced: true }, lastEffectNote: note }));
  }
  if (runtime.roundPlays[owner][targetLane] === 1 && effect.kind === 'pawn-sacrifice') {
    const sacrifice = lowest(inLane(after, owner, targetLane).filter(c => c.instanceId !== instanceId));
    if (sacrifice) {
      const gain = getEffectiveCardPower(sacrifice);
      targetIds.push(sacrifice.instanceId);
      note = district.name + ': traded ' + sacrifice.name + ' for +' + gain + ' permanent Hands.';
      after = { ...after, boards: after.boards.map(items => items.filter(c => c.instanceId !== sacrifice.instanceId)) as Match['boards'],
        timedEffects: after.timedEffects.filter(e => e.sourceInstanceId !== sacrifice.instanceId && e.targetInstanceId !== sacrifice.instanceId) };
      after = modify(after, instanceId, c => ({ ...c, powerModifier: c.powerModifier + gain, lastEffectNote: note }));
    } else note = district.name + ': no other ally to trade.';
  }
  if (runtime.roundPlays[owner][targetLane] === 1 && effect.kind === 'market-draw') {
    const hand = owner === 'player' ? 'playerHand' : 'cpuHand';
    const index = owner === 'player' ? 'playerDrawIndex' : 'cpuDrawIndex';
    const deck = owner === 'player' ? after.playerDeck : after.cpuDeck;
    const ids = owner === 'player' ? after.playerCardIds : after.cpuCardIds;
    const id = ids[after[index]];
    // Keep the identity out of public event notes and targets.
    note = district.name + (id ? ': drew one card.' : ': deck empty; no card drawn.');
    if (id) after = { ...after, [hand]: [...after[hand], createCardInstance(id, owner, deck, after[index])], [index]: after[index] + 1 };
  }
  if (runtime.roundPlays[owner][targetLane] === 1 && effect.kind === 'feed-neighbors') {
    targetIds = after.boards.flat().filter(c => !c.hazard && c.owner === owner && c.lane !== targetLane).map(c => c.instanceId);
    note = district.name + ': served +' + effect.amount + ' Hands to ' + targetIds.length + ' allies in other lanes.';
    for (const id of targetIds) after = modify(after, id, c => ({ ...c, powerModifier: c.powerModifier + effect.amount, lastEffectNote: note }));
  }
  if (effect.kind === 'rush-hour' && runtime.roundPlays.player[targetLane] + runtime.roundPlays.cpu[targetLane] === 1) {
    targetIds = after.boards[targetLane].filter(c => c.instanceId !== instanceId).map(c => c.instanceId);
    const destination = lane((targetLane + 1) % 3);
    for (const id of targetIds) {
      const traveler = after.boards[targetLane].find(c => c.instanceId === id);
      if (traveler) after = move(after, traveler, destination, district.name + ': traffic pushed this card right.');
    }
    const moved = targetIds.filter(id => findCard(after, id)?.lane === destination).length;
    note = district.name + ': pushed ' + moved + ' cards right; ' + (targetIds.length - moved) + ' held in place.';
  }
  return note ? addEvent(match, after, { type: 'ability', owner, lane: targetLane, targetIds,
    kind: effect.kind === 'rush-hour' ? 'move' : 'story', note }) : after;
}
/** One deterministic ride, after the played card and its upgrades have resolved. */
function applyDistrictDeparture(match: Match, owner: Owner, instanceId: string, targetLane: Lane): Match {
  if (match.districtSnapshot?.locations[targetLane].effect.kind !== 'subway'
    || match.districtRuntime?.roundPlays[owner][targetLane] !== 1) return match;
  const card = match.boards[targetLane].find(c => c.instanceId === instanceId);
  if (!card) return match;
  const destination = lane((targetLane + 1) % 3);
  const after = move(match, card, destination, `THE SUBWAY: rode to ${match.districtSnapshot.locations[destination].name}.`);
  const moved = findCard(after, instanceId)!;
  return addEvent(match, after, { type: 'ability', owner, lane: destination, targetIds: [instanceId],
    kind: moved.lane === destination ? 'move' : 'blocked', note: moved.lastEffectNote,
  });
}
export function playTurnCard(match: Match, owner: Owner, instanceId: string, targetLane: Lane, squabble = false, investment = 0): Match {
  return resolveCardPlay(match, owner, instanceId, targetLane, squabble, false, investment);
}

// playCard retains the original one-card turn for stored legacy transcripts.
function resolveCardPlay(match: Match, owner: Owner, instanceId: string, targetLane: Lane, squabble: boolean, endTurn: boolean, investment = 0): Match {
  if (![0, 1, 2].includes(targetLane)) throw new Error('Choose a valid district');
  if ((owner === 'player' && match.phase !== 'player') || (owner === 'cpu' && match.phase !== 'cpu-reveal')) throw new Error('Owner cannot play in this phase');
  if (getStoryLockedLanes(match, owner).includes(targetLane)) throw new Error('Lane is locked');
  const handKey = owner === 'player' ? 'playerHand' : 'cpuHand', motionKey = owner === 'player' ? 'playerMotion' : 'cpuMotion', card = match[handKey].find((c) => c.instanceId === instanceId);
  if (!card) throw new Error('Card is not in this hand');
  if (squabble && (match.squabbleByOwner ? match.squabbleByOwner[owner] : owner !== 'player' || match.squabbleUsed)) throw new Error('SQUABBLE is unavailable');
  const cost = getLegalCardCost(match, owner, card, targetLane);
  if (match[motionKey] < cost) throw new Error('Not enough Motion');
  if (!Number.isInteger(investment) || investment < 0 || investment > 4
    || (investment > 0 && (card.cardId !== 'homelessguy' || !activeAbility(card)))
    || investment > match[motionKey] - cost) throw new Error('Invalid extra Motion investment');
  const discountLane = match.plugDiscountLane[owner];
  const usedToken = discountFor(match, owner, card, targetLane);
  const usedPlugDiscount = (!!usedToken && findCard(match, usedToken.sourceInstanceId)?.cardId === "plug")
    || (!usedToken && discountLane !== null && discountLane !== targetLane);
  const taxed = activeLandlord(match, owner, targetLane) && !(match.landlordTaxUsed?.[owner]?.[targetLane] ?? false);
  const taxState = match.landlordTaxUsed ?? { player: { 0: false, 1: false, 2: false }, cpu: { 0: false, 1: false, 2: false } };
  let m: Match = {
    ...match,
    [handKey]: match[handKey].filter((c) => c.instanceId !== instanceId),
    [motionKey]: match[motionKey] - cost,
    plugDiscountLane: { ...match.plugDiscountLane, [owner]: usedPlugDiscount ? null : discountLane },
    discountTokens: (match.discountTokens ?? []).filter((token) => token.id !== usedToken?.id),
    districtTraps: (match.districtTraps ?? []).filter(t => !(t.kind === 'dmv' && t.owner !== owner && t.lane === targetLane && t.expiresAfterRound >= match.round)),
    landlordTaxUsed: taxed ? { ...taxState, [owner]: { ...taxState[owner], [targetLane]: true } } : taxState,
    squabbleUsed: match.squabbleUsed || (owner === 'player' && squabble),
    ...(match.squabbleByOwner ? { squabbleByOwner: { ...match.squabbleByOwner, [owner]: match.squabbleByOwner[owner] || squabble } } : {}),
  };
  if (m.districtRuntime) {
    const runtime = m.districtRuntime;
    const plays = [...runtime.plays[owner]] as [number, number, number];
    const roundPlays = [...runtime.roundPlays[owner]] as [number, number, number];
    plays[targetLane]++; roundPlays[targetLane]++;
    m = { ...m, districtRuntime: { ...runtime, plays: { ...runtime.plays, [owner]: plays }, roundPlays: { ...runtime.roundPlays, [owner]: roundPlays } } };
  }
  let placed: CardInstance = { ...card, lane: targetLane, playedRound: m.round, powerModifier: card.powerModifier + (squabble ? card.basePower : 0), lastEffectNote: squabble ? 'SQUABBLE doubled base Hands.' : `Played for ${cost} Motion.` };
  if (card.cardId === 'luigion') placed = { ...placed, luigionMushroomUsed: false };
  if (card.cardId === 'luigion' && squabble) placed = { ...placed, ...LUIGION_POWERED };
  if (card.cardId === 'homelessguy') placed = { ...placed, wildInvestment: investment, wildEmptyWallet: match[motionKey] === cost };
  m = { ...m, boards: m.boards.map((items, i) => i === targetLane ? [...items, placed] : items) as Match['boards'] };
  if (taxed) {
    const landlord = m.boards[targetLane].find(c => c.owner !== owner && abilityCardId(c) === 'landlord' && activeAbility(c));
    if (landlord) m = modify(m, landlord.instanceId, c => ({ ...c, powerModifier: c.powerModifier + 1, lastEffectNote: 'Rent Due was paid: +1 Hand.' }));
  }
  if (usedToken?.eligibility === 'electric-delivery') m = modify(m, instanceId, c => ({
    ...c, powerModifier: c.powerModifier + 2, lastEffectNote: 'Express Delivery: Package received; +2 Hands.',
  }));
  m = addEvent(match, m, {
    type: 'play', sourceId: instanceId, owner, lane: targetLane,
    note: `${card.name} was played in district ${targetLane + 1} for ${cost} Motion.${usedToken ? ` ${usedToken.eligibility} discount used.` : ''}${taxed ? " Rent Due added 1 Motion." : ""}${squabble ? ' SQUABBLE doubled its base Hands.' : ''}`,
  });
  m = addEvent(m, m, {
    type: 'reveal', sourceId: instanceId, owner, lane: targetLane,
    note: `${card.name} revealed in district ${targetLane + 1}.`,
  });
  m = applyDistrictArrival(m, owner, instanceId, targetLane);
  m = recordElectricPlay(m, placed);
  m = fairytaleArrival(m, instanceId);
  m = applyScentEntry(m, instanceId);
  // STOCKZ compounds once per later friendly character play, in any district.
  // Permanent powerModifier carries these gains through every round.
  if ((card.kind ?? 'character') === 'character') {
    for (const investor of m.boards.flat().filter(c => !c.hazard && c.owner === owner && abilityCardId(c) === 'stockz'
      && c.instanceId !== instanceId && !c.statuses.silenced && !c.statuses.frozen)) {
      const beforeTrigger = m;
      m = modify(m, investor.instanceId, c => ({ ...c, powerModifier: c.powerModifier + 1, lastEffectNote: 'Compound Interest: +1 Hand.' }));
      m = addEvent(beforeTrigger, m, { type: 'ability', sourceId: investor.instanceId, owner, targetIds: [investor.instanceId], note: 'Compound Interest gained +1 Hand from a new friendly character.' });
    }
  }
  // Existing engines see a cheap arrival before its own ability resolves.
  if (cost <= 2) for (const streamer of m.boards.flat().filter((c) => !c.hazard && c.owner === owner && abilityCardId(c) === 'streamer' && !c.statuses.silenced && !c.statuses.frozen)) if (m.cheapBuffsUsed[owner] < 2) {
    const beforeTrigger = m;
    m = modify(m, placed.instanceId, (c) => ({ ...c, powerModifier: c.powerModifier + 1, lastEffectNote: 'Follower Frenzy: +1 Hands.' }));
    m = { ...m, cheapBuffsUsed: { ...m.cheapBuffsUsed, [owner]: m.cheapBuffsUsed[owner] + 1 } };
    m = addEvent(beforeTrigger, m, { type: 'ability', sourceId: streamer.instanceId, owner, targetIds: [placed.instanceId], note: 'Follower Frenzy gave the cheap play +1 Hands.' });
  }
  // Gamer moved from reactive Tryhard Trigger (cheap-play watch) to proactive City Tour On Reveal.
  // The reactive cheap-play hook was removed; resolveAbility now handles Gamer's branch directly.
  for (const boss of m.boards.flat().filter(c => !c.hazard && c.owner === owner && abilityCardId(c) === 'bossbabe'
    && c.lane !== targetLane && !c.statuses.silenced && !c.statuses.frozen && (c.networkBoosts ?? 0) < 2)) {
    const beforeTrigger = m;
    const triggers = (boss.networkBoosts ?? 0) + 1;
    m = modify(m, boss.instanceId, c => ({ ...c, networkBoosts: triggers, powerModifier: c.powerModifier + 1,
      lastEffectNote: `Network Boost: +1 Hands (${triggers}/2).`,
    }));
    if (triggers === 2) m = addDiscountToken(m, owner, boss, 'printed-four-plus');
    m = addEvent(beforeTrigger, m, { type: 'ability', sourceId: boss.instanceId, owner, targetIds: [boss.instanceId],
      note: `Network Boost gained +1 Hands.${triggers === 2 ? ' Your next 4-Cost or higher card costs 1 less Motion.' : ''}`,
    });
  }
  const revealed = m.boards.flat().find(c => c.instanceId === instanceId);
  if (revealed) {
    // Demario's Mushroom is a one-use lane resource for the next subsequently
    // played character.  Resolve it here, exactly once, before On Reveal; echoes
    // never pass through placement and therefore cannot consume it.
    if (!revealed.hazard && (revealed.kind ?? 'character') === 'character'
      && revealed.cardId !== 'luigion') {
      const mushroom = inLane(m, owner, targetLane).find(c => c.instanceId !== instanceId && c.cardId === 'demario-mushroom');
      if (mushroom) {
        const beforeMushroom = m;
        m = { ...m, boards: m.boards.map(items => items.filter(c => c.instanceId !== mushroom.instanceId)) as Match['boards'],
          timedEffects: m.timedEffects.filter(e => e.targetInstanceId !== mushroom.instanceId) };
        m = fairytaleDeparture(m, mushroom);
        m = modify(m, instanceId, c => ({ ...c, powerModifier: c.powerModifier + 1, lastEffectNote: 'Mushroom Delivery: consumed Mushroom, +1 Hand.' }));
        m = addEvent(beforeMushroom, m, { type: 'ability', sourceId: mushroom.instanceId, owner, lane: targetLane,
          targetIds: [instanceId, mushroom.instanceId], note: 'Mushroom Delivery: the next friendly character consumed a Mushroom for +1 Hand.' });
      }
    }
    const wisemanTrap = (m.districtTraps ?? []).find(t => t.kind === 'wiseman' && t.owner !== owner
      && t.lane === targetLane && t.expiresAfterRound >= m.round);
    if (wisemanTrap && !revealed.hazard && (revealed.kind ?? 'character') === 'character') {
      const beforeTrap = m;
      m = { ...m, districtTraps: m.districtTraps!.filter(t => t !== wisemanTrap) };
      m = addEvent(beforeTrap, m, { type: 'ability', sourceId: wisemanTrap.source.instanceId, owner: wisemanTrap.owner,
        lane: targetLane, targetIds: [instanceId],
        note: `Read The Block consumed its public prediction trap on ${revealed.name}.` });
      const beforeTrapHit = m;
      const eventCountBeforeHit = m.effectLog.length;
      m = hostileEffect(m, wisemanTrap.source, revealed, (state, actual) => {
        let result = reduceHands(state, actual, 2, 'Read The Block: predicted character took -2 Hands.');
        const survivor = findCard(result, actual.instanceId);
        if (survivor) result = queueDisruptionReactions(state, modify(result, survivor.instanceId, c => ({
          ...c, statuses: { ...c.statuses, weakened: true },
          lastEffectNote: 'Read The Block: -2 Hands and Weakened.',
        })), wisemanTrap.source, actual.instanceId);
        return result;
      }, false, false, true);
      if (m.effectLog.length === eventCountBeforeHit) {
        m = addEvent(beforeTrapHit, m, { type: 'ability', sourceId: wisemanTrap.source.instanceId, owner: wisemanTrap.owner,
          lane: targetLane, targetIds: [instanceId],
          note: `Read The Block hit ${revealed.name}: -2 Hands and Weaken (Protection or immunity may block it).` });
      }
    }
    const survivingReveal = findCard(m, instanceId);
    const trap = (m.districtTraps ?? []).find(t => t.kind === 'stakeout' && t.owner !== owner && t.lane === targetLane && t.expiresAfterRound >= m.round);
    const entrance = survivingReveal ? hasEntrance(survivingReveal) : false;
    if (trap && survivingReveal && entrance) {
      const beforeTrap = m;
      m = { ...m, districtTraps: m.districtTraps!.filter(t => t !== trap) };
      m = modify(m, instanceId, c => ({ ...c, lastEffectNote: 'Stakeout canceled this entrance.' }));
      const detective = m.boards.flat().find(c => c.instanceId === trap.source.instanceId);
      const rewardedIds: string[] = [];
      if (detective && activeAbility(detective)) {
        const ally = lowest(m.boards.flat().filter(c => !c.hazard && c.owner === trap.owner
          && c.instanceId !== detective.instanceId && (c.kind ?? 'character') === 'character'));
        for (const target of [detective, ...(ally ? [ally] : [])]) {
          rewardedIds.push(target.instanceId);
          m = modify(m, target.instanceId, c => ({ ...c, powerModifier: c.powerModifier + 2,
            lastEffectNote: 'Stakeout canceled an entrance: +2 Hands.' }));
        }
      }
      m = addEvent(beforeTrap, m, { type: 'ability', sourceId: trap.source.instanceId, owner: trap.owner,
        targetIds: [instanceId, ...rewardedIds], note: 'Stakeout canceled ' + revealed.name + '’s entrance.'
          + (rewardedIds.length ? ` ${rewardedIds.length === 2 ? 'Sherlock and the weakest other friendly character gained' : 'Sherlock gained'} +2 Hands.` : '') });
    } else if (survivingReveal) m = resolveAbility(m, survivingReveal);
  }
  m = undercovaReaction(m, match, instanceId, targetLane, owner);
  m = applyDistrictDeparture(m, owner, instanceId, targetLane);
  m = settleLeaderReactions(m);
  const opponent = owner === "player" ? "cpu" : "player";
  // Sneaker moved from reactive trigger (Flip Season on 4+ cost plays) to proactive On Reveal Steal.
  // The reactive logic was removed; resolveAbility now handles Sneaker's branch directly.
  const finalized: Match = { ...m, phase: endTurn ? owner === 'player' ? 'cpu-reveal' : 'resolved' : match.phase };
  const lastEventIndex = finalized.effectLog.length - 1;
  return applyStoryEffects({
    ...finalized,
    effectLog: finalized.effectLog.map((event, index) => index === lastEventIndex
      ? { ...event, state: { ...event.state, after: roundState(finalized) }, replay: { ...event.replay, after: { ...event.replay.after, phase: finalized.phase } } }
      : event),
  });
}
export function pass(match: Match, owner: Owner): Match {
  if ((owner === 'player' && match.phase !== 'player') || (owner === 'cpu' && match.phase !== 'cpu-reveal')) throw new Error('Owner cannot pass in this phase');
  const after = { ...match, phase: owner === 'player' ? 'cpu-reveal' as const : 'resolved' as const };
  return addEvent(match, after, { type: 'pass', owner, note: `${owner} passed.` });
}
export type RivalIntent = {
  style: string;
  tell: string;
  likelyLane: Lane | null;
};
const rivalStyle = (deckId: string) => decks.find((deck) => deck.id === deckId)?.archetype ?? "Adaptive";
export function getRivalIntent(match: Match): RivalIntent {
  const legal = match.cpuHand.flatMap((card) => ([0, 1, 2] as Lane[])
    .filter((target) => canAffordSelection(match, "cpu", card.instanceId, target))
    .map((target) => ({ card, lane: target })));
  if (!legal.length) return { style: rivalStyle(match.cpuDeck), tell: "Short on Motion — likely to pass and preserve a card.", likelyLane: null };
  const results = getDistrictResults(match);
  const style = rivalStyle(match.cpuDeck);
  const laneScores = ([0, 1, 2] as Lane[]).map((target) => {
    const result = results[target];
    const districtFit = Math.max(...legal.filter((option) => option.lane === target).map((option) => getDistrictCardBonusForMatch(match, option.card, target, [...inLane(match, "cpu", target), option.card])));
    const pressure = result.winner === "player" ? 3 : result.winner === "draw" ? 2 : 0;
    const styleBias = style.includes("Movement") && target === (match.round % 3) ? 2
      : style.includes("Comeback") && result.winner === "player" ? 2
      : style.includes("Control") && result.winner !== "cpu" ? 1
      : 0;
    return { lane: target, score: pressure + districtFit + styleBias };
  }).sort((a, b) => b.score - a.score || ((a.lane + match.round) % 3) - ((b.lane + match.round) % 3));
  const likelyLane = laneScores[0].lane;
  const laneName = getMatchDistricts(match)[likelyLane].name;
  const tell = style.includes("Comeback") ? `Likes trailing districts; pressure points toward ${laneName}.`
    : style.includes("Movement") ? `Spreads early, then shifts Hands; activity points toward ${laneName}.`
    : style.includes("Disruption") || style.includes("Control") ? `Targets contested engines; watch ${laneName}.`
    : style.includes("Combo") || style.includes("Growth") ? `Builds cheap chains before a late spike; setup points toward ${laneName}.`
    : `Balances district bonuses and open lanes; watch ${laneName}.`;
  return { style, tell, likelyLane };
}
export function chooseCpuPlay(match: Match, lookAhead = true): { instanceId: string; lane: Lane; investment: number } | null {
  if (match.phase !== "cpu-reveal") return null;
  match = { ...match, effectLog: [], playerHand: [], playerCardIds: [], playerDrawIndex: 0 };
  const options = match.cpuHand.flatMap(card => ([0, 1, 2] as Lane[])
    .filter(l => canAffordSelection(match, 'cpu', card.instanceId, l)).flatMap(l => {
      const cost = getLegalCardCost(match, 'cpu', card, l);
      const max = card.cardId === 'homelessguy' && activeAbility(card) ? Math.min(4, match.cpuMotion - cost) : 0;
      return Array.from({ length: max + 1 }, (_, investment) => ({ card, lane: l, cost: cost + investment, investment }));
    }));
  if (!options.length) return null;
  // Resolve each candidate through the real rules, including movement, cleansing,
  // protection, upgrades and story effects. Never reward an existing stack itself.
  const value = (resolved: Match) => {
    const board = match.round === getMatchRoundLimit(match) ? nextRound(resolved) : resolved;
    const results = getDistrictResults(board);
    const control = results.reduce((sum, r) => sum + (r.winner === "cpu" ? 1 : r.winner === "player" ? -1 : 0), 0);
    const margins = results.reduce((sum, r) => {
      const lead = r.cpu - r.player;
      // Diminishing returns: contestable districts matter more than overkill.
      return sum + 12 * lead / (4 + Math.abs(lead));
    }, 0);
    const winner = getMatchWinner(board);
    const finish = board.phase === "complete" ? (winner === "cpu" ? 1000 : winner === "player" ? -1000 : 0) : 0;
    const style = match.storyEncounter?.enemy.behaviorProfile ?? rivalStyle(match.cpuDeck);
    const active = board.boards.flat().filter(c => !c.hazard && c.owner === 'cpu' && !c.statuses.frozen && !c.statuses.silenced);
    const cheap = board.cpuHand.filter(c => c.cost <= 2).length;
    const setup = board.round < getMatchRoundLimit(board) ? active.reduce((sum, c) => sum
      + (abilityCardId(c) === 'gamer' ? Math.min(2, cheap) : abilityCardId(c) === 'streamer' ? Math.min(2 - board.cheapBuffsUsed.cpu, cheap) : abilityCardId(c) === 'bossbabe' ? 2 - (c.networkBoosts ?? 0) : 0)
      + (c.statuses.protected ? 0.7 : 0), 0) + Math.min(2, board.discountTokens.filter(t => t.owner === 'cpu').length) : 0;
    const styleValue = /movement|Movement/.test(style) ? board.boards.filter(items => items.some(c => c.owner === 'cpu')).length * 0.7
      : /support|Growth|combo/.test(style) ? setup * 0.7
      : /control|Control|reactive/.test(style) ? board.boards.flat().filter(c => !c.hazard && c.owner === 'player' && (c.statuses.frozen || c.statuses.silenced)).length * 0.7
      : /pressure|aggressive/.test(style) ? results.filter(r => r.winner === 'cpu').length * 0.7 : 0;
    return finish + control * 15 + margins + setup + styleValue;
  };
  const ranked = options.map(option => {
    const resolved = playCard(match, 'cpu', option.card.instanceId, option.lane, false, option.investment);
    return { ...option, resolved, score: value(resolved) };
  });
  const passed = pass(match, 'cpu');
  const candidates = [...ranked, { card: null, lane: 0 as Lane, cost: 0, investment: 0, resolved: passed, score: value(passed) }];
  candidates.sort((a, b) => b.score - a.score);
  // A bounded second turn values setup and saving removal. The opponent's private
  // hand is never read: this is an optimistic own-turn plan, weighted below now.
  if (lookAhead && match.round < getMatchRoundLimit(match)) for (const candidate of candidates.slice(0, 4)) {
    const future = pass(nextRound(candidate.resolved), 'player');
    const choice = chooseCpuPlay(future, false);
    const after = choice ? playCard(future, 'cpu', choice.instanceId, choice.lane, false, choice.investment) : pass(future, 'cpu');
    candidate.score += 0.35 * (value(after) - value(candidate.resolved));
  }
  candidates.sort((a, b) => b.score - a.score || a.cost - b.cost
    || (a.card?.instanceId ?? '').localeCompare(b.card?.instanceId ?? '')
    || ((a.lane + match.round) % 3) - ((b.lane + match.round) % 3));
  const best = candidates[0];
  return best.card ? { instanceId: best.card.instanceId, lane: best.lane, investment: best.investment } : null;
}
export function revealCpu(match: Match): Match { const choice = chooseCpuPlay(match); return choice ? playCard(match, 'cpu', choice.instanceId, choice.lane, false, choice.investment) : pass(match, 'cpu'); }
/** Resolve the rival's whole turn with the same per-card Motion budget. */
export function revealCpuTurn(match: Match): Match {
  if (match.phase !== 'cpu-reveal') throw new Error('It is not the rival turn');
  let next = match;
  while (true) {
    const choice = chooseCpuPlay(next);
    if (!choice) return pass(next, 'cpu');
    next = playTurnCard(next, 'cpu', choice.instanceId, choice.lane, false, choice.investment);
  }
}
function applyDistrictRoundStart(match: Match): Match {
  let m = match;
  for (const [index, district] of (match.districtSnapshot?.locations ?? []).entries()) {
    const effect = district.effect, targetLane = index as Lane;
    if (effect.kind !== 'round-growth' && !(effect.kind === 'flood' && match.round === effect.atRound)) continue;
    const before = m, targetIds = m.boards[targetLane].map(c => c.instanceId);
    let note = '';
    if (effect.kind === 'round-growth') {
      note = district.name + ': every card here gained +' + effect.amount + ' permanent Hands.';
      for (const id of targetIds) m = modify(m, id, c => ({ ...c, powerModifier: c.powerModifier + effect.amount, lastEffectNote: note }));
    } else {
      const destination = lane((targetLane + 1) % 3);
      for (const id of targetIds) {
        const traveler = m.boards[targetLane].find(c => c.instanceId === id);
        if (traveler) m = move(m, traveler, destination, district.name + ': the flood carried this card right.');
      }
      const moved = targetIds.filter(id => findCard(m, id)?.lane === destination).length;
      note = district.name + ': flood moved ' + moved + ' cards right; ' + (targetIds.length - moved) + ' held in place.';
    }
    m = addEvent(before, m, { type: 'ability', owner: 'player', lane: targetLane, targetIds,
      kind: effect.kind === 'flood' ? 'move' : 'story', note });
  }
  return m;
}

/** Stable random draws let solo verification and persisted multiplayer rooms replay identically. */
const seededIndex = (seed: string, count: number): number => {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) hash = Math.imul(hash ^ seed.charCodeAt(i), 16777619);
  hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b);
  hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35);
  return ((hash ^ (hash >>> 16)) >>> 0) % count;
};
const smileBombSeed = (match: Match, id: string, draw: number) =>
  JSON.stringify([id, draw, match.round, match.nextEventSequence, match.districtSnapshot,
    match.boards.map(lane => lane.map(card => [card.instanceId, card.basePower + card.powerModifier]))]);

function detonateSmileBombs(match: Match): Match {
  let m = match;
  // A stable order also gives multiple KYLEs independent, reproducible kill credit.
  const due = m.boards.flat().filter(card => card.smileBomb && card.smileBomb.detonatesAtRound <= m.round)
    .sort((a, b) => a.instanceId.localeCompare(b.instanceId));
  for (const scheduled of due) {
    const bomb = findCard(m, scheduled.instanceId);
    if (!bomb?.smileBomb || bomb.lane === null) continue;
    const before = m, payload = bomb.smileBomb;
    const enemies = inLane(m, payload.sourceOwner === 'player' ? 'cpu' : 'player', bomb.lane)
      .filter(card => card.kind !== 'support').sort((a, b) => a.instanceId.localeCompare(b.instanceId));
    const target = enemies.length ? enemies[seededIndex(smileBombSeed(m, bomb.instanceId, 0), enemies.length)] : undefined;
    const source = findCard(m, payload.sourceInstanceId);
    // Always consume the fuse, even if the lane emptied or KYLE left the board.
    m = { ...m, boards: m.boards.map(lane => lane.filter(card => card.instanceId !== bomb.instanceId)) as Match['boards'] };
    let killed = false;
    let damaged = false;
    let reward = 0;
    if (target) {
      m = targetEnemyPowerReduction(m, source ?? { ...bomb, owner: payload.sourceOwner }, target, -2, 'Smile Bomb: -2 Hands.');
      killed = !findCard(m, target.instanceId);
      damaged = killed || (findCard(m, target.instanceId)?.powerModifier ?? target.powerModifier) < target.powerModifier;
      if (damaged && source && source.owner === payload.sourceOwner && source.lane !== null) {
        reward = killed ? 2 : 1;
        m = modify(m, source.instanceId, card => ({ ...card, powerModifier: card.powerModifier + reward,
          lastEffectNote: killed ? 'Smile Bomb knockout: +2 Hands.' : 'Smile Bomb hit: +1 Hands.' }));
      }
    }
    m = addEvent(before, m, { type: 'ability', sourceId: source?.instanceId, owner: payload.sourceOwner,
      lane: bomb.lane, kind: damaged ? 'fire' : 'blocked', targetIds: [bomb.instanceId, ...(target ? [target.instanceId] : [])],
      note: target ? damaged
        ? 'Smile Bomb hit ' + target.name + ' for -2 Hands.' + (reward ? ' KYLE gained +' + reward + ' Hands' + (killed ? ' for the knockout.' : '.') : '')
        : target.name + ' blocked the Smile Bomb.'
        : 'Smile Bomb fizzled: no enemy in its district.',
    });
    m = settleLeaderReactions(m);
  }
  return m;
}

export function nextRound(match: Match): Match {
  if (match.phase !== 'resolved') throw new Error('Round is not resolved');
  // Resolve persistent statuses and hand bonds before either advancing or scoring.
  const roundEnded = settleLeaderReactions(returnAliceAtRoundEnd(applyOngoingRoundEndHandEffects(applyOngoingRoundEndEffects(match))));
  if (match.round >= getMatchRoundLimit(match)) {
    const complete = applyStoryEffects({ ...roundEnded, phase: 'complete' as const });
    return addEvent(match, complete, { type: 'match-complete', owner: 'player', note: 'The match is complete.' });
  }
  const draw = (owner: Owner, deckId: string, deckCards: string[], index: number) =>
    index < deckCards.length ? createCardInstance(deckCards[index], owner, deckId, index) : null;
  const p = draw('player', match.playerDeck, match.playerCardIds, match.playerDrawIndex);
  const c = draw('cpu', match.cpuDeck, match.cpuCardIds, match.cpuDrawIndex);
  const next = match.round + 1;
  const expiring = roundEnded.timedEffects.filter((effect) => effect.expiresAtRound === next);
  let m: Match = {
    ...roundEnded,
    lastRevealedCardId: null,
    roundMovedIds: { player: [], cpu: [] },
    round: next,
    phase: 'player',
    // One unspent Motion carries forward. Passing can set up a stronger next
    // round, but the cap prevents late turns from becoming automatic.
    playerMotion: Math.min(MAX_MOTION, next + Math.min(1, match.playerMotion)),
    cpuMotion: Math.min(MAX_MOTION, next + Math.min(1, match.cpuMotion)),
    landlordTaxUsed: { player: { 0: false, 1: false, 2: false }, cpu: { 0: false, 1: false, 2: false } },
    boards: roundEnded.boards.map((items) => items.map((card) => ({
      ...card,
      statuses: { ...card.statuses, blocked: false },
    }))) as Match['boards'],
  };
  for (const effect of expiring) {
    const beforeExpiration = m.nextEventSequence === match.nextEventSequence ? match : m;
    let afterExpiration = modify(m, effect.sourceInstanceId, (card) => ({
      ...card,
      statuses: { ...card.statuses, protected: m.timedEffects.some(active => active.kind === 'salon-protection' && active.targetInstanceId === card.instanceId), blocked: false },
    }));
    afterExpiration = {
      ...afterExpiration,
      timedEffects: afterExpiration.timedEffects.filter((active) => active.id !== effect.id),
    };
    m = addEvent(beforeExpiration, afterExpiration, {
      type: 'expiration', sourceId: effect.sourceInstanceId, owner: effect.owner, targetIds: [effect.sourceInstanceId],
      note: 'Side Eye protection expired at the round boundary.', kind: 'blocked',
    });
  }
  const beforeRoundStart = expiring.length ? m : match;
  m = {
    ...m,
    playerHand: p ? [...m.playerHand, p] : m.playerHand,
    cpuHand: c ? [...m.cpuHand, c] : m.cpuHand,
    playerDrawIndex: m.playerDrawIndex + (p ? 1 : 0),
    cpuDrawIndex: m.cpuDrawIndex + (c ? 1 : 0),
  };
  const guards = m.boards.flat().filter((card) => abilityCardId(card) === 'wifey' && !card.statuses.silenced && !card.statuses.frozen);
  for (const guard of guards) {
    m = modify(m, guard.instanceId, (card) => ({ ...card, statuses: { ...card.statuses, protected: true, blocked: false }, lastEffectNote: 'Side Eye refreshed for this round.' }));
    m = { ...m, timedEffects: [...m.timedEffects, {
      id: `wifey:${guard.instanceId}:${next}`, kind: 'wifey-protection', sourceInstanceId: guard.instanceId,
      owner: guard.owner, lane: guard.lane!, startsAtRound: next, expiresAtRound: next + 1, expiration: 'round-start',
    }] };
  }
  m = addEvent(beforeRoundStart, m, {
    type: 'round-start', owner: 'player',
    targetIds: [...guards.map((guard) => guard.instanceId), ...(p ? [p.instanceId] : []), ...(c ? [c.instanceId] : [])],
    timing: guards.length ? 'timed' : 'instant',
    duration: guards.length ? { unit: 'round', startsAtRound: next, expiresAtRound: next + 1, expiration: 'round-start' } : null,
    note: `Round ${next} started.`,
  });
  m = detonateSmileBombs(m);
  m = applyStoryEffects(m);
  if (!m.districtRuntime) return m;
  m = settleLeaderReactions(applyDistrictRoundStart(m));
  const refreshed = refreshDistrictRound(m);
  const party = m.districtSnapshot!.locations.find(d => d.effect.kind === 'penthouse' && d.effect.changesAtRound === next);
  return addEvent(m, refreshed, { type: 'ability', owner: 'player', kind: 'story',
    note: party ? 'PENTHOUSE: the party starts. Each card here now has +1 Hands instead of the solo bonus.' : `District bonuses refreshed for round ${next}.`,
    lane: party ? m.districtSnapshot!.locations.indexOf(party) as Lane : 0,
  });
}
/**
 * The replay payload accepted by the reward service.  Keep this alongside the
 * structured event stream so the same deterministic rules author both the
 * presentation and the server-verifiable transcript.
 */
export type PlayerMove = {
  cardInstanceId: string | null;
  lane: Lane | null;
  squabble: boolean;
  /** Explicit on new matches; absent only on legacy one-card turns. */
  endTurn?: boolean;
  /** Optional extra Motion for Homeless Guy; validated by the authoritative engine. */
  investment?: number;
};
export type TranscriptMove = Omit<PlayerMove, 'lane'> & { lane: number | null };
export const MAX_MATCH_MOVES = 64;

/** Pick a legal teaching move. Spread winning Hands across the districts. */
export function getTutorialPlay(match: Match): { instanceId: string; lane: Lane } | null {
  if (match.phase !== "player") return null;
  let best: { instanceId: string; lane: Lane; value: number } | null = null;
  for (const card of match.playerHand) for (const lane of [0, 1, 2] as const) {
    if (!canAffordSelection(match, "player", card.instanceId, lane)) continue;
    // Keep the mentor for the lesson's final SQUABBLE. Older saved crews
    // without him continue to use the normal legal-move guidance.
    const mentorLesson = match.storyEncounter?.id === 'rookie-road-v2'
      && match.playerHand.some(c => c.cardId === 'drfade');
    if (mentorLesson && ((match.round < 4 && card.cardId === 'drfade')
      || (match.round === 4 && card.cardId !== 'drfade'))) continue;
    const played = playTurnCard(match, "player", card.instanceId, lane, match.round === 4 && !match.squabbleUsed);
    const results = getDistrictResults(revealCpuTurn(pass(played, "player")));
    const value = results.reduce((sum, d) => sum + (d.winner === "player" ? 1000 : 0) + Math.max(-12, Math.min(12, d.player - d.cpu)), 0);
    if (!best || value > best.value) best = { instanceId: card.instanceId, lane, value };
  }
  return best ? { instanceId: best.instanceId, lane: best.lane } : null;
}
/** Build the exact legal transcript taught by the guided tutorial. */
export function createGuidedTutorialTranscript(
  abilityUpgradeSnapshot?: AbilityUpgradeSnapshot,
  districtSnapshot?: DistrictSnapshot,
  encounter?: StoryEncounterSnapshot,
  playerCardIds?: string[],
  playerDeckId = "vibes",
): PlayerMove[] {
  let match = encounter ? createStoryMatch(encounter, playerCardIds ?? deckById(playerDeckId).cards, playerDeckId, abilityUpgradeSnapshot, districtSnapshot) : createMatch(
    "vibes",
    "combo",
    undefined,
    abilityUpgradeSnapshot,
    districtSnapshot,
  );
  const moves: PlayerMove[] = [];
  const roundLimit = getMatchRoundLimit(match);

  for (let round = 1; round <= roundLimit; round += 1) {
    if (round === 1 || round === 2 || round === 4) {
      const candidates = match.playerHand.flatMap((card) =>
        ([0, 1, 2] as const)
          .filter((lane) => canAffordSelection(match, "player", card.instanceId, lane))
          .map((lane) => ({ card, lane })),
      );
      candidates.sort((left, right) =>
        round === 4
          ? right.card.basePower - left.card.basePower || left.lane - right.lane
          : left.card.cost - right.card.cost || left.lane - right.lane,
      );
      const teaching = encounter ? getTutorialPlay(match) : null;
      const selected = teaching ? candidates.find(c => c.card.instanceId === teaching.instanceId && c.lane === teaching.lane) : candidates[0];
      if (!selected) {
        throw new Error(`Tutorial round ${round} needs an affordable play`);
      }
      const squabble = round === 4;
      moves.push({
        cardInstanceId: selected.card.instanceId,
        lane: selected.lane,
        squabble,
        endTurn: false,
      });
      match = playTurnCard(
        match,
        "player",
        selected.card.instanceId,
        selected.lane,
        squabble,
      );
    }

    moves.push({
      cardInstanceId: null,
      lane: null,
      squabble: false,
      endTurn: true,
    });
    match = nextRound(revealCpuTurn(pass(match, "player")));
  }

  if (match.phase !== "complete") {
    throw new Error("Guided tutorial transcript did not complete the match");
  }
  return moves;
}

export function validateTurnRules(moves: readonly TranscriptMove[], version: 1 | 2) {
  if (moves.some(move => version === 2 ? typeof move.endTurn !== 'boolean' : move.endTurn !== undefined)) {
    throw new Error('Transcript does not follow this fade’s turn rules');
  }
}

/** Replay a committed transcript prefix without requiring the match to be complete.
 * This is the only safe way to reconstruct an interrupted online encounter: the
 * serialized client Match is never authoritative. */
export function replayMatchPrefix(initial: Match, moves: readonly TranscriptMove[]): Match {
  const roundLimit = getMatchRoundLimit(initial);
  if (moves.length > MAX_MATCH_MOVES) throw new Error("A transcript may contain at most 64 actions");
  const multiCardTurns = moves.some(move => move.endTurn !== undefined);
  validateTurnRules(moves, multiCardTurns ? 2 : 1);
  let match = initial;
  for (const move of moves) {
    if (match.phase !== 'player') throw new Error('Transcript contains actions after the fade ended');
    if (move.cardInstanceId === null) {
      if (move.lane !== null || move.squabble || move.endTurn === false || (move.investment ?? 0) !== 0) throw new Error('Invalid end turn');
      match = pass(match, 'player');
    } else {
      if (move.lane === null || ![0, 1, 2].includes(move.lane)) throw new Error('Played cards need a valid lane');
      match = multiCardTurns
        ? playTurnCard(match, 'player', move.cardInstanceId, move.lane as Lane, move.squabble, move.investment)
        : playCard(match, 'player', move.cardInstanceId, move.lane as Lane, move.squabble, move.investment);
      if (move.endTurn === true) match = pass(match, 'player');
    }
    if (match.phase === 'cpu-reveal') {
      match = multiCardTurns ? revealCpuTurn(match) : revealCpu(match);
      match = nextRound(match);
    }
  }
  return match;
}
function replayPlayerMoves(initial: Match, moves: readonly TranscriptMove[]): Match {
  const roundLimit = getMatchRoundLimit(initial);
  const roundLabel = roundLimit === DEFAULT_MATCH_ROUND_LIMIT ? "six" : String(roundLimit);
  if (moves.length < roundLimit) throw new Error(`A match needs ${roundLabel} round endings`);
  const match = replayMatchPrefix(initial, moves);
  if (match.phase !== 'complete') throw new Error(`Transcript did not complete ${roundLabel} rounds`);
  return match;
}
export function verifyMatchTranscript(
  playerDeck: string,
  cpuDeck: string,
  moves: TranscriptMove[],
  abilityUpgradeSnapshot?: AbilityUpgradeSnapshot,
  playerCardIds?: readonly string[],
  districtSnapshot?: DistrictSnapshot,
): Match {
  const match = playerCardIds
    ? createMatchFromEngineCards(playerDeck, [...playerCardIds], cpuDeck, [...deckById(cpuDeck).cards], undefined, undefined, abilityUpgradeSnapshot, districtSnapshot)
    : createMatch(playerDeck, cpuDeck, undefined, abilityUpgradeSnapshot, districtSnapshot);
  return replayPlayerMoves(match, moves);
}

export function createStoryMatch(
  snapshot: StoryEncounterSnapshot,
  playerDeck: string | readonly string[],
  playerCardsOrId: readonly string[] | string = "story-player",
  abilityUpgradeSnapshot?: AbilityUpgradeSnapshot,
  districtSnapshot?: DistrictSnapshot,
): Match {
  if (snapshot.enemy.cardIds.length !== DECK_SIZE || new Set(snapshot.enemy.cardIds).size !== DECK_SIZE) {
    throw new Error("Story enemy deck must contain ten unique cards");
  }
  const player = typeof playerDeck === "string"
    ? Array.isArray(playerCardsOrId)
      ? { id: playerDeck, cards: [...playerCardsOrId] }
      : deckById(playerDeck)
    : { id: typeof playerCardsOrId === "string" ? playerCardsOrId : "story-player", cards: [...playerDeck] };
  return createMatchFromEngineCards(
    player.id,
    [...player.cards],
    snapshot.enemy.deckId,
    [...snapshot.enemy.cardIds],
    snapshot,
    undefined,
    abilityUpgradeSnapshot,
    districtSnapshot,
  );
}

export function verifyStoryMatchTranscript(
  snapshot: StoryEncounterSnapshot,
  playerDeck: string | readonly string[],
  playerCardsOrMoves: readonly string[] | TranscriptMove[],
  movesOrDeckId?: TranscriptMove[] | string,
  abilityUpgradeSnapshot?: AbilityUpgradeSnapshot,
  districtSnapshot?: DistrictSnapshot,
): Match {
  const suppliedCards = playerCardsOrMoves.length > 0 && typeof playerCardsOrMoves[0] === "string";
  const moves = (suppliedCards ? movesOrDeckId : playerCardsOrMoves) as TranscriptMove[];
  if (!Array.isArray(moves)) throw new Error("Story fade transcript moves are required");
  const matchCardsOrId = suppliedCards
    ? playerCardsOrMoves as readonly string[]
    : typeof movesOrDeckId === "string" ? movesOrDeckId : "story-player";
  return replayPlayerMoves(createStoryMatch(snapshot, playerDeck, matchCardsOrId, abilityUpgradeSnapshot, districtSnapshot), moves);
}

export type RoundState = {
  round: number; phase: Phase; playerDrawIndex: number; cpuDrawIndex: number;
  squabbleUsed: boolean; plugDiscountLane: Record<Owner, Lane | null>; cheapBuffsUsed: Record<Owner, number>;
  discountTokens: DiscountToken[]; nextDiscountOrder: number; landlordTaxUsed: Record<Owner, Record<Lane, boolean>>;
  sneakerTriggered: Record<Owner, boolean>;
};

export type EventType = 'play' | 'reveal' | 'ability' | 'pass' | 'round-start' | 'expiration' | 'match-complete';

export type EventParticipant = {
  cardInstanceId: string; cardId: string; owner: Owner;
  before: CardEventState | null; after: CardEventState | null;
};

const roundState = (m: Match): RoundState => ({
  round: m.round,
  phase: m.phase,
  playerDrawIndex: m.playerDrawIndex,
  cpuDrawIndex: m.cpuDrawIndex,
  squabbleUsed: m.squabbleUsed,
  plugDiscountLane: { ...m.plugDiscountLane },
  cheapBuffsUsed: { ...m.cheapBuffsUsed },
  discountTokens: [...(m.discountTokens ?? [])],
  nextDiscountOrder: m.nextDiscountOrder ?? 1,
  landlordTaxUsed: m.landlordTaxUsed ?? { player: { 0: false, 1: false, 2: false }, cpu: { 0: false, 1: false, 2: false } },
  sneakerTriggered: m.sneakerTriggered ?? { player: false, cpu: false },
});

export type EventDuration = { unit: 'round'; startsAtRound: number; expiresAtRound: number; expiration: 'round-start' | 'match-complete' };

const participant = (before: Match, after: Match, id: string): EventParticipant | null => {
  const b = findCard(before, id), a = findCard(after, id);
  const card = a ?? b;
  return card ? { cardInstanceId: card.instanceId, cardId: card.cardId, owner: card.owner, before: cardState(b), after: cardState(a) } : null;
};

const cardState = (card: CardInstance | undefined): CardEventState | null => card ? ({
  cardInstanceId: card.instanceId, cardId: card.cardId, owner: card.owner, lane: card.lane,
  power: getEffectiveCardPower(card), basePower: card.basePower, powerModifier: card.powerModifier,
  moved: card.moved, statuses: { ...card.statuses }, lastEffectNote: card.lastEffectNote,
}) : null;

type EventInput = {
  type: EventType; sourceId?: string; owner: Owner; targetIds?: string[]; note: string;
  kind?: EffectKind; timing?: 'instant' | 'timed'; duration?: EventDuration | null; lane?: Lane;
  abilityMetadata?: EffectLogEntry["abilityMetadata"];
};

export type ResourceState = { playerMotion: number; cpuMotion: number };

const resources = (m: Match): ResourceState => ({ playerMotion: m.playerMotion, cpuMotion: m.cpuMotion });

const replayState = (m: Match): ReplayState => JSON.parse(JSON.stringify({
  districtSnapshot: m.districtSnapshot,
  districtRuntime: m.districtRuntime,
  leaderRounds: m.leaderRounds,
  electricPlays: m.electricPlays,
  pendingLeaderReactions: m.pendingLeaderReactions,
  lingeringScents: m.lingeringScents ?? [],
  districtTraps: m.districtTraps ?? [],
  janitorReversals: m.janitorReversals ?? [],
  lastMovedAlly: m.lastMovedAlly ?? {},
  roundMovedIds: m.roundMovedIds ?? { player: [], cpu: [] },
  cheshireRounds: m.cheshireRounds ?? {},
  squabbleByOwner: m.squabbleByOwner,
  round: m.round,
  phase: m.phase,
  playerHand: m.playerHand,
  cpuHand: m.cpuHand,
  boards: m.boards,
  playerMotion: m.playerMotion,
  cpuMotion: m.cpuMotion,
  playerDrawIndex: m.playerDrawIndex,
  cpuDrawIndex: m.cpuDrawIndex,
  squabbleUsed: m.squabbleUsed,
  plugDiscountLane: m.plugDiscountLane,
  cheapBuffsUsed: m.cheapBuffsUsed,
  discountTokens: m.discountTokens ?? [],
  nextDiscountOrder: m.nextDiscountOrder ?? 1,
  landlordTaxUsed: m.landlordTaxUsed ?? { player: { 0: false, 1: false, 2: false }, cpu: { 0: false, 1: false, 2: false } },
  sneakerTriggered: m.sneakerTriggered ?? { player: false, cpu: false },
  timedEffects: m.timedEffects,
  storyRuntime: m.storyRuntime,
  abilityUpgradeSnapshot: m.abilityUpgradeSnapshot,
})) as ReplayState;

export type ScoreState = { lane: Lane; player: number; cpu: number };

const addEvent = (before: Match, after: Match, input: EventInput): Match => {
  if (
    before[SUPPRESS_PRESENTATION_EVENTS] ||
    after[SUPPRESS_PRESENTATION_EVENTS]
  ) {
    return {
      ...after,
      [SUPPRESS_PRESENTATION_EVENTS]: true,
      nextEventSequence: after.nextEventSequence + 1,
      effectLog: [],
    };
  }
  const source = input.sourceId ? participant(before, after, input.sourceId) : null;
  const targetIds = [...new Set(input.targetIds ?? [])].filter((id) => id !== input.sourceId);
  const sourceCard = input.sourceId ? findCard(after, input.sourceId) ?? findCard(before, input.sourceId) : undefined;
  const event: EffectLogEntry = {
    sequence: after.nextEventSequence,
    round: after.round,
    type: input.type,
    timing: input.timing ?? 'instant',
    duration: input.duration ?? null,
    source,
    targets: targetIds.map((id) => participant(before, after, id)).filter((x): x is EventParticipant => x !== null),
    scores: { before: scores(before), after: scores(after) },
    resources: { before: resources(before), after: resources(after) },
    state: { before: roundState(before), after: roundState(after) },
    replay: { before: replayState(before), after: replayState(after) },
    cardInstanceId: sourceCard?.instanceId ?? input.type,
    cardId: sourceCard?.cardId ?? input.type,
    owner: sourceCard?.owner ?? input.owner,
    lane: input.lane ?? sourceCard?.lane ?? 0,
    kind: input.kind ?? 'ability',
    note: input.note + targetIds.filter(id => findCard(before, id) && !findCard(after, id)).map(id => ` ${findCard(before, id)!.name} was destroyed.`).join(''),
    ...(input.abilityMetadata ? { abilityMetadata: input.abilityMetadata } : {}),
  };
  return { ...after, nextEventSequence: after.nextEventSequence + 1, effectLog: [...after.effectLog, event] };
};

export type CardEventState = {
  cardInstanceId: string; cardId: string; owner: Owner; lane: Lane | null;
  power: number; basePower: number; powerModifier: number; moved: boolean;
  statuses: Statuses; lastEffectNote: string;
};

const scores = (m: Match): ScoreState[] => getDistrictResults(m).map(({ lane: district, player, cpu }) => ({ lane: district, player, cpu }));
