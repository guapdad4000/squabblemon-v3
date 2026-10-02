import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  cards,
} from '@workspace/squabblemon-engine/data';
import {
  BALANCE_LAB_SCHEMA_VERSION,
  BALANCE_TELEMETRY_SEMANTICS,
  classifyBalanceAbilityEvent,
  classifyBalanceSquabblePlay,
  createDefaultBalanceDecks,
  greedyBalancePolicy,
  isSuccessfulBalanceAbilityEvent,
  runBalanceMatrix,
  seededLegalBalancePolicy,
  simulateBalanceMatch,
  type BalanceDeck,
  type BalanceAbilityEvidence,
  type BalanceAbilityEventEvidence,
  type BalanceSquabbleEvidence,
  type BalanceMatchResult,
  type BalancePolicy,
  type BalanceTier,
} from '@workspace/squabblemon-engine/balanceLab';
import type { Match } from '@workspace/squabblemon-engine/gameEngine';
import { CARD_BALANCE_VERSION, ONLINE_RULES_VERSION } from '@workspace/squabblemon-engine/multiplayer';
import { assertSweepTelemetry } from './balance-sweep-telemetry';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
// Frozen pre-diner staff/utility baseline. Do not replace these slots when the
// starter recipe evolves: earlier matchup evidence belongs to this exact crew.
export const STAFF_SHELL_IDS = [
  'squabble-house-manager',
  'plug',
  'waterboy',
  'squabblehouse-security',
  'squabblehouse-teknician',
  'griddle-master',
  'inmate-reformed',
  'janitor',
  'laundry',
  'nail',
] as const;
// Retained only for historical mixed-shell experiments; never describe it as the staff crew.
export const MIXED_SHELL_IDS = [
  'squabble-house-manager',
  'cane-corso-red',
  'blue-nose-pit',
  'squabblehouse-security',
  'squabblehouse-teknician',
  'griddle-master',
  'inmate-reformed',
  'janitor',
  'triple-og-blue',
  'triple-og-red',
] as const;
export const SHELL_ORDER_KEY = 'squabblehouse-balance-shell-v1';
type RosterMode = 'staff' | 'mixed';
const OPPONENT_IDS = ['focus-wonderland', 'focus-fire-guap', 'focus-wiz'] as const;
const PRIMARY_SEEDS = Array.from({ length: 12 }, (_, index) => `squabblehouse-primary-district-${String(index + 1).padStart(2, '0')}`);
const HOLDOUT_SEEDS = Array.from({ length: 6 }, (_, index) => `squabblehouse-holdout-district-${String(index + 1).padStart(2, '0')}`);
const STAFF_VALIDATION_SEEDS = Array.from({ length: 6 }, (_, index) => `squabblehouse-staff-validation-district-${String(index + 1).padStart(2, '0')}`);
const PRIMARY_ROTATIONS = [0, 2, 5] as const;
const HOLDOUT_ROTATIONS = [1, 6] as const;
const TIERS = [0, 3] as const satisfies readonly BalanceTier[];
const policies: readonly { id: 'greedy' | 'seeded-legal'; policy: BalancePolicy }[] = [
  { id: 'greedy', policy: greedyBalancePolicy },
  { id: 'seeded-legal', policy: seededLegalBalancePolicy },
];
const selectedArguments = process.argv.slice(2);
const isPilot = selectedArguments.includes('--pilot');
const rosterArgumentIndex = selectedArguments.indexOf('--roster');
const rosterMode = (rosterArgumentIndex < 0 ? 'mixed' : selectedArguments[rosterArgumentIndex + 1]) as RosterMode;
const shardArgumentIndex = selectedArguments.indexOf('--shard');
const shardSpec = shardArgumentIndex < 0 ? undefined : selectedArguments[shardArgumentIndex + 1];
const isMerge = selectedArguments.includes('--merge');
const outputDirectoryFor = (mode: RosterMode) => path.join(root, `scripts/results/squabblehouse-${mode}-balance`);

type Split = { games: number; wins: number; losses: number; draws: number; outrightWinPercent: number; halfDrawScoreRate: number };
type CardAggregate = {
  appearances: number;
  played: number;
  abilityTriggersObserved: number | null;
  mechanicallySuccessfulAbilityEvents: number | null;
  abilitySuccessRateWhenObserved: number | null;
  legacyObserverAbilityTriggersObserved: number;
  legacyObserverMechanicallySuccessfulAbilityEvents: number;
  legacyMixedEventEffectRatio: number | null;
  abilitySuccessMetricLimitation: string;
  abilityEvidence: BalanceAbilityEvidence | null;
  squabbleEvidence: BalanceSquabbleEvidence | null;
  squabbles: number | null;
  finalCopies: number;
  averageFinalPowerWhenPresent: number;
};
type CapturedEvent = {
  sequence: number;
  round: number;
  owner: string;
  cardId: string;
  type: string;
  timing: string;
  note: string;
  successfulAbilityEvent: boolean | null;
  /** Optional when reading historical captures, which cannot prove nested attribution. */
  abilityEvidence?: BalanceAbilityEventEvidence | null;
  abilityMetadata: Match['effectLog'][number]['abilityMetadata'] | null;
  squabbleDoubled: boolean | null;
  targets: { cardId: string; instanceId: string }[];
};
type Capture = { events: CapturedEvent[]; finalBoardCardIds: string[] };
type BalanceSweepBlock = Omit<ReturnType<typeof runBlock>, 'observations'> & {
  rawSuccessfulMatches: number;
  matrixParity: {
    successfulMatches: boolean;
    failedMatches: boolean;
    deckAOutcomeCounts: boolean;
    deckBOutcomeCounts: boolean;
  };
  cardSummaries: {
    shell: Omit<ReturnType<typeof summarize>, 'cards'> & { cards: Record<string, unknown> };
    opponent: ReturnType<typeof summarize>;
    sourceAttributedCrewEvents: Record<string, unknown>;
  };
};
type BalanceSweepReport = {
  pilot: boolean;
  rosterMode: RosterMode;
  startedAt: string;
  completedAt: string;
  gitCommit: string;
  runtimeMs: number;
  deterministicFingerprint: string;
  versionMetadata: {
    enginePackage: { name: string; version: string };
    balanceLabSchemaVersion: number;
    cardBalanceVersion: number;
    onlineRulesVersion: number;
  };
  configuration: {
    rosterMode: RosterMode;
    shell: BalanceDeck;
    opponents: readonly BalanceDeck[];
  };
  blocks: BalanceSweepBlock[];
  runtimeKits: { squabblehouseCardCosts: { id: string; cost: number }[] };
  simulationAccounting: {
    uniqueRequestedMatchups: number;
    rawRetainedSamples: number;
    matrixValidationReplays: number;
    engineSimulationAttempts: number;
    note: string;
  };
  failures: unknown[];
};

export function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

export function validateRoster(mode: RosterMode, cardIds: readonly string[]): void {
  if (cardIds.length !== 10 || new Set(cardIds).size !== 10) {
    throw new Error(`${mode} Squabblehouse roster must contain exactly ten unique cards`);
  }
  const unknown = cardIds.filter(cardId => !cards[cardId]);
  if (unknown.length) throw new Error(`${mode} Squabblehouse roster has unknown runtime cards: ${unknown.join(', ')}`);
  if (mode === 'staff' && cardIds.join('|') !== STAFF_SHELL_IDS.join('|')) {
    throw new Error('Staff mode requires the exact frozen pre-diner staff/utility roster and slot order');
  }
}

function makeSplit(results: readonly BalanceMatchResult[], side: 'a' | 'b'): Split {
  let wins = 0;
  let losses = 0;
  let draws = 0;
  for (const result of results) {
    if (result.logicalWinner === 'draw') draws += 1;
    else if (result.logicalWinner === side) wins += 1;
    else losses += 1;
  }
  const games = results.length;
  return {
    games,
    wins,
    losses,
    draws,
    outrightWinPercent: games ? wins / games * 100 : 0,
    halfDrawScoreRate: games ? (wins + draws * 0.5) / games : 0,
  };
}

export function summarizeCards(results: readonly BalanceMatchResult[], side: 'a' | 'b'): Record<string, CardAggregate> {
  const totals = new Map<string, {
    appearances: number; played: number; triggers: number; successes: number;
    squabbles: number; copies: number; power: number;
    abilityEvidence: BalanceAbilityEvidence | null;
    squabbleEvidence: BalanceSquabbleEvidence | null;
  }>();
  for (const result of results) {
    const observations = side === 'a' ? result.cardsA : result.cardsB;
    for (const observation of observations) {
      const current = totals.get(observation.cardId) ?? {
        appearances: 0, played: 0, triggers: 0, successes: 0,
        squabbles: 0, copies: 0, power: 0,
        abilityEvidence: observation.abilityEvidence ? { ...observation.abilityEvidence } : null,
        squabbleEvidence: observation.squabbleEvidence ? { ...observation.squabbleEvidence } : null,
      };
      if (totals.has(observation.cardId)) {
        // Historical chunks have no structured evidence. Do not manufacture zero coverage.
        if (current.abilityEvidence && observation.abilityEvidence) {
          for (const key of Object.keys(current.abilityEvidence) as (keyof BalanceAbilityEvidence)[]) {
            current.abilityEvidence = { ...current.abilityEvidence, [key]: current.abilityEvidence[key] + observation.abilityEvidence[key] };
          }
        } else current.abilityEvidence = null;
        if (current.squabbleEvidence && observation.squabbleEvidence) {
          for (const key of Object.keys(current.squabbleEvidence) as (keyof BalanceSquabbleEvidence)[]) {
            current.squabbleEvidence = { ...current.squabbleEvidence, [key]: current.squabbleEvidence[key] + observation.squabbleEvidence[key] };
          }
        } else current.squabbleEvidence = null;
      }
      current.appearances += 1;
      current.played += observation.played;
      current.triggers += observation.abilityTriggers;
      current.successes += observation.abilitySuccesses;
      current.squabbles += observation.squabbles;
      current.copies += observation.finalCopies;
      current.power += observation.finalPower;
      totals.set(observation.cardId, current);
    }
  }
  return Object.fromEntries([...totals.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([cardId, value]) => [
    cardId,
    {
      appearances: value.appearances,
      played: value.played,
      abilityTriggersObserved: null,
      mechanicallySuccessfulAbilityEvents: null,
      abilitySuccessRateWhenObserved: null,
      legacyObserverAbilityTriggersObserved: value.triggers,
      legacyObserverMechanicallySuccessfulAbilityEvents: value.successes,
      legacyMixedEventEffectRatio: value.triggers ? value.successes / value.triggers : null,
      abilitySuccessMetricLimitation: BALANCE_TELEMETRY_SEMANTICS.abilitySuccessRate,
      abilityEvidence: value.abilityEvidence,
      squabbleEvidence: value.squabbleEvidence,
      squabbles: value.squabbleEvidence && value.squabbleEvidence.unknownPlays === 0
        ? value.squabbleEvidence.activatedPlays : null,
      finalCopies: value.copies,
      averageFinalPowerWhenPresent: value.copies ? value.power / value.copies : 0,
    },
  ]));
}

export function summarize(results: readonly BalanceMatchResult[], side: 'a' | 'b') {
  const groups: Record<string, BalanceMatchResult[]> = {
    all: [...results],
    'seat-a-player': results.filter(result => result.seat === 'a-player'),
    'seat-b-player': results.filter(result => result.seat === 'b-player'),
    'tier-0': results.filter(result => result.tier === 0),
    'tier-3': results.filter(result => result.tier === 3),
    'seat-a-player-tier-0': results.filter(result => result.seat === 'a-player' && result.tier === 0),
    'seat-a-player-tier-3': results.filter(result => result.seat === 'a-player' && result.tier === 3),
    'seat-b-player-tier-0': results.filter(result => result.seat === 'b-player' && result.tier === 0),
    'seat-b-player-tier-3': results.filter(result => result.seat === 'b-player' && result.tier === 3),
  };
  return {
    splits: Object.fromEntries(Object.entries(groups).map(([key, values]) => [key, makeSplit(values, side)])),
    cards: summarizeCards(results, side),
  };
}

export function capturedCrewSummary(
  shell: BalanceDeck,
  rawResults: readonly BalanceMatchResult[],
  captures: readonly Capture[],
): { cards: Record<string, unknown>; coverage: Record<string, unknown> } {
  const cardsSummary = summarizeCards(rawResults, 'a');
  const evidenceByCard = Object.fromEntries(shell.cardIds.map(cardId => {
    const events = captures.flatMap(capture => capture.events.filter(event => event.cardId === cardId));
    const playEvents = events.filter(event => event.type === 'play');
    const abilityEvents = events.filter(event => event.type === 'ability');
    const upgradeEvents = abilityEvents.filter(event => event.abilityMetadata !== null);
    const baseWrapperEvents = abilityEvents.filter(event => event.abilityMetadata === null);
    const cardSummary = cardsSummary[cardId];
    const playEventCoverageMatches = playEvents.length === (cardSummary?.played ?? 0);
    const squabbleEvidenceComplete = playEventCoverageMatches
      && playEvents.every(event => event.squabbleDoubled !== null);
    const trueSquabbleCount = playEvents.filter(event => event.squabbleDoubled === true).length;
    return [cardId, {
      emittedSourceAttributedEvents: events.length,
      sourceAttributedPlayEvents: playEvents.length,
      balanceLabDeploymentCount: cardSummary?.played ?? 0,
      playEventCoverageMatchesBalanceLabDeployments: playEventCoverageMatches,
      squabbles: squabbleEvidenceComplete ? trueSquabbleCount : null,
      squabbleCountSource: squabbleEvidenceComplete
        ? 'Source-attributed play replay owner-consumption transitions (historical captures used exact doubled-play notes).'
        : 'Unknown because source-attributed play coverage or replay activation evidence was incomplete.',
      baseWrapperAbilityEvents: baseWrapperEvents.length,
      baseWrapperSuccessFlagCount: baseWrapperEvents.filter(event => event.successfulAbilityEvent === true).length,
      upgradeSuccessEvents: upgradeEvents.filter(event => event.abilityMetadata?.result === 'applied').length,
      structuredAbilityEventEvidence: abilityEvents.map(event => ({
        sequence: event.sequence, evidence: event.abilityEvidence ?? null,
      })),
      abilityEventNotes: abilityEvents.map(event => event.note),
      note: 'Source-attributed log evidence only. Wrapper deltas can be zero despite a successful nested echo, and passive effects may be absent or attributed elsewhere.',
    }];
  }));
  for (const [cardId, summary] of Object.entries(cardsSummary)) {
    const card = summary as CardAggregate & Record<string, unknown>;
    card.squabbles = (evidenceByCard[cardId] as { squabbles: number | null } | undefined)?.squabbles ?? null;
  }
  return {
    cards: cardsSummary,
    coverage: evidenceByCard,
  };
}

function policyFor(name: 'greedy' | 'seeded-legal'): BalancePolicy {
  return policies.find(entry => entry.id === name)!.policy;
}

export function getDefaults(): BalanceDeck[] {
  const defaults = createDefaultBalanceDecks();
  const required = OPPONENT_IDS.map(id => {
    const deck = defaults.find(candidate => candidate.id === id);
    if (!deck) throw new Error(`Required current opponent crew ${id} is missing from createDefaultBalanceDecks()`);
    return deck;
  });
  return required;
}

export function getShell(mode: RosterMode): BalanceDeck {
  const cardIds = [...(mode === 'staff' ? STAFF_SHELL_IDS : MIXED_SHELL_IDS)];
  validateRoster(mode, cardIds);
  return {
    id: mode === 'staff' ? 'squabblehouse-staff-shell' : 'squabblehouse-historical-mixed-shell',
    name: mode === 'staff' ? 'Frozen pre-diner Squabblehouse staff with cheap utility' : 'Historical mixed Squabblehouse wave and OG shell',
    cardIds,
    orderKey: SHELL_ORDER_KEY,
  };
}

function recordCardEvidence(match: Readonly<Match>, cardIds: readonly string[], owner: 'player' | 'cpu'): Capture {
  const shellIds = new Set(cardIds);
  const events = match.effectLog
    .filter(event => event.owner === owner && shellIds.has(event.cardId))
    .map(event => ({
      sequence: event.sequence,
      round: event.round,
      owner: event.owner,
      cardId: event.cardId,
      type: event.type,
      timing: event.timing,
      note: event.note,
      successfulAbilityEvent: event.type === 'ability' ? isSuccessfulBalanceAbilityEvent(event) : null,
      abilityEvidence: classifyBalanceAbilityEvent(event, match.effectLog),
      abilityMetadata: event.abilityMetadata ?? null,
      squabbleDoubled: event.type !== 'play' || classifyBalanceSquabblePlay(event) === 'unknown'
        ? null : classifyBalanceSquabblePlay(event) === 'activated',
      targets: event.targets.map(target => ({ cardId: target.cardId, instanceId: target.cardInstanceId })),
    }));
  return {
    events,
    finalBoardCardIds: match.boards.flat().filter(card => card.owner === owner && shellIds.has(card.cardId)).map(card => card.cardId),
  };
}

function makeSeeds(count: number, prefix: string): string[] {
  return Array.from({ length: count }, (_, index) => `${prefix}-${String(index + 1).padStart(2, '0')}`);
}

export function kit(cardId: string) {
  const card = cards[cardId];
  return {
    id: card.id,
    name: card.name,
    type: card.type,
    cost: card.cost,
    power: card.power,
    ability: card.ability,
    effect: card.effect,
    roles: card.roles ?? [],
    elementalBond: card.elementalBond ?? null,
    abilityUpgradeCount: card.abilityUpgrades?.length ?? 0,
  };
}

export function runBlock(
  matchup: string,
  deckA: BalanceDeck,
  deckB: BalanceDeck,
  policyId: 'greedy' | 'seeded-legal',
  seeds: readonly string[],
  rotations: readonly number[],
  pilot: boolean,
  scheduleSet?: 'primary' | 'fresh-holdout' | 'pilot',
) {
  const policy = policyFor(policyId);
  const matrixStarted = Date.now();
  const matrix = runBalanceMatrix({
    id: `${matchup}-${pilot ? 'pilot-' : ''}${policyId}`,
    decks: [deckA, deckB],
    districtSeeds: seeds,
    rotations: [...rotations],
    tiers: [...TIERS],
    includeMirrors: false,
    allowSquabble: true,
    policy,
    onProgress: (completed, total) => {
      if (completed === total || completed % 24 === 0) process.stderr.write(`${matchup} ${policyId} matrix ${completed}/${total}\n`);
    },
  });
  const matrixRuntimeMs = Date.now() - matrixStarted;

  const rawResults: BalanceMatchResult[] = [];
  const observations: Capture[] = [];
  const rawFailures: { districtSeed: string; rotation: number; tier: BalanceTier; seat: 'a-player' | 'b-player'; message: string }[] = [];
  const rawStarted = Date.now();
  for (const tier of TIERS) for (const districtSeed of seeds) for (const rotation of rotations) {
    for (const seat of ['a-player', 'b-player'] as const) {
      try {
        let capture: Capture | undefined;
        const shellOwner = seat === 'a-player' ? 'player' : 'cpu';
        const result = simulateBalanceMatch({
          deckA, deckB, districtSeed, rotation, tier, seat, policy, allowSquabble: true,
          observeComplete: match => { capture = recordCardEvidence(match, deckA.cardIds, shellOwner); },
        });
        rawResults.push(result);
        observations.push(capture ?? { events: [], finalBoardCardIds: [] });
      } catch (error) {
        rawFailures.push({
          districtSeed, rotation, tier, seat,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
  const rawRuntimeMs = Date.now() - rawStarted;
  const rawA = makeSplit(rawResults, 'a');
  const rawB = makeSplit(rawResults, 'b');
  const matrixA = matrix.decks.find(deck => deck.deckId === deckA.id);
  const matrixB = matrix.decks.find(deck => deck.deckId === deckB.id);
  const matrixParity = {
    successfulMatches: matrix.successfulMatches === rawResults.length,
    failedMatches: matrix.failedMatches === rawFailures.length,
    deckAOutcomeCounts: !!matrixA && matrixA.games === rawA.games && matrixA.wins === rawA.wins
      && matrixA.losses === rawA.losses && matrixA.draws === rawA.draws,
    deckBOutcomeCounts: !!matrixB && matrixB.games === rawB.games && matrixB.wins === rawB.wins
      && matrixB.losses === rawB.losses && matrixB.draws === rawB.draws,
  };
  if (Object.values(matrixParity).some(matched => !matched)) {
    throw new Error(`Matrix/raw parity failure for ${matchup} ${policyId}: ${JSON.stringify(matrixParity)}; matrix=${matrix.successfulMatches}/${matrix.failedMatches}, raw=${rawResults.length}/${rawFailures.length}`);
  }
  return {
    matchup,
    policy: policyId,
    schedule: {
      set: scheduleSet ?? (pilot ? 'pilot' : seeds[0]?.includes('holdout') || seeds[0]?.includes('validation') ? 'fresh-holdout' : 'primary'),
      seeds, rotations: [...rotations], tiers: [...TIERS], mirroredSeats: true, allowSquabble: true,
    },
    expectedMatches: seeds.length * rotations.length * TIERS.length * 2,
    matrix,
    matrixRuntimeMs,
    rawResults,
    observations,
    rawFailures,
    matrixParity,
    rawRuntimeMs,
  };
}

function main() {
  if (!['staff', 'mixed'].includes(rosterMode)) throw new Error('--roster must be staff or mixed');
  const shell = getShell(rosterMode);
  const opponents = getDefaults();
  const outputDirectory = outputDirectoryFor(rosterMode);
  if (isMerge) {
    mergeShards(rosterMode, shell, outputDirectory);
    return;
  }
  const shardParts = shardSpec?.split(':');
  if (shardSpec && (shardParts?.length !== 3 || !OPPONENT_IDS.includes(shardParts[0] as typeof OPPONENT_IDS[number])
      || !['greedy', 'seeded-legal'].includes(shardParts[1]) || !['primary', 'holdout'].includes(shardParts[2]))) {
    throw new Error('--shard must be <focus-wonderland|focus-fire-guap|focus-wiz>:<greedy|seeded-legal>:<primary|holdout>');
  }
  if (shardParts?.[2] === 'holdout' && shardParts[1] !== 'greedy') throw new Error('The holdout schedule is greedy-only');
  const primarySeeds = isPilot ? makeSeeds(1, 'squabblehouse-pilot-district') : PRIMARY_SEEDS;
  const primaryRotations = isPilot ? [0] : [...PRIMARY_ROTATIONS];
  const holdoutSeeds = isPilot ? [] : rosterMode === 'staff' ? STAFF_VALIDATION_SEEDS : HOLDOUT_SEEDS;
  const selectedOpponents = shardParts ? opponents.filter(deck => deck.id === shardParts[0]) : opponents;

  // Print the frozen rosters before any match simulations begin.
  console.log(JSON.stringify({
    frozenShell: {
      id: shell.id,
      name: shell.name,
      rosterMode,
      recipeSource: rosterMode === 'staff'
        ? 'Frozen pre-diner staff/utility baseline, independent of the current squabblehouse-shift starter recipe'
        : 'historical mixed shell retained for non-staff comparisons',
      orderKey: shell.orderKey,
      exactCardIds: shell.cardIds,
      runtimeCurve: shell.cardIds.map(id => ({ id, name: cards[id].name, cost: cards[id].cost })),
    },
    canonicalCurrentOpponents: opponents.map(deck => ({ id: deck.id, name: deck.name, exactCardIds: deck.cardIds })),
    schedule: isPilot
      ? { pilot: true, seeds: primarySeeds, rotations: primaryRotations, tiers: TIERS, seats: 'mirrored', policies: ['greedy'] }
      : { primarySeeds, primaryRotations, holdoutSeeds, holdoutRotations: HOLDOUT_ROTATIONS, tiers: TIERS, policies: ['greedy', 'seeded-legal'], holdoutPolicy: 'greedy' },
  }, null, 2));

  mkdirSync(outputDirectory, { recursive: true });
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  const blocks: ReturnType<typeof runBlock>[] = [];
  for (const opponent of selectedOpponents) {
    const id = `${shell.id}-vs-${opponent.id}`;
    const policyList = isPilot ? [policies[0]] : shardParts
      ? policies.filter(entry => entry.id === shardParts[1])
      : policies;
    for (const { id: policyId } of policyList) {
      if (!shardParts || shardParts[2] === 'primary') {
        blocks.push(runBlock(id, shell, opponent, policyId, primarySeeds, primaryRotations, isPilot));
      }
    }
    if (!isPilot && (!shardParts || shardParts[2] === 'holdout')) {
      blocks.push(runBlock(id, shell, opponent, 'greedy', holdoutSeeds, HOLDOUT_ROTATIONS, false));
    }
  }
  const runtimeMs = Date.now() - startedMs;
  const sourceFiles = [
    'lib/squabblemon-engine/src/balanceLab.ts',
    'scripts/src/balance-sweep-telemetry.ts',
    'lib/squabblemon-engine/src/data.ts',
    'lib/squabblemon-engine/src/gameEngine.ts',
    'lib/squabblemon-engine/src/districts.ts',
    'lib/squabblemon-engine/src/squabblehouseWave.ts',
    'lib/squabblemon-engine/src/creativeReworks.ts',
    'lib/squabblemon-engine/src/rosterBalance.ts',
    'lib/squabblemon-engine/src/multiplayer.ts',
  ];
  const sourceFingerprints = Object.fromEntries(sourceFiles.map(file => [file, sha256(readFileSync(path.join(root, file)))]));
  let gitCommit = 'unavailable';
  try {
    gitCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  } catch {
    // Source file fingerprints remain authoritative when the checkout has no Git metadata.
  }
  const enginePackage = JSON.parse(readFileSync(path.join(root, 'lib/squabblemon-engine/package.json'), 'utf8')) as { name: string; version: string };
  const deterministicConfiguration = {
    rosterMode,
    shell,
    opponents,
    primary: { seeds: primarySeeds, rotations: primaryRotations, tiers: TIERS, policies: isPilot ? ['greedy'] : ['greedy', 'seeded-legal'] },
    holdout: isPilot ? null : { seeds: holdoutSeeds, rotations: HOLDOUT_ROTATIONS, tiers: TIERS, policy: 'greedy' },
    allowSquabble: true,
    engineBalanceLabFingerprints: sourceFingerprints,
  };
  const fingerprint = sha256(JSON.stringify(deterministicConfiguration));
  const report = {
    schemaVersion: BALANCE_LAB_SCHEMA_VERSION,
    experiment: 'current-rules-offline-squabblehouse-balance-sweep',
    rosterMode,
    pilot: isPilot,
    startedAt,
    completedAt: new Date().toISOString(),
    runtimeMs,
    gitCommit,
    versionMetadata: {
      enginePackage: { name: enginePackage.name, version: enginePackage.version },
      balanceLabSchemaVersion: BALANCE_LAB_SCHEMA_VERSION,
      cardBalanceVersion: CARD_BALANCE_VERSION,
      onlineRulesVersion: ONLINE_RULES_VERSION,
    },
    deterministicFingerprint: fingerprint,
    configuration: {
      ...deterministicConfiguration,
      summaryDefinitions: {
        outrightWinPercent: 'wins / games * 100; draws are not counted as wins',
        halfDrawScoreRate: '(wins + 0.5 * draws) / games',
      },
      interpretation: [
        'These are deterministic bot-vs-bot matchup outcomes, not human win rates.',
        'Card play-conditioned trigger success is not causal card strength.',
        'The balanceLab observer classifies ability events; passive triggers without their own event can be undercounted and event attribution may not represent all passive value.',
        rosterMode === 'staff'
          ? 'This is the frozen pre-diner staff/utility baseline, not the current starter recipe or the new diner cards. Its four utility supports replaced the earlier mixed wave/OG shell. This is a composition comparison, not a causal single-card test.'
          : 'Historical mixed wave/OG roster retained separately; do not describe it as the approved staff crew.',
      ],
    },
    runtimeCardKits: Object.fromEntries([...new Set([...shell.cardIds, ...opponents.flatMap(deck => deck.cardIds)])].map(id => [id, kit(id)])),
    blocks: blocks.map(block => {
      const shellSummary = summarize(block.rawResults, 'a');
      const sourceAttributedCrewEvents = capturedCrewSummary(shell, block.rawResults, block.observations);
      return {
        matchup: block.matchup,
        policy: block.policy,
        schedule: block.schedule,
        expectedMatches: block.expectedMatches,
        matrixRuntimeMs: block.matrixRuntimeMs,
        rawRuntimeMs: block.rawRuntimeMs,
        matrix: block.matrix,
        matrixParity: block.matrixParity,
        rawSuccessfulMatches: block.rawResults.length,
        rawResults: block.rawResults,
        crewCardEventObservations: block.observations,
        rawFailures: block.rawFailures,
        cardSummaries: {
          shell: { ...shellSummary, cards: sourceAttributedCrewEvents.cards },
          opponent: summarize(block.rawResults, 'b'),
          sourceAttributedCrewEvents: sourceAttributedCrewEvents.coverage,
        },
      };
    }),
    failures: blocks.flatMap(block => [
      ...block.matrix.failures.map(failure => ({ matchup: block.matchup, policy: block.policy, source: 'runBalanceMatrix', ...failure })),
      ...block.rawFailures.map(failure => ({ matchup: block.matchup, policy: block.policy, source: 'simulateBalanceMatch', ...failure })),
    ]),
    runtimeKits: {
      squabblehouseCardCosts: shell.cardIds.map(id => ({ id, name: cards[id].name, cost: cards[id].cost })),
      opponentDeckCosts: Object.fromEntries(opponents.map(deck => [deck.id, deck.cardIds.map(id => ({ id, cost: cards[id].cost }))])),
    },
    simulationAccounting: {
      uniqueRequestedMatchups: blocks.reduce((sum, block) => sum + block.expectedMatches, 0),
      rawRetainedSamples: blocks.reduce((sum, block) => sum + block.rawResults.length, 0),
      matrixValidationReplays: blocks.reduce((sum, block) => sum + block.matrix.matchCount, 0),
      engineSimulationAttempts: blocks.reduce((sum, block) => sum + block.matrix.matchCount + block.rawResults.length + block.rawFailures.length, 0),
      note: 'Each unique requested case is executed once by runBalanceMatrix and again with simulateBalanceMatch to preserve full raw results. This rerun is validation/replay, not an independent sample.',
    },
  };
  assertSweepTelemetry(report);
  if (shardSpec) {
    const chunkPath = path.join(outputDirectory, `squabblehouse-${rosterMode}-balance-chunk-${shardParts![0]}-${shardParts![1]}-${shardParts![2]}.json`);
    writeFileSync(chunkPath, `${JSON.stringify(report, null, 2)}\n`);
    const totalExpected = blocks.reduce((sum, block) => sum + block.expectedMatches, 0);
    const totalRaw = blocks.reduce((sum, block) => sum + block.rawResults.length, 0);
    console.log(JSON.stringify({
      chunk: path.relative(root, chunkPath),
      shard: shardSpec,
      expectedMatchCount: totalExpected,
      rawSuccessfulMatches: totalRaw,
      failureCount: report.failures.length,
      runtimeMs,
    }, null, 2));
    return;
  }
  const prefix = isPilot ? 'pilot' : 'current-rules';
  const jsonPath = path.join(outputDirectory, `squabblehouse-${rosterMode}-balance-${prefix}.json`);
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  const markdown = renderMarkdown(report);
  const markdownPath = path.join(outputDirectory, `squabblehouse-${rosterMode}-balance-${prefix}.md`);
  writeFileSync(markdownPath, markdown);
  const totalExpected = blocks.reduce((sum, block) => sum + block.expectedMatches, 0);
  const totalRaw = blocks.reduce((sum, block) => sum + block.rawResults.length, 0);
  console.log(JSON.stringify({
    written: [path.relative(root, markdownPath), path.relative(root, jsonPath)],
    deterministicFingerprint: fingerprint,
    expectedMatchCount: totalExpected,
    rawSuccessfulMatches: totalRaw,
    failureCount: report.failures.length,
    runtimeMs,
  }, null, 2));
}

function mergeShards(mode: RosterMode, shell: BalanceDeck, outputDirectory: string) {
  mkdirSync(outputDirectory, { recursive: true });
  const expectedShards = [
    ...OPPONENT_IDS.flatMap(id => ['greedy', 'seeded-legal'].map(policy => `${id}-${policy}-primary`)),
    ...OPPONENT_IDS.map(id => `${id}-greedy-holdout`),
  ];
  const chunks: BalanceSweepReport[] = expectedShards.map(shard => {
    const file = path.join(outputDirectory, `squabblehouse-${mode}-balance-chunk-${shard}.json`);
    try {
      return JSON.parse(readFileSync(file, 'utf8'));
    } catch (error) {
      throw new Error(`Missing or unreadable shard ${path.relative(root, file)}: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
  const fingerprints = new Set(chunks.map(chunk => chunk.deterministicFingerprint));
  chunks.forEach(assertSweepTelemetry);
  if (fingerprints.size !== 1) throw new Error('Shard fingerprints differ; do not merge shards from different source or schedule versions');
  if (chunks.some(chunk => chunk.rosterMode !== mode || chunk.configuration.shell.cardIds.join('|') !== shell.cardIds.join('|'))) {
    throw new Error(`Refusing to merge chunks that do not match the ${mode} roster`);
  }
  const report = {
    ...chunks[0],
    pilot: false,
    startedAt: chunks.map(chunk => chunk.startedAt).sort()[0],
    completedAt: chunks.map(chunk => chunk.completedAt).sort().at(-1)!,
    runtimeMs: chunks.reduce((sum, chunk) => sum + chunk.runtimeMs, 0),
    blocks: chunks.flatMap(chunk => chunk.blocks),
    failures: chunks.flatMap(chunk => chunk.failures),
    shardCount: chunks.length,
    simulationAccounting: {
      uniqueRequestedMatchups: chunks.flatMap(chunk => chunk.blocks).reduce((sum, block) => sum + block.expectedMatches, 0),
      rawRetainedSamples: chunks.flatMap(chunk => chunk.blocks).reduce((sum, block) => sum + block.rawSuccessfulMatches, 0),
      matrixValidationReplays: chunks.flatMap(chunk => chunk.blocks).reduce((sum, block) => sum + block.matrix.matchCount, 0),
      engineSimulationAttempts: chunks.flatMap(chunk => chunk.blocks).reduce((sum, block) => sum + block.matrix.matchCount + block.rawSuccessfulMatches + block.rawFailures.length, 0),
      note: 'Matrix/raw are duplicate validation executions for every requested unique case, not additional independent samples.',
    },
  };
  const jsonPath = path.join(outputDirectory, `squabblehouse-${mode}-balance-current-rules.json`);
  const markdownPath = path.join(outputDirectory, `squabblehouse-${mode}-balance-current-rules.md`);
  assertSweepTelemetry(report);
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(markdownPath, renderMarkdown(report));
  console.log(JSON.stringify({
    mergedShards: chunks.length,
    expectedMatches: report.blocks.reduce((sum, block) => sum + block.expectedMatches, 0),
    rawSuccessfulMatches: report.blocks.reduce((sum, block) => sum + block.rawSuccessfulMatches, 0),
    failureCount: report.failures.length,
    runtimeMs: report.runtimeMs,
    written: [path.relative(root, markdownPath), path.relative(root, jsonPath)],
  }, null, 2));
}

function renderMarkdown(report: BalanceSweepReport): string {
  const lines = [
    `# Squabblehouse ${report.configuration.rosterMode} current-rules offline balance sweep`,
    '',
    `- Roster mode: ${report.configuration.rosterMode}${report.configuration.rosterMode === 'staff' ? ' (approved staff shell; not optimized)' : ' (historical mixed shell; not the approved staff crew)'}`,
    `- Run: ${report.pilot ? 'pilot' : 'primary plus fresh greedy holdout'}`,
    `- Engine/source commit: \`${report.gitCommit}\``,
    `- Versions: \`${report.versionMetadata.enginePackage.name}@${report.versionMetadata.enginePackage.version}\`; card balance ${report.versionMetadata.cardBalanceVersion}; online rules ${report.versionMetadata.onlineRulesVersion}; BalanceLab schema ${report.versionMetadata.balanceLabSchemaVersion}`,
    `- Deterministic configuration fingerprint: \`${report.deterministicFingerprint}\``,
    `- Runtime: ${(report.runtimeMs / 1000).toFixed(2)} s`,
    `- Squabble: on; tiers 0 and 3; mirrored seats`,
    `- Exact fixed shell: ${report.configuration.shell.cardIds.join(', ')}`,
    `- Shared shell orderKey: \`${report.configuration.shell.orderKey}\``,
    '',
    '## Canonical current opponent crews',
    '',
    '| ID | Current name | Exact roster |',
    '| --- | --- | --- |',
    ...report.configuration.opponents.map((deck: BalanceDeck) => `| ${deck.id} | ${deck.name} | ${deck.cardIds.join(', ')} |`),
    '',
    '## Matchup results',
    '',
    '| Matchup | Policy | Schedule | Games | W-L-D | Outright wins | Half-draw score | Player seat | CPU seat | Tier 0 | Tier 3 | Failures |',
    '| --- | --- | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  ];
  for (const block of report.blocks) {
    const split = block.cardSummaries.shell.splits;
    const all = split.all;
    const seatPlayer = split['seat-a-player'];
    const seatCpu = split['seat-b-player'];
    const t0 = split['tier-0'];
    const t3 = split['tier-3'];
    const scheduleName = block.schedule.set === 'fresh-holdout' ? 'Fresh holdout' : block.schedule.set === 'pilot' ? 'Pilot' : 'Primary';
    lines.push(`| ${block.matchup.replace(`${report.configuration.shell.id}-vs-`, '')} | ${block.policy} | ${scheduleName}: ${block.schedule.seeds.length} seeds × ${block.schedule.rotations.length} rotations | ${all.games} | ${all.wins}-${all.losses}-${all.draws} | ${all.outrightWinPercent.toFixed(1)}% | ${all.halfDrawScoreRate.toFixed(3)} | ${seatPlayer.halfDrawScoreRate.toFixed(3)} | ${seatCpu.halfDrawScoreRate.toFixed(3)} | ${t0.halfDrawScoreRate.toFixed(3)} | ${t3.halfDrawScoreRate.toFixed(3)} | ${block.matrix.failedMatches + block.rawFailures.length} |`);
  }
  lines.push(
    '',
    '## Runtime card costs',
    '',
    ...report.runtimeKits.squabblehouseCardCosts.map((card: { id: string; name: string; cost: number }) => `- ${card.name} (${card.id}): ${card.cost} Motion`),
    '',
    '## Card deployments and trigger evidence',
    '',
    'Per-card deployment, source-attributed event notes, structured base/nested/upgrade evidence, replay-confirmed SQUABBLE consumption where event coverage is complete, final copies, and average final power are retained by matchup/policy under `cardSummaries` and `crewCardEventObservations`. Legacy mixed-event ratios are labelled audit-only, and ability reliability is null for both crews: zero-delta wrappers can represent successful nested echoes, and unlogged eligibility/passive value remains unknown. Historical raw outcomes are not rewritten. Card appearance/play-conditioned evidence is descriptive, not causal card strength.',
    '',
    '## Failures and interpretation',
    '',
    `Recorded failure entries: ${report.failures.length}. No failed simulation is silently discarded; each matrix failure group and raw replay failure is retained in the JSON.`,
    '',
    'These deterministic bot-vs-bot outcomes are not human win rates. Greedy and seeded-legal represent policy sensitivity, not estimates of human play. A card that is played more often, or has a high success rate conditional on an ability event, is not thereby proven stronger.',
    '',
    '## Reproduction',
    '',
    '```sh',
    'pnpm --filter @workspace/scripts exec tsx src/squabblehouse-balance-sweep.ts --roster staff --pilot',
    'for matchup in focus-wonderland focus-fire-guap focus-wiz; do',
    '  for policy in greedy seeded-legal; do',
    '    pnpm --filter @workspace/scripts exec tsx src/squabblehouse-balance-sweep.ts --roster staff --shard "$matchup:$policy:primary"',
    '  done',
    '  pnpm --filter @workspace/scripts exec tsx src/squabblehouse-balance-sweep.ts --roster staff --shard "$matchup:greedy:holdout"',
    'done',
    'pnpm --filter @workspace/scripts exec tsx src/squabblehouse-balance-sweep.ts --roster staff --merge',
    '```',
    '',
    'The staff validation schedule uses six fresh `squabblehouse-staff-validation-district-*` holdout seeds, distinct from the prior mixed-shell holdout. Each shard is independently resumable and writes a raw JSON chunk in `scripts/results/squabblehouse-staff-balance/`; `--merge` requires all nine matching-fingerprint staff chunks.',
    '',
    'Each unique schedule cell is reported once (1,008 requested primary + holdout cases); the raw match records are replay-validated against the aggregate `runBalanceMatrix` execution. Matrix runs plus raw capture are duplicate validations, not 2,016 independent samples.',
    '',
    '## Provenance',
    '',
    `The exact current opponent names/rosters come from \`createDefaultBalanceDecks()\`. Engine \`CARD_BALANCE_VERSION=${report.versionMetadata.cardBalanceVersion}\` and \`ONLINE_RULES_VERSION=${report.versionMetadata.onlineRulesVersion}\` were read from the current engine exports; no online service was invoked. Current runtime kits, costs, and source-file SHA-256 fingerprints are in the JSON. No production engine, app, saved deck, database, or balance values are modified.`,
    '',
  );
  return lines.join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}