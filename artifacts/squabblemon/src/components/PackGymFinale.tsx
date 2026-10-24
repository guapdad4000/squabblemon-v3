import { createPortal } from 'react-dom';
import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { getAssetUrl } from '../lib/assets';
import { PACK_GYM_RARITY_FLIGHT, normalizePackGymRarity, packGymFinaleArt, packGymFinaleMedia, packGymFinaleSpeed, startPackGymFinale, type PackGymFinaleStage } from '../lib/packGymFinale';
import { startPackGymFilm, type PackGymFilmState } from '../lib/packGymFilm';
import '../styles/pack-gym-finale.css';

const warmImages = new Map<string, HTMLImageElement>();
/** Call when the selected opening arms, before punch three. Never delays a saved reward. */
export function preloadPackGymFinale(pullCount = 1) {
  if (typeof Image === 'undefined') return;
  for (const path of Object.values(packGymFinaleArt(pullCount))) {
    if (!path || warmImages.has(path)) continue;
    const image = new Image(); image.decoding = 'async'; image.src = getAssetUrl(path);
    warmImages.set(path, image); void image.decode().catch(() => {});
  }
}

function PackGymFilm({ name, media, active, paused, speed, elapsed }: {
  name: 'pov' | 'landing'; media: ReturnType<typeof packGymFinaleMedia>['pov' | 'landing'];
  active: boolean; paused: boolean; speed: number; elapsed: () => number;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<PackGymFilmState>('poster');
  useLayoutEffect(() => {
    const element = video.current;
    if (!element) return;
    const src = getAssetUrl(media.src);
    // Restore after StrictMode's setup/cleanup rehearsal; release the decoder only on unmount.
    if (element.getAttribute('src') !== src) element.src = src;
    return () => { element.pause(); element.removeAttribute('src'); element.load(); };
  }, [media.src]);
  useLayoutEffect(() => {
    if (!video.current) return;
    return startPackGymFilm({ video: video.current, active, paused, speed, elapsed,
      start: media.start, duration: media.duration, onState: setState });
  }, [active, paused, speed, elapsed, media]);
  return <div className="pack-gym-finale__film" data-film={name} data-video-state={state} aria-hidden="true">
    <img className="pack-gym-finale__film-poster" src={getAssetUrl(media.poster)} alt="" decoding="async" />
    <video ref={video} src={getAssetUrl(media.src)} poster={getAssetUrl(media.poster)} muted playsInline preload="auto" disablePictureInPicture tabIndex={-1} />
  </div>;
}

/** Presentation only. Prepare during paid punches; activate on the third accepted hit. The saved reward stays at the callsite. */
export function PackGymFinale({ pullCount, active = true, reducedMotion = false, speed = 1, rarity, onSkip, onPrepareReveal, onComplete }: {
  pullCount: number; active?: boolean; reducedMotion?: boolean; speed?: number; rarity?: string; onSkip?: () => void; onPrepareReveal?: () => void; onComplete: () => void;
}) {
  const [stage, setStage] = useState<PackGymFinaleStage>(reducedMotion ? 'settle' : 'compression');
  // Freeze the receipt omen for this opening, even if a background bootstrap refreshes.
  const [openingRarity] = useState(() => normalizePackGymRarity(rarity));
  const profile = PACK_GYM_RARITY_FLIGHT[openingRarity];
  const [media] = useState(() => packGymFinaleMedia(openingRarity));
  const timelineRef = useRef<ReturnType<typeof startPackGymFinale> | null>(null);
  const elapsed = useCallback(() => timelineRef.current?.elapsed() ?? 0, []);
  const [openingSpeed] = useState(() => packGymFinaleSpeed(speed));
  const [paused, setPaused] = useState(false);
  const complete = useRef(onComplete); complete.current = onComplete;
  const prepareReveal = useRef(onPrepareReveal); prepareReveal.current = onPrepareReveal;
  const skip = useRef(onSkip); skip.current = onSkip;
  const finished = useRef(false), cancelTimeline = useRef<(() => void) | null>(null);
  const skipOpening = () => {
    if (finished.current || !skip.current) return;
    finished.current = true; cancelTimeline.current?.(); skip.current();
  };
  useLayoutEffect(() => {
    if (!active) return;
    finished.current = false;
    const timeline = startPackGymFinale({ pullCount, reduced: reducedMotion, speed: openingSpeed,
      clock: { now: () => performance.now(), schedule: (callback, delay) => window.setTimeout(callback, delay), cancel: handle => window.clearTimeout(handle as number) },
      onStage: nextStage => {
        setStage(nextStage);
        // Lay out and decode the real first print while the opaque smoke shot covers it.
        if (nextStage === 'impact') prepareReveal.current?.();
      }, onComplete: () => { if (!finished.current) { finished.current = true; complete.current(); } },
    });
    timelineRef.current = timeline;
    cancelTimeline.current = timeline.cancel;
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && skip.current) { event.preventDefault(); event.stopPropagation(); skipOpening(); } };
    window.addEventListener('keydown', escape);
    const visibility = () => { setPaused(document.hidden); if (document.hidden) timeline.pause(); else timeline.resume(); };
    visibility(); document.addEventListener('visibilitychange', visibility);
    return () => { timeline.cancel(); timelineRef.current = null; cancelTimeline.current = null; window.removeEventListener('keydown', escape); document.removeEventListener('visibilitychange', visibility); };
  }, [active, pullCount, reducedMotion, openingSpeed]);
  const ten = pullCount === 10, art = packGymFinaleArt(pullCount);
  if (typeof document === 'undefined') return null;
  return createPortal(<div className="pack-gym-finale" data-stage={active ? stage : 'armed'} data-active={active} inert={!active} aria-hidden={!active} data-ten={ten} data-reduced-motion={reducedMotion} data-paused={paused} data-rarity={openingRarity}
    style={{ '--finale-speed': openingSpeed } as CSSProperties} role={active ? 'status' : undefined} aria-live={active ? 'polite' : undefined}>
    <span className="sr-only">{ten ? 'Ten-pack bag broken open.' : `${pullCount === 1 ? 'Pack' : `${pullCount} packs`} knocked to the back of the gym.`} Highest rarity: {profile.label}. Your saved rewards are ready.</span>
    {!reducedMotion && <div className="pack-gym-finale__beat pack-gym-finale__compression" aria-hidden="true">
      <img src={getAssetUrl(art.compression)} alt="" decoding="async" />
    </div>}
    {!reducedMotion && <div className="pack-gym-finale__beat pack-gym-finale__contact" aria-hidden="true">
      <img src={getAssetUrl(art.contact)} alt="" decoding="async" />
    </div>}
    {!reducedMotion && <div className="pack-gym-finale__beat pack-gym-finale__release" aria-hidden="true">
      <img src={getAssetUrl(art.release)} alt="" decoding="async" />
    </div>}
    {!reducedMotion && <>
      <PackGymFilm name="pov" media={media.pov} active={active && stage === 'flight-pov'} paused={paused} speed={openingSpeed} elapsed={elapsed}/>
      <PackGymFilm name="landing" media={media.landing} active={active && stage === 'impact'} paused={paused} speed={openingSpeed} elapsed={elapsed}/>
    </>}
    <div className="pack-gym-finale__distance" aria-hidden="true">
      <img src={getAssetUrl(art.arrival)} alt="" decoding="async" />
    </div>
    {active && onSkip && <button type="button" className="pack-gym-finale__skip" autoFocus onClick={skipOpening} aria-label="Skip pack animation">Skip <span aria-hidden="true">›</span></button>}
    {!reducedMotion && art.foreground && <img className="pack-gym-finale__foreground" src={getAssetUrl(art.foreground)} alt="" aria-hidden="true" decoding="async" />}
  </div>, document.body);
}
