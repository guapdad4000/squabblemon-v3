/** Optional decoration must never compete with a slow connection or accessibility preference. */
export function canPlayOptionalBroadcast(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined' || document.hidden) return false;
  const connection = (navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string; downlink?: number };
  }).connection;
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    && document.documentElement.dataset.reduceMotion !== 'true'
    && !connection?.saveData
    && !['slow-2g', '2g', '3g'].includes(connection?.effectiveType ?? '')
    && !(typeof connection?.downlink === 'number' && connection.downlink < 1);
}