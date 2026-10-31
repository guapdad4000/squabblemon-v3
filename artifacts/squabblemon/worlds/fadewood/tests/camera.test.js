import test from 'node:test';
import assert from 'node:assert/strict';
import { safeArmDistance } from '../src/camera.js';
test('camera stays in front of a wall inside the old half-metre minimum', () => {
  const length = safeArmDistance(4.8, 0.32);
  assert.ok(length < 0.32);
  assert.ok(Math.abs(length - 0.14) < 1e-8);
});
test('camera can recover its full orbit without extending past the requested zoom', () => {
  assert.equal(safeArmDistance(4.8, undefined), 4.8);
  assert.equal(safeArmDistance(2.3, 8), 2.3);
  assert.equal(safeArmDistance(4.8, 1.5), 1.32);
});

import { Vector3 } from 'three';
import { createFollowCameraRig, createArrivalShot, composeArrivalView } from '../src/camera.js';
test('unobstructed sprinting has a stable arm and no periodic follow snaps', () => {
  const rig = createFollowCameraRig();
  const player = new Vector3(0, .1, 24.5);
  rig.aim(player, 0, .24, 1 / 60, true);
  rig.place(4.8, undefined, 1 / 60, true);
  let maximumStep = 0;
  const previous = rig.position.clone();
  for (let i = 0; i < 600; i++) {
    player.z -= 5.2 / 60;
    rig.aim(player, 0, .24, 1 / 60);
    rig.place(4.8, undefined, 1 / 60);
    maximumStep = Math.max(maximumStep, rig.position.distanceTo(previous));
    assert.ok(Math.abs(rig.position.distanceTo(rig.target) - 4.8) < 1e-8);
    previous.copy(rig.position);
  }
  assert.ok(maximumStep < 5.2 / 60 + 1e-7, `follow camera jumped ${maximumStep}m`);
});
test('small ground variations are filtered without following animated head bob', () => {
  const rig = createFollowCameraRig(); const player = new Vector3(0, .1, 0);
  rig.aim(player, 0, .24, 1 / 60, true); rig.place(4.8, undefined, 1 / 60, true);
  let previous = rig.position.y, peak = 0;
  for (let i = 0; i < 120; i++) {
    player.y = i % 2 ? .098 : .085;
    rig.aim(player, 0, .24, 1 / 60); rig.place(4.8, undefined, 1 / 60);
    peak = Math.max(peak, Math.abs(rig.position.y - previous)); previous = rig.position.y;
  }
  assert.ok(peak < .004, `vertical camera jitter ${peak}m`);
});
test('obstruction retracts safely and clearing it eases outward', () => {
  const rig = createFollowCameraRig();
  rig.aim(new Vector3(), 0, .24, 1 / 60, true); rig.place(4.8, undefined, 1 / 60, true);
  rig.place(4.8, .32, 1 / 60); assert.ok(rig.armLength <= .141);
  rig.place(4.8, undefined, 1 / 60);
  assert.ok(rig.armLength > .14 && rig.armLength < 1);
});

test('authored shoulder composition shifts along camera-right and returns smoothly to free roam', () => {
  const rig = createFollowCameraRig();
  rig.aim(new Vector3(4, .3, 8), Math.PI / 2, .1, 1 / 60, true, { targetHeight: 1.4, shoulder: .8 });
  rig.place(5.6, undefined, 1 / 60, true);
  assert.ok(rig.target.distanceTo(new Vector3(4, 1.7, 7.2)) < 1e-9);
  const before = rig.target.clone();
  rig.aim(new Vector3(4, .3, 8), Math.PI / 2, .1, 1 / 60);
  assert.ok(rig.target.z > before.z && rig.target.z < 8, 'composition should ease back instead of snapping');
  assert.ok(rig.target.y < before.y && rig.target.y > 1.48);
});

test('arrival dolly settles once and input cancellation cannot restart it', () => {
  const shot = createArrivalShot();
  shot.start({ yaw: .7, pitch: .1, distance: 5.6, roll: -.025, shoulder: .6, targetHeight: 1.4, fov: 58 });
  const start = shot.sample();
  const middle = shot.sample(1.3);
  const end = shot.sample(1.3);
  assert.ok(start.distance > middle.distance && middle.distance > end.distance);
  assert.equal(end.distance, 5.6);
  assert.equal(end.yaw, .7);
  assert.equal(shot.settled, true);
  assert.deepEqual(shot.sample(10), end);
  shot.cancel();
  assert.equal(shot.sample(10), null);
  assert.equal(shot.active, false);
});

test('travel can hand off directly to the exact authored shoulder frame without restarting its dolly', () => {
  const preset = { position: [7.5, .371, -18.8], yaw: -1.12, pitch: .11, distance: 5.9, targetHeight: 1.35, shoulder: -.2, roll: -.022, fov: 62 };
  const view = composeArrivalView(preset), shot = createArrivalShot(), rig = createFollowCameraRig();
  shot.start(preset, { settled: true });
  assert.equal(shot.settled, true);
  const composed = shot.sample();
  rig.aim(new Vector3(...preset.position), composed.yaw, composed.pitch, 0, true, composed);
  rig.place(composed.distance, undefined, 0, true);
  assert.ok(rig.position.distanceTo(new Vector3(...view.camera)) < 1e-10);
  assert.ok(rig.target.distanceTo(new Vector3(...view.target)) < 1e-10);
  assert.equal(composed.roll, view.roll); assert.equal(composed.fov, view.fov);
  assert.deepEqual(shot.sample(2), composed, 'completion cannot introduce a second dolly');
});
