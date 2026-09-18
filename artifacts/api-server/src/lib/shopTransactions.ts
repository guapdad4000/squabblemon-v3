import { and, eq, sql } from 'drizzle-orm';
import { db, playerCollectionClaimsTable, playerProfilesTable } from '@workspace/db';
import { planShopPurchase, type ShopRequest } from '@workspace/squabblemon-engine/economy';
import { EconomyTransactionError } from './collectionTransactions';

export async function purchaseShopItem(userId: string, input: ShopRequest) {
  return db.transaction(async tx => {
    await tx.execute(sql`select ${playerProfilesTable.clerkUserId} from ${playerProfilesTable} where ${playerProfilesTable.clerkUserId} = ${userId} for update`);
    const key = `shop:${input.idempotencyKey}`;
    const [existing] = await tx.select().from(playerCollectionClaimsTable).where(and(eq(playerCollectionClaimsTable.clerkUserId, userId), eq(playerCollectionClaimsTable.milestoneKey, key)));
    if (existing) {
      const receipt = existing.reward.shopPurchase;
      if (!receipt || receipt.itemId !== input.itemId || receipt.cardId !== (input.cardId ?? null)) throw new EconomyTransactionError(409, 'This request was already used for a different purchase.');
      return { receipt, alreadyPurchased: true };
    }
    const [profile] = await tx.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, userId));
    if (!profile) throw new EconomyTransactionError(404, 'Player profile not found.');
    if (profile.onboardingStep !== 'complete') throw new EconomyTransactionError(409, 'Finish Rookie Road before shopping.');
    const { wallet, receipt } = planShopPurchase(profile, input);
    // Explicit wallet fields only. Never write a stale copy of unrelated profile data.
    await tx.update(playerProfilesTable).set({
      softCurrency: wallet.softCurrency, packTickets: wallet.packTickets, styleShards: wallet.styleShards,
      deckSlots: wallet.deckSlots, ownedCardIds: wallet.ownedCardIds, discoveredCardIds: wallet.discoveredCardIds,
      ownedVariants: wallet.ownedVariants, cardProgression: wallet.cardProgression, collectionProgress: wallet.collectionProgress,
    }).where(eq(playerProfilesTable.clerkUserId, userId));
    await tx.insert(playerCollectionClaimsTable).values({ clerkUserId: userId, milestoneKey: key, reward: { shopPurchase: receipt } });
    return { receipt, alreadyPurchased: false };
  });
}
