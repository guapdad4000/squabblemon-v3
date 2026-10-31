import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { loadNeighborhoodProps } from '../src/neighborhood-props.js';
import { AUDIT_PATH, PROP_ROOT, propSourcePath, auditActualGeometry, loadCpuGlb, parseGlb, sha256, verifyPropAssetPair } from './helpers/verify-assets.mjs';

const placement = (id, overrides = {}) => ({ id, name: id, asset: `${id}.glb`, position: [0, .2, 0], targetLength: 3, yaw: 0, ...overrides });
const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-6, `${message}: ${actual} versus ${expected}`);
const disposals = (resource) => {
  const count = { value: 0 };
  resource.addEventListener('dispose', () => { count.value += 1; });
  return count;
};

function boxAsset() {
  const scene = new THREE.Group();
  scene.position.set(3, 4, -2);
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(4, 2, 1), new THREE.MeshStandardMaterial()));
  return { scene };
}

test('all five runtime GLBs preserve source geometry, UVs and original color JPEGs at correctly grounded world scale', { skip: !process.env.FADEWOOD_AUTHORING_ROOT ? 'External source masters are optional authoring evidence and never ship.' : false }, async () => {
  const audit = JSON.parse(await readFile(AUDIT_PATH, 'utf8'));
  const sources = new Map();
  const before = new Map();
  const lengths = [5.2, 4.8, 1.9, 1.95, .95];
  for (const record of audit.assets) {
    const [raw, original] = await Promise.all([readFile(new URL(record.file, PROP_ROOT)), readFile(propSourcePath(record.source))]);
    verifyPropAssetPair(record, raw, original);
    const gltf = await loadCpuGlb(raw);
    let mesh;
    gltf.scene.traverse((object) => { if (object.isMesh) mesh = object; });
    const geometry = mesh.geometry;
    before.set(record.file, {
      geometry, position: geometry.attributes.position.array.slice(), uv: geometry.attributes.uv.array.slice(),
      index: geometry.index.array.slice(), color: mesh.material.map,
    });
    sources.set(record.file, gltf);
  }
  const placements = audit.assets.map((record, index) => placement(`prop-${index}`, {
    asset: record.file, position: [index * 7, .2 + index * .03, index * 2], targetLength: lengths[index], yaw: index % 2 ? Math.PI / 2 : 0,
  }));
  const parent = new THREE.Scene();
  const props = await loadNeighborhoodProps({ parent, placements, baseUrl: '/props', loader: { loadAsync: async (url) => sources.get(url.split('/').at(-1)) } });
  assert.equal(props.stats.props, 5);
  assert.equal(props.stats.triangles, 49062);
  assert.equal(props.stats.vertices, 91257);
  assert.equal(props.stats.textures, 5, 'only original color artwork remains resident');
  assert.equal(props.stats.releasedTextures, 0, 'unused normal and packed PBR maps never enter runtime derivatives');
  const colorImages = new Set();
  props.records.forEach((record, index) => {
    const source = before.get(record.asset), expected = placements[index];
    let mesh;
    props.group.children[index].traverse((object) => { if (object.isMesh) mesh = object; });
    assert.equal(mesh.geometry, source.geometry, 'normalization does not bake or rewrite source mesh data');
    assert.deepEqual(mesh.geometry.attributes.position.array, source.position);
    assert.deepEqual(mesh.geometry.attributes.uv.array, source.uv);
    assert.deepEqual(mesh.geometry.index.array, source.index);
    assert.equal(mesh.material.map, source.color, 'the uploaded color Texture is retained intact');
    assert.equal(sha256(mesh.material.map.image.encodedBytes), audit.assets[index].albedoSha256);
    assert.equal(mesh.material.isMeshBasicMaterial, true);
    assert.equal(mesh.material.side, THREE.DoubleSide, 'uploaded double-sided surfaces remain visible');
    colorImages.add(mesh.material.map.image);
    const actual = new THREE.Box3().setFromObject(props.group.children[index], true);
    near(actual.min.y, expected.position[1], 'tires or cart casters touch the placement ground');
    near((actual.min.x + actual.max.x) / 2, expected.position[0], 'horizontal center X');
    near((actual.min.z + actual.max.z) / 2, expected.position[2], 'horizontal center Z');
    near(Math.max(...[record.localDimensions[0], record.localDimensions[2]]), expected.targetLength, 'real-world target length');
    assert.deepEqual(record.worldBounds, { min: actual.min.toArray(), max: actual.max.toArray() });
    if (index % 2) {
      near(record.dimensions[0], record.localDimensions[2], 'a quarter turn swaps vehicle width into X');
      near(record.dimensions[2], record.localDimensions[0], 'a quarter turn parks the X-long model along Z');
    }
  });
  assert.equal(colorImages.size, 5, 'separate uploads cannot share or overwrite one another’s texture data');
  props.dispose();
  assert.equal(parent.children.length, 0);
  for (const image of colorImages) assert.equal(image.closed, 1, 'retained image ownership ends when the prop group is disposed');
});

test('all five source/derivative pairs match through the real loader and production material conversion', { skip: !process.env.FADEWOOD_AUTHORING_ROOT ? 'External source masters are optional authoring evidence and never ship.' : false }, async () => {
  const audit = await auditActualGeometry();
  assert.equal(audit.loaderVerification.passed, true);
  assert.equal(audit.loaderVerification.assets, 5);
  assert.equal(audit.loaderVerification.totalVertices, 91257);
  assert.equal(audit.loaderVerification.totalTriangles, 49062);
  assert.equal(audit.sourceImages, 15);
  assert.equal(audit.runtimeImages, 5);
  for (const record of audit.loaderVerification.records) {
    assert.equal(record.productionPlacementIdentical, true);
    assert.equal(record.visibleMaterialPropertiesIdentical, true);
    assert.equal(record.sourceReleasedTextures, 2);
    assert.equal(record.runtimeReleasedTextures, 0);
  }
});

test('parity verification detects retained geometry corruption even when its whole-file hash is updated', { skip: !process.env.FADEWOOD_AUTHORING_ROOT ? 'External source masters are optional authoring evidence and never ship.' : false }, async () => {
  const audit = JSON.parse(await readFile(AUDIT_PATH, 'utf8'));
  const record = audit.assets[0];
  const [raw, original] = await Promise.all([readFile(new URL(record.file, PROP_ROOT)), readFile(propSourcePath(record.source))]);
  const corrupt = Buffer.from(raw), asset = parseGlb(corrupt);
  const position = asset.json.accessors[asset.json.meshes[0].primitives[0].attributes.POSITION];
  const view = asset.json.bufferViews[position.bufferView];
  const jsonLength = corrupt.readUInt32LE(12);
  const offset = 28 + jsonLength + (view.byteOffset ?? 0) + (position.byteOffset ?? 0);
  corrupt[offset] ^= 1;
  assert.throws(() => verifyPropAssetPair({ ...record, runtimeSha256: sha256(corrupt) }, corrupt, original), /retained bufferView .* changed/);
});

test('model work is limited to two concurrent loads while duplicate placements share immutable resources', async () => {
  const calls = [], assets = [];
  let active = 0, peak = 0;
  const loader = { async loadAsync(url) {
    calls.push(url);
    active += 1; peak = Math.max(peak, active);
    await new Promise((resolve) => setImmediate(resolve));
    const asset = boxAsset(); assets.push(asset);
    active -= 1;
    return asset;
  } };
  const parent = new THREE.Scene();
  const placements = Array.from({ length: 7 }, (_, index) => placement(`copy-${index}`, { asset: `asset-${index % 4}.glb`, position: [index * 4, .2, 0] }));
  const props = await loadNeighborhoodProps({ parent, placements, loader, baseUrl: '/models/' });
  assert.equal(peak, 2);
  assert.equal(calls.length, 4);
  assert.equal(new Set(calls).size, 4);
  assert.equal(props.group.children.length, 7);
  const previous = props.group.children[4].position.clone();
  props.group.children[0].position.x = 100;
  assert.deepEqual(props.group.children[4].position, previous, 'reused source scenes have independent placement transforms');
  props.dispose();
});

test('unlit conversion preserves alpha and vertex art while safely releasing shared-image PBR maps once', async () => {
  const asset = boxAsset(), mesh = asset.scene.children[0];
  mesh.material.dispose();
  const images = Array.from({ length: 3 }, () => ({ width: 2, height: 2, closed: 0, close() { this.closed += 1; } }));
  const map = new THREE.Texture(images[0]), alpha = new THREE.Texture(images[1]);
  const normal = new THREE.Texture(images[0]), packed = new THREE.Texture(images[2]);
  const source = new THREE.MeshStandardMaterial({
    map, alphaMap: alpha, normalMap: normal, roughnessMap: packed,
    color: '#9cb7e2', transparent: true, opacity: .72, alphaTest: .15,
    side: THREE.DoubleSide, vertexColors: true, depthWrite: false,
  });
  mesh.material = source;
  const textureCounts = [map, alpha, normal, packed].map(disposals);
  const sourceCount = disposals(source), geometryCount = disposals(mesh.geometry);
  const props = await loadNeighborhoodProps({ parent: new THREE.Scene(), placements: [placement('painted')], baseUrl: '/', loader: { loadAsync: async () => ({ ...asset, parser: { json: { textures: [{}, {}, {}, {}] }, getDependencies: async () => [map, alpha, normal, packed] } }) } });
  let material;
  props.group.traverse((object) => { if (object.isMesh) material = object.material; });
  assert.equal(material.map, map);
  assert.equal(material.alphaMap, alpha);
  assert.equal(material.color.getHex(), source.color.getHex());
  for (const property of ['transparent', 'opacity', 'alphaTest', 'side', 'vertexColors', 'depthWrite']) assert.equal(material[property], source[property], `${property} retained`);
  assert.deepEqual(textureCounts.map(({ value }) => value), [0, 0, 1, 1]);
  assert.deepEqual(images.map(({ closed }) => closed), [0, 0, 1], 'releasing an unused texture does not close a live color image');
  const liveCount = disposals(material);
  props.dispose(); props.dispose();
  assert.equal(liveCount.value, 1);
  assert.equal(sourceCount.value, 1);
  assert.equal(geometryCount.value, 1);
  assert.deepEqual(textureCounts.map(({ value }) => value), [1, 1, 1, 1]);
  assert.deepEqual(images.map(({ closed }) => closed), [1, 1, 1]);
});

test('a failed asset or missing image never publishes a partial prop group and cleans up late work', async () => {
  for (const failure of ['asset', 'texture']) {
    const good = boxAsset(), mesh = good.scene.children[0];
    const geometryCount = disposals(mesh.geometry), materialCount = disposals(mesh.material);
    const parent = new THREE.Scene(), existing = new THREE.Group(); parent.add(existing);
    const loader = { async loadAsync(url) {
      if (url.endsWith('bad.glb')) {
        if (failure === 'asset') throw new Error('Unavailable file');
        return { scene: new THREE.Group(), parser: { json: { textures: [{}] }, getDependencies: async () => [null] } };
      }
      await new Promise((resolve) => setImmediate(resolve));
      return good;
    } };
    await assert.rejects(loadNeighborhoodProps({ parent, placements: [placement('bad'), placement('good')], loader, baseUrl: '/' }), failure === 'asset' ? /Unavailable file/ : /texture did not load/);
    assert.deepEqual(parent.children, [existing]);
    assert.equal(geometryCount.value, 1, 'a successful in-flight model is released after a sibling fails');
    assert.equal(materialCount.value, 1);
  }
});

test('invalid placements or non-finite model geometry fail before anything enters the scene', async () => {
  let calls = 0;
  const parent = new THREE.Scene();
  const loader = { async loadAsync() { calls += 1; return boxAsset(); } };
  for (const invalid of [placement('bad', { targetLength: 0 }), placement('bad', { position: [0, NaN, 0] }), placement('bad', { yaw: Infinity }), placement('bad', { asset: '../escape.glb' })]) {
    await assert.rejects(loadNeighborhoodProps({ parent, placements: [invalid], loader, baseUrl: '/' }));
  }
  assert.equal(calls, 0, 'input errors are checked before requesting any assets');
  const asset = boxAsset();
  asset.scene.children[0].geometry.attributes.position.array[0] = Infinity;
  const geometryCount = disposals(asset.scene.children[0].geometry);
  await assert.rejects(loadNeighborhoodProps({ parent, placements: [placement('bad')], loader: { loadAsync: async () => asset }, baseUrl: '/' }), /invalid visible bounds/);
  assert.equal(geometryCount.value, 1);
  assert.equal(parent.children.length, 0);
});
