import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../public/scenes/shared/three.module.js';
import { batchStaticMeshes } from '../public/scenes/safehouse/batch-static.js';

test('static batching preserves transformed positions, material, and raycast surfaces', () => {
  const scene = new T.Scene(), material = new T.MeshStandardMaterial();
  const parent = new T.Group(); parent.position.set(4, 2, -3); scene.add(parent);
  for (let i = 0; i < 2; i++) { const mesh = new T.Mesh(new T.BoxGeometry(1, 2, 1), material); mesh.position.x = i * 3; mesh.castShadow = true; parent.add(mesh); }
  const before = new T.Box3().setFromObject(scene);
  const result = batchStaticMeshes(scene);
  const after = new T.Box3().setFromObject(scene);
  assert.deepEqual(result, { combined: 2, batches: 1 }); assert.ok(before.min.equals(after.min)); assert.ok(before.max.equals(after.max));
  const batch = scene.children.find(object => object.name === 'static-room-batch');
  assert.equal(batch.material, material); assert.equal(batch.castShadow, true); assert.equal(batch.geometry.attributes.position.count, 72);
  scene.updateMatrixWorld(true); const ray = new T.Raycaster(new T.Vector3(4, 2, 2), new T.Vector3(0, 0, -1));
  assert.ok(ray.intersectObject(batch).length > 0);
});

test('interactive groups and shared dynamic geometry survive batching untouched', () => {
  const scene = new T.Scene(), material = new T.MeshStandardMaterial(), geometry = new T.BoxGeometry();
  const interactive = new T.Group(); scene.add(interactive);
  const selected = new T.Mesh(geometry, material); interactive.add(selected);
  for (let i = 0; i < 3; i++) scene.add(new T.Mesh(geometry, material));
  let disposed = false; geometry.addEventListener('dispose', () => { disposed = true; });
  batchStaticMeshes(scene, [interactive]);
  assert.equal(selected.parent, interactive); assert.equal(disposed, false); assert.equal(selected.geometry, geometry);
});

test('transparent details and different shadow settings stay separate', () => {
  const scene = new T.Scene(), material = new T.MeshStandardMaterial(), transparent = new T.MeshBasicMaterial({ transparent: true });
  const glass = new T.Mesh(new T.PlaneGeometry(), transparent); scene.add(glass);
  for (let i = 0; i < 4; i++) { const mesh = new T.Mesh(new T.BoxGeometry(), material); mesh.castShadow = i > 1; scene.add(mesh); }
  assert.deepEqual(batchStaticMeshes(scene), { combined: 4, batches: 2 }); assert.equal(glass.parent, scene);
});
