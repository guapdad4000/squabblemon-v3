import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { existsSync } from "node:fs";
import {
  chooseLevelUpVoice,
  LEVEL_UP_VOICES,
  playEventVoice,
} from "./eventVoice";
import { FEEDBACK_CHANGE_EVENT } from "../battleFeedback";
const tick = () => new Promise((resolve) => setImmediate(resolve));
function environment(t: TestContext, ogg = true, enabled = true) {
  const instances: FakeAudio[] = [];
  const document = Object.assign(new EventTarget(), {
    hidden: false,
    createElement: () => ({ canPlayType: () => (ogg ? "probably" : "") }),
  });
  const window = new EventTarget();
  class FakeAudio extends EventTarget {
    paused = true;
    volume = 1;
    preload = "";
    plays = 0;
    constructor(public src: string) {
      super();
      instances.push(this);
    }
    play() {
      this.plays++;
      this.paused = false;
      return Promise.resolve();
    }
    pause() {
      this.paused = true;
    }
    removeAttribute() {
      this.src = "";
    }
    load() {}
    end() {
      this.paused = true;
      this.dispatchEvent(new Event("ended"));
    }
  }
  for (const [key, value] of Object.entries({
    window,
    document,
    Audio: FakeAudio,
    localStorage: { getItem: () => JSON.stringify({ audioEnabled: enabled }) },
  })) {
    const old = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, value });
    t.after(() => {
      if (old) Object.defineProperty(globalThis, key, old);
      else Reflect.deleteProperty(globalThis, key);
    });
  }
  return { instances, document, window, FakeAudio };
}

test("level-ups select one of three independent supplied recordings", async (t) => {
  const e = environment(t);
  const selected = [0, 0.34, 0.67].map((value) =>
    chooseLevelUpVoice(() => value),
  );
  assert.deepEqual(selected, LEVEL_UP_VOICES);
  for (const name of [
    ...LEVEL_UP_VOICES,
    "training-welcome",
    "friendly-fade",
  ]) {
    for (const extension of ["ogg", "m4a"])
      assert(
        existsSync(`public/audio/voice/dr-fade/events/${name}.${extension}`),
      );
  }
  const stop = playEventVoice(chooseLevelUpVoice(() => 0.5));
  t.after(stop);
  await tick();
  assert.equal(e.instances.length, 1);
  assert.match(e.instances[0].src, /level-hands\.ogg$/);
  e.instances[0].end();
  await tick();
  e.document.dispatchEvent(new Event("pointerup"));
  await tick();
  assert.equal(
    e.instances.length,
    1,
    "ending a line never queues another level-up line",
  );
  assert.equal(e.instances[0].plays, 1);
});

test("a new screen stops the old cue and old cleanup cannot stop the new one", async (t) => {
  const e = environment(t, false);
  const first = playEventVoice("training-welcome");
  await tick();
  const second = playEventVoice("friendly-fade");
  t.after(second);
  await tick();
  assert(e.instances[0].paused);
  assert.match(e.instances[1].src, /friendly-fade\.m4a$/);
  first();
  assert.equal(e.instances[1].paused, false);
  second();
  e.document.dispatchEvent(new Event("pointerup"));
  await tick();
  assert(e.instances.every((audio) => audio.paused));
  assert.equal(e.instances[1].plays, 1);
});

test("muted players hear no cue; muting or backgrounding discards unfinished speech", async (t) => {
  const e = environment(t);
  const stop = playEventVoice("level-pressure");
  t.after(stop);
  await tick();
  e.window.dispatchEvent(
    new CustomEvent(FEEDBACK_CHANGE_EVENT, { detail: { audioEnabled: false } }),
  );
  e.document.dispatchEvent(new Event("pointerup"));
  await tick();
  assert(e.instances[0].paused);
  assert.equal(e.instances[0].plays, 1);
  const next = playEventVoice("friendly-fade");
  t.after(next);
  await tick();
  e.document.hidden = true;
  e.document.dispatchEvent(new Event("visibilitychange"));
  e.document.hidden = false;
  e.document.dispatchEvent(new Event("pointerup"));
  await tick();
  assert(e.instances[1].paused);
  assert.equal(e.instances[1].plays, 1);
});

test("initial mute skips creating audio", (t) => {
  const e = environment(t, true, false);
  t.after(playEventVoice("training-welcome"));
  assert.equal(e.instances.length, 0);
});

test("autoplay rejection retries the same line once and never resurrects it after leaving", async (t) => {
  const e = environment(t);
  const nativePlay = e.FakeAudio.prototype.play;
  e.FakeAudio.prototype.play = function () {
    this.plays++;
    return Promise.reject(new DOMException("Needs gesture", "NotAllowedError"));
  };
  const stop = playEventVoice("level-good-money");
  t.after(stop);
  await tick();
  assert(e.instances[0].paused);
  e.FakeAudio.prototype.play = nativePlay;
  e.document.dispatchEvent(new Event("pointerup"));
  await tick();
  assert.equal(e.instances.length, 1);
  assert.equal(e.instances[0].plays, 2);
  e.document.dispatchEvent(new Event("keydown"));
  await tick();
  assert.equal(e.instances[0].plays, 2);
  stop();
  e.document.dispatchEvent(new Event("pointerup"));
  await tick();
  assert(e.instances[0].paused);
  assert.equal(e.instances[0].plays, 2);
});
