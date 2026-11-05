import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { type BreakthroughTransport, BreakthroughBus, replyChannel, roomChannel } from './breakthroughBus';
import type { BreakthroughOnlineService, BreakthroughRuntimeOptions } from './breakthroughOnline';
import { BreakthroughRoomError, type BreakthroughRoomCheckpoint } from '@workspace/squabblemon-engine/breakthroughRoom';
import { BREAKTHROUGH_PROTOCOL } from '@workspace/squabblemon-engine/breakthroughOnline';
import { OnlineError } from '@workspace/squabblemon-engine/multiplayer';

type Pool = BreakthroughRuntimeOptions['pool'];
type Principal = {userId: string; expiresAt: number};
type Options = {
  pool: Pool; service: BreakthroughOnlineService;
  principal(request: Request): Promise<Principal | null>;
  wake(roomId: string): Promise<void>;
  admit(): void;
};
const headers = {'Cache-Control': 'private, no-store'};
const json = (value: unknown, status = 200) => Response.json(value, {status, headers});
export function workerSignature(body: string, secret: string) {
  if (secret.length < 32) throw Error('Configure the worker secret');
  return createHmac('sha256', secret).update(body).digest('hex');
}
export function validWorkerSignature(body: string, signature: string, secret: string) {
  if (!/^[a-f0-9]{64}$/.test(signature) || secret.length < 32) return false;
  return timingSafeEqual(Buffer.from(workerSignature(body, secret)), Buffer.from(signature));
}
export async function wakeBreakthroughWorker(pool: Pool, roomId: string, origin: string, secret: string, send = fetch) {
  roomChannel(roomId);
  const url = new URL(origin);
  if (url.protocol !== 'https:' || url.origin !== origin) throw Error('Configure the exact public origin');
  const reserved = await pool.query(`UPDATE breakthrough_rooms SET worker_wake_at=clock_timestamp()
    WHERE room_id=$1 AND checkpoint->>'phase'='active' AND lease_until<=clock_timestamp()
    AND worker_wake_at<clock_timestamp()-interval '10 seconds' RETURNING room_id`, [roomId]);
  if (!reserved.rowCount) return;
  const body = JSON.stringify({roomId, issuedAt: Date.now()});
  const response = await send(new URL('/.netlify/functions/breakthrough-worker', origin), {
    method: 'POST', body, headers: {'content-type': 'application/json', 'x-breakthrough-worker': workerSignature(body, secret)},
    signal: AbortSignal.timeout(8000), redirect: 'error',
  });
  if (response.status !== 202) throw Error('Match worker did not accept dispatch');
}

/** Web Response transport bypasses the legacy buffered Express adapter for SSE.
 * Commands are acknowledged only by the fenced owner after its journal commit. */
export function createNetlifyBreakthroughHandler(options: Options) {
  const rates = new Map<string, {at: number; count: number}>();
  async function authorize(roomId: string, user: string) {
    roomChannel(roomId);
    const result = await options.pool.query("SELECT checkpoint->'members' AS members,checkpoint->>'phase' AS phase FROM breakthrough_rooms WHERE room_id=$1", [roomId]);
    const room = result.rows[0];
    if (!room) throw new BreakthroughRoomError('room-not-found', 'Arena not found.');
    if (!Object.values(room.members).includes(user)) throw new BreakthroughRoomError('unauthorized', 'You are not a member of this arena.');
    return room as {members: BreakthroughRoomCheckpoint['members']; phase: string};
  }
  async function rpc(roomId: string, user: string, method: string, envelope?: unknown) {
    const reply = replyChannel(), id = randomUUID();
    let resolve!: (value: unknown) => void, reject!: (error: unknown) => void;
    const received = new Promise((yes, no) => { resolve = yes; reject = no; });
    // Attach now: connection failures can precede the await below.
    void received.catch(() => {});
    const bus = await BreakthroughBus.open(options.pool, reply, message => {
      if (message.id !== id) return;
      if (message.error) reject(new BreakthroughRoomError(message.error.code, message.error.message, message.error.expectedSequence));
      else resolve(message.value);
    }, reject);
    let retry: ReturnType<typeof setInterval> | undefined;
    const timeout = setTimeout(() => reject(new BreakthroughRoomError('stale-owner', 'Arena is reconnecting. Your play can be retried safely.')), 12000);
    try {
      await options.wake(roomId);
      const send = () => bus.send(roomChannel(roomId), {id, reply, user, method, envelope}).catch(reject);
      await send();
      retry = setInterval(() => void send(), 1000);
      return await received;
    } finally { clearTimeout(timeout); clearInterval(retry); await bus.close(); }
  }
  async function stream(request: Request, roomId: string, principal: Principal) {
    const reply = replyChannel(), id = randomUUID(), user = principal.userId;
    const expires = Math.min(Date.now() + 44000, principal.expiresAt - 1000);
    let bus: BreakthroughTransport | undefined, timer: ReturnType<typeof setTimeout> | undefined;
    let retry: ReturnType<typeof setInterval> | undefined, closed = false, started = false;
    let controller: ReadableStreamDefaultController<Uint8Array>;
    const close = () => {
      if (closed) return; closed = true;
      clearTimeout(timer); clearInterval(retry);
      request.signal.removeEventListener('abort', close);
      void bus?.send(roomChannel(roomId), {reply, user, method: 'unsubscribe'}).catch(() => {}).finally(() => bus?.close());
      try { controller?.close(); } catch {}
    };
    const body = new ReadableStream<Uint8Array>({
      start(value) { controller = value; }, cancel: close,
    }, {highWaterMark: 256 * 1024, size: chunk => chunk.byteLength});
    try {
      bus = await BreakthroughBus.open(options.pool, reply, message => {
        if (closed) return;
        if (message.error) { close(); return; }
        if (!message.frame) return;
        started = true; clearInterval(retry);
        if ((controller.desiredSize ?? 0) <= 0) { close(); return; }
        controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(message.frame)}\n\n`));
        const phase = message.frame.view?.phase ?? message.frame.header?.phase;
        if (phase && phase !== 'active') close();
      }, close);
      await options.wake(roomId);
      const subscribe = () => bus!.send(roomChannel(roomId), {id, reply, user, method: 'subscribe', expires}).catch(close);
      await subscribe();
      retry = setInterval(() => { if (!started) void subscribe(); }, 1000);
      timer = setTimeout(close, Math.max(1, expires - Date.now()));
      request.signal.addEventListener('abort', close, {once: true});
      if (request.signal.aborted) close();
      return new Response(body, {headers: {...headers, 'Content-Type': 'text/event-stream', 'X-Accel-Buffering': 'no'}});
    } catch (error) { close(); throw error; }
  }
  return async (request: Request): Promise<Response> => {
    try {
      const url = new URL(request.url), origin = request.headers.get('origin');
      if (origin && origin !== url.origin) return json({error: 'Cross-origin request rejected.'}, 403);
      if (!['GET', 'POST'].includes(request.method)) return json({error: 'Method not allowed.'}, 405);
      if (request.headers.get('x-breakthrough-protocol') !== BREAKTHROUGH_PROTOCOL) return json({error: 'Refresh to use the latest Breakthrough client.'}, 409);
      const principal = await options.principal(request);
      if (!principal || principal.expiresAt <= Date.now()) return json({error: 'Sign in to play online.'}, 401);
      options.admit();
      for (const [id, rate] of rates) if (Date.now() - rate.at > 10000) rates.delete(id);
      let rate = rates.get(principal.userId);
      if (!rate || Date.now() - rate.at >= 1000) { rate = {at: Date.now(), count: 0}; rates.set(principal.userId, rate); }
      if (++rate.count > 16) return json({error: 'Too many requests. Retry shortly.'}, 429);
      const path = url.pathname.slice('/api/breakthrough'.length).split('/').filter(Boolean), user = principal.userId;
      let input: Record<string, unknown> = {};
      if (request.method === 'POST') {
        const reader = request.body?.getReader(); let text = ''; let size = 0; const decoder = new TextDecoder();
        if (reader) { try { for (;;) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > 8192) { await reader.cancel(); return json({error: 'Request too large.'}, 413); } text += decoder.decode(part.value, {stream: true}); } } finally { reader.releaseLock(); } }
        try { input = JSON.parse(text + decoder.decode()); } catch { return json({error: 'Invalid request.'}, 400); }
        if (!input || Array.isArray(input) || typeof input !== 'object') return json({error: 'Invalid request.'}, 400);
      }
      if (!path.length && request.method === 'GET') {
        const result = await options.service.lobby(user);
        if (result.search?.roomId && result.search.status === 'paired') await options.wake(result.search.roomId);
        return json(result);
      }
      if (path[0] === 'search' && path.length === 1 && request.method === 'POST') {
        if (Object.keys(input).some(k => !['deckId', 'requestId'].includes(k)) || typeof input.deckId !== 'string' || typeof input.requestId !== 'string') return json({error: 'Choose a saved deck.'}, 400);
        const result = await options.service.searchMatch(user, input.deckId, input.requestId);
        if (result?.roomId) await options.wake(result.roomId);
        return json(result);
      }
      if (path[0] === 'cancel' && path.length === 1 && request.method === 'POST') {
        if (Object.keys(input).some(k => k !== 'requestId') || typeof input.requestId !== 'string') return json({error: 'Invalid search.'}, 400);
        return json(await options.service.cancel(user, input.requestId));
      }
      if (path.length > 2) return json({error: 'Not found.'}, 404);
      const room = await authorize(path[0], user);
      if (path[1] === 'receipt' && request.method === 'GET') return json(await options.service.receipt(path[0], user));
      if (path[1] === 'stream' && request.method === 'GET' && room.phase === 'active') return await stream(request, path[0], principal);
      if (request.method === 'GET' && (!path[1] || path[1] === 'stream')) {
        const view = room.phase === 'active' ? await rpc(path[0], user, 'view') : await options.service.view(path[0], user);
        return path[1] === 'stream' ? new Response(`data: ${JSON.stringify({kind: 'snapshot', view})}\n\n`, {headers: {...headers, 'Content-Type': 'text/event-stream'}}) : json(view);
      }
      if (path[1] === 'commands' && request.method === 'POST') {
        if (Object.keys(input).some(k => !['commandId', 'sequence', 'command', 'observedRevision'].includes(k))) return json({error: 'Invalid command.'}, 400);
        return json(room.phase === 'active' ? await rpc(path[0], user, 'command', input) : await options.service.command(path[0], user, input));
      }
      return json({error: 'Not found.'}, 404);
    } catch (error) {
      if (error instanceof OnlineError) return json({error: error.message}, error.status);
      if (error instanceof BreakthroughRoomError) {
        const status = error.code === 'unauthorized' ? 403 : error.code === 'room-not-found' ? 404 : ['stale-owner','mode-unavailable','unavailable'].includes(error.code) ? 503 : error.code.includes('conflict') || error.code === 'sequence-gap' ? 409 : 400;
        return json({error: error.message, code: error.code, expectedSequence: error.expectedSequence}, status);
      }
      return json({error: 'Arena connection interrupted. Reconnect to recover.'}, 503);
    }
  };
}
