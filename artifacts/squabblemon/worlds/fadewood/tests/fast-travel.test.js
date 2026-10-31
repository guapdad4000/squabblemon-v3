import test from 'node:test';
import assert from 'node:assert/strict';
import { DataTexture, PerspectiveCamera, Scene, Sphere, Vector3 } from 'three';
import { DESTINATIONS, createTravelRoute, createTravelSequence } from '../src/fast-travel.js';
import { createFightCloud } from '../src/fight-cloud.js';
import { composeArrivalView, createArrivalShot, createFollowCameraRig } from '../src/camera.js';
import { createPhysics } from '../src/physics.js';
import { loadWorldGeometry } from './world-geometry.js';

const near = (a, b, epsilon = 1e-8) => assert.ok(Math.abs(a - b) < epsilon, `${a} != ${b}`);

test('a trip traverses a street route before delivering one arrival and completion', () => {
  let arrivals = 0, completions = 0;
  const sequence = createTravelSequence({ onArrive: (d) => { arrivals++; assert.equal(d.id, 'dojo'); }, onComplete: () => completions++ });
  const dojo = DESTINATIONS.find((d) => d.id === 'dojo');
  assert.ok(sequence.start(dojo, [0, .13, 24.5]));
  assert.equal(sequence.start(DESTINATIONS[0]), false, 'a second click cannot overwrite an active trip');
  assert.ok(sequence.duration > 4 && sequence.duration <= 6.2);
  assert.deepEqual(sequence.sample().position, [0, .13, 24.5]);
  sequence.advance(sequence.duration * .5);
  assert.equal(arrivals, 0);
  assert.ok(sequence.sample().position[2] < 0 && sequence.sample().position[2] > dojo.position[2], 'cloud actually moves between the landmarks');
  sequence.advance(sequence.duration * .36);
  assert.equal(arrivals, 0, 'grounded avatar waits until the cloud has reached the entrance');
  sequence.advance(sequence.duration * .02);
  assert.equal(arrivals, 1);
  assert.deepEqual(sequence.sample().position, dojo.position);
  sequence.advance(sequence.duration);
  assert.equal(completions, 1); assert.equal(sequence.active, false);
  sequence.advance(5); assert.equal(arrivals, 1); assert.equal(completions, 1);
});

test('cancelled and repeated trips have no delayed arrivals or stale routes', () => {
  let arrivals = 0;
  const sequence = createTravelSequence({ onArrive: () => arrivals++ });
  sequence.start(DESTINATIONS[0], [0, .13, 24.5]); sequence.advance(.4); sequence.cancel(); sequence.advance(10);
  assert.equal(arrivals, 0); assert.equal(sequence.active, false); assert.equal(sequence.sample(), null);
  sequence.start(DESTINATIONS[1], DESTINATIONS[0].position);
  assert.deepEqual(sequence.sample().position, DESTINATIONS[0].position);
  sequence.advance(sequence.duration); assert.equal(arrivals, 1);
  sequence.start(DESTINATIONS[1], DESTINATIONS[1].position);
  near(sequence.route.distance, 0);
  sequence.advance(sequence.duration); assert.equal(arrivals, 2);
});

test('all 81 landmark routes follow the cloud, clear world geometry and land on the authored frame', () => {
  const physics = createPhysics(loadWorldGeometry());
  const sphere = new Sphere(new Vector3(), .12);
  const cloudBody = new Sphere(new Vector3(), .3);
  const grounded = new Map();
  for (const destination of DESTINATIONS) {
    physics.teleport(new Vector3(...destination.position));
    for (let step = 0; step < 48; step++) physics.move(new Vector3(), 0, 1 / 120);
    grounded.set(destination.id, physics.getRenderPosition(new Vector3()));
  }
  let largestCameraStep = 0;
  for (const from of DESTINATIONS) for (const to of DESTINATIONS) {
    const sourceView = composeArrivalView(from, grounded.get(from.id));
    const route = createTravelRoute(grounded.get(from.id), to, sourceView);
    route.setArrivalPosition(grounded.get(to.id), .87);
    let previous = route.sample(0);
    assert.deepEqual(previous.position, grounded.get(from.id).toArray());
    route.sample(1).position.forEach((value, axis) => near(value, grounded.get(to.id).getComponent(axis)));
    for (let step = 1; step <= 240; step += 1) {
      const frame = route.sample(step / 240);
      assert.ok([...frame.position, ...frame.camera, ...frame.target].every(Number.isFinite));
      if (frame.progress >= .18 && frame.progress <= .69 && route.distance >= 4) assert.ok(Math.abs(frame.camera[0]) <= 3.800001, 'tracking portion stays on the road');
      const cameraStep = Math.hypot(...frame.camera.map((n, i) => n - previous.camera[i]));
      largestCameraStep = Math.max(largestCameraStep, cameraStep);
      assert.ok(cameraStep < 1.0, `${from.id}→${to.id} camera jumped ${cameraStep}m`);
      sphere.center.set(...frame.camera);
      assert.equal(Boolean(physics.colliders.octree.sphereIntersect(sphere)), false, `${from.id}→${to.id} camera intersects world at ${frame.camera}`);
      cloudBody.center.set(frame.position[0], frame.position[1] + 1.25, frame.position[2]);
      assert.equal(Boolean(physics.colliders.octree.sphereIntersect(cloudBody)), false, `${from.id}→${to.id} cloud passes through world at ${frame.position}`);
      previous = frame;
    }
    const final = route.sample(1), expected = composeArrivalView(to, grounded.get(to.id));
    for (let axis = 0; axis < 3; axis++) { near(final.camera[axis], expected.camera[axis]); near(final.target[axis], expected.target[axis]); }
    near(final.fov, expected.fov); near(final.roll, expected.roll);
  }
  assert.ok(largestCameraStep > .01, 'camera does follow the moving effect');
});

test('all arrival floors are folded into a continuous landing and a stationary follow-rig handoff at 60/120 fps', () => {
  const physics = createPhysics(loadWorldGeometry());
  const grounded = new Map();
  for (const destination of DESTINATIONS) {
    physics.teleport(new Vector3(...destination.position));
    for (let step = 0; step < 48; step++) physics.move(new Vector3(), 0, 1 / 120);
    grounded.set(destination.id, physics.getRenderPosition(new Vector3()));
  }
  for (const fps of [60, 120]) for (const from of DESTINATIONS) for (const destination of DESTINATIONS) {
    const sourceView = composeArrivalView(from, grounded.get(from.id));
    const route = createTravelRoute(grounded.get(from.id), destination, sourceView);
    const beforeCorrection = route.sample(.87);
    route.setArrivalPosition(grounded.get(destination.id), .87);
    assert.deepEqual(route.sample(.87), beforeCorrection, 'floor resolution cannot cut the current travel frame');
    const final = route.sample(1), preceding = route.sample(1 - 1 / (fps * route.duration));
    assert.ok(Math.hypot(...final.camera.map((value, i) => value - preceding.camera[i])) < .012, 'dolly decelerates to its stationary endpoint');
    const rig = createFollowCameraRig(), shot = createArrivalShot();
    shot.start(destination, { settled: true });
    for (let frame = 0; frame < fps / 2; frame++) {
      const composition = shot.sample(1 / fps);
      rig.aim(grounded.get(destination.id), composition.yaw, composition.pitch, 1 / fps, frame === 0, composition);
      rig.place(composition.distance, undefined, 1 / fps, frame === 0);
      assert.ok(rig.position.distanceTo(new Vector3(...final.camera)) < 1e-8, `${from.id}→${destination.id} follow rig moved after handoff`);
      assert.ok(rig.target.distanceTo(new Vector3(...final.target)) < 1e-8);
      near(composition.roll, final.roll); near(composition.fov, final.fov);
    }
  }
});

test('route timing is deterministic and source camera releases smoothly', () => {
  const route = createTravelRoute([0, .13, 24.5], DESTINATIONS[0], { camera: [1, 2, 28], target: [0, 1.5, 24.5] });
  assert.deepEqual(route.sample(0).camera, [1, 2, 28]);
  assert.deepEqual(route.sample(0).target, [0, 1.5, 24.5]);
  const first = route.sample(.44); route.sample(.92);
  assert.deepEqual(route.sample(.44), first, 'backwards samples do not retain previous frame state');
  assert.deepEqual(route.sample(-1).position, route.from);
  assert.deepEqual(route.sample(2).position, route.to);
});

test('arrival cancellation prevents completion, including a single large time step', () => {
  let completion = 0, sequence;
  sequence = createTravelSequence({ onArrive: () => sequence.cancel(), onComplete: () => completion++ });
  sequence.start(DESTINATIONS[0]); sequence.advance(99);
  assert.equal(sequence.active, false); assert.equal(completion, 0);
});

test('fight cloud uses one anime atlas, moves in world space and has deterministic billboards', () => {
  const scene = new Scene();
  const texture = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  let released = 0; texture.addEventListener('dispose', () => released++);
  const cloud = createFightCloud(scene, { texture });
  const fists = cloud.group.children.filter((object) => object.name.startsWith('Anime fist sprite'));
  assert.equal(fists.length, 5);
  assert.equal(new Set(fists.map((fist) => fist.material)).size, 1);
  assert.equal(new Set(fists.map((fist) => fist.material.map)).size, 1);
  assert.ok(fists.every((fist) => fist.geometry.getAttribute('position').count === 4), 'hands are two-triangle painted cards, not finger geometry');
  assert.ok(fists.every((fist) => fist.material.alphaTest > 0 && !fist.material.transparent));
  const camera = new PerspectiveCamera(); camera.position.set(3, 4, 8); camera.lookAt(0, 1, 0);
  cloud.start(new Vector3(0, .13, 0), { duration: 6 });
  assert.equal(cloud.duration, 6);
  cloud.update(2, camera, { position: [-2, .2, -17] });
  assert.deepEqual(cloud.group.position.toArray(), [-2, .2, -17]);
  assert.ok(fists.filter((fist) => fist.visible).length >= 1 && fists.filter((fist) => fist.visible).length <= 3);
  assert.ok(fists.some((fist) => !fist.visible), 'punches retreat inside the cloud between appearances');
  const pose = fists.map((fist) => [...fist.position, ...fist.quaternion, ...fist.scale]);
  cloud.update(5.2, camera); cloud.update(2, camera);
  assert.deepEqual(fists.map((fist) => [...fist.position, ...fist.quaternion, ...fist.scale]), pose);
  cloud.update(6, camera); assert.equal(cloud.group.visible, false);
  cloud.start(new Vector3(2, .13, 8), { duration: 3 });
  assert.equal(cloud.group.visible, true); assert.deepEqual(cloud.group.position.toArray(), [2, .13, 8]);
  cloud.stop(); assert.equal(cloud.group.visible, false);
  cloud.dispose(); assert.equal(scene.children.length, 0); assert.equal(released, 1);
});
