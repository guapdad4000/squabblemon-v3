import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { setBattleActive, warmImages } from './imageWarmup';

function images(t: TestContext) {
  const original = globalThis.Image;
  class TestImage {
    static created: TestImage[] = [];
    src = '';
    decoding = '';
    fetchPriority = '';
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    decoded!: () => void;
    removed = false;
    constructor() { TestImage.created.push(this); }
    decode() { return new Promise<void>(resolve => { this.decoded = resolve; }); }
    removeAttribute(name: string) { assert.equal(name, 'src'); this.removed = true; }
    ready() { this.onload!(); this.decoded(); }
  }
  globalThis.Image = TestImage as unknown as typeof Image;
  t.after(() => { globalThis.Image = original; });
  return TestImage;
}
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };

test('loading protection: immediate work, exact timeout, decode gate and retry remain intact', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const Image = images(t);
  let settled = false;
  const result = warmImages(['deadline-a', 'deadline-b', 'deadline-c', 'deadline-d']).then(value => {
    settled = true; return value;
  });
  assert.equal(Image.created.length, 3, 'warmup starts immediately, not at a later idle/tap');
  Image.created[0].onload!();
  await flush();
  assert.equal(Image.created.length, 3, 'loaded-but-undecoded art retains its slot');
  assert.equal(settled, false);
  Image.created[0].decoded();
  await flush();
  assert.equal(Image.created.length, 4);
  Image.created[3].ready();
  await flush();
  t.mock.timers.tick(7999);
  await flush();
  assert.equal(settled, false);
  t.mock.timers.tick(1);
  assert.deepEqual(await result, [true, false, false, true]);
  assert.equal(Image.created[1].removed, true);
  assert.equal(Image.created[2].removed, true);
  assert.ok(Image.created.every(image => image.onload === null && image.onerror === null));
  const retry = warmImages(['deadline-b']);
  assert.equal(Image.created.length, 5, 'failed work can retry without a poisoned cache');
  Image.created[4].ready();
  assert.deepEqual(await retry, [true]);
});

test('loading protection: battle scheduling and queue bounds do not move work to a click', async t => {
  const Image = images(t);
  setBattleActive(true);
  try {
    const sources = Array.from({ length: 67 }, (_, index) => `battle-queue-${index}`);
    const result = warmImages(sources);
    assert.equal(Image.created.length, 1, 'battle retains its original one-request allowance');
    const duplicate = warmImages([sources[0]]);
    assert.equal(Image.created.length, 1);
    Image.created[0].ready();
    await flush();
    assert.equal(Image.created.length, 2);
    assert.deepEqual(await duplicate, [true]);
    setBattleActive(false);
    assert.equal(Image.created.length, 4, 'queued work resumes immediately on battle exit');
    let completed = 1;
    while (completed < Image.created.length) {
      Image.created[completed++].ready();
      await flush();
    }
    assert.equal(Image.created.length, 65, 'one active plus the existing 64 pending bound');
    assert.deepEqual(await result, [...Array<boolean>(65).fill(true), false, false]);
    assert.ok(Image.created.every(image => image.decoding === 'async' && image.fetchPriority === 'low'));
  } finally {
    setBattleActive(false);
    for (const image of Image.created) image.onerror?.();
  }
});
