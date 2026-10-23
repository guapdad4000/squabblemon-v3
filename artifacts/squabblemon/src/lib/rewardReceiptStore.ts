import type { StyleShardRarity } from '@workspace/squabblemon-engine/styleShards';
import type { GameGlyphName } from '../components/venue/GameGlyph';

export type RewardItem = { label: string; amount?: number; glyph?: GameGlyphName; shardRarity?: StyleShardRarity; image?: string };
export type RewardPresentationContext = 'mission' | 'collection' | 'recruit' | 'promo' | 'shop' | 'story';
export type RewardReceipt = { id: string; title: string; items: RewardItem[]; preview?: boolean; level?: number; achievement?: boolean; characterId?: 'homeless-guy' | 'john-henry' | 'buddy'; kumiteFilmKey?: string; presentation?: RewardPresentationContext; story?: { chapterTitle: string; backgroundAssetId: string; portraitAssetId?: string; catchUp?: boolean; cloutBalance?: { from: number; to: number } } };
const listeners = new Set<() => void>();
let queue: RewardReceipt[] = [];
const seen = new Set<string>();
const stingersStarted = new Set<string>();
const stingersConsumed = new Set<string>();
const stingerSelections = new Map<string, unknown>();
type PendingLevel = { receipt: RewardReceipt; acknowledge?: () => void };
let pendingLevel: PendingLevel | null = null;
type LevelExit = PendingLevel & { continueAfter?: () => void };
let levelExit: LevelExit | null = null;
const publish = () => listeners.forEach(fn => fn());
export const rewardReceipts = {
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  current: () => queue[0] ?? null,
  reset() { queue = []; pendingLevel = null; levelExit = null; seen.clear(); stingersStarted.clear(); stingersConsumed.clear(); stingerSelections.clear(); publish(); },
  dismiss(receiptId?: string) {
    if (receiptId && queue[0]?.id !== receiptId) return;
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
  /** Resolve a selected cut once per receipt; retaining it here makes remounts stable. */
  stingerSelection<T>(receiptId: string, select: () => T): T | undefined {
    if (stingersConsumed.has(receiptId)) return undefined;
    if (!stingerSelections.has(receiptId)) stingerSelections.set(receiptId, select());
    return stingerSelections.get(receiptId) as T | undefined;
  },
  /** Claim the single play for a mounted presenter; later remounts reveal the receipt. */
  beginStinger(receiptId: string) {
    if (queue[0]?.id !== receiptId || stingersStarted.has(receiptId) || stingersConsumed.has(receiptId)) return false;
    stingersStarted.add(receiptId);
    return true;
  },
  stingerWasStarted(receiptId: string) { return stingersStarted.has(receiptId); },
  /** A late callback from an unmounted receipt must not consume a newer receipt. */
  consumeStinger(receiptId: string) {
    const current = queue[0];
    if (!current || current.id !== receiptId || stingersConsumed.has(receiptId)) return;
    stingersConsumed.add(receiptId);
    queue = [{ ...current }, ...queue.slice(1)];
    publish();
  },
  stingerWasConsumed(receiptId: string) { return stingersConsumed.has(receiptId); },
};
