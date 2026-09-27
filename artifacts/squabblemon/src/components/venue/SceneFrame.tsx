import { useEffect, useRef, useState, type RefObject } from 'react';
import { detectGPUQuality, type GPUQuality } from '../../lib/gpuQuality';

export type SceneMessage = { type: string; view?: string; night?: boolean; hits?: number; message?: string; gpuTier?: string; anchors?: { id: string; x: number; y: number; visible: boolean }[] };

export function sendScene(frame: RefObject<HTMLIFrameElement | null>, payload: Record<string, unknown>) {
  frame.current?.contentWindow?.postMessage({ channel: 'squabblemon-scene', ...payload }, window.location.origin);
}

/** Leaving the route destroys the scene document and its GPU lifecycle. */
export function SceneFrame({ kind, frameRef, onMessage, onReady, poster }: {
  kind: 'safehouse' | 'gym';
  frameRef: RefObject<HTMLIFrameElement | null>;
  onMessage?: (message: SceneMessage) => void;
  onReady?: () => void;
  poster?: string;
}) {
  const publicBase = import.meta.env.BASE_URL.replace(/\/?$/, '/');
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [quality, setQuality] = useState<GPUQuality | null>(null);
  const handlers = useRef({ onMessage, onReady });
  handlers.current = { onMessage, onReady };
  useEffect(() => {
    let active = true;
    const sync = () => { void detectGPUQuality().then(next => { if (active) setQuality(next); }); };
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-reduce-motion', 'data-reduced-motion'] });
    media.addEventListener('change', sync);
    sync();
    return () => { active = false; observer.disconnect(); media.removeEventListener('change', sync); };
  }, []);
  useEffect(() => {
    if (!quality || quality.tier === 'static') return;
    let ready = false;
    setStatus('loading');
    handlers.current.onMessage?.({ type: 'loading' });
    const timeout = window.setTimeout(() => { if (!ready) { clearInterval(probe); setStatus('error'); handlers.current.onMessage?.({ type: 'error' }); } }, 15000);
    const probe = window.setInterval(() => { if (!ready) sendScene(frameRef, { type: 'ping', quality }); }, 600);
    const receive = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== frameRef.current?.contentWindow) return;
      const message = event.data;
      if (!message || message.channel !== 'squabblemon-scene') return;
      if (message.type === 'ready') {
        if (message.gpuTier !== quality.tier) {
          clearInterval(probe); clearTimeout(timeout); setStatus('error');
          handlers.current.onMessage?.({ type: 'error', message: 'Scene quality handshake failed.' });
          return;
        }
        if (ready) return;
        ready = true;
        clearInterval(probe);
        clearTimeout(timeout);
        setStatus('ready');
        handlers.current.onReady?.();
      } else if (message.type === 'error') { clearTimeout(timeout); clearInterval(probe); setStatus('error'); }
      handlers.current.onMessage?.(message);
    };
    window.addEventListener('message', receive);
    return () => { clearTimeout(timeout); clearInterval(probe); window.removeEventListener('message', receive); };
  }, [attempt, frameRef, kind, quality]);
  useEffect(() => {
    if (quality?.tier === 'static') handlers.current.onMessage?.({ type: 'static' });
  }, [quality]);
  return <div className={`venue-scene is-${quality?.tier === 'static' ? 'static' : status}`}>
    {poster && <img className="venue-scene__poster" src={poster} alt="" />}
    {quality && quality.tier !== 'static' && <iframe key={attempt} ref={frameRef} src={`${publicBase}scenes/${kind}/index.html?gpuTier=${quality.tier}`}
      onLoad={() => sendScene(frameRef, { type: 'ping', quality })}
      title={kind === 'safehouse' ? 'Interactive safehouse' : 'Interactive heavy bag'} className="venue-scene__frame" />}
    {quality?.tier !== 'static' && status !== 'ready' && <div className="venue-scene__status" role="status">
      <span className="venue-kicker">{status === 'loading' ? 'Setting the scene' : 'Room unavailable'}</span>
      <strong>{status === 'loading' ? 'Stepping inside…' : 'The lights went out.'}</strong>
      {status === 'error' && <><p>You can still use the menu and open packs without the 3D scene.</p>
        <button className="venue-button" onClick={() => { setStatus('loading'); setAttempt(value => value + 1); }}>Reload scene</button></>}
    </div>}
  </div>;
}
