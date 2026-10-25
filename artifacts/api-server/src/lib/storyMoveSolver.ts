import {
  listLegalPlayIntents,
  getDistrictResults,
  getMatchRoundLimit,
  getMatchWinner,
  nextRound,
  pass,
  playTurnCard,
  revealCpuTurn,
  suppressMatchPresentationEvents,
  type Lane,
  type Match,
  type PlayerMove,
} from "@workspace/squabblemon-engine/gameEngine";

export type StorySolveOutcome = "win" | "loss";
type SearchScore = "margin" | "control";
type SearchState = { match: Match; moves: PlayerMove[] };
type SearchBudget = {
  deadline: number;
  expansions: number;
  maximumExpansions: number;
  preserveBanks?: boolean;
  score: SearchScore;
  // Engine transitions are immutable. Reuse exact states between beam attempts
  // without trusting the semantic key to substitute one Match for another.
  plays: WeakMap<Match, Map<string, Match>>;
  cpuTurns: WeakMap<Match, Match>;
};

export const STORY_SOLVER_NODE_BUDGET_MS = 10_000;
export const STORY_SOLVER_MAX_EXPANSIONS = 40_000;
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

function value(match: Match, desired: StorySolveOutcome, score: SearchScore = "margin"): number {
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
    match.playerHand.length * 0.1 +
    match.playerHand.reduce((total, card) => total + card.basePower, 0) * 25;
  // Conditional comeback cards punish overcommitting to a temporary lead.
  // This alternative values actual district control with diminishing returns,
  // preserving contested lanes and banked setup instead of only raw margins.
  const controlValue = terminal
    + evaluation.playerDistricts * 150 - evaluation.cpuDistricts * 150
    + evaluation.margins.reduce((total, margin) => total + 120 * margin / (4 + Math.abs(margin)), 0)
    + match.playerMotion * 3
    + match.playerHand.reduce((total, card) => total + card.basePower, 0) * 2;
  const result = score === "control" ? controlValue : playerValue;
  return desired === "win" ? result : -result;
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

export function storySearchStateKey(match: Match): string {
  const cached = semanticKeyCache.get(match);
  if (cached) return cached;
  // Only immutable inputs shared by a single solve and presentation bookkeeping
  // are omitted. nextEventSequence stays: it also seeds deterministic effects.
  // Traps, counters, delayed effects and future engine fields stay
  // in the identity; a hand-picked field list merged distinct legal branches.
  const { effectLog: _events,
    playerDeck: _playerDeck, cpuDeck: _cpuDeck, playerCardIds: _playerDeckCards,
    cpuCardIds: _cpuDeckCards, storyEncounter: _encounter,
    abilityUpgradeSnapshot: _upgrades, districtSnapshot: _districts,
    ...state } = match;
  const key = JSON.stringify(state, (key, value) => key === "lastEffectNote" ? undefined : value);
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
  score: SearchScore = "margin",
): SearchState[] {
  const ranked = states.map(state => ({
    state,
    score: value(state.match, desired, score),
    semanticKey: storySearchStateKey(state.match),
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
  let frontier = selectStates(states, desired, localWidth, 2, budget.score);
  const stoppable = [...frontier];

  for (
    let depth = 0;
    depth < MAX_PLAYER_ACTIONS_PER_TURN;
    depth += 1
  ) {
    const expanded: SearchState[] = [];
    for (const current of frontier) {
      const candidates: SearchState[] = [];
      for (const choice of listLegalPlayIntents(current.match, "player")) {
        let plays = budget.plays.get(current.match);
        if (!plays) {
          plays = new Map();
          budget.plays.set(current.match, plays);
        }
        const key = `${choice.instanceId}:${choice.lane}:${choice.squabble}:${choice.investment}`;
        let resolved = plays.get(key);
        if (!resolved) {
          budget.expansions += 1;
          if ((budget.expansions & 7) === 0) assertBudget(budget);
          try {
            resolved = compact(playTurnCard(
              current.match, "player", choice.instanceId, choice.lane,
              choice.squabble, choice.investment,
            ));
            plays.set(key, resolved);
          } catch {
            // Encounter-specific restrictions may still reject a generic intent.
            continue;
          }
        }
        candidates.push({
          match: resolved,
          moves: [...current.moves, {
            cardInstanceId: choice.instanceId,
            lane: choice.lane,
            squabble: choice.squabble,
            investment: choice.investment,
            endTurn: false,
          }],
        });
      }
      assertBudget(budget);
      expanded.push(...selectStates(candidates, desired, Math.max(8, width), 2, budget.score));
      assertBudget(budget);
    }
    if (expanded.length === 0) break;
    frontier = selectStates(expanded, desired, localWidth, 2, budget.score);
    stoppable.push(...frontier);
    assertBudget(budget);
  }

  if (!budget.preserveBanks) return selectStates(stoppable, desired, width, 1, budget.score);
  // A cheap play must not crowd every bank-and-save option out of the beam.
  // Keep the best outcome for each remaining-hand / SQUABBLE combination,
  // then fill the rest by the usual district score and semantic diversity.
  const bankedOptions = new Map<string, SearchState>();
  for (const state of stoppable) {
    const key = `${state.match.playerHand.length}:${state.match.squabbleUsed ? 1 : 0}`;
    const previous = bankedOptions.get(key);
    if (!previous || value(state.match, desired, budget.score) > value(previous.match, desired, budget.score)) bankedOptions.set(key, state);
  }
  const reserved = selectStates([...bankedOptions.values()], desired, Math.ceil(width / 2), 1, budget.score);
  const seen = new Set(reserved.map(state => storySearchStateKey(state.match)));
  return [...reserved, ...selectStates(stoppable, desired, width, 1, budget.score)
    .filter(state => !seen.has(storySearchStateKey(state.match)))].slice(0, width);
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
      let match = budget.cpuTurns.get(option.match);
      if (!match) {
        match = compact(
          nextRound(
            revealCpuTurn(pass(option.match, "player")),
          ),
        );
        budget.cpuTurns.set(option.match, match);
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
    frontier = selectStates(advanced, desired, width, 2, budget.score);
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
  maximumStates = 64,
): PlayerMove[] {
  const maximumWidth = Math.max(
    8,
    Math.min(maximumStates, 64),
  );
  const budget: SearchBudget = {
    deadline: Date.now() + STORY_SOLVER_NODE_BUDGET_MS,
    expansions: 0,
    score: "margin",
    maximumExpansions: STORY_SOLVER_MAX_EXPANSIONS,
    plays: new WeakMap(),
    cpuTurns: new WeakMap(),
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

  const widths = [8, 16, 32, 64].filter((width) => width <= maximumWidth);
  if (!widths.includes(maximumWidth)) widths.push(maximumWidth);
  // A medium beam handles ordinary turns cheaply. Multi-phase bosses may
  // demand banking for a scripted late swing; non-phased matches can need a
  // wider greedy beam to survive the rival's full response.
  // Try a genuinely different evaluation before repeating smaller beams.
  // All policies share one deadline, expansion ceiling and transition cache.
  const bankFirst = (initial.storyEncounter?.phases?.length ?? 0) > 0;
  const attempts: Array<[number, boolean, SearchScore]> = [
    [16, false, "margin"],
    ...(bankFirst ? [[16, true, "margin"]] as Array<[number, boolean, SearchScore]> : []),
    [16, false, "control"],
    [64, false, "control"],
    [64, false, "margin"],
    ...widths.flatMap((width): Array<[number, boolean, SearchScore]> => [
      [width, false, "margin"], [width, true, "margin"],
      [width, false, "control"], [width, true, "control"],
    ]),
  ];
  const attempted = new Set<string>();
  for (const [width, preserveBanks, score] of attempts) {
    const policy = `${width}:${preserveBanks}:${score}`;
    if (width > maximumWidth || attempted.has(policy)) continue;
    attempted.add(policy);
    budget.preserveBanks = preserveBanks;
    budget.score = score;
    const moves = search(searchInitial, desired, width, budget);
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