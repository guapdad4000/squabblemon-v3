/** Internal computer-match estimate. These bot anchors are not calibrated human Elo. */
export const PARK_CHESS_RATING_START = 800;
export const PARK_CHESS_RATING_K = 32;
export const PARK_CHESS_RATING_MIN = 100;
export const PARK_CHESS_RATING_MAX = 3000;
export const PARK_CHESS_RATING_PROVISIONAL_GAMES = 10;
export const PARK_CHESS_OPPONENT_RATINGS = [600, 800, 1000, 1200, 1400] as const;

export type ParkChessRatingState = { value: number; games: number; peak: number };
export type ParkChessRatingResult = "win" | "loss" | "draw";
export type ParkChessRatingChange = {
  before: number;
  after: number;
  delta: number;
  opponent: number;
  result: ParkChessRatingResult;
};

export function createParkChessRating(): ParkChessRatingState {
  return { value: PARK_CHESS_RATING_START, games: 0, peak: PARK_CHESS_RATING_START };
}

function validRating(value: number) {
  return Number.isSafeInteger(value) && value >= PARK_CHESS_RATING_MIN && value <= PARK_CHESS_RATING_MAX;
}

export function getParkChessOpponentRating(tier: number): number {
  if (!Number.isInteger(tier) || tier < 1 || tier > PARK_CHESS_OPPONENT_RATINGS.length) {
    throw new RangeError("Choose a valid park opponent tier.");
  }
  return PARK_CHESS_OPPONENT_RATINGS[tier - 1]!;
}

/** Elo's continuous expected-score curve, without a 400-point difference cap. */
export function expectedParkChessScore(player: number, opponent: number): number {
  if (!validRating(player) || !validRating(opponent)) throw new RangeError("Invalid Park Rating.");
  return 1 / (1 + 10 ** ((opponent - player) / 400));
}

/** Called only by authoritative match settlement, never by a client or tutorial. */
export function settleParkChessRating(state: ParkChessRatingState, tier: number, result: ParkChessRatingResult, opponentSnapshot?: number): {
  state: ParkChessRatingState;
  change: ParkChessRatingChange;
} {
  if (!validRating(state.value) || !validRating(state.peak) || state.peak < state.value ||
      !Number.isSafeInteger(state.games) || state.games < 0 || state.games === Number.MAX_SAFE_INTEGER) {
    throw new RangeError("Invalid saved Park Rating.");
  }
  const scores = { win: 1, loss: 0, draw: 0.5 };
  if (!Object.hasOwn(scores, result)) throw new RangeError("Invalid rated match result.");
  const tierRating = getParkChessOpponentRating(tier);
  const opponent = opponentSnapshot ?? tierRating;
  const rawChange = PARK_CHESS_RATING_K * (scores[result] - expectedParkChessScore(state.value, opponent));
  const roundedChange = rawChange < 0 ? -Math.round(-rawChange) : Math.round(rawChange);
  const after = Math.min(PARK_CHESS_RATING_MAX, Math.max(PARK_CHESS_RATING_MIN, state.value + roundedChange));
  return {
    state: { value: after, games: state.games + 1, peak: Math.max(state.peak, after) },
    change: { before: state.value, after, delta: after - state.value, opponent, result },
  };
}
