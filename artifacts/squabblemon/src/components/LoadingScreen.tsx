import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { getAssetUrl } from '../lib/assets';
import { currentLoadingScene, retainLoadingEpisode } from '../lib/loadingScenes';
import { canPlayOptionalBroadcast } from '../lib/optionalBroadcastMedia';
import './LoadingScreen.css';

export type LoadingPhase = 'application' | 'account' | 'player' | 'scene';
type NetworkInformation = { saveData?: boolean; effectiveType?: string; downlink?: number };
const STATUS: Record<LoadingPhase, string> = {
  application: 'Loading Squabblemon', account: 'Checking your fighter tag',
  player: 'Loading your gang and rewards', scene: 'Opening the next block',
};
const FIGHTERS = 'brand/broadcast/loading/fighters.webp';
const FIGHTERS_STILL = 'brand/broadcast/loading/fighters-still.webp';

export function LoadingScreen({ phase = 'application' }: { phase?: LoadingPhase }) {
  const [scene] = useState(currentLoadingScene);
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || !document.hidden);
  const [, refreshPolicy] = useState(0);
  const [fightersDue, setFightersDue] = useState(false);
  const [fightersFailed, setFightersFailed] = useState(false);
  const [videoDue, setVideoDue] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const allowMotion = visible && canPlayOptionalBroadcast();
  const allowVideo = allowMotion && phase !== 'application' && !videoFailed;
  const posterUrl = getAssetUrl(scene.poster);
  const cropStyle = { '--sbl-portrait-position': scene.portraitPosition, '--sbl-landscape-position': scene.landscapePosition } as CSSProperties;

  useEffect(() => retainLoadingEpisode(), []);
  useEffect(() => {
    const onVisibility = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const connection = (navigator as Navigator & { connection?: NetworkInformation & EventTarget }).connection;
    const refresh = () => refreshPolicy(value => value + 1);
    motion.addEventListener('change', refresh);
    connection?.addEventListener?.('change', refresh);
    const observer = new MutationObserver(refresh);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-reduce-motion'] });
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      motion.removeEventListener('change', refresh);
      connection?.removeEventListener?.('change', refresh);
    };
  }, []);

  // Decoration never gates application readiness. Short waits stay on tiny
  // stills; larger cinematic files are requested only after a prolonged wait.
  useEffect(() => {
    if (!allowMotion) { setFightersDue(false); return; }
    const timer = window.setTimeout(() => setFightersDue(true), 300);
    return () => window.clearTimeout(timer);
  }, [allowMotion]);
  useEffect(() => {
    if (!allowVideo) { setVideoDue(false); setVideoPlaying(false); return; }
    const timer = window.setTimeout(() => setVideoDue(true), 1200);
    return () => window.clearTimeout(timer);
  }, [allowVideo]);
  useEffect(() => {
    if (!videoDue || !allowVideo) return;
    const video = videoRef.current;
    if (!video) return;
    let active = true;
    void video.play().catch(() => { if (active) { setVideoPlaying(false); setVideoFailed(true); } });
    return () => {
      active = false;
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
  }, [videoDue, allowVideo]);

  return <div className="street-broadcast-loader" style={cropStyle} data-phase={phase} data-scene={scene.id} data-testid="loading-screen" aria-busy="true">
    <img className="sbl-background" src={posterUrl} alt="" aria-hidden="true" onError={event => { event.currentTarget.style.visibility = 'hidden'; }} />
    {allowVideo && videoDue && <video ref={videoRef} className="sbl-video" data-playing={videoPlaying} src={getAssetUrl(scene.video)} poster={posterUrl}
      muted loop playsInline preload="metadata" aria-hidden="true"
      onPlaying={() => setVideoPlaying(true)} onPause={() => setVideoPlaying(false)} onError={() => { setVideoPlaying(false); setVideoFailed(true); }} />}
    <div className="sbl-grade" aria-hidden="true" />
    <div className="sbl-stage">
      <img src={getAssetUrl('brand/prismatic/logos/squabblemon-wordmark-standard-gold.webp')} alt="Squabblemon" className="sbl-wordmark" />
      <img className="sbl-fighters" src={getAssetUrl(allowMotion && fightersDue && !fightersFailed ? FIGHTERS : FIGHTERS_STILL)}
        width="288" height="216" alt="" aria-hidden="true" decoding="async" onError={event => {
          if (event.currentTarget.src.endsWith('/fighters.webp')) setFightersFailed(true);
          else event.currentTarget.style.visibility = 'hidden';
        }} />
    </div>
    <span className="sbl-status" role="status" aria-live="polite" data-testid="loading-status">{STATUS[phase]}</span>
  </div>;
}
