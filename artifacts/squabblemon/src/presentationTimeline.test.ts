import assert from 'node:assert/strict';
import test from 'node:test';
import { PresentationTimeline, type TimerHandle } from './presentationTimeline';

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