export type AccountReward = {
  softCurrency: number;
  packTickets: number;
  styleShards: number;
};
export const LOGIN_REWARDS: readonly AccountReward[] = [
  50, 75, 100, 125, 150, 200, 300,
].map((softCurrency, i) => ({
  softCurrency,
  packTickets: i === 6 ? 2 : 0,
  styleShards: i === 6 ? 25 : 0,
}));
export const NEW_PLAYER_BONUS: AccountReward = {
  softCurrency: 250,
  packTickets: 3,
  styleShards: 0,
};
export const FIRST_LOGIN_BONUS: AccountReward = {
  softCurrency: 100,
  packTickets: 1,
  styleShards: 0,
};
export const LEVEL_MILESTONE_REWARD: AccountReward = {
  softCurrency: 250,
  packTickets: 1,
  styleShards: 50,
};
export type AccountRewardGrant = AccountReward & {
  key: string;
  title: string;
  streak?: number;
  date?: string;
};
export type AccountRewardStatus = {
  date: string;
  streak: number;
  claimedToday: boolean;
  nextResetAt: string;
  pending: AccountRewardGrant[];
};
export function accountRewardStatus(
  level: number,
  createdAt: Date,
  receipts: AccountRewardGrant[],
  now = new Date(),
): AccountRewardStatus {
  const date = now.toISOString().slice(0, 10);
  const yesterday = new Date(now.getTime() - 86400000)
    .toISOString()
    .slice(0, 10);
  const daily = receipts
    .filter((r) => r.key.startsWith("login:") && r.date && r.date <= date)
    .sort((a, b) => b.date!.localeCompare(a.date!));
  const latest = daily[0];
  const claimedToday = latest?.date === date;
  const streak = claimedToday
    ? (latest.streak ?? 1)
    : latest?.date === yesterday
      ? (latest.streak ?? 1) + 1
      : 1;
  const keys = new Set(receipts.map((r) => r.key));
  const pending: AccountRewardGrant[] = [];
  if (!claimedToday)
    pending.push({
      key: `login:${date}`,
      title: `Day ${streak} login reward`,
      date,
      streak,
      ...LOGIN_REWARDS[(streak - 1) % 7],
    });
  if (!keys.has("first-login"))
    pending.push({
      key: "first-login",
      title: "First check-in bonus",
      ...FIRST_LOGIN_BONUS,
    });
  if (
    !keys.has("new-player") &&
    now.getTime() - createdAt.getTime() <= 7 * 86400000
  )
    pending.push({
      key: "new-player",
      title: "Welcome to the block",
      ...NEW_PLAYER_BONUS,
    });
  for (let milestone = 10; milestone <= level; milestone += 10) {
    const key = `level:${milestone}`;
    if (!keys.has(key))
      pending.push({
        key,
        title: `Level ${milestone} milestone`,
        ...LEVEL_MILESTONE_REWARD,
      });
  }
  const nextResetAt = new Date(`${date}T00:00:00Z`);
  nextResetAt.setUTCDate(nextResetAt.getUTCDate() + 1);
  return {
    date,
    streak,
    claimedToday,
    nextResetAt: nextResetAt.toISOString(),
    pending,
  };
}
export const STOCKZ_TICKERS = [
  { id: "DURG", name: "Durag Dynamics", price: 120 },
  { id: "SNKR", name: "Sneaker Supply", price: 85 },
  { id: "BODE", name: "Bodega Brands", price: 60 },
] as const;
export const STOCKZ_STAKES = [10, 25, 50, 100] as const;
export const STOCKZ_DAILY_LIMIT = 5;
export type StockzBet = {
  id: string;
  ticker: string;
  direction: "up" | "down";
  stake: number;
  openPrice: number;
  closePrice: number;
  startedAt: string;
  closesAt: string;
  date: string;
};
export type StockzRound = Omit<StockzBet, "closePrice"> & {
  closePrice?: number;
  payout?: number;
};
export type StockzState = {
  roundsToday: number;
  active: StockzRound | null;
  recent: StockzRound[];
};
