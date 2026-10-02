import { STYLE_SHARD_RARITIES, normalizeStyleShardBalances, styleShardLabel, type StyleShardRarity } from '@workspace/squabblemon-engine/styleShards';
import type { PlayerBootstrap, StoryGrantedReward } from '@workspace/api-client-react';
import type { GameGlyphName } from '../components/venue/GameGlyph';
import { catalogCardById, catalogCardByEngineId, getCardImage } from '../data';
import { getAssetUrl } from './assets';
export type RewardItem = { label: string; amount?: number; glyph?: GameGlyphName; shardRarity?: StyleShardRarity; image?: string };
export type RewardPresentationContext = 'mission' | 'collection' | 'recruit' | 'promo' | 'shop' | 'story';
export type RewardReceipt = { id: string; title: string; items: RewardItem[]; preview?: boolean; level?: number; achievement?: boolean; presentation?: RewardPresentationContext; story?: { chapterTitle: string; backgroundAssetId: string; portraitAssetId?: string; catchUp?: boolean; cloutBalance?: { from: number; to: number } } };
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
export function canPresentRewardStinger(receipt: RewardReceipt, reducedMotion = false): boolean {
  return Boolean(receipt.presentation && !receipt.level && !receipt.preview && !reducedMotion
    && !receipt.story?.catchUp && !receipt.story?.cloutBalance);
}
/** Only call after a successful server action, using its returned profile. */
export function revealProfileRewards(before: PlayerBootstrap, after: PlayerBootstrap, id: string, title: string, presentation?: Exclude<RewardPresentationContext, 'story'>) {
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
  rewardReceipts.show({ id: `${after.profile.id}:${id}`, title, items, preview: after.profile.id === 'e2e-player', presentation });
}

/** A completion response contains only newly issued grants. Its returned wallet,
 * less those grants, is the only trustworthy starting point for collection. */
export function revealStoryRewards({
  nodeId, title, story, rewards, bootstrap, resolveCharacter, presentation,
}: {
  nodeId: string;
  title: string;
  story?: NonNullable<RewardReceipt['story']>;
  rewards: StoryGrantedReward[];
  bootstrap: PlayerBootstrap;
  resolveCharacter: (id: string) => { name: string; portraitAssetId: string } | undefined;
  presentation?: 'story';
}): boolean {
  if (!rewards.length) return false;
  const clout = rewards.filter(reward => reward.kind === 'currency' && reward.id === 'clout')
    .reduce((total, reward) => total + reward.amount, 0);
  const catchUp = rewards.some(reward => reward.rewardKey.startsWith('story-payout-make-good:v1:'));
  const items: RewardItem[] = rewards.map(reward => {
    if (reward.kind === 'card') {
      const card = catalogCardById[reward.id] ?? catalogCardByEngineId[reward.id];
      return reward.duplicateShards
        ? { label: `${card?.name ?? reward.id} duplicate · Style Shards`, amount: reward.duplicateShards, glyph: 'shards' }
        : { label: `${card?.name ?? reward.id} card`, image: getCardImage(card?.catalogId ?? reward.id) };
    }
    if (reward.kind === 'character-unlock') {
      const character = resolveCharacter(reward.id);
      return { label: `${character?.name ?? reward.id} unlocked`, image: character ? getAssetUrl(character.portraitAssetId) : undefined, glyph: 'story' };
    }
    if (reward.kind === 'pack-ticket') return { label: 'Street Pack Tickets', amount: reward.amount, glyph: 'ticket' };
    if (reward.kind === 'currency') return reward.id === 'clout'
      ? { label: 'Clout', amount: reward.amount, glyph: 'clout' }
      : { label: 'Account XP', amount: reward.amount, glyph: 'xp' };
    return { label: reward.kind === 'chapter-key' ? 'Next chapter unlocked' : reward.id.replace(/[:_-]/g, ' '), glyph: reward.kind === 'chapter-key' ? 'story' : 'mastery' };
  });
  rewardReceipts.show({
    id: `story:${bootstrap.profile.id}:${nodeId}:${rewards.map(reward => reward.rewardKey).join('|')}`,
    title,
    items,
    presentation: presentation && !catchUp && clout === 0 ? presentation : undefined,
    story: {
      ...story,
      chapterTitle: story?.chapterTitle ?? 'Story',
      backgroundAssetId: story?.backgroundAssetId ?? 'assets/results/win-scene-wide.webp',
      catchUp,
      cloutBalance: clout > 0 ? {
        from: bootstrap.profile.softCurrency - clout,
        to: bootstrap.profile.softCurrency,
      } : undefined,
    },
  });
  return true;
}
