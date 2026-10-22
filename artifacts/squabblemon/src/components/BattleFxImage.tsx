import { useEffect, useRef, useState } from 'react';
import { getAssetUrl } from '../lib/assets';
import './supplied-battle-fx.css';

export const BATTLE_MEDIA = {
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
export function BattleFxImage({ kind, className = '', animated = true }: {
  kind: BattleMediaKind; className?: string; animated?: boolean;
}) {
  const image = useRef<HTMLImageElement>(null);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const node = image.current;
    if (!node || !animated || kind === 'fire-impact') return;
    let disposed = false;
    let stop: (() => void) | undefined;
    // Playback observers are optional; keep the static art if this chunk fails.
    void import('../lib/battleMediaPlayback').then(({ observePlayback }) => {
      if (!disposed) stop = observePlayback(node, setPlaying);
    }).catch(() => {});
    return () => { disposed = true; stop?.(); };

  }, [animated, kind]);
  const moving = kind !== 'fire-impact' && animated && playing && !failed;
  return <img ref={image} className={`supplied-battle-fx ${className}`} data-battle-media={kind}
    data-media-animated={moving ? 'true' : 'false'}
    src={getAssetUrl(`assets/combat/supplied/${kind}${moving ? '' : '-still'}.webp`)}
    width={BATTLE_MEDIA[kind].width} height={BATTLE_MEDIA[kind].height}
    alt="" aria-hidden="true" decoding="async" draggable={false}
    onError={() => { if (!failed) setFailed(true); }} />;
}
