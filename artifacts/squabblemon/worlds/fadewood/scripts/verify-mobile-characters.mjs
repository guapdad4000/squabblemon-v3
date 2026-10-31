import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { Box3, Scene, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CHARACTER_PLACEMENTS } from '../src/character-placements.js';
import { loadCharacterCast } from '../src/character-cast.js';

const ASSETS = process.env.FADEWOOD_SOURCE_ASSETS ? pathToFileURL(process.env.FADEWOOD_SOURCE_ASSETS.replace(/\/$/, '') + '/') : new URL('../public/assets/', import.meta.url);
const AUDIT = process.env.FADEWOOD_SOURCE_AUDIT ? pathToFileURL(process.env.FADEWOOD_SOURCE_AUDIT) : new URL('../authoring/mobile-asset-audit.json', import.meta.url);
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const clone = (value) => JSON.parse(JSON.stringify(value));

export function parseGlb(raw) {
  assert.equal(raw.readUInt32LE(0), 0x46546c67);
  assert.equal(raw.readUInt32LE(4), 2);
  assert.equal(raw.readUInt32LE(8), raw.length);
  const length = raw.readUInt32LE(12);
  assert.equal(raw.readUInt32LE(16), 0x4e4f534a);
  assert.equal(raw.readUInt32LE(24 + length), 0x004e4942);
  return { raw, json: JSON.parse(raw.toString('utf8', 20, 20 + length)), bin: raw.subarray(28 + length) };
}

function viewBytes(asset, index) {
  const view = asset.json.bufferViews[index];
  const offset = view.byteOffset ?? 0;
  assert.equal(offset % 4, 0);
  assert.ok(offset >= 0 && offset + view.byteLength <= asset.json.buffers[0].byteLength);
  return asset.bin.subarray(offset, offset + view.byteLength);
}

function baseColor(asset) {
  const texture = asset.json.materials[0].pbrMetallicRoughness.baseColorTexture.index;
  const image = asset.json.images[asset.json.textures[texture].source];
  assert.equal(image.mimeType, 'image/jpeg');
  return viewBytes(asset, image.bufferView);
}

function restoreAccessors(json, indices) {
  for (const mesh of json.meshes) for (const primitive of mesh.primitives) {
    if (primitive.indices !== undefined) primitive.indices = indices.get(primitive.indices);
    for (const name of Object.keys(primitive.attributes)) primitive.attributes[name] = indices.get(primitive.attributes[name]);
    for (const target of primitive.targets ?? []) for (const name of Object.keys(target)) target[name] = indices.get(target[name]);
  }
  for (const skin of json.skins) if (skin.inverseBindMatrices !== undefined) skin.inverseBindMatrices = indices.get(skin.inverseBindMatrices);
  for (const animation of json.animations) for (const sampler of animation.samplers) {
    sampler.input = indices.get(sampler.input); sampler.output = indices.get(sampler.output);
  }
}

function accessorBytes(asset, index) {
  const accessor = asset.json.accessors[index];
  const view = asset.json.bufferViews[accessor.bufferView];
  assert.equal(accessor.sparse, undefined);
  const components = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };
  const bytes = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
  const width = components[accessor.type] * bytes[accessor.componentType];
  const stride = view.byteStride ?? width;
  const data = viewBytes(asset, accessor.bufferView), offset = accessor.byteOffset ?? 0;
  assert.ok(offset + (accessor.count - 1) * stride + width <= data.length);
  return Buffer.concat(Array.from({ length: accessor.count }, (_, row) => data.subarray(offset + row * stride, offset + row * stride + width)));
}

async function loadCpu(asset) {
  // Keep the real GLTFLoader geometry/rig/animation path. Strip only GPU/image
  // dependencies for this headless check; image identity is checked separately.
  const json = clone(asset.json);
  delete json.images; delete json.textures; delete json.materials;
  for (const mesh of json.meshes) for (const primitive of mesh.primitives) delete primitive.material;
  json.buffers[0].uri = `data:application/octet-stream;base64,${asset.bin.toString('base64')}`;
  globalThis.ProgressEvent ??= class { constructor(type, options) { this.type = type; Object.assign(this, options); } };
  return new GLTFLoader().parseAsync(JSON.stringify(json), '');
}

function poseSample(root) {
  root.updateMatrixWorld(true);
  const values = [], point = new Vector3();
  root.traverse((object) => {
    if (object.isBone) values.push(...object.matrixWorld.elements);
    if (!object.isSkinnedMesh) return;
    const count = object.geometry.attributes.position.count;
    for (let i = 0; i < count; i += Math.max(1, Math.floor(count / 48))) {
      object.getVertexPosition(i, point).applyMatrix4(object.matrixWorld);
      values.push(...point.toArray());
    }
  });
  const bounds = new Box3().setFromObject(root, true);
  values.push(...bounds.min.toArray(), ...bounds.max.toArray());
  assert.ok(values.every(Number.isFinite));
  return values;
}

export async function verifyMobileCharacters({ writeAudit = false } = {}) {
  const audit = JSON.parse(await readFile(AUDIT, 'utf8'));
  assert.equal(audit.assets.length, 11);
  const records = [];
  for (const record of audit.assets) {
    const [sourceRaw, mobileRaw] = await Promise.all([
      readFile(new URL(`characters/${record.file}`, ASSETS)),
      readFile(new URL(`characters-mobile/${record.file}`, ASSETS)),
    ]);
    assert.equal(sha256(sourceRaw), record.sourceSha256, `${record.file}: source changed`);
    assert.equal(sha256(mobileRaw), record.mobileSha256, `${record.file}: derivative changed`);
    assert.ok(mobileRaw.length < sourceRaw.length);
    const source = parseGlb(sourceRaw), mobile = parseGlb(mobileRaw);
    assert.equal(mobile.json.images.length, 1);
    assert.equal(mobile.json.textures.length, 1);
    assert.equal(mobile.json.materials[0].normalTexture, undefined);
    assert.equal(mobile.json.materials[0].pbrMetallicRoughness.metallicRoughnessTexture, undefined);
    assert.deepEqual(baseColor(mobile), baseColor(source), `${record.file}: albedo changed`);
    assert.equal(sha256(baseColor(mobile)), record.albedoSha256);
    const restored = clone(mobile.json);
    restoreAccessors(restored, new Map(record.retainedAccessors.map((accessor) => [accessor.mobileAccessor, accessor.sourceAccessor])));
    for (const key of ['meshes', 'nodes', 'skins', 'scenes', 'scene', 'samplers']) {
      assert.deepEqual(restored[key], source.json[key], `${record.file}: ${key} changed`);
    }
    assert.deepEqual(restored.animations, source.json.animations.filter((clip) => clip.name === record.selectedClip));
    assert.equal(restored.animations.length, 1);
    for (const view of record.retainedBufferViews) {
      assert.deepEqual(viewBytes(mobile, view.mobileView), viewBytes(source, view.sourceView).subarray(view.sourceByteOffset, view.sourceByteOffset + view.bytes));
      assert.equal(sha256(viewBytes(mobile, view.mobileView)), view.sha256);
    }
    for (const accessor of record.retainedAccessors) {
      const omitOffsets = ({ bufferView, byteOffset, ...metadata }) => metadata;
      assert.deepEqual(omitOffsets(mobile.json.accessors[accessor.mobileAccessor]), omitOffsets(source.json.accessors[accessor.sourceAccessor]));
      assert.deepEqual(accessorBytes(mobile, accessor.mobileAccessor), accessorBytes(source, accessor.sourceAccessor));
      assert.equal(sha256(accessorBytes(mobile, accessor.mobileAccessor)), accessor.sha256);
    }
    // Decode each source and derivative with the shipped Three.js loader, then
    // compare the actual selected animation at its beginning and two poses.
    const [original, compact] = await Promise.all([loadCpu(source), loadCpu(mobile)]);
    assert.equal(compact.animations.length, 1);
    const placement = CHARACTER_PLACEMENTS.find((candidate) => candidate.asset === record.file);
    assert.ok(placement);
    const clip = original.animations.find((candidate) => candidate.name === placement.animation.clip);
    assert.ok(clip);
    const other = compact.animations[0];
    assert.equal(clip.name, other.name); assert.equal(clip.duration, other.duration);
    assert.equal(clip.tracks.length, other.tracks.length);
    clip.tracks.forEach((track, j) => {
      assert.equal(track.name, other.tracks[j].name);
      assert.deepEqual(track.times, other.tracks[j].times);
      assert.deepEqual(track.values, other.tracks[j].values);
    });
    const a = await loadCharacterCast(new Scene(), { loader: { loadAsync: async () => original }, placements: [placement], baseUrl: '/' });
    const b = await loadCharacterCast(new Scene(), { loader: { loadAsync: async () => compact }, placements: [placement], baseUrl: '/' });
    for (const phase of [0, .31, .68]) {
      a.update(phase * clip.duration); b.update(phase * clip.duration);
      assert.deepEqual(poseSample(b.group), poseSample(a.group), `${record.file}: posed geometry differs at ${phase}`);
      assert.deepEqual(a.sampleMotion(), b.sampleMotion(), `${record.file}: production root/sole anchoring differs at ${phase}`);
    }
    records.push({ file: record.file, sourceClips: original.animations.length, mobileClips: 1, selectedClip: clip.name, comparedPoses: 3, boneAndSkinnedVertexSamplesIdentical: true, productionRootAndSoleAnchoringIdentical: true });
    a.dispose(); b.dispose();
  }
  const verification = {
    passed: true,
    method: 'All eleven original and mobile GLBs decoded with the shipped Three.js GLTFLoader and current production loadCharacterCast, with materials removed only for CPU execution. Every retained clip track, actual bone matrix, deformed vertex sample, full skin bounds and root/sole anchoring matches exactly in three selected-animation poses per character. Embedded albedo JPEG bytes, accessor samples and every retained bufferView hash are independently checked.',
    scope: 'Lossless asset/decode and CPU rig verification; browser GPU appearance and target-device FPS are separate evidence.',
    characters: records.length,
    sourceClips: records.reduce((sum, record) => sum + record.sourceClips, 0),
    mobileClips: records.reduce((sum, record) => sum + record.mobileClips, 0),
    comparedPoses: records.reduce((sum, record) => sum + record.comparedPoses, 0),
    records,
  };
  if (writeAudit) {
    audit.loaderVerification = verification;
    await writeFile(AUDIT, `${JSON.stringify(audit, null, 2)}\n`);
  }
  return verification;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = await verifyMobileCharacters({ writeAudit: true });
  console.log(JSON.stringify({ passed: report.passed, characters: report.characters, sourceClips: report.sourceClips, mobileClips: report.mobileClips, comparedPoses: report.comparedPoses }));
}
