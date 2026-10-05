type RecoveryTarget = Pick<Window, 'addEventListener' | 'removeEventListener'>;
/** Compatibility key for existing clients; no automatic reloads are performed. */
export function staleChunkReloadKey(payload: unknown) {
  return `squabblemon:stale-chunk-reload:${payload instanceof Error ? payload.message : String(payload)}`;
}
/** Let navigation errors reach the error boundary; background failures remain caught. */
export function installStaleChunkRecovery(target: RecoveryTarget = window) {
  const recover = () => { /* Never reload an active pull, scene, or match. */ };
  target.addEventListener('vite:preloadError', recover);
  return () => target.removeEventListener('vite:preloadError', recover);
}
