import {
  canAffordSelection,
  getDistrictResults,
  getMatchRoundLimit,
  getMatchWinner,
  nextRound,
  pass,
  playTurnCard,
  revealCpuTurn,
  suppressMatchPresentationEvents,
  type CardInstance,
  type Lane,
  type Match,
  type PlayerMove,
} from "@workspace/squabblemon-engine/gameEngine";

export type StorySolveOutcome = "win" | "loss";
type SearchState = { match: Match; moves: PlayerMove[] };
type SearchBudget = {
  deadline: number;
  expansions: number;
  maximumExpansions: number;
};

export const STORY_SOLVER_NODE_BUDGET_MS = 5_000;
export const STORY_SOLVER_MAX_EXPANSIONS = 20_000;
const MAX_PLAYER_ACTIONS_PER_TURN = 4;

function compact(match: Match): Match {
  return match.effectLog.length === 0
    ? match
    : { ...match, effectLog: [] };
}

type MatchEvaluation = {
  margins: [number, number, number];
  playerDistricts: number;
  cpuDistricts: number;
};
const evaluationCache = new WeakMap<Match, MatchEvaluation>();
const semanticKeyCache = new WeakMap<Match, string>();
const diversityKeyCache = new WeakMap<Match, string>();

function evaluateMatch(match: Match): MatchEvaluation {
  const cached = evaluationCache.get(match);
  if (cached) return cached;
  const results = getDistrictResults(match);
  const evaluation: MatchEvaluation = {
    margins: results.map(
      district => district.player - district.cpu,
    ) as [number, number, number],
    playerDistricts: results.filter(
      district => district.winner === "player",
    ).length,
    cpuDistricts: results.filter(
      district => district.winner === "cpu",
    ).length,
  };
  evaluationCache.set(match, evaluation);
  return evaluation;
}

function laneMargins(match: Match): [number, number, number] {
  return evaluateMatch(match).margins;
}

function value(match: Match, desired: StorySolveOutcome): number {
  const evaluation = evaluateMatch(match);
  const winner = match.phase !== "complete"
    ? null
    : evaluation.playerDistricts >= 2
      ? "player"
      : evaluation.cpuDistricts >= 2
        ? "cpu"
        : "draw";
  const terminal =
    winner === "player"
      ? 10_000_000
      : winner === "cpu"
        ? -10_000_000
        : 0;
  const margins = [...evaluation.margins].sort((a, b) => b - a);
  // Two districts decide the match. The second-best margin therefore matters
  // much more than surplus Hands in a district the player already controls.
  const playerValue =
    terminal +
    margins[1] * 4_000 +
    margins[0] * 80 +
    margins[2] * 20 +
    evaluation.playerDistricts * 1_000 -
    evaluation.cpuDistricts * 1_200 +
    match.playerMotion * 3 +
    match.playerHand.length * 0.1;
  return desired === "win" ? playerValue : -playerValue;
}
function assertBudget(budget: SearchBudget): void {
  if (
    Date.now() > budget.deadline ||
    budget.expansions > budget.maximumExpansions
  ) {
    throw new Error(
      `Story solver exceeded its ${STORY_SOLVER_NODE_BUDGET_MS}ms / ${budget.maximumExpansions}-expansion per-node budget after ${budget.expansions} expansions`,
    );
  }
}

function cardKey(card: CardInstance): string {
  const status = card.statuses;
  return [
    card.instanceId,
    card.lane ?? "h",
    card.playedRound ?? "h",
    card.basePower,
    card.powerModifier,
    card.moved ? 1 : 0,
    status.frozen ? 1 : 0,
    status.silenced ? 1 : 0,
    status.protected ? 1 : 0,
    status.blocked ? 1 : 0,
    status.uncounterable ? 1 : 0,
    status.weakened ? 1 : 0,
    status.locked ? 1 : 0,
    status.boosted ? 1 : 0,
    status.burnStacks,
    card.copiedAbilityCardId ?? "",
    card.networkBoosts ?? 0,
  ].join(",");
}

function semanticMatchKey(match: Match): string {
  const cached = semanticKeyCache.get(match);
  if (cached) return cached;
  // Static encounter/deck/upgrade data is shared by every state in one solve.
  // Key only mutable rule state; preserve hand/board order because tie-breaking
  // abilities use deterministic array order.
  const key = [
    match.round,
    match.phase,
    match.playerMotion,
    match.cpuMotion,
    match.playerDrawIndex,
    match.cpuDrawIndex,
    match.squabbleUsed ? 1 : 0,
    match.squabbleByOwner
      ? `${match.squabbleByOwner.player ? 1 : 0}${match.squabbleByOwner.cpu ? 1 : 0}`
      : "legacy",
    `${match.plugDiscountLane.player ?? "n"}${match.plugDiscountLane.cpu ?? "n"}`,
    `${match.cheapBuffsUsed.player},${match.cheapBuffsUsed.cpu}`,
    JSON.stringify(match.discountTokens),
    JSON.stringify(match.landlordTaxUsed),
    JSON.stringify(match.sneakerTriggered),
    match.lastRevealedCardId ?? "",
    JSON.stringify(match.timedEffects),
    JSON.stringify(match.storyRuntime),
    JSON.stringify(match.districtRuntime),
    match.playerHand.map(cardKey).join(";"),
    match.cpuHand.map(cardKey).join(";"),
    match.boards.map(cards => cards.map(cardKey).join(";")).join("/"),
  ].join("|");
  semanticKeyCache.set(match, key);
  return key;
}
function diversityKey(state: SearchState): string {
  const cached = diversityKeyCache.get(state.match);
  if (cached) return cached;
  const margins = laneMargins(state.match);
  const ranked = ([0, 1, 2] as Lane[]).sort(
    (a, b) => margins[b] - margins[a] || a - b,
  );
  const playsThisRound = state.match.boards
    .flat()
    .filter(
      card =>
        card.owner === "player" &&
        card.playedRound === state.match.round,
    ).length;
  const squabble =
    state.match.squabbleByOwner?.player ??
    state.match.squabbleUsed;
  const playerBoard = state.match.boards
    .flat()
    .filter(card => card.owner === "player" && card.playedRound !== null);
  const mostRecentPlayRound = playerBoard.reduce(
    (latest, card) => Math.max(latest, card.playedRound ?? 0),
    0,
  );
  const recentCardSignature = playerBoard
    .filter(card => card.playedRound === mostRecentPlayRound)
    .map(card => `${card.cardId}@${card.lane ?? "h"}`)
    .sort()
    .join(",") || "none";
  const key = `${ranked[0]}${ranked[1]}:${playsThisRound}:${squabble ? 1 : 0}:${recentCardSignature}`;
  diversityKeyCache.set(state.match, key);
  return key;
}

function selectStates(
  states: SearchState[],
  desired: StorySolveOutcome,
  limit: number,
  perBucket = 1,
): SearchState[] {
  const ranked = states.map(state => ({
    state,
    score: value(state.match, desired),
    semanticKey: semanticMatchKey(state.match),
    bucket: diversityKey(state),
  })).sort((a, b) => b.score - a.score);
  const selected: SearchState[] = [];
  const seen = new Set<string>();
  const bucketCounts = new Map<string, number>();

  for (const candidate of ranked) {
    if (seen.has(candidate.semanticKey)) continue;
    if ((bucketCounts.get(candidate.bucket) ?? 0) >= perBucket) continue;
    seen.add(candidate.semanticKey);
    bucketCounts.set(
      candidate.bucket,
      (bucketCounts.get(candidate.bucket) ?? 0) + 1,
    );
    selected.push(candidate.state);
    if (selected.length >= limit) return selected;
  }
  for (const candidate of ranked) {
    if (seen.has(candidate.semanticKey)) continue;
    seen.add(candidate.semanticKey);
    selected.push(candidate.state);
    if (selected.length >= limit) break;
  }
  return selected;
}
function turnOptions(
  states: SearchState[],
  desired: StorySolveOutcome,
  width: number,
  budget: SearchBudget,
): SearchState[] {
  const localWidth = Math.max(8, width * 2);
  let frontier = selectStates(states, desired, localWidth, 2);
  const stoppable = [...frontier];

  for (
    let depth = 0;
    depth < MAX_PLAYER_ACTIONS_PER_TURN;
    depth += 1
  ) {
    const expanded: SearchState[] = [];
    for (const current of frontier) {
      const candidates: SearchState[] = [];
      const squabbleAvailable =
        !(
          current.match.squabbleByOwner?.player ??
          current.match.squabbleUsed
        );
      const squabbleCardByLane = new Map<Lane, string>();
      if (squabbleAvailable) {
        for (const lane of [0, 1, 2] as Lane[]) {
          const strongest = current.match.playerHand
            .filter(card => canAffordSelection(
              current.match,
              "player",
              card.instanceId,
              lane,
            ))
            .sort((a, b) =>
              b.basePower - a.basePower ||
              a.instanceId.localeCompare(b.instanceId),
            )[0];
          if (strongest) {
            squabbleCardByLane.set(lane, strongest.instanceId);
          }
        }
      }
      for (const card of current.match.playerHand) {
        for (const lane of [0, 1, 2] as Lane[]) {
          if (
            !canAffordSelection(
              current.match,
              "player",
              card.instanceId,
              lane,
            )
          ) {
            continue;
          }
          const canSquabble =
            squabbleAvailable &&
            (current.match.round >= getMatchRoundLimit(current.match) - 1 ||
              squabbleCardByLane.get(lane) === card.instanceId);
          for (const squabble of canSquabble
            ? [false, true]
            : [false]) {
            budget.expansions += 1;
            if ((budget.expansions & 7) === 0) {
              assertBudget(budget);
            }
            try {
              candidates.push({
                match: compact(
                  playTurnCard(
                    current.match,
                    "player",
                    card.instanceId,
                    lane,
                    squabble,
                  ),
                ),
                moves: [
                  ...current.moves,
                  {
                    cardInstanceId: card.instanceId,
                    lane,
                    squabble,
                    endTurn: false,
                  },
                ],
              });
            } catch {
              // A story modifier can reject a choice after the generic cost
              // check. That branch is not a legal candidate.
            }
          }
        }
      }
      assertBudget(budget);
      expanded.push(...selectStates(candidates, desired, Math.max(8, width), 2));
      assertBudget(budget);
    }
    if (expanded.length === 0) break;
    frontier = selectStates(expanded, desired, localWidth, 2);
    stoppable.push(...frontier);
    assertBudget(budget);
  }

  return selectStates(stoppable, desired, width, 1);
}

function allPassTranscript(initial: Match): {
  match: Match;
  moves: PlayerMove[];
} {
  let match = compact(initial);
  const moves: PlayerMove[] = [];
  const roundLimit = getMatchRoundLimit(initial);
  for (
    let round = 0;
    round < roundLimit && match.phase !== "complete";
    round += 1
  ) {
    match = compact(
      nextRound(revealCpuTurn(pass(match, "player"))),
    );
    moves.push({
      cardInstanceId: null,
      lane: null,
      squabble: false,
      endTurn: true,
    });
  }
  return { match, moves };
}

function search(
  initial: Match,
  desired: StorySolveOutcome,
  width: number,
  budget: SearchBudget,
): PlayerMove[] | null {
  let frontier: SearchState[] = [
    { match: compact(initial), moves: [] },
  ];
  const cpuTransitionCache = new Map<string, Match>();
  const roundLimit = getMatchRoundLimit(initial);

  for (let round = 0; round < roundLimit; round += 1) {
    const options = turnOptions(
      frontier,
      desired,
      width,
      budget,
    );
    assertBudget(budget);
    const advanced: SearchState[] = [];
    for (const option of options) {
      if (option.match.phase === "complete") {
        advanced.push(option);
        continue;
      }
      const cacheKey = semanticMatchKey(option.match);
      let match = cpuTransitionCache.get(cacheKey);
      if (!match) {
        match = compact(
          nextRound(
            revealCpuTurn(pass(option.match, "player")),
          ),
        );
        cpuTransitionCache.set(cacheKey, match);
      }
      const next = {
        match,
        moves: [
          ...option.moves,
          {
            cardInstanceId: null,
            lane: null,
            squabble: false,
            endTurn: true,
          },
        ],
      };
      if (
        match.phase === "complete" &&
        (desired === "win"
          ? getMatchWinner(match) === "player"
          : getMatchWinner(match) === "cpu")
      ) {
        assertBudget(budget);
        return next.moves;
      }
      advanced.push(next);
      assertBudget(budget);
    }
    frontier = selectStates(advanced, desired, width, 2);
    if (frontier.length === 0) break;
  }

  return null;
}

/**
 * Finds a legal deterministic transcript with a bounded end-of-round beam.
 * Player-turn exploration is cheap and wider; only diverse candidates pay for
 * the rival's full deterministic response.
 */
export function solveStoryMoves(
  initial: Match,
  desired: StorySolveOutcome = "win",
  maximumStates = 32,
): PlayerMove[] {
  const maximumWidth = Math.max(
    8,
    Math.min(maximumStates, 32),
  );
  const budget: SearchBudget = {
    deadline: Date.now() + STORY_SOLVER_NODE_BUDGET_MS,
    expansions: 0,
    maximumExpansions: STORY_SOLVER_MAX_EXPANSIONS,
  };

  const searchInitial = suppressMatchPresentationEvents(initial);

  if (desired === "loss") {
    const passed = allPassTranscript(searchInitial);
    if (
      passed.match.phase === "complete" &&
      getMatchWinner(passed.match) === "cpu"
    ) {
      return passed.moves;
    }
  }

  const widths = [8, 12, 16, 24, 32].filter((width) => width <= maximumWidth);
  if (!widths.includes(maximumWidth)) widths.push(maximumWidth);
  for (const width of widths) {
    const moves = search(
      searchInitial,
      desired,
      width,
      budget,
    );
    if (moves) {
      assertBudget(budget);
      return moves;
    }
    assertBudget(budget);
  }

  throw new Error(
    `Could not find a legal story ${desired} within ${widths.join("/")}-state beams`,
  );
}