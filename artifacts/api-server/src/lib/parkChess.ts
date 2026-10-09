import { and, eq } from "drizzle-orm";
import { db, playerCollectionClaimsTable as claims, playerProfilesTable as profiles } from "@workspace/db";
import { parkChessRunId, parkChessStartInput, parkChessMoveInput, parkChessResignInput } from "@workspace/api-zod";
import {
  createParkChessRun, playParkChessMove, resignParkChessRun, getParkChessView,
  ParkChessRuleError, type ParkChessRun, type ParkChessView,
} from "@workspace/squabblemon-engine/parkChess";
import { lockPlayerProfile, PlayerRewardError } from "./playerRewardTransactions";

type Reader = Pick<typeof db, "select">;
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Move = Parameters<typeof playParkChessMove>[1];
type Campaign = { wins: number; losses: number; draws: number; games: number; activeRunId: string | null; lastRunId: string | null };
export type ParkChessStatus = {
  run: ParkChessView | null;
  campaign: Omit<Campaign, "activeRunId" | "lastRunId"> & { tier: number };
  earned: { softCurrency: 0; packTickets: number; styleShards: 0 };
  serverNow: number;
  replayed?: boolean;
};
const campaignKey = "park-chess:campaign:v1";
const runKey = (id: string) => `park-chess:run:v1:${id}`;
const startKey = (id: string) => `park-chess:start:v1:${id}`;
const actionKey = (runId: string, actionId: string) => `park-chess:action:v1:${runId}:${actionId}`;
const emptyCampaign = (): Campaign => ({ wins: 0, losses: 0, draws: 0, games: 0, activeRunId: null, lastRunId: null });

async function entry(reader: Reader, userId: string, key: string) {
  return (await reader.select().from(claims).where(and(eq(claims.clerkUserId, userId), eq(claims.milestoneKey, key))))[0];
}
async function readCampaign(reader: Reader, userId: string): Promise<Campaign> {
  const row = await entry(reader, userId, campaignKey);
  return (row?.reward.parkChessCampaign?.state as Campaign) ?? emptyCampaign();
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
    campaign: { wins: campaign.wins, losses: campaign.losses, draws: campaign.draws, games: campaign.games, tier: Math.min(5, campaign.wins + 1) },
    earned: { softCurrency: 0, packTickets: stored?.packTickets ?? 0, styleShards: 0 },
    serverNow: now.getTime(),
  };
}
export const getParkChess = (userId: string, now = new Date()) => db.transaction(async tx => {
  await lockPlayerProfile(tx, userId);
  return status(tx, userId, now);
});

export async function startParkChess(userId: string, requestId: string, now = new Date()): Promise<ParkChessStatus> {
  if (!parkChessStartInput.safeParse({ requestId }).success) throw new PlayerRewardError("Invalid chess entry", 400);
  return db.transaction(async tx => {
    await lockPlayerProfile(tx, userId);
    if ((await entry(tx, userId, startKey(requestId)))?.reward.parkChessStart) return { ...await status(tx, userId, now), replayed: true };
    const campaign = await readCampaign(tx, userId);
    const active = campaign.activeRunId ? await entry(tx, userId, runKey(campaign.activeRunId)) : undefined;
    if ((active?.reward.parkChessRun?.state as ParkChessRun)?.phase === "active") {
      await tx.insert(claims).values({ clerkUserId: userId, milestoneKey: startKey(requestId), reward: { parkChessStart: { runId: campaign.activeRunId! } } });
      return { ...await status(tx, userId, now), replayed: true };
    }
    const run = createParkChessRun(requestId, Math.min(5, campaign.wins + 1));
    await tx.insert(claims).values({ clerkUserId: userId, milestoneKey: runKey(requestId), reward: { parkChessRun: {
      version: 1, runId: requestId, state: run, packTickets: 0, startedAt: now.toISOString(), completedAt: null,
    } } });
    await tx.insert(claims).values({ clerkUserId: userId, milestoneKey: startKey(requestId), reward: { parkChessStart: { runId: requestId } } });
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
    if (tickets > stored.packTickets) {
      const [profile] = await tx.select().from(profiles).where(eq(profiles.clerkUserId, userId));
      if (!profile) throw new PlayerRewardError("Player profile not found", 404);
      await tx.update(profiles).set({ packTickets: profile.packTickets + 1, updatedAt: now }).where(eq(profiles.clerkUserId, userId));
    }
    if (next.phase !== "active") {
      await saveCampaign(tx, userId, {
        ...campaign, activeRunId: null, lastRunId: runId, games: campaign.games + 1,
        wins: campaign.wins + (won ? 1 : 0), draws: campaign.draws + (next.phase === "draw" ? 1 : 0),
        losses: campaign.losses + (next.phase === "lost" || next.phase === "resigned" ? 1 : 0),
      });
    }
    await tx.update(claims).set({ reward: { parkChessRun: { ...stored, state: next, packTickets: tickets, completedAt: next.phase === "active" ? null : now.toISOString() } } }).where(eq(claims.id, row.id));
    await tx.insert(claims).values({ clerkUserId: userId, milestoneKey: actionKey(runId, actionId), reward: { parkChessAction: { runId, actionId, revision, fingerprint } } });
    return { ...await status(tx, userId, now), replayed: false };
  });
}
export const moveParkChess = (userId: string, runId: string, revision: number, actionId: string, move: Move, now = new Date()) => applyAction(userId, runId, revision, actionId, { kind: "move", move }, now);
export const resignParkChess = (userId: string, runId: string, revision: number, actionId: string, now = new Date()) => applyAction(userId, runId, revision, actionId, { kind: "resign" }, now);
