import { and, eq } from "drizzle-orm";
import { db, playerCollectionClaimsTable as claims, playerProfilesTable as profiles } from "@workspace/db";
import { parkChessRunId, parkChessStartInput, parkChessMoveInput, parkChessResignInput } from "@workspace/api-zod";
import {
  createParkChessRun, playParkChessMove, resignParkChessRun, getParkChessView,
  ParkChessRuleError, type ParkChessRun, type ParkChessView,
} from "@workspace/squabblemon-engine/parkChess";
import {
  createParkChessRating, getParkChessOpponentRating, settleParkChessRating,
  PARK_CHESS_RATING_MIN, PARK_CHESS_RATING_MAX,
  type ParkChessRatingState, type ParkChessRatingChange,
} from "@workspace/squabblemon-engine/parkChessRating";
import { lockPlayerProfile, PlayerRewardError } from "./playerRewardTransactions";

type Reader = Pick<typeof db, "select">;
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Move = Parameters<typeof playParkChessMove>[1];
type Campaign = { wins: number; losses: number; draws: number; games: number; unlockedTier: number; rating: ParkChessRatingState; activeRunId: string | null; lastRunId: string | null };
export type ParkChessStatus = {
  run: ParkChessView | null;
  campaign: Omit<Campaign, "activeRunId" | "lastRunId" | "unlockedTier" | "rating"> & { tier: number };
  rating: ParkChessRatingState;
  runRating: { opponent: number; change: ParkChessRatingChange | null; rated: boolean } | null;
  earned: { softCurrency: 0; packTickets: number; styleShards: 0 };
  serverNow: number;
  replayed?: boolean;
};
const campaignKey = "park-chess:campaign:v1";
const runKey = (id: string) => `park-chess:run:v1:${id}`;
const startKey = (id: string) => `park-chess:start:v1:${id}`;
const actionKey = (runId: string, actionId: string) => `park-chess:action:v1:${runId}:${actionId}`;
const emptyCampaign = (): Campaign => ({ wins: 0, losses: 0, draws: 0, games: 0, unlockedTier: 1, rating: createParkChessRating(), activeRunId: null, lastRunId: null });

async function entry(reader: Reader, userId: string, key: string) {
  return (await reader.select().from(claims).where(and(eq(claims.clerkUserId, userId), eq(claims.milestoneKey, key))))[0];
}
async function readCampaign(reader: Reader, userId: string): Promise<Campaign> {
  const row = await entry(reader, userId, campaignKey);
  const stored = row?.reward.parkChessCampaign?.state as Campaign | undefined;
  if (!stored) return emptyCampaign();
  // Existing campaigns used total wins to choose difficulty. Preserve their
  // frontier once, then advance it only by beating that unlocked tier.
  return { ...stored, rating: stored.rating ?? createParkChessRating(), unlockedTier: Number.isInteger(stored.unlockedTier)
    ? Math.max(1, Math.min(5, stored.unlockedTier)) : Math.min(5, stored.wins + 1) };
}
async function saveCampaign(tx: Transaction, userId: string, campaign: Campaign) {
  await tx.insert(claims).values({ clerkUserId: userId, milestoneKey: campaignKey, reward: { parkChessCampaign: { version: 1, state: campaign } } })
    .onConflictDoUpdate({ target: [claims.clerkUserId, claims.milestoneKey], set: { reward: { parkChessCampaign: { version: 1, state: campaign } } } });
}
async function status(reader: Reader, userId: string, now: Date): Promise<ParkChessStatus> {
  const campaign = await readCampaign(reader, userId);
  const id = campaign.activeRunId ?? campaign.lastRunId;
  const row = id ? await entry(reader, userId, runKey(id)) : undefined;
  const stored = row?.reward.parkChessRun;
  return {
    run: stored ? getParkChessView(stored.state as ParkChessRun) : null,
    campaign: { wins: campaign.wins, losses: campaign.losses, draws: campaign.draws, games: campaign.games, tier: campaign.unlockedTier },
    rating: campaign.rating,
    runRating: stored ? {
      opponent: stored.opponentRating ?? getParkChessOpponentRating((stored.state as ParkChessRun).tier),
      change: stored.ratingChange ?? null, rated: stored.ratingBefore !== undefined,
    } : null,
    earned: { softCurrency: 0, packTickets: stored?.packTickets ?? 0, styleShards: 0 },
    serverNow: now.getTime(),
  };
}
export const getParkChess = (userId: string, now = new Date()) => db.transaction(async tx => {
  await lockPlayerProfile(tx, userId);
  return status(tx, userId, now);
});

export async function startParkChess(userId: string, requestId: string, now = new Date(), tier?: number): Promise<ParkChessStatus> {
  if (!parkChessStartInput.safeParse({ requestId, ...(tier !== undefined ? { tier } : {}) }).success) throw new PlayerRewardError("Invalid chess entry", 400);
  return db.transaction(async tx => {
    await lockPlayerProfile(tx, userId);
    const previous = (await entry(tx, userId, startKey(requestId)))?.reward.parkChessStart;
    if (previous) {
      // Old clients sent only a request ID. Their durable retries must remain
      // safe without guessing which selection an old receipt represented.
      if (previous.requestedTier !== undefined ? previous.requestedTier !== (tier ?? null) : tier !== undefined)
        throw new PlayerRewardError("This entry ID was already used for another tier. Choose a new game to change tiers.", 409);
      return { ...await status(tx, userId, now), replayed: true };
    }
    const campaign = await readCampaign(tx, userId);
    const selectedTier = tier ?? campaign.unlockedTier;
    if (selectedTier > campaign.unlockedTier) throw new PlayerRewardError("Beat your highest unlocked tier to unlock this challenge.", 409);
    const active = campaign.activeRunId ? await entry(tx, userId, runKey(campaign.activeRunId)) : undefined;
    const activeRun = active?.reward.parkChessRun?.state as ParkChessRun | undefined;
    if (activeRun?.phase === "active") {
      await tx.insert(claims).values({ clerkUserId: userId, milestoneKey: startKey(requestId), reward: { parkChessStart: { runId: campaign.activeRunId!, tier: activeRun.tier, requestedTier: tier ?? null } } });
      return { ...await status(tx, userId, now), replayed: true };
    }
    const run = createParkChessRun(requestId, selectedTier);
    await tx.insert(claims).values({ clerkUserId: userId, milestoneKey: runKey(requestId), reward: { parkChessRun: {
      version: 1, runId: requestId, state: run, packTickets: 0, startedAt: now.toISOString(), completedAt: null,
      ratingBefore: campaign.rating, opponentRating: getParkChessOpponentRating(selectedTier), ratingChange: null,
    } } });
    await tx.insert(claims).values({ clerkUserId: userId, milestoneKey: startKey(requestId), reward: { parkChessStart: { runId: requestId, tier: selectedTier, requestedTier: tier ?? null } } });
    await saveCampaign(tx, userId, { ...campaign, activeRunId: requestId, lastRunId: requestId });
    return { ...await status(tx, userId, now), replayed: false };
  });
}

async function applyAction(userId: string, runId: string, revision: number, actionId: string, action: { kind: "move"; move: Move } | { kind: "resign" }, now: Date): Promise<ParkChessStatus> {
  if (!parkChessRunId.safeParse(runId).success || !(action.kind === "move" ? parkChessMoveInput.safeParse({ revision, actionId, move: action.move }) : parkChessResignInput.safeParse({ revision, actionId })).success)
    throw new PlayerRewardError("Invalid chess action", 400);
  const fingerprint = JSON.stringify(action.kind === "move" ? { kind: "move", revision, from: action.move.from, to: action.move.to, promotion: action.move.promotion ?? null } : { kind: "resign", revision });
  return db.transaction(async tx => {
    await lockPlayerProfile(tx, userId);
    const row = await entry(tx, userId, runKey(runId));
    const stored = row?.reward.parkChessRun;
    if (!row || !stored) throw new PlayerRewardError("Chess game not found", 404);
    const previous = (await entry(tx, userId, actionKey(runId, actionId)))?.reward.parkChessAction;
    if (previous) {
      if (previous.fingerprint !== fingerprint) throw new PlayerRewardError("This action ID was already used for another move", 409);
      return { ...await status(tx, userId, now), replayed: true };
    }
    const current = stored.state as ParkChessRun;
    const campaign = await readCampaign(tx, userId);
    if (current.revision !== revision || campaign.activeRunId !== runId) throw new PlayerRewardError("This game changed. Sync to resume your latest turn.", 409);
    let next: ParkChessRun;
    try { next = action.kind === "move" ? playParkChessMove(current, action.move) : resignParkChessRun(current); }
    catch (error) {
      if (error instanceof ParkChessRuleError) throw new PlayerRewardError(error.message, 409);
      throw error;
    }
    const won = next.phase === "won" && next.reason === "checkmate";
    const tickets = won ? 1 : 0;
    if (next.phase !== "active" && stored.ratingBefore && (
      stored.ratingBefore.value !== campaign.rating.value || stored.ratingBefore.games !== campaign.rating.games ||
      stored.ratingBefore.peak !== campaign.rating.peak || typeof stored.opponentRating !== "number" ||
      !Number.isSafeInteger(stored.opponentRating) || stored.opponentRating < PARK_CHESS_RATING_MIN || stored.opponentRating > PARK_CHESS_RATING_MAX
    )) throw new PlayerRewardError("The saved rating changed. Sync before completing this game.", 409);
    const ratingSettlement = next.phase !== "active" && stored.ratingBefore
      ? settleParkChessRating(stored.ratingBefore, current.tier, won ? "win" : next.phase === "draw" ? "draw" : "loss", stored.opponentRating)
      : null;
    if (tickets > stored.packTickets) {
      const [profile] = await tx.select().from(profiles).where(eq(profiles.clerkUserId, userId));
      if (!profile) throw new PlayerRewardError("Player profile not found", 404);
      await tx.update(profiles).set({ packTickets: profile.packTickets + 1, updatedAt: now }).where(eq(profiles.clerkUserId, userId));
    }
    if (next.phase !== "active") {
      await saveCampaign(tx, userId, {
        ...campaign, activeRunId: null, lastRunId: runId, games: campaign.games + 1,
        unlockedTier: won && current.tier === campaign.unlockedTier ? Math.min(5, campaign.unlockedTier + 1) : campaign.unlockedTier,
        rating: ratingSettlement?.state ?? campaign.rating,
        wins: campaign.wins + (won ? 1 : 0), draws: campaign.draws + (next.phase === "draw" ? 1 : 0),
        losses: campaign.losses + (next.phase === "lost" || next.phase === "resigned" ? 1 : 0),
      });
    }
    await tx.update(claims).set({ reward: { parkChessRun: { ...stored, state: next, packTickets: tickets,
      ratingChange: ratingSettlement?.change ?? stored.ratingChange ?? null,
      completedAt: next.phase === "active" ? null : now.toISOString(),
    } } }).where(eq(claims.id, row.id));
    await tx.insert(claims).values({ clerkUserId: userId, milestoneKey: actionKey(runId, actionId), reward: { parkChessAction: { runId, actionId, revision, fingerprint } } });
    return { ...await status(tx, userId, now), replayed: false };
  });
}
export const moveParkChess = (userId: string, runId: string, revision: number, actionId: string, move: Move, now = new Date()) => applyAction(userId, runId, revision, actionId, { kind: "move", move }, now);
export const resignParkChess = (userId: string, runId: string, revision: number, actionId: string, now = new Date()) => applyAction(userId, runId, revision, actionId, { kind: "resign" }, now);
