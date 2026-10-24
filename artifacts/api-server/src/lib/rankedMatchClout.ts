import { and, eq, gte, lt, sql } from 'drizzle-orm';
import { db, playerCollectionClaimsTable } from '@workspace/db';
import { RANKED_MATCH_CLOUT, RANKED_MATCH_CLOUT_LIMIT, type RankedMatchClout } from '@workspace/squabblemon-engine/ranked';
import type { OnlineRoom } from '@workspace/squabblemon-engine/multiplayer';
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Indexable UTC window; the receipt date is checked as well so unrelated
 * claims never count, even if a future backfill shares this ledger. */
export function rankedCloutClaimsForDay(userId: string, date: string) {
  const start = new Date(`${date}T00:00:00Z`);
  return and(eq(playerCollectionClaimsTable.clerkUserId, userId),
    gte(playerCollectionClaimsTable.createdAt, start),
    lt(playerCollectionClaimsTable.createdAt, new Date(start.getTime() + 86400000)),
    sql`${playerCollectionClaimsTable.reward}->'rankedMatchClout'->>'date' = ${date}`,
    sql`${playerCollectionClaimsTable.reward}->'rankedMatchClout'->>'status' = 'saved'`);
}

/** Caller holds the room and this player's profile lock. Ledger and wallet delta
 * commit together; concurrent completed rooms share the profile lock and daily cap. */
export async function bankRankedMatchClout(tx: Tx, room: OnlineRoom, seat: 'player' | 'cpu', roomId: string, now: number) {
  const userId = room.members[seat]!.userId;
  const milestoneKey = `ranked-clout:v1:${roomId}:${room.gameNumber}`;
  const match = and(eq(playerCollectionClaimsTable.clerkUserId, userId), eq(playerCollectionClaimsTable.milestoneKey, milestoneKey));
  const [previous] = await tx.select().from(playerCollectionClaimsTable).where(match);
  if (previous?.reward.rankedMatchClout) return { receipt: previous.reward.rankedMatchClout, delta: 0 };
  const date = new Date(now).toISOString().slice(0, 10);
  const resetsAt = new Date(Date.parse(`${date}T00:00:00Z`) + 86400000).toISOString();
  const base = { receiptId: `ranked-clout:${roomId}:${room.gameNumber}:${seat}`, date, softCurrency: 0, dailyLimit: RANKED_MATCH_CLOUT_LIMIT, resetsAt };
  let receipt: RankedMatchClout;
  if (!room.ranked || room.ranked.bot || room.status !== 'complete' || room.reason !== 'districts' || !room.members.cpu) {
    receipt = { ...base, status: 'ineligible', exclusion: room.ranked?.bot ? 'bot' : 'not-full-match' };
  } else {
    const [count] = await tx.select({ paid: sql<number>`count(*)::integer` }).from(playerCollectionClaimsTable).where(rankedCloutClaimsForDay(userId, date));
    const paid = Number(count?.paid ?? 0);
    const outcome = room.winner === 'draw' ? 'draw' : room.winner === seat ? 'win' : 'loss';
    const capped = paid >= RANKED_MATCH_CLOUT_LIMIT;
    receipt = { ...base, status: capped ? 'daily-limit' : 'saved',
      softCurrency: capped ? 0 : RANKED_MATCH_CLOUT[outcome], paidMatchesToday: Math.min(RANKED_MATCH_CLOUT_LIMIT, paid + Number(!capped)) };
  }
  const [saved] = await tx.insert(playerCollectionClaimsTable).values({ clerkUserId: userId, milestoneKey, createdAt: new Date(now), reward: { rankedMatchClout: receipt } }).onConflictDoNothing().returning();
  if (!saved) {
    const [recovered] = await tx.select().from(playerCollectionClaimsTable).where(match);
    if (!recovered?.reward.rankedMatchClout) throw new Error('Could not confirm ranked match reward.');
    return { receipt: recovered.reward.rankedMatchClout, delta: 0 };
  }
  return { receipt, delta: receipt.softCurrency };
}
