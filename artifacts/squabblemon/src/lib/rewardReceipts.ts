import { STYLE_SHARD_RARITIES, normalizeStyleShardBalances, styleShardLabel, type StyleShardRarity } from '@workspace/squabblemon-engine/styleShards';
import type { PlayerBootstrap } from '@workspace/api-client-react';
import type { GameGlyphName } from '../components/venue/GameGlyph';
import { catalogCardById, getCardImage } from '../data';
export type RewardItem = { label: string; amount?: number; glyph?: GameGlyphName; shardRarity?: StyleShardRarity; image?: string };
export type RewardReceipt = { id: string; title: string; items: RewardItem[]; preview?: boolean; level?: number; achievement?: boolean; story?: { chapterTitle: string; backgroundAssetId: string; portraitAssetId?: string } };
const listeners = new Set<() => void>();
let queue: RewardReceipt[] = [];
const seen = new Set<string>();
type PendingLevel = { receipt: RewardReceipt; acknowledge?: () => void };
let pendingLevel: PendingLevel | null = null;
type LevelExit = PendingLevel & { continueAfter?: () => void };
let levelExit: LevelExit | null = null;
const publish = () => listeners.forEach(fn => fn());
export const rewardReceipts = {
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  current: () => queue[0] ?? null,
  reset() { queue = []; pendingLevel = null; levelExit = null; seen.clear(); publish(); },
  dismiss() {
    const completed = levelExit?.receipt.id === queue[0]?.id ? levelExit : null;
    queue = queue.slice(1);
    if (completed) { levelExit = null; completed.acknowledge?.(); }
    publish();
    completed?.continueAfter?.();
  },
  /** Profile refreshes prepare a celebration; only a results exit can open it. */
  deferLevel(receipt: RewardReceipt, acknowledge?: () => void) {
    if (!receipt.level || seen.has(receipt.id)) return;
    seen.add(receipt.id);
    if (receipt.level <= (pendingLevel?.receipt.level ?? 0)) return;
    pendingLevel = { receipt, acknowledge };
  },
  /** Hold the next scene/rematch until the celebration is dismissed. */
  leaveBattleResults(continueAfter: () => void): (() => void) | null {
    if (!pendingLevel || levelExit) return null;
    const exit: LevelExit = { ...pendingLevel, continueAfter };
    pendingLevel = null;
    levelExit = exit;
    queue = [exit.receipt, ...queue];
    publish();
    // Navigating away independently must not run an old results action later.
    return () => { exit.continueAfter = undefined; };
  },
  show(receipt: RewardReceipt) {
    if (receipt.level) { this.deferLevel(receipt); return; }
    if (!receipt.items.length || seen.has(receipt.id)) return;
    seen.add(receipt.id); queue = [...queue, receipt]; listeners.forEach(fn => fn());
  },
};
/** Only call after a successful server action, using its returned profile. */
export function revealProfileRewards(before: PlayerBootstrap, after: PlayerBootstrap, id: string, title: string) {
  const items: RewardItem[] = [];
  for (const [key, label, glyph] of [['softCurrency','Clout','cloutStack'],['packTickets','Tickets','ticket'],['styleShards','Universal Style Shards','shards'],['streetRep','Street Rep','rep'],['xp','Profile XP','xp']] as const) {
    const amount = after.profile[key] - before.profile[key];
    if (amount > 0) items.push({ label, amount, glyph });
  }
  const beforeShards = normalizeStyleShardBalances(before.profile.styleShardBalances);
  const afterShards = normalizeStyleShardBalances(after.profile.styleShardBalances);
  for (const rarity of STYLE_SHARD_RARITIES) {
    const amount = afterShards[rarity] - beforeShards[rarity];
    if (amount > 0) items.push({ label: styleShardLabel(rarity), amount, glyph: 'shards', shardRarity: rarity });
  }
  for (const cardId of after.profile.ownedCardIds.filter(id => !before.profile.ownedCardIds.includes(id))) items.push({ label: catalogCardById[cardId]?.name ?? cardId, image: getCardImage(cardId) });
  for (const cosmetic of after.profile.unlockedCosmeticIds.filter(id => !before.profile.unlockedCosmeticIds.includes(id))) items.push({ label: cosmetic.replace(/[:_-]/g,' '), glyph: 'mastery' });
  rewardReceipts.show({ id: `${after.profile.id}:${id}`, title, items, preview: after.profile.id === 'e2e-player' });
}
