import characterRevisions from '../characterRevisions.json';
import { elementalStandin } from './elementalStandins';

export const getAssetUrl = (path: string) => {
  const cleanPath = path.replace(/^\/+/, '');
  const url = `${(import.meta.env?.BASE_URL ?? '/').replace(/\/+$/, '')}/${cleanPath}`;
  // Story dialogue and battle opponents use asset paths, not catalog IDs. Give
  // those portraits the same revision as collection and card views.
  const artworkId = /^assets\/characters\/([^/]+)\.webp$/.exec(cleanPath)?.[1];
  const revision = artworkId && (characterRevisions as Record<string, string>)[artworkId];
  return revision ? `${url}?v=${revision}` : url;
};

// Older saved battles used the gameplay ID for these summoned portraits.
const legacyPortraitIds: Record<string, string> = { shiesty: 'shiesty-yn', grin: 'cheshire', cardguard: 'queen-of-hearts' };
export const getCardImage = (cardId: string, variantId?: string | null) => {
  const standin = elementalStandin(cardId);
  if (standin) return standin;
  const baseId = Object.hasOwn(legacyPortraitIds, cardId) ? legacyPortraitIds[cardId] : cardId;
  const alternates = ['dorothy', 'scarecrow', 'tin-man', 'lion', 'alice', 'cheshire', 'sherlock', 'watson'];
  const id = baseId === 'cologne-criminal' && variantId === 'cologne-criminal:crazy'
    ? 'cologne-criminal-crazy'
    : alternates.includes(baseId) && variantId === baseId + ':alternate' ? baseId + '-alternate' : baseId;
  return getAssetUrl(`assets/characters/${id}.webp`);
};
