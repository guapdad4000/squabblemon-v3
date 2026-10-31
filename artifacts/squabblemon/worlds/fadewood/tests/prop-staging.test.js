import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { PROP_PLACEMENTS } from '../src/prop-placements.js';
import { createPropColliders, removeLegacyCar } from '../src/prop-colliders.js';
import { loadNeighborhoodProps } from '../src/neighborhood-props.js';
import { createPhysics } from '../src/physics.js';
import { createAnimeEnvironment } from '../src/anime-environment.js';
import { createEntranceDoors } from '../src/entrance-doors.js';
import { LANDMARKS, EXTRA_ENTRANCES } from '../src/landmarks.js';
import { CHARACTER_PLACEMENTS } from '../src/character-placements.js';
import { characterCameraShot } from '../src/character-interactions.js';
import { DESTINATIONS, createTravelRoute } from '../src/fast-travel.js';
import { composeArrivalView } from '../src/camera.js';
import { loadWorldGeometry } from './world-geometry.js';
import { PROP_ROOT, loadCpuGlb } from './helpers/verify-assets.mjs';

const still = new THREE.Vector3();
const near = (actual, expected, message, tolerance = 1e-5) => assert.ok(Math.abs(actual - expected) < tolerance, `${message}: ${actual} versus ${expected}`);
const legacyName = (object) => `${object.userData.name ?? ''} ${object.name}`.replaceAll('_', ' ');
const isLegacyCar = (object) => object.isMesh && /08 Parked car and basketball corner/.test(legacyName(object));
const triangleCount = (geometry) => Math.max(0, Math.min(geometry.index?.count ?? geometry.attributes.position.count, geometry.drawRange.count)) / 3;
const dataBox = (bounds) => new THREE.Box3(new THREE.Vector3(...bounds.min), new THREE.Vector3(...bounds.max));

function settle(physics, feet) {
  physics.teleport(new THREE.Vector3(...feet));
  for (let step = 0; step < 48; step += 1) physics.move(still, 0, 1 / 120);
  return physics.position.clone();
}

function footprintDistance(point, record) {
  const dx = point[0] - record.position[0], dz = point[2] - record.position[2];
  const c = Math.cos(record.yaw), s = Math.sin(record.yaw);
  // Inverse yaw, then distance to the exact local bounding rectangle.
  const x = c * dx - s * dz, z = s * dx + c * dz;
  return Math.hypot(Math.max(0, Math.abs(x) - record.localDimensions[0] / 2), Math.max(0, Math.abs(z) - record.localDimensions[2] / 2));
}

let fixturePromise;
function fixture() {
  return fixturePromise ??= (async () => {
    const scene = new THREE.Scene(), world = loadWorldGeometry();
    const collisionRoot = new THREE.Group(); scene.add(collisionRoot); collisionRoot.add(world);
    const leaves = new THREE.Texture({ width: 1, height: 1 }), panorama = new THREE.Texture({ width: 4, height: 1 });
    const environment = await createAnimeEnvironment({ world, parent: scene, textures: { leaves, panorama } });
    const legacy = removeLegacyCar(world);
    const locations = [...LANDMARKS, ...EXTRA_ENTRANCES];
    const doors = createEntranceDoors(world, locations.map((location) => ({ ...location.entry, id: location.id, name: location.name, color: location.color })));
    const props = await loadNeighborhoodProps({
      parent: scene, placements: PROP_PLACEMENTS, baseUrl: '/props/',
      loader: { async loadAsync(url) { return loadCpuGlb(await readFile(new URL(url.split('/').at(-1), PROP_ROOT))); } },
    });
    const proxies = createPropColliders(props.records); collisionRoot.add(proxies.group);
    collisionRoot.updateWorldMatrix(true, true);
    return { scene, world, collisionRoot, environment, legacy, doors, props, proxies };
  })();
}

test('five actual uploaded models get invisible yaw-aligned solid proxies rather than detailed render triangles', async () => {
  const { props, proxies, collisionRoot } = await fixture();
  assert.equal(PROP_PLACEMENTS.length, 5);
  assert.equal(proxies.meshes.length, 5);
  let triangles = 0;
  props.records.forEach((record, index) => {
    const mesh = proxies.meshes[index];
    const bounds = new THREE.Box3().setFromObject(mesh, true);
    const expected = new THREE.Box3();
    for (const x of [-.5, .5]) for (const y of [-.5, .5]) for (const z of [-.5, .5]) {
      expected.expandByPoint(new THREE.Vector3(x * record.localDimensions[0], (y + .5) * record.localDimensions[1], z * record.localDimensions[2])
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), record.yaw).add(new THREE.Vector3(...record.position)));
    }
    bounds.min.toArray().forEach((value, axis) => near(value, expected.min.getComponent(axis), `${record.id}: collision minimum axis ${axis}`));
    bounds.max.toArray().forEach((value, axis) => near(value, expected.max.getComponent(axis), `${record.id}: collision maximum axis ${axis}`));
    assert.ok(bounds.clone().expandByScalar(1e-5).containsBox(dataBox(record.worldBounds)), `${record.id}: the solid OBB encloses every visible vertex`);
    const center = new THREE.Vector3(); mesh.getWorldPosition(center);
    near(center.y, record.position[1] + record.localDimensions[1] / 2, `${record.id}: collider centre is above grounded soles`);
    const axis = new THREE.Vector3(1, 0, 0).applyQuaternion(mesh.getWorldQuaternion(new THREE.Quaternion()));
    near(axis.x, Math.cos(record.yaw), `${record.id}: long axis yaw X`);
    near(axis.z, -Math.sin(record.yaw), `${record.id}: long axis yaw Z`);
    assert.ok(!mesh.visible || !mesh.material.visible || !proxies.group.visible, `${record.id}: collision must not draw an extra box`);
    assert.notEqual(mesh.userData.noCollision, true, `${record.id}: hidden collider remains physical`);
    triangles += triangleCount(mesh.geometry);
  });
  assert.equal(triangles, 60, 'one 12-triangle OBB per prop bounds physics cost');
  assert.equal(props.stats.triangles, 49062, 'the uploaded visible geometry remains present');
  assert.ok(!collisionRoot.children.includes(props.group), 'detailed render-only geometry stays outside the physics tree');
});

test('vehicles and cart block walking while the road, garage centre lane and nine grounded arrivals stay usable', async () => {
  const { collisionRoot, props } = await fixture();
  const physics = createPhysics(collisionRoot);
  const approaches = {
    'purple-scraper': { from: [0, .13, 16.7], direction: [1, 0, 0] },
    'beige-sedan': { from: [0, .13, -17], direction: [-1, 0, 0] },
    'red-atv': { from: [13.85, .5, -38.7], direction: [0, 0, -1] },
    'yellow-dirt-bike': { from: [16.35, .5, -38.7], direction: [0, 0, -1] },
    'shopping-cart': { from: [23.2 + Math.sin(-.2) * 2, .5, 33.1 + Math.cos(-.2) * 2], direction: [-Math.sin(-.2), 0, -Math.cos(-.2)] },
  };
  for (const record of props.records) {
    const { from, direction } = approaches[record.id];
    settle(physics, from);
    for (let frame = 0; frame < 180; frame += 1) physics.move(new THREE.Vector3(...direction), 3, 1 / 60);
    const gap = footprintDistance(physics.position.toArray(), record);
    assert.ok(gap >= .315 && gap < .35, `${record.id}: the 0.32m capsule stops at the solid prop (${gap.toFixed(4)}m clearance)`);
    assert.ok(physics.position.y < record.position[1] + .04, `${record.id}: the avatar cannot step up onto a vehicle`);
    assert.ok(physics.grounded, `${record.id}: stopped avatar remains grounded`);
  }
  const atv = props.records.find((record) => record.id === 'red-atv');
  const bike = props.records.find((record) => record.id === 'yellow-dirt-bike');
  const laneLeft = atv.worldBounds.max[0], laneRight = bike.worldBounds.min[0];
  assert.ok(laneRight - laneLeft >= 1.3, 'the garage retains at least a 1.3 metre clear aisle between the two bikes');
  const laneX = (laneLeft + laneRight) / 2;
  settle(physics, [laneX, .5, -38.5]);
  for (let frame = 0; frame < 135; frame += 1) physics.move(new THREE.Vector3(0, 0, -1), 2, 1 / 60);
  assert.ok(physics.position.z < -42.65, `garage centre lane is walkable to the back (${physics.position.z})`);
  near(physics.position.x, laneX, 'walking between the props does not push the avatar sideways', .015);
  assert.ok(physics.grounded);
  settle(physics, [0, .5, -43]);
  for (let frame = 0; frame < 960; frame += 1) physics.move(new THREE.Vector3(0, 0, 1), 5, 1 / 60);
  assert.ok(physics.position.z > 35.5, 'the complete central road remains traversable');
  near(physics.position.x, 0, 'the road route remains straight', .015);
  for (const destination of DESTINATIONS) {
    const feet = settle(physics, destination.position);
    assert.ok(physics.grounded, `${destination.id}: arrival has supporting floor`);
    near(feet.x, destination.position[0], `${destination.id}: no sideways arrival correction X`);
    near(feet.z, destination.position[2], `${destination.id}: no sideways arrival correction Z`);
    assert.ok(feet.y <= destination.position[1] + .001 && feet.y >= destination.position[1] - .5, `${destination.id}: grounded arrival height remains safe`);
  }
  assert.equal(physics.resetCount, 0, 'none of the approaches, lanes or arrivals fall out of the world');
});

test('all 81 fast-travel routes and every NPC camera arc retain clear prop footprints and sight lines', async () => {
  const { collisionRoot, props, proxies } = await fixture();
  const physics = createPhysics(collisionRoot);
  const grounded = new Map(DESTINATIONS.map((destination) => [destination.id, settle(physics, destination.position)]));
  const proxyBounds = new Map(proxies.meshes.map((mesh) => [mesh.userData.propId, new THREE.Box3().setFromObject(mesh, true)]));
  const cameraSphere = new THREE.Sphere(new THREE.Vector3(), .12);
  let routes = 0, frames = 0, conversationFrames = 0;
  for (const from of DESTINATIONS) for (const to of DESTINATIONS) {
    const route = createTravelRoute(grounded.get(from.id), to, composeArrivalView(from, grounded.get(from.id)));
    route.setArrivalPosition(grounded.get(to.id), .87);
    routes += 1;
    for (let step = 0; step <= 400; step += 1) {
      const frame = route.sample(step / 400); frames += 1;
      cameraSphere.center.fromArray(frame.camera);
      for (const record of props.records) {
        assert.ok(!proxyBounds.get(record.id).intersectsSphere(cameraSphere), `${from.id} → ${to.id}: camera touches ${record.id} at ${frame.progress}`);
        assert.ok(footprintDistance(frame.position, record) > 1.5, `${from.id} → ${to.id}: dust body footprint reaches ${record.id} at ${frame.progress}`);
      }
    }
  }
  const ray = new THREE.Raycaster(), direction = new THREE.Vector3();
  for (const character of CHARACTER_PLACEMENTS) for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    for (let step = 0; step <= 20; step += 1) {
      const shot = characterCameraShot(character, step * .04, viewport); conversationFrames += 1;
      direction.copy(shot.target).sub(shot.position);
      ray.set(shot.position, direction.clone().normalize()); ray.near = 0; ray.far = direction.length();
      assert.equal(ray.intersectObjects(proxies.meshes, false).length, 0, `${character.id}: a new prop obscures the conversation camera`);
      cameraSphere.center.copy(shot.position);
      for (const record of props.records) assert.ok(!proxyBounds.get(record.id).intersectsSphere(cameraSphere), `${character.id}: conversation camera enters ${record.id}`);
    }
  }
  assert.equal(routes, 81); assert.equal(frames, 32481); assert.equal(conversationFrames, 462);
});

test('legacy car batches and the standalone floating cabin leave rendering and collision together, with reversible cleanup', async () => {
  const world = loadWorldGeometry(), scene = new THREE.Scene(); scene.add(world);
  const environment = await createAnimeEnvironment({ world, parent: scene, textures: { leaves: new THREE.Texture({ width: 1, height: 1 }), panorama: new THREE.Texture({ width: 4, height: 1 }) } });
  const legacyMeshes = [], originalTree = new Map(), resources = new Set();
  world.traverse((object) => {
    originalTree.set(object, [...object.children]);
    if (isLegacyCar(object)) legacyMeshes.push(object);
    if (object.geometry) resources.add(object.geometry);
    for (const material of object.material ? (Array.isArray(object.material) ? object.material : [object.material]) : []) resources.add(material);
  });
  assert.equal(legacyMeshes.length, 4, 'test covers every shipped car material batch, even an empty one');
  assert.ok(legacyMeshes.some((object) => /05 Faded teal/.test(legacyName(object))), 'the actual painted teal body is included');
  const cabin = world.getObjectByName('Parked car cabin').children.find((object) => object.isMesh);
  assert.ok(cabin, 'the real GLB contains a standalone cabin outside the chapter batches');
  assert.equal(triangleCount(cabin.geometry), 12);
  const cabinBounds = new THREE.Box3().setFromObject(cabin);
  near(cabinBounds.min.y, 1.125, 'the orphan cabin floats above the jail sidewalk');
  legacyMeshes.push(cabin);
  const keptParents = new Map();
  world.traverse((object) => { if (object.isMesh && !legacyMeshes.includes(object)) keptParents.set(object, object.parent); });
  let disposed = 0;
  for (const resource of resources) resource.addEventListener('dispose', () => disposed += 1);
  const expectedTriangles = legacyMeshes.reduce((sum, mesh) => sum + triangleCount(mesh.geometry), 0);
  const removal = removeLegacyCar(world);
  assert.equal(removal.removedMeshes, 5);
  assert.equal(removal.triangles, expectedTriangles);
  assert.ok(expectedTriangles > 0, 'actual car geometry is removed');
  const remaining = []; world.traverse((object) => { if (isLegacyCar(object)) remaining.push(object); });
  assert.deepEqual(remaining, [], 'all legacy car components leave both render and collision traversal');
  assert.equal(cabin.parent, null, 'the blue cabin cannot render or enter the collision traversal');
  for (const [object, parent] of keptParents) assert.equal(object.parent, parent, `${object.name}: every unrelated source mesh stays attached`);
  assert.equal(disposed, 0, 'detach preserves all shared geometry, materials and other source structures');
  removal.restore(); removal.restore();
  for (const [object, children] of originalTree) assert.deepEqual(object.children, children, `${object.name}: source child order and identities restore exactly`);
  assert.equal(disposed, 0, 'restoring is idempotent and leaves source resources alive');
  environment.dispose();
});
