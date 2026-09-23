import { useCallback, useEffect, useRef, type PointerEvent } from 'react';

// Center of the lit lens in the alpha-trimmed 1200 × 515 logo.
const LENS_X_RATIO = 0.07;
const LENS_Y_RATIO = 0.47;

function motionIsReduced() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    document.documentElement.dataset.reduceMotion === 'true';
}

export function useProjectorBeam() {
  const logoRef = useRef<HTMLImageElement>(null);
  const beamRef = useRef<HTMLDivElement>(null);
  const lensAnchorRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number | null>(null);
  const targetRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

  const updateBeam = useCallback((clientX?: number, clientY?: number) => {
    if (clientX !== undefined && clientY !== undefined) {
      targetRef.current = { x: clientX, y: clientY };
    }
    if (requestRef.current !== null) cancelAnimationFrame(requestRef.current);
    requestRef.current = requestAnimationFrame(() => {
      requestRef.current = null;
      const logo = logoRef.current;
      const beam = beamRef.current;
      if (!logo || !beam) return;

      const rect = logo.getBoundingClientRect();
      const ox = rect.left + rect.width * LENS_X_RATIO;
      const oy = rect.top + rect.height * LENS_Y_RATIO;
      const target = targetRef.current;
      const dx = target.x - ox;
      const dy = target.y - oy;
      const distance = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);

      beam.dataset.originX = String(ox);
      beam.dataset.originY = String(oy);
      beam.dataset.targetX = String(target.x);
      beam.dataset.targetY = String(target.y);
      beam.dataset.logoLeft = String(rect.left);
      beam.dataset.logoTop = String(rect.top);
      beam.dataset.logoWidth = String(rect.width);
      beam.dataset.logoHeight = String(rect.height);

      const anchor = lensAnchorRef.current;
      if (anchor) {
        anchor.style.left = `${ox}px`;
        anchor.style.top = `${oy}px`;
        anchor.dataset.x = String(ox);
        anchor.dataset.y = String(oy);
      }

      if (motionIsReduced()) {
        beam.style.opacity = '0';
        beam.dataset.motion = 'reduced';
        return;
      }

      beam.style.opacity = '';
      beam.dataset.motion = 'active';
      beam.style.transform = `translate(${ox}px, ${oy - 200}px) rotate(${angle}rad)`;
      beam.style.width = `${distance + 800}px`;
    });
  }, []);

  const handlePointerMove = (e: PointerEvent) => {
    if (motionIsReduced()) return;
    updateBeam(e.clientX, e.clientY);
  };

  useEffect(() => {
    const logo = logoRef.current;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const refresh = () => updateBeam();
    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(refresh);
    if (logo) resizeObserver?.observe(logo);
    const profileObserver = new MutationObserver(refresh);
    profileObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-reduce-motion'] });
    media.addEventListener('change', refresh);
    window.addEventListener('resize', refresh);
    window.addEventListener('orientationchange', refresh);
    refresh();

    return () => {
      if (requestRef.current !== null) cancelAnimationFrame(requestRef.current);
      resizeObserver?.disconnect();
      profileObserver.disconnect();
      media.removeEventListener('change', refresh);
      window.removeEventListener('resize', refresh);
      window.removeEventListener('orientationchange', refresh);
    };
  }, [updateBeam]);

  return { logoRef, beamRef, lensAnchorRef, handlePointerMove, updateBeam };
}
