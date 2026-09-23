import { completeEngineCrew, cards, decks, type Deck } from './data';
import { createDistrictSnapshot } from './districts';
import {
  canAffordSelection,
  createAbilityUpgradeSnapshot,
  createCardInstance,
  createMatchFromEngineCards,
  getDistrictResults,
  getEffectiveCardPower,
  getLegalCardCost,
  getMatchWinner,
  nextRound,
  pass,
  playTurnCard,
  type CardInstance,
  type EffectLogEntry,
  type Lane,
  type Match,
  type Owner,
} from './gameEngine';

export const BALANCE_LAB_SCHEMA_VERSION = 1 as const;
export type BalanceTier = 0 | 3;
export type BalanceSeat = 'a-player' | 'b-player';
export type BalanceLabMode = 'smoke' | 'full';

export type BalanceDeck = {
  readonly id: string;
  readonly name: string;
  readonly cardIds: readonly string[];
  /** Decks that share an order key receive the same index permutation in paired experiments. */
  readonly orderKey?: string;
};

export type BalancePlayOption = {
  readonly instanceId: string;
  readonly cardId: string;
  readonly lane: Lane;
  readonly cost: number;
  readonly squabble: boolean;
  readonly preview: Match;
};

export type BalancePolicyContext = {
  readonly match: Match;
  readonly owner: Owner;
  readonly legalPlays: readonly BalancePlayOption[];
  readonly actionIndex: number;
  readonly seed: string;
  readonly evaluate: (state: Match, owner: Owner) => number;
};

export type BalancePolicy = (context: BalancePolicyContext) => BalancePlayOption | null;

export type BalanceSimulationOptions = {
  readonly policy?: BalancePolicy;
  readonly allowSquabble?: boolean;
  readonly maxPlays?: number;
};

export type BalanceMatchInput = BalanceSimulationOptions & {
  readonly deckA: BalanceDeck;
  readonly deckB: BalanceDeck;
  readonly districtSeed: string;
  readonly rotation: number;
  readonly tier: BalanceTier;
  readonly seat: BalanceSeat;
};

export type BalanceCardObservation = {
  readonly cardId: string;
  readonly played: number;
  readonly abilityTriggers: number;
  readonly abilitySuccesses: number;
  readonly finalCopies: number;
  readonly finalPower: number;
  readonly squabbles: number;
};

export type BalanceMatchResult = {
  readonly districtSeed: string;
  readonly districtIds: readonly string[];
  readonly rotation: number;
  readonly tier: BalanceTier;
  readonly seat: BalanceSeat;
  readonly deckAId: string;
  readonly deckBId: string;
  readonly playerDeckId: string;
  readonly cpuDeckId: string;
  readonly winner: Owner | 'draw';
  readonly logicalWinner: 'a' | 'b' | 'draw';
  readonly playerDistricts: number;
  readonly cpuDistricts: number;
  readonly laneMargins: readonly number[];
  readonly plays: number;
  readonly passes: number;
  readonly effectEvents: number;
  readonly cardsA: readonly BalanceCardObservation[];
  readonly cardsB: readonly BalanceCardObservation[];
};

export type BalanceMatrixConfig = BalanceSimulationOptions & {
  readonly id: string;
  readonly decks: readonly BalanceDeck[];
  readonly districtSeeds: readonly string[];
  readonly rotations: readonly number[];
  readonly tiers: readonly BalanceTier[];
  readonly includeMirrors?: boolean;
  readonly minimumSampleSize?: number;
  readonly onProgress?: (completed: number, total: number) => void;
};

export type BalanceRate = {
  readonly games: number;
  readonly wins: number;
  readonly losses: number;
  readonly draws: number;
  readonly scoreRate: number;
};

export type BalanceDeckSummary = BalanceRate & {
  readonly deckId: string;
  readonly deckName: string;
  readonly asPlayerGames: number;
  readonly asPlayerScoreRate: number;
  readonly asCpuGames: number;
  readonly asCpuScoreRate: number;
};

export type BalanceMatchupSummary = {
  readonly deckAId: string;
  readonly deckBId: string;
  readonly tier: BalanceTier;
  readonly games: number;
  readonly deckAScoreRate: number;
  readonly playerSeatScoreRate: number;
};

export type BalanceCardSummary = BalanceRate & {
  readonly cardId: string;
  readonly cardName: string;
  readonly appearances: number;
  readonly plays: number;
  readonly playRate: number;
  readonly abilityTriggers: number;
  readonly abilitySuccesses: number;
  readonly abilitySuccessRate: number | null;
  readonly averageFinalPowerWhenPresent: number;
  readonly squabbles: number;
};

export type BalanceFlag = {
  readonly severity: 'review' | 'blocker';
  readonly code: string;
  readonly subject: string;
  readonly message: string;
  readonly value: number;
  readonly threshold: number;
};

export type BalanceFailureScenario = {
  readonly deckAId: string;
  readonly deckBId: string;
  readonly districtSeed: string;
  readonly rotation: number;
  readonly tier: BalanceTier;
  readonly seat: BalanceSeat;
};

export type BalanceFailureSummary = {
  readonly message: string;
  readonly count: number;
  readonly examples: readonly BalanceFailureScenario[];
};

export type BalanceMatrixReport = {
  readonly id: string;
  readonly matchCount: number;
  readonly successfulMatches: number;
  readonly failedMatches: number;
  readonly deckCount: number;
  readonly pairCount: number;
  readonly seat: BalanceRate;
  readonly tiers: readonly (BalanceRate & { readonly tier: BalanceTier })[];
  readonly decks: readonly BalanceDeckSummary[];
  readonly matchups: readonly BalanceMatchupSummary[];
  readonly cards: readonly BalanceCardSummary[];
  readonly failures: readonly BalanceFailureSummary[];
  readonly flags: readonly BalanceFlag[];
};

export type BalanceSwapExperiment = {
  readonly id: string;
  readonly name: string;
  readonly baseDeck: BalanceDeck;
  readonly removeCardId: string;
  readonly addCardId: string;
};

export type BalanceSwapConfig = BalanceSimulationOptions & {
  readonly experiments: readonly BalanceSwapExperiment[];
  readonly opponents: readonly BalanceDeck[];
  readonly districtSeeds: readonly string[];
  readonly rotations: readonly number[];
  readonly tiers: readonly BalanceTier[];
  readonly minimumPairedCases?: number;
};

export type BalanceSwapSummary = {
  readonly id: string;
  readonly name: string;
  readonly removeCardId: string;
  readonly addCardId: string;
  readonly pairedCases: number;
  readonly baselineScoreRate: number;
  readonly candidateScoreRate: number;
  readonly delta: number;
  readonly standardError: number;
  readonly improvedCases: number;
  readonly worsenedCases: number;
  readonly flag: 'none' | 'review' | 'blocker' | 'inconclusive';
};

export type BalanceComboSpec = {
  readonly id: string;
  readonly firstCardId: string;
  readonly echoCardId: 'tayaty';
};

export type BalanceComboProbe = {
  readonly id: string;
  readonly firstCardId: string;
  readonly echoCardId: string;
  readonly owner: Owner;
  readonly tier: BalanceTier;
  readonly motionCost: number;
  readonly firstSwing: number;
  readonly echoSwing: number;
  readonly immediateSwing: number;
  readonly finalSwing: number;
  readonly tokenDelta: number;
  readonly swingPerMotion: number;
  readonly effectNotes: readonly string[];
};

export type BalanceLabReport = {
  readonly schemaVersion: typeof BALANCE_LAB_SCHEMA_VERSION;
  readonly mode: BalanceLabMode;
  readonly deterministicFingerprint: string;
  readonly configuration: {
    readonly decks: readonly string[];
    readonly districtSeeds: number;
    readonly rotations: readonly number[];
    readonly tiers: readonly BalanceTier[];
    readonly allowSquabble: boolean;
  };
  readonly humanPlaytest: {
    readonly status: 'pending';
    readonly protocol: 'scripts/BALANCE_PLAYTEST.md';
  };
  readonly matrix: BalanceMatrixReport;
  readonly swaps: readonly BalanceSwapSummary[];
  readonly policySensitivity: readonly BalancePolicySensitivity[];
  readonly combos: readonly BalanceComboProbe[];
  readonly flags: readonly BalanceFlag[];
};

export type BalancePolicySensitivity = {
  readonly policy: string;
  readonly pairedCases: number;
  readonly swaps: readonly BalanceSwapSummary[];
  readonly playerSeatScoreRate: number;
};

const LANES: readonly Lane[] = [0, 1, 2];
const PREVENTED_CARD_OUTCOME_NOTE = /\b(?:blocked (?:a |the )?(?:targeted effect|targeted hostile ability|movement)|cannot be moved|no effect)\b/i;
const NON_MUTATING_ABILITY_SUCCESS_NOTE = /\b(?:Network Boost watches|Follower Frenzy armed|Guest List revealed)\b/i;
const SWAP_REVIEW_DELTA = 0.05;
const SWAP_BLOCKER_DELTA = 0.08;

function comparableAbilityCard(card: CardInstance | undefined): Omit<CardInstance, 'lastEffectNote'> | null {
  if (!card) return null;
  const { lastEffectNote: _lastEffectNote, ...mechanicalState } = card;
  return mechanicalState;
}

/**
 * Classify ability success from the authoritative event delta rather than presentation copy.
 * This keeps true fallback effects successful while rejecting notes that describe an attempted
 * ability with no mechanical result (for example, no status to cleanse or no ally to support).
 */
export function isSuccessfulBalanceAbilityEvent(event: EffectLogEntry): boolean {
  if (event.type !== 'ability') return false;
  if (event.abilityMetadata?.result === 'applied') return true;

  const beforeCards = new Map(event.replay.before.boards.flat().map((card) => [card.instanceId, card]));
  const afterCards = new Map(event.replay.after.boards.flat().map((card) => [card.instanceId, card]));
  const cardIds = new Set([...beforeCards.keys(), ...afterCards.keys()]);
  for (const cardId of cardIds) {
    const before = beforeCards.get(cardId);
    const after = afterCards.get(cardId);
    if (after && PREVENTED_CARD_OUTCOME_NOTE.test(after.lastEffectNote)) continue;
    if (JSON.stringify(comparableAbilityCard(before)) !== JSON.stringify(comparableAbilityCard(after))) return true;
  }

  if (event.resources.before.playerMotion !== event.resources.after.playerMotion
      || event.resources.before.cpuMotion !== event.resources.after.cpuMotion) return true;
  if (JSON.stringify(event.replay.before.cheapBuffsUsed) !== JSON.stringify(event.replay.after.cheapBuffsUsed)) return true;

  const beforeDiscounts = new Set(event.replay.before.discountTokens.map((token) => token.id));
  if (event.replay.after.discountTokens.some((token) => !beforeDiscounts.has(token.id))) return true;
  const beforeTimedEffects = new Set(event.replay.before.timedEffects.map((effect) => effect.id));
  if (event.replay.after.timedEffects.some((effect) => !beforeTimedEffects.has(effect.id))) return true;

  return NON_MUTATING_ABILITY_SUCCESS_NOTE.test(event.note);
}

function hashSeed(value: string): number {
  let state = 2166136261;
  for (const character of value) state = Math.imul(state ^ character.charCodeAt(0), 16777619) >>> 0;
  return state;
}

function nextRandom(state: number): number {
  return (Math.imul(state, 1664525) + 1013904223) >>> 0;
}

export function seededDeckRotation(cardIds: readonly string[], seed: string, rotation: number): string[] {
  if (cardIds.length !== 10 || new Set(cardIds).size !== 10) throw new Error('Balance decks must contain ten unique cards');
  const ordered = [...cardIds];
  let state = hashSeed(seed);
  for (let index = ordered.length - 1; index > 0; index -= 1) {
    state = nextRandom(state);
    const other = Math.floor((state / 4294967296) * (index + 1));
    [ordered[index], ordered[other]] = [ordered[other], ordered[index]];
  }
  const offset = ((Math.floor(rotation) % ordered.length) + ordered.length) % ordered.length;
  return [...ordered.slice(offset), ...ordered.slice(0, offset)];
}

function validateBalanceDeck(deck: BalanceDeck): void {
  if (!deck.id.trim()) throw new Error('Balance deck IDs cannot be empty');
  if (deck.cardIds.length !== 10 || new Set(deck.cardIds).size !== 10) throw new Error(`${deck.id} must contain ten unique cards`);
  const unknown = deck.cardIds.filter((cardId) => !cards[cardId]);
  if (unknown.length) throw new Error(`${deck.id} contains unknown cards: ${unknown.join(', ')}`);
}

function progressionFor(cardIds: readonly string[], tier: BalanceTier) {
  if (tier === 0) return {};
  return Object.fromEntries(cardIds.map((cardId) => [cardId, { xp: 2800, level: 8, moveTier: 3 }]));
}

function opponentOf(owner: Owner): Owner {
  return owner === 'player' ? 'cpu' : 'player';
}

function ownerHand(match: Match, owner: Owner): readonly CardInstance[] {
  return owner === 'player' ? match.playerHand : match.cpuHand;
}

function ownerMotion(match: Match, owner: Owner): number {
  return owner === 'player' ? match.playerMotion : match.cpuMotion;
}

function ownerSquabbleAvailable(match: Match, owner: Owner): boolean {
  if (match.squabbleByOwner) return !match.squabbleByOwner[owner];
  return owner === 'player' && !match.squabbleUsed;
}

/** A side-neutral state evaluator. It reads only public board state and applies identical weights to either owner. */
export function evaluateBalanceState(match: Match, owner: Owner): number {
  const opponent = opponentOf(owner);
  const results = getDistrictResults(match);
  const control = results.reduce((sum, result) => {
    const ownerScore = owner === 'player' ? result.player : result.cpu;
    const opponentScore = owner === 'player' ? result.cpu : result.player;
    return sum + (ownerScore > opponentScore ? 1 : ownerScore < opponentScore ? -1 : 0);
  }, 0);
  const margins = results.reduce((sum, result) => {
    const lead = owner === 'player' ? result.player - result.cpu : result.cpu - result.player;
    return sum + 12 * lead / (4 + Math.abs(lead));
  }, 0);
  const cardsInPlay = match.boards.flat();
  const statusValue = cardsInPlay.reduce((sum, card) => {
    const sign = card.owner === owner ? 1 : -1;
    const positive = (card.statuses.protected ? 0.6 : 0) + (card.statuses.uncounterable ? 0.35 : 0) + (card.statuses.boosted ? 0.25 : 0);
    const negative = (card.statuses.frozen ? 0.8 : 0) + (card.statuses.silenced ? 0.35 : 0)
      + (card.statuses.weakened ? 0.3 : 0) + (card.statuses.locked ? 0.25 : 0) + Math.min(3, card.statuses.burnStacks) * 0.3;
    return sum + sign * (positive - negative);
  }, 0);
  const setupValue = (side: Owner) => {
    const active = cardsInPlay.filter((card) => card.owner === side && !card.statuses.frozen && !card.statuses.silenced);
    const hand = ownerHand(match, side);
    const cheapCards = hand.filter((card) => card.cost <= 2).length;
    return active.reduce((sum, card) => sum
      + (card.cardId === 'streamer' ? Math.max(0, 2 - match.cheapBuffsUsed[side]) * Math.min(2, cheapCards) * 0.25 : 0)
      + (card.cardId === 'bossbabe' ? Math.max(0, 2 - (card.networkBoosts ?? 0)) * 0.25 : 0)
      + (card.elementalBond ? 0.2 : 0), 0)
      + match.discountTokens.filter((token) => token.owner === side).length * 0.45;
  };
  const motionValue = match.round < 6 ? (ownerMotion(match, owner) - ownerMotion(match, opponent)) * 0.12 : 0;
  const squabbleValue = match.round < 6
    ? (ownerSquabbleAvailable(match, owner) ? 1.25 : 0) - (ownerSquabbleAvailable(match, opponent) ? 1.25 : 0)
    : 0;
  return control * 15 + margins + statusValue + setupValue(owner) - setupValue(opponent) + motionValue + squabbleValue;
}

export function listLegalBalancePlays(match: Match, owner: Owner, allowSquabble = true): BalancePlayOption[] {
  const result: BalancePlayOption[] = [];
  for (const card of ownerHand(match, owner)) {
    for (const targetLane of LANES) {
      if (!canAffordSelection(match, owner, card.instanceId, targetLane)) continue;
      const cost = getLegalCardCost(match, owner, card, targetLane);
      result.push({
        instanceId: card.instanceId,
        cardId: card.cardId,
        lane: targetLane,
        cost,
        squabble: false,
        preview: playTurnCard(match, owner, card.instanceId, targetLane, false),
      });
      if (allowSquabble && ownerSquabbleAvailable(match, owner)) result.push({
        instanceId: card.instanceId,
        cardId: card.cardId,
        lane: targetLane,
        cost,
        squabble: true,
        preview: playTurnCard(match, owner, card.instanceId, targetLane, true),
      });
    }
  }
  return result;
}

/** Greedy and deliberately transparent: one public-state play ahead with stable tie-breaking. */
export const greedyBalancePolicy: BalancePolicy = ({ match, owner, legalPlays, evaluate }) => {
  if (!legalPlays.length) return null;
  const baseline = evaluate(match, owner);
  const ranked = legalPlays.map((option) => ({ option, score: evaluate(option.preview, owner) }))
    .sort((left, right) => right.score - left.score
      || left.option.cost - right.option.cost
      || Number(left.option.squabble) - Number(right.option.squabble)
      || left.option.cardId.localeCompare(right.option.cardId)
      || left.option.lane - right.option.lane);
  return ranked[0].score > baseline + 0.05 ? ranked[0].option : null;
};

/** Deterministic low-information baseline used to expose policy-sensitive results. */
export const firstLegalBalancePolicy: BalancePolicy = ({ legalPlays }) =>
  legalPlays.find((option) => !option.squabble) ?? legalPlays[0] ?? null;

/** A reproducible tie-shuffled policy, deliberately independent of card strength. */
export const seededLegalBalancePolicy: BalancePolicy = ({ legalPlays, seed, actionIndex }) => {
  if (!legalPlays.length) return null;
  const index = hashSeed(`${seed}:legal:${actionIndex}`) % legalPlays.length;
  return legalPlays[index];
};

function cardObservations(match: Match, owner: Owner, deck: BalanceDeck): BalanceCardObservation[] {
  const byId = new Map(deck.cardIds.map((cardId) => [cardId, {
    cardId,
    played: 0,
    abilityTriggers: 0,
    abilitySuccesses: 0,
    finalCopies: 0,
    finalPower: 0,
    squabbles: 0,
  }]));
  for (const event of match.effectLog) {
    if (event.owner !== owner || !event.cardId || !byId.has(event.cardId)) continue;
    const observed = byId.get(event.cardId)!;
    if (event.type === 'play') {
      observed.played += 1;
      if (/SQUABBLE/i.test(event.note)) observed.squabbles += 1;
    }
    if (event.type === 'ability') {
      observed.abilityTriggers += 1;
      if (isSuccessfulBalanceAbilityEvent(event)) observed.abilitySuccesses += 1;
    }
  }
  for (const card of match.boards.flat().filter((item) => item.owner === owner && byId.has(item.cardId))) {
    const observed = byId.get(card.cardId)!;
    observed.finalCopies += 1;
    observed.finalPower += getEffectiveCardPower(card);
  }
  return [...byId.values()].sort((left, right) => left.cardId.localeCompare(right.cardId));
}

function orderedDeck(deck: BalanceDeck, districtSeed: string, rotation: number, role: 'a' | 'b'): string[] {
  return seededDeckRotation(deck.cardIds, `${districtSeed}:${role}:${deck.orderKey ?? deck.id}`, rotation);
}

export function simulateBalanceMatch(input: BalanceMatchInput): BalanceMatchResult {
  validateBalanceDeck(input.deckA);
  validateBalanceDeck(input.deckB);
  const orderA = orderedDeck(input.deckA, input.districtSeed, input.rotation, 'a');
  const orderB = orderedDeck(input.deckB, input.districtSeed, input.rotation, 'b');
  const aOwner: Owner = input.seat === 'a-player' ? 'player' : 'cpu';
  const playerDeck = aOwner === 'player' ? input.deckA : input.deckB;
  const cpuDeck = aOwner === 'cpu' ? input.deckA : input.deckB;
  const playerCards = aOwner === 'player' ? orderA : orderB;
  const cpuCards = aOwner === 'cpu' ? orderA : orderB;
  const snapshot = createAbilityUpgradeSnapshot(playerCards, cpuCards, {
    player: progressionFor(playerCards, input.tier),
    cpu: progressionFor(cpuCards, input.tier),
  });
  let match = createMatchFromEngineCards(
    playerDeck.id,
    playerCards,
    cpuDeck.id,
    cpuCards,
    undefined,
    undefined,
    snapshot,
    createDistrictSnapshot(input.districtSeed),
  );
  const allowSquabble = input.allowSquabble ?? true;
  if (allowSquabble) match = { ...match, squabbleByOwner: { player: false, cpu: false } };
  const policy = input.policy ?? greedyBalancePolicy;
  const maxPlays = input.maxPlays ?? 64;
  let playCount = 0;
  let actionIndex = 0;
  while (match.phase !== 'complete') {
    if (match.phase === 'resolved') {
      match = nextRound(match);
      continue;
    }
    const owner: Owner = match.phase === 'player' ? 'player' : 'cpu';
    const legalPlays = listLegalBalancePlays(match, owner, allowSquabble);
    const chosen = policy({
      match,
      owner,
      legalPlays,
      actionIndex,
      seed: `${input.districtSeed}:${input.rotation}:${input.tier}:${input.seat}`,
      evaluate: evaluateBalanceState,
    });
    actionIndex += 1;
    if (!chosen) {
      match = pass(match, owner);
      continue;
    }
    const canonical = legalPlays.find((option) => option.instanceId === chosen.instanceId
      && option.lane === chosen.lane && option.squabble === chosen.squabble);
    if (!canonical) throw new Error(`Balance policy returned an illegal ${owner} play`);
    match = canonical.preview;
    playCount += 1;
    if (playCount > maxPlays) throw new Error(`Balance simulation exceeded ${maxPlays} plays`);
  }
  const winner = getMatchWinner(match);
  if (!winner) throw new Error('Completed balance match has no winner');
  const logicalWinner = winner === 'draw' ? 'draw' : winner === aOwner ? 'a' : 'b';
  const districtResults = getDistrictResults(match);
  const bOwner = opponentOf(aOwner);
  return {
    districtSeed: input.districtSeed,
    districtIds: match.districtSnapshot?.locations.map((location) => location.id) ?? [],
    rotation: input.rotation,
    tier: input.tier,
    seat: input.seat,
    deckAId: input.deckA.id,
    deckBId: input.deckB.id,
    playerDeckId: playerDeck.id,
    cpuDeckId: cpuDeck.id,
    winner,
    logicalWinner,
    playerDistricts: districtResults.filter((result) => result.winner === 'player').length,
    cpuDistricts: districtResults.filter((result) => result.winner === 'cpu').length,
    laneMargins: districtResults.map((result) => result.player - result.cpu),
    plays: match.effectLog.filter((event) => event.type === 'play').length,
    passes: match.effectLog.filter((event) => event.type === 'pass').length,
    effectEvents: match.effectLog.length,
    cardsA: cardObservations(match, aOwner, input.deckA),
    cardsB: cardObservations(match, bOwner, input.deckB),
  };
}

type MutableRate = { games: number; wins: number; losses: number; draws: number; points: number };
type MutableDeckSummary = MutableRate & {
  deckId: string;
  deckName: string;
  asPlayerGames: number;
  asPlayerPoints: number;
  asCpuGames: number;
  asCpuPoints: number;
};
type MutableMatchupSummary = {
  deckAId: string;
  deckBId: string;
  tier: BalanceTier;
  games: number;
  deckAPoints: number;
  playerPoints: number;
};
type MutableCardSummary = MutableRate & {
  cardId: string;
  appearances: number;
  plays: number;
  abilityTriggers: number;
  abilitySuccesses: number;
  finalPower: number;
  finalCopies: number;
  squabbles: number;
};

function emptyRate(): MutableRate {
  return { games: 0, wins: 0, losses: 0, draws: 0, points: 0 };
}

function addOutcome(rate: MutableRate, outcome: 'win' | 'loss' | 'draw'): void {
  rate.games += 1;
  if (outcome === 'win') {
    rate.wins += 1;
    rate.points += 1;
  } else if (outcome === 'loss') rate.losses += 1;
  else {
    rate.draws += 1;
    rate.points += 0.5;
  }
}

function asRate(rate: MutableRate): BalanceRate {
  return {
    games: rate.games,
    wins: rate.wins,
    losses: rate.losses,
    draws: rate.draws,
    scoreRate: rate.games ? rate.points / rate.games : 0,
  };
}

function logicalOutcome(winner: BalanceMatchResult['logicalWinner'], side: 'a' | 'b'): 'win' | 'loss' | 'draw' {
  return winner === 'draw' ? 'draw' : winner === side ? 'win' : 'loss';
}

function addCardObservation(
  summaries: Map<string, MutableCardSummary>,
  observation: BalanceCardObservation,
  outcome: 'win' | 'loss' | 'draw',
): void {
  const current = summaries.get(observation.cardId) ?? {
    ...emptyRate(), cardId: observation.cardId, appearances: 0, plays: 0,
    abilityTriggers: 0, abilitySuccesses: 0, finalPower: 0, finalCopies: 0, squabbles: 0,
  };
  addOutcome(current, outcome);
  current.appearances += 1;
  current.plays += observation.played;
  current.abilityTriggers += observation.abilityTriggers;
  current.abilitySuccesses += observation.abilitySuccesses;
  current.finalPower += observation.finalPower;
  current.finalCopies += observation.finalCopies;
  current.squabbles += observation.squabbles;
  summaries.set(observation.cardId, current);
}

export function countBalanceMatrixMatches(config: BalanceMatrixConfig): number {
  const deckCount = config.decks.length;
  const pairs = config.includeMirrors === false ? deckCount * (deckCount - 1) / 2 : deckCount * (deckCount + 1) / 2;
  return pairs * config.districtSeeds.length * config.rotations.length * config.tiers.length * 2;
}

export function runBalanceMatrix(config: BalanceMatrixConfig): BalanceMatrixReport {
  if (config.decks.length < 2) throw new Error('A balance matrix needs at least two decks');
  config.decks.forEach(validateBalanceDeck);
  if (!config.districtSeeds.length || !config.rotations.length || !config.tiers.length) throw new Error('Balance matrix axes cannot be empty');
  const deckSummaries = new Map<string, MutableDeckSummary>();
  for (const deck of config.decks) deckSummaries.set(deck.id, {
    ...emptyRate(), deckId: deck.id, deckName: deck.name,
    asPlayerGames: 0, asPlayerPoints: 0, asCpuGames: 0, asCpuPoints: 0,
  });
  const matchups = new Map<string, MutableMatchupSummary>();
  const cardsById = new Map<string, MutableCardSummary>();
  const seat = emptyRate();
  const tiers = new Map<BalanceTier, MutableRate>(config.tiers.map((tier) => [tier, emptyRate()]));
  const failures = new Map<string, { message: string; count: number; examples: BalanceFailureScenario[] }>();
  const total = countBalanceMatrixMatches(config);
  let completed = 0;
  let successfulMatches = 0;
  let pairCount = 0;

  for (let aIndex = 0; aIndex < config.decks.length; aIndex += 1) {
    const firstB = config.includeMirrors === false ? aIndex + 1 : aIndex;
    for (let bIndex = firstB; bIndex < config.decks.length; bIndex += 1) {
      const deckA = config.decks[aIndex];
      const deckB = config.decks[bIndex];
      pairCount += 1;
      for (const tier of config.tiers) for (const districtSeed of config.districtSeeds) for (const rotation of config.rotations) {
        for (const matchSeat of ['a-player', 'b-player'] as const) {
          let result: BalanceMatchResult;
          try {
            result = simulateBalanceMatch({
              deckA, deckB, districtSeed, rotation, tier, seat: matchSeat,
              policy: config.policy, allowSquabble: config.allowSquabble, maxPlays: config.maxPlays,
            });
          } catch (error: unknown) {
            completed += 1;
            const message = error instanceof Error ? error.message : String(error);
            const failure = failures.get(message) ?? { message, count: 0, examples: [] };
            failure.count += 1;
            if (failure.examples.length < 8) failure.examples.push({
              deckAId: deckA.id, deckBId: deckB.id, districtSeed, rotation, tier, seat: matchSeat,
            });
            failures.set(message, failure);
            if (completed % 250 === 0 || completed === total) config.onProgress?.(completed, total);
            continue;
          }
          completed += 1;
          successfulMatches += 1;
          const outcomeA = logicalOutcome(result.logicalWinner, 'a');
          const outcomeB = logicalOutcome(result.logicalWinner, 'b');
          const summaryA = deckSummaries.get(deckA.id)!;
          const summaryB = deckSummaries.get(deckB.id)!;
          addOutcome(summaryA, outcomeA);
          addOutcome(summaryB, outcomeB);
          if (matchSeat === 'a-player') {
            summaryA.asPlayerGames += 1;
            summaryA.asPlayerPoints += outcomeA === 'win' ? 1 : outcomeA === 'draw' ? 0.5 : 0;
            summaryB.asCpuGames += 1;
            summaryB.asCpuPoints += outcomeB === 'win' ? 1 : outcomeB === 'draw' ? 0.5 : 0;
          } else {
            summaryA.asCpuGames += 1;
            summaryA.asCpuPoints += outcomeA === 'win' ? 1 : outcomeA === 'draw' ? 0.5 : 0;
            summaryB.asPlayerGames += 1;
            summaryB.asPlayerPoints += outcomeB === 'win' ? 1 : outcomeB === 'draw' ? 0.5 : 0;
          }
          const playerOutcome = result.winner === 'draw' ? 'draw' : result.winner === 'player' ? 'win' : 'loss';
          addOutcome(seat, playerOutcome);
          addOutcome(tiers.get(tier)!, playerOutcome);
          const matchupKey = `${deckA.id}\u0000${deckB.id}\u0000${tier}`;
          const matchup = matchups.get(matchupKey) ?? {
            deckAId: deckA.id, deckBId: deckB.id, tier, games: 0, deckAPoints: 0, playerPoints: 0,
          };
          matchup.games += 1;
          matchup.deckAPoints += outcomeA === 'win' ? 1 : outcomeA === 'draw' ? 0.5 : 0;
          matchup.playerPoints += playerOutcome === 'win' ? 1 : playerOutcome === 'draw' ? 0.5 : 0;
          matchups.set(matchupKey, matchup);
          result.cardsA.forEach((observation) => addCardObservation(cardsById, observation, outcomeA));
          result.cardsB.forEach((observation) => addCardObservation(cardsById, observation, outcomeB));
          if (completed % 250 === 0 || completed === total) config.onProgress?.(completed, total);
        }
      }
    }
  }

  const deckReports: BalanceDeckSummary[] = [...deckSummaries.values()].map((summary) => ({
    ...asRate(summary),
    deckId: summary.deckId,
    deckName: summary.deckName,
    asPlayerGames: summary.asPlayerGames,
    asPlayerScoreRate: summary.asPlayerGames ? summary.asPlayerPoints / summary.asPlayerGames : 0,
    asCpuGames: summary.asCpuGames,
    asCpuScoreRate: summary.asCpuGames ? summary.asCpuPoints / summary.asCpuGames : 0,
  })).sort((left, right) => right.scoreRate - left.scoreRate || left.deckId.localeCompare(right.deckId));
  const matchupReports: BalanceMatchupSummary[] = [...matchups.values()].map((summary) => ({
    deckAId: summary.deckAId,
    deckBId: summary.deckBId,
    tier: summary.tier,
    games: summary.games,
    deckAScoreRate: summary.games ? summary.deckAPoints / summary.games : 0,
    playerSeatScoreRate: summary.games ? summary.playerPoints / summary.games : 0,
  })).sort((left, right) => left.deckAId.localeCompare(right.deckAId)
    || left.deckBId.localeCompare(right.deckBId) || left.tier - right.tier);
  const cardReports: BalanceCardSummary[] = [...cardsById.values()].map((summary) => ({
    ...asRate(summary),
    cardId: summary.cardId,
    cardName: cards[summary.cardId]?.name ?? summary.cardId,
    appearances: summary.appearances,
    plays: summary.plays,
    playRate: summary.appearances ? summary.plays / summary.appearances : 0,
    abilityTriggers: summary.abilityTriggers,
    abilitySuccesses: summary.abilitySuccesses,
    abilitySuccessRate: summary.abilityTriggers ? summary.abilitySuccesses / summary.abilityTriggers : null,
    averageFinalPowerWhenPresent: summary.finalCopies ? summary.finalPower / summary.finalCopies : 0,
    squabbles: summary.squabbles,
  })).sort((left, right) => left.cardId.localeCompare(right.cardId));

  const minimumSampleSize = config.minimumSampleSize ?? 16;
  const flags: BalanceFlag[] = [];
  const failureReports: BalanceFailureSummary[] = [...failures.values()]
    .map((failure) => ({ message: failure.message, count: failure.count, examples: failure.examples }))
    .sort((left, right) => right.count - left.count || left.message.localeCompare(right.message));
  for (const failure of failureReports) flags.push({
    severity: 'blocker', code: 'engine-simulation-failure', subject: failure.examples[0]
      ? `${failure.examples[0].deckAId} vs ${failure.examples[0].deckBId}` : 'unknown',
    message: `${failure.count} deterministic match${failure.count === 1 ? '' : 'es'} failed: ${failure.message}`,
    value: failure.count, threshold: 0,
  });
  for (const deck of deckReports) if (deck.games >= minimumSampleSize && (deck.scoreRate < 0.4 || deck.scoreRate > 0.6)) {
    const distance = Math.abs(deck.scoreRate - 0.5);
    flags.push({ severity: distance > 0.15 ? 'blocker' : 'review', code: 'deck-win-band', subject: deck.deckId,
      message: `${deck.deckName} scored ${(deck.scoreRate * 100).toFixed(1)}% across the matrix.`, value: deck.scoreRate, threshold: distance > 0.15 ? 0.35 : 0.4 });
  }
  if (seat.games >= minimumSampleSize && Math.abs(seat.points / seat.games - 0.5) > 0.05) {
    const value = seat.points / seat.games;
    flags.push({ severity: Math.abs(value - 0.5) > 0.08 ? 'blocker' : 'review', code: 'seat-advantage', subject: 'player-seat',
      message: `The player seat scored ${(value * 100).toFixed(1)}%.`, value, threshold: Math.abs(value - 0.5) > 0.08 ? 0.58 : 0.55 });
  }
  for (const matchup of matchupReports) {
    if (matchup.games < minimumSampleSize || matchup.deckAId === matchup.deckBId) continue;
    const distance = Math.abs(matchup.deckAScoreRate - 0.5);
    if (distance > 0.15) flags.push({ severity: distance > 0.2 ? 'blocker' : 'review', code: 'matchup-polarity',
      subject: `${matchup.deckAId} vs ${matchup.deckBId} @ tier ${matchup.tier}`,
      message: `Deck A scored ${(matchup.deckAScoreRate * 100).toFixed(1)}% in this matchup.`, value: matchup.deckAScoreRate, threshold: distance > 0.2 ? 0.7 : 0.65 });
  }
  for (const matchup of matchupReports.filter((item) => item.deckAId === item.deckBId && item.games >= minimumSampleSize)) {
    if (Math.abs(matchup.playerSeatScoreRate - 0.5) > 0.03) flags.push({
      severity: Math.abs(matchup.playerSeatScoreRate - 0.5) > 0.05 ? 'blocker' : 'review',
      code: 'mirror-seat-advantage', subject: `${matchup.deckAId} mirror @ tier ${matchup.tier}`,
      message: `The player seat scored ${(matchup.playerSeatScoreRate * 100).toFixed(1)}% in the mirror.`,
      value: matchup.playerSeatScoreRate, threshold: Math.abs(matchup.playerSeatScoreRate - 0.5) > 0.05 ? 0.55 : 0.53,
    });
  }
  for (const card of cardReports) {
    if (card.appearances >= minimumSampleSize && card.playRate < 0.35) flags.push({ severity: 'review', code: 'low-play-rate', subject: card.cardId,
      message: `${card.cardName} was played in ${(card.playRate * 100).toFixed(1)}% of appearances.`, value: card.playRate, threshold: 0.35 });
    if (card.abilityTriggers >= minimumSampleSize && card.abilitySuccessRate !== null && card.abilitySuccessRate < 0.3) flags.push({
      severity: 'review', code: 'low-ability-success', subject: card.cardId,
      message: `${card.cardName}'s observed ability events succeeded ${(card.abilitySuccessRate * 100).toFixed(1)}% of the time.`,
      value: card.abilitySuccessRate, threshold: 0.3,
    });
  }

  return {
    id: config.id,
    matchCount: completed,
    successfulMatches,
    failedMatches: completed - successfulMatches,
    deckCount: config.decks.length,
    pairCount,
    seat: asRate(seat),
    tiers: [...tiers.entries()].map(([tier, rate]) => ({ tier, ...asRate(rate) })).sort((left, right) => left.tier - right.tier),
    decks: deckReports,
    matchups: matchupReports,
    cards: cardReports,
    failures: failureReports,
    flags: flags.sort((left, right) => left.severity.localeCompare(right.severity) || left.code.localeCompare(right.code) || left.subject.localeCompare(right.subject)),
  };
}

function swappedDeck(experiment: BalanceSwapExperiment, candidate: boolean): BalanceDeck {
  validateBalanceDeck(experiment.baseDeck);
  if (!experiment.baseDeck.cardIds.includes(experiment.removeCardId)) throw new Error(`${experiment.id} does not contain ${experiment.removeCardId}`);
  if (experiment.baseDeck.cardIds.includes(experiment.addCardId)) throw new Error(`${experiment.id} already contains ${experiment.addCardId}`);
  if (!cards[experiment.addCardId]) throw new Error(`${experiment.id} references unknown card ${experiment.addCardId}`);
  const cardIds = experiment.baseDeck.cardIds.map((cardId) => candidate && cardId === experiment.removeCardId ? experiment.addCardId : cardId);
  return {
    id: `${experiment.id}:${candidate ? 'candidate' : 'baseline'}`,
    name: `${experiment.name} ${candidate ? 'candidate' : 'baseline'}`,
    cardIds,
    orderKey: experiment.id,
  };
}

function outcomePoint(winner: BalanceMatchResult['logicalWinner']): number {
  return winner === 'a' ? 1 : winner === 'draw' ? 0.5 : 0;
}

export function runPairedCardSwaps(config: BalanceSwapConfig): BalanceSwapSummary[] {
  const summaries: BalanceSwapSummary[] = [];
  for (const experiment of config.experiments) {
    const baseline = swappedDeck(experiment, false);
    const candidate = swappedDeck(experiment, true);
    const deltas: number[] = [];
    let baselinePoints = 0;
    let candidatePoints = 0;
    let improvedCases = 0;
    let worsenedCases = 0;
    for (const opponent of config.opponents) for (const tier of config.tiers) for (const districtSeed of config.districtSeeds) for (const rotation of config.rotations) {
      for (const seat of ['a-player', 'b-player'] as const) {
        const common = { deckB: opponent, districtSeed, rotation, tier, seat, policy: config.policy,
          allowSquabble: config.allowSquabble, maxPlays: config.maxPlays };
        const baselineResult = simulateBalanceMatch({ ...common, deckA: baseline });
        const candidateResult = simulateBalanceMatch({ ...common, deckA: candidate });
        const baselinePoint = outcomePoint(baselineResult.logicalWinner);
        const candidatePoint = outcomePoint(candidateResult.logicalWinner);
        const delta = candidatePoint - baselinePoint;
        baselinePoints += baselinePoint;
        candidatePoints += candidatePoint;
        deltas.push(delta);
        if (delta > 0) improvedCases += 1;
        if (delta < 0) worsenedCases += 1;
      }
    }
    const pairedCases = deltas.length;
    const mean = pairedCases ? deltas.reduce((sum, delta) => sum + delta, 0) / pairedCases : 0;
    const variance = pairedCases > 1
      ? deltas.reduce((sum, delta) => sum + (delta - mean) ** 2, 0) / (pairedCases - 1)
      : 0;
    const absoluteDelta = Math.abs(mean);
    const minimumPairedCases = config.minimumPairedCases ?? 32;
    summaries.push({
      id: experiment.id,
      name: experiment.name,
      removeCardId: experiment.removeCardId,
      addCardId: experiment.addCardId,
      pairedCases,
      baselineScoreRate: pairedCases ? baselinePoints / pairedCases : 0,
      candidateScoreRate: pairedCases ? candidatePoints / pairedCases : 0,
      delta: mean,
      standardError: pairedCases ? Math.sqrt(variance / pairedCases) : 0,
      improvedCases,
      worsenedCases,
      flag: pairedCases < minimumPairedCases ? 'inconclusive'
        : absoluteDelta > SWAP_BLOCKER_DELTA ? 'blocker'
        : absoluteDelta > SWAP_REVIEW_DELTA ? 'review'
        : 'none',
    });
  }
  return summaries.sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta) || left.id.localeCompare(right.id));
}

const placedCard = (cardId: string, owner: Owner, lane: Lane, index: number): CardInstance => ({
  ...createCardInstance(cardId, owner, 'balance-combo-board', index),
  lane,
  playedRound: 1,
  lastEffectNote: 'Balance combo fixture.',
});

function perspectiveSwing(match: Match, owner: Owner): number {
  return getDistrictResults(match).reduce((sum, result) => sum + (owner === 'player'
    ? result.player - result.cpu
    : result.cpu - result.player), 0);
}

function tokenCount(match: Match, owner: Owner): number {
  return match.boards.flat().filter((card) => card.owner === owner && card.kind === 'token').length;
}

function comboDeck(firstCardId: string): string[] {
  const preferred = [firstCardId, 'tayaty', 'youngbull', 'edgar', 'nguyen', 'pinaynurse'];
  return completeEngineCrew([...new Set(preferred)], ['buspass', 'soulfood', 'cognac', 'bustdown', 'energydrink', 'subwaymap']);
}

export function runHighRiskComboProbe(spec: BalanceComboSpec, tier: BalanceTier, owner: Owner): BalanceComboProbe {
  if (!cards[spec.firstCardId] || !cards[spec.echoCardId]) throw new Error(`${spec.id} references an unknown card`);
  const focalCards = comboDeck(spec.firstCardId);
  const opposingCards = [...decks[0].cards];
  const playerCards = owner === 'player' ? focalCards : opposingCards;
  const cpuCards = owner === 'cpu' ? focalCards : opposingCards;
  const snapshot = createAbilityUpgradeSnapshot(playerCards, cpuCards, {
    player: progressionFor(playerCards, tier),
    cpu: progressionFor(cpuCards, tier),
  });
  let match = createMatchFromEngineCards('combo-player', playerCards, 'combo-cpu', cpuCards, undefined, undefined, snapshot);
  const opponent = opponentOf(owner);
  const ownBoard = [placedCard('bodegacat', owner, 0, 100), placedCard('edgar', owner, 0, 101)];
  const enemyBoard = [placedCard('partytitan', opponent, 0, 200), placedCard('leroy', opponent, 0, 201)];
  const firstIndex = focalCards.indexOf(spec.firstCardId);
  const echoIndex = focalCards.indexOf(spec.echoCardId);
  const hand = [
    createCardInstance(spec.firstCardId, owner, 'balance-combo-hand', firstIndex),
    createCardInstance(spec.echoCardId, owner, 'balance-combo-hand', echoIndex),
  ];
  match = {
    ...match,
    round: 6,
    phase: owner === 'player' ? 'player' : 'cpu-reveal',
    playerHand: owner === 'player' ? hand : [],
    cpuHand: owner === 'cpu' ? hand : [],
    playerMotion: owner === 'player' ? 9 : 0,
    cpuMotion: owner === 'cpu' ? 9 : 0,
    boards: [[...ownBoard, ...enemyBoard], [], []],
    effectLog: [],
    nextEventSequence: 1,
    lastRevealedCardId: null,
    squabbleByOwner: { player: false, cpu: false },
  };
  const beforeSwing = perspectiveSwing(match, owner);
  const beforeTokens = tokenCount(match, owner);
  const firstCard = hand[0];
  const firstCost = getLegalCardCost(match, owner, firstCard, 0);
  match = playTurnCard(match, owner, firstCard.instanceId, 0);
  const afterFirstSwing = perspectiveSwing(match, owner);
  const echoCard = match[owner === 'player' ? 'playerHand' : 'cpuHand'].find((card) => card.cardId === spec.echoCardId)!;
  const echoCost = getLegalCardCost(match, owner, echoCard, 0);
  match = playTurnCard(match, owner, echoCard.instanceId, 0);
  const afterEchoSwing = perspectiveSwing(match, owner);
  const immediate = afterEchoSwing - beforeSwing;
  const effectNotes = match.effectLog.filter((event) => event.type === 'ability' && event.owner === owner).map((event) => event.note);
  match = pass(match, owner);
  if (owner === 'player') match = pass(match, 'cpu');
  match = nextRound(match);
  const finalSwing = perspectiveSwing(match, owner) - beforeSwing;
  const motionCost = firstCost + echoCost;
  return {
    id: spec.id,
    firstCardId: spec.firstCardId,
    echoCardId: spec.echoCardId,
    owner,
    tier,
    motionCost,
    firstSwing: afterFirstSwing - beforeSwing,
    echoSwing: afterEchoSwing - afterFirstSwing,
    immediateSwing: immediate,
    finalSwing,
    tokenDelta: tokenCount(match, owner) - beforeTokens,
    swingPerMotion: motionCost ? finalSwing / motionCost : finalSwing,
    effectNotes,
  };
}

export const HIGH_RISK_COMBOS: readonly BalanceComboSpec[] = [
  { id: 'guap-with-tayaty', firstCardId: 'guap', echoCardId: 'tayaty' },
  { id: 'landlord-with-tayaty', firstCardId: 'landlord', echoCardId: 'tayaty' },
  { id: 'oz-with-tayaty', firstCardId: 'oz', echoCardId: 'tayaty' },
  { id: 'queen-with-tayaty', firstCardId: 'queenofhearts', echoCardId: 'tayaty' },
  { id: 'demario-with-tayaty', firstCardId: 'demario', echoCardId: 'tayaty' },
  { id: 'luigion-with-tayaty', firstCardId: 'luigion', echoCardId: 'tayaty' },
  { id: 'ashlee-into-tayaty', firstCardId: 'ashlee', echoCardId: 'tayaty' },
  { id: 'captain-jigga-into-tayaty', firstCardId: 'captainjigga', echoCardId: 'tayaty' },
  { id: 'counter-into-tayaty', firstCardId: 'counter', echoCardId: 'tayaty' },
  { id: 'roaster-into-tayaty', firstCardId: 'roaster', echoCardId: 'tayaty' },
  { id: 'cornball-into-tayaty', firstCardId: 'cornball', echoCardId: 'tayaty' },
  { id: 'sneaker-into-tayaty', firstCardId: 'sneaker', echoCardId: 'tayaty' },
];

function balanceDeck(id: string, name: string, cardIds: readonly string[]): BalanceDeck {
  const completed = completeEngineCrew(cardIds);
  const deck = { id, name, cardIds: completed } satisfies BalanceDeck;
  validateBalanceDeck(deck);
  return deck;
}

export function createDefaultBalanceDecks(): BalanceDeck[] {
  const starters = decks.map((deck: Deck) => ({ id: `starter-${deck.id}`, name: deck.name, cardIds: [...deck.cards] }));
  return [
    ...starters,
    balanceDeck('focus-wave7-legends', 'Wave 7 Legends', ['ashlee', 'captainjigga', 'counter', 'tayaty', 'youngbull', 'honestthot']),
    balanceDeck('focus-wave7-tempo', 'Wave 7 Tempo', ['tayaty', 'youngbull', 'fein', 'redpill', 'simmy', 'foodz']),
    balanceDeck('focus-air-bond', 'Air Bond', ['honestthot', 'ashlee', 'captainjigga', 'roaster', 'bikelife', 'vibe']),
    balanceDeck('focus-late-scaling', 'Late Scaling', ['alchy', 'icecream', 'waterboy', 'laundry', 'stonersr', 'foodz']),
    balanceDeck('focus-counterplay', 'Counterplay', ['counter', 'stud', 'pinaynurse', 'wifey', 'rastamon', 'gothkid']),
    balanceDeck('focus-earth-tax', 'Earth Tax and Finishers', ['landlord', 'bigzoey', 'stud', 'torta', 'concrete', 'mansamusa', 'johnhenry', 'partytitan', 'asphaltapostle', 'failedathlete']),
    balanceDeck('focus-detective', 'Sherlock and Watson', ['sherlock', 'watson', 'crossingguard', 'nightmedic', 'wifey', 'counter', 'oz', 'rastamon', 'bustdown', 'tinman']),
    balanceDeck('focus-wiz', 'The Wiz Movement', ['dorothy', 'scarecrow', 'tinman', 'oz', 'lion', 'passportbro', 'break', 'bboy', 'ogdominican', 'delivery']),
    balanceDeck('focus-wonderland', 'Wonderland Return', ['alice', 'cheshire', 'watson', 'vibe', 'snow', 'laundry', 'waterboy', 'conductor', 'alchy', 'squabbleserver']),
    balanceDeck('focus-fire-guap', 'Fire and GUAP', ['guap', 'folks', 'hooper', 'bbldemon', 'cornercoach', 'cognac', 'krump', 'dancecaptain', 'og', 'baby']),
    balanceDeck('focus-poison-entry', 'Poison Entry Punishment', ['bottle', 'colognecriminal', 'nail', 'mural', 'fein', 'simmy', 'bbldemon', 'roaster', 'plug', 'wifey']),
    balanceDeck('focus-cellblock', 'Cellblock Lane Sequence', ['inmate-crafty', 'inmate-boyfriend', 'inmate-informant', 'inmate-contraband', 'lebron-james', 'bustdown', 'cognac', 'rastamon', 'wifey', 'stud']),
    balanceDeck('focus-demario-luigion', 'Demario and Luigion', ['demario', 'luigion', 'rastamon', 'vibe', 'plug', 'bustdown', 'soulfood', 'black-cowboy', 'hair-stylist', 'stylist']),
    // Keep the original focus-counterplay shell for historical rule-only comparisons.
    balanceDeck('focus-counterplay-coherent', 'Counterplay — Dark Control', ['counter', 'gamer', 'gothkid', 'nerd', 'redpill', 'buddy', 'wifey', 'pinaynurse', 'plug', 'bustdown']),
  ];
}

function createSwapExperiments(): BalanceSwapExperiment[] {
  return [
    { id: 'ashlee-for-oink', name: 'Ashlee for Officer Oink', baseDeck: balanceDeck('swap-ashlee-shell', 'Ashlee shell', ['oink', 'tayaty', 'youngbull', 'edgar', 'wifey', 'honestthot']), removeCardId: 'oink', addCardId: 'ashlee' },
    { id: 'captain-for-oink', name: 'Captain Jigga for Officer Oink', baseDeck: balanceDeck('swap-captain-shell', 'Captain shell', ['oink', 'tayaty', 'youngbull', 'edgar', 'wifey', 'honestthot']), removeCardId: 'oink', addCardId: 'captainjigga' },
    { id: 'counter-for-nerd', name: 'Counter for Closet Nerd', baseDeck: balanceDeck('swap-counter-shell', 'Counter shell', ['nerd', 'tayaty', 'youngbull', 'wifey', 'rastamon', 'roaster']), removeCardId: 'nerd', addCardId: 'counter' },
    { id: 'tayaty-for-cornball', name: 'Tayaty for Cornball', baseDeck: balanceDeck('swap-tayaty-shell', 'Tayaty shell', ['cornball', 'youngbull', 'roaster', 'counter', 'wifey', 'plug']), removeCardId: 'cornball', addCardId: 'tayaty' },
    { id: 'youngbull-for-plug', name: 'Young Bull for Plug', baseDeck: balanceDeck('swap-youngbull-shell', 'Young Bull shell', ['plug', 'tayaty', 'roaster', 'counter', 'wifey', 'rastamon']), removeCardId: 'plug', addCardId: 'youngbull' },
    { id: 'alchy-for-rastamon', name: 'Alchy for Rastamon', baseDeck: balanceDeck('swap-alchy-shell', 'Alchy shell', ['rastamon', 'icecream', 'waterboy', 'laundry', 'foodz', 'pinaynurse']), removeCardId: 'rastamon', addCardId: 'alchy' },
  ];
}

export function createBalanceMatrixConfig(mode: BalanceLabMode, onProgress?: (completed: number, total: number) => void): BalanceMatrixConfig {
  const allDecks = createDefaultBalanceDecks();
  return mode === 'full' ? {
    id: 'task118-full-v1',
    // Task 118 release coverage: eight affected shells plus three deliberately distinct
    // strong Fire/control/movement benchmarks. Historical shells remain available to
    // targeted experiments but do not make the release gate impractically large.
    decks: [
      allDecks.find((deck) => deck.id === 'focus-earth-tax')!,
      allDecks.find((deck) => deck.id === 'focus-detective')!,
      allDecks.find((deck) => deck.id === 'focus-wiz')!,
      allDecks.find((deck) => deck.id === 'focus-wonderland')!,
      allDecks.find((deck) => deck.id === 'focus-fire-guap')!,
      allDecks.find((deck) => deck.id === 'focus-poison-entry')!,
      allDecks.find((deck) => deck.id === 'focus-cellblock')!,
      allDecks.find((deck) => deck.id === 'focus-demario-luigion')!,
      allDecks.find((deck) => deck.id === 'focus-wave7-legends')!,
      allDecks.find((deck) => deck.id === 'focus-counterplay')!,
      allDecks.find((deck) => deck.id === 'focus-air-bond')!,
    ],
    districtSeeds: ['task118-full-district-00', 'task118-full-district-01'],
    rotations: [0, 5],
    tiers: [0, 3],
    // Compare distinct decks only; both seat assignments below still mirror every pairing.
    includeMirrors: false,
    allowSquabble: true,
    minimumSampleSize: 16,
    onProgress,
  } : {
    id: 'wave7-smoke-v1',
    decks: [allDecks[0], allDecks[3], allDecks[7], allDecks[10]],
    districtSeeds: ['wave7-smoke-district-00', 'wave7-smoke-district-01'],
    rotations: [0, 3],
    tiers: [0, 3],
    includeMirrors: true,
    allowSquabble: true,
    minimumSampleSize: 16,
    onProgress,
  };
}

function reportFingerprint(value: unknown): string {
  return hashSeed(JSON.stringify(value)).toString(16).padStart(8, '0');
}

export function runBalanceLab(mode: BalanceLabMode, onProgress?: (completed: number, total: number) => void): BalanceLabReport {
  const matrixConfig = createBalanceMatrixConfig(mode, onProgress);
  const matrix = runBalanceMatrix(matrixConfig);
  const allDecks = createDefaultBalanceDecks();
  const swapSeeds = mode === 'full' ? matrixConfig.districtSeeds.slice(0, 8) : matrixConfig.districtSeeds.slice(0, 1);
  const swapRotations = mode === 'full' ? matrixConfig.rotations.slice(0, 4) : matrixConfig.rotations.slice(0, 1);
  const opponents = mode === 'full'
    ? [allDecks[0], allDecks[3], allDecks[6]]
    : [allDecks[0]];
  const swaps = runPairedCardSwaps({
    experiments: createSwapExperiments(),
    opponents,
    districtSeeds: swapSeeds,
    rotations: swapRotations,
    tiers: [0, 3],
    allowSquabble: true,
  });
  const sensitivitySeeds = mode === 'full' ? matrixConfig.districtSeeds.slice(0, 2) : matrixConfig.districtSeeds.slice(0, 1);
  const sensitivityRotations = mode === 'full' ? matrixConfig.rotations : matrixConfig.rotations.slice(0, 1);
  const sensitivityExperiments = createSwapExperiments().slice(0, 3);
  const policySensitivity: BalancePolicySensitivity[] = [
    { policy: 'greedy', pairedCases: swaps.reduce((sum, swap) => sum + swap.pairedCases, 0), swaps, playerSeatScoreRate: matrix.seat.scoreRate },
    ...([
      ['first-legal', firstLegalBalancePolicy],
      ['seeded-legal', seededLegalBalancePolicy],
    ] as const).map(([policy, alternate]) => {
      const alternateSwaps = runPairedCardSwaps({
        experiments: sensitivityExperiments,
        opponents: opponents.slice(0, mode === 'full' ? 2 : 1),
        districtSeeds: sensitivitySeeds,
        rotations: sensitivityRotations,
        tiers: [0, 3],
        allowSquabble: false,
        policy: alternate,
      });
      const alternateMatrix = runBalanceMatrix({
        id: `${matrixConfig.id}-${policy}`,
        decks: matrixConfig.decks.slice(0, 4),
        districtSeeds: sensitivitySeeds,
        rotations: sensitivityRotations,
        tiers: [0, 3],
        includeMirrors: true,
        allowSquabble: false,
        policy: alternate,
        minimumSampleSize: 1,
      });
      return {
        policy,
        pairedCases: alternateSwaps.reduce((sum, swap) => sum + swap.pairedCases, 0),
        swaps: alternateSwaps,
        playerSeatScoreRate: alternateMatrix.seat.scoreRate,
      };
    }),
  ];
  const combos = HIGH_RISK_COMBOS.flatMap((spec) => ([0, 3] as const).flatMap((tier) =>
    (['player', 'cpu'] as const).map((owner) => runHighRiskComboProbe(spec, tier, owner)),
  ));
  const flags: BalanceFlag[] = [...matrix.flags];
  for (const swap of swaps) if (swap.flag === 'review' || swap.flag === 'blocker') flags.push({
    severity: swap.flag,
    code: 'paired-card-swap',
    subject: swap.id,
    message: `${swap.name} changed paired score by ${(swap.delta * 100).toFixed(1)} percentage points.`,
    value: swap.delta,
    threshold: swap.flag === 'blocker' ? SWAP_BLOCKER_DELTA : SWAP_REVIEW_DELTA,
  });
  for (const spec of HIGH_RISK_COMBOS) for (const tier of [0, 3] as const) {
    const probes = combos.filter((combo) => combo.id === spec.id && combo.tier === tier);
    const combo = [...probes].sort((left, right) => right.swingPerMotion - left.swingPerMotion)[0];
    if (!combo || combo.swingPerMotion <= 3) continue;
    const ownerSymmetric = probes.length === 2 && probes[0].finalSwing === probes[1].finalSwing;
    flags.push({
      severity: combo.swingPerMotion > 5 ? 'blocker' : 'review',
      code: 'combo-swing-per-motion',
      subject: `${combo.id}:tier-${combo.tier}`,
      message: `${combo.id} produced ${combo.finalSwing} net district Hands for ${combo.motionCost} Motion in the favorable fixture${ownerSymmetric ? ' for either owner' : ''}.`,
      value: combo.swingPerMotion,
      threshold: combo.swingPerMotion > 5 ? 5 : 3,
    });
  }
  const withoutFingerprint = {
    schemaVersion: BALANCE_LAB_SCHEMA_VERSION,
    mode,
    configuration: {
      decks: matrixConfig.decks.map((deck) => deck.id),
      districtSeeds: matrixConfig.districtSeeds.length,
      rotations: [...matrixConfig.rotations],
      tiers: [...matrixConfig.tiers],
      allowSquabble: matrixConfig.allowSquabble ?? true,
    },
    humanPlaytest: { status: 'pending' as const, protocol: 'scripts/BALANCE_PLAYTEST.md' as const },
    matrix,
    swaps,
    policySensitivity,
    combos,
    flags: flags.sort((left, right) => left.severity.localeCompare(right.severity) || left.code.localeCompare(right.code) || left.subject.localeCompare(right.subject)),
  };
  return { ...withoutFingerprint, deterministicFingerprint: reportFingerprint(withoutFingerprint) };
}

const percent = (value: number): string => `${(value * 100).toFixed(1)}%`;
const signedPercent = (value: number): string => `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)} pp`;

export function renderBalanceLabMarkdown(report: BalanceLabReport): string {
  const displayedCombos = report.combos.filter((combo) => combo.owner === 'player');
  const displayedFlags = report.flags.slice(0, 20);
  const hiddenFlagCount = report.flags.length - displayedFlags.length;
  const lines = [
    '# Squabblemon deterministic balance lab',
    '',
    `- Mode: **${report.mode}**`,
    `- Fingerprint: \`${report.deterministicFingerprint}\``,
    `- Matrix matches: **${report.matrix.matchCount.toLocaleString('en-US')}**`,
    `- Successful matches / engine failures: **${report.matrix.successfulMatches.toLocaleString('en-US')} / ${report.matrix.failedMatches.toLocaleString('en-US')}**`,
    `- Decks / pairings: **${report.matrix.deckCount} / ${report.matrix.pairCount}**`,
    `- Player seat score: **${percent(report.matrix.seat.scoreRate)}**`,
    `- Human playtest gate: **${report.humanPlaytest.status.toUpperCase()}** (\`${report.humanPlaytest.protocol}\`)`,
    `- Flags: **${report.flags.filter((flag) => flag.severity === 'blocker').length} blocker / ${report.flags.filter((flag) => flag.severity === 'review').length} review**`,
    '',
    '## Deck score rates',
    '',
    '| Deck | Games | Score | Player seat | CPU seat |',
    '| --- | ---: | ---: | ---: | ---: |',
    ...report.matrix.decks.map((deck) => `| ${deck.deckName} | ${deck.games} | ${percent(deck.scoreRate)} | ${percent(deck.asPlayerScoreRate)} | ${percent(deck.asCpuScoreRate)} |`),
    '',
    '## Paired card swaps',
    '',
    '| Swap | Cases | Baseline | Candidate | Delta | Gate |',
    '| --- | ---: | ---: | ---: | ---: | --- |',
    ...report.swaps.map((swap) => `| ${swap.name} | ${swap.pairedCases} | ${percent(swap.baselineScoreRate)} | ${percent(swap.candidateScoreRate)} | ${signedPercent(swap.delta)} | ${swap.flag} |`),
    '',
    '## Policy sensitivity',
    '',
    'Alternate deterministic policies are model-sensitivity evidence, not release gates.',
    '',
    '| Policy | Paired cases | Player-seat score | Largest swap delta |',
    '| --- | ---: | ---: | ---: |',
    ...report.policySensitivity.map((policy) => `| ${policy.policy} | ${policy.pairedCases} | ${percent(policy.playerSeatScoreRate)} | ${policy.swaps.length ? signedPercent(policy.swaps[0].delta) : 'n/a'} |`),
    '',
    '## High-risk echo probes',
    '',
    'Each combo runs through a favorable contested-board fixture for both owners. The table shows the player-side result after the owner-symmetry check.',
    '',
    '| Combo | Tier | Motion | Immediate swing | Final swing | Swing / Motion | Tokens |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...displayedCombos.map((combo) => `| ${combo.id} | ${combo.tier} | ${combo.motionCost} | ${combo.immediateSwing} | ${combo.finalSwing} | ${combo.swingPerMotion.toFixed(2)} | ${combo.tokenDelta} |`),
    '',
    '## Decision flags',
    '',
    ...(displayedFlags.length ? displayedFlags.map((flag) => `- **${flag.severity.toUpperCase()} · ${flag.code} · ${flag.subject}:** ${flag.message}`) : ['- No configured decision threshold fired.']),
    ...(hiddenFlagCount > 0 ? [`- ${hiddenFlagCount} additional flags are available in the JSON report.`] : []),
    '',
    'This report is a deterministic policy baseline. Human playtests remain the authority for comprehension, fun, and strategies the greedy policy cannot discover.',
    '',
  ];
  return lines.join('\n');
}
