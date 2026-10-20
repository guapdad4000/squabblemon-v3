import assert from "node:assert/strict";
import test from "node:test";
import { createWaffleAudio, type WaffleSound } from "./waffleAudio";

class FakeOscillator {
  type = "";
  frequency = { value: 0 };
  connected: FakeGain | null = null;
  starts: number[] = [];
  stops: (number | undefined)[] = [];
  disconnects = 0;
  onended: (() => void) | null = null;
  connect(gain: FakeGain) { this.connected = gain; }
  disconnect() { this.disconnects++; }
  start(at: number) { this.starts.push(at); }
  stop(at?: number) { this.stops.push(at); }
  end() { this.onended?.(); }
}
class FakeGain {
  gain = { value: 1 };
  disconnects = 0;
  connect() {}
  disconnect() { this.disconnects++; }
}
class FakeContext {
  state = "running";
  currentTime = 10;
  destination = {};
  gains: FakeGain[] = [];
  oscillators: FakeOscillator[] = [];
  resumes = 0;
  closes = 0;
  resume() { this.resumes++; this.state = "running"; return Promise.resolve(); }
  close() { this.closes++; this.state = "closed"; return Promise.resolve(); }
  createGain() { const gain = new FakeGain(); this.gains.push(gain); return gain; }
  createOscillator() { const oscillator = new FakeOscillator(); this.oscillators.push(oscillator); return oscillator; }
}

test("all five sounds retain notes, square wave, gain, spacing and duration on one context", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const context = new FakeContext();
  let created = 0;
  const audio = createWaffleAudio(() => { created++; return context as unknown as AudioContext; });
  const expected: Record<WaffleSound, number[]> = {
    hop: [440, 660, 880], win: [523, 659, 784, 1046],
    battle: [196, 147, 98], end: [330, 247, 165], move: [220, 110],
  };
  for (const [kind, frequencies] of Object.entries(expected)) {
    const start = context.oscillators.length;
    audio.play(kind as WaffleSound, true);
    assert.equal(context.gains.at(-1)?.gain.value, 0.025);
    const oscillators = context.oscillators.slice(start);
    assert.deepEqual(oscillators.map((oscillator) => oscillator.frequency.value), frequencies);
    oscillators.forEach((oscillator, i) => {
      assert.equal(oscillator.type, "square");
      assert.equal(oscillator.connected, context.gains.at(-1));
      assert.deepEqual(oscillator.starts, [10 + i * 0.075]);
      assert.deepEqual(oscillator.stops, [10 + i * 0.075 + 0.065]);
    });
  }
  assert.equal(created, 1, "context is reused instead of opening five audio devices");
  assert.equal(context.closes, 0);
  audio.dispose();
  assert.equal(context.closes, 0, "exit does not cut off scheduled notes");
  t.mock.timers.tick(400);
  assert.equal(context.closes, 1);
  assert.ok(context.gains.every((gain) => gain.disconnects === 1));
  assert.ok(context.oscillators.every((oscillator) => oscillator.disconnects === 1 && oscillator.onended === null));
});

test("overlapping sounds own independent graphs and disconnect immediately after their last note", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const context = new FakeContext();
  const audio = createWaffleAudio(() => context as unknown as AudioContext);
  audio.play("hop", true);
  audio.play("win", true);
  for (const oscillator of context.oscillators.slice(0, 2)) oscillator.end();
  assert.equal(context.gains[0].disconnects, 0);
  context.oscillators[2].end();
  assert.equal(context.gains[0].disconnects, 1);
  assert.equal(context.gains[1].disconnects, 0, "finishing a hop does not cut off the win sound");
  for (const oscillator of context.oscillators.slice(3)) oscillator.end();
  assert.equal(context.gains[1].disconnects, 1);
  t.mock.timers.tick(1000);
  assert.ok(context.oscillators.every((oscillator) => oscillator.disconnects === 1));
  assert.equal(context.closes, 0, "finishing notes leaves the context ready for the next gesture");
  audio.dispose();
});

test("mute creates no context; gesture unlock resumes suspended/interrupted audio and cleanup permits remount", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const contexts: FakeContext[] = [];
  const audio = createWaffleAudio(() => {
    const context = new FakeContext();
    context.state = "suspended";
    contexts.push(context);
    return context as unknown as AudioContext;
  });
  audio.play("hop", false);
  assert.equal(contexts.length, 0);
  audio.unlock();
  assert.equal(contexts.length, 1);
  assert.equal(contexts[0].resumes, 1);
  contexts[0].state = "interrupted";
  audio.unlock();
  assert.equal(contexts[0].resumes, 2);
  audio.play("move", true);
  audio.dispose();
  audio.dispose();
  assert.equal(contexts[0].closes, 0);
  audio.unlock();
  assert.equal(contexts.length, 2);
  t.mock.timers.tick(250);
  assert.equal(contexts[0].closes, 1);
  audio.dispose();
});

test("suspended notes expire at the original wall-clock cutoff without closing the reusable context", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const context = new FakeContext();
  context.state = "suspended";
  context.resume = () => Promise.reject(new Error("gesture required"));
  const audio = createWaffleAudio(() => context as unknown as AudioContext);
  audio.play("hop", true);
  await Promise.resolve();
  t.mock.timers.tick(324);
  assert.equal(context.gains[0].disconnects, 0);
  t.mock.timers.tick(1);
  assert.equal(context.gains[0].disconnects, 1);
  assert.ok(context.oscillators.every((oscillator) => oscillator.disconnects === 1 && oscillator.stops.at(-1) === undefined));
  assert.equal(context.closes, 0);
  audio.dispose();
});

test("unavailable audio and failed graph creation leave silent gameplay usable", () => {
  const absent = createWaffleAudio(() => null);
  assert.doesNotThrow(() => { absent.unlock(); absent.play("hop", true); absent.dispose(); });
  const blocked = createWaffleAudio(() => { throw new Error("audio unavailable"); });
  assert.doesNotThrow(() => { blocked.unlock(); blocked.play("win", true); blocked.dispose(); });
  const context = new FakeContext();
  context.createOscillator = () => { throw new Error("audio unavailable"); };
  const partial = createWaffleAudio(() => context as unknown as AudioContext);
  assert.doesNotThrow(() => partial.play("battle", true));
  assert.equal(context.gains[0].disconnects, 1);
  partial.dispose();
});

test("exit preserves the final notes, then closes only their detached context", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const contexts: FakeContext[] = [];
  const audio = createWaffleAudio(() => {
    const context = new FakeContext();
    contexts.push(context);
    return context as unknown as AudioContext;
  });
  audio.play("win", true);
  audio.dispose();
  assert.equal(contexts[0].closes, 0);
  assert.ok(contexts[0].oscillators.every((oscillator) => oscillator.stops.length === 1 && !oscillator.disconnects));
  audio.play("hop", true);
  assert.equal(contexts.length, 2, "remount gets a new context while the previous tail finishes");
  contexts[0].oscillators.slice(0, -1).forEach((oscillator) => oscillator.end());
  assert.equal(contexts[0].closes, 0);
  contexts[0].oscillators.at(-1)!.end();
  assert.equal(contexts[0].closes, 1);
  assert.equal(contexts[1].closes, 0);
  audio.dispose();
  t.mock.timers.tick(325);
  assert.equal(contexts[1].closes, 1);
});
