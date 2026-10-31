import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { RELAXED_IDLE_NAME, retargetRelaxedIdle, validateAdditionalAnimations } from './humanoid-idle.js';

const IDLE_NAME = /(?:^|[|_.:\s-])idle(?:$|[|_.:\s-]|\d)/i;
const OTHER_MOTION = /walk|run|jump|attack|punch|kick|dance|transition|\bto\b/i;
const FOOT_NAME = /foot|toe|ankle|(?:frontleg|backleg)2$/i;
// Axis and diagonal support directions retain the sole's 3D hull, including
// edges that become the lowest point when a foot rolls or a toe bends.
const SOLE_DIRECTIONS = [-1, 0, 1].flatMap((x) => [-1, 0, 1].flatMap((y) =>
  [-1, 0, 1].filter((z) => x || y || z).map((z) => [x, y, z])));
const samplePoint = new THREE.Vector3();
const sampleInverse = new THREE.Matrix4();

function authoredIdle(animations) {
  return animations.find((clip) => IDLE_NAME.test(clip.name) && !OTHER_MOTION.test(clip.name)) ?? null;
}

function texturesOf(material) {
  return Object.values(material).filter((value) => value?.isTexture);
}

function imageSources(texture) {
  const data = texture.source?.data ?? texture.image;
  return Array.isArray(data) ? data : data ? [data] : [];
}

function checkPlacement(placement, seen) {
  if (!placement?.id || seen.has(placement.id)) throw new Error(`Duplicate or missing character id: ${placement?.id}`);
  seen.add(placement.id);
  if (typeof placement.asset !== 'string' || !placement.asset.length) throw new Error(`Missing model asset for ${placement.id}.`);
  if (!Array.isArray(placement.position) || placement.position.length !== 3 || !placement.position.every(Number.isFinite)) {
    throw new Error(`Invalid feet position for ${placement.id}.`);
  }
  if (!Number.isFinite(placement.height) || placement.height <= 0) throw new Error(`Invalid character height for ${placement.id}.`);
  if (placement.yaw !== undefined && !Number.isFinite(placement.yaw)) throw new Error(`Invalid yaw for ${placement.id}.`);
  if (placement.idle && placement.idle.clip !== RELAXED_IDLE_NAME) throw new Error(`Unsupported registered idle for ${placement.id}.`);
  if (placement.pose?.rotation && (!Array.isArray(placement.pose.rotation) || placement.pose.rotation.length !== 3 || !placement.pose.rotation.every(Number.isFinite))) throw new Error(`Invalid pose for ${placement.id}.`);
  if (placement.animation && (typeof placement.animation.clip !== 'string' ||
      (placement.animation.time !== undefined && (!Number.isFinite(placement.animation.time) || placement.animation.time < 0)) ||
      (placement.animation.speed !== undefined && (!Number.isFinite(placement.animation.speed) || placement.animation.speed <= 0)) ||
      (placement.animation.phase !== undefined && (!Number.isFinite(placement.animation.phase) || placement.animation.phase < 0)))) {
    throw new Error(`Invalid authored animation for ${placement.id}.`);
  }
}

function soleHeight(motion) {
  if (!motion.probes.length) return null;
  sampleInverse.copy(motion.character.matrixWorld).invert();
  let minimum = Infinity;
  for (const { mesh, index } of motion.probes) {
    mesh.getVertexPosition(index, samplePoint).applyMatrix4(mesh.matrixWorld).applyMatrix4(sampleInverse);
    minimum = Math.min(minimum, samplePoint.y);
  }
  return minimum;
}

// Reclining support uses the back/shoulder skin above an actual support face.
// Hair hanging below the body must not suspend the torso above a crate.
function supportFixedPose(character, model, normalizer, support) {
  if (!support) return null;
  const bones = new Set(support.bones), surfaces = support.surfaces;
  if (!bones.size || !Array.isArray(surfaces) || !surfaces.length || surfaces.some(s =>
    ![...s.min, ...s.max, s.top].every(Number.isFinite))) throw new Error('Invalid character support surfaces.');
  character.updateWorldMatrix(true, true);
  character.updateMatrixWorld(true);
  let adjustment = -Infinity, samples = 0, contact = null;
  const point = new THREE.Vector3();
  model.traverse(mesh => {
    if (!mesh.isSkinnedMesh) return;
    const weights = mesh.geometry.attributes.skinWeight, indices = mesh.geometry.attributes.skinIndex;
    for (let index = 0; index < weights.count; index++) {
      let best = 0;
      for (let slot = 1; slot < 4; slot++) if (weights.getComponent(index, slot) > weights.getComponent(index, best)) best = slot;
      if (!bones.has(mesh.skeleton.bones[indices.getComponent(index, best)]?.name)) continue;
      mesh.getVertexPosition(index, point).applyMatrix4(mesh.matrixWorld);
      for (const surface of surfaces) {
        if (point.x < surface.min[0] || point.x > surface.max[0] || point.z < surface.min[1] || point.z > surface.max[1]) continue;
        const shift = surface.top + (support.clearance ?? 0) - point.y;
        samples++;
        if (shift > adjustment) { adjustment = shift; contact = { index, bone: mesh.skeleton.bones[indices.getComponent(index, best)].name, point: point.toArray(), top: surface.top }; }
      }
    }
  });
  if (!Number.isFinite(adjustment)) throw new Error('The reclining body misses its support surfaces.');
  normalizer.position.y += adjustment;
  character.updateWorldMatrix(true, true);
  character.updateMatrixWorld(true);
  contact.point[1] += adjustment;
  return { samples, adjustment, contact, clearance: support.clearance ?? 0 };
}

/**
 * Load the supplied artwork without changing its mesh, UVs, rig or textures.
 * Placement positions are feet in the parent's local coordinates; local +Z is
 * the front. A complete imported scene stays inside a normalizing wrapper, so
 * bind matrices and authored animation units remain together.
 *
 * onProgress receives { loaded, total, asset, bytesLoaded, bytesTotal, phase }.
 * update accepts absolute elapsed seconds. A placement may select an exact
 * authored animation with { clip, time, phase, speed, loop }; phase is a fraction
 * of its duration. Root translation stays at the entrance; authored limb motion
 * continues, and cached sole probes keep the supporting foot on the pavement.
 */
export async function loadCharacterCast(parent, { loader, placements, baseUrl, onProgress, additionalAnimations = {} } = {}) {
  if (!parent?.isObject3D) throw new Error('Character cast requires a scene parent.');
  if (!loader?.loadAsync) throw new Error('Character cast requires a configured GLTFLoader.');
  if (!Array.isArray(placements)) throw new Error('Character cast requires placements.');
  if (typeof baseUrl !== 'string') throw new Error('Character cast requires an asset base URL.');
  if (!additionalAnimations || typeof additionalAnimations !== 'object' || Array.isArray(additionalAnimations)) throw new Error('Additional animations require a placement-id map.');
  const ids = new Set();
  placements.forEach((placement) => checkPlacement(placement, ids));
  for (const id of Object.keys(additionalAnimations)) if (!ids.has(id)) throw new Error(`Additional animations target unknown character ${id}.`);

  const group = new THREE.Group();
  group.name = 'Uploaded neighborhood character cast';
  group.userData.isPlacedCharacter = true;
  group.userData.ignoreCameraCollision = true;

  const assetNames = [...new Set(placements.map((placement) => placement.asset))];
  const assets = new Map();
  const geometries = new Set(), materials = new Set(), textures = new Set(), skeletons = new Set();
  const convertedMaterials = new Map();
  const mixers = [], records = [];
  let previousTime = 0;
  let nextAsset = 0, loaded = 0, loadError = null, disposed = false;
  let releasedMaterials = 0, releasedTextures = 0;
  const prefix = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;

  function collect(root) {
    root.traverse((object) => {
      if (object.geometry) geometries.add(object.geometry);
      if (object.skeleton) skeletons.add(object.skeleton);
      for (const material of object.material ? (Array.isArray(object.material) ? object.material : [object.material]) : []) {
        materials.add(material);
        texturesOf(material).forEach((texture) => textures.add(texture));
      }
    });
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    group.removeFromParent();
    for (const { mixer, root } of mixers) {
      mixer.stopAllAction();
      mixer.uncacheRoot(root);
    }
    for (const skeleton of skeletons) skeleton.dispose();
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    for (const texture of textures) texture.dispose();
    group.clear();
    assets.clear();
    convertedMaterials.clear();
    geometries.clear(); materials.clear(); textures.clear(); skeletons.clear();
    mixers.length = 0;
  }

  // GLTFLoader logs failed image dependencies and can still resolve a scene.
  // Check them explicitly so missing artwork cannot silently become a blank NPC.
  async function validateTextures(gltf, asset) {
    const parser = gltf.parser;
    const expected = parser?.json?.textures?.length ?? 0;
    if (!expected) return;
    const dependencies = await parser.getDependencies('texture');
    for (const texture of dependencies) if (texture?.isTexture) textures.add(texture);
    if (dependencies.length !== expected || dependencies.some((texture) => !texture?.isTexture || !texture.source?.data)) {
      throw new Error(`A texture did not load in ${asset}.`);
    }
  }

  async function loadWorker() {
    while (!loadError && nextAsset < assetNames.length) {
      const asset = assetNames[nextAsset++];
      try {
        const gltf = await loader.loadAsync(`${prefix}${asset}`, (event) => {
          onProgress?.({ loaded, total: assetNames.length, asset, bytesLoaded: event.loaded ?? 0, bytesTotal: event.total ?? 0, phase: 'loading' });
        });
        if (!gltf?.scene?.isObject3D) throw new Error('The model contains no scene.');
        assets.set(asset, gltf);
        collect(gltf.scene);
        await validateTextures(gltf, asset);
        loaded += 1;
        onProgress?.({ loaded, total: assetNames.length, asset, bytesLoaded: 0, bytesTotal: 0, phase: 'loaded' });
      } catch (error) {
        loadError ??= new Error(`Could not load character ${asset}: ${error.message}`, { cause: error });
      }
    }
  }

  function unlit(source) {
    if (convertedMaterials.has(source)) return convertedMaterials.get(source);
    if (source.isMeshBasicMaterial) {
      convertedMaterials.set(source, source);
      return source;
    }
    const material = new THREE.MeshBasicMaterial({
      color: source.color?.clone() ?? 0xffffff,
      map: source.map ?? source.emissiveMap ?? null,
      alphaMap: source.alphaMap ?? null,
      aoMap: source.aoMap ?? null,
      aoMapIntensity: source.aoMapIntensity ?? 1,
      lightMap: source.lightMap ?? null,
      lightMapIntensity: source.lightMapIntensity ?? 1,
      transparent: source.transparent,
      opacity: source.opacity,
      alphaTest: source.alphaTest,
      side: source.side,
      vertexColors: source.vertexColors,
      depthTest: source.depthTest,
      depthWrite: source.depthWrite,
      colorWrite: source.colorWrite,
      blending: source.blending,
      premultipliedAlpha: source.premultipliedAlpha,
      polygonOffset: source.polygonOffset,
      polygonOffsetFactor: source.polygonOffsetFactor,
      polygonOffsetUnits: source.polygonOffsetUnits,
      toneMapped: source.toneMapped,
      fog: source.fog,
    });
    material.name = source.name;
    material.userData = { ...source.userData, sourceMaterialType: source.type, preserveUploadedArtwork: true };
    material.alphaHash = source.alphaHash ?? false;
    material.alphaToCoverage = source.alphaToCoverage ?? false;
    material.visible = source.visible;
    materials.add(material);
    convertedMaterials.set(source, material);
    return material;
  }

  try {
    // An asset owns its image decode work too; no more than two models are in
    // flight, even when a model refers to several embedded images.
    await Promise.all(Array.from({ length: Math.min(2, assetNames.length) }, () => loadWorker()));
    if (loadError) throw loadError;

    for (const placement of placements) {
      const gltf = assets.get(placement.asset);
      const model = cloneSkeleton(gltf.scene);
      model.updateMatrixWorld(true);
      const extras = validateAdditionalAnimations(model, additionalAnimations[placement.id] ?? []);
      const animations = [...(gltf.animations ?? []), ...extras];
      let idleReport = null;
      if (placement.idle) { const registered = retargetRelaxedIdle(model, { name: placement.idle.clip }); animations.push(registered.clip); idleReport = registered.report; }
      if (new Set(animations.map(clip=>clip.name)).size !== animations.length) throw new Error(`Duplicate character clip for ${placement.id}.`);
      const sourceBounds = new THREE.Box3().setFromObject(model, true);
      const sourceSize = sourceBounds.getSize(new THREE.Vector3());
      const clip = placement.animation
        ? animations.find((candidate) => candidate.name === placement.animation.clip)
        : authoredIdle(animations);
      if (placement.animation && !clip) throw new Error(`Character ${placement.id} has no authored clip ${placement.animation.clip}.`);
      const animated = Boolean(clip && placement.animation?.loop !== false);
      const animationSpeed = placement.animation?.speed ?? 1;
      const animationTime = (placement.animation?.time ?? 0) + (placement.animation?.phase ?? 0) * (clip?.duration ?? 0);
      let motion = null;
      if (clip) {
        const mixer = new THREE.AnimationMixer(model);
        const action = mixer.clipAction(clip).setLoop(THREE.LoopRepeat, Infinity).play();
        action.time = clip.duration > 0 ? animationTime % clip.duration : 0;
        action.setEffectiveTimeScale(animationSpeed);
        mixer.update(0);
        action.paused = !animated;
        motion = { id: placement.id, clip, clips: animations, loop: true, clampWhenFinished: false, mixer, action, root: model, animated, animationTime, animationSpeed, groundSupport: placement.groundSupport !== false };
        mixers.push(motion);
        model.updateMatrixWorld(true);
      }
      // A chosen guard pose can differ from the file's bind pose. Normalize the
      // actual displayed pose so its soles, rather than the rig origin, land at
      // the authored entrance level.
      const standingBounds = new THREE.Box3().setFromObject(model, true);
      const poseRoot = new THREE.Group();
      poseRoot.name = 'Authored character posture';
      poseRoot.add(model);
      if (placement.pose?.rotation) poseRoot.rotation.fromArray(placement.pose.rotation);
      poseRoot.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(poseRoot, true);
      const size = bounds.getSize(new THREE.Vector3());
      if (bounds.isEmpty() || !size.toArray().every(Number.isFinite) || size.y <= 0) {
        throw new Error(`Character ${placement.id} has invalid visible bounds.`);
      }
      const center = bounds.getCenter(new THREE.Vector3());
      // A reclining pose keeps the standing character's size. Normalizing its
      // reduced vertical thickness would otherwise create a giant character.
      const scale = placement.height / (placement.pose ? standingBounds.getSize(new THREE.Vector3()).y : size.y);
      const character = new THREE.Group();
      character.name = `${placement.name ?? placement.id} | ${placement.locationId ?? 'neighborhood'}`;
      character.position.fromArray(placement.position);
      character.rotation.y = placement.yaw ?? 0;
      const tags = { isPlacedCharacter: true, characterId: placement.id, locationId: placement.locationId, ignoreCameraCollision: true };
      Object.assign(character.userData, tags);
      const normalizer = new THREE.Group();
      normalizer.name = 'Source units and feet normalization';
      normalizer.scale.setScalar(scale);
      normalizer.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
      character.add(normalizer);
      normalizer.add(poseRoot);
      group.add(character);
      if (placement.pose?.support && animated) throw new Error('A supported reclining pose must be fixed.');
      const support = supportFixedPose(character, model, normalizer, placement.pose?.support);

      let meshes = 0, drawCalls = 0, triangles = 0, skinnedMeshes = 0;
      const bones = new Set();
      model.traverse((object) => {
        Object.assign(object.userData, tags);
        if (!object.isMesh) return;
        meshes += 1;
        const sourceMaterials = Array.isArray(object.material) ? object.material : [object.material];
        const converted = sourceMaterials.map(unlit);
        object.material = Array.isArray(object.material) ? converted : converted[0];
        drawCalls += Array.isArray(object.material) ? Math.max(1, object.geometry.groups.length) : 1;
        triangles += (object.geometry.index?.count ?? object.geometry.getAttribute('position')?.count ?? 0) / 3;
        if (object.isSkinnedMesh) {
          skinnedMeshes += 1;
          object.frustumCulled = false;
          skeletons.add(object.skeleton);
          object.skeleton.bones.forEach((bone) => bones.add(bone));
        }
      });
      if (!meshes) throw new Error(`Character ${placement.id} contains no meshes.`);
      if (motion) {
        Object.assign(motion, { character, normalizer, bones: [...bones], probes: [], previousSample: null });
        // Root motion belongs to the entrance rather than to the neighborhood.
        // Anchor only the highest animated position node. Keeping the imported
        // clip untouched preserves its hip bob, rotations, and limb animation.
        const positioned = new Set();
        for (const track of clip.tracks) {
          const binding = THREE.PropertyBinding.parseTrackName(track.name);
          if (binding.propertyName !== 'position') continue;
          const node = THREE.PropertyBinding.findNode(model, binding.nodeName);
          if (node) positioned.add(node);
        }
        motion.motionRoot = [...positioned].find((node) => {
          for (let ancestor = node.parent; ancestor && ancestor !== model.parent; ancestor = ancestor.parent) {
            if (positioned.has(ancestor)) return false;
          }
          return true;
        }) ?? null;
        // Resolve placement ancestors before taking local-space references.
        // The downward update also refreshes SkinnedMesh bind-matrix inverses.
        character.updateWorldMatrix(true, false);
        character.updateMatrixWorld(true);
        sampleInverse.copy(character.matrixWorld).invert();
        if (motion.motionRoot) {
          motion.rootAnchor = motion.motionRoot.getWorldPosition(new THREE.Vector3()).applyMatrix4(sampleInverse);
        }
        // Inspect skin weights once, keeping directional extrema per foot/toe
        // bone rather than merging an entire shoe. A toe can become a support
        // point after articulation even when it was hidden inside the initial
        // foot hull. Per-frame work still depends only on cached probes.
        const extrema = new Map();
        const soleCandidates = [];
        model.traverse((mesh) => {
          if (!mesh.isSkinnedMesh) return;
          const indices = mesh.geometry.getAttribute('skinIndex');
          const weights = mesh.geometry.getAttribute('skinWeight');
          const positions = mesh.geometry.getAttribute('position');
          if (!indices || !weights || !positions) return;
          const feet = new Map();
          mesh.skeleton.bones.forEach((bone, index) => {
            if (FOOT_NAME.test(bone.name)) feet.set(index, bone.name);
          });
          if (!feet.size) return;
          for (let index = 0; index < positions.count; index += 1) {
            const influence = new Map();
            for (let slot = 0; slot < 4; slot += 1) {
              const side = feet.get(indices.getComponent(index, slot));
              if (side) influence.set(side, (influence.get(side) ?? 0) + weights.getComponent(index, slot));
            }
            if ([...influence.values()].reduce((sum, weight) => sum + weight, 0) < .25) continue;
            const groups = [...influence].filter(([, weight]) => weight >= .1).map(([bone]) => bone);
            soleCandidates.push({ mesh, index, groups });
            mesh.getVertexPosition(index, samplePoint).applyMatrix4(mesh.matrixWorld).applyMatrix4(sampleInverse);
            for (const [side, weight] of influence) {
              if (weight < .1) continue;
              if (!extrema.has(side)) extrema.set(side, Array(SOLE_DIRECTIONS.length).fill(null));
              const samples = extrema.get(side);
              for (let direction = 0; direction < SOLE_DIRECTIONS.length; direction += 1) {
                const [x, y, z] = SOLE_DIRECTIONS[direction];
                const value = samplePoint.x * x + samplePoint.y * y + samplePoint.z * z;
                if (!samples[direction] || value < samples[direction].value) samples[direction] = { mesh, index, value };
              }
            }
          }
        });
        function retainProbe(probe) {
          if (!probe || motion.probes.some(({ mesh, index }) => mesh === probe.mesh && index === probe.index)) return;
          motion.probes.push({ mesh: probe.mesh, index: probe.index });
        }
        [...extrema.values()].flat().forEach(retainProbe);
        // Blended shin/foot vertices are not a rigid hull: an interior vertex
        // can become the lowest point during a dance. Sample support at load
        // time only, retaining the few winners rather than every candidate.
        if (animated && soleCandidates.length && clip.duration > 0) {
          const initialTime = motion.action.time;
          for (let phase = 0; phase < 32; phase += 1) {
            motion.action.time = clip.duration * phase / 32;
            motion.mixer.update(0);
            normalizer.updateMatrixWorld(true);
            const supports = new Map();
            for (const candidate of soleCandidates) {
              const { mesh, index, groups } = candidate;
              mesh.getVertexPosition(index, samplePoint).applyMatrix4(mesh.matrixWorld).applyMatrix4(sampleInverse);
              for (const bone of groups) {
                if (!supports.has(bone) || samplePoint.y < supports.get(bone).height) supports.set(bone, { ...candidate, height: samplePoint.y });
              }
            }
            supports.forEach(retainProbe);
          }
          motion.action.time = initialTime;
          motion.mixer.update(0);
          normalizer.updateMatrixWorld(true);
        }
        motion.soleHeight = motion.groundSupport ? soleHeight(motion) : null;
      }
      records.push(Object.freeze({
        id: placement.id, name: placement.name ?? placement.id, locationId: placement.locationId,
        asset: placement.asset, url: `${prefix}${placement.asset}`,
        position: [...placement.position], yaw: placement.yaw ?? 0, height: placement.height,
        sourceBounds: { min: sourceBounds.min.toArray(), max: sourceBounds.max.toArray() },
        sourceDimensions: sourceSize.toArray(),
        posedSourceBounds: { min: bounds.min.toArray(), max: bounds.max.toArray() },
        posedSourceDimensions: size.toArray(), dimensions: size.clone().multiplyScalar(scale).toArray(),
        feet: [...placement.position],
        scale, clip: clip?.name ?? null, animated, animationTime, animationSpeed, animationDuration: clip?.duration ?? 0,
        rootMotionAnchored: Boolean(motion?.motionRoot), footProbes: motion?.probes.length ?? 0, availableClips: animations.map(({ name }) => name), registeredIdle: idleReport, additionalClips: extras.map(({name})=>name), pose: placement.pose ?? null, support, meshes, drawCalls, triangles, skinnedMeshes, bones: bones.size,
      }));
    }

    const usedMaterials = new Set(), usedTextures = new Set();
    group.traverse((object) => {
      for (const material of object.material ? (Array.isArray(object.material) ? object.material : [object.material]) : []) {
        usedMaterials.add(material);
        texturesOf(material).forEach((texture) => usedTextures.add(texture));
      }
    });
    const usedImages = new Set([...usedTextures].flatMap(imageSources));
    const closedImages = new Set();
    for (const material of materials) {
      if (usedMaterials.has(material)) continue;
      material.dispose(); materials.delete(material); releasedMaterials += 1;
    }
    for (const texture of textures) {
      if (usedTextures.has(texture)) continue;
      texture.dispose(); textures.delete(texture); releasedTextures += 1;
      for (const image of imageSources(texture)) {
        if (usedImages.has(image) || closedImages.has(image)) continue;
        image.close?.();
        closedImages.add(image);
      }
    }
    // The source scenes have served their cloning purpose. Keep only resources
    // referenced by the visible instances, rather than all decoded PBR maps.
    const liveSkeletons = new Set();
    group.traverse((object) => { if (object.skeleton) liveSkeletons.add(object.skeleton); });
    for (const skeleton of skeletons) if (!liveSkeletons.has(skeleton)) { skeleton.dispose(); skeletons.delete(skeleton); }
    assets.clear();
    convertedMaterials.clear();

    const stats = Object.freeze({
      characters: records.length, assets: assetNames.length,
      meshes: records.reduce((sum, record) => sum + record.meshes, 0),
      drawCalls: records.reduce((sum, record) => sum + record.drawCalls, 0),
      triangles: records.reduce((sum, record) => sum + record.triangles, 0),
      textures: usedTextures.size, idleAnimations: mixers.filter(({ animated }) => animated).length,
      frozenPoses: mixers.filter(({ animated }) => !animated).length,
      releasedMaterials, releasedTextures,
    });
    group.userData.stats = stats;
    group.userData.records = records;
    group.updateMatrixWorld(true);
    parent.add(group);

    function update(elapsedSeconds) {
      if (disposed) return;
      const time = Number.isFinite(elapsedSeconds) ? Math.max(0, elapsedSeconds) : previousTime;
      const delta = time - previousTime;
      for (const motion of mixers) {
        const { mixer, action, animated, animationTime, clip, normalizer, character, motionRoot, rootAnchor } = motion;
        if (!animated) continue;
        // Advance actions normally so looping actions retain their loop state.
        // An explicit backwards seek is supported for deterministic previews.
        if (motion.pendingSeek) {
          // An explicit local action seek already owns this frame. Do not add
          // the cast's global delta or replay its absolute elapsed clock.
          motion.pendingSeek = false;
          mixer.update(0);
        } else if (delta < 0) {
          mixer.setTime(0);
          action.reset().setLoop(motion.loop ? THREE.LoopRepeat : THREE.LoopOnce, motion.loop ? Infinity : 1).play();
          action.clampWhenFinished = motion.clampWhenFinished;
          action.time = clip.duration > 0 ? animationTime % clip.duration : 0;
          action.setEffectiveTimeScale(motion.animationSpeed);
          mixer.update(time);
        } else mixer.update(delta);
        character.updateWorldMatrix(true, false);
        character.updateMatrixWorld(true);
        sampleInverse.copy(character.matrixWorld).invert();
        if (motionRoot) {
          motionRoot.getWorldPosition(samplePoint).applyMatrix4(sampleInverse);
          normalizer.position.x += rootAnchor.x - samplePoint.x;
          normalizer.position.z += rootAnchor.z - samplePoint.z;
          normalizer.updateMatrixWorld(true);
        }
        if (motion.groundSupport && motion.soleHeight !== null) {
          normalizer.position.y += motion.soleHeight - soleHeight(motion);
          normalizer.updateMatrixWorld(true);
        }
      }
      previousTime = time;
    }

    function sampleMotion() {
      if (disposed) return [];
      return mixers.map((motion) => {
        const { character, action, clip, animated, bones, probes, motionRoot, rootAnchor } = motion;
        const values = bones.flatMap((bone) => [...bone.position.toArray(), ...bone.quaternion.toArray()]);
        const activity = motion.previousSample ? Math.sqrt(values.reduce((sum, value, index) => sum + (value - motion.previousSample[index]) ** 2, 0)) : 0;
        const boneChecksum = values.reduce((sum, value, index) => sum + value * (index + 1), 0);
        motion.previousSample = values;
        character.updateWorldMatrix(true, false);
        character.updateMatrixWorld(true);
        sampleInverse.copy(character.matrixWorld).invert();
        const rootPosition = motionRoot ? motionRoot.getWorldPosition(new THREE.Vector3()).applyMatrix4(sampleInverse) : null;
        return {
          id: motion.id, clip: clip.name, animated, playhead: action.time, duration: clip.duration,
          speed: motion.animationSpeed, activity, boneChecksum,
          anchor: character.position.toArray(),
          rootOffset: rootPosition ? [rootPosition.x - rootAnchor.x, rootPosition.z - rootAnchor.z] : [0, 0],
          footHeight: probes.length ? character.position.y + soleHeight(motion) - motion.soleHeight : null,
          footProbes: probes.length,
        };
      });
    }

    function setAnimation(id, clipName, { fadeDuration = .22, speed = 1, groundSupport = true, paused = false, time = 0, loop = true, clampWhenFinished = !loop, restart = false, seek = false } = {}) {
      const motion = mixers.find((item) => item.id === id);
      const nextClip = motion?.clips.find((item) => item.name === clipName);
      if (!nextClip || disposed || (seek && (!Number.isFinite(time) || time < 0))) return false;
      motion.groundSupport = groundSupport;
      if (motion.clip === nextClip && !restart && !seek) {
        motion.animationSpeed = speed;
        motion.action.setEffectiveTimeScale(speed);
        motion.loop = loop; motion.clampWhenFinished = clampWhenFinished;
        motion.action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1); motion.action.clampWhenFinished = clampWhenFinished;
        motion.action.paused = paused; motion.animated = !paused;
        return true;
      }
      const previous = motion.action;
      const next = motion.mixer.clipAction(nextClip).reset().setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1).setEffectiveTimeScale(speed).play();
      next.clampWhenFinished = clampWhenFinished;
      if (previous !== next && fadeDuration > 0 && !paused) { next.fadeIn(fadeDuration); previous.fadeOut(fadeDuration); }
      else if (previous !== next) previous.stop();
      next.time = nextClip.duration > 0 ? (loop ? time % nextClip.duration : Math.min(time, nextClip.duration)) : 0;
      next.paused = paused;
      motion.clip = nextClip; motion.action = next; motion.animationTime = 0; motion.pendingSeek = seek;
      motion.animationSpeed = speed; motion.animated = !paused; motion.loop = loop; motion.clampWhenFinished = clampWhenFinished;
      motion.mixer.update(0);
      if (paused) {
        motion.character.updateWorldMatrix(true, true);
        sampleInverse.copy(motion.character.matrixWorld).invert();
        if (motion.motionRoot) {
          motion.motionRoot.getWorldPosition(samplePoint).applyMatrix4(sampleInverse);
          motion.normalizer.position.x += motion.rootAnchor.x - samplePoint.x;
          motion.normalizer.position.z += motion.rootAnchor.z - samplePoint.z;
        }
        motion.normalizer.updateMatrixWorld(true);
        if (groundSupport && motion.soleHeight !== null) motion.normalizer.position.y += motion.soleHeight - soleHeight(motion);
        motion.normalizer.updateMatrixWorld(true);
      }
      // The same source rig/root and cached sole hull are retained when the
      // courier switches between a horizontal flight and a grounded idle.
      return true;
    }
    return { group, update, setAnimation, sampleMotion, dispose, stats, records: Object.freeze(records) };
  } catch (error) {
    dispose();
    throw error;
  }
}
