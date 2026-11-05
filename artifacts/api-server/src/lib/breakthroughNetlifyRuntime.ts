import { clerkClient } from '@clerk/express';
import { pool } from '@workspace/db';
import { getBreakthroughLaunchReadiness } from '@workspace/squabblemon-engine/breakthroughCatalog';
import { BreakthroughRoomError } from '@workspace/squabblemon-engine/breakthroughRoom';
import { createBreakthroughRuntime } from './breakthroughRuntime';
import { createNetlifyBreakthroughHandler, wakeBreakthroughWorker } from './breakthroughNetlify';
import { BreakthroughBus, replyChannel } from './breakthroughBus';
import { currentDeploymentContext } from './runtimeDeploymentContext';

const {service} = createBreakthroughRuntime(); // Admission/receipts only; no clock in a request function.
export const netlifyBreakthroughHandler = createNetlifyBreakthroughHandler({
  pool, service,
  admit() {
    if (Netlify.env.get('BREAKTHROUGH_PVP_ENABLED') !== 'true' || !getBreakthroughLaunchReadiness().canLaunch)
      throw new BreakthroughRoomError('mode-unavailable', 'Breakthrough is preparing to open.');
  },
  async principal(request) {
    const origin = currentDeploymentContext()?.origin;
    if (!origin) return null;
    const state = await clerkClient.authenticateRequest(request, {authorizedParties: [origin]});
    const auth = state.toAuth();
    return auth?.userId && typeof auth.sessionClaims?.exp === 'number'
      ? {userId: auth.userId, expiresAt: auth.sessionClaims.exp * 1000} : null;
  },
  wake: roomId => wakeBreakthroughWorker(pool, roomId, currentDeploymentContext()!.origin, Netlify.env.get('BREAKTHROUGH_WORKER_SECRET') ?? ''),
});

/** Public, bounded, read-only readiness; no account data or connection strings. Cache briefly
 * so operators/clients cannot accidentally create a notification connection storm. */
let probe: Promise<boolean> | undefined, probeAt = 0;
async function checkTransport() {
  const channel = replyChannel();
  let done!: (value: boolean) => void;
  const delivered = new Promise<boolean>(resolve => { done = resolve; });
  const timer = setTimeout(() => done(false), 2500);
  let bus: BreakthroughBus | undefined;
  try {
    await pool.query('SELECT worker_wake_at FROM breakthrough_rooms LIMIT 0');
    bus = await BreakthroughBus.open(pool, channel, message => done(message.probe === channel), () => done(false));
    await BreakthroughBus.send(pool, channel, {probe: channel});
    return await delivered;
  } catch { return false; } finally { clearTimeout(timer); await bus?.close(); }
}
export async function breakthroughStatus() {
  if (!probe || Date.now() - probeAt > 15000) { probeAt = Date.now(); probe = checkTransport(); }
  const transport = await probe, release = getBreakthroughLaunchReadiness();
  const configured = Netlify.env.get('BREAKTHROUGH_PVP_ENABLED') === 'true' && (Netlify.env.get('BREAKTHROUGH_WORKER_SECRET')?.length ?? 0) >= 32;
  const ready = transport && configured && release.canLaunch;
  return Response.json({status: ready ? 'ready' : 'preparing', transport, configured,
    release: {ready: release.canLaunch, supportedCards: release.supportedCards, totalCards: release.totalCards},
    revision: process.env.BREAKTHROUGH_BUILD_SHA ?? 'unknown',
    hosting: 'netlify-background-worker'}, {status: ready ? 200 : 503, headers: {'Cache-Control': 'no-store'}});
}
