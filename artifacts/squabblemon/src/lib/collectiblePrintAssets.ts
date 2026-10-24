import type { Card, CardRarity } from '../data';
import normalPlate from '../assets/collector-v2/normal-plate.webp';
import normalFist from '../assets/collector-v2/normal-fist.webp';
import firePlate from '../assets/collector-v2/fire-plate.webp';
import fireFist from '../assets/collector-v2/fire-fist.webp';
import waterPlate from '../assets/collector-v2/water-plate.webp';
import waterFist from '../assets/collector-v2/water-fist.webp';
import plantPlate from '../assets/collector-v2/plant-plate.webp';
import plantFist from '../assets/collector-v2/plant-fist.webp';
import airPlate from '../assets/collector-v2/air-plate.webp';
import airFist from '../assets/collector-v2/air-fist.webp';
import electricPlate from '../assets/collector-v2/electric-plate.webp';
import electricFist from '../assets/collector-v2/electric-fist.webp';
import poisonPlate from '../assets/collector-v2/poison-plate.webp';
import poisonFist from '../assets/collector-v2/poison-fist.webp';
import lightPlate from '../assets/collector-v2/light-plate.webp';
import lightFist from '../assets/collector-v2/light-fist.webp';
import darkPlate from '../assets/collector-v2/dark-plate.webp';
import darkFist from '../assets/collector-v2/dark-fist.webp';
import earthPlate from '../assets/collector-v2/earth-plate.webp';
import earthFist from '../assets/collector-v2/earth-fist.webp';

import wordmark from '../assets/card-wordmark-white.webp';
import namePaper from '../assets/card-name-tag-paper.svg';
import foilFlakes from '../assets/collector-v2/prism-flakes.webp';

const art: Record<string, { plate: string; fist: string }> = {
  Normal: { plate: normalPlate, fist: normalFist },
  Fire: { plate: firePlate, fist: fireFist },
  Water: { plate: waterPlate, fist: waterFist },
  Plant: { plate: plantPlate, fist: plantFist },
  Air: { plate: airPlate, fist: airFist },
  Electric: { plate: electricPlate, fist: electricFist },
  Poison: { plate: poisonPlate, fist: poisonFist },
  Light: { plate: lightPlate, fist: lightFist },
  Dark: { plate: darkPlate, fist: darkFist },
  Earth: { plate: earthPlate, fist: earthFist },
};

/** One element asset map for both rendered print layers and receipt warmup. */
export function collectibleElementArtwork(card: Pick<Card, 'type'>) {
  const element = card.type === 'Rock' ? 'Earth' : card.type;
  return { element, ...(art[element] ?? art.Normal) };
}

/** Exact static resources used by an approved print; no other element is loaded. */
export function collectiblePrintArtworkSources(card: Pick<Card, 'type' | 'kind'> & { rarity: CardRarity }, foil = true): string[] {
  const images = collectibleElementArtwork(card);
  return [
    ...(card.kind === 'blockbuster' ? [] : [images.plate]),
    images.fist, wordmark, namePaper,
    ...(foil && ['Rare', 'Epic', 'Legendary', 'Mythical'].includes(card.rarity) ? [foilFlakes] : []),
  ];
}
