import { and, eq, sql } from 'drizzle-orm';
import { db, playerProfilesTable, playerCollectionClaimsTable, challengeRunsTable } from '@workspace/db';
import { lockPlayerProfile, PlayerRewardError } from './playerRewardTransactions';
export const dailyCloutKey = (now = new Date()) => `shop:daily-clout:${now.toISOString().slice(0, 10)}`;
export async function getDailyClout(userId: string, now = new Date()) {
  const date = now.toISOString().slice(0, 10);
  const [receipt] = await db.select().from(playerCollectionClaimsTable).where(and(eq(playerCollectionClaimsTable.clerkUserId, userId), eq(playerCollectionClaimsTable.milestoneKey, dailyCloutKey(now))));
  const [runs] = await db.select({ count: sql<number>`count(*)` }).from(challengeRunsTable).where(and(eq(challengeRunsTable.clerkUserId, userId), eq(challengeRunsTable.entryDate, date)));
  return { date, available: !receipt, amount: 50, attemptsRemaining: Math.max(0, 2 - Number(runs.count)), resetsAt: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).toISOString() };
}
export async function claimDailyClout(userId: string, now = new Date()) {
  return db.transaction(async tx => {
    await lockPlayerProfile(tx, userId);
    const [profile] = await tx.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, userId));
    if (!profile) throw new PlayerRewardError('Player profile not found', 404);
    const key = dailyCloutKey(now);
    const [receipt] = await tx.select().from(playerCollectionClaimsTable).where(and(eq(playerCollectionClaimsTable.clerkUserId, userId), eq(playerCollectionClaimsTable.milestoneKey, key)));
    if (receipt) return { claimed: false, amount: 0 };
    await tx.insert(playerCollectionClaimsTable).values({ clerkUserId: userId, milestoneKey: key, reward: { softCurrency: 50 } });
    await tx.update(playerProfilesTable).set({ softCurrency: profile.softCurrency + 50, updatedAt: new Date() }).where(eq(playerProfilesTable.clerkUserId, userId));
    return { claimed: true, amount: 50 };
  });
}
