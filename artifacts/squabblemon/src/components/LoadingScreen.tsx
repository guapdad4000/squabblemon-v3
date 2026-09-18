import { useEffect, useRef, useState } from 'react';
import { getAssetUrl } from '../lib/assets';

/** Shared by initial startup, lazy routes, and account loading. Never delays readiness. */
export function LoadingScreen() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [motionAllowed, setMotionAllowed] = useState(false);
  const [paused, setPaused] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setMotionAllowed(!preference.matches && document.documentElement.dataset.reduceMotion !== 'true');
    update(); preference.addEventListener('change', update);
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-reduce-motion'] });
    return () => { preference.removeEventListener('change', update); observer.disconnect(); };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let disposed = false;
    const update = () => {
      if (paused || document.hidden) video.pause();
      else void video.play().catch(() => { if (!disposed) setPlaying(false); });
    };
    update(); document.addEventListener('visibilitychange', update);
    return () => { disposed = true; video.pause(); document.removeEventListener('visibilitychange', update); };
  }, [motionAllowed, paused]);

  return <div className="brand-loader" data-testid="loading-screen">
    <img className="brand-loader__poster" src={getAssetUrl('brand/loading-scenes.webp')} alt="" aria-hidden="true" />
    {motionAllowed && <video ref={videoRef} className="brand-loader__video" data-playing={playing}
      src={getAssetUrl('brand/loading-scenes.webm')} muted loop playsInline preload="auto" aria-hidden="true"
      onLoadStart={() => setPlaying(false)} onPlaying={() => setPlaying(true)} onError={() => setPlaying(false)} />}
    <div className="brand-loader__shade" aria-hidden="true" />
    <div className="brand-loader__halo" aria-hidden="true" />
    <img src={getAssetUrl('brand/squabblemon-crest.webp')} alt="" width="374" height="384" className="brand-loader__crest" />
    <div className="brand-loader__meter" aria-hidden="true"><span /></div>
    <span className="brand-loader__label" role="status" aria-label="Loading Squabblemon">Loading the block</span>
    {motionAllowed && <button type="button" className="brand-loader__motion" onClick={() => setPaused(value => !value)}>
      {paused ? 'Play background' : 'Pause background'}
    </button>}
  </div>;
}
