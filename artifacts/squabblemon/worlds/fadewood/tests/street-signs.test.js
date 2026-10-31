import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createStreetSigns, STREET_SIGN_POSTS, STREET_SIGN_BLADES } from '../src/street-signs.js';
import { createPhysics } from '../src/physics.js';
import { createAnimeEnvironment } from '../src/anime-environment.js';
import { DESTINATIONS, createTravelRoute } from '../src/fast-travel.js';
import { composeArrivalView } from '../src/camera.js';
import { loadWorldGeometry } from './world-geometry.js';

test('two street-name blades at both junction corners stay legible from opposing approaches', async () => {
  const signs = await createStreetSigns({ texture: new THREE.Texture() });
  const world = loadWorldGeometry(); world.updateMatrixWorld(true);
  world.traverse((object) => { if (object.isMesh) object.material.side = THREE.DoubleSide; });
  const ray = new THREE.Raycaster();
  const directions = { 'Catch Lane': [[0, 2.5, 24.5], [0, 2.5, 43]], 'Hands Ave': [[-16, 2.5, 38], [16, 2.5, 38]] };
  signs.group.updateMatrixWorld(true);
  const faceMesh = signs.group.children.find((mesh) => /readable faces/.test(mesh.name));
  for (const post of STREET_SIGN_POSTS) for (const [name, approaches] of Object.entries(directions)) {
    for (const origin of approaches) {
      const panels = signs.manifest.panels.filter((panel) => panel.postId === post.id && panel.name === name);
      const panel = panels.find((candidate) => {
        const normal = new THREE.Vector3(Math.sin(candidate.yaw), 0, Math.cos(candidate.yaw));
        return normal.dot(new THREE.Vector3(...origin).sub(new THREE.Vector3(...candidate.position))) > 0;
      });
      assert.ok(panel, `${name}: approach has a front-facing version of the lettering`);
      const target = new THREE.Vector3(...panel.position);
      const from = new THREE.Vector3(...origin);
      ray.set(from, target.clone().sub(from).normalize());
      ray.far = from.distanceTo(target) - .001;
      assert.equal(ray.intersectObject(world, true).length, 0, `${post.id} ${name}: authored buildings do not hide the approach`);
      ray.far += .003;
      const face = ray.intersectObject(faceMesh, false);
      assert.ok(face.length > 0, `${name}: the outward-facing lettered plane is actually visible`);
      assert.ok(face[0].uv.x > .1 && face[0].uv.x < .9, `${name}: the readable center stays inside its UV crop`);
      assert.equal(panel.size[0], 2.9, 'street-size lettering fills a nearly three-metre plaque');
    }
  }
  signs.dispose();
});

test('real-world capsule routes retain junction and entrance clearance below overhead blades', async () => {
  const world = loadWorldGeometry();
  // Match main.js: source proxy residents leave the collision tree when the
  // supplied GLBs replace them. They must not create imaginary street bumps.
  const oldResidents = [];
  world.traverse((object) => { if (/09[ _]+Background[ _]+residents/i.test(`${object.name} ${object.userData?.name ?? ''}`)) oldResidents.push(object); });
  oldResidents.forEach((object) => object.removeFromParent());
  const environment = await createAnimeEnvironment({ world, parent: new THREE.Scene(), textures: { leaves: new THREE.Texture({ width: 1, height: 1 }), panorama: new THREE.Texture({ width: 4, height: 1 }) } });
  const physics = createPhysics(world);
  const still = new THREE.Vector3();
  const routes = [
    { from: [0, .4, 24.5], direction: [0, 0, 1], distance: 18 },
    { from: [-22, .4, 37], direction: [1, 0, 0], distance: 44 },
    { from: [-13.3, .5, 36], direction: [1, 0, 0], distance: 26.5 },
  ];
  let minimumPoleGap = Infinity;
  for (const route of routes) {
    physics.teleport(new THREE.Vector3(...route.from));
    for (let step = 0; step < 48; step++) physics.move(still, 0, 1 / 120);
    const start = physics.position.clone();
    const direction = new THREE.Vector3(...route.direction);
    for (let step = 0; step < Math.ceil(route.distance / 3 * 60); step++) {
      physics.move(direction, 3, 1 / 60);
      for (const { position } of STREET_SIGN_POSTS) {
        const gap = Math.hypot(physics.position.x - position[0], physics.position.z - position[2]) - .19;
        minimumPoleGap = Math.min(minimumPoleGap, gap);
        assert.ok(gap > .32, 'existing road and both storefront approach paths clear the widest post base');
      }
      assert.ok(physics.position.y > .075 && physics.position.y < .15, 'junction traversal stays on the actual asphalt, without a fall or a sign-sized obstruction');
    }
    assert.ok(physics.position.clone().sub(start).dot(direction) > route.distance - .3, 'the authored route is traversable');
    assert.ok(physics.grounded, 'each complete approach ends grounded');
  }
  assert.ok(minimumPoleGap > 1.35, `front approaches have spare clearance (${minimumPoleGap.toFixed(2)} metres)`);
  assert.equal(physics.resetCount, 0);
  const signs = await createStreetSigns({ texture: new THREE.Texture() });
  for (const post of signs.manifest.posts) assert.ok(post.position[1] + post.headroom > .11 + 1.75 + 1, 'blades are over a metre above the avatar capsule');
  environment.dispose(); signs.dispose();
});

test('sign atlas stays bounded in two shared draws and resource ownership is idempotent', async () => {
  const parent = new THREE.Scene(), atlas = new THREE.Texture();
  let textureDisposals = 0, geometryDisposals = 0, materialDisposals = 0;
  atlas.addEventListener('dispose', () => textureDisposals++);
  const signs = await createStreetSigns({ parent, texture: atlas });
  assert.deepEqual(signs.stats.streetNames, ['Catch Lane', 'Hands Ave']);
  assert.equal(signs.stats.drawCalls, 2);
  assert.equal(signs.stats.readableFaces, 8);
  assert.ok(signs.stats.triangles < 300);
  assert.equal(signs.group.children.length, 2);
  for (const mesh of signs.group.children) {
    assert.ok(mesh.userData.noCollision, 'tiny decoration remains outside detailed world collision');
    mesh.geometry.addEventListener('dispose', () => geometryDisposals++);
    mesh.material.addEventListener('dispose', () => materialDisposals++);
    const uv = mesh.geometry.attributes.uv;
    assert.ok([...uv.array].every((value) => Number.isFinite(value) && value >= 0 && value <= 1));
    if (mesh.material.map) {
      assert.equal(mesh.material.map, atlas);
      assert.equal(mesh.material.side, THREE.FrontSide, 'each readable back gets its own outward plane, avoiding mirrored words');
    }
  }
  signs.dispose(); signs.dispose();
  assert.equal(parent.children.length, 0);
  assert.equal(geometryDisposals, 2); assert.equal(materialDisposals, 2);
  assert.equal(textureDisposals, 0, 'borrowed atlas stays alive');
  atlas.dispose();
});

test('all 81 authored fast-travel camera routes clear both sign poles and overhead blades', () => {
  const bounds = STREET_SIGN_POSTS.flatMap(({ position: [x, y, z] }) => [
    new THREE.Box3(new THREE.Vector3(x - .125, y, z - .125), new THREE.Vector3(x + .125, y + 4.26, z + .125)),
    ...STREET_SIGN_BLADES.map((blade) => {
      const width = blade.yaw ? .174 : 3, depth = blade.yaw ? 3 : .174;
      return new THREE.Box3(new THREE.Vector3(x - width / 2, y + blade.height - .29, z - depth / 2), new THREE.Vector3(x + width / 2, y + blade.height + .29, z + depth / 2));
    }),
  ]);
  const cameraPosition = new THREE.Vector3();
  let minimumClearance = Infinity, frames = 0;
  for (const from of DESTINATIONS) for (const to of DESTINATIONS) {
    const route = createTravelRoute(new THREE.Vector3(...from.position), to, composeArrivalView(from));
    route.setArrivalPosition(new THREE.Vector3(...to.position), .87);
    for (let sample = 0; sample <= 400; sample++) {
      cameraPosition.fromArray(route.sample(sample / 400).camera);
      for (const box of bounds) minimumClearance = Math.min(minimumClearance, box.distanceToPoint(cameraPosition));
      frames++;
    }
  }
  assert.equal(frames, 32481);
  assert.ok(minimumClearance > .12, `all camera spheres clear sign geometry (${minimumClearance.toFixed(3)} metres minimum)`);
});
