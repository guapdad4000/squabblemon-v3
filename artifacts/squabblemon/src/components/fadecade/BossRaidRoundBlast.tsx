import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import type { BossBlast } from "@workspace/squabblemon-engine/bossRaid";
export function BossRaidRoundBlast({ blast }: { blast: BossBlast }) {
  const ref = useRef<HTMLDivElement>(null);
  const [geometry, setGeometry] = useState<{
    width: number;
    height: number;
    target: [number, number];
    sources: [number, number][];
  } | null>(null);
  useLayoutEffect(() => {
    const arena = ref.current?.parentElement;
    const boss = arena?.querySelector<HTMLElement>(".raid-boss-inspect");
    if (!arena || !boss) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const a = arena.getBoundingClientRect(),
          b = boss.getBoundingClientRect();
        const sources = Array.from(
          arena.querySelectorAll<HTMLElement>(".raid-crew"),
        ).map((crew) => {
          const cards = Array.from(
            crew.querySelectorAll<HTMLElement>(".collector-card"),
          );
          const boxes = (cards.length ? cards : [crew]).map((card) =>
            card.getBoundingClientRect(),
          );
          return [
            boxes.reduce((sum, c) => sum + c.x + c.width / 2, 0) /
              boxes.length -
              a.x,
            boxes.reduce((sum, c) => sum + c.y + c.height / 2, 0) /
              boxes.length -
              a.y,
          ] as [number, number];
        });
        setGeometry({
          width: a.width,
          height: a.height,
          target: [b.x + b.width / 2 - a.x, b.y + b.height * 0.4 - a.y],
          sources,
        });
      });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(arena);
    measure();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [blast]);
  const target = geometry?.target ?? [0, 0];
  return (
    <div
      ref={ref}
      className="raid-blast"
      aria-hidden="true"
      data-testid="raid-round-strike"
    >
      {geometry && (
        <svg
          viewBox={`0 0 ${geometry.width} ${geometry.height}`}
          preserveAspectRatio="none"
        >
          {geometry.sources.map(([x, y], i) =>
            blast.damage[i] > 0 ? (
              <g
                key={i}
                style={{ "--blast-delay": `${i * 90}ms` } as CSSProperties}
              >
                <circle className="raid-charge-origin" cx={x} cy={y} r="24" />
                <path
                  className="raid-charge-aura"
                  d={`M${x},${y} Q${x},${target[1] + 60} ${target[0]},${target[1]}`}
                />
                <path
                  className="raid-charge"
                  d={`M${x},${y} Q${x},${target[1] + 60} ${target[0]},${target[1]}`}
                />
              </g>
            ) : null,
          )}
          {blast.total > 0 && (
            <g>
              <circle
                className="raid-impact-halo"
                cx={target[0]}
                cy={target[1]}
                r="65"
              />
              <circle
                className="raid-impact"
                cx={target[0]}
                cy={target[1]}
                r="35"
              />
              {Array.from({ length: 12 }, (_, i) => (
                <path
                  key={i}
                  className="raid-impact-spark"
                  d={`M${target[0]},${target[1]} L${target[0] + Math.cos((i * Math.PI) / 6) * 95},${target[1] + Math.sin((i * Math.PI) / 6) * 95}`}
                />
              ))}
            </g>
          )}
        </svg>
      )}
      <strong
        style={geometry ? { top: target[1] + 25, left: target[0] } : undefined}
      >
        <small>{blast.total ? "CREW STRIKE" : "ARMOR HELD"}</small>
        {blast.total ? `−${blast.total}` : "BLOCKED"}
      </strong>
    </div>
  );
}
