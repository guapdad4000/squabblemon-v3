import { and, eq, like } from 'drizzle-orm';
import { db, playerCollectionClaimsTable, playerProfilesTable } from '@workspace/db';
import { KUMITE_CARD_REWARDS, catalogCardById } from '@workspace/squabblemon-engine/data';
import { OnlineError } from '@workspace/squabblemon-engine/multiplayer';
import { reconcileKumiteRewards } from './kumiteRewards';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const presentationKey = (receiptId: string) => `kumite:film:${receiptId}`;
const filmCards = new Set(['bushedo-brown', 'franklin-duke', 'chonk-lee', 'dragonfly-jones', 'p-tang', 'undercova-brotha', 'sho-nuff', 'leroy']);

async function pending(tx: Tx, userId: string, owned: readonly string[]) {
  const rows = await tx.select().from(playerCollectionClaimsTable).where(and(
    eq(playerCollectionClaimsTable.clerkUserId, userId), like(playerCollectionClaimsTable.milestoneKey, 'kumite:%')));
  const consumed = new Set(rows.filter(row => row.reward.kumitePresentation).map(row => row.reward.kumitePresentation!.receiptId));
  return rows.filter(row => {
    const milestone = KUMITE_CARD_REWARDS.find(item => item.id === row.milestoneKey);
    return milestone && filmCards.has(milestone.cardId) && row.reward.cardId === milestone.cardId
      && row.reward.kumiteUnlock?.newlyOwned === true && owned.includes(milestone.cardId) && !consumed.has(row.milestoneKey);
  }).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.milestoneKey.localeCompare(b.milestoneKey))
    .map(row => ({ id: row.milestoneKey, cardId: row.reward.cardId!, name: catalogCardById[row.reward.cardId!].name }));
}

export async function pendingKumiteFilms(userId: string) {
  return db.transaction(async tx => {
    await reconcileKumiteRewards(tx, userId, Date.now());
    const [profile] = await tx.select({ owned: playerProfilesTable.ownedCardIds }).from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, userId));
    return { receipts: profile ? await pending(tx, userId, profile.owned) : [] };
  });
}

/** Consume before playback. Retries, two tabs and reloads cannot replay an auto-unlock.
 * This endpoint cannot grant or revoke ownership; manual Collection replay remains. */
export async function claimKumiteFilm(userId: string, receiptId: string) {
  if (!KUMITE_CARD_REWARDS.some(item => item.id === receiptId)) throw new OnlineError('Unknown fighter receipt.', 400);
  return db.transaction(async tx => {
    const [profile] = await tx.select({ owned: playerProfilesTable.ownedCardIds }).from(playerProfilesTable)
      .where(eq(playerProfilesTable.clerkUserId, userId)).for('update');
    if (!profile) throw new OnlineError('Player not found.', 404);
    const receipt = (await pending(tx, userId, profile.owned)).find(item => item.id === receiptId);
    if (!receipt) return { receipt: null };
    const inserted = await tx.insert(playerCollectionClaimsTable).values({ clerkUserId: userId,
      milestoneKey: presentationKey(receiptId), reward: { kumitePresentation: { receiptId } },
    }).onConflictDoNothing().returning({ id: playerCollectionClaimsTable.id });
    return { receipt: inserted.length ? receipt : null };
  });
}
