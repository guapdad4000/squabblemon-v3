import { BUDDY_EARTH_COPY } from './cardFormPresentation';
import type { Card } from '../data';
import { createCardInstance, type CardInstance } from '../gameEngine';
import { LUIGION_POWERED } from '../../../../lib/squabblemon-engine/src/neighborhoodWave';

/** Read-only collection preview: no match, inventory, or equipped finish changes. */
export function previewBuddyForm(card: Card, squabbled: boolean): Card | CardInstance {
  if (card.id !== 'buddy' || !squabbled) return card;
  const normal = createCardInstance('buddy', 'player', 'form-preview', 0);
  return {
    ...card, ...normal,
    type: 'Earth', buddyForm: 'squabble-earth' as const,
    power: normal.basePower * 2, powerModifier: normal.basePower,
    ...BUDDY_EARTH_COPY,
  };
}


type FormPreview = {
  normalLabel: string;
  alternateLabel: string;
  normalHint: string;
  alternateHint: string;
  powerLabel: string;
};
const formPreviews: Readonly<Record<string, FormPreview>> = {
  buddy: {
    normalLabel: 'Normal · Plant', alternateLabel: 'Squabbled · Earth',
    normalHint: 'Plant form · Buddy Buds',
    alternateHint: 'Doubled base Hands shown · +2 Earth bonus applies in battle',
    powerLabel: 'Squabbled base · before effects',
  },
  luigion: {
    normalLabel: 'Normal', alternateLabel: 'Squabbled · Powered',
    normalHint: 'Power-Up · Squabble unlocks Powered Luigion',
    alternateHint: 'Doubled base Hands shown · reveal and movement bonuses apply in battle',
    powerLabel: 'Squabbled base · before effects',
  },
  'ms-mary-mack': {
    normalLabel: 'Normal', alternateLabel: 'Elephant · 15¢',
    normalHint: 'Collect 15¢ to return next round as an elephant',
    alternateHint: '4 Motion / 4 base Hands · invested Hands carry over in battle',
    powerLabel: 'Elephant base · before effects',
  },
  leroy: {
    normalLabel: 'Normal', alternateLabel: 'Golden Glow',
    normalHint: 'Three friendly elements unlock Golden Glow on reveal',
    alternateHint: '+3 Hands and Protection shown · needs three friendly elements',
    powerLabel: 'Golden Glow · includes +3',
  },
};

// These are alternate artwork previews, not additional gameplay forms.
const tabletPreviewIds = new Set(['anu', 'caucus-mountaineer', 'enlil', 'ereshkigal', 'inanna', 'utu']);
const tabletArtPreview: FormPreview = {
  normalLabel: 'Original art', alternateLabel: 'Tablet art',
  normalHint: 'Original character artwork',
  alternateHint: 'Alternate artwork preview only · card abilities and battle appearance stay the same',
  powerLabel: 'Base power',
};

export function tabletPreviewAsset(card: Card, alternate: boolean): string | undefined {
  return alternate && tabletPreviewIds.has(card.id) ? `assets/characters/tablet-previews/${card.id}.webp` : undefined;
}

export function getCardFormPreview(card: Card): FormPreview | undefined {
  return formPreviews[card.id] ?? (tabletPreviewIds.has(card.id) ? tabletArtPreview : undefined);
}

/** Preview actual form data without playing a turn or changing owned/equipped cards. */
export function previewCardForm(card: Card, alternate: boolean): Card | CardInstance {
  if (!alternate || !getCardFormPreview(card)) return card;
  if (tabletPreviewIds.has(card.id)) return card;
  if (card.id === 'buddy') return previewBuddyForm(card, true);
  const normal = createCardInstance(card.id, 'player', 'form-preview', 0);
  if (card.id === 'luigion') return {
    ...card, ...normal, ...LUIGION_POWERED,
    power: normal.basePower * 2, powerModifier: normal.basePower,
  };
  if (card.id === 'ms-mary-mack') return {
    ...card, ...normal,
    cost: 4, power: 4, basePower: 4,
    maryCents: 15, maryElephant: true, maryTransformUsed: true,
  };
  if (card.id === 'leroy') return {
    ...card, ...normal,
    goldenGlow: true, power: normal.basePower + 3, powerModifier: 3,
    statuses: { ...normal.statuses, protected: true },
  };
  return card;
}
