import characterRevisions from '../characterRevisions.json';

export const getAssetUrl = (path: string) =>
  `${(import.meta.env?.BASE_URL ?? '/').replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;

export const getCardImage = (id: string) => {
  const url = getAssetUrl(`assets/characters/${id}.webp`);
  const revision = (characterRevisions as Record<string, string>)[id];
  return revision ? `${url}?v=${revision}` : url;
};
