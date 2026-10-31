import { useEffect, useRef } from 'react';
import { getAssetUrl } from '../../lib/assets';
import { observePlayback } from '../../lib/battleMediaPlayback';
import type { DojoSpritePhase } from './DojoMotionSprite';

const MOTION_ROOT = 'assets/boss-raid/anunaki-motion-v1';

/** Every clip contains different generated cels, rather than moving a still. */
export function anunakiMotionSource(asset: string, phase: DojoSpritePhase, moving: boolean) {
  const id = asset.replace(/^anunaki:/, '');
  // The central boss has four authored action clips. Other actors have idle cels.
  const activePhase = id === 'boss-anu' ? phase : 'idle';
  const frame = moving ? activePhase : id === 'boss-anu' && activePhase !== 'idle' ? `${activePhase}-still` : 'still';
  return `${MOTION_ROOT}/${id}-${frame}.webp`;
}

export function AnunakiMotionSprite({
  asset, name, className = '', paused = false, reduced = false, phase = 'idle',
}: {
  asset: string;
  name: string;
  className?: string;
  paused?: boolean;
  reduced?: boolean;
  phase?: DojoSpritePhase;
}) {
  const ref = useRef<HTMLImageElement>(null);
  const failed = useRef<string | null>(null);
  const poster = getAssetUrl(anunakiMotionSource(asset, phase, false));
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const update = (moving: boolean) => {
      const clip = getAssetUrl(anunakiMotionSource(asset, phase, moving && !paused && !reduced));
      const source = failed.current === clip ? poster : clip;
      if (node.getAttribute('src') !== source) node.setAttribute('src', source);
      node.dataset.playing = String(source !== poster);
    };
    // Start with the poster until the shared observer confirms visibility.
    update(false);
    if (paused || reduced) return;
    return observePlayback(node, update);
  }, [asset, phase, paused, reduced, poster]);
  return (
    <span className={`boss-idle anunaki-motion ${className}`}
      data-boss-sprite={asset} data-anunaki-phase={phase}
      data-reduced-motion={reduced} data-paused={paused}
      role="img" aria-label={name}>
      <img ref={ref} src={poster} alt="" width="320" height="480"
        draggable={false} decoding="async"
        style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center bottom' }}
        onError={(event) => {
          const node = event.currentTarget;
          const source = node.getAttribute('src');
          if (source && source !== poster) {
            failed.current = source;
            node.setAttribute('src', poster);
            node.dataset.playing = 'false';
          }
        }} />
    </span>
  );
}
