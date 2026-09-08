import assert from 'node:assert/strict';
import test from 'node:test';
import { PresentationTimeline, type TimerHandle } from './presentationTimeline';
import { broadcastDelay, changedDistrictControl, isReducedMotionRequested } from './broadcastPresentation';

function fakeTimers() {
  let now = 0;
  let nextId = 1;
  const jobs = new Map<number, { at: number; callback: () => void }>();
  return {
    schedule(callback: () => void, delay: number) {
      const id = nextId++;
      jobs.set(id, { at: now + delay, callback });
      return id as unknown as TimerHandle;
    },
    cancel(handle: TimerHandle) {
      jobs.delete(handle as unknown as number);
    },
    advance(ms: number) {
      now += ms;
      for (const [id, job] of [...jobs].sort((a, b) => a[1].at - b[1].at)) {
        if (job.at <= now) {
          jobs.delete(id);
          job.callback();
        }
      }
    },
    get pending() { return jobs.size; },
  };
}

test('presentation waits complete only after their configured fake time', async () => {
  const clock = fakeTimers();
  const timeline = new PresentationTimeline(clock.schedule, clock.cancel);
  let completed: boolean | undefined;
  const wait = timeline.wait(700).then(value => { completed = value; });
  clock.advance(699);
  await Promise.resolve();
  assert.equal(completed, undefined);
  clock.advance(1);
  await wait;
  assert.equal(completed, true);
});

test('cancelling invalidates and settles every stale callback', async () => {
  const clock = fakeTimers();
  const timeline = new PresentationTimeline(clock.schedule, clock.cancel);
  const first = timeline.wait(500);
  const second = timeline.wait(1200);
  timeline.cancelAll();
  assert.equal(await first, false);
  assert.equal(await second, false);
  assert.equal(clock.pending, 0);
  const fresh = timeline.wait(250);
  clock.advance(250);
  assert.equal(await fresh, true);
});

test('completing pending waits fast-forwards without invalidating the sequence', async () => {
  const clock = fakeTimers();
  const timeline = new PresentationTimeline(clock.schedule, clock.cancel);
  const generation = timeline.id;
  const first = timeline.wait(500);
  const second = timeline.wait(1200);
  timeline.completeAll();
  assert.equal(await first, true);
  assert.equal(await second, true);
  assert.equal(timeline.id, generation);
  assert.equal(clock.pending, 0);
});

test('a staged rival beat preserves travel, reveal, and slam ordering', async () => {
  const clock = fakeTimers();
  const timeline = new PresentationTimeline(clock.schedule, clock.cancel);
  const phases: string[] = [];
  const sequence = (async () => {
    phases.push('rival-thinking');
    if (!await timeline.wait(700)) return;
    phases.push('rival-travel');
    if (!await timeline.wait(350)) return;
    phases.push('rival-reveal');
    if (!await timeline.wait(350)) return;
    phases.push('rival-slam');
  })();
  clock.advance(700); await Promise.resolve();
  assert.deepEqual(phases, ['rival-thinking', 'rival-travel']);
  clock.advance(350); await Promise.resolve();
  assert.deepEqual(phases, ['rival-thinking', 'rival-travel', 'rival-reveal']);
  clock.advance(350); await sequence;
  assert.deepEqual(phases, ['rival-thinking', 'rival-travel', 'rival-reveal', 'rival-slam']);
});

test('district broadcast only fires when control changes to a player', () => {
  assert.deepEqual(changedDistrictControl(['draw', 'player', 'cpu'], ['player', 'player', 'cpu']), [0]);
  assert.deepEqual(changedDistrictControl(['player', 'cpu', 'draw'], ['player', 'cpu', 'draw']), []);
  assert.deepEqual(changedDistrictControl(['player', 'cpu', 'draw'], ['draw', 'cpu', 'draw']), []);
  assert.deepEqual(changedDistrictControl(['player', 'cpu', 'draw'], ['cpu', 'player', 'draw']), [0, 1]);
});

test('broadcast delays collapse for fast-forward and stay brief for reduced motion', () => {
  assert.equal(broadcastDelay(650, 90, false), 650);
  assert.equal(broadcastDelay(650, 90, true), 90);
  assert.equal(broadcastDelay(650, 90, false, true), 0);
  assert.equal(broadcastDelay(650, 90, true, true), 0);
});

test('the saved in-app preference enables reduced broadcast motion without an OS preference', () => {
  assert.equal(isReducedMotionRequested(false, true), true);
  assert.equal(isReducedMotionRequested(true, false), true);
  assert.equal(isReducedMotionRequested(false, false), false);
});