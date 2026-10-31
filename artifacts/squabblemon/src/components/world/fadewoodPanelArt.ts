/** Approved, shipped artwork from the existing Story theater and character catalog. */
const posters: Record<string, string> = {
  'season-1': 'assets/story/posters/block-crown.webp',
  'season-2': 'assets/story/posters/blockbuster.webp',
  'special-sherlock': 'assets/story/posters/missing-motion.webp',
  'special-oz': 'assets/story/posters/yellow-line.webp',
  'special-alice': 'assets/story/posters/borrowed-hour.webp',
  'special-yasuke': 'assets/story/posters/banner-without-master.webp',
  'special-cellblock': 'assets/story/posters/library-hour.webp',
  'special-leon': 'assets/story/posters/place-to-return.webp',
  'special-squabble-house': 'assets/story/posters/last-waffle.webp',
  'special-kumite-break-the-bracket': 'assets/kumite/films/v1/unlock-glo-portrait.webp',
  'special-anunaki-arrival': 'assets/fadewood/anunaki-journey-preview.webp',
};
export const getFadewoodArcPoster = (arcId: string) => posters[arcId] ?? 'assets/props/neighborhood-map.webp';
const portraits: Record<string, string> = {
  cornball: 'cornball', wifey: 'wifey', sherlock: 'sherlock', yasuke: 'yasuke', snitch: 'snitch',
  'ganger-blue': 'ganger-blue', 'ganger-red': 'ganger-red', 'og-blue': 'triple-og-blue', 'og-red': 'triple-og-red',
  'baby-momma': 'baby-momma', 'cracked-head': 'cracked-head', 'inmate-kingpin': 'inmate-kingpin',
  'homeless-guy': 'homeless-guy', 'squabble-house-manager': 'squabble-house-manager', 'dr-fade': 'dr-fade',
  mailman: 'the-mailman-delivery', 'post-office': 'the-mailman-delivery', 'officer-oinkston': 'officer-oink',
  dojo: 'yasuke', county: 'inmate-kingpin', 'squabble-house': 'squabble-house-manager', 'fade-market': 'cornball',
};
export function getFadewoodSourceArt(sourceId: string, arcId?: string): { assetId: string; kind: 'character' | 'poster' | 'place' | 'scene' } {
  if (Object.hasOwn(portraits, sourceId)) return { assetId: `assets/characters/${portraits[sourceId]}.webp`, kind: 'character' };
  if (sourceId === 'anunaki-ufo') return { assetId: posters['special-anunaki-arrival'], kind: 'scene' };
  if (arcId && Object.hasOwn(posters, arcId)) return { assetId: posters[arcId], kind: 'poster' };
  if (sourceId === 'underground-arena') return { assetId: posters['special-kumite-break-the-bracket'], kind: 'poster' };
  const art = sourceId === 'safehouse' || sourceId === 'safehouse-door' ? 'safehouse' : sourceId === 'fade-park' ? 'fight' : 'streets';
  return { assetId: `brand/navigation-painted/ab/${art}.webp`, kind: 'place' };
}
