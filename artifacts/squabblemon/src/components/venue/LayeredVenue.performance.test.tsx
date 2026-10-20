import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { LayeredVenue } from './LayeredVenue';

async function mount(t: TestContext) {
  let nextFrame = 0;
  let reads = 0;
  let resize!: () => void;
  let intersect!: (entries: { isIntersecting: boolean }[]) => void;
  let preferences!: () => void;
  let bounds = { left: 0, top: 0, right: 400, bottom: 200, width: 400, height: 200 };
  const frames = new Map<number, FrameRequestCallback>();
  const styles = new Map<string, string>();
  const node = {
    clientWidth: 400, clientHeight: 200, dataset: {},
    style: { setProperty: (key: string, value: string) => styles.set(key, value) },
    getBoundingClientRect() { reads++; return bounds; },
  };
  const window = Object.assign(new EventTarget(), { visualViewport: new EventTarget() });
  const document = Object.assign(new EventTarget(), {
    hidden: false, documentElement: { dataset: { reduceMotion: 'false' } },
  });
  const replacements: Record<string, unknown> = {
    window, document, IS_REACT_ACT_ENVIRONMENT: true,
    requestAnimationFrame: (callback: FrameRequestCallback) => { frames.set(++nextFrame, callback); return nextFrame; },
    cancelAnimationFrame: (id: number) => frames.delete(id),
    ResizeObserver: class { constructor(callback: () => void) { resize = callback; } observe() {} disconnect() {} },
    IntersectionObserver: class { constructor(callback: typeof intersect) { intersect = callback; } observe() {} disconnect() {} },
    MutationObserver: class { constructor(callback: () => void) { preferences = callback; } observe() {} disconnect() {} },
    // No network access and no authored layer fixtures are needed for pointer math.
    fetch: async () => { throw new Error('Offline fixture'); },
  };
  const original = Object.fromEntries(Object.keys(replacements).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(replacements)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(<LayeredVenue scene="fade-market" />, { createNodeMock: element => element.type === 'div' ? node : null });
  });
  t.after(async () => {
    await act(async () => renderer.unmount());
    for (const key of Object.keys(replacements)) {
      if (original[key]) Object.defineProperty(globalThis, key, original[key]!);
      else Reflect.deleteProperty(globalThis, key);
    }
  });
  return {
    renderer, window, document, styles, frames,
    get reads() { return reads; },
    get bounds() { return bounds; },
    set bounds(value) { bounds = value; },
    resize: () => resize(),
    intersect: (visible: boolean) => intersect([{ isIntersecting: visible }]),
    preferences: () => preferences(),
    pointer(x: number, y: number, pointerType = 'mouse') {
      window.dispatchEvent(Object.assign(new Event('pointermove'), { clientX: x, clientY: y, pointerType }));
    },
    frame() {
      const pending = [...frames.values()];
      frames.clear();
      for (const callback of pending) callback(nextFrame * 16);
    },
  };
}

// Original main's event/interpolation math. Compare rendered CSS values, not
// only whether a timer or function was called.
function reference() {
  let targetX = 0, targetY = 0, currentX = 0, currentY = 0, time = 0;
  let hasPointer = false;
  return {
    pointer(x: number, y: number, type = 'mouse') {
      if (type === 'touch' || x < 0 || x > 400 || y < 0 || y > 200) { hasPointer = false; return; }
      hasPointer = true;
      targetX = Math.max(-1, Math.min(1, x / 400 * 2 - 1)) * 65;
      targetY = Math.max(-1, Math.min(1, y / 200 * 2 - 1)) * 35;
    },
    frame() {
      if (!hasPointer) {
        time += 0.01;
        targetX = Math.sin(time) * 12;
        targetY = Math.cos(time * 0.8) * 8;
      }
      const ease = hasPointer ? 0.08 : 0.02;
      currentX += (targetX - currentX) * ease;
      currentY += (targetY - currentY) * ease;
      return { x: currentX + 'px', y: currentY + 'px' };
    },
  };
}

test('120 pointer events over ten frames measure layout ten times with identical displayed transforms', async t => {
  const scene = await mount(t);
  const old = reference();
  for (let frame = 0; frame < 10; frame++) {
    for (let sample = 0; sample < 12; sample++) {
      const x = 20 + frame * 20 + sample;
      const y = 30 + sample * 10;
      scene.pointer(x, y);
      old.pointer(x, y);
    }
    scene.frame();
    const expected = old.frame();
    assert.equal(scene.styles.get('--scene-x'), expected.x);
    assert.equal(scene.styles.get('--scene-y'), expected.y);
  }
  assert.equal(scene.reads, 10);
  t.diagnostic('Original: 120 getBoundingClientRect calls. Current: 10. Ten exact CSS transform pairs match.');
});

test('inside, outside, touch and idle transitions keep the original per-event behavior', async t => {
  const scene = await mount(t);
  const old = reference();
  const bursts: [number, number, string][][] = [
    [[300, 100, 'mouse'], [600, 100, 'mouse']],
    [[300, 100, 'mouse'], [200, 100, 'touch']],
    [[20, 30, 'touch'], [350, 160, 'pen']],
    [],
    [[-1, 100, 'mouse']],
    [],
  ];
  for (const burst of bursts) {
    for (const [x, y, type] of burst) { scene.pointer(x, y, type); old.pointer(x, y, type); }
    scene.frame();
    const expected = old.frame();
    assert.equal(scene.styles.get('--scene-x'), expected.x);
    assert.equal(scene.styles.get('--scene-y'), expected.y);
  }
});

test('scroll, resize, visibility and intersection changes invalidate geometry before the next pointer', async t => {
  const scene = await mount(t);
  scene.pointer(200, 100);
  scene.pointer(201, 101);
  assert.equal(scene.reads, 1);
  scene.bounds = { left: 100, top: 20, right: 500, bottom: 220, width: 400, height: 200 };
  scene.window.dispatchEvent(new Event('scroll'));
  scene.pointer(200, 100);
  assert.equal(scene.reads, 2);
  scene.resize();
  scene.pointer(200, 100);
  assert.equal(scene.reads, 3);
  scene.document.dispatchEvent(new Event('visibilitychange'));
  scene.pointer(200, 100);
  assert.equal(scene.reads, 4);
  scene.intersect(true);
  scene.pointer(200, 100);
  assert.equal(scene.reads, 5);
  for (const [target, type] of [
    [scene.window, 'resize'],
    [scene.window.visualViewport, 'resize'],
    [scene.window.visualViewport, 'scroll'],
  ] as const) {
    const previous: number = scene.reads;
    target.dispatchEvent(new Event(type));
    scene.pointer(200, 100);
    assert.equal(scene.reads, previous + 1);
  }
});

test('hidden, offscreen, reduced-motion and unmounted venues stop work and resume cleanly', async t => {
  const scene = await mount(t);
  for (const pause of ['hidden', 'offscreen', 'reduced'] as const) {
    if (pause === 'hidden') { scene.document.hidden = true; scene.document.dispatchEvent(new Event('visibilitychange')); }
    if (pause === 'offscreen') scene.intersect(false);
    if (pause === 'reduced') { scene.document.documentElement.dataset.reduceMotion = 'true'; scene.preferences(); }
    scene.frame();
    assert.equal(scene.frames.size, 0);
    const reads = scene.reads;
    scene.pointer(200, 100);
    assert.equal(scene.reads, reads);
    if (pause === 'hidden') { scene.document.hidden = false; scene.document.dispatchEvent(new Event('visibilitychange')); }
    if (pause === 'offscreen') scene.intersect(true);
    if (pause === 'reduced') { scene.document.documentElement.dataset.reduceMotion = 'false'; scene.preferences(); }
    assert.equal(scene.frames.size, 1);
    scene.frame();
    scene.pointer(200, 100);
    assert.equal(scene.reads, reads + 1);
  }
  await act(async () => scene.renderer.unmount());
  assert.equal(scene.frames.size, 0);
  const reads = scene.reads;
  scene.pointer(300, 100);
  scene.window.dispatchEvent(new Event('scroll'));
  scene.window.dispatchEvent(new Event('resize'));
  scene.window.visualViewport.dispatchEvent(new Event('scroll'));
  scene.window.visualViewport.dispatchEvent(new Event('resize'));
  scene.document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(scene.reads, reads);
  assert.equal(scene.frames.size, 0);
});
