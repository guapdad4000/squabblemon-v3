import { and, eq } from "drizzle-orm";
import {
  db,
  playerCollectionClaimsTable,
  playerProfilesTable,
  playerStoryNodesTable,
} from "@workspace/db";
import {
  JOHN_HENRY_MYTHIC,
  johnHenryMythicStatus,
} from "@workspace/squabblemon-engine/johnHenryMythic";
import { buildStoryCampaign } from "./storyService";
import {
  lockPlayerProfile,
  PlayerRewardError,
} from "./playerRewardTransactions";
type Reader = Pick<typeof db, "select">;
async function readStatus(reader: Reader, userId: string) {
  const [profile] = await reader
    .select()
    .from(playerProfilesTable)
    .where(eq(playerProfilesTable.clerkUserId, userId));
  if (!profile) throw new PlayerRewardError("Player profile not found", 404);
  const [receipt] = await reader
    .select()
    .from(playerCollectionClaimsTable)
    .where(
      and(
        eq(playerCollectionClaimsTable.clerkUserId, userId),
        eq(playerCollectionClaimsTable.milestoneKey, JOHN_HENRY_MYTHIC.key),
      ),
    );
  const rows = await reader
    .select()
    .from(playerStoryNodesTable)
    .where(eq(playerStoryNodesTable.clerkUserId, userId));
  return {
    profile,
    status: johnHenryMythicStatus(
      buildStoryCampaign(rows).chapters,
      Boolean(receipt),
      profile.ownedCardIds.includes(JOHN_HENRY_MYTHIC.cardId),
    ),
  };
}
export async function getJohnHenryMythic(userId: string) {
  return (await readStatus(db, userId)).status;
}
export async function claimJohnHenryMythic(userId: string) {
  return db.transaction(async (tx) => {
    await lockPlayerProfile(tx, userId);
    const { profile, status } = await readStatus(tx, userId);
    if (status.state === "claimed")
      return { claimed: false, duplicateShards: 0 };
    if (status.state !== "ready")
      throw new PlayerRewardError(
        "Complete all eight Season 1 chapters to claim John Henry.",
        409,
      );
    const reward = JOHN_HENRY_MYTHIC,
      duplicateShards = status.ownsCard ? reward.duplicateShards : 0;
    const ownedCardIds = [...new Set([...profile.ownedCardIds, reward.cardId])];
    await tx
      .insert(playerCollectionClaimsTable)
      .values({
        clerkUserId: userId,
        milestoneKey: reward.key,
        reward: {
          starterMythic: {
            cardId: reward.cardId,
            softCurrency: reward.softCurrency,
            packTickets: reward.packTickets,
            duplicateShards,
          },
        },
      });
    await tx
      .update(playerProfilesTable)
      .set({
        ownedCardIds,
        discoveredCardIds: [
          ...new Set([...profile.discoveredCardIds, reward.cardId]),
        ],
        collectionProgress: ownedCardIds.length,
        softCurrency: profile.softCurrency + reward.softCurrency,
        packTickets: profile.packTickets + reward.packTickets,
        styleShards: profile.styleShards + duplicateShards,
        updatedAt: new Date(),
      })
      .where(eq(playerProfilesTable.clerkUserId, userId));
    return { claimed: true, duplicateShards };
  });
}
