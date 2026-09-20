import { useEffect, useRef } from 'react';
import { getAssetUrl } from '../lib/assets';
import { cardMotionReduced } from '../lib/cardFinish';

/** Only the inspected card allocates a renderer. The complete CSS finish serves grids and reduced motion. */
export function CardFoil({ tier, variant }: { tier: number; variant?: 'tagged' | 'chrome' | null }) {
  const host = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let disposed = false, generation = 0;
    let cleanup: (() => void) | undefined;
    let reduced: boolean | undefined;
    const sync = () => {
      const next = cardMotionReduced();
      if (next === reduced) return;
      reduced = next;
      const current = ++generation;
      cleanup?.(); cleanup = undefined;
      element.dataset.foilRenderer = 'css';
      if (next) return;
      // Version the public module independently of the application chunks / service worker.
      const url = new URL(getAssetUrl('scenes/cards/foil.js?v=atelier-2'), window.location.href).href;
      import(/* @vite-ignore */ url).then(module => {
        if (!disposed && current === generation) cleanup = module.mountFoil(element, tier, variant);
      }).catch((error: unknown) => {
        if (import.meta.env.DEV) console.debug('Card foil fallback:', error);
      });
    };
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const settings = new MutationObserver(sync);
    media.addEventListener('change', sync);
    settings.observe(document.documentElement, { attributes: true, attributeFilter: ['data-reduce-motion', 'data-reduced-motion'] });
    sync();
    return () => { disposed = true; generation++; cleanup?.(); settings.disconnect(); media.removeEventListener('change', sync); };
  }, [tier, variant]);
  return <span ref={host} className="collector-webgl" aria-hidden="true" />;
}
