/** Launch: November 1, 2026 at 4 PM Pacific. Deployed entries remain immutable for receipt recovery. */
export const ANUNAKI_BANNER_GAMEPLAY_READY = true;
export const ANUNAKI_BANNER_CARD_IDS = ['nabu', 'enki', 'utu', 'ninhursag', 'inanna', 'enlil', 'ereshkigal'] as const;
export const isAnunakiBannerCardId = (id: string): boolean => (ANUNAKI_BANNER_CARD_IDS as readonly string[]).includes(id);
export type AnunakiBannerWindow = { startsAt: string; endsAt: string };
/** Append immutable UTC-midnight windows only after dates and gameplay are approved. */
export const ANUNAKI_BANNER_WINDOWS: readonly AnunakiBannerWindow[] = [
  { startsAt: '2026-11-02T00:00:00.000Z', endsAt: '2026-11-16T00:00:00.000Z' },
];
