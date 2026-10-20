import { useLayoutEffect, useRef } from 'react';

/** Track DOM geometry only while selection/layout settles or the hand moves. */
export function BattleTargetLine({ instanceId, lane }: { instanceId: string; lane: number }) {
  const svg = useRef<SVGSVGElement>(null);
  useLayoutEffect(() => {
    const node = svg.current;
    const arena = node?.closest<HTMLElement>('[data-testid="battle-arena"]');
    const hand = arena?.querySelector<HTMLElement>('[data-testid="hand-tray"]');
    const source = hand?.querySelector<HTMLElement>(`[data-instance-id="${CSS.escape(instanceId)}"]`);
    const target = arena?.querySelector<HTMLElement>(`[data-testid="lane-${lane}"]`);
    if (!node || !arena || !hand || !source || !target) return;
    // These SVG children are fixed for the lifetime of this selection. Capture
    // them once instead of querying the same subtree on every settling frame.
    const paths = node.querySelectorAll('path');
    const origin = node.querySelector('[data-origin]');
    const destination = node.querySelector('[data-destination]');
    let frame = 0, until = 0;
    const draw = () => {
      frame = 0;
      const a = arena.getBoundingClientRect(), s = source.getBoundingClientRect();
      const h = hand.getBoundingClientRect(), t = target.getBoundingClientRect();
      const left = Math.max(s.left, h.left), right = Math.min(s.right, h.right);
      const visible = right > left && s.bottom > h.top && s.top < h.bottom;
      node.style.visibility = visible ? 'visible' : 'hidden';
      if (visible) {
        const x = Math.max(left, Math.min(right, s.left + s.width / 2)) - a.left;
        const y = Math.max(s.top, h.top) - a.top;
        const tx = t.left + t.width / 2 - a.left, ty = t.bottom - a.top;
        const bend = Math.max(24, Math.abs(y - ty) * .45);
        const d = `M ${x} ${y} C ${x} ${y - bend}, ${tx} ${ty + bend}, ${tx} ${ty}`;
        paths.forEach(path => path.setAttribute('d', d));
        origin?.setAttribute('cx', String(x));
        origin?.setAttribute('cy', String(y));
        destination?.setAttribute('cx', String(tx));
        destination?.setAttribute('cy', String(ty));
      }
      if (performance.now() < until && !document.hidden) frame = requestAnimationFrame(draw);
    };
    const schedule = () => {
      // Framer selection/hover transforms need a short settling window, not an idle loop.
      until = performance.now() + 450;
      if (!frame && !document.hidden) frame = requestAnimationFrame(draw);
    };
    const visibility = () => { if (document.hidden) { cancelAnimationFrame(frame); frame = 0; } else schedule(); };
    const resize = new ResizeObserver(schedule);
    [arena, hand, source, target].forEach(element => resize.observe(element));
    arena.addEventListener('scroll', schedule, true);
    source.addEventListener('pointerenter', schedule);
    source.addEventListener('pointerleave', schedule);
    window.addEventListener('resize', schedule);
    document.addEventListener('visibilitychange', visibility);
    schedule();
    return () => {
      cancelAnimationFrame(frame); resize.disconnect();
      arena.removeEventListener('scroll', schedule, true);
      source.removeEventListener('pointerenter', schedule);
      source.removeEventListener('pointerleave', schedule);
      window.removeEventListener('resize', schedule);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [instanceId, lane]);
  return <svg ref={svg} className="battle-target-line" data-testid="battle-target-line" data-source-instance={instanceId} aria-hidden="true">
    <path className="battle-target-line__shadow" /><path className="battle-target-line__beam" />
    <circle data-origin r="3" /><circle data-destination r="5" />
  </svg>;
}
