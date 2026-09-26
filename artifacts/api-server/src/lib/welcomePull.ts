import { and, eq } from 'drizzle-orm';
import { db, playerPackOpeningsTable, playerProfilesTable, type PackRewardRecord } from '@workspace/db';
import { catalogCardById } from '@workspace/squabblemon-engine/data';
import { STREET_PACK_RULES } from '@workspace/squabblemon-engine/packRules';
import { lockPlayerProfile } from './playerRewardTransactions';
import { EconomyTransactionError } from './collectionTransactions';

export const WELCOME_PULL_KEY = 'dr-fade-welcome-v1';
export async function welcomePullAvailable(userId: string) {
  const [opening] = await db.select({ id: playerPackOpeningsTable.id }).from(playerPackOpeningsTable)
    .where(eq(playerPackOpeningsTable.clerkUserId, userId)).limit(1);
  return !opening;
}
/** A separate, fixed receipt makes the free ticket single-use across retries and devices. */
export async function openWelcomePull(userId: string) {
  return db.transaction(async tx => {
    await lockPlayerProfile(tx, userId);
    const [existing] = await tx.select().from(playerPackOpeningsTable).where(and(
      eq(playerPackOpeningsTable.clerkUserId, userId), eq(playerPackOpeningsTable.idempotencyKey, WELCOME_PULL_KEY)));
    if (existing) return { opening: existing, alreadyOpened: true };
    const [previous] = await tx.select({ id: playerPackOpeningsTable.id }).from(playerPackOpeningsTable)
      .where(eq(playerPackOpeningsTable.clerkUserId, userId)).limit(1);
    if (previous) throw new EconomyTransactionError(409, 'The welcome ticket is only available before your first opening.');
    const [profile] = await tx.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, userId));
    if (!profile) throw new EconomyTransactionError(404, 'Player profile not found');
    const card = catalogCardById['dr-fade'];
    const duplicate = profile.ownedCardIds.includes(card.catalogId);
    const shards = duplicate ? STREET_PACK_RULES.duplicateStyleShards : 0;
    const reward: PackRewardRecord = { kind: duplicate ? 'styleShards' : 'card', cardId: card.catalogId,
      variantId: null, name: card.name, rarity: card.rarity, isNew: !duplicate, amount: duplicate ? shards : 1 };
    const ownedCardIds = [...new Set([...profile.ownedCardIds, card.catalogId])];
    await tx.update(playerProfilesTable).set({ ownedCardIds,
      discoveredCardIds: [...new Set([...profile.discoveredCardIds, card.catalogId])],
      collectionProgress: ownedCardIds.length, styleShards: profile.styleShards + shards,
    }).where(eq(playerProfilesTable.clerkUserId, userId));
    const [opening] = await tx.insert(playerPackOpeningsTable).values({ clerkUserId: userId,
      idempotencyKey: WELCOME_PULL_KEY, oddsVersion: WELCOME_PULL_KEY, paymentMethod: 'ticket', cost: 0,
      rewards: [reward], pityBefore: profile.packPity, pityAfter: profile.packPity }).returning();
    return { opening, alreadyOpened: false };
  });
}
