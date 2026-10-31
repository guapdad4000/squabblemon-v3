import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { loadCharacterCast } from '../src/character-cast.js';

function placement(id, overrides = {}) {
  return { id, name: id, locationId: 'test-entrance', asset: `${id}.glb`, position: [0, .25, 0], yaw: 0, height: 1.8, ...overrides };
}

function simpleAsset() {
  const scene = new THREE.Group();
  const geometry = new THREE.BoxGeometry(1, 2, 1);
  geometry.translate(3, 2, -4);
  scene.add(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: '#487abc' })));
  return { scene, animations: [] };
}

function countDisposals(resource) {
  const counter = { value: 0 };
  resource.addEventListener('dispose', () => { counter.value += 1; });
  return counter;
}

function paintedAsset() {
  const asset = simpleAsset();
  const mesh = asset.scene.children[0];
  mesh.material.dispose();
  const images = Array.from({ length: 4 }, () => ({ width: 2, height: 2, closed: 0, close() { this.closed += 1; } }));
  const [color, alpha, normal, roughness] = images.map((image) => new THREE.Texture(image));
  const source = new THREE.MeshStandardMaterial({
    color: '#9cb7e2', map: color, alphaMap: alpha, normalMap: normal, roughnessMap: roughness,
    transparent: true, opacity: .72, alphaTest: .15, side: THREE.DoubleSide,
    vertexColors: true, depthWrite: false,
  });
  mesh.material = source;
  return {
    ...asset,
    parser: { json: { textures: [{}, {}, {}, {}] }, getDependencies: async () => [color, alpha, normal, roughness] },
    source, geometry: mesh.geometry, images, textureList: [color, alpha, normal, roughness],
  };
}

test('cast loading bounds asset and image work to two models and reuses duplicate assets', async () => {
  let active = 0, peak = 0;
  const requested = [];
  const parent = new THREE.Scene();
  const loader = { async loadAsync(url) {
    requested.push(url);
    active += 1;
    peak = Math.max(peak, active);
    // Each load remains pending long enough for independent worker work to run.
    await new Promise((resolve) => setImmediate(resolve));
    active -= 1;
    return simpleAsset();
  } };
  const placements = Array.from({ length: 7 }, (_, index) => placement(`host-${index}`, { asset: `model-${index % 4}.glb` }));
  const cast = await loadCharacterCast(parent, { loader, placements, baseUrl: '/assets/characters/' });
  assert.equal(peak, 2, 'model loading stays bounded even when more hosts are requested');
  assert.equal(requested.length, 4, 'each unique asset is fetched once');
  assert.equal(new Set(requested).size, 4);
  assert.equal(cast.group.children.length, 7, 'reusing an asset still creates every requested host');
  cast.dispose();
});

test('posed skinned characters land at their requested feet and height with independent frozen guards', async () => {
  const scene = new THREE.Group();
  scene.name = 'RigRoot';
  scene.position.set(12, 3, -5);
  const geometry = new THREE.BoxGeometry(1, 2, 1);
  geometry.translate(0, 1, 0);
  const vertexCount = geometry.attributes.position.count;
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Uint16Array(vertexCount * 4), 4));
  const weights = new Float32Array(vertexCount * 4);
  for (let index = 0; index < vertexCount; index += 1) weights[index * 4] = 1;
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
  const bone = new THREE.Bone();
  bone.name = 'Body';
  const skin = new THREE.SkinnedMesh(geometry, new THREE.MeshStandardMaterial({ color: '#336699' }));
  skin.add(bone);
  skin.bind(new THREE.Skeleton([bone]));
  scene.add(skin);
  scene.updateMatrixWorld(true);
  const guard = new THREE.AnimationClip('Punch_Pose', 1, [new THREE.NumberKeyframeTrack('Body.rotation[z]', [0, 1], [0, .25])]);
  const parent = new THREE.Scene();
  const cast = await loadCharacterCast(parent, {
    loader: { loadAsync: async () => ({ scene, animations: [guard] }) }, baseUrl: '/characters/',
    placements: [0, 1].map((index) => placement(`guard-${index}`, {
      asset: 'shared-guard.glb', position: [index * 3, .25, 0],
      animation: { clip: 'Punch_Pose', time: .5, loop: false },
    })),
  });
  const skins = cast.group.children.map((character) => {
    let result;
    character.traverse((object) => { if (object.isSkinnedMesh) result = object; });
    const bounds = new THREE.Box3().setFromObject(character, true);
    assert.ok(Math.abs(bounds.min.y - .25) < 1e-6, 'posed soles touch the entrance elevation');
    assert.ok(Math.abs(bounds.getSize(new THREE.Vector3()).y - 1.8) < 1e-6, 'displayed pose has the requested world height');
    return result;
  });
  const frozenAngle = skins[0].skeleton.bones[0].rotation.z;
  assert.ok(frozenAngle > .1, 'the selected authored pose is displayed rather than the bind pose');
  cast.update(100);
  assert.equal(skins[0].skeleton.bones[0].rotation.z, frozenAngle, 'a frozen guard cannot turn into a looping punch');
  skins[0].skeleton.bones[0].rotation.z = .7;
  assert.equal(skins[1].skeleton.bones[0].rotation.z, frozenAngle, 'one reused character cannot animate another character’s bones');
  assert.equal(skins[0].frustumCulled, false, 'staged accessor bounds cannot cull a visible skinned character');
  assert.equal(cast.records[0].animated, false);
  cast.dispose();
});

test('a missing texture or requested clip rejects the cast and cleans up partial resources', async () => {
  for (const failure of ['texture', 'clip']) {
    const asset = paintedAsset();
    const geometryDisposals = countDisposals(asset.geometry);
    const materialDisposals = countDisposals(asset.source);
    const textureDisposals = asset.textureList.map(countDisposals);
    if (failure === 'texture') asset.parser.getDependencies = async () => [asset.textureList[0], null, ...asset.textureList.slice(2)];
    const parent = new THREE.Scene();
    const existing = new THREE.Group();
    parent.add(existing);
    const placements = [placement('first', { asset: 'shared.glb' })];
    if (failure === 'clip') placements.push(placement('second', {
      asset: 'shared.glb', animation: { clip: 'Missing_Guard', time: 0, loop: false },
    }));
    await assert.rejects(() => loadCharacterCast(parent, {
      loader: { loadAsync: async () => asset }, placements, baseUrl: '/characters/',
    }), failure === 'texture' ? /texture did not load/ : /no authored clip Missing_Guard/);
    assert.deepEqual(parent.children, [existing], 'no incomplete host group is published into the live scene');
    assert.equal(geometryDisposals.value, 1);
    assert.equal(materialDisposals.value, 1);
    for (const counter of textureDisposals) assert.equal(counter.value, 1, 'loaded art is released even when the cast cannot complete');
  }
});

test('unlit characters preserve uploaded color and alpha artwork while releasing unused PBR maps exactly once', async () => {
  const asset = paintedAsset();
  const sourceDisposals = countDisposals(asset.source);
  const geometryDisposals = countDisposals(asset.geometry);
  const textureDisposals = asset.textureList.map(countDisposals);
  const parent = new THREE.Scene();
  const cast = await loadCharacterCast(parent, {
    loader: { loadAsync: async () => asset }, placements: [placement('painted')], baseUrl: '/characters/',
  });
  let visibleMaterial;
  cast.group.traverse((object) => { if (object.isMesh) visibleMaterial = object.material; });
  assert.ok(visibleMaterial.isMeshBasicMaterial, 'uploaded art remains visible in the unlit world');
  assert.equal(visibleMaterial.map, asset.textureList[0], 'the original color image is retained');
  assert.equal(visibleMaterial.alphaMap, asset.textureList[1], 'the original cutout image is retained');
  assert.equal(visibleMaterial.color.getHex(), asset.source.color.getHex());
  for (const property of ['transparent', 'opacity', 'alphaTest', 'side', 'vertexColors', 'depthWrite']) {
    assert.equal(visibleMaterial[property], asset.source[property], `${property} survives the unlit conversion`);
  }
  assert.equal(sourceDisposals.value, 1, 'the unused PBR material no longer holds its normal and roughness images');
  assert.deepEqual(textureDisposals.map((counter) => counter.value), [0, 0, 1, 1]);
  assert.deepEqual(asset.images.map((image) => image.closed), [0, 0, 1, 1], 'unused decoded images are closed without closing visible art');
  const visibleDisposals = countDisposals(visibleMaterial);
  cast.dispose();
  cast.dispose();
  assert.equal(parent.children.length, 0);
  assert.equal(geometryDisposals.value, 1);
  assert.equal(sourceDisposals.value, 1);
  assert.equal(visibleDisposals.value, 1);
  assert.deepEqual(textureDisposals.map((counter) => counter.value), [1, 1, 1, 1], 'disposing twice cannot double-release shared images');
});

function animatedAsset() {
  const scene = new THREE.Group();
  const geometry = new THREE.BoxGeometry(1, 2, .6);
  geometry.translate(0, 1, 0);
  const root = new THREE.Bone();
  root.name = 'spine';
  const left = new THREE.Bone();
  left.name = 'footL';
  left.position.set(-.25, .1, 0);
  const right = new THREE.Bone();
  right.name = 'footR';
  right.position.set(.25, .1, 0);
  const hand = new THREE.Bone();
  hand.name = 'hand';
  hand.position.set(0, 1, 0);
  root.add(left, right, hand);
  const vertexCount = geometry.attributes.position.count;
  const indices = new Uint16Array(vertexCount * 4);
  const weights = new Float32Array(vertexCount * 4);
  for (let index = 0; index < vertexCount; index += 1) {
    indices[index * 4] = geometry.attributes.position.getY(index) < 1 ? (geometry.attributes.position.getX(index) < 0 ? 1 : 2) : 3;
    weights[index * 4] = 1;
  }
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
  const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshBasicMaterial());
  mesh.add(root);
  mesh.bind(new THREE.Skeleton([root, left, right, hand]));
  scene.add(mesh);
  scene.updateMatrixWorld(true);
  const clip = new THREE.AnimationClip('Living_Neighbor', 2, [
    new THREE.VectorKeyframeTrack('spine.position', [0, 1, 2], [0, 0, 0, .6, .15, 1, 0, 0, 0]),
    new THREE.VectorKeyframeTrack('footL.position', [0, 1, 2], [-.25, .1, 0, -.25, .3, 0, -.25, .1, 0]),
    new THREE.NumberKeyframeTrack('hand.rotation[z]', [0, 1, 2], [0, .5, 0]),
  ]);
  return { scene, geometry, root, clip, animations: [clip] };
}

test('every looping neighbor visibly advances, keeps authored speed and phase, and stays planted without scanning bounds', async () => {
  const asset = animatedAsset();
  const originalTrack = asset.clip.tracks[0].values.slice();
  const placements = Array.from({ length: 11 }, (_, index) => placement(`neighbor-${index}`, {
    asset: 'shared.glb', position: [index * 3, .25 + index * .01, -index], yaw: index * .4,
    animation: { clip: 'Living_Neighbor', loop: true, speed: .75 + index * .03, phase: index * .03 },
  }));
  const cast = await loadCharacterCast(new THREE.Scene(), {
    loader: { loadAsync: async () => asset }, placements, baseUrl: '/characters/',
  });
  assert.equal(cast.stats.idleAnimations, 11);
  assert.equal(cast.stats.frozenPoses, 0);
  assert.ok(cast.records.every(({ animated, footProbes, rootMotionAnchored }) => animated && footProbes > 0 && rootMotionAnchored));
  const skins = cast.group.children.map((character) => {
    let skin;
    character.traverse((object) => { if (object.isSkinnedMesh) skin = object; });
    return skin;
  });
  assert.notEqual(skins[0].skeleton.bones[0], skins[1].skeleton.bones[0], 'each copy owns independent animated bones');
  const before = cast.sampleMotion();
  const originalBounds = THREE.Box3.prototype.setFromObject;
  THREE.Box3.prototype.setFromObject = () => { throw new Error('per-frame mesh bounds scan'); };
  try {
    cast.update(.37);
    const after = cast.sampleMotion();
    for (let index = 0; index < after.length; index += 1) {
      const state = after[index];
      assert.ok(state.activity > .01, `${state.id} changes skeletal pose`);
      assert.notEqual(state.boneChecksum, before[index].boneChecksum);
      const animation = placements[index].animation;
      assert.ok(Math.abs(state.playhead - (animation.phase * 2 + .37 * animation.speed)) < 1e-6, `${state.id} retains its independent speed and phase`);
      assert.deepEqual(state.anchor, placements[index].position);
      assert.ok(state.rootOffset.every((value) => Math.abs(value) < 1e-8), 'authored root movement does not walk away from the door');
      assert.ok(Math.abs(state.footHeight - placements[index].position[1]) < 1e-8, 'the supporting sole follows the entrance elevation');
    }
    for (let frame = 1; frame <= 180; frame += 1) cast.update(.37 + frame / 30);
    const later = cast.sampleMotion();
    for (let index = 0; index < later.length; index += 1) {
      assert.ok(later[index].rootOffset.every((value) => Math.abs(value) < 1e-8), 'many loop boundaries do not accumulate drift');
      assert.ok(Math.abs(later[index].footHeight - placements[index].position[1]) < 1e-8, 'grounding survives several full loops');
      assert.ok(later[index].activity > .001, 'looped actions remain active');
    }
  } finally {
    THREE.Box3.prototype.setFromObject = originalBounds;
  }
  assert.deepEqual(asset.clip.tracks[0].values, originalTrack, 'in-place playback never rewrites the supplied animation');
  assert.equal(asset.root.position.length(), 0, 'cloned actions leave the source rig untouched');
  cast.dispose();
});

test('absolute playback rewinds deterministically and repeated timestamps resume without freezing', async () => {
  const asset = animatedAsset();
  const cast = await loadCharacterCast(new THREE.Scene(), {
    loader: { loadAsync: async () => asset }, baseUrl: '/characters/',
    placements: [placement('live', { animation: { clip: 'Living_Neighbor', loop: true, time: .2, speed: .8 } })],
  });
  cast.update(.5);
  const expected = cast.sampleMotion()[0];
  cast.update(.5);
  assert.equal(cast.sampleMotion()[0].activity, 0, 'a paused clock does not invent animation or drift');
  cast.update(3.5);
  assert.notEqual(cast.sampleMotion()[0].boneChecksum, expected.boneChecksum, 'authored motion resumes after an unchanged clock');
  cast.update(.5);
  const rewound = cast.sampleMotion()[0];
  assert.ok(Math.abs(rewound.playhead - expected.playhead) < 1e-9);
  assert.ok(Math.abs(rewound.boneChecksum - expected.boneChecksum) < 1e-7, 'an explicit seek reproduces the same authored pose');
  cast.update(Number.NaN);
  assert.equal(cast.sampleMotion()[0].activity, 0, 'invalid clock input does not reset live characters');
  cast.dispose();
  assert.deepEqual(cast.sampleMotion(), []);
});


test('a rotated distant placement keeps its actual rig and soles at the entrance after playback starts', async () => {
  const asset = animatedAsset();
  const requested = placement('market-neighbor', {
    position: [17.65, .371, 33], yaw: -.3,
    animation: { clip: 'Living_Neighbor', loop: true, phase: .12, speed: .9 },
  });
  const parent = new THREE.Scene();
  const cast = await loadCharacterCast(parent, {
    loader: { loadAsync: async () => asset }, placements: [requested], baseUrl: '/characters/',
  });
  const character = cast.group.children[0];
  character.updateWorldMatrix(true, true);
  const root = character.getObjectByName('spine');
  const originalRoot = root.getWorldPosition(new THREE.Vector3());
  const originalBounds = new THREE.Box3().setFromObject(character, true);
  assert.ok(Math.abs(originalBounds.min.y - requested.position[1]) < 1e-8);
  for (const elapsed of [0, .37, 1.1, 2.7, 8.2]) {
    cast.update(elapsed);
    const actualRoot = root.getWorldPosition(new THREE.Vector3());
    assert.ok(Math.abs(actualRoot.x - originalRoot.x) < 1e-8, 'the rig does not add the entrance X coordinate a second time');
    assert.ok(Math.abs(actualRoot.z - originalRoot.z) < 1e-8, 'the rig does not add the entrance Z coordinate a second time');
    const bounds = new THREE.Box3().setFromObject(character, true);
    assert.ok(Math.abs(bounds.min.y - requested.position[1]) < 1e-8, `actual deformed geometry stays at the elevated entrance: ${elapsed}, ${bounds.min.y}`);
    assert.ok(bounds.getCenter(new THREE.Vector3()).distanceTo(new THREE.Vector3(17.65, 1.271, 33)) < 2, 'visible geometry remains beside its assigned location');
  }
  cast.dispose();
});

test('a diagonal foot roll keeps the actual outer shoe corner above the pavement', async () => {
  const scene = new THREE.Group();
  const geometry = new THREE.BufferGeometry();
  // The final bottom corner is not the first min/max of any individual axis.
  // It becomes the supporting point when the foot rolls diagonally.
  const positions = [-.6, 0, -.8, .7, 0, -.8, -.6, 0, .9, .7, 0, .9, 0, 2, 0];
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const indices = new Uint16Array(positions.length / 3 * 4);
  const weights = new Float32Array(indices.length);
  for (let index = 0; index < positions.length / 3; index += 1) {
    indices[index * 4] = index < 4 ? 1 : 0;
    weights[index * 4] = 1;
  }
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
  const root = new THREE.Bone();
  root.name = 'spine';
  const foot = new THREE.Bone();
  foot.name = 'footL';
  root.add(foot);
  const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshBasicMaterial());
  mesh.add(root);
  mesh.bind(new THREE.Skeleton([root, foot]));
  scene.add(mesh);
  const roll = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, -1).normalize(), .6);
  const clip = new THREE.AnimationClip('Foot_Roll', 1, [
    new THREE.QuaternionKeyframeTrack('footL.quaternion', [0, .5, 1], [0, 0, 0, 1, ...roll.toArray(), 0, 0, 0, 1]),
    new THREE.VectorKeyframeTrack('spine.position', [0, 1], [0, 0, 0, 0, 0, 0]),
  ]);
  const requested = placement('rolling-neighbor', { position: [17.65, .371, 33], yaw: -.3, animation: { clip: 'Foot_Roll', loop: true } });
  const cast = await loadCharacterCast(new THREE.Scene(), {
    loader: { loadAsync: async () => ({ scene, animations: [clip] }) }, placements: [requested], baseUrl: '/characters/',
  });
  for (const elapsed of [.1, .25, .5, .75, 2.5]) {
    cast.update(elapsed);
    const bounds = new THREE.Box3().setFromObject(cast.group.children[0], true);
    assert.ok(Math.abs(bounds.min.y - requested.position[1]) < 1e-7, `the actual supporting corner stays on the floor at ${elapsed}s`);
  }
  cast.dispose();
});
