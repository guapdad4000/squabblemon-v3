import type { CardRarity } from '../data';
import { getAssetUrl } from './assets';

export const CARD_FINISH: Record<CardRarity, string> = {
  SuperCommon: 'Everyday stock',
  Common: 'Satin stock',
  Uncommon: 'Etched foil',
  Rare: 'Holographic',
  Epic: 'Prismatic foil',
  Legendary: 'Gold spectral',
  Mythical: 'Crimson fire foil',
};

// Reuse the illustrated locations as a coherent world behind the portrait art.
const locations: Record<string, string> = {
  Plant: 'green-underpass', Water: 'tidal-street', Ice: 'ice-alley',
  Fire: 'red-court', Electric: 'sound-stage', Psychic: 'violet-stage',
  Dark: 'shadow-stairs', Fighting: 'crown-court', Normal: 'sunset-block',
  Air: 'motion-court',
};

export function getCardWallpaper(type: string) {
  return getAssetUrl(`assets/layered/${locations[type] ?? 'gold-plaza'}.webp`);
}

const crewLocations: Record<string, string> = {
  block: 'corner-store', slide: 'moon-rooftop', crashout: 'red-court',
  receipts: 'blue-arcade', combo: 'festival-street', vibes: 'garden-court', compound: 'gold-vault',
};

export function getCrewScenery(deckId: string) {
  return getAssetUrl(`assets/layered/${crewLocations[deckId] ?? 'sunset-block'}.webp`);
}

export function cardMotionReduced() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
    || document.documentElement.dataset.reducedMotion === 'true'
    || document.documentElement.dataset.reduceMotion === 'true';
}
