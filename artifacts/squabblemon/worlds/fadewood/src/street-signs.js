import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Hands Ave follows the existing long road. Catch Lane crosses its southern
// end, in front of Fade Market and Squabble House. Blades sit above head height;
// both faces carry separately oriented lettering rather than mirrored backs.
export const STREET_SIGN_POSTS = Object.freeze([
  { id: 'west-junction', position: [-6.6, .109, 34.4] },
  { id: 'east-junction', position: [6.6, .109, 34.4] },
].map((post) => Object.freeze({ ...post, position: Object.freeze(post.position) })));

export const STREET_SIGN_BLADES = Object.freeze([
  Object.freeze({ name: 'Catch Lane', tile: 0, height: 3.88, yaw: 0, size: Object.freeze([2.9, .48]) }),
  Object.freeze({ name: 'Hands Ave', tile: 1, height: 3.27, yaw: Math.PI / 2, size: Object.freeze([2.9, .48]) }),
]);

export const STREET_SIGN_TEXTURE = 'assets/v3/fadewood-street-signs.webp';
// Exact regions in the generated 1774 x 887 master. Runtime resize preserves
// these proportions. The last four narrow regions unwrap the pole's four sides.
export const STREET_SIGN_ATLAS = Object.freeze({
  size: Object.freeze([1774, 887]),
  signs: Object.freeze([[0, 0, 1774, 326], [0, 326, 1774, 615]].map(Object.freeze)),
  pole: Object.freeze([[0, 615, 1774, 684], [0, 684, 1774, 753], [0, 753, 1774, 821], [0, 821, 1774, 887]].map(Object.freeze)),
});

export async function createStreetSigns({ parent, renderer, texture = null } = {}) {
  const atlas = texture ?? await new THREE.TextureLoader().loadAsync(`${import.meta.env?.BASE_URL ?? '/'}${STREET_SIGN_TEXTURE}`);
  atlas.colorSpace = THREE.SRGBColorSpace;
  atlas.anisotropy = Math.min(8, renderer?.capabilities.getMaxAnisotropy() ?? 1);
  const bodies = [], faces = [], panels = [], polePanels = [], posts = [];
  const bodyMaterial = new THREE.MeshBasicMaterial({ vertexColors: true });
  bodyMaterial.name = 'Street signs | shared ink and cel colors';
  const faceMaterial = new THREE.MeshBasicMaterial({ map: atlas });
  faceMaterial.name = 'Street signs | Catch Lane and Hands Ave lettering';

  function box(size, position, color, yaw = 0) {
    const geometry = new THREE.BoxGeometry(...size);
    const rgb = new THREE.Color(color);
    const colors = new Float32Array(geometry.attributes.position.count * 3);
    for (let i = 0; i < colors.length; i += 3) rgb.toArray(colors, i);
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.rotateY(yaw).translate(...position);
    bodies.push(geometry);
  }

  function paintPanel(size, position, yaw, rect, lengthAlongHeight = false) {
    const geometry = new THREE.PlaneGeometry(...size);
    const uv = geometry.attributes.uv;
    const [width, height] = STREET_SIGN_ATLAS.size;
    const [left, top, right, bottom] = rect;
    const u0 = (left + 2) / width, u1 = (right - 2) / width;
    const v0 = 1 - (bottom - 2) / height, v1 = 1 - (top + 2) / height;
    for (let i = 0; i < uv.count; i++) {
      const x = uv.getX(i), y = uv.getY(i);
      uv.setXY(i, THREE.MathUtils.lerp(u0, u1, lengthAlongHeight ? y : x), THREE.MathUtils.lerp(v0, v1, lengthAlongHeight ? x : y));
    }
    geometry.rotateY(yaw).translate(...position);
    faces.push(geometry);
  }

  for (const post of STREET_SIGN_POSTS) {
    const [x, y, z] = post.position;
    posts.push({ ...post, shaftRadius: .075, headroom: 2.98 });
    box([.38, .11, .38], [x, y + .055, z], '#141c2d');
    box([.26, .14, .26], [x, y + .16, z], '#a0b9b6');
    box([.15, 4.12, .15], [x, y + 2.06, z], '#141c2d');
    for (let side = 0; side < 4; side++) {
      const yaw = side * Math.PI / 2;
      const position = [x + Math.sin(yaw) * .079, y + 2.08, z + Math.cos(yaw) * .079];
      const size = [.154, 3.96];
      paintPanel(size, position, yaw, STREET_SIGN_ATLAS.pole[side], true);
      polePanels.push({ postId: post.id, side, position, size, yaw, rect: [...STREET_SIGN_ATLAS.pole[side]] });
    }

    for (const blade of STREET_SIGN_BLADES) {
      const center = [x, y + blade.height, z];
      // The frame encloses the narrow pole, so its paint cannot cover letters
      // at the centre of either side of the plaque.
      box([blade.size[0] + .1, blade.size[1] + .1, .17], center, '#141c2d', blade.yaw);
      for (const reverse of [false, true]) {
        const yaw = blade.yaw + (reverse ? Math.PI : 0);
        const position = [x + Math.sin(yaw) * .087, center[1], z + Math.cos(yaw) * .087];
        paintPanel(blade.size, position, yaw, STREET_SIGN_ATLAS.signs[blade.tile]);
        panels.push({ postId: post.id, name: blade.name, tile: blade.tile, reverse, position, yaw, size: [...blade.size], rect: [...STREET_SIGN_ATLAS.signs[blade.tile]] });
      }
    }
  }

  const group = new THREE.Group();
  group.name = 'Fadewood | Catch Lane and Hands Ave street signs';
  const bodyGeometry = mergeGeometries(bodies);
  const faceGeometry = mergeGeometries(faces);
  bodies.forEach((geometry) => geometry.dispose());
  faces.forEach((geometry) => geometry.dispose());
  for (const [name, geometry, material] of [
    ['Street signs | ink frames and poles', bodyGeometry, bodyMaterial],
    ['Street signs | eight readable faces and stickered pole wraps', faceGeometry, faceMaterial],
  ]) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.userData.noCollision = true;
    group.add(mesh);
  }
  parent?.add(group);
  const triangles = group.children.reduce((sum, mesh) => sum + mesh.geometry.index.count / 3, 0);
  const stats = Object.freeze({ posts: posts.length, streetNames: STREET_SIGN_BLADES.map(({ name }) => name), blades: 4, readableFaces: panels.length, paintedPoleFaces: polePanels.length, drawCalls: 2, materials: 2, textures: 1, triangles });
  const manifest = { posts, panels, polePanels, stats, texture: STREET_SIGN_TEXTURE, atlas: STREET_SIGN_ATLAS, axis: { 'Hands Ave': 'north-south / world Z', 'Catch Lane': 'east-west / world X' } };
  let disposed = false;
  return {
    group, stats, manifest,
    dispose() {
      if (disposed) return;
      disposed = true;
      group.removeFromParent();
      bodyGeometry.dispose(); faceGeometry.dispose();
      bodyMaterial.dispose(); faceMaterial.dispose();
      if (!texture) atlas.dispose();
    },
  };
}
