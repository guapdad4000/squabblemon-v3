import { useEffect, useRef } from "react";
import { getAssetUrl } from "../../lib/assets";
import { observePlayback } from "../../lib/battleMediaPlayback";
import "../../styles/dojo-expansion.css";
export type DojoSpritePhase = "idle" | "windup" | "strike" | "recoil";
export function DojoMotionSprite({
  asset,
  name,
  className = "",
  paused = false,
  reduced = false,
  phase = "idle",
}: {
  asset: string;
  name: string;
  className?: string;
  paused?: boolean;
  reduced?: boolean;
  phase?: DojoSpritePhase;
}) {
  const ref = useRef<HTMLImageElement>(null);
  const stem = `assets/boss-raid/dojo-motion/${asset.replace("dojo:", "")}`;
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const set = (moving: boolean) => {
      const suffix =
        phase === "idle"
          ? moving && !paused && !reduced
            ? ""
            : "-still"
          : `-${phase}`;
      const url = getAssetUrl(stem + suffix + ".webp");
      if (node.getAttribute("src") !== url) node.setAttribute("src", url);
    };
    set(false);
    if (paused || reduced || phase !== "idle") return;
    return observePlayback(node, set);
  }, [stem, phase, paused, reduced]);
  return (
    <span
      className={`boss-idle dojo-motion ${className}`}
      data-dojo-phase={phase}
      data-reduced-motion={reduced}
      data-paused={paused}
      role="img"
      aria-label={name}
    >
      <img
        ref={ref}
        src={getAssetUrl(stem + "-still.webp")}
        alt=""
        width="320"
        height="480"
        draggable={false}
        decoding="async"
      />
    </span>
  );
}
