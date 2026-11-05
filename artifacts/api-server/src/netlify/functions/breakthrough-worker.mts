import type { Config } from '@netlify/functions';
import { pool } from '@workspace/db';
import { validWorkerSignature } from '../../lib/breakthroughNetlify';
import { createBreakthroughRuntime } from '../../lib/breakthroughRuntime';
import { runBreakthroughWorker } from '../../lib/breakthroughWorker';
import { getBreakthroughLaunchReadiness } from '@workspace/squabblemon-engine/breakthroughCatalog';

export default async function worker(request: Request) {
  if (request.method !== 'POST' || Netlify.env.get('BREAKTHROUGH_PVP_ENABLED') !== 'true' || !getBreakthroughLaunchReadiness().canLaunch) return;
  const body = await request.text();
  if (body.length > 512 || !validWorkerSignature(body, request.headers.get('x-breakthrough-worker') ?? '', Netlify.env.get('BREAKTHROUGH_WORKER_SECRET') ?? '')) return;
  const input = JSON.parse(body);
  if (typeof input.issuedAt !== 'number' || Math.abs(Date.now() - input.issuedAt) > 5 * 60 * 1000 || typeof input.roomId !== 'string') return;
  const {service} = createBreakthroughRuntime(input.roomId);
  await runBreakthroughWorker(service, pool, input.roomId);
}
export const config: Config = {background: true};
