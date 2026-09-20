import { cardCatalog, catalogCardById } from './data';

export const CHARACTER_STYLE_VERSION = 'character-style-v2';
export const CHARACTER_STYLE_OFFERS = [
  { id: 'character-stickers', name: 'Signature Sticker Pack', description: 'All four character stickers. Choose up to three for your banner.', price: 100, currency: 'styleShards', needsCard: true },
  { id: 'character-backdrop', name: 'Signature Card Scene', description: 'A character-themed environment behind your card.', price: 60, currency: 'styleShards', needsCard: true },
  { id: 'character-banner-finish', name: 'Silver Lining Banner', description: 'Brushed silver edging and a soft light sweep for your character banner.', price: 120, currency: 'styleShards', needsCard: true },
] as const;
export type CharacterStyleOfferId = typeof CHARACTER_STYLE_OFFERS[number]['id'];
export type CharacterStyleSet = {
  series: string; sceneName: string; sceneDescription: string; emblem: string; accent: string;
  cardId: string; title: string; tagline: string; background: string; stickerAtlas: string | null;
  stickers: readonly { id: string; name: string; cell: number }[];
};
/** Only art-complete collections may sell their sticker pack. Existing portrait and special are reused. */
export const CHARACTER_STYLE_SETS: Record<string, CharacterStyleSet> = {
  kyle: { series: '001', sceneName: 'Blue Hour', sceneDescription: 'The rooftop court at blue hour.', emblem: 'K★', accent: '#92acc5', cardId: 'kyle', title: 'Good energy. Bad intentions.', tagline: 'Smile now. Boom later.',
    background: 'assets/cosmetics/kyle/blue-hour-v1.webp', stickerAtlas: 'assets/cosmetics/kyle/stickers-v2.webp',
    stickers: [
      { id: 'kyle:point', name: 'You already know', cell: 0 },
      { id: 'kyle:smile', name: 'Smile bomb', cell: 1 },
      { id: 'kyle:star', name: 'Star player', cell: 2 },
      { id: 'kyle:kicks', name: 'Fresh steps', cell: 3 },
    ],
  },  "stockz": {"cardId":"stockz","series":"002","title":"Make every move count.","tagline":"Build the look. Let it compound.","sceneName":"Penthouse","sceneDescription":"A quiet skyline above the city.","emblem":"↗","accent":"#b5bb85","background":"assets/locations/penthouse.webp","stickerAtlas":"assets/cosmetics/stockz/stickers-v1.webp","stickers":[{"id":"stockz:portrait","name":"Buy money","cell":0},{"id":"stockz:signature","name":"Gold deck","cell":1},{"id":"stockz:keepsake","name":"Black card","cell":2},{"id":"stockz:mark","name":"Going up","cell":3}]},
  "ashlee": {"cardId":"ashlee","series":"003","title":"Big heart. Bigger backup.","tagline":"Carry the whole crew.","sceneName":"Green Room","sceneDescription":"A garden above the block.","emblem":"A","accent":"#a6b58c","background":"assets/locations/rooftop-garden.webp","stickerAtlas":"assets/cosmetics/ashlee/stickers-v1.webp","stickers":[{"id":"ashlee:portrait","name":"Jet set","cell":0},{"id":"ashlee:signature","name":"Guyana","cell":1},{"id":"ashlee:keepsake","name":"Heavy steps","cell":2},{"id":"ashlee:mark","name":"Island silver","cell":3}]},
  "captain-jigga": {"cardId":"captain-jigga","series":"004","title":"First class. Full crew.","tagline":"Clear the runway.","sceneName":"Departures","sceneDescription":"City lights on the move.","emblem":"CJ","accent":"#96b7ce","background":"assets/locations/rush-hour.webp","stickerAtlas":"assets/cosmetics/captain-jigga/stickers-v1.webp","stickers":[{"id":"captain-jigga:portrait","name":"The captain","cell":0},{"id":"captain-jigga:signature","name":"Green crew","cell":1},{"id":"captain-jigga:keepsake","name":"Red crew","cell":2},{"id":"captain-jigga:mark","name":"Captain wings","cell":3}]},
  "church-auntie": {"cardId":"church-auntie","series":"005","title":"Covered. Always.","tagline":"Grace with a little pressure.","sceneName":"Sunday Light","sceneDescription":"Warm light through stained glass.","emblem":"CA","accent":"#b5a2bb","background":"assets/locations/corrupt-church.webp","stickerAtlas":"assets/cosmetics/church-auntie/stickers-v1.webp","stickers":[{"id":"church-auntie:portrait","name":"Sunday best","cell":0},{"id":"church-auntie:signature","name":"Church fan","cell":1},{"id":"church-auntie:keepsake","name":"Blessed bag","cell":2},{"id":"church-auntie:mark","name":"Pearls and petals","cell":3}]},
  "guap": {"cardId":"guap","series":"006","title":"All hands. All shine.","tagline":"Built for the spotlight.","sceneName":"Golden Hour","sceneDescription":"Velvet shadows and warm brass.","emblem":"G","accent":"#bca578","background":"assets/locations/vip-section.webp","stickerAtlas":"assets/cosmetics/guap/stickers-v1.webp","stickers":[{"id":"guap:portrait","name":"The wave","cell":0},{"id":"guap:signature","name":"Heavy gold","cell":1},{"id":"guap:keepsake","name":"Big steppers","cell":2},{"id":"guap:mark","name":"Chain reaction","cell":3}]},
  "simmy": {"cardId":"simmy","series":"007","title":"Keep your heart guarded.","tagline":"Soft roses. Hard lessons.","sceneName":"After Hours","sceneDescription":"Lantern light after the crowds.","emblem":"S","accent":"#ba939e","background":"assets/locations/night-market.webp","stickerAtlas":"assets/cosmetics/simmy/stickers-v1.webp","stickers":[{"id":"simmy:portrait","name":"Heartbreaker","cell":0},{"id":"simmy:signature","name":"Last rose","cell":1},{"id":"simmy:keepsake","name":"Cold weather","cell":2},{"id":"simmy:mark","name":"Heart on a chain","cell":3}]},
  "foodz": {"cardId":"foodz","series":"008","title":"Everybody eats.","tagline":"A full plate for the whole crew.","sceneName":"Family Table","sceneDescription":"Warm lights at the community kitchen.","emblem":"F","accent":"#c3b47b","background":"assets/locations/community-kitchen.webp","stickerAtlas":"assets/cosmetics/foodz/stickers-v1.webp","stickers":[{"id":"foodz:portrait","name":"Whats cooking","cell":0},{"id":"foodz:signature","name":"Full plate","cell":1},{"id":"foodz:keepsake","name":"Good food bag","cell":2},{"id":"foodz:mark","name":"Table service","cell":3}]},
  "yasuke": {"cardId":"yasuke","series":"009","title":"Stand tall. Strike true.","tagline":"Honor in every move.","sceneName":"Quiet Resolve","sceneDescription":"A moment of calm above the city.","emblem":"Y","accent":"#af9e8c","background":"assets/locations/rooftop-garden.webp","stickerAtlas":"assets/cosmetics/yasuke/stickers-v1.webp","stickers":[{"id":"yasuke:portrait","name":"Black blade","cell":0},{"id":"yasuke:signature","name":"Armor crest","cell":1},{"id":"yasuke:keepsake","name":"Steel edge","cell":2},{"id":"yasuke:mark","name":"Honor seal","cell":3}]},
  "john-henry": {"cardId":"john-henry","series":"010","title":"Built to last.","tagline":"Steel in your hands. Heart in your work.","sceneName":"Steel Yard","sceneDescription":"Work lights among brick and steel.","emblem":"JH","accent":"#a7aab1","background":"assets/locations/construction-site.webp","stickerAtlas":"assets/cosmetics/john-henry/stickers-v1.webp","stickers":[{"id":"john-henry:portrait","name":"Steel driver","cell":0},{"id":"john-henry:signature","name":"Heavy hammer","cell":1},{"id":"john-henry:keepsake","name":"Work boots","cell":2},{"id":"john-henry:mark","name":"Rail steel","cell":3}]},
  "leroy": {"cardId":"leroy","series":"011","title":"Find your glow.","tagline":"Calm before the counter.","sceneName":"The Dojo","sceneDescription":"Warm light over a quiet fighting ring.","emblem":"L","accent":"#c5b584","background":"assets/locations/underground-ring.webp","stickerAtlas":"assets/cosmetics/leroy/stickers-v1.webp","stickers":[{"id":"leroy:portrait","name":"The glow","cell":0},{"id":"leroy:signature","name":"Golden fist","cell":1},{"id":"leroy:keepsake","name":"Training shoes","cell":2},{"id":"leroy:mark","name":"Inner circle","cell":3}]},
  "og-uncle": {"cardId":"og-uncle","series":"012","title":"Been here. Still here.","tagline":"Respect comes with the years.","sceneName":"Old School","sceneDescription":"Warm wood and neighborhood stories.","emblem":"OG","accent":"#b2a68d","background":"assets/locations/barbershop.webp","stickerAtlas":"assets/cosmetics/og-uncle/stickers-v1.webp","stickers":[{"id":"og-uncle:portrait","name":"OG energy","cell":0},{"id":"og-uncle:signature","name":"Golden cane","cell":1},{"id":"og-uncle:keepsake","name":"Old school","cell":2},{"id":"og-uncle:mark","name":"Been here","cell":3}]},
  "last-train-conductor": {"cardId":"last-train-conductor","series":"013","title":"Next stop. Your block.","tagline":"Keep the city moving.","sceneName":"Last Train","sceneDescription":"Platform lights after midnight.","emblem":"LT","accent":"#99abba","background":"assets/locations/the-subway.webp","stickerAtlas":"assets/cosmetics/last-train-conductor/stickers-v1.webp","stickers":[{"id":"last-train-conductor:portrait","name":"Last call","cell":0},{"id":"last-train-conductor:signature","name":"Conductors cap","cell":1},{"id":"last-train-conductor:keepsake","name":"Pocket watch","cell":2},{"id":"last-train-conductor:mark","name":"All aboard","cell":3}]},
  "midnight-mayor": {"cardId":"midnight-mayor","series":"014","title":"The city stays awake.","tagline":"Own the night.","sceneName":"Midnight","sceneDescription":"Signs and silhouettes after dark.","emblem":"MM","accent":"#a4a0bb","background":"assets/locations/time-square.webp","stickerAtlas":"assets/cosmetics/midnight-mayor/stickers-v1.webp","stickers":[{"id":"midnight-mayor:portrait","name":"Night shift","cell":0},{"id":"midnight-mayor:signature","name":"Skyline crown","cell":1},{"id":"midnight-mayor:keepsake","name":"After hours","cell":2},{"id":"midnight-mayor:mark","name":"Keys to the city","cell":3}]},
  "block-party-titan": {"cardId":"block-party-titan","series":"015","title":"Bring the whole block.","tagline":"Turn the street into your stage.","sceneName":"Block Party","sceneDescription":"Warm speakers and late-night radio.","emblem":"BT","accent":"#bfa17e","background":"assets/locations/pirate-radio.webp","stickerAtlas":"assets/cosmetics/block-party-titan/stickers-v1.webp","stickers":[{"id":"block-party-titan:portrait","name":"Block royalty","cell":0},{"id":"block-party-titan:signature","name":"Sound system","cell":1},{"id":"block-party-titan:keepsake","name":"Heavy chain","cell":2},{"id":"block-party-titan:mark","name":"Party starter","cell":3}]},
};
/** blue-hour remains the saved default-scene key for compatibility with existing KYLE purchases. */
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
export const CHARACTER_STYLE_ROLLOUT = cardCatalog.filter(card => Boolean(CHARACTER_STYLE_SETS[card.catalogId]) || ['Mythical','Legendary','Epic'].includes(card.rarity))
  .sort((a,b) => (a.catalogId === 'kyle' ? -1 : b.catalogId === 'kyle' ? 1 : ({Mythical:0,Legendary:1,Epic:2}[a.rarity as 'Mythical'] - {Mythical:0,Legendary:1,Epic:2}[b.rarity as 'Mythical']) || a.name.localeCompare(b.name)))
  .map(card => ({ cardId: card.catalogId, name: card.name, rarity: card.rarity, available: Boolean(CHARACTER_STYLE_SETS[card.catalogId]) }));
