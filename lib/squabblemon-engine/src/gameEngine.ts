import { cards, catalogIdsToEngineIds, decks, type Card, type Deck } from './data';
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
export type StoryEncounterSnapshot = {
  readonly id: string;
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
};
export type StoryRuntime = {
  activePhaseIndex: number;
  appliedEffectIds: string[];
  lanePowerBonuses: { owner: Owner | "both"; lane: Lane; amount: number }[];
  laneLocks: { owner: Owner | "both"; lanes: Lane[] }[];
};
export type Statuses = { frozen: boolean; silenced: boolean; protected: boolean; blocked: boolean };
export type CardInstance = Card & {
  instanceId: string; cardId: string; owner: Owner; lane: Lane | null; playedRound: number | null;
  basePower: number; powerModifier: number; moved: boolean; statuses: Statuses; lastEffectNote: string;
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
  'sneakerTriggered' | 'storyRuntime' | 'abilityUpgradeSnapshot'
>;

export type TimedEffect = {
  id: string; kind: 'wifey-protection' | 'church-protection' | 'nail-mitigation'; sourceInstanceId: string; owner: Owner; lane: Lane;
  targetInstanceId?: string; startsAtRound: number; expiresAtRound: number; expiration: 'round-start' | 'match-complete';
};
export type DiscountToken = {
  id: string; owner: Owner; sourceInstanceId: string; eligibility: 'any' | 'printed-two-cost' | 'another-district';
  sourceLane: Lane | null; createdOrder: number;
};
export type Match = {
  round: number; phase: Phase; playerDeck: string; cpuDeck: string; playerHand: CardInstance[]; cpuHand: CardInstance[];
  playerCardIds: string[]; cpuCardIds: string[];
  boards: [CardInstance[], CardInstance[], CardInstance[]]; playerMotion: number; cpuMotion: number;
  playerDrawIndex: number; cpuDrawIndex: number; squabbleUsed: boolean; plugDiscountLane: Record<Owner, Lane | null>;
  cheapBuffsUsed: Record<Owner, number>; effectLog: EffectLogEntry[]; nextEventSequence: number; timedEffects: TimedEffect[];
  discountTokens: DiscountToken[]; nextDiscountOrder: number; landlordTaxUsed: Record<Owner, Record<Lane, boolean>>;
  sneakerTriggered: Record<Owner, boolean>;
  storyEncounter?: StoryEncounterSnapshot; storyRuntime?: StoryRuntime;
  abilityUpgradeSnapshot: AbilityUpgradeSnapshot;
};
const lane = (n: number): Lane => n as Lane;
const emptyStatuses = (): Statuses => ({ frozen: false, silenced: false, protected: false, blocked: false });
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
): Match {
  const p = deckById(playerDeck), c = deckById(cpuDeck);
  return createMatchFromEngineCards(p.id, p.cards, c.id, c.cards, undefined, progression, suppliedAbilityUpgradeSnapshot);
}

export function createMatchFromEngineCards(
  playerDeck: string,
  playerCardIds: string[],
  cpuDeck: string,
  cpuCardIds: string[],
  storyEncounter?: StoryEncounterSnapshot,
  progression?: { readonly player?: CardProgressionMap; readonly cpu?: CardProgressionMap },
  suppliedAbilityUpgradeSnapshot?: AbilityUpgradeSnapshot,
): Match {
  if (playerCardIds.length !== 7 || new Set(playerCardIds).size !== 7) {
    throw new Error("Player deck must contain seven unique cards");
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
    playerMotion: storyEncounter?.modifiers?.startingMotion?.player ?? 2,
    cpuMotion: storyEncounter?.modifiers?.startingMotion?.cpu ?? 2,
    playerDrawIndex: playerHandSize, cpuDrawIndex: cpuHandSize,
    squabbleUsed: false, plugDiscountLane: { player: null, cpu: null }, cheapBuffsUsed: { player: 0, cpu: 0 },
    effectLog: [], nextEventSequence: 1, timedEffects: [], discountTokens: [], nextDiscountOrder: 1,
    landlordTaxUsed: { player: { 0: false, 1: false, 2: false }, cpu: { 0: false, 1: false, 2: false } },
    sneakerTriggered: { player: false, cpu: false },
    abilityUpgradeSnapshot,
    ...(storyEncounter ? {
      storyEncounter,
      storyRuntime: { activePhaseIndex: -1, appliedEffectIds: [], lanePowerBonuses: [], laneLocks: [] },
    } : {}),
  };
  match = applyStoryEffects(match);
  return match;
}

export function createMatchFromCatalog(
  playerDeck: string,
  playerCatalogCardIds: string[],
  cpuDeck: string,
  progression?: { readonly player?: CardProgressionMap; readonly cpu?: CardProgressionMap },
): Match {
  const cpu = deckById(cpuDeck);
  return createMatchFromEngineCards(
    playerDeck,
    catalogIdsToEngineIds(playerCatalogCardIds),
    cpu.id,
    cpu.cards,
    undefined,
    progression,
  );
}

export function getEffectiveCardPower(card: CardInstance): number {
  return card.statuses.frozen ? 0 : Math.max(0, card.basePower + card.powerModifier);
}
export const effectiveCardPower = getEffectiveCardPower;
export function getLaneScore(cardsInLane: CardInstance[], laneIndex: number): number {
  return cardsInLane.reduce((total, card) => {
    const district = laneIndex === 0 && (card.type === 'Fire' || card.type === 'Dark') ? 2
      : laneIndex === 1 && card.roles?.includes('Disruption') ? 2
      : laneIndex === 2 && card.type === 'Electric' ? 3 : 0;
    return total + getEffectiveCardPower(card) + district;
  }, 0);
}
export function getDistrictCardBonus(card: Pick<CardInstance, "type" | "roles">, laneIndex: Lane): number {
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
  const resolvedOwner = owner ?? cardsInLane[0]?.owner;
  return getLaneScore(cardsInLane, laneIndex) + (resolvedOwner ? getStoryLaneBonus(match, resolvedOwner, laneIndex) : 0);
}
export function getDistrictResults(match: Match) {
  return match.boards.map((cardsInLane, i) => {
    const player = getLaneScoreForMatch(match, cardsInLane.filter((c) => c.owner === "player"), i as Lane, "player");
    const cpu = getLaneScoreForMatch(match, cardsInLane.filter((c) => c.owner === "cpu"), i as Lane, "cpu");
    return { lane: i as Lane, player, cpu, winner: player === cpu ? "draw" as const : player > cpu ? "player" as const : "cpu" as const };
  });
}
export function getMatchWinner(match: Match): Owner | 'draw' | null {
  const results = getDistrictResults(match), player = results.filter((r) => r.winner === 'player').length, cpu = results.filter((r) => r.winner === 'cpu').length;
  if (player >= 2) return 'player';
  if (cpu >= 2) return 'cpu';
  return match.round >= 6 && match.phase === 'complete' ? 'draw' : null;
}
const activeLandlord = (match: Match, owner: Owner, targetLane: Lane) =>
  inLane(match, owner === "player" ? "cpu" : "player", targetLane)
    .some((card) => card.cardId === "landlord" && !card.statuses.silenced);
const tokenEligible = (token: DiscountToken, card: CardInstance, targetLane: Lane) =>
  token.eligibility === "any"
  || (token.eligibility === "printed-two-cost" && card.cost === 2)
  || (token.eligibility === "another-district" && token.sourceLane !== targetLane);
const discountFor = (match: Match, owner: Owner, card: CardInstance, targetLane: Lane) =>
  [...(match.discountTokens ?? [])]
    .sort((a, b) => a.createdOrder - b.createdOrder || a.id.localeCompare(b.id))
    .find((token) => token.owner === owner && tokenEligible(token, card, targetLane));
export function getLegalCardCost(match: Match, owner: Owner, card: CardInstance, targetLane: Lane): number {
  const legacyDiscount = (match.discountTokens ?? []).length === 0
    && match.plugDiscountLane[owner] !== null && match.plugDiscountLane[owner] !== targetLane;
  const discount = discountFor(match, owner, card, targetLane) || legacyDiscount;
  const taxed = activeLandlord(match, owner, targetLane) && !(match.landlordTaxUsed?.[owner]?.[targetLane] ?? false);
  return Math.max(0, card.cost - (discount ? 1 : 0)) + (taxed ? 1 : 0);
}
export function getCardCostExplanation(match: Match, owner: Owner, card: CardInstance, targetLane: Lane): string {
  const token = discountFor(match, owner, card, targetLane);
  const legacy = !token && (match.discountTokens ?? []).length === 0 && match.plugDiscountLane[owner] !== null && match.plugDiscountLane[owner] !== targetLane;
  const taxed = activeLandlord(match, owner, targetLane) && !(match.landlordTaxUsed?.[owner]?.[targetLane] ?? false);
  const parts = [`${card.cost} base`];
  if (token || legacy) parts.push("−1 discount");
  if (taxed) parts.push("+1 Rent Due tax");
  return parts.join(" · ");
}
export const getDiscountedCardCost = getLegalCardCost;
export function canAffordSelection(match: Match, owner: Owner, instanceId: string, targetLane: Lane): boolean {
  const card = (owner === "player" ? match.playerHand : match.cpuHand).find((c) => c.instanceId === instanceId);
  return !!card && !getStoryLockedLanes(match, owner).includes(targetLane) && getLegalCardCost(match, owner, card, targetLane) <= (owner === "player" ? match.playerMotion : match.cpuMotion);
}

const modify = (m: Match, id: string, change: (c: CardInstance) => CardInstance): Match => ({ ...m, boards: m.boards.map((cardsInLane) => cardsInLane.map((c) => c.instanceId === id ? change(c) : c)) as Match['boards'] });

const findCard = (m: Match, id: string): CardInstance | undefined =>
  [...m.playerHand, ...m.cpuHand, ...m.boards.flat()].find((c) => c.instanceId === id);
const inLane = (m: Match, owner: Owner, target: Lane) => m.boards[target].filter((c) => c.owner === owner);
const highest = (items: CardInstance[]) => [...items].sort((a, b) => getEffectiveCardPower(b) - getEffectiveCardPower(a) || a.instanceId.localeCompare(b.instanceId))[0];
const lowest = (items: CardInstance[]) => [...items].sort((a, b) => getEffectiveCardPower(a) - getEffectiveCardPower(b) || a.instanceId.localeCompare(b.instanceId))[0];
const move = (m: Match, card: CardInstance, destination: Lane, note: string): Match => {
  const sourceLane = card.lane ?? m.boards.findIndex((items) => items.some((candidate) => candidate.instanceId === card.instanceId)) as Lane;
  if (sourceLane === destination) return m;
  const updated = { ...card, lane: destination, moved: true, lastEffectNote: note };
  return { ...m, boards: m.boards.map((items, i) => i === sourceLane ? items.filter((c) => c.instanceId !== card.instanceId) : i === destination ? [...items, updated] : items) as Match['boards'] };
};
const lowestFriendlyLane = (m: Match, owner: Owner, except: Lane): Lane => ([0, 1, 2] as Lane[]).filter((x) => x !== except).sort((a, b) => getLaneScore(inLane(m, owner, a), a) - getLaneScore(inLane(m, owner, b), b) || a - b)[0];
const addDiscountToken = (m: Match, owner: Owner, source: CardInstance, eligibility: DiscountToken["eligibility"]): Match => {
  const order = m.nextDiscountOrder ?? 1;
  return { ...m, nextDiscountOrder: order + 1, discountTokens: [...(m.discountTokens ?? []), {
    id: `discount:${owner}:${order}`, owner, sourceInstanceId: source.instanceId, eligibility, sourceLane: source.lane, createdOrder: order,
  }] };
};
/** Wifey consumes one hostile targeted effect in her lane each round. */
const targetEnemy = (m: Match, source: CardInstance, target: CardInstance, apply: (c: CardInstance) => CardInstance): Match => {
  const churchProtection = (m.timedEffects ?? []).find((effect) => effect.kind === "church-protection" && effect.targetInstanceId === target.instanceId);
  if (churchProtection) {
    const cleared = modify(m, target.instanceId, (c) => ({ ...c, statuses: { ...c.statuses, protected: false }, lastEffectNote: "Covered blocked a targeted hostile ability." }));
    return { ...cleared, timedEffects: cleared.timedEffects.filter((effect) => effect.id !== churchProtection.id) };
  }
  const targetLane = target.lane ?? m.boards.findIndex((items) => items.some((card) => card.instanceId === target.instanceId)) as Lane;
  const guard = inLane(m, target.owner, targetLane).find((c) => c.cardId === 'wifey' && c.statuses.protected && !c.statuses.silenced && !c.statuses.blocked);
  if (guard) return modify(m, guard.instanceId, (c) => ({ ...c, statuses: { ...c.statuses, blocked: true }, lastEffectNote: 'Side Eye blocked a targeted effect.' }));
  return modify(m, target.instanceId, apply);
};
const targetEnemyPowerReduction = (m: Match, source: CardInstance, target: CardInstance, amount: number, note: string): Match => {
  const mitigation = (m.timedEffects ?? []).find((effect) => effect.kind === "nail-mitigation" && effect.targetInstanceId === target.instanceId);
  const reducedAmount = Math.min(0, amount + (mitigation ? 1 : 0));
  const before = targetEnemy(m, source, target, (c) => ({ ...c, powerModifier: c.powerModifier + reducedAmount, lastEffectNote: note }));
  if (findCard(before, target.instanceId)?.lastEffectNote !== note) return before;
  return mitigation ? { ...before, timedEffects: before.timedEffects.filter((effect) => effect.id !== mitigation.id) } : before;
};

const storyLog = (before: Match, after: Match, id: string, owner: Owner, note: string): Match => {
  const logged = addEvent(before, after, { type: 'ability', owner, lane: 0, kind: 'story', note });
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
    m = { ...m, [key]: Math.max(0, m[key] + effect.amount) };
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
  return [...new Set([...scheduled, ...entered])].sort() as Lane[];
}
export function getStoryModifierSummaries(value: Match | StoryEncounterSnapshot): string[] {
  const snapshot = "round" in value ? value.storyEncounter : value;
  if (!snapshot) return [];
  const modifiers = snapshot.modifiers;
  const summaries: string[] = [];
  if (modifiers?.startingMotion) summaries.push(`Starting Motion: player ${modifiers.startingMotion.player ?? 2}, CPU ${modifiers.startingMotion.cpu ?? 2}`);
  if (modifiers?.handSize) summaries.push(`Opening hand: player ${modifiers.handSize.player ?? 5}, CPU ${modifiers.handSize.cpu ?? 5}`);
  for (const lock of modifiers?.laneLocks ?? []) summaries.push(`Round ${lock.round}: ${lock.owner} cannot play lane${lock.lanes.length === 1 ? "" : "s"} ${lock.lanes.join(", ")}`);
  for (const delta of modifiers?.roundMotionDeltas ?? []) summaries.push(`Round ${delta.round}: ${delta.owner} Motion ${delta.amount >= 0 ? "+" : ""}${delta.amount}`);
  for (const bonus of modifiers?.lanePowerBonuses ?? []) summaries.push(`${bonus.owner} lane ${bonus.lane} Power ${bonus.amount >= 0 ? "+" : ""}${bonus.amount}`);
  for (const reinforcement of modifiers?.reinforcements ?? []) summaries.push(`Round ${reinforcement.round}: ${reinforcement.owner} reinforces with ${reinforcement.cardId}`);
  for (const phase of snapshot.phases ?? []) summaries.push(`Phase ${phase.name}: ${phase.trigger.kind}`);
  return summaries;
}

function resolveAbility(match: Match, source: CardInstance): Match {
  const before = match;
  const l = source.lane!, enemy = source.owner === 'player' ? 'cpu' : 'player', kind = source.type === 'Fire' ? 'fire' : source.type === 'Water' ? 'water' : 'ability';
  let m = match;
  const targetIds = new Set<string>();
  const note = (text: string, timing: 'instant' | 'timed' = 'instant', duration: EventDuration | null = null) => {
    const changed = before.boards.flat().filter((old) => {
      const current = findCard(m, old.instanceId);
      return current && JSON.stringify(cardState(old)) !== JSON.stringify(cardState(current));
    }).map((card) => card.instanceId);
    const moved = [source.instanceId, ...targetIds, ...changed].some((id) => cardState(findCard(before, id))?.lane !== cardState(findCard(m, id))?.lane);
    m = addEvent(before, m, { type: 'ability', sourceId: source.instanceId, owner: source.owner, targetIds: [...targetIds, ...changed], note: text, kind: moved ? 'move' : kind, timing, duration });
  };
  if (source.statuses.silenced || source.statuses.frozen) { note('Ability did not fire (silenced or frozen).'); return m; }
  if (source.cardId === 'rastamon') { const t = lowest(inLane(m, source.owner, l).filter((c) => c.instanceId !== source.instanceId && (c.statuses.frozen || c.statuses.silenced))); if (t) { targetIds.add(t.instanceId); m = modify(m, t.instanceId, (c) => ({ ...c, statuses: { ...c.statuses, frozen: false, silenced: false }, powerModifier: c.powerModifier + 2, lastEffectNote: 'Natural Cure: cleansed, +2 Power.' })); note('Natural Cure cleansed an ally and gave it +2.'); } else note('Natural Cure found no status to cleanse.'); }
  else if (source.cardId === 'roaster') { const t = highest(inLane(m, enemy, l)); if (t) { targetIds.add(t.instanceId); const amount = t.playedRound === m.round ? -3 : -2; m = targetEnemyPowerReduction(m, source, t, amount, `Ratio'd Receipts: ${amount} Power.`); note(`Ratio'd Receipts targeted ${t.name}.`); } else note("Ratio'd Receipts found no enemy."); }
  else if (source.cardId === 'nerd') { const t = highest(inLane(m, enemy, l)); if (t) { targetIds.add(t.instanceId); m = targetEnemy(m, source, t, (c) => ({ ...c, statuses: { ...c.statuses, silenced: true }, lastEffectNote: 'Unaware: silenced.' })); note('Unaware targeted the highest enemy.'); } else note('Unaware found no enemy.'); }
  else if (source.cardId === 'cornball') { const t = inLane(m, enemy, l).length >= 3 ? lowest(inLane(m, enemy, l)) : undefined; if (t) { targetIds.add(t.instanceId); const guarded = inLane(m, enemy, l).some((c) => c.cardId === 'wifey' && c.statuses.protected && !c.statuses.silenced && !c.statuses.blocked); m = targetEnemy(m, source, t, (c) => c); if (!guarded) m = move(m, t, lane((l + 1) % 3), 'Scare the Hoes moved this card.'); note('Scare the Hoes moved the lowest enemy.'); } else note('Scare the Hoes needs three enemies.'); }
  else if (source.cardId === 'plug') { m = addDiscountToken(m, source.owner, source, 'another-district'); m = { ...m, plugDiscountLane: { ...m.plugDiscountLane, [source.owner]: l } }; note('Connections: next card in another district costs 1 less Motion.'); }
  else if (source.cardId === 'streamer') note('Follower Frenzy is live for the next two cheap plays.');
  else if (source.cardId === 'gamer') note('Tryhard Trigger watches cheap plays here.');
  else if (source.cardId === 'techbro') { const motion = source.owner === 'player' ? m.playerMotion : m.cpuMotion; if (motion) { m = modify(m, source.instanceId, (c) => ({ ...c, powerModifier: c.powerModifier + 2, lastEffectNote: 'VC Funded Flex: +2 Power.' })); m = { ...m, ...(source.owner === 'player' ? { playerMotion: motion - 1 } : { cpuMotion: motion - 1 }) }; note('VC Funded Flex spent 1 Motion for +2.'); } else note('VC Funded Flex had no Motion left.'); }
  else if (source.cardId === 'bikelife') { const to = lowestFriendlyLane(m, source.owner, l); m = move(m, source, to, 'Ride Out moved here, +1 Power.'); m = modify(m, source.instanceId, (c) => ({ ...c, powerModifier: c.powerModifier + 1, lastEffectNote: 'Ride Out moved here, +1 Power.' })); note('Ride Out moved Bikelife and gave +1.'); }
  else if (source.cardId === 'vibe') { const t = lowest(m.boards.flat().filter((c) => c.owner === source.owner && c.instanceId !== source.instanceId && c.lane !== l)); if (t) { targetIds.add(t.instanceId); m = move(m, t, l, 'Wave Check pulled this card here, +1 Power.'); m = modify(m, t.instanceId, (c) => ({ ...c, powerModifier: c.powerModifier + 1, lastEffectNote: 'Wave Check pulled this card here, +1 Power.' })); m = modify(m, source.instanceId, (c) => ({ ...c, powerModifier: c.powerModifier + 1, lastEffectNote: 'Wave Check: +1 Power.' })); note('Wave Check pulled the lowest ally here; both gained +1.'); } else note('Wave Check needs an ally in another district.'); }
  else if (source.cardId === 'hooper') { if (getLaneScore(inLane(m, source.owner, l), l) < getLaneScore(inLane(m, enemy, l), l)) { const t = highest(inLane(m, enemy, l)); if (t) { targetIds.add(t.instanceId); m = targetEnemyPowerReduction(m, source, t, -2, 'Ankle Breaker: -2 Power.'); } m = modify(m, source.instanceId, (c) => ({ ...c, powerModifier: c.powerModifier + 2, lastEffectNote: 'Ankle Breaker: +2 Power.' })); note('Ankle Breaker flipped the pressure.'); } else note('Ankle Breaker only triggers while losing.'); }
  else if (source.cardId === 'baby') { if (inLane(m, enemy, l).length > inLane(m, source.owner, l).length) { m = modify(m, source.instanceId, (c) => ({ ...c, powerModifier: c.powerModifier + 2, lastEffectNote: 'Mama Bear: +2 Power.' })); note('Mama Bear gained +2.'); } else note('Mama Bear found no crowd disadvantage.'); }
  else if (source.cardId === 'oink') { for (const t of inLane(m, enemy, l)) { targetIds.add(t.instanceId); m = targetEnemyPowerReduction(m, source, t, -1, 'Civic Pressure: -1 Power.'); } note('Civic Pressure applied lane pressure.'); }
  else if (source.cardId === 'snow') { const t = highest(inLane(m, enemy, l)); if (t) { targetIds.add(t.instanceId); m = targetEnemy(m, source, t, (c) => ({ ...c, statuses: { ...c.statuses, frozen: true }, lastEffectNote: 'Cold Shoulder: frozen.' })); note('Cold Shoulder froze the highest enemy.'); } else note('Cold Shoulder found no enemy.'); }
  else if (source.cardId === 'barber') {
    const friendly = lowest(inLane(m, source.owner, l).filter((c) => c.instanceId !== source.instanceId));
    const hostile = highest(inLane(m, enemy, l));
    if (friendly) { targetIds.add(friendly.instanceId); m = modify(m, friendly.instanceId, (c) => ({ ...c, powerModifier: c.powerModifier + 2, lastEffectNote: "Line Up: +2 Power." })); }
    if (hostile) { targetIds.add(hostile.instanceId); m = targetEnemyPowerReduction(m, source, hostile, -1, "Line Up: -1 Power."); }
    note(friendly || hostile ? "Line Up sharpened the district." : "Line Up found no other cards.");
  }
  else if (source.cardId === 'bottle') {
    if (m.round >= 4) m = modify(m, source.instanceId, (c) => ({ ...c, powerModifier: c.powerModifier + 2, lastEffectNote: "Last Call: +2 Power." }));
    const remainingMotion = source.owner === "player" ? m.playerMotion : m.cpuMotion;
    if (remainingMotion > 0) m = addDiscountToken(m, source.owner, source, "printed-two-cost");
    note(`${m.round >= 4 ? "Last Call gave +2 Power. " : ""}${remainingMotion > 0 ? "Last Call set aside a 2-Cost discount." : "Last Call found no unspent Motion."}`);
  }
  else if (source.cardId === 'church') {
    const target = lowest(inLane(m, source.owner, l).filter((c) => c.instanceId !== source.instanceId));
    if (!target) note("Covered needs another friendly card.");
    else if (target.statuses.protected) { targetIds.add(target.instanceId); m = modify(m, target.instanceId, (c) => ({ ...c, powerModifier: c.powerModifier + 2, lastEffectNote: "Covered: already protected, +2 Power." })); note("Covered reinforced an already protected ally."); }
    else {
      targetIds.add(target.instanceId);
      m = modify(m, target.instanceId, (c) => ({ ...c, statuses: { ...c.statuses, protected: true }, lastEffectNote: "Covered: protected from one targeted hostile ability." }));
      m = { ...m, timedEffects: [...m.timedEffects, { id: `church:${source.instanceId}:${target.instanceId}`, kind: "church-protection", sourceInstanceId: source.instanceId, targetInstanceId: target.instanceId, owner: source.owner, lane: l, startsAtRound: m.round, expiresAtRound: 7, expiration: "match-complete" }] };
      note("Covered protected the lowest-Power friendly card.");
    }
  }
  else if (source.cardId === 'carmeet') {
    const destination = lowestFriendlyLane(m, source.owner, l);
    m = move(m, source, destination, "Sideshow moved to the weakest other district.");
    const target = lowest(inLane(m, source.owner, destination).filter((c) => c.instanceId !== source.instanceId));
    if (target) { targetIds.add(target.instanceId); m = modify(m, target.instanceId, (c) => ({ ...c, powerModifier: c.powerModifier + 1, lastEffectNote: "Sideshow: +1 Power." })); }
    note(target ? "Sideshow moved and gave an ally +1 Power." : "Sideshow moved to the weakest other district.");
  }
  else if (source.cardId === 'promoter') {
    const revealed = [...(enemy === "player" ? m.playerHand : m.cpuHand)].sort((a, b) => a.instanceId.localeCompare(b.instanceId))[0];
    if (!revealed) note("Guest List found no opponent hand card.");
    else { targetIds.add(revealed.instanceId); if (revealed.cost >= 4) m = addDiscountToken(m, source.owner, source, "another-district"); note(`Guest List revealed ${revealed.name} (${revealed.cost} Motion)${revealed.cost >= 4 ? " and set aside an another-district discount." : "."}`); }
  }
  else if (source.cardId === 'nail') {
    const target = lowest(inLane(m, source.owner, l).filter((c) => c.instanceId !== source.instanceId));
    if (!target) note("Fresh Set needs another friendly card.");
    else { targetIds.add(target.instanceId); m = modify(m, target.instanceId, (c) => ({ ...c, powerModifier: c.powerModifier + 2, lastEffectNote: "Fresh Set: +2 Power." })); m = { ...m, timedEffects: [...m.timedEffects.filter((effect) => effect.kind !== "nail-mitigation" || effect.targetInstanceId !== target.instanceId), { id: `nail:${source.instanceId}:${target.instanceId}`, kind: "nail-mitigation", sourceInstanceId: source.instanceId, targetInstanceId: target.instanceId, owner: source.owner, lane: l, startsAtRound: m.round, expiresAtRound: 7, expiration: "match-complete" }] }; note("Fresh Set gave +2 Power and reinforced the next hostile reduction."); }
  }
  else if (source.cardId === 'og') {
    const ownCount = m.boards.flat().filter((c) => c.owner === source.owner).length, enemyCount = m.boards.flat().filter((c) => c.owner === enemy).length;
    if (enemyCount > ownCount) m = modify(m, source.instanceId, (c) => ({ ...c, powerModifier: c.powerModifier + 3, lastEffectNote: "Back In My Day: +3 Power." }));
    if (enemyCount >= ownCount + 3) { const target = lowest(inLane(m, enemy, l)); if (target) { targetIds.add(target.instanceId); m = targetEnemyPowerReduction(m, source, target, -1, "Back In My Day: -1 Power."); } }
    note(enemyCount > ownCount ? "Back In My Day punished the board advantage." : "Back In My Day found no larger opposing board.");
  }
  else if (source.cardId === 'delivery') {
    const target = lowest(inLane(m, source.owner, l).filter((c) => c.instanceId !== source.instanceId && c.cost <= 2));
    if (!target) note("Drop Off needs another friendly 1- or 2-Cost card here.");
    else { targetIds.add(target.instanceId); const destination = lowestFriendlyLane(m, source.owner, l); m = move(m, target, destination, "Drop Off moved this card to the weakest other district."); note("Drop Off moved the lowest-Power eligible ally."); }
  }
  else if (source.cardId === 'wifey') {
    const duration: EventDuration = { unit: 'round', startsAtRound: m.round, expiresAtRound: m.round + 1, expiration: 'round-start' };
    m = modify(m, source.instanceId, (c) => ({ ...c, statuses: { ...c.statuses, protected: true }, lastEffectNote: 'Side Eye is protecting this lane.' }));
    m = { ...m, timedEffects: [...m.timedEffects.filter((effect) => effect.sourceInstanceId !== source.instanceId), { id: `wifey:${source.instanceId}:${m.round}`, kind: 'wifey-protection', sourceInstanceId: source.instanceId, owner: source.owner, lane: l, startsAtRound: m.round, expiresAtRound: m.round + 1, expiration: 'round-start' }] };
    note('Side Eye will block one targeted effect this round.', 'timed', duration);
  }
  const changedTargetIds = [...targetIds].filter((id) =>
    JSON.stringify(cardState(findCard(before, id))) !== JSON.stringify(cardState(findCard(m, id))),
  );
  const baseSucceeded = source.cardId === "plug" || source.cardId === "streamer" || source.cardId === "gamer"
    ? true
    : JSON.stringify(cardState(findCard(before, source.instanceId))) !== JSON.stringify(cardState(findCard(m, source.instanceId)))
      || changedTargetIds.length > 0;
  // Fixed upgrades resolve after the printed ability in authored unlock order.  Their
  // small bounded effect budget prevents progression from changing base-card identity.
  if (!source.statuses.silenced && !source.statuses.frozen && baseSucceeded) {
    for (const upgrade of snapshotUpgradesForCard(m.abilityUpgradeSnapshot, source.owner, source.cardId)) {
      const beforeUpgrade = m;
      const effect = upgrade.effect;
      const target = effect.kind === "self-power"
        ? findCard(m, source.instanceId)
        : changedTargetIds
          .map((id) => findCard(m, id))
          .find((card): card is CardInstance => !!card && card.owner === (effect.target === "friendly" ? source.owner : enemy));
      if (!target) continue;
      m = modify(m, target.instanceId, (card) => ({
        ...card,
        powerModifier: card.powerModifier + upgrade.effect.amount,
        lastEffectNote: `${upgrade.name}: ${upgrade.effect.amount >= 0 ? "+" : ""}${upgrade.effect.amount} Power.`,
      }));
      m = addEvent(beforeUpgrade, m, {
        type: "ability",
        sourceId: source.instanceId,
        owner: source.owner,
        targetIds: [target.instanceId],
        kind,
        note: `${upgrade.name} upgraded ${target.name}: ${upgrade.effect.amount >= 0 ? "+" : ""}${upgrade.effect.amount} Power.`,
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
  return m;
}

export function playCard(match: Match, owner: Owner, instanceId: string, targetLane: Lane, squabble = false): Match {
  if ((owner === 'player' && match.phase !== 'player') || (owner === 'cpu' && match.phase !== 'cpu-reveal')) throw new Error('Owner cannot play in this phase');
  if (getStoryLockedLanes(match, owner).includes(targetLane)) throw new Error('Lane is locked');
  const handKey = owner === 'player' ? 'playerHand' : 'cpuHand', motionKey = owner === 'player' ? 'playerMotion' : 'cpuMotion', card = match[handKey].find((c) => c.instanceId === instanceId);
  if (!card) throw new Error('Card is not in this hand');
  if (squabble && (owner !== 'player' || match.squabbleUsed)) throw new Error('SQUABBLE is unavailable');
  const cost = getLegalCardCost(match, owner, card, targetLane);
  if (match[motionKey] < cost) throw new Error('Not enough Motion');
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
    landlordTaxUsed: taxed ? { ...taxState, [owner]: { ...taxState[owner], [targetLane]: true } } : taxState,
    squabbleUsed: match.squabbleUsed || squabble,
  };
  let placed: CardInstance = { ...card, lane: targetLane, playedRound: m.round, powerModifier: card.powerModifier + (squabble ? card.basePower : 0), lastEffectNote: squabble ? 'SQUABBLE doubled base Power.' : `Played for ${cost} Motion.` };
  m = { ...m, boards: m.boards.map((items, i) => i === targetLane ? [...items, placed] : items) as Match['boards'] };
  m = addEvent(match, m, {
    type: 'play', sourceId: instanceId, owner, lane: targetLane,
    note: `${card.name} was played in district ${targetLane + 1} for ${cost} Motion.${usedToken ? ` ${usedToken.eligibility} discount used.` : ''}${taxed ? " Rent Due added 1 Motion." : ""}${squabble ? ' SQUABBLE doubled its base Power.' : ''}`,
  });
  m = addEvent(m, m, {
    type: 'reveal', sourceId: instanceId, owner, lane: targetLane,
    note: `${card.name} revealed in district ${targetLane + 1}.`,
  });
  // Existing engines see a cheap arrival before its own ability resolves.
  if (cost <= 2) for (const streamer of m.boards.flat().filter((c) => c.owner === owner && c.cardId === 'streamer' && !c.statuses.silenced && !c.statuses.frozen)) if (m.cheapBuffsUsed[owner] < 2) {
    const beforeTrigger = m;
    m = modify(m, placed.instanceId, (c) => ({ ...c, powerModifier: c.powerModifier + 1, lastEffectNote: 'Follower Frenzy: +1 Power.' }));
    m = { ...m, cheapBuffsUsed: { ...m.cheapBuffsUsed, [owner]: m.cheapBuffsUsed[owner] + 1 } };
    m = addEvent(beforeTrigger, m, { type: 'ability', sourceId: streamer.instanceId, owner, targetIds: [placed.instanceId], note: 'Follower Frenzy gave the cheap play +1 Power.' });
  }
  if (cost <= 2) for (const gamer of inLane(m, owner, targetLane).filter((c) => c.cardId === 'gamer' && c.instanceId !== placed.instanceId && !c.statuses.silenced && !c.statuses.frozen)) {
    const beforeTrigger = m;
    m = modify(m, gamer.instanceId, (c) => ({ ...c, powerModifier: c.powerModifier + 1 }));
    m = modify(m, placed.instanceId, (c) => ({ ...c, powerModifier: c.powerModifier + 1, lastEffectNote: 'Tryhard Trigger: +1 Power.' }));
    m = addEvent(beforeTrigger, m, { type: 'ability', sourceId: gamer.instanceId, owner, targetIds: [placed.instanceId], note: 'Tryhard Trigger gave Gamer and the cheap play +1 Power.' });
  }
  placed = m.boards.flat().find((c) => c.instanceId === instanceId)!;
  m = resolveAbility(m, placed);
  const opponent = owner === "player" ? "cpu" : "player";
  if (card.cost >= 4 && !m.sneakerTriggered?.[opponent]) {
    const reseller = m.boards.flat().find((candidate) => candidate.owner === opponent && candidate.cardId === "sneaker" && !candidate.statuses.silenced && !candidate.statuses.frozen);
    if (reseller) {
      const beforeSneaker = m;
      m = { ...m, sneakerTriggered: { ...(m.sneakerTriggered ?? { player: false, cpu: false }), [opponent]: true } };
      m = addDiscountToken(m, opponent, reseller, "any");
      m = addEvent(beforeSneaker, m, { type: "ability", sourceId: reseller.instanceId, owner: opponent, note: "Flip Season set aside a discount after a 4-Cost card was played." });
    }
  }
  const finalized: Match = { ...m, phase: owner === 'player' ? 'cpu-reveal' : 'resolved' };
  const lastEventIndex = finalized.effectLog.length - 1;
  return applyStoryEffects({
    ...finalized,
    effectLog: finalized.effectLog.map((event, index) => index === lastEventIndex
      ? { ...event, state: { ...event.state, after: roundState(finalized) } }
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
    const districtFit = Math.max(...legal.filter((option) => option.lane === target).map((option) => getDistrictCardBonus(option.card, target)));
    const pressure = result.winner === "player" ? 3 : result.winner === "draw" ? 2 : 0;
    const styleBias = style.includes("Movement") && target === (match.round % 3) ? 2
      : style.includes("Comeback") && result.winner === "player" ? 2
      : style.includes("Control") && result.winner !== "cpu" ? 1
      : 0;
    return { lane: target, score: pressure + districtFit + styleBias };
  }).sort((a, b) => b.score - a.score || ((a.lane + match.round) % 3) - ((b.lane + match.round) % 3));
  const likelyLane = laneScores[0].lane;
  const laneName = ["The Town", "Group Chat", "Server Room"][likelyLane];
  const tell = style.includes("Comeback") ? `Likes trailing districts; pressure points toward ${laneName}.`
    : style.includes("Movement") ? `Spreads early, then shifts Power; activity points toward ${laneName}.`
    : style.includes("Disruption") || style.includes("Control") ? `Targets contested engines; watch ${laneName}.`
    : style.includes("Combo") || style.includes("Growth") ? `Builds cheap chains before a late spike; setup points toward ${laneName}.`
    : `Balances district bonuses and open lanes; watch ${laneName}.`;
  return { style, tell, likelyLane };
}
export function chooseCpuPlay(match: Match): { instanceId: string; lane: Lane } | null {
  if (match.phase !== "cpu-reveal") return null;
  const options = match.cpuHand.flatMap((card) => ([0, 1, 2] as Lane[]).filter((l) => canAffordSelection(match, "cpu", card.instanceId, l)).map((l) => ({ card, lane: l, cost: getLegalCardCost(match, "cpu", card, l) })));
  if (!options.length) return null;
  const intent = getRivalIntent(match);
  const ranked = options.sort((a, b) => {
    const value = (option: typeof a) => {
      const currentCpu = getLaneScoreForMatch(match, inLane(match, "cpu", option.lane), option.lane, "cpu");
      const currentPlayer = getLaneScoreForMatch(match, inLane(match, "player", option.lane), option.lane, "player");
      const district = getDistrictCardBonus(option.card, option.lane);
      const intentBonus = option.lane === intent.likelyLane ? 3 : 0;
      const abilitySetup = option.card.roles?.includes("Disruption") && currentPlayer > 0 ? 2 : 0;
      return currentCpu + option.card.basePower + district - currentPlayer + intentBonus + abilitySetup;
    };
    const av = value(a);
    const bv = value(b);
    return bv - av || a.cost - b.cost || a.card.instanceId.localeCompare(b.card.instanceId) || a.lane - b.lane;
  });
  return { instanceId: ranked[0].card.instanceId, lane: ranked[0].lane };
}
export function revealCpu(match: Match): Match { const choice = chooseCpuPlay(match); return choice ? playCard(match, 'cpu', choice.instanceId, choice.lane) : pass(match, 'cpu'); }
export function nextRound(match: Match): Match {
  if (match.phase !== 'resolved') throw new Error('Round is not resolved');
  if (match.round >= 6) {
    const complete = applyStoryEffects({ ...match, phase: 'complete' as const });
    return addEvent(complete, complete, { type: 'match-complete', owner: 'player', note: 'The match is complete.' });
  }
  const draw = (owner: Owner, deckId: string, deckCards: string[], index: number) =>
    index < deckCards.length ? createCardInstance(deckCards[index], owner, deckId, index) : null;
  const p = draw('player', match.playerDeck, match.playerCardIds, match.playerDrawIndex);
  const c = draw('cpu', match.cpuDeck, match.cpuCardIds, match.cpuDrawIndex);
  const next = match.round + 1;
  const expiring = match.timedEffects.filter((effect) => effect.expiresAtRound === next);
  let m: Match = {
    ...match,
    round: next,
    phase: 'player',
    // One unspent Motion carries forward. Passing can set up a stronger next
    // round, but the cap prevents late turns from becoming automatic.
    playerMotion: Math.min(6, next + Math.min(1, match.playerMotion)),
    cpuMotion: Math.min(6, next + Math.min(1, match.cpuMotion)),
    landlordTaxUsed: { player: { 0: false, 1: false, 2: false }, cpu: { 0: false, 1: false, 2: false } },
    boards: match.boards.map((items) => items.map((card) => ({
      ...card,
      statuses: { ...card.statuses, blocked: false },
    }))) as Match['boards'],
  };
  for (const effect of expiring) {
    const beforeExpiration = m.nextEventSequence === match.nextEventSequence ? match : m;
    let afterExpiration = modify(m, effect.sourceInstanceId, (card) => ({
      ...card,
      statuses: { ...card.statuses, protected: false, blocked: false },
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
  const guards = m.boards.flat().filter((card) => card.cardId === 'wifey' && !card.statuses.silenced && !card.statuses.frozen);
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
  return applyStoryEffects(m);
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
};
export function verifyMatchTranscript(
  playerDeck: string,
  cpuDeck: string,
  moves: Array<{ cardInstanceId: string | null; lane: number | null; squabble: boolean }>,
  abilityUpgradeSnapshot?: AbilityUpgradeSnapshot,
): Match {
  if (moves.length !== 6) throw new Error('A match transcript needs six moves');
  let match = createMatch(playerDeck, cpuDeck, undefined, abilityUpgradeSnapshot);
  for (const move of moves) {
    if (move.cardInstanceId === null) {
      if (move.lane !== null || move.squabble) throw new Error('Invalid pass');
      match = pass(match, 'player');
    } else {
      if (move.lane === null || ![0, 1, 2].includes(move.lane)) {
        throw new Error('Played cards need a valid lane');
      }
      match = playCard(match, 'player', move.cardInstanceId, move.lane as Lane, move.squabble);
    }
    match = revealCpu(match);
    match = nextRound(match);
  }
  if (match.phase !== 'complete') throw new Error('Transcript did not complete six rounds');
  return match;
}

export function createStoryMatch(
  snapshot: StoryEncounterSnapshot,
  playerDeck: string | readonly string[],
  playerCardsOrId: readonly string[] | string = "story-player",
  abilityUpgradeSnapshot?: AbilityUpgradeSnapshot,
): Match {
  if (snapshot.enemy.cardIds.length !== 7 || new Set(snapshot.enemy.cardIds).size !== 7) {
    throw new Error("Story enemy deck must contain seven unique cards");
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
  );
}

export function verifyStoryMatchTranscript(
  snapshot: StoryEncounterSnapshot,
  playerDeck: string | readonly string[],
  playerCardsOrMoves: readonly string[] | Array<{ cardInstanceId: string | null; lane: number | null; squabble: boolean }>,
  movesOrDeckId?: Array<{ cardInstanceId: string | null; lane: number | null; squabble: boolean }> | string,
  abilityUpgradeSnapshot?: AbilityUpgradeSnapshot,
): Match {
  const suppliedCards = playerCardsOrMoves.length > 0 && typeof playerCardsOrMoves[0] === "string";
  const moves = (suppliedCards ? movesOrDeckId : playerCardsOrMoves) as Array<{ cardInstanceId: string | null; lane: number | null; squabble: boolean }>;
  if (!Array.isArray(moves)) throw new Error("Story match transcript moves are required");
  if (moves.length !== 6) throw new Error("A story match transcript needs six moves");
  const matchCardsOrId = suppliedCards
    ? playerCardsOrMoves as readonly string[]
    : typeof movesOrDeckId === "string" ? movesOrDeckId : "story-player";
  let match = createStoryMatch(snapshot, playerDeck, matchCardsOrId, abilityUpgradeSnapshot);
  for (const move of moves) {
    if (move.cardInstanceId === null) {
      if (move.lane !== null || move.squabble) throw new Error("Invalid pass");
      match = pass(match, "player");
    } else {
      if (move.lane === null || ![0, 1, 2].includes(move.lane)) throw new Error("Played cards need a valid lane");
      match = playCard(match, "player", move.cardInstanceId, move.lane as Lane, move.squabble);
    }
    match = revealCpu(match);
    match = nextRound(match);
  }
  if (match.phase !== "complete") throw new Error("Transcript did not complete six rounds");
  return match;
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
    lane: sourceCard?.lane ?? input.lane ?? 0,
    kind: input.kind ?? 'ability',
    note: input.note,
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
