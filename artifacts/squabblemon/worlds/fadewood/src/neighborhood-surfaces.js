import * as THREE from 'three';
import { connectedComponents } from './anime-environment.js';

// All three maps are already resident in the world GLB. New faces share the
// existing images; no duplicate download, image decode, or shader is needed.
export const NEIGHBORHOOD_SURFACE_ATLASES = Object.freeze({
  brick: { material: /16 Painted neighborhood atlas/, image: 'neighborhood-surfaces.png', crop: [4 / 1254, 4 / 1254, .5 - 4 / 1254, .5 - 4 / 1254] },
  finish: { material: /22 Shared roof plaster concrete grass atlas/, image: 'street-finishing-atlas.png', crop: [4 / 1536, .5 + 4 / 1024, 1 / 3 - 4 / 1536, 1 - 4 / 1024] },
  timber: { material: /21 Nature dojo garage atlas/, image: 'nature-dojo-garage-atlas.png', crop: [4 / 1254, .214, 1 - 4 / 1254, .394] },
});

const clean = (name) => name.replaceAll('_', ' ').replace(/ mesh(?: painted finish)?(?: \d+)?$/, '');
const close = (a, b, tolerance = .04) => Math.abs(a - b) < tolerance;
const finite = (values) => values.every(Number.isFinite);

/** Deliberately narrow authoring rules. Batch names alone never select an
 * entire material: cream/wood/brick batches also contain lettering and props.
 * Hero graffiti, mapped facades, signs, windows and outlines are not targets. */
function classify(name, center, size, triangles) {
  const vertical = (normal) => Math.abs(normal.y) < .15;
  const upright = (normal) => normal.y > -.15;
  const rear = (normal) => normal.z < -.98;
  if (/^(FADE MARKET|SQUABBLE HOUSE) simple collision shell$/.test(name) && close(size.x, 19.5) && close(size.z, 11.5)) {
    return { category: 'shop rear walls', atlas: 'brick', module: [2.8, 2.8], faces: rear };
  }
  if (/03 Housing .* (04 Brick coral|05 Faded teal)$/.test(name) && close(size.x, 3.5) && close(size.z, 4) && close(size.y, 2)) {
    return { category: 'apartment rooftop rooms', atlas: 'brick', module: [2.8, 2.8], faces: upright, tint: [.78, .83, .85] };
  }
  if (/05 Street trees and planting.*04 Brick coral$/.test(name) && close(size.x, 1.1) && close(size.z, 1.6) && close(size.y, .65)) {
    return { category: 'street planter boxes', atlas: 'brick', module: [2.8, 2.8], faces: upright };
  }
  // Rear/west county walls are already plaster-mapped; the plain front/east
  // primitive retains an exposed band above the shorter civic illustration.
  if (/11 COUNTY JAIL and LIBRARY.*02 Warm cream$/.test(name) && close(size.x, 10.7) && close(size.z, 22) && close(size.y, 6.4) && triangles === 8) {
    return { category: 'county upper wall and facade undercoat', atlas: 'finish', module: [4, 4], crop: [2 / 3 + 4 / 1536, 4 / 1024, 1 - 4 / 1536, .5 - 4 / 1024], faces: vertical };
  }
  if (/11 COUNTY JAIL and LIBRARY.*04 Brick coral$/.test(name)) {
    if (close(size.x, 10.85) && close(size.z, 22.1) && close(size.y, .45)) return { category: 'county brick foundation', atlas: 'brick', module: [2.8, 2.8], faces: vertical };
    if (close(size.x, 1.15) && close(size.z, 1.15) && close(size.y, .6)) return { category: 'library planter boxes', atlas: 'brick', module: [2.8, 2.8], faces: upright };
  }
  if (/14 Neighborhood DOJO.*04 Brick coral$/.test(name) && close(size.x, 1.1) && close(size.z, 1.1) && close(size.y, .55)) {
    return { category: 'dojo planter boxes', atlas: 'brick', module: [2.8, 2.8], faces: upright };
  }
  if (/15 Small house with open garage.*04 Brick coral$/.test(name) && ((close(size.x, 6.35) && close(size.z, 8.75)) || (close(size.x, .55) && close(size.z, .65)))) {
    return { category: size.y > 1 ? 'house chimney' : 'house brick foundation', atlas: 'brick', module: [2.8, 2.8], faces: upright };
  }
  if (/07 Street props and front porches.*(02 Warm cream|11 Weathered wood)$/.test(name) && close(center.z, 32.5) && ((close(center.x, 20) && close(size.x, 1)) || (close(center.x, 21.1) && close(size.x, .8)))) {
    return { category: 'market delivery boxes', atlas: 'timber', module: [2.4, .56], faces: upright, tint: [.85, .79, .65] };
  }
  if (/15 Small house with open garage.*02 Warm cream$/.test(name) && close(center.x, 12.9) && close(center.z, -43.6) && close(size.x, .75)) {
    return { category: 'garage supply box', atlas: 'timber', module: [2.4, .56], faces: upright, tint: [.85, .79, .65] };
  }
  if (/15 Small house with open garage.*11 Weathered wood$/.test(name) && triangles === 12 && size.x > .2 && size.y > .09 && size.z > .17) {
    return { category: 'garage timber and workbench', atlas: 'timber', module: [2.4, .56], faces: upright };
  }
  if (/14 Neighborhood DOJO.*11 Weathered wood$/.test(name) && size.x > 10 && size.y < .25 && size.z > 1) {
    return { category: 'dojo timber foundation', atlas: 'timber', module: [2.4, .56], faces: upright };
  }
  if (/01 Street and fight apron.*03 Warm sidewalk$/.test(name) && close(size.x, 58) && close(size.z, 100) && close(size.y, .08) && triangles === 12) {
    return { category: 'alley and inter-building concrete', atlas: 'finish', module: [4, 4], faces: (normal) => normal.y > .98, tint: [.92, .92, .94] };
  }
  return null;
}

/** Exposes the exact selected source components for audits and source export. */
export function neighborhoodSurfacePlacements(world) {
  if (!world?.isObject3D) throw new Error('Neighborhood surfaces require the loaded world.');
  world.updateWorldMatrix(true, true);
  const records = [];
  world.traverse((mesh) => {
    if (!mesh.isMesh || mesh.isSkinnedMesh || !mesh.geometry?.attributes.position) return;
    const name = clean(mesh.name);
    if (!/simple collision shell|03 Housing|05 Street trees|11 COUNTY|14 Neighborhood DOJO|15 Small house|07 Street props|01 Street/.test(name)) return;
    // A mapped material is already finished. This also disambiguates glTF
    // primitives whose parent has the same name as the plain source batch.
    if ((Array.isArray(mesh.material) ? mesh.material : [mesh.material]).some((material) => material?.map)) return;
    for (const component of connectedComponents(mesh.geometry, mesh.matrixWorld)) {
      if (!component.triangleOffsets.length) continue;
      const size = component.box.getSize(new THREE.Vector3());
      const center = component.box.getCenter(new THREE.Vector3());
      const rule = classify(name, center, size, component.triangleOffsets.length);
      if (!rule) continue;
      records.push({ source: mesh.name, category: rule.category, atlas: rule.atlas, module: rule.module, crop: rule.crop ?? NEIGHBORHOOD_SURFACE_ATLASES[rule.atlas].crop, tint: rule.tint ?? [1, 1, 1], min: component.box.min.toArray(), max: component.box.max.toArray(), sourceTriangles: component.triangleOffsets.length, mesh, component, faceFilter: rule.faces });
    }
  });
  return records;
}

// Clip each triangle against metre-scale atlas modules. UVs never leave the
// selected painted tile, including at corners. Unlike shader fract(), these
// ordinary UV triangles survive export to Blender/glTF without a custom shader.
function clip(polygon, axis, value, keepAbove) {
  const result = [];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length];
    const da = a[axis] - value, db = b[axis] - value;
    const insideA = keepAbove ? da >= -1e-8 : da <= 1e-8;
    const insideB = keepAbove ? db >= -1e-8 : db <= 1e-8;
    if (insideA) result.push(a);
    if (insideA !== insideB) {
      const t = da / (da - db);
      result.push(a.map((v, j) => v + (b[j] - v) * t));
    }
  }
  return result;
}

function appendComponent(record, texture, target) {
  const { mesh, component, faceFilter, module: [moduleU, moduleV], tint, atlas } = record;
  const positions = mesh.geometry.attributes.position, index = mesh.geometry.index;
  const points = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  const edgeA = new THREE.Vector3(), edgeB = new THREE.Vector3(), normal = new THREE.Vector3();
  const [left, top, right, bottom] = record.crop;
  let area = 0, triangles = 0;
  for (const offset of component.triangleOffsets) {
    for (let i = 0; i < 3; i++) points[i].fromBufferAttribute(positions, index ? index.getX(offset + i) : offset + i).applyMatrix4(mesh.matrixWorld);
    normal.crossVectors(edgeA.subVectors(points[1], points[0]), edgeB.subVectors(points[2], points[0]));
    const triangleArea = normal.length() * .5;
    if (triangleArea < 1e-8) continue;
    normal.normalize();
    if (!faceFilter(normal)) continue;
    area += triangleArea;
    const ax = Math.abs(normal.x), ay = Math.abs(normal.y), az = Math.abs(normal.z);
    const shade = ay > .8 ? 1 : normal.z < -.5 ? .88 : normal.x > .5 ? .93 : .98;
    const project = ay > ax && ay > az ? (p) => [p.x, -p.z] : ax > az ? (p) => [normal.x > 0 ? -p.z : p.z, p.y] : (p) => [normal.z > 0 ? p.x : -p.x, p.y];
    const polygon = points.map((p) => [...project(p), p.x + normal.x * .003, p.y + normal.y * .003, p.z + normal.z * .003]);
    const minU = Math.min(...polygon.map((p) => p[0])), maxU = Math.max(...polygon.map((p) => p[0]));
    const minV = Math.min(...polygon.map((p) => p[1])), maxV = Math.max(...polygon.map((p) => p[1]));
    const startU = Math.floor(minU / moduleU), endU = Math.ceil((maxU - 1e-8) / moduleU);
    const startV = Math.floor(minV / moduleV), endV = Math.ceil((maxV - 1e-8) / moduleV);
    for (let u = startU; u < endU; u++) for (let v = startV; v < endV; v++) {
      let piece = clip(polygon, 0, u * moduleU, true);
      piece = clip(piece, 0, (u + 1) * moduleU, false);
      piece = clip(piece, 1, v * moduleV, true);
      piece = clip(piece, 1, (v + 1) * moduleV, false);
      for (let i = 1; i + 1 < piece.length; i++) {
        const corners = [piece[0], piece[i], piece[i + 1]];
        edgeA.set(corners[1][2] - corners[0][2], corners[1][3] - corners[0][3], corners[1][4] - corners[0][4]);
        edgeB.set(corners[2][2] - corners[0][2], corners[2][3] - corners[0][3], corners[2][4] - corners[0][4]);
        if (normal.crossVectors(edgeA, edgeB).lengthSq() < 1e-14) continue;
        for (const corner of corners) {
          target.position.push(...corner.slice(2));
          const localU = THREE.MathUtils.clamp(corner[0] / moduleU - u, 0, 1);
          const localV = THREE.MathUtils.clamp(corner[1] / moduleV - v, 0, 1);
          const textureV = top + (1 - localV) * (bottom - top);
          target.uv.push(left + localU * (right - left), texture.flipY ? 1 - textureV : textureV);
          target.color.push(...tint.map((value) => value * shade));
        }
        triangles++;
      }
    }
  }
  return { areaSquareMetres: area, triangles };
}

function borrowedTextures(world, provided) {
  const result = { ...provided };
  world.traverse((object) => {
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!material?.map) continue;
      for (const [id, definition] of Object.entries(NEIGHBORHOOD_SURFACE_ATLASES)) if (!result[id] && definition.material.test(clean(material.name))) result[id] = material.map;
    }
  });
  return result;
}

export function createNeighborhoodSurfaces({ world, parent, renderer, textures = {} } = {}) {
  const records = neighborhoodSurfacePlacements(world);
  const maps = borrowedTextures(world, textures);
  const group = new THREE.Group(); group.name = 'Fadewood | shared neighborhood surface finish';
  const batches = {}, coverage = [], resources = [];
  try {
    for (const record of records) {
      const texture = maps[record.atlas];
      if (!texture?.isTexture) throw new Error(`Missing resident ${record.atlas} atlas for neighborhood surfaces.`);
      if (!batches[record.atlas]) batches[record.atlas] = { position: [], uv: [], color: [] };
      const result = appendComponent(record, texture, batches[record.atlas]);
      coverage.push({ source: record.source, category: record.category, atlas: record.atlas, module: record.module, crop: record.crop, min: record.min, max: record.max, sourceTriangles: record.sourceTriangles, ...result });
    }
    for (const [atlas, attributes] of Object.entries(batches)) {
      if (!attributes.position.length) continue;
      if (!finite(attributes.position) || !finite(attributes.uv) || !finite(attributes.color)) throw new Error(`Nonfinite ${atlas} neighborhood surface data.`);
      const geometry = new THREE.BufferGeometry();
      for (const [attribute, values] of Object.entries(attributes)) geometry.setAttribute(attribute, new THREE.Float32BufferAttribute(values, attribute === 'uv' ? 2 : 3));
      geometry.computeBoundingBox(); geometry.computeBoundingSphere();
      const material = new THREE.MeshBasicMaterial({ map: maps[atlas], vertexColors: true, side: THREE.DoubleSide });
      material.name = `V3 | shared ${atlas} neighborhood projection`;
      const mesh = new THREE.Mesh(geometry, material); mesh.name = `V3 | neighborhood ${atlas} surfaces`;
      mesh.userData.noCollision = true; mesh.userData.sharedNeighborhoodAtlas = atlas;
      group.add(mesh); resources.push(geometry, material);
    }
    parent?.add(group);
  } catch (error) {
    group.removeFromParent(); resources.forEach((resource) => resource.dispose()); throw error;
  }
  const stats = Object.freeze({ components: coverage.length, categories: [...new Set(coverage.map((record) => record.category))].length, drawCalls: group.children.length, triangles: coverage.reduce((sum, record) => sum + record.triangles, 0), reusedTextures: group.children.length, addedTextures: 0, addedTextureBytes: 0, areaSquareMetres: Math.round(coverage.reduce((sum, record) => sum + record.areaSquareMetres, 0) * 100) / 100 });
  let disposed = false;
  return { group, stats, coverage, dispose() { if (disposed) return; disposed = true; group.removeFromParent(); resources.forEach((resource) => resource.dispose()); } };
}
