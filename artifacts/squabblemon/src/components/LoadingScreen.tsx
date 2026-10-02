import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { getAssetUrl } from '../lib/assets';
import { currentLoadingScene, retainLoadingEpisode } from '../lib/loadingScenes';
import { canPlayOptionalBroadcast } from '../lib/optionalBroadcastMedia';
import './LoadingScreen.css';

export type LoadingPhase = 'application' | 'account' | 'player' | 'scene';

type NetworkInformation = { saveData?: boolean; effectiveType?: string; downlink?: number };

const STAGES: Array<{ phase: LoadingPhase; short: string; status: string }> = [
  { phase: 'application', short: 'App', status: 'Downloading the broadcast' },
  { phase: 'account', short: 'Account', status: 'Checking your fighter tag' },
  { phase: 'player', short: 'Profile', status: 'Loading your gang and rewards' },
  { phase: 'scene', short: 'Block', status: 'Opening the next block' },
];

export function LoadingScreen({ phase = 'application' }: { phase?: LoadingPhase }) {
  const [scene] = useState(currentLoadingScene);
  const [readyAssets, setReadyAssets] = useState<Set<string>>(() => new Set());
  const [failedAssets, setFailedAssets] = useState<Set<string>>(() => new Set());
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [videoDue, setVideoDue] = useState(false);
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || !document.hidden);
  const [, refreshMediaPolicy] = useState(0);
  const [manuallyPaused, setManuallyPaused] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageIndex = Math.max(0, STAGES.findIndex(stage => stage.phase === phase));
  const activeStage = STAGES[stageIndex];
  const posterUrl = getAssetUrl(scene.poster);
  const wordmarkUrl = getAssetUrl('brand/prismatic/logos/squabblemon-wordmark-standard-gold.webp');
  const visualAssets = useMemo(() => [posterUrl, wordmarkUrl], [posterUrl, wordmarkUrl]);
  const allowVideo = phase !== 'application' && visible && canPlayOptionalBroadcast() && !videoFailed;
  const cropStyle = {
    '--sbl-portrait-position': scene.portraitPosition,
    '--sbl-landscape-position': scene.landscapePosition,
  } as CSSProperties;

  useEffect(() => retainLoadingEpisode(), []);

  useEffect(() => {
    const onVisibility = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const connection = (navigator as Navigator & { connection?: NetworkInformation & EventTarget }).connection;
    const refresh = () => refreshMediaPolicy(value => value + 1);
    motion.addEventListener('change', refresh);
    connection?.addEventListener?.('change', refresh);
    const observer = new MutationObserver(refresh);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-reduce-motion'] });
    return () => {
      observer.disconnect();
      motion.removeEventListener('change', refresh);
      connection?.removeEventListener?.('change', refresh);
    };
  }, []);

  // No optional media is requested during app boot or short waits. The image
  // underneath remains visible until actual playback, never merely canplay.
  useEffect(() => {
    if (!allowVideo) { setVideoDue(false); setVideoPlaying(false); return; }
    const timer = window.setTimeout(() => setVideoDue(true), 1200);
    return () => window.clearTimeout(timer);
  }, [allowVideo]);

  useEffect(() => {
    if (!videoDue || !allowVideo) return;
    const video = videoRef.current;
    if (manuallyPaused) video?.pause();
    return () => {
      if (!video) return;
      video.pause();
      video.removeAttribute('src');
      video.querySelector('source')?.removeAttribute('src');
      video.load();
    };
  }, [videoDue, allowVideo]);

  useEffect(() => {
    let mounted = true;
    setReadyAssets(new Set());
    setFailedAssets(new Set());
    visualAssets.forEach(src => {
      const img = new Image();
      img.onload = () => {
        if (!mounted) return;
        setReadyAssets(current => new Set(current).add(src));
      };
      img.onerror = () => {
        if (!mounted) return;
        setFailedAssets(current => new Set(current).add(src));
      };
      img.src = src;
    });
    return () => { mounted = false; };
  }, [visualAssets]);

  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    if (manuallyPaused) {
      setManuallyPaused(false);
      void video.play().catch(() => { setVideoPlaying(false); setVideoFailed(true); });
    } else {
      setManuallyPaused(true);
      video.pause();
      setVideoPlaying(false);
    }
  };

  return (
    <div className="street-broadcast-loader" style={cropStyle} data-phase={phase} data-scene={scene.id} data-testid="loading-screen" aria-busy="true">
      <img className="sbl-background" src={posterUrl} alt="" aria-hidden="true" />
      {allowVideo && videoDue && (
        <video
          ref={videoRef}
          className="sbl-video"
          data-playing={videoPlaying}
          poster={posterUrl}
          muted
          loop
          playsInline
          autoPlay
          preload="metadata"
          onPlaying={() => { if (!manuallyPaused) setVideoPlaying(true); }}
          onPause={() => setVideoPlaying(false)}
          onError={() => { setVideoPlaying(false); setVideoFailed(true); }}
          aria-hidden="true"
        >
          <source src={getAssetUrl(scene.video)} type={scene.video.endsWith('.mp4') ? 'video/mp4' : 'video/webm'} />
        </video>
      )}
      <div className="sbl-grade" aria-hidden="true" />
      <header className="sbl-broadcast-head">
        <span className="sbl-rec"><span className="sbl-rec-dot" aria-hidden="true" /> Squabble City Live</span>
        <span className="sbl-feed">On the block / {scene.label}</span>
      </header>

      <main className="sbl-stage">
        <div className="sbl-wordmark-wrap">
          <span className="sbl-kicker">From the streets of Squabble City</span>
          <img src={wordmarkUrl} alt="Squabblemon" className="sbl-wordmark" />
        </div>
      </main>

      <div className="sbl-lower-third">
        <div className="sbl-scene-caption"><span>Now showing</span><strong>{scene.label}</strong></div>
        <div className="sbl-status-card">
          <div className="sbl-status-copy" role="status" aria-live="polite">
            <span>Now loading</span>
            <strong data-testid="loading-status">{activeStage.status}</strong>
            <small data-testid="loading-visual-progress">
              Visual feed {readyAssets.size} of {visualAssets.length} ready
              {failedAssets.size > 0 ? ' · fallback active' : ''}
            </small>
          </div>
          <ol className="sbl-stages" aria-label="Loading progress">
            {STAGES.map((stage, index) => (
              <li key={stage.phase} data-state={index < stageIndex ? 'complete' : index === stageIndex ? 'active' : 'waiting'} aria-current={index === stageIndex ? 'step' : undefined}>
                <i aria-hidden="true">{index < stageIndex ? '·' : index + 1}</i>
                <span>{stage.short}</span>
              </li>
            ))}
          </ol>
          {allowVideo && videoDue && (
            <button type="button" className="sbl-motion-control" onClick={togglePlayback} data-testid="button-toggle-loading-motion" aria-label={manuallyPaused ? 'Play loading scene' : 'Pause loading scene'}>
              {manuallyPaused ? 'Play scene' : 'Pause scene'}
            </button>
          )}
          <div className="sbl-stage-meter" aria-hidden="true"><span style={{ width: `${(stageIndex / STAGES.length) * 100}%` }} /></div>
        </div>
      </div>
    </div>
  );
}