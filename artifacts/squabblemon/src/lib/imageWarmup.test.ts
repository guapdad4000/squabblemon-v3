import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isBattleActive, setBattleActive, subscribeBattleActive, warmImages } from './imageWarmup';

test('art warmup bounds concurrency, waits for decoding, shares requests, and retries failures', async () => {
  const original = globalThis.Image;
  class TestImage {
    static instances: TestImage[] = [];
    src = ''; decoding = ''; fetchPriority = '';
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    decoded!: () => void;
    constructor() { TestImage.instances.push(this); }
    decode() { return new Promise<void>(resolve => { this.decoded = resolve; }); }
    removeAttribute() {}
  }
  globalThis.Image = TestImage as unknown as typeof Image;
  const flush = async () => { await new Promise<void>(resolve => setImmediate(resolve)); };
  try {
    let ready = false;
    const result = warmImages(['a', 'b', 'c', 'd', 'a']).then(value => { ready = true; return value; });
    const duplicate = warmImages(['a']);
    assert.equal(TestImage.instances.length, 3);
    assert.ok(TestImage.instances.every(image => image.decoding === 'async' && image.fetchPriority === 'low'));
    const [a, b, c] = TestImage.instances;
    a.onload!();
    await flush();
    assert.equal(ready, false, 'load alone does not mark decoded art ready');
    assert.equal(TestImage.instances.length, 3, 'decoding remains part of the concurrency limit');
    a.decoded();
    await flush();
    assert.equal(TestImage.instances.length, 4);
    b.onload!(); b.decoded();
    c.onerror!();
    const d = TestImage.instances[3]; d.onload!(); d.decoded();
    assert.deepEqual(await result, [true, true, false, true]);
    assert.deepEqual(await duplicate, [true]);
    assert.equal(a.onload, null, 'image callbacks are released');
    const retry = warmImages(['c']);
    const retried = TestImage.instances.at(-1)!;
    assert.notEqual(retried, c);
    retried.onload!(); retried.decoded();
    assert.deepEqual(await retry, [true]);
  } finally { globalThis.Image = original; }
});

test('menu subscribers are notified only when the battle lifecycle changes', () => {
  const snapshots: boolean[] = [];
  const unsubscribe = subscribeBattleActive(() => snapshots.push(isBattleActive()));
  setBattleActive(true);
  setBattleActive(true);
  setBattleActive(false);
  assert.equal(isBattleActive(), true, 'a mounted battle still pauses background menus');
  setBattleActive(false);
  setBattleActive(false);
  assert.deepEqual(snapshots, [true, false]);
  unsubscribe();
  setBattleActive(true);
  setBattleActive(false);
  assert.deepEqual(snapshots, [true, false], 'unmounted menus receive no events');
});
