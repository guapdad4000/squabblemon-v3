import { useEffect, useRef } from 'react';
import { getAssetUrl } from '../../lib/assets';
import '../../styles/kumite-arena.css';

/** Supplied aligned artwork stays independent of the live board and hit targets. */
export function KumiteArena({ reducedMotion = false, platform = true, className = '' }: { reducedMotion?: boolean; platform?: boolean; className?: string }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = root.current;
    if (!element || reducedMotion) return;
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    const move = (event: PointerEvent) => {
      if (preference.matches || event.pointerType !== 'mouse') return;
      cancelAnimationFrame(frame);
      const x = Math.max(-1, Math.min(1, event.clientX / innerWidth * 2 - 1));
      const y = Math.max(-1, Math.min(1, event.clientY / innerHeight * 2 - 1));
      frame = requestAnimationFrame(() => {
        element.style.setProperty('--arena-x', `${x * 5}px`);
        element.style.setProperty('--arena-y', `${y * 3}px`);
      });
    };
    const reset = () => { cancelAnimationFrame(frame); element.style.removeProperty('--arena-x'); element.style.removeProperty('--arena-y'); };
    window.addEventListener('pointermove', move, { passive: true });
    preference.addEventListener('change', reset);
    return () => { window.removeEventListener('pointermove', move); preference.removeEventListener('change', reset); reset(); };
  }, [reducedMotion]);
  return <div ref={root} className={`kumite-arena-scene ${className}`} aria-hidden="true">
    <img className="kumite-arena-scene__back" src={getAssetUrl('assets/kumite/layers/backdrop.webp')} alt="" draggable={false} fetchPriority="high" />
    <img className="kumite-arena-scene__stands" src={getAssetUrl('assets/kumite/layers/stands.webp')} alt="" draggable={false} />
    {platform && <img className="kumite-arena-scene__platform" src={getAssetUrl('assets/kumite/layers/platform.webp')} alt="" draggable={false} />}
    <div className="kumite-arena-scene__shade" />
  </div>;
}
