import type { StoryPuzzleDefinition } from "@workspace/squabblemon-engine/story";
import { getAssetUrl } from "../../../lib/assets";
export function KumiteManualInstrument({
  puzzle,
  order,
}: {
  puzzle: StoryPuzzleDefinition;
  order: readonly string[];
}) {
  const meridian = puzzle.id.endsWith("meridian-map"),
    chakra = puzzle.id.endsWith("glo-conduit");
  const anchors: Record<string, readonly [number, number]> = meridian
    ? {
        "carotid-gate": [49, 9],
        "brachial-knot": [30, 39],
        "solar-plexus": [50, 51],
        "floating-rib": [65, 57],
        "liver-hook": [60, 64],
      }
    : {
        "root-stance": [50, 83],
        "sacral-hip-torque": [50, 72],
        "solar-core": [50, 61],
        "heart-rhythm": [50, 49],
        "throat-kiai": [50, 38],
        "third-eye-read": [50, 26],
        "crown-glo": [50, 15],
      };
  const points = order.map(
    (id, i) =>
      anchors[id] ?? [12 + (76 * i) / Math.max(1, order.length - 1), 75],
  );
  return (
    <figure
      className="kumite-manual-chart"
      aria-label={`${puzzle.title}: current training sequence`}
    >
      <div className="kumite-manual-chart__plate">
        <img src={getAssetUrl(puzzle.imageAssetId)} alt="" decoding="async" />
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <polyline points={points.map((p) => p.join(",")).join(" ")} />
        </svg>
        {order.map((id, i) => (
          <span
            key={id}
            className="kumite-manual-chart__pin"
            style={{ left: `${points[i][0]}%`, top: `${points[i][1]}%` }}
            title={puzzle.pieces.find((p) => p.id === id)?.label}
          >
            {i + 1}
          </span>
        ))}
      </div>
      <figcaption>
        {meridian || chakra ? "TRACE THE CHAIN" : "BUILD THE SEQUENCE"} ·{" "}
        {order.length} BEATS{" "}
        <small>
          {order
            .map((id) => puzzle.pieces.find((p) => p.id === id)?.label)
            .join(" → ")}
        </small>
      </figcaption>
    </figure>
  );
}
