import test from 'node:test';
import assert from 'node:assert/strict';
import { createPresentationClock } from '../src/presentation-clock.js';
import { createTravelSequence, DESTINATIONS } from '../src/fast-travel.js';

test('real travel completes on schedule at one, five and sixty rendered frames per second', () => {
  for (const frameInterval of [1000, 200, 1000 / 60]) {
    const clock = createPresentationClock();
    let arrivals = 0, completions = 0, completedAt = null;
    let now = 10_000;
    const travel = createTravelSequence({ duration: 6.2, onArrive: () => { arrivals++; }, onComplete: () => { completions++; completedAt = now; } });
    travel.start(DESTINATIONS[7], [0, .13, 24.5]);
    clock.reset(now);
    for (; now <= 30_000 && travel.active; now += frameInterval) travel.advance(clock.sample(now));
    assert.equal(arrivals, 1, `${frameInterval} ms cadence grounded arrival`);
    assert.equal(completions, 1, `${frameInterval} ms cadence completion`);
    assert.ok(completedAt >= 16_200 && completedAt <= 16_200 + frameInterval + 1, `nominal6.2s trip completed at ${completedAt}`);
    assert.ok(completedAt < 30_000, 'slow rendering cannot turn the trip into a parent-watchdog failure');
  }
});
test('travel intent reset excludes time before departure and time while the previous trip was cancelled', () => {
  const clock = createPresentationClock();
  let arrivals = 0, completions = 0;
  const travel = createTravelSequence({ duration: 6.2, onArrive: () => { arrivals++; }, onComplete: () => { completions++; } });
  clock.reset(0); // Last rendered frame predates the player clicking Travel.
  clock.reset(5000); travel.start(DESTINATIONS[7], [0, .13, 24.5]);
  travel.advance(clock.sample(5200)); assert.equal(travel.elapsed, .2);
  travel.cancel();
  clock.reset(100_000); travel.start(DESTINATIONS[0], [0, .13, 24.5]);
  travel.advance(clock.sample(100_200));
  assert.equal(travel.elapsed, .2); assert.equal(arrivals, 0); assert.equal(completions, 0);
  travel.advance(clock.sample(106_200)); assert.equal(arrivals, 1); assert.equal(completions, 1);
});
test('invalid or backward timestamps cannot spend future cinematic time', () => {
  const clock = createPresentationClock(); clock.reset(1000);
  assert.equal(clock.sample(NaN), 0);
  assert.equal(clock.sample(900), 0);
  assert.equal(clock.sample(1200), .2);
  assert.equal(clock.sample(1200), 0);
});
