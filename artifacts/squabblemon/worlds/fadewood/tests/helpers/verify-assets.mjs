import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { Box3, Scene, Texture, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { loadNeighborhoodProps } from '../../src/neighborhood-props.js';
import { PROP_PLACEMENTS } from '../../src/prop-placements.js';

export const PROP_ROOT = new URL('../../public/assets/props/', import.meta.url);
const AUTHORING_ROOT = process.env.FADEWOOD_AUTHORING_ROOT;
export const authoringFile = path => { if (!AUTHORING_ROOT) throw new Error('This optional test requires FADEWOOD_AUTHORING_ROOT from the supplied archive.'); return pathToFileURL(AUTHORING_ROOT.replace(/\/$/, '') + '/' + path); };
export const propSourcePath = path => path.startsWith('/') ? path : authoringFile('playable/' + path);
export const ORIGINAL_AUDIT_PATH = AUTHORING_ROOT ? authoringFile('outputs/props/asset-audit.json') : new URL('./missing-authoring-audit.json', import.meta.url);
export const AUDIT_PATH = AUTHORING_ROOT ? authoringFile('outputs/slim/props-audit.json') : new URL('./missing-authoring-audit.json', import.meta.url);
export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const clone = (value) => JSON.parse(JSON.stringify(value));

export function parseGlb(raw) {
  assert.equal(raw.readUInt32LE(0), 0x46546c67);
  assert.equal(raw.readUInt32LE(4), 2);
  assert.equal(raw.readUInt32LE(8), raw.length);
  const length = raw.readUInt32LE(12);
  assert.equal(raw.readUInt32LE(16), 0x4e4f534a);
  assert.equal(raw.readUInt32LE(24 + length), 0x004e4942);
  assert.equal(raw.readUInt32LE(20 + length) + 28 + length, raw.length);
  const json = JSON.parse(raw.toString('utf8', 20, 20 + length));
  assert.equal(json.buffers.length, 1);
  assert.equal(json.buffers[0].uri, undefined);
  return { json, bin: raw.subarray(28 + length) };
}

export function viewBytes(asset, index) {
  const view = asset.json.bufferViews[index];
  assert.equal(view.buffer ?? 0, 0);
  const offset = view.byteOffset ?? 0;
  assert.equal(offset % 4, 0);
  assert.ok(offset >= 0 && offset + view.byteLength <= asset.json.buffers[0].byteLength);
  return asset.bin.subarray(offset, offset + view.byteLength);
}

function accessorBytes(asset, index) {
  const accessor = asset.json.accessors[index];
  assert.equal(accessor.sparse, undefined);
  const components = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
  const sizes = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
  const width = components[accessor.type] * sizes[accessor.componentType];
  assert.ok(Number.isFinite(width));
  const view = asset.json.bufferViews[accessor.bufferView];
  const stride = view.byteStride ?? width, offset = accessor.byteOffset ?? 0;
  const data = viewBytes(asset, accessor.bufferView);
  assert.ok(offset + (accessor.count - 1) * stride + width <= data.length);
  return Buffer.concat(Array.from({ length: accessor.count }, (_, row) => data.subarray(offset + row * stride, offset + row * stride + width)));
}

function baseColor(asset) {
  const texture = asset.json.materials[0].pbrMetallicRoughness.baseColorTexture.index;
  const imageIndex = asset.json.textures[texture].source;
  const image = asset.json.images[imageIndex];
  assert.equal(image.mimeType, 'image/jpeg');
  return { texture, imageIndex, image, bytes: viewBytes(asset, image.bufferView) };
}

/** Independent source/derivative comparison, including every retained payload. */
export function verifyPropAssetPair(record, runtimeRaw, sourceRaw) {
  assert.equal(sha256(sourceRaw), record.sourceSha256, `${record.file}: immutable source changed`);
  assert.equal(sourceRaw.length, record.sourceBytes);
  assert.equal(sha256(runtimeRaw), record.runtimeSha256, `${record.file}: runtime derivative changed`);
  assert.equal(runtimeRaw.length, record.runtimeBytes);
  assert.ok(runtimeRaw.length < sourceRaw.length);
  const source = parseGlb(sourceRaw), runtime = parseGlb(runtimeRaw);
  const withoutLength = ({ byteLength, ...metadata }) => metadata;
  assert.deepEqual(withoutLength(runtime.json.buffers[0]), withoutLength(source.json.buffers[0]));
  assert.equal(runtime.json.images.length, 1);
  assert.equal(runtime.json.textures.length, 1);
  assert.equal(runtime.json.materials.length, 1);
  assert.equal(runtime.json.materials[0].normalTexture, undefined);
  assert.equal(runtime.json.materials[0].pbrMetallicRoughness.metallicRoughnessTexture, undefined);
  const a = baseColor(source), b = baseColor(runtime);
  assert.deepEqual(b.bytes, a.bytes, `${record.file}: original albedo JPEG changed`);
  assert.equal(sha256(b.bytes), record.albedoSha256);
  assert.equal(b.bytes.length, record.albedoBytes);
  assert.equal(a.imageIndex, record.sourceColorImageIndex);
  assert.equal(b.imageIndex, record.runtimeColorImageIndex);
  const restored = clone(runtime.json);
  const viewIndices = new Map(record.retainedBufferViews.map((view) => [view.runtimeView, view.sourceView]));
  assert.equal(viewIndices.size, runtime.json.bufferViews.length);
  assert.equal(new Set(viewIndices.values()).size, viewIndices.size);
  const removedViews = new Set(source.json.images.filter((_, index) => index !== a.imageIndex).map((image) => image.bufferView));
  assert.deepEqual([...viewIndices.values()].sort((x, y) => x - y), source.json.bufferViews.map((_, index) => index).filter((index) => !removedViews.has(index)));
  for (const view of record.retainedBufferViews) {
    const before = viewBytes(source, view.sourceView), after = viewBytes(runtime, view.runtimeView);
    assert.deepEqual(after, before, `${record.file}: retained bufferView ${view.sourceView} changed`);
    assert.equal(after.length, view.bytes);
    assert.equal(sha256(after), view.sha256);
    const withoutOffset = ({ byteOffset, ...metadata }) => metadata;
    assert.deepEqual(withoutOffset(runtime.json.bufferViews[view.runtimeView]), withoutOffset(source.json.bufferViews[view.sourceView]));
  }
  assert.equal(record.retainedAccessors.length, source.json.accessors.length);
  assert.equal(runtime.json.accessors.length, source.json.accessors.length);
  assert.deepEqual(record.retainedAccessors.map((accessor) => accessor.sourceAccessor), source.json.accessors.map((_, index) => index));
  assert.deepEqual(record.retainedAccessors.map((accessor) => accessor.runtimeAccessor), runtime.json.accessors.map((_, index) => index));
  for (const accessor of record.retainedAccessors) {
    const before = accessorBytes(source, accessor.sourceAccessor), after = accessorBytes(runtime, accessor.runtimeAccessor);
    assert.deepEqual(after, before, `${record.file}: accessor ${accessor.sourceAccessor} changed`);
    assert.equal(after.length, accessor.bytes);
    assert.equal(sha256(after), accessor.sha256);
  }
  restored.accessors.forEach((accessor) => { accessor.bufferView = viewIndices.get(accessor.bufferView); });
  // Restore only the explicitly planned changes, then compare the complete JSON.
  restored.buffers = source.json.buffers;
  restored.bufferViews = source.json.bufferViews;
  restored.textures = source.json.textures;
  restored.images = source.json.images;
  restored.materials[0].normalTexture = source.json.materials[0].normalTexture;
  restored.materials[0].pbrMetallicRoughness.metallicRoughnessTexture = source.json.materials[0].pbrMetallicRoughness.metallicRoughnessTexture;
  restored.materials[0].pbrMetallicRoughness.baseColorTexture.index = a.texture;
  assert.deepEqual(restored, source.json, `${record.file}: scene, geometry, accessor or retained material metadata changed`);
  const { source: sourceTexture, ...sourceTextureMetadata } = source.json.textures[a.texture];
  const { source: runtimeTexture, ...runtimeTextureMetadata } = runtime.json.textures[b.texture];
  assert.deepEqual(runtimeTextureMetadata, sourceTextureMetadata);
  const { bufferView: sourceImageView, ...sourceImageMetadata } = a.image;
  const { bufferView: runtimeImageView, ...runtimeImageMetadata } = b.image;
  assert.deepEqual(runtimeImageMetadata, sourceImageMetadata);
  assert.equal(viewIndices.get(runtimeImageView), sourceImageView);
  return { source, runtime };
}

/**
 * Decode the exact GLB through the shipped GLTFLoader. The test-only plugin
 * keeps encoded embedded image bytes instead of requiring a browser decoder;
 * geometry, materials, UVs and all scene transforms take the real loader path.
 * This verifies data ownership and placement, not GPU texture appearance.
 */
export async function loadCpuGlb(raw) {
  const loader = new GLTFLoader();
  loader.register((parser) => ({
    name: 'HEADLESS_ENCODED_IMAGES',
    async loadTexture(index) {
      const def = parser.json.textures[index];
      const imageDef = parser.json.images[def.source];
      const encoded = await parser.getDependency('bufferView', imageDef.bufferView);
      const image = { width: 1024, height: 1024, encodedBytes: Buffer.from(encoded), mimeType: imageDef.mimeType, closed: 0, close() { this.closed += 1; } };
      const texture = new Texture(image);
      texture.flipY = false;
      parser.associations.set(texture, { textures: index });
      return texture;
    },
  }));
  return loader.parseAsync(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength), '');
}

function sceneData(root) {
  const bounds = new Box3().setFromObject(root, true);
  const meshes = [];
  root.traverse((object) => {
    if (!object.isMesh) return;
    const geometry = object.geometry;
    meshes.push({ name: object.name, vertices: geometry.getAttribute('position').count,
      indices: geometry.index?.count ?? 0,
      triangles: (geometry.index?.count ?? geometry.getAttribute('position').count) / 3,
      uvVertices: geometry.getAttribute('uv')?.count ?? 0, rootMatrix: object.matrixWorld.toArray() });
  });
  return { bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() },
    dimensions: bounds.getSize(new Vector3()).toArray(), meshes };
}

function visibleMaterials(root) {
  const result = [];
  root.traverse((object) => {
    if (!object.isMesh) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      const state = {};
      for (const key of ['type', 'name', 'visible', 'transparent', 'opacity', 'alphaTest', 'side', 'vertexColors', 'depthTest', 'depthWrite', 'colorWrite', 'blending', 'premultipliedAlpha', 'polygonOffset', 'polygonOffsetFactor', 'polygonOffsetUnits', 'toneMapped', 'fog', 'alphaHash', 'alphaToCoverage']) state[key] = material[key];
      state.color = material.color.toArray();
      for (const key of ['map', 'alphaMap']) {
        const texture = material[key];
        state[key] = texture ? { sha256: sha256(texture.image.encodedBytes), colorSpace: texture.colorSpace,
          flipY: texture.flipY, channel: texture.channel, offset: texture.offset.toArray(), repeat: texture.repeat.toArray(),
          center: texture.center.toArray(), rotation: texture.rotation, matrix: texture.matrix.toArray(),
          wrapS: texture.wrapS, wrapT: texture.wrapT, magFilter: texture.magFilter, minFilter: texture.minFilter } : null;
      }
      result.push(state);
    }
  });
  return result;
}

export async function auditActualGeometry({ writeAudit = false } = {}) {
  const audit = JSON.parse(await readFile(AUDIT_PATH, 'utf8'));
  const historicalRaw = await readFile(ORIGINAL_AUDIT_PATH);
  assert.equal(sha256(historicalRaw), audit.sourceAuditSha256, 'historical source audit is preserved');
  const historical = JSON.parse(historicalRaw);
  const records = [];
  assert.equal(audit.assets.length, 5);
  for (const record of audit.assets) {
    const [runtimeRaw, sourceRaw] = await Promise.all([readFile(new URL(record.file, PROP_ROOT)), readFile(propSourcePath(record.source))]);
    verifyPropAssetPair(record, runtimeRaw, sourceRaw);
    const old = historical.assets.find((asset) => asset.file === record.file);
    assert.ok(old);
    assert.equal(record.sourceSha256, old.sha256);
    const [source, runtime] = await Promise.all([loadCpuGlb(sourceRaw), loadCpuGlb(runtimeRaw)]);
    const before = sceneData(source.scene), after = sceneData(runtime.scene);
    assert.deepEqual(after, before, `${record.file}: loader geometry and bounds`);
    assert.equal(after.meshes.length, 1);
    assert.equal(after.meshes[0].triangles, record.triangles);
    assert.equal(after.meshes[0].vertices, record.vertices);
    assert.deepEqual(after.bounds, old.accessorBounds);
    const placement = PROP_PLACEMENTS.find((prop) => prop.asset === record.file);
    assert.ok(placement);
    const a = await loadNeighborhoodProps({ parent: new Scene(), placements: [placement], baseUrl: '/', loader: { loadAsync: async () => source } });
    const b = await loadNeighborhoodProps({ parent: new Scene(), placements: [placement], baseUrl: '/', loader: { loadAsync: async () => runtime } });
    assert.deepEqual(b.records, a.records, `${record.file}: production scale, grounding and world bounds`);
    assert.deepEqual(visibleMaterials(b.group), visibleMaterials(a.group), `${record.file}: production visible material settings`);
    assert.equal(a.stats.releasedTextures, 2);
    assert.equal(b.stats.releasedTextures, 0);
    assert.equal(a.stats.textures, 1); assert.equal(b.stats.textures, 1);
    records.push({ file: record.file, ...after, colorImageSha256: record.albedoSha256,
      productionPlacementIdentical: true, visibleMaterialPropertiesIdentical: true,
      sourceReleasedTextures: a.stats.releasedTextures, runtimeReleasedTextures: b.stats.releasedTextures });
    a.dispose(); b.dispose();
  }
  audit.loaderVerification = {
    passed: true,
    method: 'All five immutable source and runtime GLBs decoded with the shipped Three.js GLTFLoader and current loadNeighborhoodProps. Complete GLB metadata, every retained bufferView and accessor payload, and original albedo JPEG bytes match independently. Source and derivative production material settings, normalization, grounding, transforms and world bounds are identical. The headless image plugin retains encoded JPEG bytes; browser GPU appearance and device FPS remain separate evidence.',
    assets: records.length, totalVertices: records.reduce((sum, record) => sum + record.meshes[0].vertices, 0),
    totalTriangles: records.reduce((sum, record) => sum + record.meshes[0].triangles, 0), records,
  };
  assert.equal(audit.sourceBytes, audit.assets.reduce((sum, asset) => sum + asset.sourceBytes, 0));
  assert.equal(audit.runtimeBytes, audit.assets.reduce((sum, asset) => sum + asset.runtimeBytes, 0));
  assert.equal(audit.loaderVerification.totalVertices, 91257);
  assert.equal(audit.loaderVerification.totalTriangles, 49062);
  if (writeAudit) await writeFile(AUDIT_PATH, `${JSON.stringify(audit, null, 2)}\n`);
  return audit;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const audit = await auditActualGeometry({ writeAudit: process.argv.includes('--write-audit') });
  console.log(JSON.stringify({ assets: audit.assets.length, sourceBytes: audit.sourceBytes, runtimeBytes: audit.runtimeBytes,
    triangles: audit.totalTriangles, vertices: audit.totalVertices, loaderVerificationPassed: audit.loaderVerification.passed }));
}
