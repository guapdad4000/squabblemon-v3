import { and, eq, sql } from "drizzle-orm";
import {
  db,
  playerCollectionClaimsTable,
  playerPackOpeningsTable,
  playerProfilesTable,
  type CollectionRoadRewardRecord,
  type PlayerPackOpeningRecord,
} from "@workspace/db";
import { catalogCardById } from "@workspace/squabblemon-engine/data";
import {
  type CollectionRoadDefinition,
  generateStreetPack,
  STREET_PACK_CONFIG,
} from "./collectionEconomy";

export class EconomyTransactionError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function openStreetPackForPlayer(
  userId: string,
  input: {
    idempotencyKey: string;
    paymentMethod: "ticket" | "softCurrency";
  },
): Promise<{
  opening: PlayerPackOpeningRecord;
  alreadyOpened: boolean;
}> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select ${playerProfilesTable.clerkUserId} from ${playerProfilesTable} where ${playerProfilesTable.clerkUserId} = ${userId} for update`,
    );
    const [existing] = await tx
      .select()
      .from(playerPackOpeningsTable)
      .where(
        and(
          eq(playerPackOpeningsTable.clerkUserId, userId),
          eq(
            playerPackOpeningsTable.idempotencyKey,
            input.idempotencyKey,
          ),
        ),
      );
    if (existing) {
      return {
        opening: existing,
        alreadyOpened: true,
      };
    }

    const [profile] = await tx
      .select()
      .from(playerProfilesTable)
      .where(eq(playerProfilesTable.clerkUserId, userId));
    if (!profile) {
      throw new EconomyTransactionError(404, "Player profile not found");
    }

    const cost =
      input.paymentMethod === "ticket"
        ? STREET_PACK_CONFIG.ticketCost
        : STREET_PACK_CONFIG.softCurrencyCost;
    if (input.paymentMethod === "ticket" && profile.packTickets < cost) {
      throw new EconomyTransactionError(
        400,
        "You need a Street Pack ticket",
      );
    }
    if (
      input.paymentMethod === "softCurrency" &&
      profile.softCurrency < cost
    ) {
      throw new EconomyTransactionError(
        400,
        `You need ${STREET_PACK_CONFIG.softCurrencyCost} Clout`,
      );
    }

    const generated = generateStreetPack({
      ownedCardIds: profile.ownedCardIds,
      discoveredCardIds: profile.discoveredCardIds,
      ownedVariants: profile.ownedVariants,
      pity: profile.packPity,
    });
    await tx
      .update(playerProfilesTable)
      .set({
        packTickets:
          input.paymentMethod === "ticket"
            ? profile.packTickets - cost
            : profile.packTickets,
        softCurrency:
          profile.softCurrency -
          (input.paymentMethod === "softCurrency" ? cost : 0) +
          generated.softCurrencyGained,
        styleShards: profile.styleShards + generated.styleShardsGained,
        packPity: generated.pityAfter,
        ownedCardIds: generated.ownedCardIds,
        discoveredCardIds: generated.discoveredCardIds,
        ownedVariants: generated.ownedVariants,
        collectionProgress: generated.ownedCardIds.length,
      })
      .where(eq(playerProfilesTable.clerkUserId, userId));

    const [opening] = await tx
      .insert(playerPackOpeningsTable)
      .values({
        clerkUserId: userId,
        idempotencyKey: input.idempotencyKey,
        oddsVersion: STREET_PACK_CONFIG.oddsVersion,
        paymentMethod: input.paymentMethod,
        cost,
        rewards: generated.rewards,
        pityBefore: profile.packPity,
        pityAfter: generated.pityAfter,
      })
      .returning();
    return { opening, alreadyOpened: false };
  });
}

export async function craftPlayerVariantForPlayer(
  userId: string,
  cardId: string,
  variantId: string,
): Promise<{ alreadyOwned: boolean }> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select ${playerProfilesTable.clerkUserId} from ${playerProfilesTable} where ${playerProfilesTable.clerkUserId} = ${userId} for update`,
    );
    const [profile] = await tx
      .select()
      .from(playerProfilesTable)
      .where(eq(playerProfilesTable.clerkUserId, userId));
    if (!profile) {
      throw new EconomyTransactionError(404, "Player profile not found");
    }
    const card = catalogCardById[cardId];
    const variant = card?.variantSlots.find(
      (slot) => slot.id === variantId,
    );
    if (!card || !variant) {
      throw new EconomyTransactionError(400, "Unknown card variant");
    }
    if (!profile.ownedCardIds.includes(card.catalogId)) {
      throw new EconomyTransactionError(
        400,
        "Unlock the gameplay card before styling it",
      );
    }
    if (profile.ownedVariants.includes(variant.id)) {
      return { alreadyOwned: true };
    }
    if (profile.styleShards < variant.shardCost) {
      throw new EconomyTransactionError(
        400,
        `You need ${variant.shardCost} Style Shards`,
      );
    }

    await tx
      .update(playerProfilesTable)
      .set({
        styleShards: profile.styleShards - variant.shardCost,
        ownedVariants: [...profile.ownedVariants, variant.id],
      })
      .where(eq(playerProfilesTable.clerkUserId, userId));
    return { alreadyOwned: false };
  });
}

export async function claimCollectionRoadForPlayer(
  userId: string,
  milestone: CollectionRoadDefinition,
): Promise<{
  reward: CollectionRoadRewardRecord;
  alreadyClaimed: boolean;
}> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select ${playerProfilesTable.clerkUserId} from ${playerProfilesTable} where ${playerProfilesTable.clerkUserId} = ${userId} for update`,
    );
    const [existing] = await tx
      .select()
      .from(playerCollectionClaimsTable)
      .where(
        and(
          eq(playerCollectionClaimsTable.clerkUserId, userId),
          eq(
            playerCollectionClaimsTable.milestoneKey,
            milestone.id,
          ),
        ),
      );
    if (existing) {
      return { reward: existing.reward, alreadyClaimed: true };
    }

    const [profile] = await tx
      .select()
      .from(playerProfilesTable)
      .where(eq(playerProfilesTable.clerkUserId, userId));
    if (!profile) {
      throw new EconomyTransactionError(404, "Player profile not found");
    }
    if (profile.ownedCardIds.length < milestone.threshold) {
      throw new EconomyTransactionError(
        400,
        `Collect ${milestone.threshold} gameplay cards first`,
      );
    }

    const reward: CollectionRoadRewardRecord = {
      ...milestone.reward,
      duplicateShards: 0,
    };
    const owned = new Set(profile.ownedCardIds);
    const discovered = new Set(profile.discoveredCardIds);
    if (milestone.reward.cardId) {
      discovered.add(milestone.reward.cardId);
      if (owned.has(milestone.reward.cardId)) {
        reward.duplicateShards = 25;
      } else {
        owned.add(milestone.reward.cardId);
      }
    }

    await tx
      .update(playerProfilesTable)
      .set({
        ownedCardIds: [...owned],
        discoveredCardIds: [...discovered],
        collectionProgress: owned.size,
        softCurrency:
          profile.softCurrency + (milestone.reward.softCurrency ?? 0),
        styleShards:
          profile.styleShards +
          (milestone.reward.styleShards ?? 0) +
          (reward.duplicateShards ?? 0),
        deckSlots:
          profile.deckSlots + (milestone.reward.deckSlots ?? 0),
      })
      .where(eq(playerProfilesTable.clerkUserId, userId));
    const [claim] = await tx
      .insert(playerCollectionClaimsTable)
      .values({
        clerkUserId: userId,
        milestoneKey: milestone.id,
        reward,
      })
      .returning();
    return { reward: claim.reward, alreadyClaimed: false };
  });
}