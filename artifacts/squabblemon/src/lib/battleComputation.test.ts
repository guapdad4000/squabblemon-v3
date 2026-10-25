import assert from 'node:assert/strict';
import test from 'node:test';
import { createMatch, pass, nextRound, revealCpuTurn, playTurnCard, chooseCpuPlay } from '../gameEngine';
import { previewBattlePlay } from '../battlePreview';
import { computationMatch, computeBattleJob, computePreviews } from './battleComputation';
import { BattleWorkerClient, type WorkerPort } from './battleWorkerClient';

for (const decks of [['block', 'combo'], ['combo', 'block']] as const) {
  test(`slim worker messages preserve full deterministic turns and previews: ${decks}`, () => {
    let match = createMatch(...decks);
    for (let round = 0; round < 4 && match.phase !== 'complete'; round++) {
      const input = computationMatch(match, true);
      assert.ok(input.effectLog.every(event => !('replay' in event)));
      if (match.playerHand[0]) {
        const request = { match: input, instanceId: match.playerHand[0].instanceId, squabble: round === 2, lane: 1, investment: 0 };
        assert.deepEqual(computePreviews(request), [0, 1, 2].map(lane => previewBattlePlay(match, request.instanceId, lane as 0 | 1 | 2, request.squabble)));
      }
      const choice = chooseCpuPlay({ ...match, phase: 'cpu-reveal' });
      if (choice && match.playerHand[0]) {
        const card = match.playerHand[0];
        try { match = playTurnCard(match, 'player', card.instanceId, 1); } catch { /* Some formations limit home districts. */ }
      }
      match = pass(match, 'player');
      const before = JSON.stringify(match);
      const slim = computationMatch(match);
      const result = computeBattleJob({ kind: 'rival', input: slim });
      assert.ok(!Array.isArray(result));
      assert.deepEqual({ ...result, effectLog: [...match.effectLog, ...(result as typeof match).effectLog] }, revealCpuTurn(match));
      assert.equal(JSON.stringify(match), before, 'worker projection cannot mutate authoritative local state');
      match = revealCpuTurn(match);
      if (match.phase !== 'complete') match = nextRound(match);
    }
  });
}
function fakeWorker() {
  const posted: { id: number; job: unknown }[] = [];
  let terminated = false;
  const port: WorkerPort = { onmessage: null, onerror: null, onmessageerror: null,
    postMessage: value => { posted.push(value); }, terminate: () => { terminated = true; } };
  return { port, posted, terminated: () => terminated, reply(id: number, result: unknown) { port.onmessage?.({ data: { id, result } } as MessageEvent); } };
}
const job = () => ({ kind: 'previews' as const, input: { match: createMatch('block', 'combo'), instanceId: 'none', squabble: false, lane: null, investment: 0 } });
test('rapid requests bound the worker queue, discard superseded jobs, and ignore unrelated responses', async () => {
  const fake = fakeWorker(), client = new BattleWorkerClient(() => fake.port);
  const first = client.request(job());
  const discarded = client.request(job()).catch(error => error.name);
  const latest = client.request(job());
  assert.equal(await discarded, 'AbortError');
  assert.equal(fake.posted.length, 1);
  fake.reply(999, ['wrong']); assert.equal(fake.posted.length, 1);
  fake.reply(fake.posted[0].id, ['first']); assert.deepEqual(await first, ['first']);
  assert.equal(fake.posted.length, 2);
  fake.reply(fake.posted[1].id, ['latest']); assert.deepEqual(await latest, ['latest']);
  client.dispose(); assert.ok(fake.terminated());
});
test('worker setup/runtime failures use the exact computation and disposal cancels without fallback', async () => {
  const unavailable = new BattleWorkerClient(() => { throw new Error('unsupported'); });
  assert.deepEqual(await unavailable.request(job()), [null, null, null]); unavailable.dispose();
  const fake = fakeWorker(), client = new BattleWorkerClient(() => fake.port);
  const result = client.request(job()); fake.port.onerror?.({} as ErrorEvent);
  assert.deepEqual(await result, [null, null, null]); assert.ok(fake.terminated());
  const pendingFake = fakeWorker(), pendingClient = new BattleWorkerClient(() => pendingFake.port);
  const pending = pendingClient.request(job()).catch(error => error.name);
  pendingClient.dispose(); assert.equal(await pending, 'AbortError');
  assert.equal(await pendingClient.request(job()).catch(error => error.name), 'AbortError');
});

test('a late preview never supersedes a queued rival turn in the shared session worker', async () => {
  const fake = fakeWorker(), client = new BattleWorkerClient(() => fake.port);
  const running = client.request(job());
  const rival = client.request({ kind: 'rival', input: createMatch('block', 'combo') });
  const late = client.request(job()).catch(error => error.name);
  assert.equal(await late, 'AbortError', 'only the non-authoritative late forecast is discarded');
  fake.reply(fake.posted[0].id, ['running-preview']);
  assert.deepEqual(await running, ['running-preview']);
  assert.equal((fake.posted[1].job as { kind: string }).kind, 'rival');
  const resolved = createMatch('block', 'combo');
  fake.reply(fake.posted[1].id, resolved);
  assert.deepEqual(await rival, resolved, 'rival promise must settle normally');
  client.dispose();
});
