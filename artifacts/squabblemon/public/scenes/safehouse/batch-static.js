import * as T from '../shared/three.module.js';

// Collapse static props by material while leaving pickable and moving objects intact.
export function batchStaticMeshes(scene, keep = []) {
  scene.updateMatrixWorld(true);
  const protectedObjects = new Set(keep), buckets = new Map();
  scene.traverse(object => {
    if (!object.isMesh || object.isInstancedMesh || Array.isArray(object.material) || object.material.transparent) return;
    for (let parent = object; parent; parent = parent.parent) if (protectedObjects.has(parent) || !parent.visible) return;
    const geometry = object.geometry;
    if (!geometry.attributes.position || !geometry.attributes.normal || !geometry.attributes.uv) return;
    const key = `${object.material.id}/${object.castShadow}/${object.receiveShadow}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(object);
  });
  let combined = 0, batches = 0; const retired = new Set();
  for (const objects of buckets.values()) {
    if (objects.length < 2) continue;
    const parts = objects.map(object => {
      const geometry = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
      geometry.applyMatrix4(object.matrixWorld); return geometry;
    });
    const geometry = new T.BufferGeometry();
    for (const name of ['position', 'normal', 'uv']) {
      const size = parts[0].attributes[name].itemSize;
      const data = new Float32Array(parts.reduce((length, part) => length + part.attributes[name].array.length, 0));
      let offset = 0;
      for (const part of parts) { data.set(part.attributes[name].array, offset); offset += part.attributes[name].array.length; }
      geometry.setAttribute(name, new T.BufferAttribute(data, size));
    }
    const mesh = new T.Mesh(geometry, objects[0].material); mesh.castShadow = objects[0].castShadow; mesh.receiveShadow = objects[0].receiveShadow; mesh.name = 'static-room-batch'; scene.add(mesh);
    for (const object of objects) { retired.add(object.geometry); object.removeFromParent(); }
    parts.forEach(part => part.dispose()); combined += objects.length; batches++;
  }
  const live = new Set(); scene.traverse(object => { if (object.geometry) live.add(object.geometry); });
  for (const geometry of retired) if (!live.has(geometry)) geometry.dispose();
  return { combined, batches };
}
