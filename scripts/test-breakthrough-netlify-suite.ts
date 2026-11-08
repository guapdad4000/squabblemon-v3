import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { BreakthroughBus, replyChannel } from '../artifacts/api-server/src/lib/breakthroughBus';
import { createNetlifyBreakthroughHandler, workerSignature, validWorkerSignature, wakeBreakthroughWorker } from '../artifacts/api-server/src/lib/breakthroughNetlify';
import { runBreakthroughWorker } from '../artifacts/api-server/src/lib/breakthroughWorker';
import { BreakthroughOnlineService, type BreakthroughRuntimeOptions } from '../artifacts/api-server/src/lib/breakthroughOnline';
import { buildBreakthroughRoster } from '../lib/squabblemon-engine/src/breakthroughCatalog';
import { createBreakthroughRoomForSimulation } from '../lib/squabblemon-engine/src/breakthroughRoom';
import { BreakthroughRoomOwnerForSimulation } from '../lib/squabblemon-engine/src/breakthroughRoomOwner';
import { BREAKTHROUGH_PROTOCOL } from '../lib/squabblemon-engine/src/breakthroughOnline';
import { applyRoomStream } from '../lib/squabblemon-engine/src/breakthroughRoomStream';

export async function verifyNetlify(pool: BreakthroughRuntimeOptions['pool']) {
  const payload = {text: '🟩'.repeat(5000)}, channel = replyChannel();
  let deliver!: (v: any) => void;
  const delivered = new Promise(resolve => { deliver = resolve; });
  const bus = await BreakthroughBus.open(pool, channel, deliver, e => { throw e; });
  await BreakthroughBus.send(pool, channel, payload);
  assert.deepEqual(await Promise.race([delivered, new Promise((_, reject) => setTimeout(() => reject(Error('Notification timeout')), 3000))]), payload);
  await bus.close();
  const secret = 'native-only-worker-secret-32-characters';
  assert(validWorkerSignature('body', workerSignature('body', secret), secret));
  assert(!validWorkerSignature('tamper', workerSignature('body', secret), secret));
  const roster = buildBreakthroughRoster(), cards = roster.filter(c => c.kind === 'character' && c.cost <= 3).slice(0, 10).map(c => c.id);
  const engine = {admit() {}, create: createBreakthroughRoomForSimulation,
    owner: (o: ConstructorParameters<typeof BreakthroughRoomOwnerForSimulation>[0]) => new BreakthroughRoomOwnerForSimulation(o), roster: () => roster};
  const errors: unknown[] = [];
  const options: BreakthroughRuntimeOptions = {pool, report: e => errors.push(e), member: async (_c, userId) => ({userId, name: userId, avatarKey: cards[0], cards})};
  const queue = new BreakthroughOnlineService(options, engine);
  const controls = new Map<string, AbortController>(), workers: Promise<void>[] = [];
  let dispatches = 0;
  const wake = async (roomId: string) => {
    await wakeBreakthroughWorker(pool, roomId, 'https://squabble.test', secret, async (_url, init) => {
      assert(validWorkerSignature(String(init?.body), (init?.headers as Record<string,string>)['x-breakthrough-worker'], secret));
      dispatches++;
      const control = new AbortController(); controls.set(roomId, control);
      const worker = new BreakthroughOnlineService({...options, hostedRoomId: roomId}, engine);
      workers.push(runBreakthroughWorker(worker, pool, roomId, control.signal));
      return new Response(null, {status: 202});
    });
  };
  const handler = createNetlifyBreakthroughHandler({pool, service: queue, wake, admit() {}, principal: async req => {
    const userId = req.headers.get('x-native-user'); return userId ? {userId, expiresAt: Date.now() + 60000} : null;
  }});
  const controller = new AbortController();
  const request = (user: string, path = '', body?: unknown, extra: Record<string,string> = {}) => handler(new Request('https://squabble.test/api/breakthrough' + path, {
    method: body === undefined ? 'GET' : 'POST', headers: {'x-breakthrough-protocol': BREAKTHROUGH_PROTOCOL, ...(user ? {'x-native-user': user} : {}), ...extra},
    body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal,
  }));
  const call = async (user: string, path = '', body?: unknown) => { const r = await request(user,path,body); const value = await r.json(); assert.equal(r.status,200,JSON.stringify(value)); return value; };
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    assert.equal((await request('')).status, 401);
    assert.equal((await request('', '/standings')).status,401);
    assert.equal((await request('rank-reader','/standings',undefined,{origin:'https://foreign.test'})).status,403);
    assert.equal((await request('rank-reader','/standings',undefined,{'x-breakthrough-protocol':'old'})).status,409);
    const ranks = await request('rank-reader','/standings');
    assert.equal(ranks.status,200); assert.equal(ranks.headers.get('cache-control'),'private, no-store');
    assert.deepEqual((await ranks.json()).leaders,[]); assert.equal(dispatches,0,'standings never wakes a match worker');
    assert.equal((await request('one','/search',{}, {origin:'https://foreign.test'})).status,403);
    await call('one','/search',{deckId:'owned',requestId:randomUUID()});
    const paired = await call('two','/search',{deckId:'owned',requestId:randomUUID()});
    const roomId = paired.roomId;
    const limited = new BreakthroughOnlineService({...options, maxActiveRooms: 1}, engine);
    await assert.rejects(limited.searchMatch('capacity-check', 'owned', randomUUID()), {code: 'mode-unavailable'});
    await limited.stop();
    await Promise.all([wake(roomId), wake(roomId), wake(roomId)]);
    assert.equal(dispatches,1,'dispatch reservation stops worker invocation storms');
    assert.equal((await request('stranger','/'+roomId)).status,403);
    const before = await call('one','/'+roomId);
    assert(!JSON.stringify(before).includes('"members"'));
    const stream = await request('one',`/${roomId}/stream`);
    assert.equal(stream.headers.get('content-type'),'text/event-stream');
    reader = stream.body!.getReader();
    const decode = new TextDecoder(); let text = '', current: any;
    const frame = async () => {
      while (!text.includes('\n\n')) { const chunk = await reader!.read(); assert(!chunk.done); text += decode.decode(chunk.value,{stream:true}); }
      const end = text.indexOf('\n\n'), record = text.slice(0,end); text = text.slice(end+2);
      const update = JSON.parse(record.slice(6)); current = applyRoomStream(current ?? null,update); assert(current); return current;
    };
    await frame();
    const initialTime = current.elapsedMs;
    await new Promise(resolve => setTimeout(resolve,250));
    for (let i=0;i<10 && current.elapsedMs<=initialTime;i++) await frame();
    assert(current.elapsedMs>initialTime,'background owner advances independently of browser commands');
    const command = {commandId:randomUUID(),sequence:before.nextSequence,command:{kind:'surrender'}};
    const ack = await call('one',`/${roomId}/commands`,command);
    assert.deepEqual(await call('one',`/${roomId}/commands`,command),ack,'lost HTTP ack retries original saved command');
    let receipt;
    for(let i=0;i<50;i++){ receipt=await call('one',`/${roomId}/receipt`); if(receipt) break; await new Promise(resolve=>setTimeout(resolve,50)); }
    assert(receipt,'background owner settles without a request-owned timer');
    assert.equal(receipt.outcome, 'loss');
    assert.equal((await call('two',`/${roomId}/receipt`)).outcome, 'win');
    assert.equal((await call('one','/'+roomId)).phase,'complete');
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM breakthrough_receipts WHERE room_id=$1',[roomId])).rows[0].n,2);
    await reader.cancel(); reader = undefined;
    await call('three','/search',{deckId:'owned',requestId:randomUUID()});
    const restarted = await call('four','/search',{deckId:'owned',requestId:randomUUID()});
    const oldView = await call('three','/'+restarted.roomId);
    controls.get(restarted.roomId)!.abort(); await workers.at(-1);
    await pool.query("UPDATE breakthrough_rooms SET lease_until=clock_timestamp()-interval '1 second',worker_wake_at='1970-01-01' WHERE room_id=$1",[restarted.roomId]);
    const recovered = await call('three','/'+restarted.roomId);
    assert.equal(recovered.roomId,oldView.roomId);
    assert(recovered.revision >= oldView.revision,'worker takeover recovers committed state');
    assert((await pool.query('SELECT owner_fence FROM breakthrough_rooms WHERE room_id=$1',[restarted.roomId])).rows[0].owner_fence >= 3);
    const last = await call('three',`/${restarted.roomId}/commands`,{commandId:randomUUID(),sequence:recovered.nextSequence,command:{kind:'surrender'}});
    assert(last.accepted);
    console.log('PASS Netlify transport: chunked private notifications, signature, single worker dispatch, auth/origin, timed stream, authoritative command retry terminal receipts, expired-lease worker takeover and stream cleanup.');
  } finally {
    controller.abort(); await reader?.cancel();
    for(const control of controls.values()) control.abort();
    await Promise.all(workers); await queue.stop();
  }
  assert.deepEqual(errors,[]);
}
