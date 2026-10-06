import { and, desc, eq, like } from "drizzle-orm";
import { randomInt } from "node:crypto";
import {
  db,
  playerCollectionClaimsTable,
  playerProfilesTable,
} from "@workspace/db";
import {
  applyWaffleAction,
  createWaffleRun,
  waffleRewards,
  WAFFLE_DAILY_RUNS,
  WaffleRuleError,
  type WaffleAction,
  type WaffleRun,
  type WaffleReward,
} from "@workspace/squabblemon-engine/waffleRun";
import {
  lockPlayerProfile,
  PlayerRewardError,
} from "./playerRewardTransactions";
type Reader = Pick<typeof db, "select">;
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const prefix = "waffle-run:v1:";
const dayOf = (now: Date) => now.toISOString().slice(0, 10);
async function entries(reader: Reader, userId: string) {
  return reader
    .select()
    .from(playerCollectionClaimsTable)
    .where(
      and(
        eq(playerCollectionClaimsTable.clerkUserId, userId),
        like(playerCollectionClaimsTable.milestoneKey, `${prefix}%`),
      ),
    )
    .orderBy(desc(playerCollectionClaimsTable.createdAt))
    .limit(50);
}
async function status(reader: Reader, userId: string, now: Date) {
  const records = await entries(reader, userId),
    date = dayOf(now);
  const active = records.find(
    (row) =>
      row.reward.waffleRun &&
      (row.reward.waffleRun.state as WaffleRun).phase !== "ended",
  );
  const latest = active ?? records[0];
  return {
    date,
    attemptsRemaining: Math.max(
      0,
      WAFFLE_DAILY_RUNS -
        records.filter((row) => row.reward.waffleRun?.day === date).length,
    ),
    resetsAt: new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
    ).toISOString(),
    serverNow: now.getTime(),
    run: (latest?.reward.waffleRun?.state as WaffleRun | undefined) ?? null,
    earned: latest?.reward.waffleRun?.earned ?? {
      softCurrency: 0,
      packTickets: 0,
      styleShards: 0,
    },
  };
}
export async function getWaffleRun(userId: string, now = new Date()) {
  return status(db, userId, now);
}
export async function startWaffleRun(
  userId: string,
  requestId: string,
  now = new Date(),
) {
  return db.transaction(async (tx) => {
    await lockPlayerProfile(tx, userId);
    const [profile] = await tx
      .select()
      .from(playerProfilesTable)
      .where(eq(playerProfilesTable.clerkUserId, userId));
    if (!profile) throw new PlayerRewardError("Player profile not found", 404);
    const rows = await entries(tx, userId);
    if (
      rows.some((row) => row.reward.waffleRun?.runId === requestId) ||
      rows.some(
        (row) =>
          row.reward.waffleRun &&
          (row.reward.waffleRun.state as WaffleRun).phase !== "ended",
      )
    )
      return status(tx, userId, now);
    const day = dayOf(now);
    if (
      rows.filter((row) => row.reward.waffleRun?.day === day).length >=
      WAFFLE_DAILY_RUNS
    )
      throw new PlayerRewardError(
        "Both daily diner runs are used. Come back after reset.",
        409,
      );
    const state = createWaffleRun(
      requestId,
      day,
      randomInt(0, 0xffffffff),
      now.getTime(),
    );
    await tx
      .insert(playerCollectionClaimsTable)
      .values({
        clerkUserId: userId,
        milestoneKey: `${prefix}${day}:${requestId}`,
        reward: {
          waffleRun: {
            version: 1,
            runId: requestId,
            day,
            state,
            earned: { softCurrency: 0, packTickets: 0, styleShards: 0 },
          },
        },
      });
    return status(tx, userId, now);
  });
}
export async function actWaffleRun(
  userId: string,
  runId: string,
  revision: number,
  actionId: string,
  action: WaffleAction,
  now = new Date(),
) {
  return db.transaction(async (tx) => {
    await lockPlayerProfile(tx, userId);
    const rows = await entries(tx, userId),
      row = rows.find((row) => row.reward.waffleRun?.runId === runId);
    if (!row?.reward.waffleRun)
      throw new PlayerRewardError("Run not found", 404);
    const stored = row.reward.waffleRun;
    if (stored.lastActionId === actionId) return status(tx, userId, now);
    const current = stored.state as WaffleRun;
    if (current.revision !== revision)
      throw new PlayerRewardError(
        "This run changed in another tab. Refresh to resume it.",
        409,
      );
    let next: WaffleRun;
    try {
      next = applyWaffleAction(current, action, now.getTime());
    } catch (error) {
      if (error instanceof WaffleRuleError)
        throw new PlayerRewardError(error.message, 409);
      throw error;
    }
    const earned = waffleRewards(next),
      delta: WaffleReward = {
        softCurrency: earned.softCurrency - stored.earned.softCurrency,
        packTickets: earned.packTickets - stored.earned.packTickets,
        styleShards: earned.styleShards - stored.earned.styleShards,
      };
    if (
      delta.softCurrency < 0 ||
      delta.packTickets < 0 ||
      delta.styleShards < 0
    )
      throw new PlayerRewardError("Invalid reward progression", 409);
    await bankRewards(tx, userId, delta, now);
    await tx
      .update(playerCollectionClaimsTable)
      .set({
        reward: {
          waffleRun: { ...stored, state: next, earned, lastActionId: actionId },
        },
      })
      .where(eq(playerCollectionClaimsTable.id, row.id));
    return status(tx, userId, now);
  });
}
async function bankRewards(
  tx: Tx,
  userId: string,
  delta: WaffleReward,
  now: Date,
) {
  const [profile] = await tx
    .select()
    .from(playerProfilesTable)
    .where(eq(playerProfilesTable.clerkUserId, userId));
  if (!profile) throw new PlayerRewardError("Player profile not found", 404);
  if (delta.softCurrency || delta.packTickets || delta.styleShards)
    await tx
      .update(playerProfilesTable)
      .set({
        softCurrency: profile.softCurrency + delta.softCurrency,
        packTickets: profile.packTickets + delta.packTickets,
        styleShards: profile.styleShards + delta.styleShards,
        updatedAt: now,
      })
      .where(eq(playerProfilesTable.clerkUserId, userId));
}
