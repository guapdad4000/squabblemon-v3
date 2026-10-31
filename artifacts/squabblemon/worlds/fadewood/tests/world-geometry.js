// Read only geometry and transforms for Node collision tests; no image/browser
// polyfills, so these tests use exactly the shipped GLB's collision triangles.
import { readFileSync } from 'node:fs';
import { BufferAttribute, BufferGeometry, Group, Mesh } from 'three';

export function loadWorldGeometry() {
  const file = readFileSync(new URL('../public/assets/squabble-block.glb', import.meta.url));
  const jsonLength = file.readUInt32LE(12);
  const gltf = JSON.parse(file.toString('utf8', 20, 20 + jsonLength));
  const binary = file.subarray(28 + jsonLength);
  const types = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
  const sizes = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
  function attribute(id) {
    const accessor = gltf.accessors[id];
    const view = gltf.bufferViews[accessor.bufferView];
    const Type = types[accessor.componentType];
    const size = sizes[accessor.type];
    const stride = view.byteStride ?? Type.BYTES_PER_ELEMENT * size;
    const base = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
    const array = new Type(accessor.count * size);
    for (let i = 0; i < accessor.count; i++) {
      const slice = binary.subarray(base + i * stride, base + i * stride + size * Type.BYTES_PER_ELEMENT);
      array.set(new Type(Uint8Array.from(slice).buffer), i * size);
    }
    return new BufferAttribute(array, size);
  }
  const nodes = gltf.nodes.map((node) => {
    const object = new Group();
    object.name = node.name ?? '';
    if (node.mesh !== undefined && node.skin === undefined) {
      for (const primitive of gltf.meshes[node.mesh].primitives) {
        if (primitive.mode !== undefined && primitive.mode !== 4) continue;
        const geometry = new BufferGeometry();
        geometry.setAttribute('position', attribute(primitive.attributes.POSITION));
        if (primitive.indices !== undefined) geometry.setIndex(attribute(primitive.indices));
        const mesh = new Mesh(geometry);
        mesh.name = object.name;
        object.add(mesh);
      }
    }
    if (node.matrix) { object.matrix.fromArray(node.matrix); object.matrix.decompose(object.position, object.quaternion, object.scale); }
    if (node.translation) object.position.fromArray(node.translation);
    if (node.rotation) object.quaternion.fromArray(node.rotation);
    if (node.scale) object.scale.fromArray(node.scale);
    return object;
  });
  gltf.nodes.forEach((node, i) => (node.children ?? []).forEach((child) => nodes[i].add(nodes[child])));
  const world = new Group();
  (gltf.scenes[gltf.scene ?? 0].nodes ?? []).forEach((index) => world.add(nodes[index]));
  return world;
}
