import { db, parkRivalStandingsTable } from '@workspace/db';
import { and, eq } from 'drizzle-orm';
import { PARK_BOT_PERSONAS } from '@workspace/squabblemon-engine/parkBots';
import { RANKED_SEASON, awardRank, rankedStats } from '@workspace/squabblemon-engine/ranked';
import type { OnlineRoom } from '@workspace/squabblemon-engine/multiplayer';
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
/** Called once inside the existing room settlement transaction/lock.
 * Concurrent rooms lock just their rival's row; no timers, accounts or room scans. */
export async function recordParkRivalResult(tx: Tx, room: OnlineRoom, now: number) {
  if (!room.ranked?.bot || room.ranked.settlement || room.status !== 'complete') return;
  const persona = PARK_BOT_PERSONAS.find(p => p.id === room.ranked?.botPersona);
  if (!persona) return; // Old/unrecognized rooms never get attributed to another rival.
  await tx.insert(parkRivalStandingsTable).values({season: RANKED_SEASON, personaId: persona.id, stats: rankedStats(null)}).onConflictDoNothing();
  const where = and(eq(parkRivalStandingsTable.season, RANKED_SEASON), eq(parkRivalStandingsTable.personaId, persona.id));
  const [row] = await tx.select().from(parkRivalStandingsTable).where(where).for('update');
  const outcome = room.winner === 'draw' ? 'draw' : room.winner === 'cpu' ? 'win' : 'loss';
  const {stats} = awardRank(rankedStats(row.stats), outcome, room.ranked.ratings.player, true);
  await tx.update(parkRivalStandingsTable).set({stats, updatedAt: new Date(now)}).where(where);
}
