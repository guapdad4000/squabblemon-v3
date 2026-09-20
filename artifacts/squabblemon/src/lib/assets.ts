import characterRevisions from '../characterRevisions.json';

export const getAssetUrl = (path: string) =>
  `${(import.meta.env?.BASE_URL ?? '/').replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;

// Older saved battles used the gameplay ID for these summoned portraits.
const legacyPortraitIds: Record<string, string> = { shiesty: 'shiesty-yn' };
export const getCardImage = (cardId: string) => {
  const id = Object.hasOwn(legacyPortraitIds, cardId) ? legacyPortraitIds[cardId] : cardId;
  const url = getAssetUrl(`assets/characters/${id}.webp`);
  const revision = (characterRevisions as Record<string, string>)[id];
  return revision ? `${url}?v=${revision}` : url;
};
