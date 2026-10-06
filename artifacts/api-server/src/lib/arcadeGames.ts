import { and, eq, like, desc } from "drizzle-orm";
import { randomInt } from "node:crypto";
import {
  db,
  playerCollectionClaimsTable,
  playerProfilesTable,
} from "@workspace/db";
import {
  ARCADE_RULES,
  arcadePeriod,
  arcadeReset,
  createArcadeRun,
  applyArcadeAction,
  arcadeRewards,
  ArcadeRuleError,
  type ArcadeKind,
  type ArcadeRun,
  type ArcadeAction,
} from "@workspace/squabblemon-engine/arcadeGames";
import {
  lockPlayerProfile,
  PlayerRewardError,
} from "./playerRewardTransactions";
type Reader = Pick<typeof db, "select">;
const prefix = (kind: ArcadeKind) => `arcade:v1:${kind}:`;
async function entries(reader: Reader, userId: string, kind: ArcadeKind) {
  return reader
    .select()
    .from(playerCollectionClaimsTable)
    .where(
      and(
        eq(playerCollectionClaimsTable.clerkUserId, userId),
        like(playerCollectionClaimsTable.milestoneKey, `${prefix(kind)}%`),
      ),
    )
    .orderBy(desc(playerCollectionClaimsTable.createdAt))
    .limit(60);
}
async function status(
  reader: Reader,
  userId: string,
  kind: ArcadeKind,
  now: Date,
) {
  const rows = await entries(reader, userId, kind),
    period = arcadePeriod(kind, now);
  const active = rows.find(
      (r) => (r.reward.arcadeRun?.state as ArcadeRun)?.phase === "active",
    ),
    latest = active ?? rows[0];
  return {
    kind,
    period,
    attemptsRemaining: Math.max(
      0,
      ARCADE_RULES[kind].limit -
        rows.filter((r) => r.reward.arcadeRun?.period === period).length,
    ),
    resetsAt: arcadeReset(kind, now),
    serverNow: now.getTime(),
    run: (latest?.reward.arcadeRun?.state as ArcadeRun) ?? null,
    earned: latest?.reward.arcadeRun?.earned ?? {
      softCurrency: 0,
      packTickets: 0,
      styleShards: 0,
    },
  };
}
export async function getArcadeGame(
  userId: string,
  kind: ArcadeKind,
  now = new Date(),
) {
  return status(db, userId, kind, now);
}
export async function startArcadeGame(
  userId: string,
  kind: ArcadeKind,
  requestId: string,
  choice: number,
  now = new Date(),
) {
  return db.transaction(async (tx) => {
    await lockPlayerProfile(tx, userId);
    const [profile] = await tx
      .select()
      .from(playerProfilesTable)
      .where(eq(playerProfilesTable.clerkUserId, userId));
    if (!profile) throw new PlayerRewardError("Player profile not found", 404);
    const rows = await entries(tx, userId, kind);
    if (
      rows.some(
        (r) =>
          r.reward.arcadeRun?.runId === requestId ||
          (r.reward.arcadeRun?.state as ArcadeRun)?.phase === "active",
      )
    )
      return status(tx, userId, kind, now);
    const period = arcadePeriod(kind, now);
    if (
      rows.filter((r) => r.reward.arcadeRun?.period === period).length >=
      ARCADE_RULES[kind].limit
    )
      throw new PlayerRewardError(
        "Rewarded entries are used. Come back after reset.",
        409,
      );
    if (!Number.isInteger(choice) || choice < 0 || choice > 2)
      throw new PlayerRewardError("Choose a valid fighter or crew.", 400);
    const seed =
        kind === "block-takeover"
          ? [...period].reduce(
              (n, c) => (Math.imul(n, 31) + c.charCodeAt(0)) >>> 0,
              7,
            )
          : randomInt(0, 0xffffffff),
      state = createArcadeRun(
        kind,
        requestId,
        period,
        seed,
        now.getTime(),
        choice,
      );
    await tx
      .insert(playerCollectionClaimsTable)
      .values({
        clerkUserId: userId,
        milestoneKey: `${prefix(kind)}${period}:${requestId}`,
        reward: {
          arcadeRun: {
            version: 1,
            runId: requestId,
            kind,
            period,
            state,
            earned: { softCurrency: 0, packTickets: 0, styleShards: 0 },
          },
        },
      });
    return status(tx, userId, kind, now);
  });
}
export async function actArcadeGame(
  userId: string,
  kind: ArcadeKind,
  runId: string,
  revision: number,
  actionId: string,
  action: ArcadeAction,
  now = new Date(),
) {
  return db.transaction(async (tx) => {
    await lockPlayerProfile(tx, userId);
    const row = (await entries(tx, userId, kind)).find(
      (r) => r.reward.arcadeRun?.runId === runId,
    );
    if (!row?.reward.arcadeRun)
      throw new PlayerRewardError("Run not found", 404);
    const stored = row.reward.arcadeRun;
    if (stored.lastActionId === actionId) return status(tx, userId, kind, now);
    const current = stored.state as ArcadeRun;
    if (current.kind !== kind || current.revision !== revision)
      throw new PlayerRewardError(
        "This run changed. Sync to resume your latest turn.",
        409,
      );
    let next: ArcadeRun;
    try {
      next = applyArcadeAction(current, action, now.getTime());
    } catch (error) {
      if (error instanceof ArcadeRuleError)
        throw new PlayerRewardError(error.message, 409);
      throw error;
    }
    const earned = arcadeRewards(next),
      delta = {
        softCurrency: earned.softCurrency - stored.earned.softCurrency,
        packTickets: earned.packTickets - stored.earned.packTickets,
        styleShards: earned.styleShards - stored.earned.styleShards,
      };
    if (Object.values(delta).some((v) => v < 0))
      throw new PlayerRewardError("Invalid reward progression", 409);
    const [profile] = await tx
      .select()
      .from(playerProfilesTable)
      .where(eq(playerProfilesTable.clerkUserId, userId));
    if (!profile) throw new PlayerRewardError("Player profile not found", 404);
    if (Object.values(delta).some((v) => v > 0))
      await tx
        .update(playerProfilesTable)
        .set({
          softCurrency: profile.softCurrency + delta.softCurrency,
          packTickets: profile.packTickets + delta.packTickets,
          styleShards: profile.styleShards + delta.styleShards,
          updatedAt: now,
        })
        .where(eq(playerProfilesTable.clerkUserId, userId));
    await tx
      .update(playerCollectionClaimsTable)
      .set({
        reward: {
          arcadeRun: { ...stored, state: next, earned, lastActionId: actionId },
        },
      })
      .where(eq(playerCollectionClaimsTable.id, row.id));
    return status(tx, userId, kind, now);
  });
}
