import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Scene, Texture, Raycaster, Vector3 } from 'three';
import { loadWorldGeometry } from './world-geometry.js';
import { loadCpuGlb, authoringFile } from './helpers/verify-assets.mjs';
import { createNeighborhoodSurfaces } from '../src/neighborhood-surfaces.js';

const hash = (data) => createHash('sha256').update(data).digest('hex');
function maps() {
  return Object.fromEntries(['brick', 'finish', 'timber'].map((id) => { const texture = new Texture(); texture.flipY = false; return [id, texture]; }));
}
function geometrySnapshot(world) {
  const records = [];
  world.traverse((object) => {
    if (!object.isMesh) return;
    records.push({ object, geometry: object.geometry, material: object.material, visible: object.visible,
      attributes: Object.fromEntries(Object.entries(object.geometry.attributes).map(([name, attr]) => [name, hash(Buffer.from(attr.array.buffer, attr.array.byteOffset, attr.array.byteLength))])),
      index: object.geometry.index ? hash(Buffer.from(object.geometry.index.array.buffer)) : null });
  });
  return records;
}

test('bare rear walls planters boxes foundations and alleys use three resident atlases without changing source meshes', () => {
  const rawBefore = readFileSync(new URL('../public/assets/squabble-block.glb', import.meta.url));
  const world = loadWorldGeometry(), scene = new Scene(), textures = maps(); scene.add(world);
  const before = geometrySnapshot(world), surfaces = createNeighborhoodSurfaces({ world, parent: scene, textures });
  assert.deepEqual(surfaces.stats, { components: 29, categories: 14, drawCalls: 3, triangles: 2626, reusedTextures: 3, addedTextures: 0, addedTextureBytes: 0, areaSquareMetres: 6611.7 });
  assert.equal(surfaces.coverage.filter((record) => /planter boxes$/.test(record.category)).length, 10);
  assert.equal(surfaces.coverage.filter((record) => record.category === 'shop rear walls').length, 2);
  assert.equal(surfaces.coverage.filter((record) => record.category === 'market delivery boxes').length, 2);
  assert.ok(surfaces.coverage.every((record) => !/graffiti|Ink navy|Glass petrol|atlas$/.test(record.source)));
  assert.deepEqual(geometrySnapshot(world), before);
  const borrowed = new Set(Object.values(textures));
  for (const mesh of surfaces.group.children) {
    assert.ok(borrowed.has(mesh.material.map));
    assert.equal(mesh.userData.noCollision, true);
    const crops = surfaces.coverage.filter((record) => record.atlas === mesh.userData.sharedNeighborhoodAtlas).map((record) => record.crop);
    const uv = mesh.geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      assert.ok(crops.some((crop) => uv.getX(i) >= crop[0] - 1e-7 && uv.getX(i) <= crop[2] + 1e-7 && uv.getY(i) >= crop[1] - 1e-7 && uv.getY(i) <= crop[3] + 1e-7));
    }
  }
  let disposed = 0; for (const texture of borrowed) texture.addEventListener('dispose', () => disposed++);
  surfaces.dispose(); surfaces.dispose();
  assert.equal(disposed, 0, 'borrowed world texture ownership stays with the world');
  assert.deepEqual(geometrySnapshot(world), before);
  assert.deepEqual(scene.children, [world]);
  assert.equal(hash(readFileSync(new URL('../public/assets/squabble-block.glb', import.meta.url))), hash(rawBefore));
});

test('actual GLTFLoader material splitting and sanitized names find the same bare components and resident maps', { skip: !process.env.FADEWOOD_AUTHORING_ROOT ? 'External world master is optional authoring evidence and never ships.' : false }, async () => {
  // Geometry/UV/material data are identical between this preserved master and
  // shipped world; runtime-world.test separately proves every nonimage view.
  const gltf = await loadCpuGlb(readFileSync(authoringFile('work/slim/squabble-block-master.glb')));
  const before = geometrySnapshot(gltf.scene);
  const surfaces = createNeighborhoodSurfaces({ world: gltf.scene });
  assert.equal(surfaces.stats.components, 29);
  assert.equal(surfaces.stats.triangles, 2626);
  assert.equal(surfaces.stats.drawCalls, 3);
  assert.deepEqual(geometrySnapshot(gltf.scene), before);
  for (const mesh of surfaces.group.children) assert.ok(mesh.material.map.image.encodedBytes.length > 100000);
  surfaces.dispose();
});

test('paint stays ahead of bare walls and below existing paths without crossing facades or the garage opening', () => {
  const world = loadWorldGeometry(), textures = maps();
  const surfaces = createNeighborhoodSurfaces({ world, textures });
  surfaces.group.updateMatrixWorld(true);
  const ray = (from, direction) => new Raycaster(new Vector3(...from), new Vector3(...direction), 0, 10).intersectObject(surfaces.group, true);
  const market = ray([13, 2, 18], [0, 0, 1]);
  assert.ok(market.length > 0);
  assert.ok(Math.abs(market[0].point.z - 19.997) < 1e-5);
  assert.ok(market[0].point.z > 19.94, 'the new arena remains in front of the rear-wall finish');
  assert.equal(ray([13, 2, 34], [0, 0, -1]).length, 0, 'market front painting receives no overlay');
  assert.equal(ray([14.9, 1.5, -35], [0, 0, -1]).filter((hit) => hit.point.z > -45).length, 0, 'garage bay remains open');
  const countyUpper = ray([-17, 6.2, -11], [0, 0, -1]);
  assert.ok(countyUpper.length > 0, 'exposed county band above civic painting now receives plaster');
  assert.ok(Math.abs(countyUpper[0].point.z + 12.997) < 1e-5);
  const alley = ray([17, 2, 18.5], [0, -1, 0]);
  assert.ok(alley.length > 0);
  assert.ok(Math.abs(alley[0].point.y - .033) < 1e-6);
  surfaces.dispose();
});
