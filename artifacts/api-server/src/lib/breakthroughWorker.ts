import { BreakthroughBus, roomChannel } from './breakthroughBus';
import type { BreakthroughOnlineService, BreakthroughRuntimeOptions } from './breakthroughOnline';
import { BreakthroughRoomError, type BreakthroughRoomView } from '@workspace/squabblemon-engine/breakthroughRoom';
import { encodeRoomStream } from '@workspace/squabblemon-engine/breakthroughRoomStream';

/** One bounded invocation owns one room. PostgreSQL fencing rejects duplicate invocations;
 * the existing journal remains the sole authority for commands, clock and settlement. */
export async function runBreakthroughWorker(
  service: BreakthroughOnlineService,
  pool: BreakthroughRuntimeOptions['pool'],
  roomId: string,
  signal: AbortSignal = AbortSignal.timeout(12 * 60 * 1000),
) {
  const channel = roomChannel(roomId);
  const result = await pool.query("SELECT checkpoint->'members' AS members, checkpoint->>'phase' AS phase FROM breakthrough_rooms WHERE room_id=$1", [roomId]);
  if (!result.rows.length || result.rows[0].phase !== 'active') { await service.settle(); return; }
  const members = Object.values(result.rows[0].members) as string[];
  const subscribers = new Map<string, {user: string; expires: number; view: BreakthroughRoomView | null}>();
  const requests = new Map<string, {at: number; result: Promise<unknown>}>();
  let transportError: Error | undefined;
  let tail: Promise<unknown> = Promise.resolve();
  const serial = <T>(fn: () => Promise<T>) => { const next = tail.then(fn); tail = next.catch(() => {}); return next; };
  const bus = await BreakthroughBus.open(pool, channel, message => {
    if (!message || !/^bt_reply_[a-f0-9]{32}$/.test(message.reply ?? '') || !members.includes(message.user)) return;
    void serial(async () => {
      try {
        if (message.method === 'unsubscribe') { subscribers.delete(message.reply); return; }
        if (message.method === 'subscribe') {
          const expires = Math.min(Number(message.expires), Date.now() + 45000);
          if (!Number.isFinite(expires) || expires <= Date.now()) throw new BreakthroughRoomError('unauthorized', 'Sign in again.');
          if (!subscribers.has(message.reply) && [...subscribers.values()].filter(s => s.user === message.user).length >= 2)
            throw new BreakthroughRoomError('invalid-request', 'Close another arena tab.');
          const view = await service.view(roomId, message.user);
          await bus.send(message.reply, {frame: encodeRoomStream(null, view)});
          subscribers.set(message.reply, {user: message.user, expires, view});
          return;
        }
        if (!['view', 'command'].includes(message.method) || typeof message.id !== 'string') return;
        for (const [id, saved] of requests) if (Date.now() - saved.at > 15000) requests.delete(id);
        const key = message.user + ':' + message.id;
        if (!requests.has(key)) {
          if (requests.size >= 128) throw Error('Arena request backlog');
          const operation = message.method === 'view' ? service.view(roomId, message.user) : service.command(roomId, message.user, message.envelope);
          // Retain the promise for uncertain transport retries. Game identity is enforced by owner.command.
          requests.set(key, {at: Date.now(), result: operation});
        }
        await bus.send(message.reply, {id: message.id, value: await requests.get(key)!.result});
      } catch (error) {
        const known = error instanceof BreakthroughRoomError;
        await bus.send(message.reply, {id: message.id, error: {
          code: known ? error.code : 'unavailable', message: known ? error.message : 'Arena is recovering. Reconnect shortly.',
          ...(known && error.expectedSequence !== undefined ? {expectedSequence: error.expectedSequence} : {}),
        }}).catch(() => {});
      }
    }).catch(error => { transportError = error; });
  }, error => { transportError = error; });
  try {
    // Acquire before running: only one of concurrently invoked workers can pass this lease.
    await service.view(roomId, members[0]);
    let nextPublish = 0;
    while (!signal.aborted) {
      if (transportError) throw transportError;
      const terminal = await serial(async () => {
        await service.cycle();
        const now = Date.now();
        const current = await service.view(roomId, members[0]);
        if (now >= nextPublish || current.phase !== 'active') {
          nextPublish = now + 100;
          for (const [reply, subscription] of subscribers) {
            if (subscription.expires <= now) { subscribers.delete(reply); continue; }
            const view = subscription.user === members[0] ? current : await service.view(roomId, subscription.user);
            if (view.revision === subscription.view?.revision) continue;
            await bus.send(reply, {frame: encodeRoomStream(subscription.view, view)});
            subscription.view = view;
          }
        }
        return current.phase !== 'active';
      });
      if (terminal) { await service.settle(); break; }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  } catch (error) {
    // A duplicate invocation must not retry for minutes after a legitimate owner won.
    if (!(error instanceof BreakthroughRoomError && error.code === 'stale-owner')) throw error;
  } finally {
    await bus.close();
    await tail;
    await service.stop();
  }
}
