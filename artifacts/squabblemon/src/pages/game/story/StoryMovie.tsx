import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { StoryCinematic } from '@workspace/squabblemon-engine/story';
import { getAssetUrl } from '../../../data';
import { setMusicDucked } from '../../../musicStore';
import { useStoryModalFocus } from './useStoryModalFocus';
import '../../../styles/squabble-house.css';

export function StoryMovie({ cinematic, title, onContinue, onClose }: {
  cinematic: StoryCinematic; title: string; onContinue: () => void; onClose: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);
  const [failed, setFailed] = useState(false);
  const [playBlocked, setPlayBlocked] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [hudHidden, setHudHidden] = useState(false);
  const [portrait, setPortrait] = useState(() => window.matchMedia('(orientation: portrait)').matches);
  const [sourceFailed, setSourceFailed] = useState(false);
  const [titleFailed, setTitleFailed] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const resumeAt = useRef<{time: number; playing: boolean} | null>(null);
  const source = portrait && cinematic.portraitVideoAssetId && !sourceFailed ? cinematic.portraitVideoAssetId : cinematic.videoAssetId;
  const poster = portrait && cinematic.portraitPosterAssetId && !sourceFailed ? cinematic.portraitPosterAssetId : cinematic.posterAssetId;
  const revealHud = useCallback(() => {
    setHudHidden(false); clearTimeout(hideTimer.current);
    if (video.current && !video.current.paused) hideTimer.current = setTimeout(() => setHudHidden(true), 2200);
  }, []);
  useEffect(()=>{window.addEventListener('keydown',revealHud,true);return()=>window.removeEventListener('keydown',revealHud,true);},[revealHud]);
  useEffect(() => {
    const orientation = window.matchMedia('(orientation: portrait)');
    const change = () => { resumeAt.current = video.current ? {time: video.current.currentTime, playing: !video.current.paused} : null; setSourceFailed(false); setPortrait(orientation.matches); };
    orientation.addEventListener('change', change);
    return () => { orientation.removeEventListener('change', change); clearTimeout(hideTimer.current); };
  }, []);
  useEffect(() => { if (playing) revealHud(); else { clearTimeout(hideTimer.current); setHudHidden(false); } }, [playing,revealHud]);
  useStoryModalFocus(host);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', escape);
    return () => { window.removeEventListener('keydown', escape); setMusicDucked(false); };
  }, [onClose]);
  const play = async () => {
    setStarted(true); setPlayBlocked(false);
    try { await video.current?.play(); } catch { setPlayBlocked(true); }
  };
  const toggleFullscreen = () => {
    const el = host.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => undefined);
    else void el.requestFullscreen?.().catch(() => undefined);
  };
  const isKumite = cinematic.videoAssetId.startsWith('assets/kumite/');
  return createPortal(
    <div className="house-movie house-movie--fullscreen" ref={host} role="dialog" aria-modal="true" aria-labelledby="house-movie-title" data-testid="story-movie" data-hud-hidden={hudHidden} onPointerMove={revealHud} onPointerDown={revealHud} onKeyDown={revealHud}>
      <div className="house-movie__screen">
        <video ref={video} src={getAssetUrl(source)} poster={getAssetUrl(poster)}
          controls={started && !failed} playsInline preload="metadata" aria-label={`${title} cinematic`}
          onLoadedMetadata={() => { const pending = resumeAt.current; if (!pending || !video.current) return; video.current.currentTime = Math.min(pending.time, Math.max(0, video.current.duration - .1)); resumeAt.current = null; if (pending.playing) void video.current.play().catch(() => setPlayBlocked(true)); }}
          onPlay={() => { setPlaying(true); setMusicDucked(true); }} onPause={() => { setPlaying(false); setMusicDucked(false); }} onEnded={onContinue}
          onError={() => { if (source !== cinematic.videoAssetId) { resumeAt.current = {time: video.current?.currentTime ?? 0, playing: started}; setSourceFailed(true); } else setFailed(true); setPlaying(false); setMusicDucked(false); }} />
        {(!started || playBlocked || failed) && <div className="house-movie__start">
          <span className="house-movie__reel">{isKumite ? 'KUMITE ANIME CUTSCENE' : 'A SQUABBLEMON SHORT'}</span>
          {failed ? <p role="status">The movie couldn’t load. Continue into the illustrated scene, or reopen this chapter to retry.</p>
            : <button className="house-movie__play" type="button" onClick={() => void play()}>{playBlocked ? 'RESUME' : '▶ PLAY CUTSCENE'}</button>}
        </div>}
      </div>
      <header className="house-movie__hud-top">
        <div className="house-movie__title-slash"><span>{isKumite ? 'KUMITE // BREAK THE BRACKET' : 'SQUABBLE HOUSE // THE LAST WAFFLE'}</span><h2 id="house-movie-title" className={cinematic.titleAssetId && !titleFailed ? "sr-only" : undefined}>{title}</h2>{cinematic.titleAssetId && !titleFailed && <img className="house-movie__title-art" src={getAssetUrl(cinematic.titleAssetId)} alt="" onError={() => setTitleFailed(true)} />}</div>
        <div className="house-movie__hud-actions">
          <button onClick={toggleFullscreen} type="button" aria-label="Toggle fullscreen">⛶</button>
          <button onClick={onClose} type="button">← MAP</button>
        </div>
      </header>
      <footer className="house-movie__hud-bottom"><button type="button" onClick={onContinue}>Continue to dialogue →</button></footer>
    </div>, document.body,
  );
}
