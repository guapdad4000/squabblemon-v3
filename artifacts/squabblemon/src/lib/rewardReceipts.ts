import type { PlayerBootstrap } from '@workspace/api-client-react';
import type { GameGlyphName } from '../components/venue/GameGlyph';
import { catalogCardById, getCardImage } from '../data';
export type RewardItem = { label: string; amount?: number; glyph?: GameGlyphName; image?: string };
export type RewardReceipt = { id: string; title: string; items: RewardItem[]; preview?: boolean };
const listeners = new Set<() => void>();
let queue: RewardReceipt[] = [];
const seen = new Set<string>();
export const rewardReceipts = {
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  current: () => queue[0] ?? null,
  reset() { queue = []; seen.clear(); listeners.forEach(fn => fn()); },
  dismiss() { queue = queue.slice(1); listeners.forEach(fn => fn()); },
  show(receipt: RewardReceipt) {
    if (!receipt.items.length || seen.has(receipt.id)) return;
    seen.add(receipt.id); queue = [...queue, receipt]; listeners.forEach(fn => fn());
  },
};
/** Only call after a successful server action, using its returned profile. */
export function revealProfileRewards(before: PlayerBootstrap, after: PlayerBootstrap, id: string, title: string) {
  const items: RewardItem[] = [];
  for (const [key, label, glyph] of [['softCurrency','Clout','cloutStack'],['packTickets','Tickets','ticket'],['styleShards','Style Shards','shards'],['streetRep','Street Rep','rep'],['xp','Profile XP','xp']] as const) {
    const amount = after.profile[key] - before.profile[key];
    if (amount > 0) items.push({ label, amount, glyph });
  }
  for (const cardId of after.profile.ownedCardIds.filter(id => !before.profile.ownedCardIds.includes(id))) items.push({ label: catalogCardById[cardId]?.name ?? cardId, image: getCardImage(cardId) });
  for (const cosmetic of after.profile.unlockedCosmeticIds.filter(id => !before.profile.unlockedCosmeticIds.includes(id))) items.push({ label: cosmetic.replace(/[:_-]/g,' '), glyph: 'mastery' });
  rewardReceipts.show({ id: `${after.profile.id}:${id}`, title, items, preview: after.profile.id === 'e2e-player' });
}
