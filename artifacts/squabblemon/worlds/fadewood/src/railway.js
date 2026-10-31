import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const BASE_URL = import.meta.env?.BASE_URL ?? '/';
export const TRAIN_ATLAS_URL = `${BASE_URL}assets/v3/fadewood-train.webp`;
export const RAILWAY_LAYOUT = Object.freeze({
  minX: -42, maxX: 42, minZ: -64, maxZ: 58, cornerRadius: 17,
  railY: .29, gauge: 1.8, ballastWidth: 5.6, speed: 7.2,
  trainOffsets: [0, 10.0, 20.1], trainLengths: [8.8, 9.0, 9.0],
  playerBounds: { minX: -29, maxX: 29, minZ: -49, maxZ: 49 },
});

/** Exact arc-length rounded rectangle: constant speed needs no sampled-curve
 * lookup and the tangent agrees at every line/arc join, including the seam. */
export function createRailwayPath(layout = RAILWAY_LAYOUT) {
  const { minX, maxX, minZ, maxZ, cornerRadius: r } = layout;
  const horizontal = maxX - minX - 2 * r;
  const vertical = maxZ - minZ - 2 * r;
  if (!(r > 0 && horizontal > 0 && vertical > 0)) throw new Error('Rail loop requires positive straight sections and corner radius.');
  const arc = Math.PI * r / 2;
  const segments = [
    { length: horizontal, start: [minX + r, maxZ], tangent: [1, 0] },
    { length: arc, center: [maxX - r, maxZ - r], angle: Math.PI / 2 },
    { length: vertical, start: [maxX, maxZ - r], tangent: [0, -1] },
    { length: arc, center: [maxX - r, minZ + r], angle: 0 },
    { length: horizontal, start: [maxX - r, minZ], tangent: [-1, 0] },
    { length: arc, center: [minX + r, minZ + r], angle: -Math.PI / 2 },
    { length: vertical, start: [minX, minZ + r], tangent: [0, 1] },
    { length: arc, center: [minX + r, maxZ - r], angle: -Math.PI },
  ];
  const length = segments.reduce((sum, s) => sum + s.length, 0);
  const joins = [0];
  for (const segment of segments) joins.push(joins.at(-1) + segment.length);
  function sample(distance, target = {}) {
    let d = ((distance % length) + length) % length;
    let segment = segments.at(-1);
    for (const candidate of segments) {
      segment = candidate;
      if (d <= segment.length) break;
      d -= segment.length;
    }
    const point = target.position ?? new THREE.Vector3();
    const tangent = target.tangent ?? new THREE.Vector3();
    if (segment.center) {
      const angle = segment.angle - d / r;
      point.set(segment.center[0] + r * Math.cos(angle), layout.railY, segment.center[1] + r * Math.sin(angle));
      tangent.set(Math.sin(angle), 0, -Math.cos(angle));
    } else {
      point.set(segment.start[0] + d * segment.tangent[0], layout.railY, segment.start[1] + d * segment.tangent[1]);
      tangent.set(segment.tangent[0], 0, segment.tangent[1]);
    }
    target.position = point; target.tangent = tangent;
    target.yaw = Math.atan2(tangent.x, tangent.z);
    return target;
  }
  return { length, joins, sample, segments };
}

const INK = '#11182c';
const TONES = { ink: INK, wood: '#514638', rail: '#a8b5b1', ballast: '#8c8070', earth: '#b3a179', olive: '#778765', shade: '#616d58', cream: '#eedbb0', red: '#c15347', yellow: '#e5b54d' };
const color = new THREE.Color();
const triangleCount = (geometry) => (geometry.index?.count ?? geometry.attributes.position.count) / 3;

function tinted(geometry, tone) {
  color.set(tone);
  const values = new Float32Array(geometry.attributes.position.count * 3);
  for (let i = 0; i < values.length; i += 3) color.toArray(values, i);
  geometry.setAttribute('color', new THREE.BufferAttribute(values, 3));
  return geometry;
}
function box(width, height, depth, x, y, z, tone = INK, yaw = 0) {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  geometry.rotateY(yaw); geometry.translate(x, y, z);
  return tinted(geometry, tone);
}
function merge(parts) {
  const geometry = mergeGeometries(parts, false);
  for (const part of parts) part.dispose();
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}
function addBatch(group, name, parts, material) {
  const mesh = new THREE.Mesh(merge(parts), material);
  mesh.name = name; mesh.userData.noCollision = true; group.add(mesh);
  return mesh;
}

// Offset strips follow the same analytic path as the train, rails and ties.
// Their raised tops cover existing gray earth without replacing source meshes.
function ribbon(path, inner, outer, y, tone, samples = 320) {
  const positions = [], indices = [], uvs = [];
  for (let i = 0; i <= samples; i++) {
    const { position: p, tangent: t } = path.sample(i * path.length / samples);
    const nx = -t.z, nz = t.x;
    positions.push(p.x + nx * inner, y, p.z + nz * inner, p.x + nx * outer, y, p.z + nz * outer);
    uvs.push(i / samples, 0, i / samples, 1);
    if (i < samples) { const a = i * 2; indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return tinted(geometry, tone);
}
function railTube(path, offset, bottom, top, width, tone, samples = 320) {
  const pieces = [];
  // Top and two sides provide a chunky ink edge from low arrival cameras.
  pieces.push(ribbon(path, offset - width / 2, offset + width / 2, top, tone, samples));
  for (const sign of [-1, 1]) {
    const positions = [], uvs = [], indices = [];
    for (let i = 0; i <= samples; i++) {
      const { position: p, tangent: t } = path.sample(i * path.length / samples);
      const o = offset + sign * width / 2;
      positions.push(p.x - t.z * o, bottom, p.z + t.x * o, p.x - t.z * o, top, p.z + t.x * o);
      uvs.push(i / samples, 0, i / samples, 1);
      if (i < samples) { const a = i * 2; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); geometry.setIndex(indices); geometry.computeVertexNormals();
    pieces.push(tinted(geometry, INK));
  }
  return merge(pieces);
}
function polygon(x, z, rx, rz, y, tone, seed) {
  const points = [x, y, z]; const uv = [.5, .5]; const indices = [];
  const sides = 9;
  for (let i = 0; i < sides; i++) {
    const angle = i / sides * Math.PI * 2;
    const variation = .86 + .14 * Math.sin(i * 2.7 + seed);
    points.push(x + Math.cos(angle) * rx * variation, y, z + Math.sin(angle) * rz * variation);
    uv.push(.5 + Math.cos(angle) * .5, .5 + Math.sin(angle) * .5);
    indices.push(0, i + 1, (i + 1) % sides + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(indices); geometry.computeVertexNormals();
  return tinted(geometry, tone);
}

// All four atlas panels use the same Texture. UVs choose a grid cell without
// cloning textures/materials or making separate image requests per carriage.
export function trainPanel(width, height, column, row, position, yaw = 0, roof = false, mirror = false) {
  const geometry = new THREE.PlaneGeometry(width, height);
  const uv = geometry.attributes.uv;
  const inset = .007;
  for (let i = 0; i < uv.count; i++) {
    const u = inset + (mirror ? 1 - uv.getX(i) : uv.getX(i)) * (1 - 2 * inset);
    const v = inset + uv.getY(i) * (1 - 2 * inset);
    uv.setXY(i, (column + u) / 2, 1 - (row + 1 - v) / 2);
  }
  if (roof) geometry.rotateX(-Math.PI / 2);
  else geometry.rotateY(yaw);
  geometry.translate(...position);
  return geometry;
}
function carGeometry(index, length) {
  const engine = index === 0;
  const parts = [box(3.36, 2.95, length, 0, 2.63, 0), box(3.5, .28, length + .1, 0, 1.15, 0), box(3.5, .21, length + .15, 0, 4.15, 0)];
  parts.push(box(3.18, .29, length - .15, 0, 4.34, 0, engine ? TONES.red : TONES.cream));
  // Rectangular painted sides sit inside a crisp black structural silhouette.
  const panels = [
    trainPanel(length - .15, 2.76, engine ? 0 : 1, 0, [1.686, 2.65, 0], Math.PI / 2, false, engine),
    trainPanel(length - .15, 2.76, engine ? 0 : 1, 0, [-1.686, 2.65, 0], -Math.PI / 2),
    trainPanel(3.13, length - .2, 1, 1, [0, 4.492, 0], 0, true),
  ];
  if (engine) panels.push(trainPanel(3.17, 2.74, 0, 1, [0, 2.65, length / 2 + .008]));
  for (const end of engine ? [-1] : [-1, 1]) {
    const z = end * (length / 2 + .015);
    parts.push(box(3.17, 2.76, .03, 0, 2.65, z, TONES.cream));
    parts.push(box(1.02, 2.3, .06, 0, 2.42, z + end * .025), box(.84, 2.12, .07, 0, 2.42, z + end * .035, TONES.red));
    parts.push(box(.62, .74, .08, 0, 2.87, z + end * .045, '#203d4d'));
    parts.push(box(1.15, .11, .32, 0, 1.24, z + end * .12));
  }
  // Air boxes and guard rails give the simple prism a readable 3D form.
  parts.push(box(1.25, .3, 1.75, 0, 4.62, -.8), box(1.1, .32, 1.55, 0, 4.65, -.8, TONES.rail));
  parts.push(box(3.53, .17, .36, 0, 1.04, length / 2 + .2), box(3.53, .17, .36, 0, 1.04, -length / 2 - .2));
  if (engine) {
    parts.push(box(1.2, .38, .24, 0, 3.28, length / 2 + .13, TONES.cream));
    parts.push(box(.25, .45, .7, -1.3, 1.28, length / 2 + .25), box(.25, .45, .7, 1.3, 1.28, length / 2 + .25));
  }
  return { body: merge(parts), paint: merge(panels) };
}
function bogieGeometry() {
  const parts = [box(2.55, .26, 1.65, 0, .06, 0), box(1.75, .38, 1.4, 0, .11, 0, TONES.wood)];
  for (const x of [-1.1, 1.1]) for (const z of [-.55, .55]) {
    const wheel = new THREE.CylinderGeometry(.52, .52, .28, 10, 1);
    wheel.rotateZ(Math.PI / 2); wheel.translate(x, 0, z); parts.push(tinted(wheel, INK));
    const hub = new THREE.CylinderGeometry(.26, .26, .291, 10, 1);
    hub.rotateZ(Math.PI / 2); hub.translate(x, 0, z); parts.push(tinted(hub, TONES.rail));
  }
  return merge(parts);
}

export async function createRailway({ parent = null, renderer = null, texture = null } = {}) {
  let ownsTexture = false;
  if (!texture) { texture = await new THREE.TextureLoader().loadAsync(TRAIN_ATLAS_URL); ownsTexture = true; }
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, renderer?.capabilities?.getMaxAnisotropy?.() ?? 1);
  const path = createRailwayPath();
  const group = new THREE.Group(); group.name = 'Fadewood railway'; group.userData.noCollision = true;
  const flat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, toneMapped: false }); flat.name = 'Railway cel colors';
  const paint = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, toneMapped: false }); paint.name = 'Fadewood train painted atlas';
  // Audited source earth is exactly x±50,z−110..90, topY−.67. These
  // low soil terraces sit .03m above it, below every street/sidewalk. Four
  // rectangles leave the existing town's ground alone and cover the visible
  // gray margins. They do not enter collision or alter any source geometry.
  const terrace = (minX, maxX, minZ, maxZ, tone) => {
    const geometry = new THREE.PlaneGeometry(maxX - minX, maxZ - minZ);
    geometry.rotateX(-Math.PI / 2); geometry.translate((minX + maxX) / 2, -.64, (minZ + maxZ) / 2);
    return tinted(geometry, tone);
  };
  const terrain = [
    terrace(-50, -29, -110, 90, '#a69a79'),
    terrace(29, 50, -110, 90, '#ad9d79'),
    terrace(-29, 29, -110, -54, '#a69a79'),
    terrace(-29, 29, 46, 90, '#b3a179'),
    ribbon(path, -9, 9, .064, TONES.earth), ribbon(path, 6.7, 10.8, .065, TONES.olive), ribbon(path, -6.9, -5.1, .066, TONES.olive)];
  const fixtures = [];
  for (let i = 0; i < 62; i++) {
    const { position: p, tangent: t } = path.sample((i + .33) / 62 * path.length);
    const offset = i % 2 ? 5.3 : -5.0;
    const x = p.x - t.z * offset, z = p.z + t.x * offset;
    terrain.push(polygon(x, z, 1.15 + (i % 4) * .4, .55 + (i % 3) * .35, .072 + (i % 3) * .001, i % 3 ? TONES.olive : TONES.shade, i));
    // Small angular stones share one batch; no individual Object3D overhead.
    fixtures.push(box(.34, .19, .27, p.x - t.z * 3.3, .18, p.z + t.x * 3.3, i % 2 ? TONES.cream : TONES.ballast, i));
  }
  addBatch(group, 'Railway earth and olive ground patches', terrain, flat);
  addBatch(group, 'Railway ballast shoulder', [ribbon(path, -2.85, 2.85, .13, TONES.ink), ribbon(path, -2.68, 2.68, .145, TONES.ballast), ribbon(path, -2.3, 2.3, .15, '#a29278')], flat);
  const railParts = [-1, 1].map((sign) => railTube(path, sign * RAILWAY_LAYOUT.gauge / 2, .21, .32, .15, TONES.rail));
  addBatch(group, 'Railway twin steel rails with ink edges', railParts, flat);
  const tieCount = Math.ceil(path.length / 1.55);
  const ties = new THREE.InstancedMesh(box(2.95, .12, .27, 0, 0, 0, TONES.wood), flat, tieCount);
  ties.name = 'Railway wooden sleepers'; ties.userData.noCollision = true;
  const matrix = new THREE.Matrix4(), quaternion = new THREE.Quaternion(), position = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0), scale = new THREE.Vector3(1, 1, 1);
  for (let i = 0; i < tieCount; i++) {
    const sample = path.sample(i / tieCount * path.length);
    quaternion.setFromAxisAngle(up, sample.yaw); position.copy(sample.position); position.y = .203;
    matrix.compose(position, quaternion, scale); ties.setMatrixAt(i, matrix);
  }
  ties.instanceMatrix.needsUpdate = true; ties.computeBoundingSphere(); group.add(ties);
  // Sparse inner rail-yard fencing leaves broad sightlines between town and train.
  for (const side of [-1, 1]) for (let i = 0; i < 13; i++) {
    const x = side * 35.1, z = -33 + i * 5.4;
    fixtures.push(box(.13, 1.3, .13, x, .72, z), box(.14, .13, 5.5, x, 1.09, z + 2.7), box(.14, .1, 5.5, x, .55, z + 2.7, TONES.wood));
  }
  for (const distance of [35, path.length / 2 + 35]) {
    const { position: p, tangent: t } = path.sample(distance);
    const x = p.x - t.z * 3.9, z = p.z + t.x * 3.9;
    fixtures.push(box(.19, 2.5, .19, x, 1.35, z), box(.65, 1.03, .31, x, 2.4, z));
    fixtures.push(box(.3, .3, .34, x, 2.64, z, TONES.red), box(.3, .3, .34, x, 2.19, z, TONES.yellow));
  }
  addBatch(group, 'Railway stones fences and two signals', fixtures, flat);

  const cars = [];
  RAILWAY_LAYOUT.trainLengths.forEach((length, index) => {
    const car = new THREE.Group(); car.name = index ? `Fadewood train carriage ${index}` : 'Fadewood train engine';
    const geometry = carGeometry(index, length);
    const body = new THREE.Mesh(geometry.body, flat); body.name = `${car.name} ink silhouette`;
    const skin = new THREE.Mesh(geometry.paint, paint); skin.name = `${car.name} painted panels`;
    body.userData.noCollision = true; skin.userData.noCollision = true; car.add(body, skin); group.add(car); cars.push(car);
  });
  const bogies = new THREE.InstancedMesh(bogieGeometry(), flat, 6); bogies.name = 'Fadewood train articulated bogies'; bogies.userData.noCollision = true; bogies.instanceMatrix.setUsage(THREE.DynamicDrawUsage); group.add(bogies);
  const couplers = new THREE.InstancedMesh(box(.28, .24, 1, 0, 0, 0), flat, 2); couplers.name = 'Fadewood train couplers'; couplers.userData.noCollision = true; couplers.instanceMatrix.setUsage(THREE.DynamicDrawUsage); group.add(couplers);
  const scratchA = { position: new THREE.Vector3(), tangent: new THREE.Vector3() };
  const scratchB = { position: new THREE.Vector3(), tangent: new THREE.Vector3() };
  const difference = new THREE.Vector3();
  let disposed = false;
  function update(elapsedSeconds) {
    if (disposed) return;
    const distance = (Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0) * RAILWAY_LAYOUT.speed + 31;
    cars.forEach((car, i) => {
      const centerDistance = distance - RAILWAY_LAYOUT.trainOffsets[i];
      path.sample(centerDistance - 2.7, scratchA); path.sample(centerDistance + 2.7, scratchB);
      // Chord between the two trucks, so the body stays seated above articulated
      // bogies on bends instead of sliding sideways around a sampled center.
      car.position.copy(scratchA.position).add(scratchB.position).multiplyScalar(.5); car.position.y = 0;
      difference.subVectors(scratchB.position, scratchA.position); car.rotation.y = Math.atan2(difference.x, difference.z);
      car.updateMatrix();
      for (let truck = 0; truck < 2; truck++) {
        const sample = path.sample(centerDistance + (truck ? 2.7 : -2.7), scratchA);
        position.copy(sample.position); position.y = .84; quaternion.setFromAxisAngle(up, sample.yaw);
        scale.set(1, 1, 1); matrix.compose(position, quaternion, scale); bogies.setMatrixAt(i * 2 + truck, matrix);
      }
    });
    cars.forEach((car, i) => {
      if (!i) return;
      const ahead = cars[i - 1];
      scratchA.position.set(0, 1.03, -RAILWAY_LAYOUT.trainLengths[i - 1] / 2).applyMatrix4(ahead.matrix);
      scratchB.position.set(0, 1.03, RAILWAY_LAYOUT.trainLengths[i] / 2).applyMatrix4(car.matrix);
      position.copy(scratchA.position).add(scratchB.position).multiplyScalar(.5);
      difference.subVectors(scratchA.position, scratchB.position); quaternion.setFromAxisAngle(up, Math.atan2(difference.x, difference.z));
      scale.set(1, 1, difference.length()); matrix.compose(position, quaternion, scale); couplers.setMatrixAt(i - 1, matrix);
    });
    bogies.instanceMatrix.needsUpdate = true; couplers.instanceMatrix.needsUpdate = true;
    // An animated instance's initial bounding sphere cannot be reused after it
    // circles the block. Cheap fixed bounds avoid CPU recomputation each frame.
  }
  const loopBounds = new THREE.Sphere(new THREE.Vector3(0, 2, -3), 80);
  bogies.boundingSphere = loopBounds.clone(); couplers.boundingSphere = loopBounds.clone();
  update(0);
  const stats = { meshes: 0, triangles: 0, materials: 2, textures: 1, sleepers: tieCount, cars: 3, wheels: 24, loopLength: path.length, lapSeconds: path.length / RAILWAY_LAYOUT.speed, speed: RAILWAY_LAYOUT.speed };
  group.traverse((object) => { if (object.isMesh) { stats.meshes++; stats.triangles += triangleCount(object.geometry) * (object.isInstancedMesh ? object.count : 1); } });
  const manifest = { version: 1, layout: RAILWAY_LAYOUT, pathLength: path.length, lapSeconds: stats.lapSeconds, phaseDistance: 31, atlas: { url: TRAIN_ATLAS_URL, columns: 2, rows: 2, cells: { engineSide: [0, 0], carriageSide: [1, 0], cabFront: [0, 1], roof: [1, 1] } }, stats };
  group.userData.railway = manifest;
  parent?.add(group);
  function sampleMotion() {
    return cars.map((car, index) => ({
      id: index ? `carriage-${index}` : 'engine', name: car.name,
      position: car.position.toArray(), yaw: car.rotation.y,
      distanceBehindEngine: RAILWAY_LAYOUT.trainOffsets[index],
    }));
  }
  function dispose() {
    if (disposed) return;
    disposed = true; group.removeFromParent();
    const geometries = new Set(); group.traverse((object) => { if (object.geometry) geometries.add(object.geometry); });
    for (const geometry of geometries) geometry.dispose();
    flat.dispose(); paint.dispose(); if (ownsTexture) texture.dispose();
  }
  return { group, path, manifest, stats, update, sampleMotion, dispose, cars, texture };
}
