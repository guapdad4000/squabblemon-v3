import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useReducedMotion } from 'framer-motion';
import { getAssetUrl } from '../../lib/assets';
import './LayeredVenue.css';

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
    let visible = true;
    let frame = 0;

    // Parallax logic
    let targetX = 0, targetY = 0;
    let currentX = 0, currentY = 0;
    let hasPointer = false;
    let time = 0;

    const disabled = () => reduced || document.documentElement.dataset.reduceMotion === 'true';

    const resetTransforms = () => {
      node.style.setProperty('--scene-x', '0px');
      node.style.setProperty('--scene-y', '0px');
      targetX = 0; targetY = 0;
      currentX = 0; currentY = 0;
    };

    const fit = () => {
      const aspect = data ? data.width / data.height : 16 / 9;
      const overscan = scene === 'gatcha-bg' ? 1.08 : 1.15;
      const width = Math.max(node.clientWidth, node.clientHeight * aspect) * overscan;
      node.style.setProperty('--scene-width', width + 'px');
      node.style.setProperty('--scene-height', width / aspect + 'px');
    };

    const loop = () => {
      if (!visible || disabled() || document.hidden) {
        if (disabled()) resetTransforms();
        frame = 0;
        return; // Stops requesting animation frames
      }

      if (!hasPointer) {
        // Subtle ambient movement when idle or on mobile (no device motion needed)
        time += 0.01;
        targetX = Math.sin(time) * 12;
        targetY = Math.cos(time * 0.8) * 8;
      }

      // Smooth interpolation for both pointer and ambient target
      // Faster response for pointer, slower for ambient
      const ease = hasPointer ? 0.08 : 0.02;
      currentX += (targetX - currentX) * ease;
      currentY += (targetY - currentY) * ease;

      node.style.setProperty('--scene-x', currentX + 'px');
      node.style.setProperty('--scene-y', currentY + 'px');

      frame = requestAnimationFrame(loop);
    };

    const startLoop = () => {
      if (!frame && visible && !disabled() && !document.hidden) {
        frame = requestAnimationFrame(loop);
      }
    };

    const pointer = (e: PointerEvent) => {
      if (!visible || document.hidden || disabled() || e.pointerType === 'touch') {
        hasPointer = false;
        return;
      }
      const rect = node.getBoundingClientRect();
      const inBounds = e.clientX >= rect.left && e.clientX <= rect.right &&
                       e.clientY >= rect.top && e.clientY <= rect.bottom;

      if (!inBounds) {
        hasPointer = false;
        return;
      }

      hasPointer = true;
      const nx = (e.clientX - rect.left) / rect.width * 2 - 1;
      const ny = (e.clientY - rect.top) / rect.height * 2 - 1;

      // Amplified target distance for stronger parallax
      targetX = Math.max(-1, Math.min(1, nx)) * 65;
      targetY = Math.max(-1, Math.min(1, ny)) * 35;
      startLoop();
    };

    const scroll = () => {
      // Scrolling can also act as an interaction hint
      startLoop();
    };

    const visibilityChange = () => {
      if (!document.hidden && visible) startLoop();
    };

    const resize = new ResizeObserver(fit);
    resize.observe(node);
    fit();

    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      node.dataset.paused = String(!visible);
      if (visible) startLoop();
    });
    intersection.observe(node);

    const preferences = new MutationObserver(() => {
      if (disabled()) {
         resetTransforms();
         // loop will naturally exit on the next frame due to disabled()
      } else {
         startLoop();
      }
    });
    preferences.observe(document.documentElement, { attributes: true, attributeFilter: ['data-reduce-motion'] });

    window.addEventListener('pointermove', pointer, { passive: true });
    window.addEventListener('scroll', scroll, { passive: true, capture: true });
    document.addEventListener('visibilitychange', visibilityChange);

    // Initial setup check
    if (disabled()) {
      resetTransforms();
    } else {
      startLoop();
    }

    return () => {
      if (frame) cancelAnimationFrame(frame);
      resize.disconnect();
      intersection.disconnect();
      preferences.disconnect();
      window.removeEventListener('pointermove', pointer);
      window.removeEventListener('scroll', scroll, true);
      document.removeEventListener('visibilitychange', visibilityChange);
    };
  }, [data, reduced, scene]);

  return <div ref={root} className={`layered-venue layered-venue--${scene} layered-venue--enhanced`} aria-hidden="true" data-reduced={!!reduced}>
    <div className="layered-venue__canvas">
      <img className="layered-venue__base" src={getAssetUrl(path + 'background.webp')} alt="" />
      {data?.layers.map(layer => <img key={layer.name} className={'layered-venue__cutout' + (/lamp|bulb|sign|midground/.test(layer.name) ? ' layered-venue__light' : '')}
        src={getAssetUrl(path + layer.name)} alt="" loading="lazy" style={{ left: `${layer.x / data.width * 100}%`, top: `${layer.y / data.height * 100}%`, width: `${layer.width / data.width * 100}%`, height: `${layer.height / data.height * 100}%`, '--depth': layer.depth } as CSSProperties} />)}
    </div>
  </div>;
}
