import { Chess, DEFAULT_POSITION, type Color, type Move, type PieceSymbol, type Square } from "chess.js";

/** Check the Block uses ordinary chess rules; only its presentation changes. */
export type ParkChessSquare = Square;
export type ParkChessPieceType = PieceSymbol;
export type ParkChessColor = Color;
export type ParkChessPromotion = "q" | "r" | "b" | "n";
export type ParkChessPhase = "active" | "won" | "lost" | "draw" | "resigned";
export type ParkChessReason = "checkmate" | "stalemate" | "threefold-repetition" | "fifty-move-rule" | "insufficient-material" | "resignation";
export type ParkChessMoveInput = { from: string; to: string; promotion?: ParkChessPromotion };
export type ParkChessMove = { from: Square; to: Square; promotion?: ParkChessPromotion; san: string };
export type ParkChessPiece = { square: Square; type: PieceSymbol; color: Color };

export const PARK_CHESS_TIERS = [
  { id: 1, name: "Rookie", depth: 0, nodeBudget: 0, blurb: "Learning the park. Unpredictable moves." },
  { id: 2, name: "Park Regular", depth: 1, nodeBudget: 96, blurb: "Spots captures and free pieces." },
  { id: 3, name: "Hustler", depth: 2, nodeBudget: 650, blurb: "Looks for your next reply." },
  { id: 4, name: "Tactician", depth: 3, nodeBudget: 1800, blurb: "Sets up traps and protects the crew." },
  { id: 5, name: "Block Master", depth: 4, nodeBudget: 4000, blurb: "The deepest search at the park." },
] as const;

export function getParkChessTier(tier: number) {
  return PARK_CHESS_TIERS[Math.max(0, Math.min(PARK_CHESS_TIERS.length - 1, Math.trunc(tier || 1) - 1))]!;
}

export function getNextParkChessTier(tier: number): number {
  return Math.min(PARK_CHESS_TIERS.length, getParkChessTier(tier).id + 1);
}

/** Store the complete server-authored history so repetition survives reloads. */
export type ParkChessRun = {
  id: string;
  tier: number;
  revision: number;
  startFen: string;
  fen: string;
  moves: string[];
  phase: ParkChessPhase;
  reason: ParkChessReason | null;
  lastPlayerMove: ParkChessMove | null;
  lastBotMove: ParkChessMove | null;
};

export type ParkChessView = ParkChessRun & {
  board: ParkChessPiece[];
  legalMoves: ParkChessMove[];
  captured: { w: PieceSymbol[]; b: PieceSymbol[] };
  turn: Color;
  inCheck: boolean;
};

export class ParkChessRuleError extends Error {
  constructor(public code: "invalid-move" | "run-over" | "wrong-turn" | "corrupt-run", message: string) {
    super(message);
    this.name = "ParkChessRuleError";
  }
}

function moveInput(uci: string): { from: Square; to: Square; promotion?: ParkChessPromotion } {
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) {
    throw new ParkChessRuleError("invalid-move", "Choose a legal square and promotion.");
  }
  return { from: uci.slice(0, 2) as Square, to: uci.slice(2, 4) as Square, ...(uci.length === 5 ? { promotion: uci[4] as ParkChessPromotion } : {}) };
}

function uci(move: Pick<Move, "from" | "to" | "promotion">): string {
  return move.from + move.to + (move.promotion ?? "");
}

function presentedMove(move: Move): ParkChessMove {
  return { from: move.from, to: move.to, ...(move.promotion ? { promotion: move.promotion as ParkChessPromotion } : {}), san: move.san };
}

/** No supplied FEN from the client participates in validation or rewards. */
function restoredPosition(run: ParkChessRun): Chess {
  try {
    const chess = new Chess(run.startFen);
    for (const previous of run.moves) {
      if (chess.isGameOver()) throw new Error("Moves after a terminal position");
      chess.move(moveInput(previous));
    }
    if (chess.fen() !== run.fen) throw new Error("Saved history and position disagree");
    return chess;
  } catch (error) {
    if (error instanceof ParkChessRuleError && error.code === "corrupt-run") throw error;
    throw new ParkChessRuleError("corrupt-run", "The saved game could not be restored.");
  }
}

export function createParkChessRun(id: string, tier: number): ParkChessRun {
  return {
    id, tier: getParkChessTier(tier).id, revision: 0, startFen: DEFAULT_POSITION, fen: DEFAULT_POSITION,
    moves: [], phase: "active", reason: null, lastPlayerMove: null, lastBotMove: null,
  };
}

function outcome(chess: Chess): { phase: ParkChessPhase; reason: ParkChessReason | null } {
  if (chess.isCheckmate()) return { phase: chess.turn() === "b" ? "won" : "lost", reason: "checkmate" };
  if (chess.isStalemate()) return { phase: "draw", reason: "stalemate" };
  if (chess.isThreefoldRepetition()) return { phase: "draw", reason: "threefold-repetition" };
  if (chess.isDrawByFiftyMoves()) return { phase: "draw", reason: "fifty-move-rule" };
  if (chess.isInsufficientMaterial()) return { phase: "draw", reason: "insufficient-material" };
  return { phase: "active", reason: null };
}

export function getParkChessView(run: ParkChessRun): ParkChessView {
  const chess = restoredPosition(run);
  const captured: ParkChessView["captured"] = { w: [], b: [] };
  for (const move of chess.history({ verbose: true })) {
    if (move.captured) captured[move.color === "w" ? "b" : "w"].push(move.captured);
  }
  return {
    ...run,
    moves: [...run.moves],
    board: chess.board().flatMap(row => row.filter((piece): piece is ParkChessPiece => piece !== null)),
    legalMoves: run.phase === "active" && !chess.isGameOver() ? chess.moves({ verbose: true }).map(presentedMove) : [],
    captured,
    turn: chess.turn(), inCheck: chess.inCheck(),
  };
}

const MATERIAL: Record<PieceSymbol, number> = { p: 100, n: 320, b: 335, r: 500, q: 900, k: 0 };
const MATE = 100_000;

/** Material plus modest development, pawn advance, king safety and centrality. */
function evaluate(chess: Chess, positional: boolean): number {
  let white = 0;
  for (const row of chess.board()) {
    for (const piece of row) {
      if (!piece) continue;
      const file = piece.square.charCodeAt(0) - 97;
      const rank = Number(piece.square[1]) - 1;
      const advance = piece.color === "w" ? rank : 7 - rank;
      const center = 7 - (Math.abs(file - 3.5) + Math.abs(rank - 3.5));
      let value = MATERIAL[piece.type];
      if (positional) {
        if (piece.type === "p") value += advance * 7 + center * 3;
        if (piece.type === "n") value += center * 12 - (advance === 0 ? 15 : 0);
        if (piece.type === "b") value += center * 7 + (advance > 0 ? 10 : 0);
        if (piece.type === "r") value += advance * 2;
        if (piece.type === "q") value += center * 2;
        if (piece.type === "k") value += advance < 2 && (file < 3 || file > 4) ? 24 : -advance * 8;
      }
      white += piece.color === "w" ? value : -value;
    }
  }
  return chess.turn() === "w" ? white : -white;
}

function hash(text: string): number {
  let value = 2166136261;
  for (let index = 0; index < text.length; index++) value = Math.imul(value ^ text.charCodeAt(index), 16777619);
  return value >>> 0;
}

function orderMoves(moves: Move[], best?: string): Move[] {
  const value = (move: Move) =>
    (uci(move) === best ? 100_000 : 0) + (move.captured ? 10 * MATERIAL[move.captured] - MATERIAL[move.piece] : 0) +
    (move.promotion ? MATERIAL[move.promotion] : 0) + (move.san.endsWith("#") ? 90_000 : move.san.endsWith("+") ? 50 : 0);
  return moves.sort((a, b) => value(b) - value(a) || uci(a).localeCompare(uci(b)));
}

export type ParkChessBotDecision = { move: ParkChessMove | null; depthCompleted: number; nodes: number; nodeBudget: number };

/**
 * Iterative alpha-beta search has a strict node budget, never an unbounded loop.
 * An incomplete iteration is discarded, retaining the last complete decision.
 * Tier one intentionally chooses a seeded random legal move; no reward client
 * can alter the bot, history, outcome or search tier.
 */
export function chooseParkChessBotMove(run: ParkChessRun): ParkChessBotDecision {
  return chooseBot(restoredPosition(run), run.tier, run.id);
}

function chooseBot(chess: Chess, tierNumber: number, seed: string): ParkChessBotDecision {
  const tier = getParkChessTier(tierNumber);
  const rootMoves = orderMoves(chess.moves({ verbose: true }));
  const empty = { move: null, depthCompleted: 0, nodes: 0, nodeBudget: tier.nodeBudget };
  if (chess.isGameOver() || !rootMoves.length) return empty;
  if (tier.id === 1) return { ...empty, move: presentedMove(rootMoves[hash(seed + chess.fen()) % rootMoves.length]!) };

  let nodes = 0;
  let bestMove = rootMoves[0]!;
  let depthCompleted = 0;
  const budgetExceeded = new Error("Search node budget reached");

  function search(depth: number, alpha: number, beta: number, ply: number): number {
    if (nodes >= tier.nodeBudget) throw budgetExceeded;
    nodes++;
    if (chess.isDrawByFiftyMoves() || chess.isThreefoldRepetition() || chess.isInsufficientMaterial()) return 0;
    if (depth === 0) {
      if (chess.inCheck() && chess.isCheckmate()) return -MATE + ply;
      return evaluate(chess, tier.id >= 3);
    }
    const moves = orderMoves(chess.moves({ verbose: true }));
    if (!moves.length) return chess.inCheck() ? -MATE + ply : 0;
    let value = -Infinity;
    for (const move of moves) {
      chess.move(move);
      let score: number;
      try { score = -search(depth - 1, -beta, -alpha, ply + 1); }
      finally { chess.undo(); }
      value = Math.max(value, score);
      alpha = Math.max(alpha, score);
      if (alpha >= beta) break;
    }
    return value;
  }

  for (let depth = 1; depth <= tier.depth; depth++) {
    let candidate = bestMove;
    let score = -Infinity;
    try {
      for (const move of orderMoves(rootMoves, uci(bestMove))) {
        chess.move(move);
        let value: number;
        try { value = -search(depth - 1, -Infinity, -score, 1); }
        finally { chess.undo(); }
        if (value > score) { score = value; candidate = move; }
      }
      bestMove = candidate;
      depthCompleted = depth;
      if (score >= MATE - 20) break;
    } catch (error) {
      if (error !== budgetExceeded) throw error;
      break;
    }
  }
  return { move: presentedMove(bestMove), depthCompleted, nodes, nodeBudget: tier.nodeBudget };
}

export function playParkChessMove(run: ParkChessRun, input: ParkChessMoveInput): ParkChessRun {
  if (run.phase !== "active") throw new ParkChessRuleError("run-over", "This game has already ended.");
  const chess = restoredPosition(run);
  if (chess.isGameOver()) throw new ParkChessRuleError("run-over", "This game has already ended.");
  if (chess.turn() !== "w") throw new ParkChessRuleError("wrong-turn", "Wait for the park opponent's move.");
  let played: Move;
  try {
    const requested = moveInput(input.from + input.to + (input.promotion ?? ""));
    played = chess.move(requested);
  } catch {
    throw new ParkChessRuleError("invalid-move", "That move is not legal. Choose one of the highlighted squares.");
  }
  const moves = [...run.moves, uci(played)];
  let result = outcome(chess);
  let lastBotMove: ParkChessMove | null = null;
  if (result.phase === "active") {
    const reply = chooseBot(chess, run.tier, run.id).move;
    if (!reply) throw new ParkChessRuleError("corrupt-run", "The park opponent could not finish its turn.");
    const botMove = chess.move(moveInput(reply.from + reply.to + (reply.promotion ?? "")));
    moves.push(uci(botMove));
    lastBotMove = presentedMove(botMove);
    result = outcome(chess);
  }
  return { ...run, ...result, revision: run.revision + 1, fen: chess.fen(), moves,
    lastPlayerMove: presentedMove(played), lastBotMove };
}

export function resignParkChessRun(run: ParkChessRun): ParkChessRun {
  if (run.phase !== "active") throw new ParkChessRuleError("run-over", "This game has already ended.");
  restoredPosition(run);
  return { ...run, phase: "resigned", reason: "resignation", revision: run.revision + 1, moves: [...run.moves] };
}
