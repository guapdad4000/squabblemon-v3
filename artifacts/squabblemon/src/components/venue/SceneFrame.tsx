import { useEffect, useRef, useState, type RefObject } from 'react';

export type SceneMessage = { type: string; view?: string; night?: boolean; hits?: number; message?: string; anchors?: { id: string; x: number; y: number; visible: boolean }[] };

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
  const handlers = useRef({ onMessage, onReady });
  handlers.current = { onMessage, onReady };
  useEffect(() => {
    let ready = false;
    setStatus('loading');
    const timeout = window.setTimeout(() => { if (!ready) { clearInterval(probe); setStatus('error'); handlers.current.onMessage?.({ type: 'error' }); } }, 15000);
    const probe = window.setInterval(() => { if (!ready) sendScene(frameRef, { type: 'ping' }); }, 600);
    const receive = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== frameRef.current?.contentWindow) return;
      const message = event.data;
      if (!message || message.channel !== 'squabblemon-scene') return;
      if (message.type === 'ready') {
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
  }, [attempt, frameRef, kind]);
  return <div className={`venue-scene is-${status}`}>
    {poster && <img className="venue-scene__poster" src={poster} alt="" />}
    <iframe key={attempt} ref={frameRef} src={`${publicBase}scenes/${kind}/index.html`}
      onLoad={() => sendScene(frameRef, { type: 'ping' })}
      title={kind === 'safehouse' ? 'Interactive safehouse' : 'Interactive heavy bag'} className="venue-scene__frame" />
    {status !== 'ready' && <div className="venue-scene__status" role="status">
      <span className="venue-kicker">{status === 'loading' ? 'Setting the scene' : 'Room unavailable'}</span>
      <strong>{status === 'loading' ? 'Stepping inside…' : 'The lights went out.'}</strong>
      {status === 'error' && <><p>You can still use the menu and open packs without the 3D scene.</p>
        <button className="venue-button" onClick={() => { setStatus('loading'); setAttempt(value => value + 1); }}>Reload scene</button></>}
    </div>}
  </div>;
}
