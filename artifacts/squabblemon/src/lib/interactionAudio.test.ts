import { test } from 'node:test';
import assert from 'node:assert/strict';
import { playInteractionSound, stopInteractionSound } from './interactionAudio';

test('interaction sounds stay quiet, replace each other, debounce and respect mute', () => {
  const original = globalThis.Audio;
  const played: FakeAudio[] = [];
  class FakeAudio {
    volume = 1; paused = false;
    constructor(public src: string) { played.push(this); }
    addEventListener() {}
    play() { return Promise.resolve(); }
    pause() { this.paused = true; }
  }
  globalThis.Audio = FakeAudio as unknown as typeof Audio;
  try {
    assert.equal(playInteractionSound('bag-open', false), null);
    assert.equal(played.length, 0);
    playInteractionSound('bag-open', true);
    assert.equal(played[0].volume, 0.6);
    assert.match(played[0].src, /interactions\/bag-open.mp3$/);
    assert.equal(playInteractionSound('bag-open', true), null);
    playInteractionSound('watering', true);
    assert.equal(played[0].paused, true);
    assert.equal(played.length, 2);
    stopInteractionSound();
    assert.equal(played[1].paused, true);
  } finally { globalThis.Audio = original; }
});
