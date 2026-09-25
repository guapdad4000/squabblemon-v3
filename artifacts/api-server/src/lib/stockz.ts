import { randomInt } from "node:crypto";
import { and, eq, like } from "drizzle-orm";
import {
  db,
  playerCollectionClaimsTable as claims,
  playerProfilesTable as profiles,
} from "@workspace/db";
import {
  STOCKZ_DAILY_LIMIT,
  STOCKZ_STAKES,
  STOCKZ_TICKERS,
  type StockzBet,
  type StockzState,
} from "@workspace/squabblemon-engine/accountRewards";
import { lockPlayerProfile } from "./playerRewardTransactions";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
async function receipts(tx: Tx | typeof db, userId: string) {
  return tx
    .select()
    .from(claims)
    .where(
      and(
        eq(claims.clerkUserId, userId),
        like(claims.milestoneKey, "stockz:%"),
      ),
    );
}
export async function getStockzState(
  userId: string,
  now = new Date(),
): Promise<StockzState> {
  const rows = await receipts(db, userId);
  const settlements = new Map(
    rows.flatMap((row) =>
      row.reward.stockzSettlement
        ? [
            [
              row.reward.stockzSettlement.betId,
              row.reward.stockzSettlement.payout,
            ] as const,
          ]
        : [],
    ),
  );
  const bets = rows
    .flatMap((row) => (row.reward.stockzBet ? [row.reward.stockzBet] : []))
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const open = bets.find((bet) => !settlements.has(bet.id));
  const active = open
    ? (({ closePrice: _, ...visible }) => visible)(open)
    : null;
  return {
    roundsToday: bets.filter(
      (bet) => bet.date === now.toISOString().slice(0, 10),
    ).length,
    active,
    recent: bets
      .filter((bet) => settlements.has(bet.id))
      .slice(0, 5)
      .map((bet) => ({ ...bet, payout: settlements.get(bet.id)! })),
  };
}
export async function startStockz(
  userId: string,
  input: {
    id: string;
    ticker: string;
    direction: "up" | "down";
    stake: number;
  },
  now = new Date(),
) {
  const ticker = STOCKZ_TICKERS.find((t) => t.id === input.ticker);
  if (
    !ticker ||
    !STOCKZ_STAKES.some((value) => value === input.stake) ||
    !["up", "down"].includes(input.direction) ||
    !/^[a-z0-9-]{20,50}$/i.test(input.id)
  )
    throw new Error("Choose a stock, a direction, and an available stake.");
  await db.transaction(async (tx) => {
    await lockPlayerProfile(tx, userId);
    const [profile] = await tx
      .select()
      .from(profiles)
      .where(eq(profiles.clerkUserId, userId));
    if (!profile) throw new Error("Player profile not found");
    const rows = await receipts(tx, userId);
    const existing = rows.find((row) => row.reward.stockzBet?.id === input.id)
      ?.reward.stockzBet;
    if (existing) {
      if (
        existing.ticker !== input.ticker ||
        existing.direction !== input.direction ||
        existing.stake !== input.stake
      )
        throw new Error("This trade was already saved with different choices.");
      return;
    }
    const settled = new Set(
      rows.flatMap((row) =>
        row.reward.stockzSettlement ? [row.reward.stockzSettlement.betId] : [],
      ),
    );
    const bets = rows.flatMap((row) =>
      row.reward.stockzBet ? [row.reward.stockzBet] : [],
    );
    if (bets.some((bet) => !settled.has(bet.id)))
      throw new Error("Settle your open trade first.");
    const date = now.toISOString().slice(0, 10);
    if (bets.filter((bet) => bet.date === date).length >= STOCKZ_DAILY_LIMIT)
      throw new Error(
        "The market is closed for you today. Come back after 00:00 UTC.",
      );
    if (profile.softCurrency < input.stake)
      throw new Error("You need more Clout for that stake.");
    const bet: StockzBet = {
      ...input,
      openPrice: ticker.price,
      closePrice: ticker.price + (randomInt(2) ? 1 : -1) * randomInt(1, 16),
      date,
      startedAt: now.toISOString(),
      closesAt: new Date(now.getTime() + 8000).toISOString(),
    };
    await tx
      .insert(claims)
      .values({
        clerkUserId: userId,
        milestoneKey: `stockz:bet:${input.id}`,
        reward: { stockzBet: bet },
      });
    await tx
      .update(profiles)
      .set({ softCurrency: profile.softCurrency - input.stake, updatedAt: now })
      .where(eq(profiles.clerkUserId, userId));
  });
  return getStockzState(userId, now);
}
export async function settleStockz(
  userId: string,
  id: string,
  now = new Date(),
) {
  await db.transaction(async (tx) => {
    await lockPlayerProfile(tx, userId);
    const [profile] = await tx
      .select()
      .from(profiles)
      .where(eq(profiles.clerkUserId, userId));
    if (!profile) throw new Error("Player profile not found");
    const rows = await receipts(tx, userId);
    const bet = rows.find((row) => row.reward.stockzBet?.id === id)?.reward
      .stockzBet;
    if (!bet) throw new Error("Trade not found.");
    if (rows.some((row) => row.reward.stockzSettlement?.betId === id)) return;
    if (new Date(bet.closesAt).getTime() > now.getTime())
      throw new Error("The closing bell has not rung yet.");
    const won =
      bet.direction === "up"
        ? bet.closePrice > bet.openPrice
        : bet.closePrice < bet.openPrice;
    const payout = won ? bet.stake * 2 : 0;
    await tx
      .insert(claims)
      .values({
        clerkUserId: userId,
        milestoneKey: `stockz:settle:${id}`,
        reward: { stockzSettlement: { betId: id, payout } },
      });
    await tx
      .update(profiles)
      .set({ softCurrency: profile.softCurrency + payout, updatedAt: now })
      .where(eq(profiles.clerkUserId, userId));
  });
  return getStockzState(userId, now);
}
