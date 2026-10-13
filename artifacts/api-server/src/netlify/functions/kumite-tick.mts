import type { Config } from '@netlify/functions';

/** Scheduled invocation has no public route and requires no player session. */
export default async function kumiteTick() {
  // Load the deployment-selected database only after Netlify establishes its
  // function context. The same service/locks reconcile browser and cron requests.
  const { currentKumite } = await import('../../lib/kumite');
  const { tournament } = await currentKumite(null);
  return Response.json({ tournamentId: tournament.id, status: tournament.status });
}

// UTC. Deadline checks use the saved exact cutoff, including after a delayed run.
export const config: Config = { schedule: '*/15 * * * *' };
