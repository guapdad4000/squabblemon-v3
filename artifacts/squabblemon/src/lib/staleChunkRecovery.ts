const reloadMarkerPrefix = 'squabblemon:stale-chunk-reload:';

type PreloadErrorEvent = Event & { payload?: unknown };
type RecoveryTarget = Pick<Window, 'addEventListener' | 'removeEventListener' | 'sessionStorage' | 'location'>;

function payloadMessage(payload: unknown) {
  if (payload instanceof Error) return payload.message;
  if (typeof payload === 'string') return payload;
  try { return JSON.stringify(payload) || 'unknown'; }
  catch { return String(payload); }
}

export function staleChunkReloadKey(payload: unknown) {
  return `${reloadMarkerPrefix}${payloadMessage(payload).slice(0, 768)}`;
}

/**
 * A tab left open across an atomic deploy can still request chunk hashes from
 * the previous release. Refresh once for that exact missing chunk so the tab
 * receives the current HTML manifest without creating a reload loop.
 */
export function installStaleChunkRecovery(target: RecoveryTarget = window) {
  const recover = (event: Event) => {
    const preloadError = event as PreloadErrorEvent;
    const marker = staleChunkReloadKey(preloadError.payload);
    try {
      if (target.sessionStorage.getItem(marker)) return;
      target.sessionStorage.setItem(marker, '1');
    } catch {
      // If storage is blocked, keep the normal error boundary instead of
      // risking an unbounded reload loop.
      return;
    }
    event.preventDefault();
    target.location.reload();
  };
  target.addEventListener('vite:preloadError', recover);
  return () => target.removeEventListener('vite:preloadError', recover);
}
