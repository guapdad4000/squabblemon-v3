import * as THREE from 'three';

/** Five invisible OBBs keep the imported props solid without putting their
 * detailed tires, spokes and wire grid into every capsule/camera query. The
 * visual models remain unchanged and outside this static collision group. */
export function createPropColliders(records) {
  if (!Array.isArray(records)) throw new Error('Prop colliders require placed model records.');
  const group = new THREE.Group();
  group.name = 'Neighborhood prop collision proxies';
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const meshes = [];
  for (const record of records) {
    const dimensions = record.localDimensions;
    if (!Array.isArray(dimensions) || dimensions.length !== 3 || !dimensions.every((n) => Number.isFinite(n) && n > 0)
      || !Array.isArray(record.position) || record.position.length !== 3 || !record.position.every(Number.isFinite)
      || !Number.isFinite(record.yaw)) {
      geometry.dispose(); material.dispose();
      throw new Error(`Invalid prop collision bounds: ${record.id}`);
    }
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `${record.name ?? record.id} | collision`;
    mesh.position.fromArray(record.position);
    mesh.position.y += dimensions[1] / 2;
    mesh.rotation.y = record.yaw;
    mesh.scale.fromArray(dimensions);
    mesh.visible = false;
    mesh.userData.isPropCollider = true;
    mesh.userData.propId = record.id;
    group.add(mesh); meshes.push(mesh);
  }
  group.updateMatrixWorld(true);
  let disposed = false;
  return {
    group, meshes,
    stats: Object.freeze({ colliders: meshes.length, triangles: meshes.length * 12, drawCalls: 0 }),
    dispose() {
      if (disposed) return;
      disposed = true;
      group.removeFromParent(); group.clear(); geometry.dispose(); material.dispose();
    },
  };
}

/** Run after anime-environment's old-hoop cleanup. The old car's chapter
 * batches and separately authored cabin leave rendering and collision together.
 * The original GLB and geometry stay intact. */
export function removeLegacyCar(world) {
  const old = [];
  world.traverse((mesh) => {
    if (!mesh.isMesh) return;
    for (let object = mesh; object && object !== world; object = object.parent) {
      const names = [object.name, object.userData?.name ?? ''].map((name) => name.replaceAll('_', ' ').trim());
      if (!names.some((name) => /08 Parked car and basketball corner/.test(name) || name === 'Parked car cabin')) continue;
      const count = mesh.geometry.index?.count ?? mesh.geometry.attributes.position?.count ?? 0;
      old.push({ mesh, parent: mesh.parent, index: mesh.parent.children.indexOf(mesh), triangles: count / 3 });
      break;
    }
  });
  for (const { mesh } of old) mesh.removeFromParent();
  let restored = false;
  return {
    removedMeshes: old.length,
    triangles: old.reduce((sum, record) => sum + record.triangles, 0),
    records: old.map(({ mesh, triangles }) => ({ name: mesh.name, triangles })),
    restore() {
      if (restored) return;
      restored = true;
      for (const { mesh, parent, index } of old) {
        parent.add(mesh);
        parent.children.splice(parent.children.indexOf(mesh), 1);
        parent.children.splice(index, 0, mesh);
      }
    },
  };
}
