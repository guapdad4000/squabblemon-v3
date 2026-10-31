import * as THREE from 'three';

const texturesOf = (material) => Object.values(material).filter((value) => value?.isTexture);
const imagesOf = (texture) => {
  const image = texture.source?.data ?? texture.image;
  return Array.isArray(image) ? image : image ? [image] : [];
};
const boxData = (box) => ({ min: box.min.toArray(), max: box.max.toArray() });

function validatePlacement(placement, ids) {
  if (!placement?.id || ids.has(placement.id)) throw new Error(`Duplicate or missing prop id: ${placement?.id}`);
  ids.add(placement.id);
  if (typeof placement.asset !== 'string' || !/^[\w-]+\.glb$/i.test(placement.asset)) throw new Error(`Invalid model asset for ${placement.id}.`);
  if (!Array.isArray(placement.position) || placement.position.length !== 3 || !placement.position.every(Number.isFinite)) throw new Error(`Invalid ground position for ${placement.id}.`);
  if (!Number.isFinite(placement.targetLength) || placement.targetLength <= 0) throw new Error(`Invalid target length for ${placement.id}.`);
  if (placement.yaw !== undefined && !Number.isFinite(placement.yaw)) throw new Error(`Invalid yaw for ${placement.id}.`);
}

/**
 * Place the supplied static models without editing geometry, UVs or color art.
 * Positions mark the ground-center in the parent's local coordinates. Length is
 * the largest source horizontal extent, before placement yaw; these Meshy cars
 * and bikes are authored along X. Keep their orientation explicit in placements.
 * Publication is atomic and no more than two complete assets load concurrently.
 */
export async function loadNeighborhoodProps({ parent, placements, baseUrl, loader, onProgress } = {}) {
  if (!parent?.isObject3D) throw new Error('Neighborhood props require a scene parent.');
  if (!loader?.loadAsync) throw new Error('Neighborhood props require a configured GLTFLoader.');
  if (!Array.isArray(placements)) throw new Error('Neighborhood props require placements.');
  if (typeof baseUrl !== 'string') throw new Error('Neighborhood props require an asset base URL.');
  const ids = new Set();
  placements.forEach((placement) => validatePlacement(placement, ids));

  const group = new THREE.Group();
  group.name = 'Uploaded neighborhood vehicles and shopping cart';
  group.userData.isNeighborhoodProp = true;
  const prefix = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const names = [...new Set(placements.map(({ asset }) => asset))];
  const assets = new Map(), converted = new Map();
  const geometries = new Set(), materials = new Set(), textures = new Set(), closedImages = new Set();
  const records = [];
  let next = 0, loaded = 0, loadError = null, disposed = false;
  let releasedMaterials = 0, releasedTextures = 0;

  function collect(root) {
    root.traverse((object) => {
      if (object.geometry) geometries.add(object.geometry);
      for (const material of object.material ? (Array.isArray(object.material) ? object.material : [object.material]) : []) {
        materials.add(material);
        texturesOf(material).forEach((texture) => textures.add(texture));
      }
    });
  }

  function closeImage(image) {
    if (closedImages.has(image)) return;
    image.close?.();
    closedImages.add(image);
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    group.removeFromParent();
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    for (const texture of textures) {
      texture.dispose();
      imagesOf(texture).forEach(closeImage);
    }
    group.clear();
    assets.clear(); converted.clear();
    geometries.clear(); materials.clear(); textures.clear();
  }

  async function worker() {
    while (!loadError && next < names.length) {
      const asset = names[next++];
      try {
        const gltf = await loader.loadAsync(`${prefix}${asset}`, (event) => onProgress?.({
          loaded, total: names.length, asset, phase: 'loading', bytesLoaded: event.loaded ?? 0, bytesTotal: event.total ?? 0,
        }));
        if (!gltf?.scene?.isObject3D) throw new Error('The model contains no scene.');
        assets.set(asset, gltf);
        collect(gltf.scene);
        const expected = gltf.parser?.json?.textures?.length ?? 0;
        if (expected) {
          const dependencies = await gltf.parser.getDependencies('texture');
          dependencies.filter((texture) => texture?.isTexture).forEach((texture) => textures.add(texture));
          if (dependencies.length !== expected || dependencies.some((texture) => !texture?.isTexture || !texture.source?.data)) throw new Error('A model texture did not load.');
        }
        loaded += 1;
        onProgress?.({ loaded, total: names.length, asset, phase: 'loaded', bytesLoaded: 0, bytesTotal: 0 });
      } catch (error) {
        loadError ??= new Error(`Could not load neighborhood prop ${asset}: ${error.message}`, { cause: error });
      }
    }
  }

  function unlit(source) {
    if (converted.has(source)) return converted.get(source);
    if (source.isMeshBasicMaterial) { converted.set(source, source); return source; }
    const material = new THREE.MeshBasicMaterial({
      color: source.color?.clone() ?? 0xffffff,
      map: source.map ?? source.emissiveMap ?? null,
      alphaMap: source.alphaMap ?? null,
      transparent: source.transparent, opacity: source.opacity, alphaTest: source.alphaTest,
      side: source.side, vertexColors: source.vertexColors,
      depthTest: source.depthTest, depthWrite: source.depthWrite, colorWrite: source.colorWrite,
      blending: source.blending, premultipliedAlpha: source.premultipliedAlpha,
      polygonOffset: source.polygonOffset, polygonOffsetFactor: source.polygonOffsetFactor, polygonOffsetUnits: source.polygonOffsetUnits,
      toneMapped: source.toneMapped, fog: source.fog,
    });
    material.name = source.name;
    material.visible = source.visible;
    material.alphaHash = source.alphaHash ?? false;
    material.alphaToCoverage = source.alphaToCoverage ?? false;
    material.userData = { ...source.userData, sourceMaterialType: source.type, preserveUploadedArtwork: true };
    converted.set(source, material);
    materials.add(material);
    return material;
  }

  try {
    await Promise.all(Array.from({ length: Math.min(2, names.length) }, worker));
    if (loadError) throw loadError;
    for (const placement of placements) {
      const model = assets.get(placement.asset).scene.clone(true);
      model.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(model, true);
      const size = bounds.getSize(new THREE.Vector3());
      const horizontalLength = Math.max(size.x, size.z);
      if (bounds.isEmpty() || !size.toArray().every(Number.isFinite) || size.y <= 0 || horizontalLength <= 0) throw new Error(`Prop ${placement.id} has invalid visible bounds.`);
      const scale = placement.targetLength / horizontalLength;
      const center = bounds.getCenter(new THREE.Vector3());
      const prop = new THREE.Group();
      prop.name = placement.name ?? placement.id;
      prop.position.fromArray(placement.position);
      prop.rotation.y = placement.yaw ?? 0;
      const tags = { isNeighborhoodProp: true, propId: placement.id, propAsset: placement.asset };
      Object.assign(prop.userData, tags);
      const normalizer = new THREE.Group();
      normalizer.name = 'Source units and ground normalization';
      normalizer.scale.setScalar(scale);
      normalizer.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
      normalizer.add(model);
      prop.add(normalizer);
      group.add(prop);
      let meshes = 0, drawCalls = 0, vertices = 0, triangles = 0;
      model.traverse((object) => {
        Object.assign(object.userData, tags);
        if (!object.isMesh) return;
        meshes += 1;
        vertices += object.geometry.getAttribute('position')?.count ?? 0;
        triangles += (object.geometry.index?.count ?? object.geometry.getAttribute('position')?.count ?? 0) / 3;
        drawCalls += Array.isArray(object.material) ? Math.max(1, object.geometry.groups.length) : 1;
        object.material = Array.isArray(object.material) ? object.material.map(unlit) : unlit(object.material);
      });
      if (!meshes) throw new Error(`Prop ${placement.id} contains no meshes.`);
      prop.updateMatrixWorld(true);
      const placedBounds = new THREE.Box3().setFromObject(prop, true);
      records.push({
        id: placement.id, name: placement.name ?? placement.id, asset: placement.asset, url: `${prefix}${placement.asset}`,
        position: [...placement.position], yaw: placement.yaw ?? 0, targetLength: placement.targetLength,
        scale, innerOffset: normalizer.position.toArray(), sourceBounds: boxData(bounds), sourceDimensions: size.toArray(),
        localDimensions: size.clone().multiplyScalar(scale).toArray(),
        normalizedDimensions: size.clone().multiplyScalar(scale).toArray(),
        placedBounds: boxData(placedBounds), dimensions: placedBounds.getSize(new THREE.Vector3()).toArray(),
        meshes, drawCalls, vertices, triangles,
      });
    }

    const usedMaterials = new Set(), usedTextures = new Set();
    group.traverse((object) => {
      for (const material of object.material ? (Array.isArray(object.material) ? object.material : [object.material]) : []) {
        usedMaterials.add(material);
        texturesOf(material).forEach((texture) => usedTextures.add(texture));
      }
    });
    const usedImages = new Set([...usedTextures].flatMap(imagesOf));
    for (const material of materials) {
      if (usedMaterials.has(material)) continue;
      material.dispose(); materials.delete(material); releasedMaterials += 1;
    }
    for (const texture of textures) {
      if (usedTextures.has(texture)) continue;
      texture.dispose(); textures.delete(texture); releasedTextures += 1;
      imagesOf(texture).filter((image) => !usedImages.has(image)).forEach(closeImage);
    }
    assets.clear(); converted.clear();
    const stats = Object.freeze({
      props: records.length, assets: names.length,
      meshes: records.reduce((sum, record) => sum + record.meshes, 0),
      drawCalls: records.reduce((sum, record) => sum + record.drawCalls, 0),
      vertices: records.reduce((sum, record) => sum + record.vertices, 0),
      triangles: records.reduce((sum, record) => sum + record.triangles, 0),
      textures: usedTextures.size, releasedMaterials, releasedTextures,
    });
    parent.add(group);
    group.updateWorldMatrix(true, true);
    records.forEach((record, index) => {
      record.worldBounds = boxData(new THREE.Box3().setFromObject(group.children[index], true));
      Object.freeze(record);
    });
    group.userData.stats = stats;
    group.userData.records = records;
    return { group, records: Object.freeze(records), stats, dispose };
  } catch (error) {
    dispose();
    throw error;
  }
}
