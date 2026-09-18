import { useEffect, useRef } from 'react';
import { getAssetUrl } from '../lib/assets';
import { cardMotionReduced } from '../lib/cardFinish';

/** Only the inspected card allocates a WebGL context. Grids use the CSS finish. */
export function CardFoil({ tier }: { tier: number }) {
  const host = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const element = host.current;
    if (!element || cardMotionReduced()) return;
    let disposed = false;
    let cleanup: (() => void) | undefined;
    // An absolute URL keeps Vite from rewriting this public ES module as an asset import.
    const moduleUrl = new URL(getAssetUrl('scenes/cards/foil.js'), window.location.href).href;
    import(/* @vite-ignore */ moduleUrl).then(module => {
      if (!disposed) {
        cleanup = module.mountFoil(element, tier);
        element.dataset.foilRenderer = 'webgl';
      }
    }).catch((error: unknown) => {
      // The layered CSS foil remains visible if WebGL is unavailable.
      if (!disposed) element.dataset.foilRenderer = 'css';
      if (import.meta.env.DEV) console.debug('Card foil fallback:', error);
    });
    return () => { disposed = true; cleanup?.(); };
  }, [tier]);
  return <span ref={host} className="collector-webgl" aria-hidden="true" />;
}
