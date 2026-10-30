/**
 * Editorial-wide patch banners are deliberately opt-in. A version alone is not
 * enough: the expected original character art ID must also still be present.
 */
export const PATCH_BANNERS = {
  '1.15': {
    artCardId: 'dragonfly-jones',
    aspectRatio: '3 / 1',
    path: 'assets/events/kumite-breakthrough-patch-1-15.webp',
    smallPath: 'assets/events/kumite-breakthrough-patch-1-15-small.webp',
    alt: 'Kumite Breakthrough Beta: Dragonfly Jones and Chonk Lee clash through gold and crimson ink.',
  },
  '1.14': {
    artCardId: 'folks',
    aspectRatio: '3 / 1',
    path: 'assets/events/collector-v2-patch-1-14.webp',
    smallPath: 'assets/events/collector-v2-patch-1-14-small.webp',
    alt: 'Print. Prism. Punch. Collector V2, featuring the new FOLKS, GUAP and BUDDY collectible cards.',
  },
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
    alt: 'The Last Waffle: Squabble House manager, The Opps in Blue and Red around the final waffle',
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