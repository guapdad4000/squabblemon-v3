import { getAuth } from "@clerk/express";
import { and, eq, sql } from "drizzle-orm";
import { Router, type IRouter, type Request, type Response } from "express";
import {
  ClaimCollectionRoadMilestoneParams,
  ClaimCollectionRoadMilestoneResponse,
  CraftPlayerVariantBody,
  CraftPlayerVariantResponse,
  EquipPlayerVariantBody,
  EquipPlayerVariantResponse,
  DeletePlayerDeckParams,
  DeletePlayerDeckResponse,
  OpenPlayerPackBody,
  OpenPlayerPackResponse,
  SavePlayerDeckBody,
  SavePlayerDeckParams,
  SavePlayerDeckResponse,
} from "@workspace/api-zod";
import {
  db,
  playerCollectionClaimsTable,
  playerPackOpeningsTable,
  playerProfilesTable,
  type CollectionRoadRewardRecord,
  type PlayerPackOpeningRecord,
  type SavedDeck,
} from "@workspace/db";
import {
  catalogCardById, DECK_SIZE,
  validateSavedDeck,
} from "@workspace/squabblemon-engine/data";
import { COLLECTION_ROAD } from "../lib/collectionEconomy";
import {
  claimCollectionRoadForPlayer,
  craftPlayerVariantForPlayer,
  EconomyTransactionError,
  openStreetPackForPlayer,
} from "../lib/collectionTransactions";
import {
  getPlayerBootstrap,
  serializePackOpening,
} from "../lib/playerState";
import { validateVariantEquip } from "../lib/variantEquip";

const router: IRouter = Router();

class RouteError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function authenticatedUserId(req: Request, res: Response): string | null {
  const auth = getAuth(req);
  if (!auth.userId) {
    res.status(401).json({ error: "Authentication required" });
    return null;
  }
  return auth.userId;
}

function sendError(res: Response, error: unknown) {
  if (
    error instanceof RouteError ||
    error instanceof EconomyTransactionError
  ) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  throw error;
}

function serializeRoadReward(reward: CollectionRoadRewardRecord) {
  return {
    cardId: reward.cardId ?? null,
    softCurrency: reward.softCurrency ?? 0,
    styleShards: reward.styleShards ?? 0,
    deckSlots: reward.deckSlots ?? 0,
    duplicateShards: reward.duplicateShards ?? 0,
  };
}

router.put(
  "/player/decks/:deckId",
  async (req, res): Promise<void> => {
    const userId = authenticatedUserId(req, res);
    if (!userId) return;
    const params = SavePlayerDeckParams.safeParse(req.params);
    const body = SavePlayerDeckBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({
        error: !params.success
          ? params.error.message
          : !body.success
            ? body.error.message
            : "Invalid deck",
      });
      return;
    }

    try {
      await getPlayerBootstrap(userId);
      await db.transaction(async (tx) => {
        await tx.execute(
          sql`select ${playerProfilesTable.clerkUserId} from ${playerProfilesTable} where ${playerProfilesTable.clerkUserId} = ${userId} for update`,
        );
        const [profile] = await tx
          .select()
          .from(playerProfilesTable)
          .where(eq(playerProfilesTable.clerkUserId, userId));
        if (!profile) throw new RouteError(404, "Player profile not found");

        const unknown = body.data.cardIds.filter(
          (id) => !catalogCardById[id],
        );
        if (
          unknown.length ||
          (body.data.heroCardId &&
            !catalogCardById[body.data.heroCardId])
        ) {
          throw new RouteError(
            400,
            "Deck contains a card outside the catalog",
          );
        }
        if (new Set(body.data.cardIds).size !== body.data.cardIds.length) {
          throw new RouteError(
            400,
            "A deck can only use one gameplay copy of each card",
          );
        }

        const existingIndex = profile.savedDecks.findIndex(
          (deck) => deck.id === params.data.deckId,
        );
        if (
          existingIndex === -1 &&
          profile.savedDecks.length >= profile.deckSlots
        ) {
          throw new RouteError(
            400,
            `All ${profile.deckSlots} deck slots are full`,
          );
        }
        const nextDeck: SavedDeck = {
          id: params.data.deckId,
          name: body.data.name.trim(),
          cardIds: body.data.cardIds,
          heroCardId: body.data.heroCardId,
          deckSize: DECK_SIZE,
          recipeId: body.data.recipeId,
        };
        const savedDecks = [...profile.savedDecks];
        if (existingIndex === -1) savedDecks.push(nextDeck);
        else savedDecks[existingIndex] = nextDeck;

        await tx
          .update(playerProfilesTable)
          .set({ savedDecks })
          .where(eq(playerProfilesTable.clerkUserId, userId));
      });

      res.json(
        SavePlayerDeckResponse.parse(await getPlayerBootstrap(userId)),
      );
    } catch (error) {
      sendError(res, error);
    }
  },
);

router.delete(
  "/player/decks/:deckId",
  async (req, res): Promise<void> => {
    const userId = authenticatedUserId(req, res);
    if (!userId) return;
    const params = DeletePlayerDeckParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    try {
      await getPlayerBootstrap(userId);
      await db.transaction(async (tx) => {
        await tx.execute(
          sql`select ${playerProfilesTable.clerkUserId} from ${playerProfilesTable} where ${playerProfilesTable.clerkUserId} = ${userId} for update`,
        );
        const [profile] = await tx
          .select()
          .from(playerProfilesTable)
          .where(eq(playerProfilesTable.clerkUserId, userId));
        if (!profile) throw new RouteError(404, "Player profile not found");
        const deleting = profile.savedDecks.find(
          (deck) => deck.id === params.data.deckId,
        );
        if (!deleting) return;
        const deletingIsLegal = validateSavedDeck(
          deleting.cardIds,
          profile.ownedCardIds,
          deleting.heroCardId,
        ).valid;
        const otherLegalDecks = profile.savedDecks.filter(
          (deck) =>
            deck.id !== deleting.id &&
            validateSavedDeck(
              deck.cardIds,
              profile.ownedCardIds,
              deck.heroCardId,
            ).valid,
        );
        if (deletingIsLegal && otherLegalDecks.length === 0) {
          throw new RouteError(
            400,
            "Keep at least one legal gang before deleting this deck",
          );
        }

        await tx
          .update(playerProfilesTable)
          .set({
            savedDecks: profile.savedDecks.filter(
              (deck) => deck.id !== deleting.id,
            ),
          })
          .where(eq(playerProfilesTable.clerkUserId, userId));
      });
      res.json(
        DeletePlayerDeckResponse.parse(await getPlayerBootstrap(userId)),
      );
    } catch (error) {
      sendError(res, error);
    }
  },
);

router.post("/player/packs/open", async (req, res): Promise<void> => {
  const userId = authenticatedUserId(req, res);
  if (!userId) return;
  const body = OpenPlayerPackBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  try {
    await getPlayerBootstrap(userId);
    const result = await openStreetPackForPlayer(userId, body.data);

    res.json(
      OpenPlayerPackResponse.parse({
        bootstrap: await getPlayerBootstrap(userId),
        opening: serializePackOpening(
          result.opening as PlayerPackOpeningRecord,
        ),
        alreadyOpened: result.alreadyOpened,
      }),
    );
  } catch (error) {
    sendError(res, error);
  }
});

router.post("/player/collection/craft", async (req, res): Promise<void> => {
  const userId = authenticatedUserId(req, res);
  if (!userId) return;
  const body = CraftPlayerVariantBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  try {
    await getPlayerBootstrap(userId);
    const result = await craftPlayerVariantForPlayer(
      userId,
      body.data.cardId,
      body.data.variantId,
    );
    res.json(
      CraftPlayerVariantResponse.parse({
        bootstrap: await getPlayerBootstrap(userId),
        alreadyOwned: result.alreadyOwned,
      }),
    );
  } catch (error) {
    sendError(res, error);
  }
});

router.put("/player/collection/equip", async (req, res): Promise<void> => {
  const userId = authenticatedUserId(req, res);
  if (!userId) return;
  const body = EquipPlayerVariantBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  try {
    await getPlayerBootstrap(userId);
    await db.transaction(async (tx) => {
      await tx.execute(
        sql`select ${playerProfilesTable.clerkUserId} from ${playerProfilesTable} where ${playerProfilesTable.clerkUserId} = ${userId} for update`,
      );
      const [profile] = await tx
        .select()
        .from(playerProfilesTable)
        .where(eq(playerProfilesTable.clerkUserId, userId));
      if (!profile) throw new RouteError(404, "Player profile not found");

      const validationError = validateVariantEquip(
        body.data.cardId,
        body.data.variantId,
        profile.ownedCardIds,
        profile.ownedVariants,
      );
      if (validationError) throw new RouteError(400, validationError);
      const card = catalogCardById[body.data.cardId];

      const equippedVariants = { ...profile.equippedVariants };
      if (body.data.variantId === null) {
        delete equippedVariants[card.catalogId];
      } else {
        equippedVariants[card.catalogId] = body.data.variantId;
      }

      await tx
        .update(playerProfilesTable)
        .set({ equippedVariants })
        .where(eq(playerProfilesTable.clerkUserId, userId));
    });
    res.json(
      EquipPlayerVariantResponse.parse(await getPlayerBootstrap(userId)),
    );
  } catch (error) {
    sendError(res, error);
  }
});

router.post(
  "/player/collection-road/:milestoneId/claim",
  async (req, res): Promise<void> => {
    const userId = authenticatedUserId(req, res);
    if (!userId) return;
    const params = ClaimCollectionRoadMilestoneParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const milestone = COLLECTION_ROAD.find(
      (item) => item.id === params.data.milestoneId,
    );
    if (!milestone) {
      res.status(404).json({ error: "Collection milestone not found" });
      return;
    }

    try {
      await getPlayerBootstrap(userId);
      const result = await claimCollectionRoadForPlayer(
        userId,
        milestone,
      );

      res.json(
        ClaimCollectionRoadMilestoneResponse.parse({
          bootstrap: await getPlayerBootstrap(userId),
          reward: serializeRoadReward(result.reward),
          alreadyClaimed: result.alreadyClaimed,
        }),
      );
    } catch (error) {
      sendError(res, error);
    }
  },
);

export default router;