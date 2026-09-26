import { useEffect, useMemo, useState } from 'react';
import { getAssetUrl } from '../lib/assets';
import './LoadingScreen.css';

export type LoadingPhase = 'application' | 'account' | 'player' | 'scene';

type NetworkInformation = {
  saveData?: boolean;
  effectiveType?: string;
};

const STAGES: Array<{ phase: LoadingPhase; short: string; status: string; character: string }> = [
  { phase: 'application', short: 'App', status: 'Downloading the broadcast', character: 'dr-fade' },
  { phase: 'account', short: 'Account', status: 'Checking your fighter tag', character: 'stylist' },
  { phase: 'player', short: 'Profile', status: 'Loading your gang and rewards', character: 'sneaker-reseller' },
  { phase: 'scene', short: 'Block', status: 'Opening the next block', character: 'barber-bro' },
];

export function LoadingScreen({ phase = 'application' }: { phase?: LoadingPhase }) {
  const [readyAssets, setReadyAssets] = useState<Set<string>>(() => new Set());
  const [failedAssets, setFailedAssets] = useState<Set<string>>(() => new Set());
  const [videoPlaying, setVideoPlaying] = useState(false);
  const stageIndex = Math.max(0, STAGES.findIndex((stage) => stage.phase === phase));
  const activeStage = STAGES[stageIndex];
  const connection = typeof navigator === 'undefined'
    ? undefined
    : (navigator as Navigator & { connection?: NetworkInformation }).connection;
  const reduceMotion = typeof window !== 'undefined'
    && (window.matchMedia('(prefers-reduced-motion: reduce)').matches
      || document.documentElement.dataset.reduceMotion === 'true');
  const allowVideo = phase !== 'application'
    && !reduceMotion
    && !connection?.saveData
    && connection?.effectiveType !== 'slow-2g'
    && connection?.effectiveType !== '2g';
  const characterUrl = getAssetUrl(`assets/characters/${activeStage.character}.webp`);
  const posterUrl = getAssetUrl('brand/loading-scenes.webp');
  const wordmarkUrl = getAssetUrl('brand/prismatic/logos/squabblemon-wordmark-gold.webp');
  const visualAssets = useMemo(
    () => [posterUrl, characterUrl, wordmarkUrl],
    [characterUrl, posterUrl, wordmarkUrl],
  );

  useEffect(() => {
    let mounted = true;
    setReadyAssets(new Set());
    setFailedAssets(new Set());
    visualAssets.forEach((src) => {
      const img = new Image();
      img.onload = () => {
        if (!mounted) return;
        setReadyAssets((current) => {
          if (current.has(src)) return current;
          const next = new Set(current);
          next.add(src);
          return next;
        });
      };
      img.onerror = () => {
        if (!mounted) return;
        setFailedAssets((current) => new Set(current).add(src));
      };
      img.src = src;
    });
    return () => { mounted = false; };
  }, [visualAssets]);

  return (
    <div
      className="street-broadcast-loader"
      data-phase={phase}
      data-testid="loading-screen"
      aria-busy="true"
    >
      <img className="sbl-background" src={posterUrl} alt="" aria-hidden="true" />
      {allowVideo && (
        <video
          className="sbl-video"
          data-playing={videoPlaying}
          poster={posterUrl}
          muted
          loop
          playsInline
          autoPlay
          preload="metadata"
          onCanPlay={() => setVideoPlaying(true)}
          onError={() => setVideoPlaying(false)}
          aria-hidden="true"
        >
          <source src={getAssetUrl('brand/loading-scenes.webm')} type="video/webm" />
        </video>
      )}
      <div className="sbl-grade" aria-hidden="true" />
      <div className="sbl-noise" aria-hidden="true" />

      <header className="sbl-broadcast-head">
        <div className="sbl-rec">
          <span className="sbl-rec-dot" aria-hidden="true" />
          Squabble City Live
        </div>
        <span>Feed 04 · Fight Night</span>
      </header>

      <main className="sbl-stage">
        <div className="sbl-wordmark-wrap">
          <span className="sbl-kicker">Tonight on the block</span>
          <img src={wordmarkUrl} alt="Squabblemon" className="sbl-wordmark" />
          <strong>Build your gang. Own the city.</strong>
        </div>
        <img
          src={characterUrl}
          alt=""
          className="sbl-character"
          onError={(event) => { event.currentTarget.hidden = true; }}
        />
      </main>

      <div className="sbl-lower-third">
        <div className="sbl-chyron">
          <div className="sbl-chyron-track" aria-hidden="true">
            <span>Squabblemon · The city is watching · Build your gang · Read the room · Own two districts · </span>
            <span>Squabblemon · The city is watching · Build your gang · Read the room · Own two districts · </span>
          </div>
        </div>
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
              <li
                key={stage.phase}
                data-state={index < stageIndex ? 'complete' : index === stageIndex ? 'active' : 'waiting'}
                aria-current={index === stageIndex ? 'step' : undefined}
              >
                <i aria-hidden="true">{index < stageIndex ? '✓' : index + 1}</i>
                <span>{stage.short}</span>
              </li>
            ))}
          </ol>
          <div className="sbl-stage-meter" aria-hidden="true">
            <span style={{ width: `${(stageIndex / STAGES.length) * 100}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}
