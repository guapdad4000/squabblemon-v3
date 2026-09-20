import { cardCatalog, catalogCardById } from './data';

export const CHARACTER_STYLE_VERSION = 'character-style-v1';
export const CHARACTER_STYLE_OFFERS = [
  { id: 'character-stickers', name: 'Signature Sticker Pack', description: 'All four character stickers. Choose up to three for your banner.', price: 100, currency: 'styleShards', needsCard: true },
  { id: 'character-backdrop', name: 'Blue Hour Card Scene', description: 'The rooftop court behind your character card.', price: 60, currency: 'styleShards', needsCard: true },
  { id: 'character-banner-finish', name: 'Silver Lining Banner', description: 'Brushed silver edging and a soft light sweep for your character banner.', price: 120, currency: 'styleShards', needsCard: true },
] as const;
export type CharacterStyleOfferId = typeof CHARACTER_STYLE_OFFERS[number]['id'];
export type CharacterStyleSet = {
  cardId: string; title: string; tagline: string; background: string; stickerAtlas: string | null;
  stickers: readonly { id: string; name: string; cell: number }[];
};
/** Only art-complete collections may sell their sticker pack. Existing portrait and special are reused. */
export const CHARACTER_STYLE_SETS: Record<string, CharacterStyleSet> = {
  kyle: { cardId: 'kyle', title: 'Good energy. Bad intentions.', tagline: 'Smile now. Boom later.',
    background: 'assets/cosmetics/kyle/blue-hour-v1.webp', stickerAtlas: 'assets/cosmetics/kyle/stickers-v2.webp',
    stickers: [
      { id: 'kyle:point', name: 'You already know', cell: 0 },
      { id: 'kyle:smile', name: 'Smile bomb', cell: 1 },
      { id: 'kyle:star', name: 'Star player', cell: 2 },
      { id: 'kyle:kicks', name: 'Fresh steps', cell: 3 },
    ],
  },
};
export type CosmeticLoadout = { bannerCardId?: string | null; bannerFinish?: 'base' | 'silver'; stickers?: string[]; cardBackgrounds?: Record<string, 'blue-hour'> };
export type CosmeticOwner = { ownedCardIds: string[]; unlockedCosmeticIds?: string[] };
export const cosmeticId = (cardId: string, kind: CharacterStyleOfferId) => 'style:' + cardId + ':' + kind.replace('character-', '');
export function ownsStyle(owner: CosmeticOwner, cardId: string, kind: CharacterStyleOfferId) {
  return owner.ownedCardIds.includes(cardId) && (owner.unlockedCosmeticIds ?? []).includes(cosmeticId(cardId, kind));
}
export function styleSetFor(cardId: string | null | undefined) { return cardId && Object.hasOwn(CHARACTER_STYLE_SETS, cardId) ? CHARACTER_STYLE_SETS[cardId] : undefined; }
export function stickerById(id: string) {
  for (const set of Object.values(CHARACTER_STYLE_SETS)) { const sticker = set.stickers.find(item => item.id === id); if (sticker) return { set, sticker }; }
  return undefined;
}
export function validateCosmeticLoadout(owner: CosmeticOwner, input: CosmeticLoadout): string | null {
  if (input.bannerCardId && (!styleSetFor(input.bannerCardId) || !owner.ownedCardIds.includes(input.bannerCardId))) return 'Unlock this character before equipping their banner.';
  if (input.bannerFinish === 'silver' && (!input.bannerCardId || !ownsStyle(owner, input.bannerCardId, 'character-banner-finish'))) return 'Unlock Silver Lining for this character first.';
  if ((input.stickers?.length ?? 0) > 3 || new Set(input.stickers).size !== (input.stickers?.length ?? 0)) return 'Choose up to three different stickers.';
  if (input.stickers?.length && !input.bannerCardId) return 'Choose a banner before adding stickers.';
  for (const id of input.stickers ?? []) {
    const item = stickerById(id);
    if (!item?.set.stickerAtlas || !ownsStyle(owner, item.set.cardId, 'character-stickers')) return 'Unlock this sticker pack first.';
  }
  for (const [cardId, scene] of Object.entries(input.cardBackgrounds ?? {})) {
    if (scene !== 'blue-hour' || !styleSetFor(cardId) || !ownsStyle(owner, cardId, 'character-backdrop')) return 'Unlock this card scene first.';
  }
  return null;
}
/** Production order: KYLE pilot, Mythicals, remaining Legendaries, then Super Rares. */
export const CHARACTER_STYLE_ROLLOUT = cardCatalog.filter(card => ['Mythical','Legendary','Epic'].includes(card.rarity))
  .sort((a,b) => (a.catalogId === 'kyle' ? -1 : b.catalogId === 'kyle' ? 1 : ({Mythical:0,Legendary:1,Epic:2}[a.rarity as 'Mythical'] - {Mythical:0,Legendary:1,Epic:2}[b.rarity as 'Mythical']) || a.name.localeCompare(b.name)))
  .map(card => ({ cardId: card.catalogId, name: card.name, rarity: card.rarity, available: Boolean(CHARACTER_STYLE_SETS[card.catalogId]) }));
