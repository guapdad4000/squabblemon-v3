import { rewardClips, type RewardClip } from './broadcastCatalog';
export type { RewardClip } from './broadcastCatalog';

export type RewardBroadcastTag = 'victory' | 'defeat' | 'draw' | 'reward';
const last = new Map<RewardBroadcastTag, string>();

/** Call once per match/receipt and retain that choice in its presentation owner. */
export function selectRewardClip(tag: RewardBroadcastTag): RewardClip | null {
  const compatible = rewardClips.filter(clip => clip.tags.includes(tag) && (tag !== 'reward' || clip.style === 'anime'));
  if (!compatible.length) return null;
  let previous = last.get(tag);
  try { previous ??= sessionStorage.getItem(`sq:broadcast:last:${tag}`) ?? undefined; } catch { /* Storage is optional. */ }
  const varied = compatible.filter(clip => clip.id !== previous);
  const pool = varied.length ? varied : compatible;
  // Anime is the main visual language; live footage is an infrequent decorative insert.
  const anime = pool.filter(clip => clip.style === 'anime');
  const live = pool.filter(clip => clip.style === 'live-action');
  const stylePool = live.length && (!anime.length || Math.random() < .15) ? live : anime;
  const candidates = stylePool.length ? stylePool : pool;
  const selected = candidates[Math.floor(Math.random() * candidates.length)];
  last.set(tag, selected.id);
  try { sessionStorage.setItem(`sq:broadcast:last:${tag}`, selected.id); } catch { /* Session-only rotation still works. */ }
  return selected;
}