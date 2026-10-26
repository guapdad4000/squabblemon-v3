import type { Config } from '@netlify/functions';

/** Scheduled only; no public route. Bounded batches finish within the scheduled-function limit. */
export default async function roomRetention() {
  const { pruneFinishedRoomReplays } = await import('../../lib/onlineRoomRetention');
  const result = await pruneFinishedRoomReplays();
  console.log(JSON.stringify({ event: 'online_room_replay_retention', ...result }));
  return Response.json(result);
}

// Hourly, off the top of the hour to avoid overlapping other cron work.
export const config: Config = { schedule: '23 * * * *' };
