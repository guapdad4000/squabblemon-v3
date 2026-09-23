import { useEffect, useState, type CSSProperties } from 'react';
import { getAssetUrl } from '../../lib/assets';
import type { RoadReturn } from './FlagshipMachine';

type Phase = 'idle' | 'fight' | 'clear' | 'walk' | 'defeat';

/** Animation is decorative: run progression never depends on these timers. */
export function FadecadeRoad({ index, active, fighting, defeated, compact = false, returnState, reducedMotion }: {
  index: number; active: boolean; fighting: boolean; defeated?: boolean; compact?: boolean;
  returnState?: RoadReturn | null; reducedMotion: boolean;
}) {
  const resting: Phase = defeated ? 'defeat' : fighting ? 'fight' : 'idle';
  const [phase, setPhase] = useState<Phase>(resting);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const settle = () => setPhase(resting);
    if (media.matches || reducedMotion || returnState?.outcome !== 'win') { settle(); return; }
    setPhase('clear');
    const clear = window.setTimeout(() => setPhase('walk'), 650);
    const walk = window.setTimeout(settle, 1650);
    media.addEventListener('change', settle);
    return () => {
      window.clearTimeout(clear); window.clearTimeout(walk);
      media.removeEventListener('change', settle);
    };
  }, [resting, reducedMotion, returnState?.key, returnState?.outcome]);
  const start = Math.max(0, index - 3);
  const nodes = Array.from({ length: 7 }, (_, offset) => start + offset);
  const asset = phase === 'defeat' ? 'fighter-defeat' : phase === 'fight' ? 'fight' : phase === 'clear' ? 'clear' : phase === 'walk' ? 'runner' : 'idle';
  const image = getAssetUrl(`assets/fadecade/${asset}.webp`);
  useEffect(() => setFailed(false), [image]);
  return <div className={`fadecade-road-view ${compact ? 'is-compact' : ''}`} data-phase={phase} data-reduced-motion={reducedMotion} aria-label={compact ? undefined : `Road at stop ${index + 1}`}>
    <div className="fadecade-road-asphalt" style={{ backgroundImage: `url(${getAssetUrl('assets/fadecade/road.webp')})` }} aria-hidden="true" />
    <div className="fadecade-road-shoulder" style={{ backgroundImage: `url(${getAssetUrl('assets/fadecade/sidewalk.webp')})` }} aria-hidden="true" />
    {!compact && <div className="fadecade-road-milestones" style={{ '--road-offset': `${(index - start) * 86 + 43}px` } as CSSProperties}>
      {nodes.map(stop => <div className={`fadecade-road-node ${stop < index ? 'is-cleared' : ''} ${stop === index ? 'is-current' : ''} ${(stop + 1) % 5 === 0 ? 'is-boss' : ''}`}
        key={stop} aria-current={stop === index ? 'step' : undefined}>
        <b>{stop + 1}</b><span>{stop < index ? 'CLEARED' : (stop + 1) % 5 === 0 ? 'BOSS' : stop === index ? active ? 'YOUR STOP' : 'START' : 'UPCOMING'}</span>
      </div>)}
    </div>}
    <div className="fadecade-road-actor" aria-hidden="true">
      {/* A loader gives CSS sprites a real error path without duplicating frames. */}
      <img src={image} alt="" className="fadecade-sprite-loader" onError={() => setFailed(true)} />
      {failed ? <span className="fadecade-sprite-fallback">YOU</span> : <div className={`fadecade-sprite fadecade-sprite--${phase}`} style={{ backgroundImage: `url(${image})` }} />}
    </div>
    {!compact && <div className="fadecade-road-overlay"><span>STOP {index + 1}</span><span>{(index + 1) % 5 === 0 ? 'BOSS BLOCK' : 'STRAIGHT TO THE BACK'}</span></div>}
  </div>;
}