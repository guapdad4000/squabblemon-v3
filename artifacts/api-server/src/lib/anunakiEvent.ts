import { eq } from 'drizzle-orm';
import { db, playerCollectionClaimsTable, playerProfilesTable, playerStoryNodesTable } from '@workspace/db';
import { catalogCardById } from '@workspace/squabblemon-engine/data';
import { getStoryBattle } from '@workspace/squabblemon-engine/story';
import { ANUNAKI_EVENT_GAMEPLAY_READY, ANUNAKI_EVENT_MILESTONES, anunakiClaimKey, anunakiEventStatus, type AnunakiMilestoneId } from '@workspace/squabblemon-engine/anunakiEvent';
import { buildStoryCampaign } from './storyService';
import { lockPlayerProfile, PlayerRewardError } from './playerRewardTransactions';

type Reader = Pick<typeof db, 'select'>;
async function readStatus(reader: Reader, userId: string) {
  const [profile] = await reader.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, userId));
  if (!profile) throw new PlayerRewardError('Player profile not found', 404);
  const claims = await reader.select({ milestoneKey: playerCollectionClaimsTable.milestoneKey }).from(playerCollectionClaimsTable).where(eq(playerCollectionClaimsTable.clerkUserId, userId));
  const rows = await reader.select().from(playerStoryNodesTable).where(eq(playerStoryNodesTable.clerkUserId, userId));
  const battleIds = rows.filter(row => row.cleared && getStoryBattle(row.nodeId)).map(row => row.nodeId);
  // Use the same completion calculation as Story: every required node must be cleared.
  const completedChapterIds = buildStoryCampaign(rows).chapters.filter(chapter => chapter.status === 'cleared').map(chapter => chapter.id);
  const available = ANUNAKI_EVENT_GAMEPLAY_READY && ANUNAKI_EVENT_MILESTONES.every(m => m.reward.kind !== 'card' || !!catalogCardById[m.reward.id]);
  return { profile, status: anunakiEventStatus(battleIds, completedChapterIds, claims.map(claim => claim.milestoneKey), profile.ownedCardIds, profile.unlockedCosmeticIds, available, rows.filter(row => row.cleared).map(row => ({ nodeId: row.nodeId, stars: row.stars }))) };
}
export async function getAnunakiEvent(userId: string) { return (await readStatus(db, userId)).status; }

/** Profile lock and unique permanent receipt serialize retries and competing grants. */
export async function claimAnunakiEvent(userId: string, id: string) {
  const milestone = ANUNAKI_EVENT_MILESTONES.find(m => m.id === id);
  if (!milestone) throw new PlayerRewardError('Unknown Anunaki reward.', 400);
  return db.transaction(async tx => {
    await lockPlayerProfile(tx, userId);
    const { profile, status } = await readStatus(tx, userId);
    const step = status.milestones.find(m => m.id === milestone.id)!;
    if (step.state === 'claimed') return { claimed: false, duplicateShards: 0 };
    if (!status.available) throw new PlayerRewardError('The Anunaki event is still being prepared.', 409);
    if (step.state !== 'ready') throw new PlayerRewardError(step.requirement, 409);
    const reward = milestone.reward;
    const duplicateShards = step.ownsReward ? 25 : 0;
    const cardId = reward.kind === 'card' ? reward.id : undefined;
    const cosmeticId = reward.kind === 'player-mat' || reward.kind === 'sticker-pack' || reward.kind === 'deck-cover' ? reward.id : undefined;
    const softCurrency = reward.kind === 'currency' ? reward.amount ?? 0 : 0;
    const packTickets = reward.kind === 'tickets' ? reward.amount ?? 0 : 0;
    const ownedCardIds = cardId ? [...new Set([...profile.ownedCardIds, cardId])] : profile.ownedCardIds;
    await tx.insert(playerCollectionClaimsTable).values({ clerkUserId: userId, milestoneKey: anunakiClaimKey(milestone.id as AnunakiMilestoneId), reward: { cardId, softCurrency, duplicateShards, anunaki: { kind: reward.kind, id: reward.id, label: reward.label, cosmeticId, packTickets } } });
    await tx.update(playerProfilesTable).set({
      ownedCardIds,
      discoveredCardIds: cardId ? [...new Set([...profile.discoveredCardIds, cardId])] : profile.discoveredCardIds,
      unlockedCosmeticIds: cosmeticId ? [...new Set([...profile.unlockedCosmeticIds, cosmeticId])] : profile.unlockedCosmeticIds,
      ...(cardId ? { collectionProgress: ownedCardIds.length } : {}),
      styleShards: profile.styleShards + duplicateShards,
      softCurrency: profile.softCurrency + softCurrency,
      packTickets: profile.packTickets + packTickets,
      updatedAt: new Date(),
    }).where(eq(playerProfilesTable.clerkUserId, userId));
    return { claimed: true, duplicateShards, receiptLabel: reward.label };
  });
}
