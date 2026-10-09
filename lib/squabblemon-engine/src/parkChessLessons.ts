import { Chess, type Move } from "chess.js";
import type { ParkChessColor, ParkChessMove, ParkChessMoveInput, ParkChessPiece } from "./parkChess";

export type ParkChessLessonId = "move-capture" | "protect-guap" | "ashlee-mate";
export type ParkChessLessonStep = {
  id: string;
  title: string;
  instruction: string;
  hint: string;
  startFen: string;
  expectedMove: ParkChessMoveInput;
  reply?: ParkChessMoveInput;
  success: string;
};
export type ParkChessLessonDefinition = {
  id: ParkChessLessonId;
  title: string;
  subtitle: string;
  steps: ParkChessLessonStep[];
};

/** These are separate practice tables, never ranked runs or reward claims. */
export const PARK_CHESS_LESSONS: ParkChessLessonDefinition[] = [
  {
    id: "move-capture", title: "Move & Capture", subtitle: "Meet all six pieces. Learn how each Squabbler moves.",
    steps: [
      {
        id: "pawn-forward", title: "Pawn · first steps",
        instruction: "Move the pawn from E2 to E4. From its starting square, a pawn may move two squares forward if both are empty.",
        hint: "Select the pawn on E2, then E4. White moves toward the top of the board.",
        startFen: "7k/8/8/8/8/8/4P3/7K w - - 0 1", expectedMove: { from: "e2", to: "e4" }, reply: { from: "h8", to: "g8" },
        success: "Two clean steps. After its first move, a pawn normally advances one square at a time.",
      },
      {
        id: "pawn-capture", title: "Pawn · diagonal capture",
        instruction: "Capture the black pawn on D5 with your pawn on E4. Pawns capture one square diagonally forward.",
        hint: "Select E4, then D5. Pawns move straight ahead but capture diagonally.",
        startFen: "7k/8/8/3p4/4P3/8/8/7K w - - 0 1", expectedMove: { from: "e4", to: "d5" }, reply: { from: "h8", to: "g8" },
        success: "Pawn capture. Your pawn took the rival's square; pawns cannot capture straight ahead.",
      },
      {
        id: "rook-capture", title: "Rook · straight lines",
        instruction: "Move the rook from A1 to A6 and capture the pawn. Rooks travel along a clear row or column.",
        hint: "Select A1, then A6. A rook can go far, but cannot jump over another piece.",
        startFen: "7k/8/p7/8/8/8/8/R6K w - - 0 1", expectedMove: { from: "a1", to: "a6" }, reply: { from: "h8", to: "g8" },
        success: "Straight-line pressure. Rooks move and capture horizontally or vertically.",
      },
      {
        id: "bishop-capture", title: "Bishop · diagonals",
        instruction: "Move the bishop from C1 to H6 and capture the pawn. Bishops slide along a clear diagonal.",
        hint: "Trace C1 → D2 → E3 → F4 → G5 → H6. Every square stays the same color.",
        startFen: "7k/p7/7p/8/8/8/8/2B4K w - - 0 1", expectedMove: { from: "c1", to: "h6" }, reply: { from: "h8", to: "g8" },
        success: "Diagonal capture. A bishop always stays on its original square color.",
      },
      {
        id: "knight-capture", title: "Knight · the L jump",
        instruction: "Jump the knight from B1 to C3 and capture the pawn. Knights move two squares one way, then one sideways.",
        hint: "Select B1, then C3: two ranks up and one file right. Knights can jump over pieces.",
        startFen: "7k/7p/8/8/8/2p5/8/1N5K w - - 0 1", expectedMove: { from: "b1", to: "c3" }, reply: { from: "h8", to: "g8" },
        success: "L-shaped capture. Knights are the only ordinary pieces that jump over others.",
      },
      {
        id: "queen-capture", title: "Ashlee · queen power",
        instruction: "Move Ashlee from D1 to G4 and capture the pawn. A queen combines rook and bishop movement.",
        hint: "Select D1, then G4 along the clear diagonal. Ashlee can also move along rows and columns.",
        startFen: "7k/8/8/8/6p1/8/8/3Q3K w - - 0 1", expectedMove: { from: "d1", to: "g4" }, reply: { from: "h8", to: "h7" },
        success: "Ashlee has range. A queen moves along clear rows, columns or diagonals, without jumping.",
      },
      {
        id: "king-step", title: "GUAP · one safe square",
        instruction: "Move GUAP from H1 to G1. The king moves one square in any direction and must stay out of attack.",
        hint: "Select the king on H1, then the neighboring square G1.",
        startFen: "7k/8/8/8/8/8/7P/7K w - - 0 1", expectedMove: { from: "h1", to: "g1" }, reply: { from: "h8", to: "g8" },
        success: "Your leader is safe. You now know how all six chess pieces move and capture.",
      },
    ],
  },
  {
    id: "protect-guap", title: "Protect GUAP", subtitle: "Answer check, then learn the king-and-rook team move.",
    steps: [
      {
        id: "escape-check", title: "Step out of check",
        instruction: "The black rook attacks GUAP down the E file. Move the king from E1 to D1, away from that line.",
        hint: "Select E1, then D1. A king cannot remain in check or move onto an attacked square.",
        startFen: "4r2k/8/8/8/8/8/8/4KB2 w - - 0 1", expectedMove: { from: "e1", to: "d1" }, reply: { from: "e8", to: "e7" },
        success: "GUAP escaped. When you are in check, your next move must make the king safe.",
      },
      {
        id: "block-check", title: "Put someone in the way",
        instruction: "This time, block the rook's attack. Move your bishop from F1 to E2 between the rook and GUAP.",
        hint: "Select F1, then E2. Blocking works against a sliding rook, bishop or queen.",
        startFen: "4r2k/8/8/8/8/8/8/4KB2 w - - 0 1", expectedMove: { from: "f1", to: "e2" }, reply: { from: "h8", to: "g8" },
        success: "The bishop shields GUAP. Knight and pawn attacks cannot be blocked this way.",
      },
      {
        id: "capture-checker", title: "Take the attacker",
        instruction: "The checking rook on E2 is unprotected. Move GUAP from E1 to E2 and capture it.",
        hint: "Select E1, then E2. A king may capture only if the destination is safe.",
        startFen: "k7/8/8/8/8/8/4r3/4K2R w - - 0 1", expectedMove: { from: "e1", to: "e2" }, reply: { from: "a8", to: "b8" },
        success: "Attack stopped. You can escape check by moving the king, blocking the attack, or capturing the attacker.",
      },
      {
        id: "castle", title: "Castle with the rook",
        instruction: "Castle kingside: select GUAP on E1, then G1. Your rook will move from H1 to F1 automatically.",
        hint: "Both pieces have not moved, the path is clear, and E1, F1 and G1 are safe. Castling cannot start, pass through, or finish in check.",
        startFen: "r3k2r/pp3ppp/8/8/8/8/PP3PPP/R3K2R w KQkq - 0 1", expectedMove: { from: "e1", to: "g1" }, reply: { from: "e8", to: "c8" },
        success: "King and rook moved together. You have practiced all three answers to check and legal castling.",
      },
    ],
  },
  {
    id: "ashlee-mate", title: "Checkmate with Ashlee", subtitle: "Use the queen and your leader to close every escape.",
    steps: [
      {
        id: "force-retreat", title: "Force the rival back",
        instruction: "Move Ashlee from F5 to D5. Her diagonal attacks the rival king on G8, forcing a response.",
        hint: "Select the queen on F5, then D5. The D5–E6–F7–G8 diagonal gives check.",
        startFen: "6k1/8/6K1/5Q2/8/8/8/8 w - - 0 1", expectedMove: { from: "f5", to: "d5" }, reply: { from: "g8", to: "h8" },
        success: "Check. The rival retreated to H8; GUAP already covers the nearby seventh-rank escapes.",
      },
      {
        id: "back-rank-mate", title: "Close the back rank",
        instruction: "Move Ashlee from D5 to D8. She checks along the back rank while GUAP covers G7 and H7.",
        hint: "Select D5, then D8. The rival cannot move to G8, G7 or H7, block the check, or capture Ashlee.",
        startFen: "7k/8/6K1/3Q4/8/8/8/8 w - - 2 2", expectedMove: { from: "d5", to: "d8" },
        success: "Checkmate. A checked king with no legal escape ends the game; the king is never captured.",
      },
      {
        id: "supported-queen-mate", title: "Ashlee and GUAP finish together",
        instruction: "On this new table, move Ashlee from F7 to G7. GUAP on G6 protects her while she checks the rival king on H8.",
        hint: "Select F7, then G7. GUAP protects Ashlee, and the queen covers every escape around H8.",
        startFen: "7k/5Q2/6K1/8/8/8/8/8 w - - 0 1", expectedMove: { from: "f7", to: "g7" },
        success: "Protected-queen checkmate. You finished the lesson. Replay any tutorial whenever you want; practice awards no tickets.",
      },
    ],
  },
];

export type ParkChessLessonState = {
  lessonId: ParkChessLessonId;
  stepIndex: number;
  fen: string;
  moves: string[];
  phase: "active" | "complete";
  status: "ready" | "success";
  lastMove: ParkChessMove | null;
  lastPlayerMove: ParkChessMove | null;
  lastBotMove: ParkChessMove | null;
  feedback: string | null;
};
export type ParkChessLessonView = ParkChessLessonState & {
  lesson: ParkChessLessonDefinition;
  step: ParkChessLessonStep;
  board: ParkChessPiece[];
  legalMoves: ParkChessMove[];
  expectedMove: ParkChessMoveInput;
  turn: ParkChessColor;
  inCheck: boolean;
  checkmate: boolean;
};
export class ParkChessLessonError extends Error {
  constructor(public code: "wrong-move" | "invalid-move" | "step-complete" | "lesson-complete" | "unknown-lesson" | "corrupt-state", message: string) {
    super(message);
    this.name = "ParkChessLessonError";
  }
}

export function getParkChessLesson(id: string): ParkChessLessonDefinition {
  const lesson = PARK_CHESS_LESSONS.find(candidate => candidate.id === id);
  if (!lesson) throw new ParkChessLessonError("unknown-lesson", "Choose one of the three practice lessons.");
  return lesson;
}

function uci(move: ParkChessMoveInput): string {
  return move.from + move.to + (move.promotion ?? "");
}
function presentedMove(move: Move): ParkChessMove {
  return { from: move.from, to: move.to, ...(move.promotion ? { promotion: move.promotion as ParkChessMove["promotion"] } : {}), san: move.san };
}
function newStep(lesson: ParkChessLessonDefinition, stepIndex: number): ParkChessLessonState {
  const step = lesson.steps[stepIndex]!;
  return { lessonId: lesson.id, stepIndex, fen: new Chess(step.startFen).fen(), moves: [], phase: "active", status: "ready",
    lastMove: null, lastPlayerMove: null, lastBotMove: null, feedback: null };
}

export function createParkChessLesson(id: string): ParkChessLessonState {
  return newStep(getParkChessLesson(id), 0);
}

function restoredStep(state: ParkChessLessonState) {
  const lesson = getParkChessLesson(state.lessonId);
  const step = lesson.steps[state.stepIndex];
  if (!Number.isInteger(state.stepIndex) || !step) throw new ParkChessLessonError("corrupt-state", "Restart this practice lesson.");
  try {
    const chess = new Chess(step.startFen);
    const expected = [uci(step.expectedMove), ...(step.reply ? [uci(step.reply)] : [])];
    if ((state.status !== "ready" && state.status !== "success") ||
      (state.phase !== "active" && state.phase !== "complete") ||
      (state.status === "ready" && state.phase !== "active") ||
      (state.status === "success" && state.phase !== (state.stepIndex === lesson.steps.length - 1 ? "complete" : "active")) ||
      !Array.isArray(state.moves) ||
      (state.status === "ready" ? state.moves.length !== 0 : state.moves.join(" ") !== expected.join(" "))) throw new Error("Invalid practice progress");
    for (const move of state.moves) {
      if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move) || chess.isGameOver()) throw new Error("Invalid practice move");
      chess.move({ from: move.slice(0, 2), to: move.slice(2, 4), ...(move[4] ? { promotion: move[4] } : {}) });
    }
    if (chess.fen() !== state.fen) throw new Error("Practice position mismatch");
    return { lesson, step, chess };
  } catch {
    throw new ParkChessLessonError("corrupt-state", "Restart this practice lesson.");
  }
}

export function getParkChessLessonView(state: ParkChessLessonState): ParkChessLessonView {
  const { lesson, step, chess } = restoredStep(state);
  return { ...state, moves: [...state.moves], lesson, step, expectedMove: step.expectedMove,
    board: chess.board().flatMap(row => row.filter((piece): piece is ParkChessPiece => piece !== null)),
    legalMoves: state.status === "ready" ? chess.moves({ verbose: true }).map(presentedMove) : [],
    turn: chess.turn(), inCheck: chess.inCheck(), checkmate: chess.isCheckmate() };
}

export function playParkChessLessonMove(state: ParkChessLessonState, input: ParkChessMoveInput): ParkChessLessonState {
  if (state.phase === "complete") throw new ParkChessLessonError("lesson-complete", "Lesson complete. Replay whenever you want.");
  if (state.status === "success") throw new ParkChessLessonError("step-complete", "Nice move. Continue to the next practice table.");
  const { lesson, step, chess } = restoredStep(state);
  let move: Move;
  try {
    if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci(input))) throw new Error("Invalid square");
    move = chess.move(input);
  } catch {
    throw new ParkChessLessonError("invalid-move", "That move is not legal. " + step.hint);
  }
  if (uci(input) !== uci(step.expectedMove)) throw new ParkChessLessonError("wrong-move", "That move is legal, but this step has a different goal. " + step.hint);
  let lastBotMove: ParkChessMove | null = null;
  if (step.reply) {
    try {
      if (chess.isGameOver()) throw new Error("Reply after terminal position");
      lastBotMove = presentedMove(chess.move(step.reply));
    } catch {
      throw new ParkChessLessonError("corrupt-state", "Restart this practice lesson.");
    }
  }
  const lastPlayerMove = presentedMove(move);
  return { ...state, fen: chess.fen(), moves: [uci(input), ...(step.reply ? [uci(step.reply)] : [])],
    phase: state.stepIndex === lesson.steps.length - 1 ? "complete" : "active", status: "success",
    lastMove: lastBotMove ?? lastPlayerMove, lastPlayerMove, lastBotMove, feedback: step.success };
}

export function advanceParkChessLesson(state: ParkChessLessonState): ParkChessLessonState {
  const { lesson } = restoredStep(state);
  if (state.phase === "complete") return { ...state, moves: [...state.moves] };
  if (state.status !== "success") throw new ParkChessLessonError("wrong-move", "Finish the current move before continuing.");
  return newStep(lesson, state.stepIndex + 1);
}

/** Always available, including after a failed attempt or completed lesson. */
export function resetParkChessLesson(state: Pick<ParkChessLessonState, "lessonId">): ParkChessLessonState {
  return createParkChessLesson(state.lessonId);
}
