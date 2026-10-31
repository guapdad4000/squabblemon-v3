import test from 'node:test';
import assert from 'node:assert/strict';
import { Raycaster, Vector3 } from 'three';
import { LANDMARKS, EXTRA_ENTRANCES } from '../src/landmarks.js';
import { createEntranceDoors } from '../src/entrance-doors.js';
import { createPhysics } from '../src/physics.js';
import { createArrivalShot, createFollowCameraRig } from '../src/camera.js';
import { loadWorldGeometry } from './world-geometry.js';

const locations = [...LANDMARKS, ...EXTRA_ENTRANCES];
const world = loadWorldGeometry();
const doors = createEntranceDoors(world, locations.map((location) => ({
  ...location.entry, id: location.id, name: location.name, color: location.color,
})));
world.updateMatrixWorld(true);
const meshes = [];
world.traverse((object) => { if (object.isMesh) meshes.push(object); });
const still = new Vector3();

function settle(physics, feet) {
  physics.teleport(new Vector3(...feet));
  for (let frame = 0; frame < 48; frame += 1) physics.move(still, 0, 1 / 120);
  return physics.position.clone();
}

function capsuleIntersections(physics) {
  const { octree, capsule } = physics.colliders;
  const candidates = [];
  octree.getCapsuleTriangles(capsule, candidates);
  return candidates.filter((triangle) => {
    const contact = octree.triangleCapsuleIntersect(capsule, triangle);
    return contact && contact.depth > 0.00001;
  }).length;
}

test('entrance hosts stand on the shipped floor without intersecting new doors', () => {
  // The tall probe includes the stand-ins' heads rather than only their feet.
  const physics = createPhysics(world, { height: 1.95 });
  const problems = [];
  for (const location of locations) {
    const feet = settle(physics, location.host.position);
    const [x, y, z] = location.host.position;
    if (!physics.grounded) problems.push(`${location.name}: unsupported host`);
    if (Math.hypot(feet.x - x, feet.z - z) > 0.015) problems.push(`${location.name}: host pushed sideways to ${feet.toArray()}`);
    if (Math.abs(feet.y - y) > 0.025) problems.push(`${location.name}: host floor is ${feet.y}, authored soles are ${y}`);
    if (capsuleIntersections(physics)) problems.push(`${location.name}: host capsule intersects building or entrance`);
  }
  assert.deepEqual(problems, []);
  assert.equal(physics.resetCount, 0);
});

test('all nine arrival points retain grounded body clearance after entrance redesign', () => {
  const physics = createPhysics(world);
  const problems = [];
  for (const location of LANDMARKS) {
    const feet = settle(physics, location.arrival.position);
    const [x, y, z] = location.arrival.position;
    if (!physics.grounded) problems.push(`${location.name}: unsupported arrival`);
    if (Math.hypot(feet.x - x, feet.z - z) > 0.00001) problems.push(`${location.name}: arrival pushed into new geometry`);
    if (feet.y > y + 0.001 || feet.y < y - 0.5) problems.push(`${location.name}: unsafe arrival floor ${feet.y}`);
    if (capsuleIntersections(physics)) problems.push(`${location.name}: arrival capsule intersects building or entrance`);
  }
  assert.deepEqual(problems, []);
  assert.equal(physics.resetCount, 0);
});

test('every complete 2.6 second arrival camera arc clears shipped geometry and new entrance props', () => {
  const physics = createPhysics(world);
  const ray = new Raycaster();
  ray.near = 0.05;
  const problems = [];
  for (const location of LANDMARKS) {
    const feet = settle(physics, location.arrival.position);
    const shot = createArrivalShot();
    const rig = createFollowCameraRig();
    shot.start(location.arrival);
    for (let frame = 0; frame <= 156; frame += 1) {
      const composition = shot.sample(frame === 0 ? 0 : 1 / 60);
      rig.aim(feet, composition.yaw, composition.pitch, 1 / 60, frame === 0, composition);
      ray.set(rig.target, rig.direction);
      ray.far = composition.distance + 0.25;
      const hit = ray.intersectObjects(meshes, false)[0];
      rig.place(composition.distance, hit?.distance, 1 / 60, frame === 0);
      if (rig.armLength < composition.distance - 0.001) {
        problems.push(`${location.name} at ${(frame / 60).toFixed(2)}s: ${hit?.object.name} retracts ${composition.distance.toFixed(2)}m arm to ${rig.armLength.toFixed(2)}m`);
        break;
      }
      assert.ok(Number.isFinite(rig.position.lengthSq()), `${location.name}: non-finite camera position`);
    }
  }
  assert.deepEqual(problems, []);
});

test('designed storefronts have solid door panels while park, dojo and garage remain open', () => {
  const ray = new Raycaster();
  const direction = new Vector3();
  for (const entrance of doors.group.children) {
    direction.set(0, 0, -1).applyQuaternion(entrance.quaternion);
    ray.set(entrance.localToWorld(new Vector3(0, 1.2, 2)), direction);
    ray.near = 0;
    ray.far = 3;
    const open = ['park', 'dojo', 'garage'].includes(entrance.userData.style);
    assert.equal(ray.intersectObjects(entrance.children, false).length === 0, open,
      `${entrance.name}: ${open ? 'central passage must stay open' : 'original facade must be covered by a door panel'}`);
  }
});
