import { useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import type { ParkChessView, ParkChessPieceType, ParkChessColor, ParkChessMove } from "@workspace/squabblemon-engine/parkChess";
import { HandFist, Star, Castle, Crosshair, Footprints, UserRound } from "lucide-react";
import { getAssetUrl } from "../../lib/assets";

const files = "abcdefgh";
const squares = Array.from({ length: 64 }, (_, i) => `${files[i % 8]}${8 - Math.floor(i / 8)}`);
export const chessPieceNames: Record<ParkChessPieceType, string> = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };
export const chessPieceIdentities: Partial<Record<ParkChessPieceType, string>> = { k: "GUAP", q: "Ashlee" };
export const chessPieceOrder: ParkChessPieceType[] = ["p", "r", "n", "b", "q", "k"];
const pieceIcons = { k: HandFist, q: Star, r: Castle, b: Crosshair, n: Footprints, p: UserRound };
const backRank: ParkChessPieceType[] = ["r", "n", "b", "q", "k", "b", "n", "r"];
export const chessStartingBoard: ParkChessView["board"] = squares.flatMap(square => {
  const rank = Number(square[1]);
  const type = rank === 1 || rank === 8 ? backRank[files.indexOf(square[0])] : rank === 2 || rank === 7 ? "p" : null;
  return type ? [{ square: square as ParkChessView["board"][number]["square"], type, color: (rank > 4 ? "b" : "w") as ParkChessColor }] : [];
});

export function ChessPiece({ type, color, compact = false }: { type: ParkChessPieceType; color: ParkChessColor; compact?: boolean }) {
  const Icon = pieceIcons[type];
  const [artFailed, setArtFailed] = useState(false);
  return <span className="park-chess__piece" data-color={color} data-type={type} data-compact={compact} aria-hidden="true">
    {!artFailed && <span className="park-chess__piece-art" style={{ "--piece-column": chessPieceOrder.indexOf(type), "--piece-row": color === "w" ? 0 : 1 } as CSSProperties}>
      <img src={getAssetUrl("assets/park-chess/pieces.webp")} alt="" draggable={false} onError={() => setArtFailed(true)} />
    </span>}
    {artFailed && <Icon className="park-chess__piece-fallback" />}
    <span className="park-chess__piece-role">{type.toUpperCase()}</span>
  </span>;
}

type BoardProps = {
  board: ParkChessView["board"];
  legalMoves: ParkChessView["legalMoves"];
  turn: ParkChessColor;
  inCheck: boolean;
  lastMove?: Pick<ParkChessMove, "from" | "to"> | null;
  selected: string | null;
  locked: boolean;
  busy?: boolean;
  focusSquare: string;
  onFocusSquare: (square: string) => void;
  onSelect: (square: string) => void;
  onEscape: () => void;
  hint?: { from: string; to: string } | null;
};

/** Ranked matches and local lessons share one board, atlas and keyboard model. */
export function ParkChessBoard({ board: pieces, legalMoves, turn, inCheck, lastMove, selected, locked, busy = false, focusSquare, onFocusSquare, onSelect, onEscape, hint }: BoardProps) {
  const board = useMemo(() => new Map(pieces.map(piece => [piece.square as string, piece])), [pieces]);
  const legal = legalMoves.filter(move => move.from === selected);
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  function boardKey(event: KeyboardEvent<HTMLButtonElement>, square: string) {
    const index = squares.indexOf(square);
    const target = event.key === "ArrowRight" ? Math.min(63, index + 1) : event.key === "ArrowLeft" ? Math.max(0, index - 1)
      : event.key === "ArrowDown" ? Math.min(63, index + 8) : event.key === "ArrowUp" ? Math.max(0, index - 8)
      : event.key === "Home" ? index - index % 8 : event.key === "End" ? index - index % 8 + 7 : null;
    if (target !== null) { event.preventDefault(); onFocusSquare(squares[target]); refs.current[squares[target]]?.focus(); }
    if (event.key === "Escape") onEscape();
  }
  return <div className="park-chess__board-frame">
    <div className="park-chess__board" role="grid" aria-label="Chess board, White at bottom" aria-busy={busy}>
      {Array.from({ length: 8 }, (_, row) => <div className="park-chess__rank" role="row" key={row}>{squares.slice(row * 8, row * 8 + 8).map((square, column) => {
        const piece = board.get(square);
        const target = legal.some(move => move.to === square);
        const check = !!piece && piece.type === "k" && piece.color === turn && inCheck;
        const guided = hint?.from === square || hint?.to === square;
        return <div role="gridcell" key={square}><button
          type="button" ref={el => { refs.current[square] = el; }} tabIndex={square === focusSquare ? 0 : -1}
          className="park-chess__square" data-square={square} data-dark={(row + column) % 2 === 1} data-selected={selected === square}
          data-legal={target} data-last={lastMove?.from === square || lastMove?.to === square} data-check={check} data-hint={guided}
          aria-label={`${square}${piece ? `, ${piece.color === "w" ? "White" : "Black"} ${chessPieceNames[piece.type]}${chessPieceIdentities[piece.type] ? `, ${chessPieceIdentities[piece.type]}` : ""}` : ", empty"}${target ? ", legal destination" : ""}${check ? ", in check" : ""}${guided ? ", lesson hint" : ""}`}
          title={piece && chessPieceIdentities[piece.type] ? `${chessPieceIdentities[piece.type]} · ${chessPieceNames[piece.type]}` : undefined}
          aria-pressed={selected === square} aria-disabled={locked} onClick={() => onSelect(square)} onFocus={() => onFocusSquare(square)} onKeyDown={event => boardKey(event, square)}>
          {piece && <ChessPiece type={piece.type} color={piece.color} />}
          {target && <span className="park-chess__legal" aria-hidden="true" />}
          {column === 0 && <span className="park-chess__coordinate park-chess__coordinate--rank" aria-hidden="true">{8 - row}</span>}
          {row === 7 && <span className="park-chess__coordinate park-chess__coordinate--file" aria-hidden="true">{files[column]}</span>}
        </button></div>;
      })}</div>)}
    </div>
  </div>;
}
