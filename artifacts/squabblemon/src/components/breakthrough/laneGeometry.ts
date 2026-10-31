import type { CSSProperties } from 'react';

/** Shared centerline for fighters, hit art and their source trails. */
export function trackPosition(position: number): CSSProperties {
  return {
    '--bt-position': Math.max(0, Math.min(1, position)),
    bottom:
      'calc(var(--bt-track-edge) + var(--bt-track-span) * var(--bt-position))',
  } as CSSProperties;
}
