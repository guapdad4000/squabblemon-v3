import characterRevisions from '../characterRevisions.json';
import { elementalStandin } from './elementalStandins';

export const getAssetUrl = (path: string) =>
  `${(import.meta.env?.BASE_URL ?? '/').replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;

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
  const url = getAssetUrl(`assets/characters/${id}.webp`);
  const revision = (characterRevisions as Record<string, string>)[id];
  return revision ? `${url}?v=${revision}` : url;
};
