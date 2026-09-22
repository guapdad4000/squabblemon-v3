import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useReducedMotion } from 'framer-motion';
import { getAssetUrl } from '../../lib/assets';

type Layer = { name: string; x: number; y: number; width: number; height: number; depth: number };
type Scene = { width: number; height: number; layers: Layer[] };

/** Original centered art remains visible even if the optional cutouts fail to load. */
export function LayeredVenue({ scene }: { scene: 'fade-market' | 'gatcha-bg' }) {
  const root = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<Scene | null>(null);
  const reduced = useReducedMotion();
  const path = `assets/scenes/${scene}/`;
  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    fetch(getAssetUrl(path + 'layers.json'), { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error('Scene layers unavailable'); return r.json(); })
      .then(setData).catch(() => {});
    return () => controller.abort();
  }, [path]);
  useEffect(() => {
    const node = root.current;
    if (!node) return;
    let visible = true, frame = 0;
    const disabled = () => reduced || document.documentElement.dataset.reduceMotion === 'true';
    const fit = () => {
      const width = Math.max(node.clientWidth, node.clientHeight * 16 / 9) * 1.025;
      node.style.setProperty('--scene-width', width + 'px');
      node.style.setProperty('--scene-height', width * 9 / 16 + 'px');
    };
    const move = (x: number, y: number) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        node.style.setProperty('--scene-x', disabled() ? '0px' : x + 'px');
        node.style.setProperty('--scene-y', disabled() ? '0px' : y + 'px');
      });
    };
    const pointer = (e: PointerEvent) => {
      if (!visible || e.pointerType === 'touch') return;
      const rect = node.getBoundingClientRect();
      move(Math.max(-1, Math.min(1, (e.clientX - rect.left) / rect.width * 2 - 1)) * 3,
        Math.max(-1, Math.min(1, (e.clientY - rect.top) / rect.height * 2 - 1)) * 2);
    };
    const scroll = () => { if (visible) move(0, Math.max(-2, Math.min(2, node.getBoundingClientRect().top / innerHeight * 3))); };
    const resize = new ResizeObserver(fit); resize.observe(node); fit();
    const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; node.dataset.paused = String(!visible); }); intersection.observe(node);
    const preferences = new MutationObserver(() => { if (disabled()) move(0, 0); });
    preferences.observe(document.documentElement, { attributes: true, attributeFilter: ['data-reduce-motion'] });
    window.addEventListener('pointermove', pointer, { passive: true });
    window.addEventListener('scroll', scroll, { passive: true, capture: true });
    return () => { cancelAnimationFrame(frame); resize.disconnect(); intersection.disconnect(); preferences.disconnect(); window.removeEventListener('pointermove', pointer); window.removeEventListener('scroll', scroll, true); };
  }, [reduced, scene]);
  return <div ref={root} className={`layered-venue layered-venue--${scene}`} aria-hidden="true" data-reduced={!!reduced}>
    <div className="layered-venue__canvas">
      <img className="layered-venue__base" src={getAssetUrl(path + 'background.webp')} alt="" />
      {data?.layers.map(layer => <img key={layer.name} className={'layered-venue__cutout' + (/lamp|bulb|sign/.test(layer.name) ? ' layered-venue__light' : '')}
        src={getAssetUrl(path + layer.name)} alt="" loading="lazy" style={{ left: `${layer.x / data.width * 100}%`, top: `${layer.y / data.height * 100}%`, width: `${layer.width / data.width * 100}%`, height: `${layer.height / data.height * 100}%`, '--depth': layer.depth } as CSSProperties} />)}
    </div>
  </div>;
}
