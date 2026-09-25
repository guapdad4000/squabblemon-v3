import { and, eq, like } from "drizzle-orm";
import {
  db,
  playerCollectionClaimsTable,
  playerProfilesTable,
} from "@workspace/db";
import {
  accountRewardStatus,
  type AccountRewardGrant,
} from "@workspace/squabblemon-engine/accountRewards";
import { lockPlayerProfile } from "./playerRewardTransactions";

export async function getAccountRewards(clerkUserId: string) {
  const [profile] = await db
    .select()
    .from(playerProfilesTable)
    .where(eq(playerProfilesTable.clerkUserId, clerkUserId));
  if (!profile) throw new Error("Player profile not found");
  const receipts = await db
    .select()
    .from(playerCollectionClaimsTable)
    .where(
      and(
        eq(playerCollectionClaimsTable.clerkUserId, clerkUserId),
        like(playerCollectionClaimsTable.milestoneKey, "account:%"),
      ),
    );
  return accountRewardStatus(
    profile.level,
    profile.createdAt,
    receipts.flatMap((r) =>
      r.reward.accountReward ? [r.reward.accountReward] : [],
    ),
  );
}

export async function claimAccountRewards(
  clerkUserId: string,
  now = new Date(),
): Promise<AccountRewardGrant[]> {
  return db.transaction(async (tx) => {
    await lockPlayerProfile(tx, clerkUserId);
    const [profile] = await tx
      .select()
      .from(playerProfilesTable)
      .where(eq(playerProfilesTable.clerkUserId, clerkUserId));
    if (!profile) throw new Error("Player profile not found");
    const receipts = await tx
      .select()
      .from(playerCollectionClaimsTable)
      .where(
        and(
          eq(playerCollectionClaimsTable.clerkUserId, clerkUserId),
          like(playerCollectionClaimsTable.milestoneKey, "account:%"),
        ),
      );
    const { pending } = accountRewardStatus(
      profile.level,
      profile.createdAt,
      receipts.flatMap((r) =>
        r.reward.accountReward ? [r.reward.accountReward] : [],
      ),
      now,
    );
    if (!pending.length) return [];
    for (const reward of pending)
      await tx
        .insert(playerCollectionClaimsTable)
        .values({
          clerkUserId,
          milestoneKey: `account:${reward.key}`,
          reward: { accountReward: reward },
        });
    const total = pending.reduce(
      (sum, reward) => ({
        softCurrency: sum.softCurrency + reward.softCurrency,
        packTickets: sum.packTickets + reward.packTickets,
        styleShards: sum.styleShards + reward.styleShards,
      }),
      { softCurrency: 0, packTickets: 0, styleShards: 0 },
    );
    await tx
      .update(playerProfilesTable)
      .set({
        softCurrency: profile.softCurrency + total.softCurrency,
        packTickets: profile.packTickets + total.packTickets,
        styleShards: profile.styleShards + total.styleShards,
        updatedAt: now,
      })
      .where(eq(playerProfilesTable.clerkUserId, clerkUserId));
    return pending;
  });
}
