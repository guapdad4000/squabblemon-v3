import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { loadCpuGlb } from './helpers/verify-assets.mjs';
import { loadCharacterCast } from '../src/character-cast.js';
import { ENTRANCE_CHARACTER_PLACEMENTS, ENTRANCE_PROP_PLACEMENTS } from '../src/entrance-placements.js';
import { PROP_PLACEMENTS } from '../src/prop-placements.js';
import { loadNeighborhoodProps } from '../src/neighborhood-props.js';
import { createPropColliders, removeLegacyCar } from '../src/prop-colliders.js';
import { createAnimeEnvironment } from '../src/anime-environment.js';
import { createStreetSigns } from '../src/street-signs.js';
import { createEntranceDoors } from '../src/entrance-doors.js';
import { LANDMARKS, EXTRA_ENTRANCES } from '../src/landmarks.js';
import { createPhysics } from '../src/physics.js';
import { characterCameraShot } from '../src/character-interactions.js';
import { DESTINATIONS, createTravelRoute } from '../src/fast-travel.js';
import { composeArrivalView } from '../src/camera.js';
import { loadWorldGeometry } from './world-geometry.js';

const near = (actual, expected, message, tolerance = 1e-5) => assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: ${actual} vs ${expected}`);
const loader = { async loadAsync(path) { return loadCpuGlb(await readFile(new URL(`../public/assets/${path}`, import.meta.url))); } };
let fixturePromise;
function fixture() {
  return fixturePromise ??= (async () => {
    const scene = new THREE.Scene(), world = loadWorldGeometry(), collisionRoot = new THREE.Group();
    scene.add(collisionRoot); collisionRoot.add(world);
    const removed = [];
    world.traverse((object) => {
      const name = `${object.name} ${object.userData?.name ?? ''}`;
      if (/09[ _]+Background[ _]+residents/i.test(name) || /04[ _]+Neighborhood[ _]+silhouette[ _]+and[ _]+horizon/.test(name) && /02[ _]+Warm[ _]+cream|08[ _]+Glass[ _]+petrol|13[ _]+Distance[ _]+blue/.test(name)) removed.push(object);
    });
    removed.forEach((object) => object.removeFromParent());
    const doors = createEntranceDoors(world, [...LANDMARKS, ...EXTRA_ENTRANCES].map(({ id, name, color, entry }) => ({ ...entry, id, name, color })));
    const environment = await createAnimeEnvironment({ world, parent: scene, textures: { leaves: new THREE.Texture({ width: 1, height: 1 }), panorama: new THREE.Texture({ width: 4, height: 1 }) } });
    removeLegacyCar(world);
    const props = await loadNeighborhoodProps({ parent: scene, placements: PROP_PLACEMENTS, baseUrl: 'props/', loader });
    const entranceProps = await loadNeighborhoodProps({ parent: scene, placements: ENTRANCE_PROP_PLACEMENTS, baseUrl: 'entrance-cast/', loader });
    const records = [...props.records, ...entranceProps.records];
    const proxies = createPropColliders(records); collisionRoot.add(proxies.group);
    const signs = await createStreetSigns({ parent: scene, texture: new THREE.Texture() });
    const cast = await loadCharacterCast(scene, { loader, placements: ENTRANCE_CHARACTER_PLACEMENTS, baseUrl: 'entrance-cast/' });
    scene.updateMatrixWorld(true);
    const cameraBlockers = [];
    world.traverse((mesh) => {
      if (!mesh.isMesh || !mesh.visible) return;
      mesh.material.side = THREE.DoubleSide; cameraBlockers.push(mesh);
    });
    proxies.meshes.forEach((mesh) => { mesh.material.side = THREE.DoubleSide; cameraBlockers.push(mesh); });
    signs.group.traverse((mesh) => { if (mesh.isMesh) cameraBlockers.push(mesh); });
    const wrappers = new Map(cast.group.children.map((object) => [object.userData.characterId, object]));
    const faces = new Map();
    wrappers.forEach((wrapper, id) => wrapper.traverse((object) => { if (object.isBone && object.name === 'headfront') faces.set(id, object); }));
    return { scene, world, collisionRoot, doors, environment, props, entranceProps, records, proxies, signs, cast, wrappers, faces, cameraBlockers };
  })();
}

test('three uploaded entrance actors animate for twenty seconds with grounded soles and stable anchors', async () => {
  const { cast, wrappers, faces } = await fixture();
  assert.equal(cast.stats.characters, 3); assert.equal(cast.stats.idleAnimations, 3);
  const activity = new Map(ENTRANCE_CHARACTER_PLACEMENTS.map(({ id }) => [id, 0]));
  for (const record of cast.records) {
    assert.ok(record.availableClips.includes(record.clip), `${record.id}: selected supplied clip exists`);
    assert.ok(record.footProbes > 0 && record.bones > 0 && record.skinnedMeshes > 0, `${record.id}: real supplied rig and sole probes are used`);
    assert.ok(faces.has(record.id), `${record.id}: actual animated face marker exists`);
    const placement = ENTRANCE_CHARACTER_PLACEMENTS.find(({ id }) => id === record.id);
    near(record.dimensions[1], placement.height, `${record.id}: authored height normalization`);
  }
  for (let frame = 0; frame <= 20 * 12; frame++) {
    cast.update(frame / 12);
    for (const sample of cast.sampleMotion()) {
      const placement = ENTRANCE_CHARACTER_PLACEMENTS.find(({ id }) => id === sample.id);
      activity.set(sample.id, activity.get(sample.id) + sample.activity);
      near(sample.footHeight, placement.position[1], `${sample.id}: animated soles stay on the authored floor`);
      assert.ok(Math.hypot(...sample.rootOffset) < 1e-5, `${sample.id}: supplied root motion does not carry the host away`);
      assert.deepEqual(wrappers.get(sample.id).position.toArray(), [...placement.position]);
    }
  }
  for (const [id, total] of activity) assert.ok(total > 1, `${id}: actual bone transforms changed throughout the sample`);
  for (const id of ['snitch', 'officer-oinkston']) assert.ok(ENTRANCE_CHARACTER_PLACEMENTS.find((p) => p.id === id).position[2] > 24.5 + 10, `${id}: host is behind the initial -Z-facing player`);
});

test('Cracked Head stays inside the open garage without reaching its frame, ceiling, ATV or dirt bike', async () => {
  const { cast, wrappers, records, world } = await fixture();
  const triangles = [], a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const garageArea = new THREE.Box3(new THREE.Vector3(12, .41, -44.4), new THREE.Vector3(18, 3.5, -37.9));
  world.traverse((mesh) => {
    if (!mesh.isMesh) return;
    const geometry = mesh.geometry, position = geometry.attributes.position, index = geometry.index;
    for (let vertex = 0; vertex < (index?.count ?? position.count); vertex += 3) {
      a.fromBufferAttribute(position, index ? index.getX(vertex) : vertex).applyMatrix4(mesh.matrixWorld);
      b.fromBufferAttribute(position, index ? index.getX(vertex + 1) : vertex + 1).applyMatrix4(mesh.matrixWorld);
      c.fromBufferAttribute(position, index ? index.getX(vertex + 2) : vertex + 2).applyMatrix4(mesh.matrixWorld);
      const triangle = new THREE.Triangle(a.clone(), b.clone(), c.clone());
      if (garageArea.intersectsTriangle(triangle)) triangles.push({ triangle, name: mesh.name });
    }
  });
  assert.ok(triangles.length > 0, 'actual garage ceiling and frame triangles are included');
  const nearbyProps = records.filter(({ id }) => ['red-atv', 'yellow-dirt-bike'].includes(id)).map((record) => ({ id: record.id, box: new THREE.Box3(new THREE.Vector3(...record.worldBounds.min), new THREE.Vector3(...record.worldBounds.max)) }));
  const garageActor = wrappers.get('cracked-head');
  for (let frame = 0; frame <= 20 * 12; frame++) {
    cast.update(frame / 12);
    const body = new THREE.Box3().setFromObject(garageActor, true);
    near(body.min.y, .361, 'the supplied body starts at the garage slab', .008);
    assert.ok(body.max.y < 3.0, 'animated hands and head remain below the open bay ceiling');
    assert.ok(body.min.x > 12.4 && body.max.x < 17.4 && body.min.z > -43.8 && body.max.z < -38.13, 'the complete supplied skinned body remains behind the actual open garage doorway');
    // The open doorway has a low sill. A skinned bounding box projects an
    // outstretched arm's reach down to shoe height, so test walls and lintels
    // above that sub-ankle step instead of inventing an arm/sill intersection.
    const aboveFloor = body.clone(); aboveFloor.min.y = Math.max(body.min.y + .04, .48);
    const overlap = triangles.find(({ triangle }) => aboveFloor.intersectsTriangle(triangle));
    assert.ok(!overlap, `garage frame/ceiling reaches Cracked Head at ${frame / 12}s: ${overlap?.name}, body ${JSON.stringify({ min: body.min.toArray(), max: body.max.toArray() })}`);
    for (const prop of nearbyProps) assert.ok(!body.intersectsBox(prop.box), `${prop.id}: original garage model does not intersect the new host at ${frame / 12}s`);
  }
});

test('all three animated faces and portrait close-ups clear the source town, six prop proxies and street signs', async () => {
  const { cast, faces, cameraBlockers } = await fixture();
  const camera = new THREE.PerspectiveCamera(), ray = new THREE.Raycaster();
  const viewports = [{ width: 1440, height: 900 }, { width: 390, height: 844 }];
  let samples = 0;
  for (let frame = 0; frame <= 20 * 12; frame++) {
    cast.update(frame / 12); cast.group.updateMatrixWorld(true);
    for (const placement of ENTRANCE_CHARACTER_PLACEMENTS) for (const viewport of viewports) for (const elapsed of [0, .4, .8]) {
      const target = faces.get(placement.id).getWorldPosition(new THREE.Vector3());
      const shot = characterCameraShot(placement, elapsed, viewport);
      assert.ok(shot, `${placement.id}: interaction has its own camera profile`);
      ray.set(shot.position, target.clone().sub(shot.position).normalize());
      ray.near = .01; ray.far = shot.position.distanceTo(target) - .025;
      const hit = ray.intersectObjects(cameraBlockers, false)[0];
      assert.equal(hit, undefined, `${placement.id}: animated face is hidden by ${hit?.object.name} at ${frame / 12}s (${viewport.width}px, camera arc ${elapsed})`);
      camera.position.copy(shot.position); camera.fov = shot.fov; camera.aspect = viewport.width / viewport.height;
      camera.lookAt(shot.target); camera.rotateZ(shot.roll ?? 0); camera.updateMatrixWorld(true); camera.updateProjectionMatrix();
      const ndc = target.clone().project(camera);
      const minimumY = viewport.width < viewport.height ? -.1 : -.8;
      assert.ok(ndc.z > -1 && ndc.z < 1 && Math.abs(ndc.x) < .82 && ndc.y > minimumY && ndc.y < .93, `${placement.id}: animated face stays in the visible conversation frame (${ndc.toArray()})`);
      samples++;
    }
  }
  assert.equal(samples, 4338);
});

test('six solid prop proxies preserve spawn walking and every fast-travel route around the new patrol car', async () => {
  const { collisionRoot, records, proxies } = await fixture();
  assert.equal(records.length, 6); assert.equal(proxies.meshes.length, 6);
  const patrol = records.find(({ id }) => id === 'oink-patrol');
  near(Math.max(...patrol.localDimensions.filter((_, axis) => axis !== 1)), 4.8, 'patrol car retains the requested scale');
  assert.ok(patrol.position[2] > 24.5, 'patrol car is behind spawn');
  const physics = createPhysics(collisionRoot), zero = new THREE.Vector3();
  function settle(position) {
    physics.teleport(new THREE.Vector3(...position));
    for (let step = 0; step < 48; step++) physics.move(zero, 0, 1 / 120);
    return physics.position.clone();
  }
  settle([0, .4, 24.5]);
  for (let step = 0; step < 200; step++) physics.move(new THREE.Vector3(0, 0, 1), 3, 1 / 60);
  assert.ok(physics.position.z > 34.2 && Math.abs(physics.position.x) < .02 && physics.grounded, 'the player can walk straight back from spawn toward the entrance');
  settle([0, .4, patrol.position[2]]);
  for (let step = 0; step < 180; step++) physics.move(new THREE.Vector3(1, 0, 0), 3, 1 / 60);
  assert.ok(physics.position.x > 1 && physics.position.x < patrol.worldBounds.min[0] - .31 && physics.grounded, 'the new patrol car blocks walking at its visible bounds');
  const bounds = proxies.meshes.map((mesh) => new THREE.Box3().setFromObject(mesh, true));
  const grounded = new Map(DESTINATIONS.map((destination) => [destination.id, settle(destination.position)]));
  const camera = new THREE.Vector3(); let frames = 0;
  for (const from of DESTINATIONS) for (const to of DESTINATIONS) {
    const route = createTravelRoute(grounded.get(from.id), to, composeArrivalView(from, grounded.get(from.id)));
    route.setArrivalPosition(grounded.get(to.id), .87);
    for (let frame = 0; frame <= 400; frame++) {
      const sample = route.sample(frame / 400); camera.fromArray(sample.camera);
      bounds.forEach((box, index) => assert.ok(box.distanceToPoint(camera) > .12, `${from.id}→${to.id}: camera reaches ${records[index].id} at ${frame / 400}`));
      // The fast-travel cloud follows the street centre and enters the nine
      // pre-existing arrivals; the new car must not reach its 1.5m body radius.
      const point = new THREE.Vector3(...sample.position);
      const footprint = new THREE.Vector3(point.x, Math.max(bounds[5].min.y, Math.min(bounds[5].max.y, point.y)), point.z);
      assert.ok(bounds[5].distanceToPoint(footprint) > 1.5, `${from.id}→${to.id}: travel cloud reaches Oink Patrol`);
      frames++;
    }
  }
  assert.equal(frames, 32481); assert.equal(physics.resetCount, 0);
});
