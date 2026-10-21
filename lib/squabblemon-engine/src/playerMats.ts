import type { StyleShardRarity } from './styleShards';

/** Display-only collectibles. These IDs never enter battle rules or card costs. */
export type PlayerMat = {
  id: string; name: string; characterId?: string; assetId: string; portraitAssetId?: string; characterAssetId?: string;
  /** Three authored open areas within one illustrated world. */
  laneScene?: boolean; corner?: 'left' | 'right'; posterAssetId?: string;
  rarity: StyleShardRarity; position?: string; source: 'default' | 'story' | 'shop'; price: number;
  storyNodeId?: string; storyTitle?: string;
};
const venue = (id: string, name: string): PlayerMat => ({
  id, name, assetId: `assets/player-mats/v4/${id}-scene.webp`, portraitAssetId: `assets/player-mats/v4/${id}-portrait.webp`, source: 'default', price: 0, rarity: 'Common',
});
const signature = (characterId: string, name: string, rarity: StyleShardRarity, price: number, storyNodeId?: string, storyTitle?: string): PlayerMat => ({
  id: `signature-${characterId}`, characterId, name, rarity, assetId: `assets/player-mats/v4/${characterId}-scene.webp`,
  posterAssetId: `assets/player-mats/v4/${characterId}-illustration.webp`, characterAssetId: `assets/player-mats/v4/${characterId}-corner.webp`, laneScene: true,
  corner: ['kyle','captain-jigga','simmy','foodz','john-henry','franklin-duke','bushedo-brown','dr-fade','og-uncle','leroy'].includes(characterId) ? 'left' : 'right',
  source: storyNodeId ? 'story' : 'shop', price: storyNodeId ? 0 : price, storyNodeId, storyTitle,
});
export const PLAYER_MATS: readonly PlayerMat[] = [
  venue('corner-store', 'The Corner'),
  venue('harbor-skyline', 'Harbor After Dark'),
  venue('civic-hill', 'Civic Steps'),
  venue('red-fence-night', 'Red Fence'),
  venue('crown-rooftop', 'Rooftop Champions'),
  signature('kyle', 'Blue Hour', 'Legendary', 200),
  signature('guap', 'All Gold', 'Mythical', 280),
  signature('captain-jigga', 'First Class', 'Mythical', 280),
  signature('ashlee', 'Island in the Sky', 'Mythical', 280),
  signature('simmy', 'After Hours', 'Mythical', 280),
  signature('stockz', 'Top Floor', 'Rare', 140),
  signature('foodz', 'Everybody Eats', 'Mythical', 280),
  signature('buddy', 'Homegrown', 'Legendary', 200),
  signature('yasuke', 'Quiet Resolve', 'Mythical', 280),
  signature('john-henry', 'Steel Yard', 'Mythical', 280),
  signature('dragonfly-jones', 'Big Talk', 'Legendary', 200),
  signature('franklin-duke', 'Full Contact', 'Epic', 180),
  signature('chonk-lee', 'No Mercy', 'Legendary', 200),
  signature('bushedo-brown', 'Do Not Disturb', 'Rare', 140),
  signature('undercova-brotha', 'Under the Radar', 'Rare', 140),
  signature('dr-fade', 'First Fade', 'Legendary', 0, 'welcome-to-the-block', 'Welcome to the Block'),
  signature('abuela', 'Family Business', 'Common', 0, 'red-tapes-mama-has-the-floor', 'Mama Has the Floor'),
  signature('og-uncle', 'Been Here', 'Mythical', 0, 'og-uncles-visit', "OG Uncle’s Visit"),
  signature('church-auntie', 'Sunday Best', 'Epic', 0, 'church-aunties-blessing', 'Auntie’s Terms'),
  signature('leroy', 'The Glow', 'Mythical', 0, 's2-rooftop-demo-table', 'The Demo Table'),
];
const byId = new Map(PLAYER_MATS.map(mat => [mat.id, mat]));
export const DEFAULT_PLAYER_MAT_ID = 'corner-store';
export const playerMatById = (id?: string | null) => id ? byId.get(id) : undefined;
export const playerMatUnlockId = (id: string) => `player-mat:${id}`;
export type PlayerMatOwner = { unlockedCosmeticIds?: string[]; storyProgress?: Record<string, unknown> };
export function ownsPlayerMat(owner: PlayerMatOwner, id: string): boolean {
  const mat = playerMatById(id);
  if (!mat) return false;
  if (mat.source === 'default') return true;
  if (mat.source === 'shop') return !!owner.unlockedCosmeticIds?.includes(playerMatUnlockId(id));
  const progress = mat.storyNodeId ? owner.storyProgress?.[mat.storyNodeId] : undefined;
  return !!progress && typeof progress === 'object' && (progress as { cleared?: unknown }).cleared === true;
}
/** Unknown, removed or unowned selections resolve to a free venue. */
export function equippedPlayerMat(owner: PlayerMatOwner & { settings?: { cosmetics?: { playerMatId?: string | null } } }): string {
  const id = owner.settings?.cosmetics?.playerMatId;
  return id && ownsPlayerMat(owner, id) ? id : DEFAULT_PLAYER_MAT_ID;
}
export function playerMatForCharacter(cardId: string) { return PLAYER_MATS.find(mat => mat.characterId === cardId); }
