import { Color, SRGBColorSpace, TextureLoader } from 'three';

const BASE_URL = import.meta.env?.BASE_URL ?? '/';
export const NIGHT_BACKDROP_URLS = Object.freeze([
  BASE_URL + 'assets/v3/fadewood-night-panorama.webp',
  BASE_URL + 'assets/v3/fadewood-night-neighborhood.webp',
]);
const WORLD_TINT = new Color().setRGB(.24, .34, .56);
const CHARACTER_TINT = new Color().setRGB(.48, .58, .78);

/** Event-driven grading and one optional pair of night maps. No extra frame loop. */
export function createStreetLighting({ scene, environment, renderer, textureLoader = new TextureLoader(), onStatus = () => {} }) {
  const daySky = scene.background.clone(), dayFog = scene.fog?.color.clone();
  const materials = new Map();
  scene.traverse(object => {
    if (!object.isMesh || object.userData.nightArtwork) return;
    const actor = Boolean(object.isSkinnedMesh || object.userData.characterId);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!material?.color || materials.has(material) || (material.transparent && material.opacity < .25)) continue;
      materials.set(material, { day: material.color.clone(), actor });
    }
  });
  let actualNight = false, requestedNight = false, disposed = false, serial = 0;
  let nightMaps = null, loading = null;
  const releaseMaps = maps => {
    for (const texture of maps ?? []) { texture.dispose(); texture.source?.data?.close?.(); }
    if (nightMaps === maps) nightMaps = null;
  };
  const report = (status, message) => {
    if (!disposed) onStatus({ night: actualNight, requestedNight, status, ...(message ? { message } : {}) });
  };
  const apply = night => {
    for (const [material, original] of materials) {
      material.color.copy(original.day);
      if (night) material.color.multiply(original.actor ? CHARACTER_TINT : WORLD_TINT);
    }
    if (night) {
      environment.setBackdrop(nightMaps[0], nightMaps[1]);
      scene.background.set('#071c37');
      scene.fog?.color.set('#132b47');
    } else {
      environment.restoreBackdrop();
      scene.background.copy(daySky);
      if (dayFog) scene.fog.color.copy(dayFog);
    }
    environment.syncBackdropSky?.();
    actualNight = night;
  };
  const loadNight = () => {
    if (nightMaps) return Promise.resolve(nightMaps);
    if (!loading) {
      loading = Promise.allSettled(NIGHT_BACKDROP_URLS.map(url => textureLoader.loadAsync(url))).then(results => {
        const maps = results.filter(result => result.status === 'fulfilled').map(result => result.value);
        const failed = results.find(result => result.status === 'rejected');
        if (failed || disposed) { releaseMaps(maps); throw failed?.reason ?? new Error('Street lighting disposed.'); }
        for (const texture of maps) {
          texture.colorSpace = SRGBColorSpace;
          texture.anisotropy = Math.min(4, renderer?.capabilities.getMaxAnisotropy() ?? 1);
        }
        nightMaps = maps;
        return maps;
      }).finally(() => { loading = null; });
    }
    return loading;
  };
  return {
    get night() { return actualNight; },
    get requestedNight() { return requestedNight; },
    async setNight(value) {
      if (disposed) return actualNight;
      requestedNight = Boolean(value);
      const request = ++serial;
      if (!requestedNight) {
        apply(false);
        releaseMaps(nightMaps);
        report('ready');
        return false;
      }
      if (actualNight) { report('ready'); return true; }
      report('loading');
      try {
        const maps = await loadNight();
        if (disposed || request !== serial) {
          if (!requestedNight) releaseMaps(maps);
          return actualNight;
        }
        apply(true); report('ready');
      } catch {
        if (!disposed && request === serial) report('error', 'The night sky could not load. Daylight is still available.');
      }
      return actualNight;
    },
    dispose() {
      if (disposed) return;
      disposed = true; serial++;
      apply(false); releaseMaps(nightMaps); materials.clear();
    },
  };
}
