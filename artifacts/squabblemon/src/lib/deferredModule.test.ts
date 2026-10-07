import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDeferredModule } from './deferredModule';

test('optional imports stay cold until intent and share one in-flight request', async () => {
  let calls = 0;
  let resolve!: (value: { feature: string }) => void;
  const module = createDeferredModule(() => {
    calls++;
    return new Promise<{ feature: string }>(done => { resolve = done; });
  });
  assert.equal(calls, 0);
  assert.equal(module.peek(), undefined);
  const first = module.load();
  const second = module.load();
  assert.equal(first, second);
  await Promise.resolve();
  assert.equal(calls, 1);
  const feature = { feature: 'growth' };
  resolve(feature);
  assert.equal(await first, feature);
  assert.equal(module.peek(), feature);
  assert.equal(await module.load(), feature);
  assert.equal(calls, 1);
});

test('a failed optional import retries without poisoning later opens', async () => {
  let calls = 0;
  const feature = { feature: 'mythic' };
  const module = createDeferredModule(async () => {
    if (++calls === 1) throw new Error('offline');
    return feature;
  });
  await assert.rejects(module.load(), /offline/);
  assert.equal(module.peek(), undefined);
  assert.equal(await module.load(), feature);
  assert.equal(calls, 2);
});

test('a synchronous loader failure also releases the pending request', async () => {
  let calls = 0;
  const module = createDeferredModule(() => {
    if (++calls === 1) throw new Error('not ready');
    return Promise.resolve('ready');
  });
  await assert.rejects(module.load(), /not ready/);
  assert.equal(await module.load(), 'ready');
});

test('a feature may recover the original failure without reusing its failed entry', async () => {
  const failure = new Error('original chunk failed');
  let originalCalls = 0, retryCalls = 0;
  const module = createDeferredModule(async () => {
    originalCalls++;
    throw failure;
  }, async reason => {
    assert.equal(reason, failure);
    retryCalls++;
    return 'recovered';
  });
  await assert.rejects(module.load(), /original chunk/);
  assert.equal(await module.load(), 'recovered');
  assert.equal(await module.load(), 'recovered');
  assert.equal(originalCalls, 1);
  assert.equal(retryCalls, 1);
});
