import { Router, type IRouter, type Request, type Response } from "express";
import { getAuth } from "@clerk/express";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, challengeRunsTable, playerProfilesTable, playerMatchesTable } from "@workspace/db";
import { replayMatchPrefix, createStoryMatch, type TranscriptMove } from "@workspace/squabblemon-engine/gameEngine";
import { encounterFor, abandonChallenge, type ChallengeRun } from "@workspace/squabblemon-engine/challenge";
import { catalogIdsToEngineIds, starterRecipes } from "@workspace/squabblemon-engine/data";
import { randomInt } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { createCardProgressionSnapshot, normalizeCatalogCardId } from "../lib/cardProgression";

const router: IRouter = Router();
const user = (req: Request, res: Response) => {
  const id = getAuth(req).userId;
  if (!id) { res.status(401).json({ error: "Authentication required" }); return null; }
  return id;
};
const response = (row: typeof challengeRunsTable.$inferSelect) => ({
  id: row.id, status: row.status, seed: row.seed, encounterIndex: row.encounterIndex,
  score: row.score, wins: row.wins, entryDate: row.entryDate, entryNumber: row.entryNumber,
  crew: row.crewSnapshot, encounter: row.encounterSnapshot,
  checkpoints: row.checkpoints, createdAt: row.createdAt.toISOString(),
  completedAt: row.completedAt?.toISOString() ?? null,
  recovery: (() => {
    const encounter = row.encounterSnapshot as { playerMatchId?: string };
    const checkpoint = (row.checkpoints as Array<Record<string, unknown>>).find(item => item.matchId === encounter.playerMatchId);
    return encounter.playerMatchId ? { state: checkpoint ? "checkpointed" : "in_progress", matchId: encounter.playerMatchId, checkpoint: checkpoint ?? null } : null;
  })(),
});
const fromRow = (row: typeof challengeRunsTable.$inferSelect): ChallengeRun => ({
  id: row.id, playerId: row.clerkUserId, status: row.status as ChallengeRun["status"], seed: row.seed,
  entryDate: row.entryDate, entryNumber: row.entryNumber as 1 | 2, encounterIndex: row.encounterIndex, wins: row.wins,
  crew: row.crewSnapshot as unknown as ChallengeRun["crew"],
  encounter: row.encounterSnapshot as unknown as ChallengeRun["encounter"],
  transcripts: row.transcripts as unknown as ChallengeRun["transcripts"], personalBest: false,
});

router.post("/player/challenges/runs", async (req, res) => {
  const clerkUserId = user(req, res); if (!clerkUserId) return;
  try {
    const result = await db.transaction(async (tx) => {
      const [profile] = await tx.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, clerkUserId)).for("update");
      if (!profile) throw new Error("Player profile not found");
      const [existing] = await tx.select().from(challengeRunsTable).where(and(eq(challengeRunsTable.clerkUserId, clerkUserId), eq(challengeRunsTable.status, "active"))).limit(1);
      if (existing) return existing;
      const today = new Date().toISOString().slice(0, 10);
      const [count] = await tx.select({ count: sql<number>`count(*)` }).from(challengeRunsTable).where(and(eq(challengeRunsTable.clerkUserId, clerkUserId), eq(challengeRunsTable.entryDate, today)));
      if (Number(count.count) >= 2) throw new Error("Two challenge entries are already used today");
      const seed = randomInt(1, 0x7fffffff);
      const requestedDeck = typeof req.body?.deckId === "string" ? req.body.deckId : profile.starterDeckId;
      const saved = profile.savedDecks.find((deck) => deck.id === requestedDeck);
      if (requestedDeck && requestedDeck !== profile.starterDeckId && !saved) throw new Error("Saved crew not found");
      const recipe = starterRecipes.find(item => item.id === requestedDeck);
      const snapshotCards = saved ? catalogIdsToEngineIds(saved.cardIds) : recipe?.cards ?? [];
      if (snapshotCards.length !== 10) throw new Error("Challenge crew must contain exactly 10 cards");
      const progressionSnapshot = createCardProgressionSnapshot(
        [...snapshotCards],
        profile.ownedCardIds,
        profile.cardProgression,
      );
      const crew = {
        deckId: saved?.id ?? recipe?.id ?? profile.starterDeckId ?? "rookie",
        cards: progressionSnapshot.abilityUpgradeSnapshot.player.map((card) => {
          const progression = progressionSnapshot.cards.find(item =>
            item.cardId === normalizeCatalogCardId(card.cardId)
          );
          return {
            cardId: card.cardId,
            xp: progression?.xp ?? 0,
            level: card.level,
            ...(card.moveTier !== undefined ? { moveTier: card.moveTier } : {}),
            upgradeIds: [...card.upgradeIds],
          };
        }),
        capturedAt: new Date().toISOString(),
      };
      const entryNumber = Number(count.count) + 1;
      const [created] = await tx.insert(challengeRunsTable).values({ clerkUserId, seed, entryDate: today, entryNumber, wins: 0, crewSnapshot: { ...crew, rulesVersion: 1 }, encounterSnapshot: encounterFor(seed, 0), checkpoints: [], transcripts: [] }).returning();
      return created;
    });
    res.status(201).json(response(result));
  } catch (error) { res.status(409).json({ error: error instanceof Error ? error.message : "Unable to start challenge" }); }
});

router.get("/player/challenges/runs", async (req, res) => {
  const clerkUserId = user(req, res); if (!clerkUserId) return;
  const rows = await db.select().from(challengeRunsTable).where(eq(challengeRunsTable.clerkUserId, clerkUserId)).orderBy(desc(challengeRunsTable.createdAt)).limit(50);
  res.json(rows.map(response));
});

/** Commit an exact transcript prefix for an arcade encounter. Outcomes are
 * deliberately not accepted here; completion still goes through /complete. */
router.post("/player/challenges/runs/:runId/checkpoint", async (req, res) => {
  const clerkUserId = user(req, res); if (!clerkUserId) return;
  try {
    const saved = await db.transaction(async tx => {
      const [run] = await tx.select().from(challengeRunsTable)
        .where(and(eq(challengeRunsTable.id, String(req.params.runId)), eq(challengeRunsTable.clerkUserId, clerkUserId), eq(challengeRunsTable.status, "active"))).for("update");
      if (!run) throw new Error("Challenge run not found");
      const encounter = run.encounterSnapshot as { playerMatchId?: string; rivalDeckId?: string };
      if (!encounter.playerMatchId) throw new Error("Challenge encounter has not started");
      const moves = req.body?.moves;
      if (!Array.isArray(moves)) throw new Error("Checkpoint moves are required");
      const previous = (run.checkpoints as Array<Record<string, unknown>>)
        .find(item => item.matchId === encounter.playerMatchId);
      const previousMoves = Array.isArray(previous?.moves) ? previous.moves : [];
      if (moves.length < previousMoves.length ||
          // PostgreSQL JSONB normalizes object key order. Compare the move data,
          // never its serialized property order, when extending a saved round.
          previousMoves.some((move, index) => !isDeepStrictEqual(move, moves[index]))) {
        throw new Error("Checkpoint must extend the existing transcript prefix");
      }
      const [match] = await tx.select().from(playerMatchesTable).where(and(eq(playerMatchesTable.id, encounter.playerMatchId), eq(playerMatchesTable.clerkUserId, clerkUserId))).limit(1);
      if (!match || !match.storyEncounterSnapshot) throw new Error("Challenge match not found");
      const roster = (run.crewSnapshot as { cards: Array<{ cardId: string }> }).cards.map(card => card.cardId);
      const progression = match.playerCardProgressionSnapshot as { abilityUpgradeSnapshot?: unknown; districtSnapshot?: unknown } | null;
      replayMatchPrefix(createStoryMatch(match.storyEncounterSnapshot as never, roster, match.playerDeckId, progression?.abilityUpgradeSnapshot as never, progression?.districtSnapshot as never), moves as TranscriptMove[]);
      const checkpoint = { matchId: encounter.playerMatchId, moves: structuredClone(moves) };
      const prior = (run.checkpoints as Array<Record<string, unknown>>).filter(item => item.matchId !== encounter.playerMatchId);
      const [updated] = await tx.update(challengeRunsTable).set({ checkpoints: [...prior, checkpoint], updatedAt: new Date() }).where(eq(challengeRunsTable.id, run.id)).returning();
      return updated;
    });
    res.json(response(saved));
  } catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Invalid checkpoint" }); }
});

router.post("/player/challenges/runs/:runId/actions", async (_req, res) => {
  res.status(410).json({ error: "Use the normal player match lifecycle" });
});

async function abandon(req: Request, res: Response) {
  const clerkUserId = user(req, res); if (!clerkUserId) return;
  try {
    const row = await db.transaction(async tx => {
      const [current] = await tx.select().from(challengeRunsTable).where(and(eq(challengeRunsTable.id, String(req.params.runId)), eq(challengeRunsTable.clerkUserId, clerkUserId))).for("update");
      if (!current) throw new Error("Challenge run not found");
      abandonChallenge(fromRow(current));
      const [saved] = await tx.update(challengeRunsTable).set({ status: "abandoned", completedAt: current.completedAt ?? new Date(), updatedAt: new Date() }).where(eq(challengeRunsTable.id, current.id)).returning();
      return saved;
    });
    res.json(response(row));
  } catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Unable to abandon challenge" }); }
}
router.post("/player/challenges/runs/:runId/settle", (_req, res) => {
  res.status(410).json({ error: "Challenge outcomes settle through verified match completion" });
});
router.post("/player/challenges/runs/:runId/abandon", abandon);
export default router;
