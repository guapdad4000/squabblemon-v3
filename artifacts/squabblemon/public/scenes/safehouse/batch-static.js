import * as T from '../shared/three.module.js';

// Collapse static props by material within the scene root AND within each
// interactive/dynamic group in local space so picking and group motion stay intact.
export function batchStaticMeshes(scene, keep = []) {
  scene.updateMatrixWorld(true);
  const protectedObjects = new Set(keep);
  const roots = [scene, ...keep.filter(obj => obj && !obj.isMesh)];
  let combined = 0, batches = 0;
  const retired = new Set();

  for (const root of roots) {
    root.updateWorldMatrix(true, true);
    const rootInverse = root.matrixWorld.clone().invert();
    const buckets = new Map();

    root.traverse(object => {
      if (object === root) return;
      if (!object.isMesh || object.isInstancedMesh || Array.isArray(object.material) || object.material.transparent) return;
      if (protectedObjects.has(object) || !object.visible) return;
      for (let parent = object.parent; parent && parent !== root; parent = parent.parent) {
        if (protectedObjects.has(parent) || !parent.visible) return;
      }
      const geometry = object.geometry;
      if (!geometry.attributes.position || !geometry.attributes.normal || !geometry.attributes.uv) return;
      const key = `${object.material.id}/${object.castShadow}/${object.receiveShadow}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(object);
    });

    for (const objects of buckets.values()) {
      if (objects.length < 2) continue;
      const parts = objects.map(object => {
        const geometry = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
        const relativeMatrix = root === scene
          ? object.matrixWorld
          : rootInverse.clone().multiply(object.matrixWorld);
        geometry.applyMatrix4(relativeMatrix);
        return geometry;
      });
      const geometry = new T.BufferGeometry();
      for (const name of ['position', 'normal', 'uv']) {
        const size = parts[0].attributes[name].itemSize;
        const data = new Float32Array(parts.reduce((length, part) => length + part.attributes[name].array.length, 0));
        let offset = 0;
        for (const part of parts) {
          data.set(part.attributes[name].array, offset);
          offset += part.attributes[name].array.length;
        }
        geometry.setAttribute(name, new T.BufferAttribute(data, size));
      }
      const mesh = new T.Mesh(geometry, objects[0].material);
      mesh.castShadow = objects[0].castShadow;
      mesh.receiveShadow = objects[0].receiveShadow;
      mesh.name = root === scene ? 'static-room-batch' : `static-group-batch-${root.name || 'group'}`;
      root.add(mesh);
      for (const object of objects) {
        retired.add(object.geometry);
        object.removeFromParent();
      }
      parts.forEach(part => part.dispose());
      combined += objects.length;
      batches++;
    }
  }

  const live = new Set();
  scene.traverse(object => { if (object.geometry) live.add(object.geometry); });
  for (const geometry of retired) if (!live.has(geometry)) geometry.dispose();
  return { combined, batches };
}
