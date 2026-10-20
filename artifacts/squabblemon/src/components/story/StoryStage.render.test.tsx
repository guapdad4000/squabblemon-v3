import assert from 'node:assert/strict';
import test, { after, type TestContext } from 'node:test';
import { act, createElement, Profiler } from 'react';
import { create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import type { StoryStageProps } from './StoryStage';

// Real React and Framer components, with only browser scheduling/media-query
// inputs supplied by the harness. No browser process, DOM shim or production
// test-only props are required to measure which subtree updates on each tick.
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
const originalActEnvironment = Object.getOwnPropertyDescriptor(globalThis, 'IS_REACT_ACT_ENVIRONMENT');
let nextTimer = 0;
const timers = new Map<number, () => void>();
const intervals: number[] = [];
const mediaListeners = new Set<() => void>();
const media = {
  matches: false,
  addEventListener: (_event: string, listener: () => void) => mediaListeners.add(listener),
};
Object.defineProperty(globalThis, 'window', { configurable: true, value: {
  matchMedia: () => media,
  addEventListener: () => {},
  removeEventListener: () => {},
  setInterval: (tick: () => void, delay: number) => {
    intervals.push(delay);
    timers.set(++nextTimer, tick);
    return nextTimer;
  },
  clearInterval: (id: number) => timers.delete(id),
} });
Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, value: true });
const { StoryStage, plainDialogueText } = await import('./StoryStage');
after(() => {
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
  else Reflect.deleteProperty(globalThis, 'window');
  if (originalActEnvironment) Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', originalActEnvironment);
  else Reflect.deleteProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT');
});

function content(node: ReactTestInstance | string): string {
  return typeof node === 'string' ? node : node.children.map(content).join('');
}
function host(renderer: ReactTestRenderer, className: string) {
  return renderer.root.find(node => typeof node.type === 'string' && node.props.className === className);
}
function button(renderer: ReactTestRenderer, label: string) {
  return renderer.root.findAllByType('button').find(node => content(node) === label)!;
}
async function click(node: ReactTestInstance, detail = 1) {
  let stopped = false;
  await act(() => node.props.onClick({ detail, stopPropagation: () => { stopped = true; } }));
  return stopped;
}
async function mountStage(t: TestContext, options: Partial<StoryStageProps> = {}, reducedMotion = false) {
  timers.clear();
  intervals.length = 0;
  media.matches = reducedMotion;
  mediaListeners.forEach(listener => listener());
  let now = 1000;
  t.mock.method(performance, 'now', () => now);
  let commits = 0;
  let renderer!: ReactTestRenderer;
  let props: StoryStageProps = {
    nodeId: 'welcome-to-the-block', section: 'pre', position: 1, total: 3,
    line: { speaker: 'Player', portraitAssetId: 'assets/characters/player.webp', text: 'One **small** *step*.' },
    onNext: () => {}, onSkip: () => {}, onClose: () => {}, ...options,
  };
  const element = () => createElement(Profiler, { id: 'stage', onRender: () => { commits += 1; } }, createElement(StoryStage, props));
  await act(() => { renderer = create(element()); });
  t.after(async () => { await act(() => renderer.unmount()); });
  return {
    renderer,
    get props() { return props; },
    get commits() { return commits; },
    setTime(value: number) { now = value; },
    async tick() {
      assert.equal(timers.size, 1, 'exactly one active reveal interval');
      now += 18;
      await act(() => { [...timers.values()][0](); });
    },
    async update(change: Partial<StoryStageProps>) {
      props = { ...props, ...change };
      await act(() => renderer.update(element()));
    },
    async unmount() { await act(() => renderer.unmount()); },
  };
}

test('character ticks update dialogue without rerendering or reparsing the scene', async t => {
  const text = '*(Quietly.)* Take **one *small* step** and keep the whole scene still.';
  const fullText = plainDialogueText(text);
  const originalMatchAll = String.prototype.matchAll;
  let parsePasses = 0;
  t.mock.method(String.prototype, 'matchAll', function (this: string, pattern: RegExp) {
    if (String(this) === text) parsePasses += 1;
    return originalMatchAll.call(this, pattern);
  });
  const stage = await mountStage(t, { line: { speaker: 'Player', portraitAssetId: 'player.webp', text } });
  const { renderer } = stage;
  const sceneClasses = ['story-stage__world', 'story-stage__header', 'story-stage__cast', 'story-stage__location', 'story-stage__speaker'];
  const initialSceneProps = sceneClasses.map(name => host(renderer, name).props);
  const initialParsePasses = parsePasses;
  const initialCommits = stage.commits;
  assert.equal(initialParsePasses, 2, 'one tokenizer invocation, with split-emphasis and token passes');
  assert.deepEqual(intervals, [18]);
  assert.equal(content(host(renderer, 'story-stage__line')), '▌');
  for (let index = 1; index <= fullText.length; index += 1) {
    await stage.tick();
    assert.equal(content(host(renderer, 'story-stage__line')), `${fullText.slice(0, index)}${index < fullText.length ? '▌' : ''}`);
    sceneClasses.forEach((name, sceneIndex) => {
      assert.equal(host(renderer, name).props, initialSceneProps[sceneIndex], `${name} props are not recreated on tick ${index}`);
    });
    assert.equal(parsePasses, initialParsePasses, 'character reveal never reparses markup');
  }
  assert.equal(stage.commits - initialCommits, fullText.length, 'measurement must observe every real React character commit');
  assert.equal(timers.size, 0);
  assert(button(renderer, 'Next →'));
  t.diagnostic(`${fullText.length} character commits; 0 scene-prop recreations and 0 additional markup parses after mount.`);
  await stage.update({ line: { ...stage.props.line }, pending: true });
  assert.equal(parsePasses, initialParsePasses, 'hydrating the same text preserves its prepared markup');
  assert.deepEqual(intervals, [18], 'hydrating a completed line never restarts the timer');
});

test('surface and native-button activation complete first and preserve the exact duplicate-tap boundary', async t => {
  let advances = 0;
  const stage = await mountStage(t, { onNext: () => { advances += 1; } });
  const { renderer } = stage;
  await stage.tick();
  const staleTick = [...timers.values()][0];
  stage.setTime(2000);
  await click(renderer.root.findByType('section'));
  assert.equal(content(host(renderer, 'story-stage__line')), plainDialogueText(stage.props.line.text));
  assert.equal(advances, 0);
  assert.equal(timers.size, 0);
  await act(() => staleTick());
  assert.equal(content(host(renderer, 'story-stage__line')), plainDialogueText(stage.props.line.text));
  stage.setTime(2179);
  assert.equal(await click(button(renderer, 'Next →'), 0), true, 'keyboard-generated button click stays isolated from scene surface');
  assert.equal(advances, 0);
  stage.setTime(2180);
  await click(button(renderer, 'Next →'), 0);
  assert.equal(advances, 1);
  assert.equal(button(renderer, 'Next →').props.type, 'button');
});

test('fresh line objects and unrelated parent updates preserve reveal and current callbacks', async t => {
  let oldAdvances = 0;
  let newAdvances = 0;
  const stage = await mountStage(t, { onNext: () => { oldAdvances += 1; } });
  await stage.tick();
  await stage.tick();
  const tick = [...timers.values()][0];
  await stage.update({ line: { ...stage.props.line }, onNext: () => { newAdvances += 1; }, error: 'Try again', historyDisabled: true });
  assert.equal([...timers.values()][0], tick);
  assert.equal(content(host(stage.renderer, 'story-stage__line')), 'On▌');
  assert.equal(content(host(stage.renderer, 'story-stage__error')), 'Try again');
  assert.equal(button(stage.renderer, 'Transcript').props.disabled, true);
  await click(button(stage.renderer, 'Complete line'), 0);
  stage.setTime(3000);
  await click(stage.renderer.root.findByType('section'));
  assert.equal(oldAdvances, 0);
  assert.equal(newAdvances, 1);
  assert.deepEqual(intervals, [18]);
});

test('line navigation, edited text, replay and unmount cancel obsolete timers', async t => {
  const stage = await mountStage(t);
  await stage.tick();
  const staleTick = [...timers.values()][0];
  await stage.update({ position: 2 });
  assert.equal(content(host(stage.renderer, 'story-stage__line')), '▌');
  await act(() => staleTick());
  assert.equal(content(host(stage.renderer, 'story-stage__line')), '▌');
  await stage.tick();
  await stage.update({ line: { ...stage.props.line, text: '**Another** line.' } });
  assert.equal(content(host(stage.renderer, 'story-stage__line')), '▌');
  await stage.tick();
  assert.equal(content(host(stage.renderer, 'story-stage__line')), 'A▌');
  await stage.update({ position: 1, line: { ...stage.props.line, text: 'One **small** *step*.' } });
  assert.equal(content(host(stage.renderer, 'story-stage__line')), '▌');
  assert.deepEqual(intervals, [18, 18, 18, 18]);
  const lastTick = [...timers.values()][0];
  await stage.unmount();
  assert.equal(timers.size, 0);
  await act(() => lastTick());
});

test('pending saves and secondary controls preserve their existing isolation and labels', async t => {
  const actions: string[] = [];
  const stage = await mountStage(t, {
    onNext: () => actions.push('next'), onSkip: () => actions.push('skip'),
    onClose: () => actions.push('close'), onHistory: () => actions.push('history'),
  });
  for (const label of ['Transcript', 'Skip scene', '← Back']) {
    assert.equal(await click(button(stage.renderer, label)), true);
    assert.equal(content(host(stage.renderer, 'story-stage__line')), '▌');
  }
  assert.deepEqual(actions, ['history', 'skip', 'close']);
  await stage.update({ pending: true });
  assert.equal(button(stage.renderer, 'Saving…').props.disabled, true);
  assert.equal(button(stage.renderer, 'Skip scene').props.disabled, true);
  await click(stage.renderer.root.findByType('section'));
  assert.equal(content(host(stage.renderer, 'story-stage__line')), '▌');
  await stage.tick();
  assert.equal(content(host(stage.renderer, 'story-stage__line')), 'O▌', 'pending saves do not pause presentation');
  await stage.update({ pending: false, position: 3 });
  await click(button(stage.renderer, 'Complete line'));
  assert(button(stage.renderer, 'Continue →'));
});

test('Motion off completes immediately; Motion on restarts the same 18 ms reveal', async t => {
  const stage = await mountStage(t);
  await stage.tick();
  const staleTick = [...timers.values()][0];
  assert.equal(await click(button(stage.renderer, 'Motion on')), true);
  assert.equal(button(stage.renderer, 'Motion off').props['aria-pressed'], true);
  assert.match(stage.renderer.root.findByType('section').props.className, /story-stage--still/);
  assert.equal(content(host(stage.renderer, 'story-stage__line')), plainDialogueText(stage.props.line.text));
  assert.equal(timers.size, 0);
  await act(() => staleTick());
  await click(button(stage.renderer, 'Motion off'));
  assert.equal(content(host(stage.renderer, 'story-stage__line')), '▌');
  assert.deepEqual(intervals, [18, 18]);
});

test('system reduced motion shows full lines without a reveal timer, including replay', async t => {
  const stage = await mountStage(t, {}, true);
  assert.equal(content(host(stage.renderer, 'story-stage__line')), plainDialogueText(stage.props.line.text));
  assert.equal(timers.size, 0);
  await stage.update({ position: 2, line: { ...stage.props.line, text: 'No **waiting**.' } });
  assert.equal(content(host(stage.renderer, 'story-stage__line')), 'No waiting.');
  await stage.update({ position: 1, line: { ...stage.props.line, text: 'Back *again*.' } });
  assert.equal(content(host(stage.renderer, 'story-stage__line')), 'Back again.');
  assert.deepEqual(intervals, []);
});
