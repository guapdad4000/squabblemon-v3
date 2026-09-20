import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../public/scenes/shared/three.module.js';
import { batchStaticMeshes } from '../public/scenes/safehouse/batch-static.js';

test('static batching preserves world-space bounds, triangles and normals', () => {
  const scene = new T.Scene(), group = new T.Group(), material = new T.MeshStandardMaterial();
  group.position.set(3, 2, -1); group.rotation.y = .7; scene.add(group);
  for (let i = 0; i < 3; i++) { const mesh = new T.Mesh(new T.BoxGeometry(1, 2, 3), material); mesh.position.x = i * 2; group.add(mesh); }
  const before = new T.Box3().setFromObject(scene);
  const result = batchStaticMeshes(scene);
  const after = new T.Box3().setFromObject(scene);
  assert.equal(result.combined, 3); assert.equal(result.batches, 1);
  assert.ok(before.min.distanceTo(after.min) < .00001 && before.max.distanceTo(after.max) < .00001);
  const batch = scene.getObjectByName('static-room-batch');
  assert.equal(batch.geometry.attributes.position.count / 3, 36);
  for (let i = 0; i < batch.geometry.attributes.normal.count; i++) {
    const normal = new T.Vector3().fromBufferAttribute(batch.geometry.attributes.normal, i);
    assert.ok(Math.abs(normal.length() - 1) < .00001);
  }
});

test('interactive objects and moving descendants keep their original hierarchy', () => {
  const scene = new T.Scene(), interactive = new T.Group(), material = new T.MeshStandardMaterial();
  scene.add(interactive);
  const clickable = new T.Mesh(new T.BoxGeometry(), material); interactive.add(clickable);
  for (let i = 0; i < 2; i++) scene.add(new T.Mesh(new T.BoxGeometry(), material));
  batchStaticMeshes(scene, [interactive]);
  assert.equal(clickable.parent, interactive); assert.equal(scene.getObjectByName('static-room-batch').geometry.attributes.position.count, 72);
});

test('transparent props are not batched and retain their material identity', () => {
  const scene = new T.Scene(), material = new T.MeshBasicMaterial({ transparent: true, opacity: .3 });
  const rain = new T.Mesh(new T.PlaneGeometry(), material); scene.add(rain, new T.Mesh(new T.PlaneGeometry(), material));
  assert.equal(batchStaticMeshes(scene).combined, 0); assert.equal(rain.material, material);
});
