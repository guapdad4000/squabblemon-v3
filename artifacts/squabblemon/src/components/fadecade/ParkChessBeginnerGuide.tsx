import { ChessPiece, chessPieceIdentities, chessPieceNames, chessPieceOrder } from "./ParkChessBoard";
import type { ParkChessPieceType } from "@workspace/squabblemon-engine/parkChess";

const movements: Record<ParkChessPieceType, string> = {
  p: "Forward one square; two from its starting square if clear. Capture one square diagonally forward. Never move backward.",
  r: "Any distance horizontally along rows (ranks) or vertically along columns (files).",
  n: "Two squares one way, then one sideways: an L. The only piece that jumps over others.",
  b: "Any distance diagonally. Each bishop stays on its starting color.",
  q: "Any distance straight or diagonally. Ashlee combines rook and bishop moves.",
  k: "One square in any direction. GUAP must never move into an attacked square.",
};

export function ParkChessBeginnerGuide() {
  return <div className="park-chess__guide">
    <p>White moves first; players alternate one legal move. The board has 8×8 squares: files a–h are columns, and ranks 1–8 are rows.</p>
    <p>Play White from the bottom. Select a Squabbler, then a marked legal square. Arrow keys explore; Enter selects or moves. Capture by landing on a rival. Pieces cannot pass through others, except knights.</p>
    <div className="park-chess__guide-pieces">{chessPieceOrder.map(type => <div key={type}><ChessPiece type={type} color="w" compact /><div><strong>{chessPieceIdentities[type] ? `${chessPieceIdentities[type]} · ${chessPieceNames[type]}` : chessPieceNames[type]}</strong><p>{movements[type]}</p></div></div>)}</div>
    <details open><summary>Check, checkmate & stalemate</summary><p><b>Check:</b> GUAP is attacked. Move him away, block the attack or capture the attacker. Every move must leave him safe.</p><p><b>Checkmate:</b> the checked king has no legal escape. The attacker wins. A king is never captured; checkmate ends the game. <b>Stalemate:</b> the player whose turn it is has no legal move but is not in check. That is a draw.</p></details>
    <details><summary>Castling</summary><p>Move GUAP two squares toward a rook; the rook lands beside him. Neither piece may have moved, the path must be clear, and GUAP cannot start in check or cross or land on an attacked square.</p></details>
    <details><summary>Promotion</summary><p>A pawn reaching the farthest rank becomes your choice of queen, rook, bishop or knight. Choosing a queen brings another Ashlee onto the board.</p></details>
    <details><summary>En passant</summary><p>If a rival pawn advances two squares and lands beside your pawn, you may capture it diagonally into the square it crossed. You must do this on your very next move.</p></details>
    <details><summary>Park Rating</summary><p>Your Park Rating starts at 800 and uses Elo to estimate performance against our computer rivals. Their ratings are internal estimates, not calibrated human Elo. Beating stronger rivals earns more; losses and resignations lower your rating. Draws adjust it based on rival strength. Your first 10 rated games are provisional. Tutorials and older saved matches are unrated; past results are not backfilled.</p></details>
    <p className="park-chess__guide-note">Checkmate wins bank one Pack Ticket. Beat your highest unlocked rival to open the next tier, up to Block Master. You can replay any unlocked tier for another ticket per win; earlier replays do not unlock higher tiers. Draws and resignations award none. Guided lessons are free practice with no tickets or ranked progress.</p>
  </div>;
}
