import { sql } from 'drizzle-orm';
import { db } from '@workspace/db';

/** Finished replays remain available for a week, then only the replay archive is
 * removed. Room rows are kept: social records, opponent lookup, ranked receipts
 * and series tallies read room metadata (members/series/winner/settlement). */
export const REPLAY_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
// Rows whose stored state is this small have no replay worth pruning. The size
// check reads the varlena header only, so steady-state scans avoid detoasting.
const PRUNABLE_STATE_BYTES = 4 * 1024;

type Options = { now?: number; batchSize?: number; maxBatches?: number; budgetMs?: number };

export async function pruneFinishedRoomReplays({ now = Date.now(), batchSize = 20, maxBatches = 50, budgetMs = 20_000 }: Options = {}) {
  const started = Date.now();
  const cutoff = new Date(now - REPLAY_RETENTION_MS);
  let pruned = 0;
  let batches = 0;
  while (batches < maxBatches && Date.now() - started < budgetMs) {
    batches++;
    // SKIP LOCKED: never wait on a room an API request holds. Each batch is its
    // own short transaction; the live-state trigger refreshes projections.
    const result = await db.execute<{ id: string }>(sql`
      with candidates as (
        select id from online_rooms
        where expires_at < ${cutoff}
          and pg_column_size(state) > ${PRUNABLE_STATE_BYTES}
          and state->>'status' in ('complete', 'closed')
          and jsonb_typeof(state->'match') = 'object'
          -- Kumite rewards/records re-validate the finished match phase.
          and not (state ? 'kumite')
          -- An unsettled finished ranked room can still settle on reconnect.
          and (not (state ? 'ranked') or state->>'status' = 'closed'
            or jsonb_typeof(state #> '{ranked,settlement}') = 'object')
        order by expires_at
        limit ${batchSize}
        for update skip locked
      )
      update online_rooms as room
      set state = jsonb_set(room.state, '{match}', 'null'::jsonb) || jsonb_build_object('replayPrunedAt', ${now}::bigint)
      from candidates
      where room.id = candidates.id
      returning room.id`);
    pruned += result.rows.length;
    if (result.rows.length < batchSize) break;
  }
  return { pruned, batches, cutoff: cutoff.toISOString() };
}
