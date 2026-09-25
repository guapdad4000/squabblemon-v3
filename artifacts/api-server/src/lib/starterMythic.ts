import { and, eq } from 'drizzle-orm';
import { db, playerCollectionClaimsTable, playerProfilesTable, playerStoryNodesTable } from '@workspace/db';
import { STARTER_MYTHIC, starterMythicStatus } from '@workspace/squabblemon-engine/starterMythic';
import { buildStoryCampaign } from './storyService';
import { lockPlayerProfile, PlayerRewardError } from './playerRewardTransactions';

type Reader = Pick<typeof db, 'select'>;
async function readStatus(reader: Reader, userId: string) {
  const [profile] = await reader.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, userId));
  if (!profile) throw new PlayerRewardError('Player profile not found', 404);
  const [receipt] = await reader.select().from(playerCollectionClaimsTable).where(and(eq(playerCollectionClaimsTable.clerkUserId, userId), eq(playerCollectionClaimsTable.milestoneKey, STARTER_MYTHIC.key)));
  const rows = await reader.select().from(playerStoryNodesTable).where(eq(playerStoryNodesTable.clerkUserId, userId));
  return { profile, status: starterMythicStatus(buildStoryCampaign(rows).chapters, Boolean(receipt), profile.ownedCardIds.includes(STARTER_MYTHIC.cardId)) };
}
export async function getStarterMythic(userId: string) { return (await readStatus(db, userId)).status; }

/** Profile lock and permanent unique receipt make retries and concurrent claims safe. */
export async function claimStarterMythic(userId: string) {
  return db.transaction(async tx => {
    await lockPlayerProfile(tx, userId);
    const { profile, status } = await readStatus(tx, userId);
    if (status.state === 'claimed') return { claimed: false, duplicateShards: 0 };
    if (status.state !== 'ready') throw new PlayerRewardError('Reach Season 1, Chapter 5 to claim your Mythical.', 409);
    const duplicateShards = status.ownsCard ? STARTER_MYTHIC.duplicateShards : 0;
    const ownedCardIds = [...new Set([...profile.ownedCardIds, STARTER_MYTHIC.cardId])];
    await tx.insert(playerCollectionClaimsTable).values({ clerkUserId: userId, milestoneKey: STARTER_MYTHIC.key,
      reward: { starterMythic: { cardId: STARTER_MYTHIC.cardId, softCurrency: STARTER_MYTHIC.softCurrency, packTickets: STARTER_MYTHIC.packTickets, duplicateShards } } });
    await tx.update(playerProfilesTable).set({
      ownedCardIds,
      discoveredCardIds: [...new Set([...profile.discoveredCardIds, STARTER_MYTHIC.cardId])],
      collectionProgress: ownedCardIds.length,
      softCurrency: profile.softCurrency + STARTER_MYTHIC.softCurrency,
      packTickets: profile.packTickets + STARTER_MYTHIC.packTickets,
      styleShards: profile.styleShards + duplicateShards,
      updatedAt: new Date(),
    }).where(eq(playerProfilesTable.clerkUserId, userId));
    return { claimed: true, duplicateShards };
  });
}
