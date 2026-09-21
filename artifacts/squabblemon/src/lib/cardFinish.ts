import type { CardRarity } from '../data';
import { getAssetUrl } from './assets';

export const CARD_FINISH: Record<CardRarity, string> = {
  SuperCommon: 'Pressed stock',
  Common: 'Pearl satin',
  Uncommon: 'Emerald engraving',
  Rare: 'Cobalt diffraction',
  Epic: 'Amethyst fracture',
  Legendary: 'Sovereign gold',
  Mythical: 'Crimson eclipse',
};

export const VARIANT_FINISH = {
  tagged: { name: 'Tagged', finish: 'Gold-stamped lacquer', description: 'Raised gold ink, vermilion tags and a lacquered frame over the original foil.' },
  chrome: { name: 'Chrome', finish: 'Mirror-cut chrome', description: 'Polished silver, diamond-cut engraving and an icy spectral reflection.' },
  crazy: { name: 'Crazy', finish: 'Breakout action frame', description: 'Alternate airborne character art crashing beyond the collector frame.' },
} as const;

export function cardFinishLabel(rarity: CardRarity, variant?: 'tagged' | 'chrome' | 'crazy' | null) {
  return variant ? VARIANT_FINISH[variant].finish : CARD_FINISH[rarity];
}

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
    || document.documentElement.dataset.reduceMotion === 'true'
    || document.documentElement.dataset.reducedMotion === 'true';
}
