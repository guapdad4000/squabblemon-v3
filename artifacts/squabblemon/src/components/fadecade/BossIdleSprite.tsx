import { useEffect, useId, useRef, type CSSProperties } from "react";
import { getAssetUrl } from "../../lib/assets";
import { observeMotionElement } from "./AnimatedSprite";
export function BossIdleSprite({
  asset,
  name,
  className = "",
  paused = false,
  reduced = false,
}: {
  asset: string;
  name: string;
  className?: string;
  paused?: boolean;
  reduced?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null),
    clip = useId().replace(/:/g, "");
  useEffect(
    () => (ref.current ? observeMotionElement(ref.current) : undefined),
    [],
  );
  return (
    <span
      ref={ref}
      className={`boss-idle ${className}`}
      data-boss-sprite={asset}
      data-paused={paused || reduced}
      role="img"
      aria-label={name}
      style={
        { "--idle-offset": `${(asset.length % 4) * -180}ms` } as CSSProperties
      }
    >
      <svg viewBox="0 0 320 480" focusable="false" aria-hidden="true">
        <defs>
          <clipPath id={clip}>
            <rect width="320" height="480" />
          </clipPath>
        </defs>
        <g clipPath={`url(#${clip})`}>
          <image
            className={asset === "feds" ? "boss-idle-feds" : "boss-idle-frames"}
            href={getAssetUrl(asset === "feds" ? "assets/boss-raid/feds.webp" : `assets/boss-raid/motion-v2/${asset}.webp`)}
            width={asset === "feds" ? "320" : "1280"}
            height="480"
          />
        </g>
      </svg>
    </span>
  );
}
