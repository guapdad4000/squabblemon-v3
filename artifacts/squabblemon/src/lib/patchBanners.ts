/**
 * Editorial-wide patch banners are deliberately opt-in. A version alone is not
 * enough: the expected original character art ID must also still be present.
 */
export const PATCH_BANNERS = {
  '1.11': {
    artCardId: 'the-og-rap-legend',
    aspectRatio: '3 / 1',
    path: 'assets/events/street-legends-patch-1-11.webp',
    alt: 'Them Streets Talkin: Mr. Mc Hands, OG Rap Legend, Lash Tech and Pimp Swookie. 30 new fighters, 10 tickets on us.',
  },
  '1.9': {
    artCardId: 'squabble-house-manager',
    aspectRatio: '16 / 9',
    path: 'assets/events/last-waffle-patch-1-9.webp',
    alt: 'The Last Waffle: Squabble House manager, Blue and Red rivals around the final waffle',
  },
  '1.7': {
    artCardId: 'triple-og-blue',
    aspectRatio: '16 / 9',
    path: 'assets/events/triple-og-patch-1-7.webp',
    alt: 'Original Blue OG and Red OG with their dogs on the block',
  },
} as const;

export function getPatchBanner(version?: string | null, artCardId?: string | null) {
  if (!version || !artCardId) return undefined;
  const banner = PATCH_BANNERS[version as keyof typeof PATCH_BANNERS];
  return banner?.artCardId === artCardId ? banner : undefined;
}