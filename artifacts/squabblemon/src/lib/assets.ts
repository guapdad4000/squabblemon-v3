export const getAssetUrl = (path: string) =>
  `${import.meta.env?.BASE_URL ?? '/'}${path.replace(/^\/+/, '')}`;

export const getCardImage = (id: string) =>
  getAssetUrl(`assets/characters/${id}.webp`);