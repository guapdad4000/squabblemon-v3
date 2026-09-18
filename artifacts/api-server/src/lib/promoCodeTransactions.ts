import { and, eq, sql } from 'drizzle-orm';
import { db, playerCollectionClaimsTable, playerProfilesTable } from '@workspace/db';
import { normalizeCardProgress } from '@workspace/squabblemon-engine/cardProgression';
import { catalogCardById } from '@workspace/squabblemon-engine/data';
import { EconomyTransactionError } from './collectionTransactions';
import { findPromoCode } from './promoCodes';

export async function redeemPromoCode(userId: string, input: string) {
  const reward = findPromoCode(input);
  if (!reward) throw new EconomyTransactionError(400, 'This promo code is not available. Check the code and try again.');
  const cardIds = reward.cardIds ?? [];
  if (cardIds.some(cardId => catalogCardById[cardId]?.kind !== 'character')) {
    throw new EconomyTransactionError(500, 'Promo code reward is misconfigured.');
  }

  return db.transaction(async tx => {
    // Share the wallet lock with pack openings, shop purchases and other rewards.
    await tx.execute(sql`select ${playerProfilesTable.clerkUserId} from ${playerProfilesTable} where ${playerProfilesTable.clerkUserId} = ${userId} for update`);
    const key = `promo:${reward.code}`;
    const [existing] = await tx.select().from(playerCollectionClaimsTable).where(and(
      eq(playerCollectionClaimsTable.clerkUserId, userId),
      eq(playerCollectionClaimsTable.milestoneKey, key),
    ));
    if (existing) {
      if (!existing.reward.promoCode) throw new EconomyTransactionError(409, 'This promo code was already claimed.');
      return { receipt: existing.reward.promoCode, alreadyRedeemed: true };
    }
    const [profile] = await tx.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, userId));
    if (!profile) throw new EconomyTransactionError(404, 'Player profile not found.');
    if (profile.onboardingStep !== 'complete') throw new EconomyTransactionError(409, 'Finish Rookie Road before redeeming a promo code.');

    const owned = new Set(profile.ownedCardIds);
    const discovered = new Set(profile.discoveredCardIds);
    const cardProgression = { ...profile.cardProgression };
    for (const cardId of cardIds) {
      owned.add(cardId);
      discovered.add(cardId);
      cardProgression[cardId] = normalizeCardProgress(cardProgression[cardId]);
    }
    await tx.update(playerProfilesTable).set({
      packTickets: profile.packTickets + reward.packTickets,
      softCurrency: profile.softCurrency + reward.softCurrency,
      styleShards: profile.styleShards + reward.styleShards,
      ownedCardIds: [...owned],
      discoveredCardIds: [...discovered],
      collectionProgress: owned.size,
      cardProgression,
    }).where(eq(playerProfilesTable.clerkUserId, userId));
    await tx.insert(playerCollectionClaimsTable).values({
      clerkUserId: userId, milestoneKey: key, reward: { promoCode: reward },
    });
    return { receipt: reward, alreadyRedeemed: false };
  });
}
