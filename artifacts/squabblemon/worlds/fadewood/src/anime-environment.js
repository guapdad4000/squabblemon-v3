import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const BASE_URL = import.meta.env?.BASE_URL ?? '/';
const LEAF_URL = `${BASE_URL}assets/v3/anime-leaves.png`;
const PANORAMA_URL = `${BASE_URL}assets/v3/fadewood-panorama.webp`;
const NEIGHBORHOOD_URL = `${BASE_URL}assets/v3/fadewood-near-neighborhood.webp`;
const UP = new THREE.Vector3(0, 1, 0);
const FRONT = new THREE.Vector3(0, 0, 1);
// Only the outer 6% of either side overlaps. All samples keep their original
// direction, so the skyline does not acquire the reflected buildings and cloud
// shapes produced by mirrored repeat. The rest of the painting stays intact.
export const PANORAMA_SEAM_WIDTH = .06;
export const PANORAMA_SKY_FADE_START = .82;

const PANORAMA_SEAM_GLSL = `
  vec3 fadewoodPanoramaSeam(float across) {
    float edge = ${PANORAMA_SEAM_WIDTH.toFixed(8)};
    float left = (across + edge) * (across + edge) / (4.0 * edge);
    float right = 1.0 - (edge - across) * (edge - across) / (4.0 * edge);
    float blend = smoothstep(-edge, edge, across);
    return vec3(left, right, blend);
  }
`;

function makePanoramaSeamless(material, skyColor = null) {
  const cutout = !skyColor;
  material.customProgramCacheKey = () => cutout ? 'fadewood-periodic-neighborhood-cutout-v1' : 'fadewood-periodic-panorama-sky-v2';
  material.onBeforeCompile = (shader) => {
    if (skyColor) shader.uniforms.fadewoodPanoramaSky = { value: skyColor };
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>\n${PANORAMA_SEAM_GLSL}${cutout ? '' : `
      uniform vec3 fadewoodPanoramaSky;
      float fadewoodPanoramaSkyBlend(float v) {
        return smoothstep(${PANORAMA_SKY_FADE_START.toFixed(8)}, 1.0, v);
      }
    `}`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      #ifdef USE_MAP
        // Calculate derivatives before fract/branching. A wrapped UV jump must
        // not select the coarsest mip and draw a blurred line down the join.
        vec2 panoramaDx = dFdx(vMapUv);
        vec2 panoramaDy = dFdy(vMapUv);
        float panoramaU = fract(vMapUv.x);
        vec4 sampledDiffuseColor;
        if (panoramaU < ${PANORAMA_SEAM_WIDTH.toFixed(8)} || panoramaU > ${(1 - PANORAMA_SEAM_WIDTH).toFixed(8)}) {
          float across = panoramaU < 0.5 ? panoramaU : panoramaU - 1.0;
          vec3 seam = fadewoodPanoramaSeam(across);
          vec4 leftEdge = textureGrad(map, vec2(seam.x, vMapUv.y), panoramaDx, panoramaDy);
          vec4 rightEdge = textureGrad(map, vec2(seam.y, vMapUv.y), panoramaDx, panoramaDy);
          ${cutout ? `// Blend colour in premultiplied-alpha form so invisible texels
          // cannot introduce dark fringes into the painted skyline silhouette.
          float seamAlpha = mix(rightEdge.a, leftEdge.a, seam.z);
          vec3 seamColor = mix(rightEdge.rgb * rightEdge.a, leftEdge.rgb * leftEdge.a, seam.z);
          sampledDiffuseColor = vec4(seamColor / max(seamAlpha, 0.00001), seamAlpha);` : 'sampledDiffuseColor = mix(rightEdge, leftEdge, seam.z);'}
        } else {
          sampledDiffuseColor = textureGrad(map, vec2(panoramaU, vMapUv.y), panoramaDx, panoramaDy);
        }
        ${cutout ? '' : `// Both values are in linear working colour space. Matching the solid
        // scene clear colour at v=1 removes the cylinder's visible upper rim.
        sampledDiffuseColor.rgb = mix(sampledDiffuseColor.rgb, fadewoodPanoramaSky, fadewoodPanoramaSkyBlend(vMapUv.y));`}
        diffuseColor *= sampledDiffuseColor;
      #endif
    `);
  };
}

// Source bench backs were all built on local +X. The two left street benches
// and the west park bench must reverse to put their seats toward the route.
export const BENCH_FACING = Object.freeze([
  { id: 'west-street-south', center: [-9.4, 0, 10], facing: [1, 0, 0], rotate: true },
  { id: 'west-street-north', center: [-9.4, 0, -17], facing: [1, 0, 0], rotate: true },
  { id: 'east-street-south', center: [9.4, 0, 10], facing: [-1, 0, 0], rotate: false },
  { id: 'east-street-north', center: [9.4, 0, -17], facing: [-1, 0, 0], rotate: false },
  { id: 'park-west', center: [14.6, 0, -24], facing: [1, 0, 0], rotate: true },
  { id: 'park-east', center: [22.8, 0, -25], facing: [-1, 0, 0], rotate: false },
]);

export const MAILBOX_PLACEMENTS = Object.freeze([
  { id: 'market-mail', position: [10.25, .25, 27.3], yaw: -Math.PI / 2 },
  { id: 'blue-mail', position: [-10.2, .25, .6], yaw: Math.PI / 2 },
  { id: 'postal-mail', position: [10.15, .25, -5.7], yaw: -Math.PI / 2 },
  { id: 'dojo-mail', position: [-10.1, .25, -36.6], yaw: Math.PI / 2 },
]);

const STREET_TREES = [-1, 1].flatMap((side) => [13, -9, -31].map((z) => ({
  id: `street-${side}-${z}`, position: [side * 7, .3, z], centerY: 5.05, radius: 2.05, height: 3.75,
})));
const PARK_TREES = [[13.8, -27], [22.6, -19.2], [13.8, -34.5], [22.9, -36]].map(([x, z], i) => ({
  id: `park-${i}`, position: [x, .33, z], centerY: 4.6, radius: 1.85, height: 3.4,
}));
export const TREE_PLACEMENTS = Object.freeze([...STREET_TREES, ...PARK_TREES]);
const SHRUBS = [-1, 1].flatMap((side) => [16, -15, -38].map((z) => ({
  id: `planter-${side}-${z}`, position: [side * 10.5, 1.02, z], radius: .65, height: .85,
}))).concat([-27, -31].map((z, i) => ({ id: `library-${i}`, position: [-11.03, .95, z], radius: .55, height: .65 })));

const cleanName = (object) => `${object.userData?.name ?? ''} ${object.name}`.replaceAll('_', ' ');
const triangleCount = (geometry) => (geometry.index?.count ?? geometry.attributes.position.count) / 3;
const random = (seed) => { const v = Math.sin(seed * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };

// These are authored objects inside merged material batches. Narrow bounds
// identify the obsolete signs and the post-office hoop, without touching the
// park's actual basketball court, fence, paths, trees, benches or parked car.
function obsoleteParkPart(name, center, size) {
  const near = (value, target, tolerance = .035) => Math.abs(value - target) < tolerance;
  if (/08 Parked car and basketball corner/.test(name)
      && center.x > 8.8 && center.x < 10.8 && center.z > -11.3 && center.z < -9.7) {
    return 'post-office stray basketball hoop';
  }
  if (!/13 FADE PARK/.test(name)) return null;
  if (/01 Ink navy/.test(name) && near(center.x, 18) && near(center.y, 2.65) && near(center.z, -16.15)) return 'duplicate garden sign backing';
  if (/Warm cream/.test(name) && size.y < .4 && center.y > 2.2 && center.y < 2.9
      && ((near(center.x, 11.68) && center.z > -22 && center.z < -20)
        || (near(center.z, -15.98) && center.x > 16 && center.x < 20))) return 'obsolete sign lettering';
  if (/05 Faded teal/.test(name) && center.y > 2
      && ((near(center.x, 18) && near(center.z, -16.03))
        || (near(center.x, 11.78) && near(center.z, -21)))) return 'oversized teal placard';
  if (/Nature dojo garage atlas/.test(name)
      && ((near(center.z, -16.15) && (near(center.x, 15) || near(center.x, 21)) && size.y > 2.7 && size.y < 2.8)
        || (near(center.x, 11.83) && near(center.z, -21) && size.y > 1.7 && size.y < 1.8))) return 'obsolete sign post';
  return null;
}

/** Identify disconnected authored objects inside a material batch. Welding only
 * position duplicates restores the source component boundaries across UV seams.
 * This happens once at load; it never walks vertices in the render loop. */
export function connectedComponents(geometry, matrixWorld = new THREE.Matrix4()) {
  const positions = geometry.attributes.position;
  const index = geometry.index;
  const parents = Array.from({ length: positions.count }, (_, i) => i);
  const root = (i) => { while (parents[i] !== i) { parents[i] = parents[parents[i]]; i = parents[i]; } return i; };
  const link = (a, b) => { parents[root(b)] = root(a); };
  const keys = new Map();
  const point = new THREE.Vector3();
  for (let i = 0; i < positions.count; i++) {
    point.fromBufferAttribute(positions, i);
    const key = `${point.x.toFixed(4)},${point.y.toFixed(4)},${point.z.toFixed(4)}`;
    if (keys.has(key)) link(i, keys.get(key)); else keys.set(key, i);
  }
  const count = index?.count ?? positions.count;
  for (let offset = 0; offset < count; offset += 3) {
    const a = index ? index.getX(offset) : offset;
    link(a, index ? index.getX(offset + 1) : offset + 1);
    link(a, index ? index.getX(offset + 2) : offset + 2);
  }
  const components = new Map();
  for (let i = 0; i < positions.count; i++) {
    const id = root(i);
    if (!components.has(id)) components.set(id, { vertices: [], triangleOffsets: [], box: new THREE.Box3() });
    const part = components.get(id);
    part.vertices.push(i);
    part.box.expandByPoint(point.fromBufferAttribute(positions, i).applyMatrix4(matrixWorld));
  }
  for (let offset = 0; offset < count; offset += 3) components.get(root(index ? index.getX(offset) : offset)).triangleOffsets.push(offset);
  return [...components.values()];
}

function prepareOriginalGeometry(world, { preserveParkBulletin = false } = {}) {
  world.updateWorldMatrix(true, true);
  const changes = { foliage: [], parkCleanup: [], benches: BENCH_FACING.map((b) => ({ ...b, transformedVertices: 0 })), geometryReplacements: [] };
  const restore = [];
  const point = new THREE.Vector3();
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  const inverse = new THREE.Matrix4();
  const normal = new THREE.Vector3();
  world.traverse((mesh) => {
    if (!mesh.isMesh || mesh.isSkinnedMesh || !mesh.geometry?.attributes.position) return;
    const name = cleanName(mesh);
    const treeAtlas = /05 Street trees and planting|13 FADE PARK/.test(name) && /Nature dojo garage atlas/.test(name);
    const libraryLeaves = /11 COUNTY JAIL and LIBRARY/.test(name) && /10 Cel foliage/.test(name);
    const benchBatch = /07 Street props and front porches|13 FADE PARK/.test(name);
    let geometry = mesh.geometry;
    let copied = false;
    const copy = () => {
      if (!copied) { const original = geometry; geometry = original.clone(); mesh.geometry = geometry; restore.push({ mesh, original, replacement: geometry }); copied = true; }
    };
    const sourceParkProps = /13 FADE PARK|08 Parked car and basketball corner/.test(name);
    if (treeAtlas || libraryLeaves || sourceParkProps) {
      const components = connectedComponents(geometry, mesh.matrixWorld);
      const removeOffsets = new Set();
      for (const part of components) {
        if (!part.triangleOffsets.length) continue;
        part.box.getSize(size); part.box.getCenter(center);
        // Trunks and gate posts are narrow. Crown/planter patches span both
        // ground axes. Bench boards are only .52/.07 wide, so stay untouched.
        const leafPart = treeAtlas ? size.x > .8 && size.z > .7 && size.y > .5 : size.x > .7 && size.z > .7 && size.y < .6;
        const cleanup = sourceParkProps ? obsoleteParkPart(name, center, size) : null;
        if (preserveParkBulletin && cleanup && center.z > -16.4 && center.z < -15.7) {
          copy();
          const positions = geometry.attributes.position, normals = geometry.attributes.normal;
          for (const vertex of part.vertices) {
            point.fromBufferAttribute(positions, vertex).applyMatrix4(mesh.matrixWorld);
            point.x = 36 - point.x; point.z = -32.3 - point.z;
            point.applyMatrix4(inverse.copy(mesh.matrixWorld).invert()); positions.setXYZ(vertex, point.x, point.y, point.z);
            if (normals) { normal.fromBufferAttribute(normals, vertex); normal.x *= -1; normal.z *= -1; normals.setXYZ(vertex, normal.x, normal.y, normal.z); }
          }
          positions.needsUpdate = true; if (normals) normals.needsUpdate = true;
          continue;
        }
        if (!(leafPart && (treeAtlas || libraryLeaves)) && !cleanup) continue;
        for (const offset of part.triangleOffsets) removeOffsets.add(offset);
        const record = { source: mesh.name, center: center.toArray(), size: size.toArray(), triangles: part.triangleOffsets.length };
        if (cleanup) changes.parkCleanup.push({ ...record, reason: cleanup });
        else changes.foliage.push(record);
      }
      if (removeOffsets.size) {
        copy();
        const oldIndex = geometry.index; const count = oldIndex?.count ?? geometry.attributes.position.count;
        const kept = [];
        for (let offset = 0; offset < count; offset += 3) if (!removeOffsets.has(offset)) for (let n = 0; n < 3; n++) kept.push(oldIndex ? oldIndex.getX(offset + n) : offset + n);
        geometry.setIndex(kept);
        geometry.clearGroups();
      }
    }
    if (benchBatch && !mesh.userData.v3BenchFacing) {
      const positions = geometry.attributes.position;
      const normals = geometry.attributes.normal;
      inverse.copy(mesh.matrixWorld).invert();
      const normalWorld = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
      const normalLocal = new THREE.Matrix3().getNormalMatrix(inverse);
      for (let i = 0; i < positions.count; i++) {
        point.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld);
        const bench = changes.benches.find((b) => b.rotate && Math.abs(point.x - b.center[0]) <= .37 && Math.abs(point.z - b.center[2]) <= 1.0 && point.y >= .08 && point.y <= 1.4);
        if (!bench) continue;
        copy();
        point.x = 2 * bench.center[0] - point.x;
        point.z = 2 * bench.center[2] - point.z;
        point.applyMatrix4(inverse);
        geometry.attributes.position.setXYZ(i, point.x, point.y, point.z);
        if (normals) {
          normal.fromBufferAttribute(normals, i).applyMatrix3(normalWorld);
          normal.x *= -1; normal.z *= -1;
          normal.applyMatrix3(normalLocal).normalize();
          geometry.attributes.normal.setXYZ(i, normal.x, normal.y, normal.z);
        }
        bench.transformedVertices++;
      }
      if (copied) mesh.userData.v3BenchFacing = true;
    }
    if (copied) {
      geometry.attributes.position.needsUpdate = true;
      if (geometry.attributes.normal) geometry.attributes.normal.needsUpdate = true;
      geometry.computeBoundingBox(); geometry.computeBoundingSphere();
      changes.geometryReplacements.push({ source: mesh.name, triangles: triangleCount(geometry) });
    }
  });
  return { changes, restore };
}

function createLeafCards(texture, resources) {
  const placements = [];
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const direction = new THREE.Vector3();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const color = new THREE.Color();
  const put = (center, normal, width, height, seed, tone) => {
    direction.fromArray(normal).normalize();
    quaternion.setFromUnitVectors(FRONT, direction);
    position.fromArray(center); scale.set(width, height, 1);
    matrix.compose(position, quaternion, scale);
    placements.push({ matrix: matrix.clone(), phase: random(seed) * Math.PI * 2, tone });
  };
  for (const [treeIndex, tree] of TREE_PLACEMENTS.entries()) {
    // Three nested shelves form one generous silhouette. Radial cards face all
    // directions; the upper shelves tilt toward the sky to close overhead gaps.
    for (let level = 0; level < 3; level++) {
      const count = [11, 9, 6][level];
      const radius = tree.radius * [0.66, .51, .29][level];
      for (let i = 0; i < count; i++) {
        const seed = treeIndex * 101 + level * 17 + i;
        const angle = i / count * Math.PI * 2 + level * .68 + random(seed) * .25;
        const dx = Math.sin(angle), dz = Math.cos(angle);
        const y = tree.centerY + (level - .85) * tree.height * .29 + (random(seed + 3) - .5) * .22;
        put([tree.position[0] + dx * radius, y, tree.position[2] + dz * radius],
          [dx, .18 + level * .42, dz], tree.radius * (1.0 + random(seed + 1) * .24), tree.height * (.43 + random(seed + 2) * .09), seed,
          [.75, .93, 1.06][level] + dx * .06);
      }
    }
    // Two crossing interior cards prevent see-through slots at eye level.
    for (let i = 0; i < 2; i++) put([tree.position[0], tree.centerY, tree.position[2]], [Math.sin(i * Math.PI / 2 + .4), .12, Math.cos(i * Math.PI / 2 + .4)], tree.radius * 1.7, tree.height * .65, treeIndex * 43 + i, .86);
  }
  for (const [shrubIndex, shrub] of SHRUBS.entries()) for (let i = 0; i < 6; i++) {
    const angle = i * Math.PI / 3;
    put([shrub.position[0] + Math.sin(angle) * shrub.radius * .35, shrub.position[1], shrub.position[2] + Math.cos(angle) * shrub.radius * .35],
      [Math.sin(angle), .55, Math.cos(angle)], shrub.radius * 1.65, shrub.height, shrubIndex * 73 + i, .86 + (i % 3) * .075);
  }
  const geometry = new THREE.PlaneGeometry(1, 1, 1, 2);
  geometry.setAttribute('leafPhase', new THREE.InstancedBufferAttribute(new Float32Array(placements.map((p) => p.phase)), 1));
  geometry.setAttribute('leafTone', new THREE.InstancedBufferAttribute(new Float32Array(placements.map((p) => p.tone)), 1));
  const time = { value: 0 };
  const material = new THREE.MeshBasicMaterial({ map: texture, alphaTest: .42, alphaToCoverage: true, side: THREE.DoubleSide, depthWrite: true, transparent: false });
  material.name = 'Fadewood | one cutout leaf atlas + wind';
  material.customProgramCacheKey = () => 'fadewood-leaf-card-v1';
  material.onBeforeCompile = (shader) => {
    shader.uniforms.fadewoodTime = time;
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
      uniform float fadewoodTime;
      attribute float leafPhase;
      attribute float leafTone;
      varying float vLeafTone;`);
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float tip = uv.y * uv.y;
      float breeze = sin(fadewoodTime * 1.14 + leafPhase) + 0.36 * sin(fadewoodTime * 2.13 + leafPhase * 1.7);
      transformed.x += breeze * 0.026 * tip;
      transformed.z += sin(fadewoodTime * 0.83 + leafPhase + uv.y * 1.8) * 0.018 * tip;
      vLeafTone = leafTone;`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vLeafTone;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      diffuseColor.rgb *= mix(vec3(0.81, 0.90, 0.94), vec3(1.02, 1.01, 0.92), clamp((vLeafTone - 0.65) * 2.2, 0.0, 1.0)) * vLeafTone;`);
  };
  const leaves = new THREE.InstancedMesh(geometry, material, placements.length);
  leaves.name = 'Fadewood | layered painted leaf clusters';
  leaves.userData.noCollision = true;
  for (let i = 0; i < placements.length; i++) {
    leaves.setMatrixAt(i, placements[i].matrix);
    color.setRGB(1, 1, 1); leaves.setColorAt(i, color);
  }
  leaves.instanceMatrix.needsUpdate = true;
  leaves.computeBoundingBox(); leaves.boundingBox.expandByScalar(.18);
  leaves.computeBoundingSphere(); leaves.boundingSphere.radius += .18;
  resources.geometries.add(geometry); resources.materials.add(material);
  return { leaves, time, instances: placements.length, triangles: triangleCount(geometry) * placements.length };
}

function createMailboxes(resources) {
  const parts = [];
  const matrix = new THREE.Matrix4(), local = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion(), placementQuaternion = new THREE.Quaternion();
  const position = new THREE.Vector3(), scale = new THREE.Vector3();
  const color = new THREE.Color();
  const shape = (source, tint, center, size, euler = [0, 0, 0]) => {
    position.fromArray(center); scale.fromArray(size); quaternion.setFromEuler(new THREE.Euler(...euler)); local.compose(position, quaternion, scale);
    const copy = source.clone().applyMatrix4(local).applyMatrix4(matrix);
    color.set(tint);
    const colors = new Float32Array(copy.attributes.position.count * 3);
    for (let i = 0; i < copy.attributes.position.count; i++) color.toArray(colors, i * 3);
    copy.setAttribute('color', new THREE.BufferAttribute(colors, 3)); parts.push(copy);
  };
  const box = new THREE.BoxGeometry(1, 1, 1);
  const cap = new THREE.CylinderGeometry(1, 1, 1, 10, 1, false, -Math.PI / 2, Math.PI);
  for (const mailbox of MAILBOX_PLACEMENTS) {
    placementQuaternion.setFromAxisAngle(UP, mailbox.yaw); matrix.compose(new THREE.Vector3(...mailbox.position), placementQuaternion, new THREE.Vector3(1, 1, 1));
    const b = (tint, center, size, rotation) => shape(box, tint, center, size, rotation);
    b('#1d2b48', [0, .73, 0], [.72, .78, .59]);
    b('#326baf', [0, .75, .014], [.64, .73, .59]);
    shape(cap, '#1d2b48', [0, 1.12, 0], [.36, .59, .36], [-Math.PI / 2, 0, 0]);
    shape(cap, '#477fbd', [0, 1.12, .012], [.325, .61, .325], [-Math.PI / 2, 0, 0]);
    for (const side of [-1, 1]) b('#24334e', [side * .24, .22, 0], [.1, .44, .43]);
    b('#1d2b48', [0, 1.08, .326], [.46, .105, .025]);
    b('#91b4d4', [0, 1.035, .344], [.44, .023, .035]);
    b('#f2e4bc', [0, .78, .327], [.37, .23, .024]);
    b('#326baf', [-.082, .81, .344], [.208, .018, .012], [0, 0, -.52]);
    b('#326baf', [.082, .81, .344], [.208, .018, .012], [0, 0, .52]);
    b('#c86a60', [.22, .54, .329], [.06, .12, .015]);
  }
  const geometry = mergeGeometries(parts, false);
  for (const part of parts) part.dispose(); box.dispose(); cap.dispose();
  const material = new THREE.MeshBasicMaterial({ vertexColors: true });
  material.name = 'Fadewood | blue postal enamel';
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'Fadewood | four neighborhood mailboxes'; mesh.userData.noCollision = true;
  resources.geometries.add(geometry); resources.materials.add(material);
  return mesh;
}

function createHorizon(texture, neighborhoodTexture, resources, skyColor) {
  const group = new THREE.Group(); group.name = 'Fadewood | layered parallax horizon';
  const geometry = new THREE.CylinderGeometry(133, 133, 48, 96, 1, true);
  const image = texture.image;
  const aspect = image?.width && image?.height ? image.width / image.height : 4;
  texture.wrapS = THREE.RepeatWrapping;
  texture.repeat.x = Math.max(1, Math.round((Math.PI * 2 * 133 / 48) / aspect));
  texture.needsUpdate = true;
  const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide, fog: false, depthWrite: false, toneMapped: false });
  makePanoramaSeamless(material, skyColor);
  material.name = 'Fadewood | painted distant neighborhood';
  const cylinder = new THREE.Mesh(geometry, material);
  cylinder.position.set(0, 13, -5); cylinder.rotation.y = .56; cylinder.renderOrder = -10;
  cylinder.name = 'Fadewood | painted skyline at 133 metres'; cylinder.userData.nightArtwork = true;
  group.add(cylinder);
  resources.geometries.add(geometry); resources.materials.add(material);
  // An independent painted cutout replaces the 47 blue boxes and roofs. Both
  // belts remain fixed in world space: walking changes their relative angular
  // speed because they sit at different radii, without moving with the camera.
  // The 3:1 artwork leaves room above its roofs for transparent palm crowns;
  // its 330px roof line lands around 6m while the painted base stays buried.
  const radius = 94, height = 52, bottom = -22;
  const beltGeometry = new THREE.CylinderGeometry(radius, radius, height, 96, 1, true);
  const neighborhoodImage = neighborhoodTexture.image;
  const neighborhoodAspect = neighborhoodImage?.width && neighborhoodImage?.height ? neighborhoodImage.width / neighborhoodImage.height : 4;
  neighborhoodTexture.wrapS = THREE.RepeatWrapping;
  neighborhoodTexture.repeat.x = Math.max(1, Math.round((Math.PI * 2 * radius / height) / neighborhoodAspect));
  neighborhoodTexture.needsUpdate = true;
  const beltMaterial = new THREE.MeshBasicMaterial({
    map: neighborhoodTexture, side: THREE.BackSide, alphaTest: .1, alphaToCoverage: true,
    transparent: false, depthWrite: false, fog: true, toneMapped: false,
  });
  makePanoramaSeamless(beltMaterial);
  beltMaterial.name = 'Fadewood | atmospheric painted neighborhood cutout';
  const belt = new THREE.Mesh(beltGeometry, beltMaterial);
  belt.position.set(0, bottom + height / 2, -5); belt.rotation.y = .23; belt.renderOrder = -9;
  belt.name = 'Fadewood | painted near neighborhood at 94 metres'; belt.userData.nightArtwork = true;
  group.add(belt); resources.geometries.add(beltGeometry); resources.materials.add(beltMaterial);
  return group;
}

/** Layered cutout canopy system. Call after the avatar leaves `world`, before
 * building static colliders. Attach to the scene, outside static collision and
 * camera-ray lists. update() only changes one wind uniform; all cards are GPU
 * instances. `textures`/`textureLoader` allow deterministic non-DOM testing. */
export async function createAnimeEnvironment({ world, parent = world?.parent, renderer, textures, textureLoader = new THREE.TextureLoader(), preserveParkBulletin = false } = {}) {
  if (!world?.isObject3D || !parent?.isObject3D) throw new Error('Anime environment requires world and parent Object3D roots.');
  const resources = { geometries: new Set(), materials: new Set(), textures: new Set() };
  // Legacy CPU fixtures can supply the first two maps without causing a DOM
  // texture load. The playable path always loads the independent alpha cutout.
  const [leafTexture, panoramaTexture, neighborhoodTexture] = textures
    ? [textures.leaves, textures.panorama, textures.neighborhood ?? textures.panorama?.clone()]
    : await Promise.all([textureLoader.loadAsync(LEAF_URL), textureLoader.loadAsync(PANORAMA_URL), textureLoader.loadAsync(NEIGHBORHOOD_URL)]);
  if (!leafTexture?.isTexture || !panoramaTexture?.isTexture || !neighborhoodTexture?.isTexture) throw new Error('Anime environment requires leaf, panorama and neighborhood textures.');
  for (const texture of [leafTexture, panoramaTexture, neighborhoodTexture]) {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(4, renderer?.capabilities?.getMaxAnisotropy?.() ?? 1);
    resources.textures.add(texture);
  }
  const { changes, restore } = prepareOriginalGeometry(world, { preserveParkBulletin });
  // Parent is normally the scene. Also accept a nested environment group and
  // find its owning scene, so the rim follows the actual background colour.
  let backgroundScene = parent;
  while (backgroundScene && !backgroundScene.isScene) backgroundScene = backgroundScene.parent;
  const fallbackSky = new THREE.Color('#4eafce');
  const skyColor = (backgroundScene?.background?.isColor ? backgroundScene.background : fallbackSky).clone();
  const group = new THREE.Group(); group.name = 'Fadewood | lightweight anime environment';
  group.userData.isAnimeEnvironment = true;
  const foliage = createLeafCards(leafTexture, resources);
  const mailboxes = createMailboxes(resources);
  const horizon = createHorizon(panoramaTexture, neighborhoodTexture, resources, skyColor);
  group.add(horizon, foliage.leaves, mailboxes);
  group.traverse((o) => { o.userData.noCollision = true; o.userData.isAnimeEnvironment = true; });
  parent.add(group);
  const removedTriangles = changes.foliage.reduce((sum, part) => sum + part.triangles, 0);
  const stats = {
    trees: TREE_PLACEMENTS.length, shrubs: SHRUBS.length, leafCards: foliage.instances,
    leafDrawCalls: 1, leafTriangles: foliage.triangles, leafMaterials: 1, leafTextures: 1,
    removedFoliageComponents: changes.foliage.length, removedFoliageTriangles: removedTriangles,
    removedParkClutterComponents: changes.parkCleanup.length,
    removedParkClutterTriangles: changes.parkCleanup.reduce((sum, part) => sum + part.triangles, 0),
    removedStrayHoopComponents: changes.parkCleanup.filter((part) => part.reason === 'post-office stray basketball hoop').length,
    benches: BENCH_FACING.length, benchesCorrected: changes.benches.filter((b) => b.transformedVertices > 0).length,
    mailboxes: MAILBOX_PLACEMENTS.length, panoramaLayers: 2, panoramaDrawCalls: 2,
    panoramaTextureRepeats: panoramaTexture.repeat.x, neighborhoodTextureRepeats: neighborhoodTexture.repeat.x,
    meshes: 4, materials: resources.materials.size, textures: resources.textures.size,
    triangles: foliage.triangles + triangleCount(mailboxes.geometry) + triangleCount(horizon.children[0].geometry) + triangleCount(horizon.children[1].geometry),
    windUniformsUpdatedPerFrame: 1, perFrameVertexWalks: 0,
  };
  let disposed = false;
  return {
    group, stats, changes, hiddenOriginals: [],
    syncBackdropSky() {
      if (!disposed) skyColor.copy(backgroundScene?.background?.isColor ? backgroundScene.background : fallbackSky);
    },
    setBackdrop(panorama, neighborhood) {
      if (disposed) return;
      for (const [mesh, map, reference] of [[horizon.children[0], panorama, panoramaTexture], [horizon.children[1], neighborhood, neighborhoodTexture]]) {
        map.wrapS = reference.wrapS; map.wrapT = reference.wrapT;
        map.repeat.copy(reference.repeat); map.offset.copy(reference.offset);
        map.needsUpdate = true; mesh.material.map = map; mesh.material.needsUpdate = true;
      }
    },
    restoreBackdrop() {
      if (disposed) return;
      horizon.children[0].material.map = panoramaTexture; horizon.children[0].material.needsUpdate = true;
      horizon.children[1].material.map = neighborhoodTexture; horizon.children[1].material.needsUpdate = true;
    },
    update(elapsedSeconds, camera) {
      if (disposed) return;
      foliage.time.value = Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0;
      skyColor.copy(backgroundScene?.background?.isColor ? backgroundScene.background : fallbackSky);
      if (camera) group.userData.cameraXZ = [camera.position.x, camera.position.z];
    },
    dispose() {
      if (disposed) return; disposed = true;
      group.removeFromParent();
      for (const { mesh, original, replacement } of restore) { if (mesh.geometry === replacement) mesh.geometry = original; replacement.dispose(); delete mesh.userData.v3BenchFacing; }
      for (const geometry of resources.geometries) geometry.dispose();
      for (const material of resources.materials) material.dispose();
      for (const texture of resources.textures) texture.dispose();
      foliage.leaves.dispose();
    },
  };
}
