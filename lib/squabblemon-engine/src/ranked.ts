export const RANKED_SEASON = 'fade-park-preseason-v1';
export const RANKED_BOT_WAIT_MS = 12_000;
export const RANKED_QUEUE_IDLE_MS = 30_000;
export const RANK_TIERS = [
  { name: 'Rookie', floor: 0 }, { name: 'Bronze', floor: 100 },
  { name: 'Silver', floor: 300 }, { name: 'Gold', floor: 600 },
  { name: 'Platinum', floor: 1000 }, { name: 'Diamond', floor: 1500 },
  { name: 'Park Royalty', floor: 2200 },
] as const;
export type RankedStats = {
  season: string; points: number; rating: number; wins: number; losses: number;
  draws: number; botWins: number; games: number; streak: number; bestPoints: number;
};
export type RankedResult = { before: number; after: number; delta: number; tier: string; outcome: 'win' | 'loss' | 'draw'; bot: boolean };
export function rankedStats(value: unknown): RankedStats {
  const r = value && typeof value === 'object' ? value as Partial<RankedStats> : {};
  const count = (n: unknown, fallback = 0) => typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.floor(n)) : fallback;
  return { season: RANKED_SEASON, points: count(r.points), rating: count(r.rating, 1000), wins: count(r.wins), losses: count(r.losses), draws: count(r.draws), botWins: count(r.botWins), games: count(r.games), streak: count(r.streak), bestPoints: count(r.bestPoints) };
}
export function rankProgress(points: number) {
  const index = Math.max(0, RANK_TIERS.reduce((found, tier, i) => points >= tier.floor ? i : found, 0));
  const tier = RANK_TIERS[Math.max(0, index)], next = RANK_TIERS[index + 1];
  return { tier: tier.name, floor: tier.floor, nextTier: next?.name ?? null, nextAt: next?.floor ?? null,
    progress: next ? Math.min(100, Math.max(0, (points - tier.floor) / (next.floor - tier.floor) * 100)) : 100 };
}
export function awardRank(stats: RankedStats, outcome: RankedResult['outcome'], opponentRating: number, bot: boolean) {
  const change = bot ? { win: 12, loss: -6, draw: 2 }[outcome] : { win: 25, loss: -15, draw: 5 }[outcome];
  const points = Math.max(0, stats.points + change);
  const expected = 1 / (1 + 10 ** ((opponentRating - stats.rating) / 400));
  const actual = outcome === 'win' ? 1 : outcome === 'draw' ? 0.5 : 0;
  const next = { ...stats, points, rating: Math.max(100, stats.rating + Math.round((bot ? 12 : 32) * (actual - expected))),
    wins: stats.wins + Number(outcome === 'win'), losses: stats.losses + Number(outcome === 'loss'), draws: stats.draws + Number(outcome === 'draw'),
    botWins: stats.botWins + Number(bot && outcome === 'win'), games: stats.games + 1,
    streak: outcome === 'win' ? stats.streak + 1 : 0, bestPoints: Math.max(stats.bestPoints, points) };
  const result: RankedResult = { before: stats.points, after: points, delta: points - stats.points, tier: rankProgress(points).tier, outcome, bot };
  return { stats: next, result };
}
