import { useEffect, useRef, useState } from "react";
/** Geometry follows the actual selected hand card; no permanent animation loop. */
export function BossRaidTargetLine({
  instanceId,
  lane,
}: {
  instanceId: string;
  lane: number;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const [path, setPath] = useState("");
  useEffect(() => {
    const svg = ref.current,
      arena = svg?.parentElement;
    if (!svg || !arena) return;
    const source = arena.querySelector<HTMLElement>(
      `[data-instance="${CSS.escape(instanceId)}"]`,
    );
    const target = arena.querySelector<HTMLElement>(
      `[data-lane="${lane}"] .raid-deploy`,
    );
    if (!source || !target) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const a = arena.getBoundingClientRect(),
          s = source.getBoundingClientRect(),
          t = target.getBoundingClientRect();
        const x = s.x + s.width / 2 - a.x,
          y = s.y - a.y,
          tx = t.x + t.width / 2 - a.x,
          ty = t.y + t.height / 2 - a.y;
        setPath(`M ${x} ${y} Q ${x} ${ty + 45} ${tx} ${ty}`);
      });
    };
    const observer = new ResizeObserver(measure);
    [arena, source, target].forEach((n) => observer.observe(n));
    window.addEventListener("scroll", measure, {
      capture: true,
      passive: true,
    });
    window.addEventListener("resize", measure);
    measure();
    const settle = setTimeout(measure, 220);
    return () => {
      clearTimeout(settle);
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [instanceId, lane]);
  return (
    <svg ref={ref} className="raid-target-line" aria-hidden="true">
      <path d={path} className="raid-target-shadow" />
      <path d={path} />
    </svg>
  );
}
