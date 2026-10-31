import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LANDMARKS, EXTRA_ENTRANCES } from './landmarks.js';
import { MAILBOX_PLACEMENTS } from './anime-environment.js';

// One atlas, one merged draw. Values are UV cell column/row, top-to-bottom.
export const SURFACE_TILES = Object.freeze({
  diner: [0, 0], market: [0, 0], 'blue-housing': [1, 0], 'red-housing': [2, 0], house: [3, 0],
  window: [0, 1], 'warm-window': [1, 1], 'barred-window': [2, 1], shoji: [3, 1],
  timber: [0, 2], 'park-sign': [1, 2], mailbox: [2, 2], civic: [3, 2], postal: [3, 2],
  bench: [0, 3], brick: [1, 3], 'park-gate': [2, 3], garage: [3, 3],
});

export function surfacePlacements({ textureLedSafehouse = false } = {}) {
  const panels = [];
  const panel = (name, tile, position, size, yaw = 0, crop = [.018, .018, .982, .982]) => {
    panels.push({ name, tile, position, size, yaw, crop });
  };
  for (const { id, entry } of [...LANDMARKS, ...EXTRA_ENTRANCES]) {
    if (textureLedSafehouse && id === 'small-house') continue;
    const [x, y, z] = entry.position;
    const front = (lx, ly, depth) => [x + Math.cos(entry.yaw) * lx + Math.sin(entry.yaw) * depth, y + ly, z - Math.sin(entry.yaw) * lx + Math.cos(entry.yaw) * depth];
    if (!['park', 'dojo', 'garage'].includes(entry.style)) {
      panel(`${id} painted doorway`, entry.style, front(0, entry.height * .49, .405), [entry.width * .97, entry.height * .96], entry.yaw);
    } else if (entry.style === 'garage') {
      panel('garage overhead painted slats', 'garage', front(0, entry.height + .42, .34), [entry.width, .63], entry.yaw, [.03, .03, .97, .45]);
    }
    if (entry.style === 'park' || entry.style === 'dojo') {
      const park = entry.style === 'park';
      for (const sign of [-1, 1]) {
        panel(`${id} timber post ${sign}`, 'timber', front(sign * (entry.width / 2 + .14), entry.height / 2, park ? .218 : .285), [park ? .21 : .25, entry.height], entry.yaw, park ? [.36, .13, .42, .88] : [.1, .04, .28, .96]);
      }
      panel(`${id} timber lintel`, 'timber', front(0, entry.height + (park ? -.12 : .13), park ? .225 : .31), [entry.width + (park ? .62 : .75), park ? .20 : .28], entry.yaw, park ? [.36, .13, .42, .88] : [.05, .08, .95, .27]);
      if (park) {
        // The generated tile contains scenery outside its wooden board. Crop
        // tightly to that board and preserve its original 1.34:1 proportions.
        panel('Fade Park entrance plaque', 'park-sign', front(0, entry.height + .05, .27), [1.45, 1.45 * .625 / .84], entry.yaw, [.07, .245, .91, .87]);
      }
    }
  }

  let n = 0;
  // The shipped GLB retains only these Blue/Red housing shells and their
  // original glass panels. Rear apartments were replaced by County and Fade
  // Park during district authoring; placing their old rows creates sky windows.
  for (const [side, yc, floors] of [[-1, -6, 4], [1, -4, 5]]) {
    for (let k = 0; k < floors; k++) {
      const y = 1.8 + k * 3.05;
      for (const dy of [-8, -4, 0, 4, 8]) {
        const z = -(yc + dy);
        const entranceNear = LANDMARKS.some(({ entry }) => Math.abs(entry.position[0] - side * 11.43) < 1.3 && Math.abs(entry.position[2] - z) < 2.8);
        if (k === 0 && (entranceNear || dy >= 4)) continue;
        const tile = (++n % 7 === 0) ? 'warm-window' : k === 0 ? 'barred-window' : 'window';
        panel(`apartment street window ${side} ${yc} ${k} ${dy}`, tile, [side * 11.435, y, z], [1.73, 2.04], -side * Math.PI / 2);
      }
      for (const dx of [-3.5, 0, 3.5]) {
        panel(`apartment return window ${side} ${yc} ${k} ${dx}`, (++n % 6 === 0) ? 'warm-window' : 'window', [side * 17.2 + dx, y, -(yc - 11.285)], [1.57, 1.94]);
      }
    }
  }
  for (const mailbox of MAILBOX_PLACEMENTS) {
    const [x, y, z] = mailbox.position;
    panel(`${mailbox.id} postal artwork`, 'mailbox', [x + Math.sin(mailbox.yaw) * .316, y + .76, z + Math.cos(mailbox.yaw) * .316], [.66, 1.05], mailbox.yaw, [.11, .08, .91, .96]);
  }
  return panels;
}

export async function createAnimeSurfaces({ parent, renderer, texture = null, textureLedSafehouse = false } = {}) {
  const atlas = texture ?? await new THREE.TextureLoader().loadAsync(`${import.meta.env?.BASE_URL ?? '/'}assets/v3/anime-surfaces.webp`);
  atlas.colorSpace = THREE.SRGBColorSpace;
  atlas.anisotropy = Math.min(4, renderer?.capabilities.getMaxAnisotropy() ?? 1);
  const material = new THREE.MeshBasicMaterial({ map: atlas, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  material.name = 'V3 | shared painted entrance and window atlas';
  const panels = surfacePlacements({ textureLedSafehouse });
  const geometries = panels.map(({ tile, position, size, yaw, crop }) => {
    const geometry = new THREE.PlaneGeometry(...size);
    const [column, row] = SURFACE_TILES[tile];
    const [u0, v0, u1, v1] = crop;
    const uv = geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (column + u0 + uv.getX(i) * (u1 - u0)) / 4, (3 - row + v0 + uv.getY(i) * (v1 - v0)) / 4);
    geometry.rotateY(yaw).translate(...position);
    return geometry;
  });
  const geometry = mergeGeometries(geometries);
  geometries.forEach((part) => part.dispose());
  const group = new THREE.Group(); group.name = 'Fadewood | painted story surfaces';
  const mesh = new THREE.Mesh(geometry, material); mesh.name = 'V3 | all doors windows signs and mailbox faces';
  mesh.userData.noCollision = true;
  group.add(mesh); parent.add(group);
  const stats = { panels: panels.length, doorways: panels.filter((p) => p.name.includes('doorway')).length, apartmentWindows: panels.filter((p) => p.name.includes('window')).length, textures: 1, drawCalls: 1, triangles: panels.length * 2 };
  return { group, stats, panels, dispose() { group.removeFromParent(); geometry.dispose(); material.dispose(); if (!texture) atlas.dispose(); } };
}
