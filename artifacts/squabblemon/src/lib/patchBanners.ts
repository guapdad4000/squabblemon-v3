/**
 * Editorial-wide patch banners are deliberately opt-in. A version alone is not
 * enough: the expected original character art ID must also still be present.
 */
export const PATCH_BANNERS = {
  '1.7': {
    artCardId: 'triple-og-blue',
    path: 'assets/events/triple-og-patch-1-7.webp',
    alt: 'Original Blue OG and Red OG with their dogs on the block',
  },
} as const;

export function getPatchBanner(version?: string | null, artCardId?: string | null) {
  if (!version || !artCardId) return undefined;
  const banner = PATCH_BANNERS[version as keyof typeof PATCH_BANNERS];
  return banner?.artCardId === artCardId ? banner : undefined;
}