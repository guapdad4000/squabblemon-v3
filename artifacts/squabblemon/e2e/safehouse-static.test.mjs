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

test('protected interactive groups batch their own static child meshes in group-local space while preserving parent hierarchy and single-mesh children', () => {
  const scene = new T.Scene();
  const bag = new T.Group();
  bag.position.set(1.35, 2.6, -2.65);
  bag.rotation.z = 0.25;
  scene.add(bag);
  const stitchMat = new T.MeshStandardMaterial({ color: '#d5b791' });
  for (let i = 0; i < 10; i++) {
    const stitch = new T.Mesh(new T.BoxGeometry(0.1, 0.2, 0.1), stitchMat);
    stitch.position.set(i * 0.15, -0.5 + i * 0.05, 0.4);
    bag.add(stitch);
  }
  const beforeBounds = new T.Box3().setFromObject(bag, true);
  const result = batchStaticMeshes(scene, [bag]);
  const afterBounds = new T.Box3().setFromObject(bag, true);
  assert.equal(result.combined, 10);
  assert.equal(result.batches, 1);
  assert.equal(bag.children.length, 1);
  assert.equal(bag.children[0].parent, bag);
  assert.ok(beforeBounds.min.distanceTo(afterBounds.min) < 0.0001);
  assert.ok(beforeBounds.max.distanceTo(afterBounds.max) < 0.0001);
  // Rotating the parent group moves the local batch identically.
  bag.rotation.z = -0.4;
  bag.updateMatrixWorld(true);
  const rotatedBounds = new T.Box3().setFromObject(bag, true);
  assert.ok(rotatedBounds.min.distanceTo(afterBounds.min) > 0.01);
});
