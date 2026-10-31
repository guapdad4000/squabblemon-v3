import test from 'node:test';
import assert from 'node:assert/strict';
import { DataTexture, PerspectiveCamera, Scene, Vector3 } from 'three';
import { createFightCloud, sampleFistCycle } from '../src/fight-cloud.js';

test('each painted hand emerges, strikes, retracts and becomes fully hidden between punches', () => {
  const before = sampleFistCycle(.09, 0);
  const emerging = sampleFistCycle(.16, 0);
  const extended = sampleFistCycle(.35, 0);
  const retracting = sampleFistCycle(.60, 0);
  const hidden = sampleFistCycle(1.0, 0);
  assert.equal(before.opacity, 0);
  assert.ok(emerging.opacity > 0 && emerging.opacity < 1);
  assert.ok(emerging.extension > 0 && emerging.extension < extended.extension);
  assert.ok(extended.opacity > .99 && extended.extension > .99 && extended.impact > .9);
  assert.ok(retracting.opacity > 0 && retracting.opacity < 1);
  assert.ok(retracting.extension > 0 && retracting.extension < extended.extension);
  assert.equal(hidden.opacity, 0);
  assert.equal(hidden.extension, 0);
  assert.equal(hidden.visible, false);
});

test('the five hands are staggered, with at most three exposed and real hidden intervals for every hand', () => {
  const visibleFrames = [0, 0, 0, 0, 0];
  const hiddenFrames = [0, 0, 0, 0, 0];
  for (let frame = 0; frame <= 1800; frame += 1) {
    const samples = visibleFrames.map((_, index) => sampleFistCycle(frame / 120, index));
    assert.ok(samples.filter((sample) => sample.visible).length <= 3);
    samples.forEach((sample, index) => {
      assert.ok([sample.phase, sample.extension, sample.opacity, sample.impact].every(Number.isFinite));
      assert.ok(sample.extension >= 0 && sample.extension <= 1 && sample.opacity >= 0 && sample.opacity <= 1);
      if (sample.visible) visibleFrames[index] += 1;
      else hiddenFrames[index] += 1;
    });
  }
  assert.ok(visibleFrames.every((frames) => frames > 300));
  assert.ok(hiddenFrames.every((frames) => frames > 800));
});

test('cycle sampling is independent of playback direction and handles invalid clocks without NaNs', () => {
  for (let index = 0; index < 5; index += 1) {
    const earlier = sampleFistCycle(2.123, index);
    sampleFistCycle(10000, index);
    assert.deepEqual(sampleFistCycle(2.123, index), earlier);
    for (const value of [NaN, Infinity, -Infinity, -4]) {
      assert.deepEqual(sampleFistCycle(value, index), sampleFistCycle(0, index));
    }
  }
});

test('real cards change alpha coverage and retreat behind opaque dust while sharing one atlas material', () => {
  const scene = new Scene();
  const texture = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  const cloud = createFightCloud(scene, { texture });
  const camera = new PerspectiveCamera();
  camera.position.set(3, 4, 8); camera.lookAt(0, 1, 0);
  const cards = cloud.group.children.filter((object) => object.name.startsWith('Anime fist sprite'));
  assert.equal(new Set(cards.map((card) => card.material)).size, 1);
  assert.ok(cards.every((card) => card.material.map === texture && card.material.alphaHash && card.material.depthWrite && !card.material.transparent));
  cloud.start(new Vector3(0, .13, 0), { duration: 6 });
  cloud.update(.16, camera);
  const emergence = cards[0].geometry.getAttribute('fistOpacity').getX(0);
  assert.ok(emergence > 0 && emergence < 1);
  cloud.update(.35, camera);
  assert.ok(cards[0].geometry.getAttribute('fistOpacity').getX(0) > .99);
  const extended = cards[0].position.clone();
  const maxDepth = cards[0].userData.depth;
  cloud.update(.60, camera);
  assert.ok(cards[0].userData.depth < maxDepth, 'retraction physically sinks into dust');
  assert.ok(cards[0].position.distanceTo(extended) > .3);
  assert.ok(cards[0].geometry.getAttribute('fistOpacity').getX(0) > 0 && cards[0].geometry.getAttribute('fistOpacity').getX(0) < 1);
  cloud.update(1.0, camera);
  assert.equal(cards[0].visible, false);
  assert.equal(cards[0].geometry.getAttribute('fistOpacity').getX(0), 0);
  cloud.update(2, camera);
  const pose = cards.map((card) => [...card.position, ...card.quaternion, ...card.scale, card.visible, card.userData.opacity]);
  cloud.update(5.2, camera); cloud.update(2, camera);
  assert.deepEqual(cards.map((card) => [...card.position, ...card.quaternion, ...card.scale, card.visible, card.userData.opacity]), pose);
  cloud.dispose();
});
