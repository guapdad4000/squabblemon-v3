import React, { useEffect, useRef } from 'react';
import { getAssetUrl } from '../lib/assets';
import './supplied-battle-fx.css';

export const BATTLE_MEDIA = {
  'lane-flame-left': { width: 112, height: 168 },
  'lane-flame-right': { width: 112, height: 168 },
  'fire-impact': { width: 122, height: 150 },
  'burn-flame': { width: 160, height: 222 },
  'movement-dust': { width: 320, height: 180 },
  'motion-orb': { width: 112, height: 112 },
  'pvp-energy-burst': { width: 480, height: 266 },
  'squabble-aura': { width: 192, height: 346 },
  'squabble-ready': { width: 160, height: 160 },
} as const;
export type BattleMediaKind = keyof typeof BATTLE_MEDIA;

/** Preprocessed transparent art: no green-screen canvas, per-frame JS, or GPU context. */
export function BattleFxImage({ kind, className = '', animated = true, retireOnParentAnimationEnd }: {
  kind: BattleMediaKind; className?: string; animated?: boolean;
  /** Stop looping media when its parent's authored finite fade has completed. */
  retireOnParentAnimationEnd?: string;
}) {
  const image = useRef<HTMLImageElement>(null);
  const failed = useRef(false);
  useEffect(() => {
    const node = image.current;
    if (!node) return;
    failed.current = false;
    let retired = false;
    // Playback is decorative DOM state. Visibility changes must not commit React
    // updates across the battle tree or restart unrelated card animations.
    const setPlaying = (playing: boolean) => {
      const moving = animated && kind !== 'fire-impact' && playing && !failed.current && !retired;
      node.dataset.mediaAnimated = moving ? 'true' : 'false';
      const src = getAssetUrl(`assets/combat/supplied/${kind}${moving ? '' : '-still'}.webp`);
      if (node.getAttribute('src') !== src) node.setAttribute('src', src);
    };
    setPlaying(false);
    if (!animated || kind === 'fire-impact') return;
    let disposed = false;
    let stop: (() => void) | undefined;
    const parent = retireOnParentAnimationEnd ? node.parentElement : null;
    const retire = (event: AnimationEvent) => {
      // Ignore descendant animations and unrelated/cancelled transitions. Reduced
      // motion has no fade animation and therefore keeps its visible still art.
      if (disposed || retired || event.target !== parent || event.animationName !== retireOnParentAnimationEnd) return;
      retired = true;
      setPlaying(false);
      stop?.();
      stop = undefined;
    };
    parent?.addEventListener('animationend', retire);
    // Playback observers are optional; keep the static art if this chunk fails.
    void import('../lib/battleMediaPlayback').then(({ observePlayback }) => {
      if (!disposed && !retired) stop = observePlayback(node, setPlaying);
    }).catch(() => {});
    return () => {
      disposed = true;
      parent?.removeEventListener('animationend', retire);
      stop?.();
    };

  }, [animated, kind, retireOnParentAnimationEnd]);
  return <img ref={image} className={`supplied-battle-fx ${className}`} data-battle-media={kind}
    data-media-animated="false"
    src={getAssetUrl(`assets/combat/supplied/${kind}-still.webp`)}
    width={BATTLE_MEDIA[kind].width} height={BATTLE_MEDIA[kind].height}
    alt="" aria-hidden="true" decoding="async" draggable={false}
    onError={event => {
      const node = event.currentTarget;
      if (node.dataset.mediaAnimated !== 'true') return;
      failed.current = true;
      node.dataset.mediaAnimated = 'false';
      node.setAttribute('src', getAssetUrl(`assets/combat/supplied/${kind}-still.webp`));
    }} />;
}
