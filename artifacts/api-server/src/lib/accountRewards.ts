import { and, eq, like } from "drizzle-orm";
import {
  db,
  playerCollectionClaimsTable,
  playerProfilesTable,
  playerMissionsTable,
} from "@workspace/db";
import {
  accountRewardStatus,
  growthLabStatus,
  GROWTH_GARDEN_SIZE,
  GROWTH_GARDEN_REWARD,
  type AccountRewardGrant,
} from "@workspace/squabblemon-engine/accountRewards";
import { lockPlayerProfile } from "./playerRewardTransactions";

export async function getAccountRewards(clerkUserId: string, now = new Date()) {
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
    now,
    await db.select().from(playerMissionsTable).where(eq(playerMissionsTable.clerkUserId, clerkUserId)),
  );
}

/** One watering per UTC day. The same profile lock serializes battles, claims, and garden bonuses. */
export async function waterGrowthLab(clerkUserId: string, now = new Date()): Promise<AccountRewardGrant[]> {
  return db.transaction(async tx => {
    await lockPlayerProfile(tx, clerkUserId);
    const [profile] = await tx.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, clerkUserId));
    if (!profile) throw new Error('Player profile not found');
    const rows = await tx.select().from(playerCollectionClaimsTable).where(and(eq(playerCollectionClaimsTable.clerkUserId, clerkUserId), like(playerCollectionClaimsTable.milestoneKey, 'account:%')));
    const receipts = rows.flatMap(row => row.reward.accountReward ? [row.reward.accountReward] : []);
    const missions = await tx.select().from(playerMissionsTable).where(eq(playerMissionsTable.clerkUserId, clerkUserId));
    const growth = growthLabStatus(receipts, missions, now);
    if (!growth.ready) return [];
    const date = now.toISOString().slice(0, 10);
    const rewards: AccountRewardGrant[] = [{ key: `growth:water:${date}`, title: 'A new plant for your garden', date, softCurrency: 0, packTickets: 0, styleShards: 0 }];
    const totalPlants = growth.totalPlants + 1;
    if (totalPlants % GROWTH_GARDEN_SIZE === 0) rewards.push({ key: `growth:garden:${totalPlants / GROWTH_GARDEN_SIZE}`, title: `Buddy’s garden ${totalPlants / GROWTH_GARDEN_SIZE} complete`, date, ...GROWTH_GARDEN_REWARD });
    for (const reward of rewards) await tx.insert(playerCollectionClaimsTable).values({ clerkUserId, milestoneKey: `account:${reward.key}`, reward: { accountReward: reward } });
    const bonus = rewards.find(reward => reward.key.startsWith('growth:garden:'));
    if (bonus) await tx.update(playerProfilesTable).set({ softCurrency: profile.softCurrency + bonus.softCurrency, packTickets: profile.packTickets + bonus.packTickets, styleShards: profile.styleShards + bonus.styleShards, updatedAt: now }).where(eq(playerProfilesTable.clerkUserId, clerkUserId));
    return rewards;
  });
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
