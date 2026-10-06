import { Link } from "wouter";
import type { ArcadeKind } from "@workspace/squabblemon-engine/arcadeGames";
import { ArcadeCabinet } from "./MachineScreen";
import { getAssetUrl } from "../../lib/assets";
const cabinets = {
  "girl-fade": {
    title: "Girl Fade",
    tag: "GIRLS GOT HANDS",
    line: "READ / SLIP / COUNTER",
    test: "fadecade-training",
    art: "assets/fadecade/girl-fade.webp",
    scene: "girl-stage",
    ratio: 1.413,
    screen: { left: "17.51%", top: "27.2%", width: "66.43%", height: "52.15%" },
  },
  "fade-market": {
    title: "Fade Market",
    tag: "DAILY NIGHT SHIFT",
    line: "RESTOCK / DEFEND / SURVIVE",
    test: "fadecade-daily",
    art: "assets/arcade-games/market-cabinet.webp",
    scene: "market-stage",
    ratio: 1459 / 1078,
    screen: { left: "16.74%", top: "28.66%", width: "68%", height: "51.7%" },
  },
  "block-takeover": {
    title: "Block Takeover",
    tag: "WEEKLY TURF WAR",
    line: "CAPTURE / FORTIFY / TAKE OVER",
    test: "fadecade-weekly",
    art: "assets/arcade-games/block-cabinet.webp",
    scene: "block-stage",
    ratio: 1463 / 1075,
    screen: { left: "16.91%", top: "27.62%", width: "67.8%", height: "51.61%" },
  },
};
export function ArcadeGameCabinet({
  kind,
  onOpen,
}: {
  kind: ArcadeKind;
  onOpen: () => void;
}) {
  const c = cabinets[kind];
  return (
    <div className="fadecade-machine-group">
      <ArcadeCabinet
        artUrl={c.art}
        aspectRatio={c.ratio}
        aperture={c.screen}
        testId={c.test}
        className="machine-small"
      >
        <div className="new-arcade-preview" data-kind={kind}>
          <img
            src={getAssetUrl(`assets/arcade-games/${c.scene}.webp`)}
            alt=""
          />
          <small>{c.tag}</small>
          <strong>{c.title}</strong>
          <span>{c.line}</span>
          <button
            className="cabinet-btn"
            aria-label={`Open ${c.title}`}
            onClick={onOpen}
          >
            PLAY →
          </button>
        </div>
      </ArcadeCabinet>
      {kind === "girl-fade" && (
        <Link className="arcade-drills-link" href="/game/training">
          Training drills →
        </Link>
      )}
    </div>
  );
}
