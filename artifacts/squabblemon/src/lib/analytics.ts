export type AnalyticsData = Record<string, string | number | boolean>;

/**
 * Replit injects Umami into published website artifacts when Project Analytics
 * is enabled in Publishing settings. The app must not ship its own tracker
 * script, website ID, endpoint, or analytics environment variables.
 */
declare global {
  interface Window {
    umami?: {
      track(name: string, data?: AnalyticsData): void;
    };
  }
}

export function decisionTimeBucket(startedAt: number, now = Date.now()): string {
  const elapsedSeconds = Math.max(0, now - startedAt) / 1000;
  if (elapsedSeconds < 3) return 'under_3s';
  if (elapsedSeconds < 8) return '3_to_8s';
  if (elapsedSeconds < 15) return '8_to_15s';
  return '15s_or_more';
}

export function trackEvent(name: string, data?: AnalyticsData): void {
  if (typeof window === 'undefined') return;

  try {
    window.umami?.track(name, data);
  } catch {
    // Analytics is optional and must never affect gameplay.
  }
}