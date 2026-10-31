import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { getAssetUrl } from '../../lib/assets';
import { isWorldEvent, type RuntimeMode, type WorldCheckpoint, type WorldEvent } from '../../lib/fadewood/contracts';

export type FadewoodFrameStatus = 'loading' | 'ready' | 'error';
export type FadewoodSceneHandle = {
  travel: (requestId: string, destinationId: string) => void;
  cancelTravel: (requestId: string) => void;
  restore: (checkpoint: WorldCheckpoint) => void;
  focus: (requestId: string, sourceId: string) => void;
  releaseFocus: (requestId?: string) => void;
  setLighting: (night: boolean) => void;
  setPresentation: (presentation: FadewoodPresentation) => void;
};
export type FadewoodPresentation = { storyTargets: { arcId: string; sourceId: string; label: string }[]; mail?: { unread: number; gifts: number; attentionId?: string; opened?: boolean } };
export interface FadewoodSceneFrameProps {
  mode: RuntimeMode;
  reducedMotion: boolean;
  night?: boolean;
  checkpoint?: WorldCheckpoint | null;
  onEvent: (event: WorldEvent) => void;
  onStatus: (status: FadewoodFrameStatus, message?: string) => void;
  /** A same-origin child stub is used only by the isolated bridge fixture. */
  childSrc?: string;
}

/** Renderer isolation keeps GPU work and high-frequency world state outside React. */
export const FadewoodSceneFrame = forwardRef<FadewoodSceneHandle, FadewoodSceneFrameProps>(function FadewoodSceneFrame({ mode, reducedMotion, night = false, checkpoint, onEvent, onStatus, childSrc }, ref) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [instanceId] = useState(() => typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `world-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const callbacks = useRef({ onEvent, onStatus });
  callbacks.current = { onEvent, onStatus };
  const settings = useRef({ reducedMotion, night, checkpoint });
  settings.current = { reducedMotion, night, checkpoint };
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const ready = useRef(false);
  const loaded = useRef(false);
  const presentation = useRef<FadewoodPresentation | null>(null);
  const send = (type: string, payload: Record<string, unknown> = {}) => {
    frame.current?.contentWindow?.postMessage({ channel: 'squabblemon-fadewood', version: 1, instanceId, type, ...payload }, window.location.origin);
  };
  const initialize = () => send('init', { reducedMotion: settings.current.reducedMotion, night: settings.current.night, ...(!ready.current && settings.current.checkpoint ? { checkpoint: settings.current.checkpoint } : {}) });
  useImperativeHandle(ref, () => ({
    travel(requestId, destinationId) { if (ready.current && !document.hidden) { send('mode', { mode: 'exploring' }); send('travel', { requestId, destinationId }); } },
    cancelTravel(requestId) { send('cancelTravel', { requestId }); },
    restore(value) { send('restore', { checkpoint: value }); },
    focus(requestId, sourceId) { if (ready.current && !document.hidden) { send('mode', { mode: 'exploring' }); send('focus', { requestId, sourceId }); } },
    releaseFocus(requestId) { send('releaseFocus', requestId ? { requestId } : {}); },
    setLighting(value) { if (ready.current) send('lighting', { night: value }); },
    setPresentation(value) { presentation.current = value; if (ready.current) send('presentation', value); },
  }), [instanceId]);

  useEffect(() => {
    let disposed = false;
    const receive = (event: MessageEvent) => {
      if (disposed || event.origin !== window.location.origin || event.source !== frame.current?.contentWindow || !isWorldEvent(event.data, instanceId)) return;
      const value = event.data;
      if (value.type === 'ready') {
        ready.current = true;
        callbacks.current.onStatus('ready');
        send('lighting', { night: settings.current.night });
        send('mode', { mode: document.hidden ? 'suspended' : modeRef.current });
        if (presentation.current) send('presentation', presentation.current);
      } else if (value.type === 'error') {
        ready.current = false;
        callbacks.current.onStatus('error', 'The street could not finish loading. Your Story progress is safe.');
      }
      callbacks.current.onEvent(value);
    };
    const visibility = () => { if (ready.current) send('mode', { mode: document.hidden ? 'suspended' : modeRef.current }); };
    window.addEventListener('message', receive);
    document.addEventListener('visibilitychange', visibility);
    const handshake = window.setInterval(() => { if (loaded.current && !ready.current) initialize(); }, 1500);
    const timeout = window.setTimeout(() => { if (!ready.current) callbacks.current.onStatus('error', 'The street is taking too long to load. You can retry or continue from the Story archive.'); }, 60_000);
    return () => {
      disposed = true;
      send('dispose');
      ready.current = false;
      window.clearInterval(handshake);
      window.clearTimeout(timeout);
      window.removeEventListener('message', receive);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [instanceId]);
  useEffect(() => { if (ready.current) send('mode', { mode: document.hidden ? 'suspended' : mode }); }, [mode, instanceId]);
  useEffect(() => { if (loaded.current) initialize(); }, [reducedMotion, instanceId]);
  useEffect(() => { if (ready.current) send('lighting', { night }); }, [night, instanceId]);

  return <iframe ref={frame} className="fadewood-world__frame" title="Explore Fadewood" src={childSrc ?? `${getAssetUrl('scenes/fadewood/index.html')}?host=1`}
    allow="fullscreen" referrerPolicy="same-origin" tabIndex={mode === 'exploring' ? 0 : -1}
    onLoad={() => { loaded.current = true; initialize(); }} onError={() => callbacks.current.onStatus('error', 'The street could not load. Retry or use the Story archive.')} />;
});
