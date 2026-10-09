import type { CSSProperties } from "react";
import { ArcadeCabinet } from "./MachineScreen";
import { getAssetUrl } from "../../lib/assets";
import "../../styles/park-chess.css";
import "../../styles/park-chess-cabinet.css";

const previewCrew = [
  { role: "queen", color: "b", column: 4 },
  { role: "king", color: "b", column: 5 },
  { role: "king", color: "w", column: 5 },
  { role: "queen", color: "w", column: 4 },
] as const;

export function ParkChessCabinet({ onOpen }: { onOpen: () => void }) {
  return <section className="fadecade-machine-group park-chess-cabinet" aria-label="Check the Block arcade cabinet">
    <ArcadeCabinet artUrl="assets/park-chess/cabinet-v2.webp" aspectRatio={1460 / 1078} aperture={{ left: "16.55%", top: "29.2%", width: "67.5%", height: "50.3%" }} testId="fadecade-park-chess" className="machine-small">
      <div className="park-chess-cabinet__screen" style={{ "--chess-preview-scene": `url("${getAssetUrl("assets/park-chess/park-table.webp")}")` } as CSSProperties}>
        <div className="park-chess-cabinet__stage">
          <div className="park-chess-cabinet__copy">
            <strong>CHECK THE<br /><span>BLOCK</span></strong>
            <small lang="ja">チェス・バトル</small>
            <span>5 TIERS · 1 TICKET / WIN</span>
          </div>
          <div className="park-chess-cabinet__board" role="img" aria-label="Chess preview: GUAP is king and Ashlee is queen">
            <div className="park-chess-cabinet__tiles" aria-hidden="true">{Array.from({ length: 64 }, (_, i) => <i key={i} data-dark={(Math.floor(i / 8) + i % 8) % 2 === 1} />)}</div>
            <i className="park-chess-cabinet__target" aria-hidden="true" />
            {previewCrew.map((piece, index) => <span className="park-chess-cabinet__piece" key={index} data-position={index} data-color={piece.color} aria-hidden="true">
              <span className="park-chess-cabinet__sprite" style={{ "--chess-column": piece.column, "--chess-row": piece.color === "w" ? 0 : 1 } as CSSProperties}><img src={getAssetUrl("assets/park-chess/pieces.webp")} alt="" draggable={false} /></span>
              <b>{piece.role === "king" ? "K" : "Q"}</b>
            </span>)}
          </div>
        </div>
        <button type="button" className="cabinet-btn" aria-label="Open Check the Block" onClick={onOpen}>PLAY <span aria-hidden="true">→</span></button>
      </div>
    </ArcadeCabinet>
  </section>;
}
