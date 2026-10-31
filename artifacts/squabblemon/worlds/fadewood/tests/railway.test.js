import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, Group, Matrix4, Texture, Vector3 } from 'three';
import { createRailway, createRailwayPath, RAILWAY_LAYOUT, trainPanel } from '../src/railway.js';
import { loadWorldGeometry } from './world-geometry.js';

const path = createRailwayPath();
const close = (actual, expected, tolerance = 1e-8) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);
const outsideTown = (p) => Math.abs(p.x) > 29 || Math.abs(p.z) > 49;

test('analytic railway joins close in position and tangent with arc-length speed', () => {
  close(path.length, 2 * (84 + 122 - 68) + Math.PI * 34);
  for (const join of path.joins) {
    const before = path.sample(join - 1e-6), after = path.sample(join + 1e-6);
    assert.ok(before.position.distanceTo(after.position) < 2.01e-6);
    assert.ok(before.tangent.distanceTo(after.tangent) < 1e-6);
  }
  for (let d = -path.length; d <= path.length * 2; d += .397) {
    const a = path.sample(d), b = path.sample(d + .01);
    close(a.position.distanceTo(b.position), .01, 1e-8);
    close(a.tangent.length(), 1);
    close(a.position.distanceTo(path.sample(d + path.length).position), 0);
  }
});

test('loop clears actual shipped town structures and remains inside painted skyline', () => {
  const world = loadWorldGeometry(); world.updateWorldMatrix(true, true);
  const buildings = [];
  let earth;
  world.traverse((object) => {
    if (!object.isMesh) return;
    const bounds = new Box3().setFromObject(object);
    if (/FADE MARKET|SQUABBLE HOUSE|Housing|graffiti brick housing|COUNTY JAIL|POST OFFICE|FADE PARK|Neighborhood DOJO|Small house/.test(object.name)) buildings.push(bounds);
    if (object.name === 'Surrounding earth') earth = bounds;
  });
  assert.ok(buildings.length > 40);
  assert.ok(earth); close(earth.min.x, -50); close(earth.max.x, 50); close(earth.max.y, -.67, 1e-6);
  const point = new Vector3();
  for (let distance = 0; distance < path.length; distance += .2) {
    const sample = path.sample(distance);
    assert.ok(outsideTown(sample.position));
    for (const offset of [-2.85, 2.85]) {
      point.copy(sample.position).addScaledVector(new Vector3(-sample.tangent.z, 0, sample.tangent.x), offset);
      assert.ok(outsideTown(point), 'ballast must not enter player bounds');
      assert.ok(Math.hypot(point.x, point.z + 5) < 90, 'track must stay within the near painting');
      for (const bounds of buildings) assert.ok(!bounds.clone().expandByScalar(2).containsPoint(point));
    }
  }
});

test('rail center, tie direction and wheel trucks all follow the same path', async () => {
  const railway = await createRailway({ texture: new Texture() });
  const ties = railway.group.getObjectByName('Railway wooden sleepers');
  const matrix = new Matrix4(); const position = new Vector3(); const forward = new Vector3();
  for (const i of [0, 63, 142, ties.count - 1]) {
    ties.getMatrixAt(i, matrix); position.setFromMatrixPosition(matrix);
    const expected = path.sample(i / ties.count * path.length);
    close(Math.hypot(position.x - expected.position.x, position.z - expected.position.z), 0, 1e-5);
    forward.set(0, 0, 1).transformDirection(matrix);
    close(forward.dot(expected.tangent), 1, 1e-6);
  }
  for (const time of [0, 6, 16, 30, 52]) {
    railway.update(time);
    const trucks = railway.group.getObjectByName('Fadewood train articulated bogies');
    for (let i = 0; i < trucks.count; i++) {
      trucks.getMatrixAt(i, matrix); position.setFromMatrixPosition(matrix);
      const expected = path.sample(time * RAILWAY_LAYOUT.speed + 31 - RAILWAY_LAYOUT.trainOffsets[Math.floor(i / 2)] + (i % 2 ? 2.7 : -2.7));
      close(Math.hypot(position.x - expected.position.x, position.z - expected.position.z), 0, 4e-6);
      forward.set(0, 0, 1).transformDirection(matrix); close(forward.dot(expected.tangent), 1, 1e-6);
    }
  }
  railway.dispose();
});

test('three linked cars move deterministically through the loop seam without a jump', async () => {
  const railway = await createRailway({ texture: new Texture() });
  for (const time of [0, 7.11, 22, railway.stats.lapSeconds - .0001]) {
    railway.update(time); const first = railway.sampleMotion();
    railway.update(time + railway.stats.lapSeconds); const later = railway.sampleMotion();
    for (let i = 0; i < first.length; i++) {
      close(new Vector3(...first[i].position).distanceTo(new Vector3(...later[i].position)), 0, 1e-8);
      assert.ok(outsideTown(new Vector3(...first[i].position)));
      if (i) assert.ok(new Vector3(...first[i].position).distanceTo(new Vector3(...first[i - 1].position)) > 9.3);
    }
  }
  railway.update(0); const initial = railway.sampleMotion();
  assert.ok(initial[0].position[0] > 0 && initial[0].position[0] < 12 && initial[0].position[2] === 58, 'engine starts visible across the opening street');
  const seam = (path.length - 31) / RAILWAY_LAYOUT.speed;
  railway.update(seam - .001); const before = railway.sampleMotion();
  railway.update(seam + .001); const after = railway.sampleMotion();
  assert.ok(new Vector3(...before[0].position).distanceTo(new Vector3(...after[0].position)) < .0145);
  railway.dispose();
});

test('atlas shares one map and inset UVs choose four distinct cells', async () => {
  const texture = new Texture(); const railway = await createRailway({ texture });
  const maps = new Set(); railway.group.traverse((object) => { if (object.material?.map) maps.add(object.material.map); });
  assert.equal(maps.size, 1); assert.equal(maps.values().next().value, texture);
  const quadrants = [];
  for (const [column, row] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    const geometry = trainPanel(3, 2, column, row, [0, 0, 0]);
    const uv = geometry.attributes.uv; const point = new Vector3();
    for (let i = 0; i < uv.count; i++) {
      assert.ok(uv.getX(i) > column / 2 && uv.getX(i) < (column + 1) / 2);
      assert.ok(uv.getY(i) > (1 - row) / 2 && uv.getY(i) < (2 - row) / 2);
      point.add(new Vector3(uv.getX(i), uv.getY(i), 0));
    }
    quadrants.push(point.multiplyScalar(1 / uv.count).toArray()); geometry.dispose();
  }
  assert.equal(new Set(quadrants.map((p) => p.join(','))).size, 4); railway.dispose();
});

test('railway stays batched, owns no collisions and disposes only owned resources once', async () => {
  const parent = new Group(); const texture = new Texture(); let textureDisposals = 0;
  texture.addEventListener('dispose', () => textureDisposals++);
  const railway = await createRailway({ parent, texture });
  assert.equal(parent.children.length, 1); assert.equal(railway.stats.meshes, 13);
  assert.ok(railway.stats.triangles < 16000); assert.equal(railway.stats.sleepers, 247); assert.equal(railway.stats.wheels, 24);
  const geometries = new Set(); const materials = new Set();
  railway.group.traverse((object) => { if (object.isMesh) { assert.equal(object.userData.noCollision, true); geometries.add(object.geometry); materials.add(object.material); } });
  let geometryDisposals = 0, materialDisposals = 0;
  for (const geometry of geometries) geometry.addEventListener('dispose', () => geometryDisposals++);
  for (const material of materials) material.addEventListener('dispose', () => materialDisposals++);
  railway.dispose(); railway.dispose(); railway.update(100);
  assert.equal(parent.children.length, 0); assert.equal(geometryDisposals, geometries.size); assert.equal(materialDisposals, 2); assert.equal(textureDisposals, 0);
});
