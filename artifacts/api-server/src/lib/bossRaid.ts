import { and, eq, like, desc, sql } from "drizzle-orm";
import {
  db,
  playerCollectionClaimsTable,
  playerProfilesTable,
} from "@workspace/db";
import { validateSavedDeck } from "@workspace/squabblemon-engine/data";
import {
  createBossCampaign,
  settleBossCampaign,
  type BossCampaign,
  bossDay,
  bossReset,
  createBossRaid,
  applyBossAction,
  bossRewards,
  BossRuleError,
  type BossRaid,
  type BossAction,
  type BossStatus,
} from "@workspace/squabblemon-engine/bossRaid";
import {
  lockPlayerProfile,
  PlayerRewardError,
} from "./playerRewardTransactions";
type Reader = Pick<typeof db, "select">;
const prefix = "boss-raid:v2:";
const campaignKey = "boss-campaign:v2";
async function readCampaign(
  reader: Reader,
  userId: string,
): Promise<BossCampaign> {
  const [row] = await reader
    .select()
    .from(playerCollectionClaimsTable)
    .where(
      and(
        eq(playerCollectionClaimsTable.clerkUserId, userId),
        eq(playerCollectionClaimsTable.milestoneKey, campaignKey),
      ),
    );
  return (
    (row?.reward.bossCampaign?.state as BossCampaign) ?? createBossCampaign()
  );
}
async function saveCampaign(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  userId: string,
  state: BossCampaign,
) {
  await tx
    .insert(playerCollectionClaimsTable)
    .values({
      clerkUserId: userId,
      milestoneKey: campaignKey,
      reward: { bossCampaign: { version: 2, state } },
    })
    .onConflictDoUpdate({
      target: [
        playerCollectionClaimsTable.clerkUserId,
        playerCollectionClaimsTable.milestoneKey,
      ],
      set: { reward: { bossCampaign: { version: 2, state } } },
    });
}
async function entries(reader: Reader, userId: string) {
  return reader
    .select()
    .from(playerCollectionClaimsTable)
    .where(
      and(
        eq(playerCollectionClaimsTable.clerkUserId, userId),
        like(playerCollectionClaimsTable.milestoneKey, prefix + "%"),
      ),
    )
    .orderBy(desc(playerCollectionClaimsTable.createdAt))
    .limit(32);
}
async function status(
  reader: Reader,
  userId: string,
  now: Date,
): Promise<BossStatus> {
  const rows = await entries(reader, userId),
    day = bossDay(now),
    today = rows.find((r) => r.reward.bossRaid?.day === day),
    active = rows.find(
      (r) => (r.reward.bossRaid?.state as BossRaid)?.phase === "active",
    ),
    latest = active ?? today ?? rows[0];
  const [best] = await reader
    .select({
      score: sql<number>`coalesce(max((${playerCollectionClaimsTable.reward}->'bossRaid'->'state'->>'score')::integer),0)`,
    })
    .from(playerCollectionClaimsTable)
    .where(
      and(
        eq(playerCollectionClaimsTable.clerkUserId, userId),
        like(playerCollectionClaimsTable.milestoneKey, prefix + "%"),
      ),
    );
  const campaign = await readCampaign(reader, userId);
  return {
    day,
    resetsAt: bossReset(now),
    serverNow: now.getTime(),
    attemptsRemaining: today || campaign.completed ? 0 : 1,
    run: (latest?.reward.bossRaid?.state as BossRaid) ?? null,
    earned: latest?.reward.bossRaid?.earned ?? {
      softCurrency: 0,
      packTickets: 0,
      styleShards: 0,
    },
    bestScore: Number(best?.score ?? 0),
    campaign,
    history: rows.map((r) => {
      const run = r.reward.bossRaid!.state as BossRaid;
      return { day: run.day, score: run.score, defeated: run.hp === 0 };
    }),
  };
}
export const getBossRaid = (userId: string, now = new Date()) =>
  status(db, userId, now);
export async function startBossRaid(
  userId: string,
  requestId: string,
  cardIds: string[],
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
      rows.some(
        (r) =>
          r.reward.bossRaid?.runId === requestId ||
          (r.reward.bossRaid?.state as BossRaid)?.phase === "active",
      )
    )
      return status(tx, userId, now);
    const day = bossDay(now);
    if (rows.some((r) => r.reward.bossRaid?.day === day))
      throw new PlayerRewardError(
        "Your daily raid entry is used. The precinct resets at midnight UTC.",
        409,
      );
    if (!validateSavedDeck(cardIds, profile.ownedCardIds, cardIds[0]).valid)
      throw new PlayerRewardError(
        "Bring ten unique, owned, playable cards.",
        400,
      );
    const deck = profile.savedDecks.find(
      (d) =>
        d.cardIds.length === cardIds.length &&
        d.cardIds.every((id) => cardIds.includes(id)),
    );
    const campaign = await readCampaign(tx, userId);
    if (campaign.completed)
      throw new PlayerRewardError("All five precinct tiers defeated.", 409);
    const run = createBossRaid(
      requestId,
      day,
      cardIds,
      deck?.name ?? "Your crew",
      { tier: campaign.tier, hp: campaign.hp },
    );
    await saveCampaign(tx, userId, {
      ...campaign,
      attacks: campaign.attacks + 1,
      tierAttacks: campaign.tierAttacks + 1,
    });
    await tx.insert(playerCollectionClaimsTable).values({
      clerkUserId: userId,
      milestoneKey: prefix + day,
      reward: {
        bossRaid: {
          version: 1,
          runId: requestId,
          day,
          state: run,
          earned: bossRewards(run),
        },
      },
    });
    return status(tx, userId, now);
  });
}
export async function actBossRaid(
  userId: string,
  runId: string,
  revision: number,
  actionId: string,
  action: BossAction,
  now = new Date(),
) {
  return db.transaction(async (tx) => {
    await lockPlayerProfile(tx, userId);
    const row = (await entries(tx, userId)).find(
      (r) => r.reward.bossRaid?.runId === runId,
    );
    if (!row?.reward.bossRaid)
      throw new PlayerRewardError("Raid not found", 404);
    const stored = row.reward.bossRaid;
    if (stored.lastActionId === actionId) return status(tx, userId, now);
    const current = stored.state as BossRaid;
    if (current.revision !== revision)
      throw new PlayerRewardError(
        "Your raid changed. Sync to resume the saved turn.",
        409,
      );
    let next: BossRaid;
    try {
      next = applyBossAction(current, action);
    } catch (e) {
      if (e instanceof BossRuleError)
        throw new PlayerRewardError(e.message, 409);
      throw e;
    }
    const settled = settleBossCampaign(
      await readCampaign(tx, userId),
      current,
      next,
    );
    const earned = bossRewards(next),
      delta = {
        softCurrency:
          earned.softCurrency -
          stored.earned.softCurrency +
          settled.reward.softCurrency,
        packTickets:
          earned.packTickets -
          stored.earned.packTickets +
          settled.reward.packTickets,
        styleShards:
          earned.styleShards -
          stored.earned.styleShards +
          settled.reward.styleShards,
      };
    if (Object.values(delta).some((n) => n < 0))
      throw new PlayerRewardError("Invalid reward progression", 409);
    const [profile] = await tx
      .select()
      .from(playerProfilesTable)
      .where(eq(playerProfilesTable.clerkUserId, userId));
    if (!profile) throw new PlayerRewardError("Player profile not found", 404);
    if (Object.values(delta).some((n) => n > 0))
      await tx
        .update(playerProfilesTable)
        .set({
          softCurrency: profile.softCurrency + delta.softCurrency,
          packTickets: profile.packTickets + delta.packTickets,
          styleShards: profile.styleShards + delta.styleShards,
          updatedAt: now,
        })
        .where(eq(playerProfilesTable.clerkUserId, userId));
    await saveCampaign(tx, userId, {
      ...settled.campaign,
      earned: {
        softCurrency: settled.campaign.earned.softCurrency + delta.softCurrency,
        packTickets: settled.campaign.earned.packTickets + delta.packTickets,
        styleShards: settled.campaign.earned.styleShards + delta.styleShards,
      },
    });
    await tx
      .update(playerCollectionClaimsTable)
      .set({
        reward: {
          ...row.reward,
          bossRaid: { ...stored, state: next, earned, lastActionId: actionId },
        },
      })
      .where(eq(playerCollectionClaimsTable.id, row.id));
    return status(tx, userId, now);
  });
}
