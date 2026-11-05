import type { Config } from '@netlify/functions';
import { pool } from '@workspace/db';
import { createBreakthroughRuntime } from '../../lib/breakthroughRuntime';
import { wakeBreakthroughWorker } from '../../lib/breakthroughNetlify';
import { getBreakthroughLaunchReadiness } from '@workspace/squabblemon-engine/breakthroughCatalog';
/** Recovery after an invocation dies without a connected player. Normal play never waits for cron. */
export default async function recovery() {
  if (Netlify.env.get('BREAKTHROUGH_PVP_ENABLED') !== 'true' || !getBreakthroughLaunchReadiness().canLaunch) return;
  const {service} = createBreakthroughRuntime();
  for (let i=0; i<10 && await service.settle(); i++) {}
  const result = await pool.query("SELECT room_id FROM breakthrough_rooms WHERE checkpoint->>'phase'='active' AND lease_until<=clock_timestamp() ORDER BY lease_until LIMIT 10");
  await Promise.all(result.rows.map(row => wakeBreakthroughWorker(pool, row.room_id,
    Netlify.env.get('PUBLIC_ORIGIN') ?? '', Netlify.env.get('BREAKTHROUGH_WORKER_SECRET') ?? '')));
}
export const config: Config = {schedule: '* * * * *'};
