import type { DistrictId } from '@workspace/squabblemon-engine/districts';
import { getAssetUrl } from './data';

type LegacyLocationId = 'legacy-0' | 'legacy-1' | 'legacy-2';
type LocationArt = { name: string; image: string };

/** Shared artwork for floating battle nodes and ambient wallpapers. */
export const LOCATION_ARTWORK = {
  'bodega': { name: 'BODEGA', image: 'bodega' },
  'the-trap': { name: 'THE TRAP', image: 'the-trap' },
  'waff-l-house': { name: 'WAFF-L HOUSE', image: 'waff-l-house' },
  'vip-section': { name: 'VIP SECTION', image: 'vip-section' },
  'county-jail': { name: 'COUNTY JAIL', image: 'county-jail' },
  'penthouse': { name: 'PENTHOUSE', image: 'penthouse' },
  'time-square': { name: 'TIME SQUARE', image: 'time-square' },
  'magic-city': { name: 'MAGIC CITY', image: 'magic-city' },
  'the-subway': { name: 'THE SUBWAY', image: 'the-subway' },
  'o-block': { name: 'O-BLOCK', image: 'o-block' },
  'hollywood-strip': { name: 'HOLLYWOOD STRIP', image: 'hollywood-strip' },
  'dive-bar': { name: 'DIVE BAR', image: 'dive-bar' },
  'acorn-projects': { name: 'ACORN PROJECTS', image: 'acorn-projects' },
  'corrupt-church': { name: 'CORRUPT CHURCH', image: 'corrupt-church' },
  'nail-salon': { name: 'NAIL SALON', image: 'nail-salon' },
  'barbershop': { name: 'BARBERSHOP', image: 'barbershop' },
  'legacy-0': { name: 'THE TOWN', image: 'legacy-0' },
  'legacy-1': { name: 'GROUP CHAT', image: 'legacy-1' },
  'legacy-2': { name: 'SERVER ROOM', image: 'legacy-2' },
} satisfies Record<DistrictId | LegacyLocationId, LocationArt>;

export function getLocationArtwork(id: string) {
  const art = Object.hasOwn(LOCATION_ARTWORK, id)
    ? LOCATION_ARTWORK[id as keyof typeof LOCATION_ARTWORK]
    : LOCATION_ARTWORK['legacy-0'];
  return {
    ...art,
    node: getAssetUrl(`assets/locations/${art.image}-node.webp`),
    wallpaper: getAssetUrl(`assets/locations/${art.image}.webp`),
  };
}
