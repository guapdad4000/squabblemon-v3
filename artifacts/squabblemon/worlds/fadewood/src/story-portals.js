import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import aliceRoute from './alice-hat-route.json' with { type: 'json' };

const BASE_URL = import.meta.env?.BASE_URL ?? '/';
export const STORY_PORTAL_ATLAS_URL = `${BASE_URL}assets/v3/fadewood-story-portals.webp`;
export const STORY_PORTAL_PERIOD = aliceRoute.period;
export const ALICE_HAT_ROUTE = Object.freeze(aliceRoute.waypoints.map(point => Object.freeze(point)));
const hatRoute = new THREE.CatmullRomCurve3(ALICE_HAT_ROUTE.map(([x,z]) => new THREE.Vector3(x,0,z)), true, 'centripetal');
hatRoute.arcLengthDivisions = 1200; hatRoute.updateArcLengths();
// Generated artwork uses unequal painted regions. Bounds are normalized from
// the preserved 1774×887 master; runtime resizing keeps these proportions.
const region = (x0, y0, x1, y1) => Object.freeze([x0 / 1774, y0 / 887, x1 / 1774, y1 / 887]);
export const STORY_ATLAS_REGIONS = Object.freeze({
  mural: region(0, 0, 1022, 513),
  arena: region(1025, 0, 1774, 513),
  ufo: region(0, 517, 989, 887),
  hat: region(994, 517, 1774, 887),
  hatTag: region(1535, 569, 1678, 754),
});
const ATLAS_REGION_NAMES = ['mural', 'arena', 'ufo', 'hat'];
export const STORY_PORTAL_LAYOUT = Object.freeze({
  mural: { position: [0, 1.475, -44.805], size: [12.85, 2.65] },
  arena: { position: [19.2, .031, 19.94], width: 7.8, height: 4.55, yaw: Math.PI },
  ufo: { position: [20.4, 10.2, -42.5], radius: 3.25, landing: [25.7, .031, -38.1] },
  safehouse: { position: [19.82, .331, -36.95], door: [19.82, 1.65, -38.04] },
});
const TONES = { ink: '#111326', cream: '#f8dfad', gold: '#efbd48', blue: '#4e9aba', darkBlue: '#213954', teal: '#65dac7', purple: '#765291', violet: '#ad6dbc', rust: '#a7524c', gray: '#707b86' };
const cleanName = (o) => `${o.userData?.name ?? ''} ${o.name}`.replaceAll('_', ' ');
const color = new THREE.Color();
function tint(geometry, tone) {
  color.set(tone); const values = new Float32Array(geometry.attributes.position.count * 3);
  for (let i = 0; i < values.length; i += 3) color.toArray(values, i);
  geometry.setAttribute('color', new THREE.BufferAttribute(values, 3)); return geometry;
}
function box(w, h, d, x, y, z, tone = TONES.ink, yaw = 0) {
  const g = new THREE.BoxGeometry(w, h, d); g.rotateY(yaw).translate(x, y, z); return tint(g, tone);
}
function cylinder(rt, rb, h, x, y, z, tone, sides = 24) {
  const g = new THREE.CylinderGeometry(rt, rb, h, sides); g.translate(x, y, z); return tint(g, tone);
}
function sphere(rx, ry, rz, x, y, z, tone, width = 20, height = 8) {
  const g = new THREE.SphereGeometry(1, width, height); g.scale(rx, ry, rz).translate(x, y, z); return tint(g, tone);
}
function flatPlane(w, h, position, tone, yaw = 0, floor = false) {
  const g = new THREE.PlaneGeometry(w, h); if (floor) g.rotateX(-Math.PI / 2); else g.rotateY(yaw);
  g.translate(...position); return tint(g, tone);
}
function merge(parts) {
  const g = mergeGeometries(parts, false); parts.forEach((p) => p.dispose());
  g.computeBoundingBox(); g.computeBoundingSphere(); return g;
}
function batch(group, name, parts, material) {
  const mesh = new THREE.Mesh(merge(parts), material); mesh.name = name; mesh.userData.noCollision = true; group.add(mesh); return mesh;
}
/** Logical column/row chooses the actual painted rectangle rather than an
 * assumed half-image grid. A 1% local inset excludes border/neighbor pixels. */
export function storyAtlasGeometry(geometry, column, row, regionName = null) {
  const uv = geometry.attributes.uv; const inset = .01;
  const [left, top, right, bottom] = STORY_ATLAS_REGIONS[regionName ?? ATLAS_REGION_NAMES[row * 2 + column]];
  for (let i = 0; i < uv.count; i++) uv.setXY(i,
    left + (inset + uv.getX(i) * (1 - 2 * inset)) * (right - left),
    1 - (top + (1 - inset - uv.getY(i) * (1 - 2 * inset)) * (bottom - top)));
  return geometry;
}
function panel(w, h, column, row, position, yaw = 0, floor = false, regionName = null) {
  const g = storyAtlasGeometry(new THREE.PlaneGeometry(w, h), column, row, regionName);
  if (floor) g.rotateX(-Math.PI / 2); else g.rotateY(yaw); g.translate(...position); return g;
}
function paintedCylinder(rt, rb, h, y, column, row, sides = 24) {
  const g = new THREE.CylinderGeometry(rt, rb, h, sides, 1, true); storyAtlasGeometry(g, column, row); g.translate(0, y, 0); return g;
}
function paintedDisc(radius, y, column, row, innerRadius = 0) {
  const g = innerRadius ? new THREE.RingGeometry(innerRadius, radius, 32, 1) : new THREE.CircleGeometry(radius, 32);
  storyAtlasGeometry(g, column, row); g.rotateX(-Math.PI / 2).translate(0, y, 0); return g;
}
function outlinedDisc(radius, y, tone, sides = 24) {
  return cylinder(radius, radius, .035, 0, y, 0, tone, sides);
}

/** The mural is its own audited source mesh. Hide only that two-triangle image;
 * the wall, silhouette geometry, source texture and GLB remain untouched. */
export function replaceOriginalStoryMural(world) {
  const changed = [];
  if (world) {
    world.updateWorldMatrix(true, true);
    world.traverse((mesh) => {
      if (!mesh.isMesh || mesh.isSkinnedMesh || !/End of block painted mural/.test(cleanName(mesh))) return;
      const bounds = new THREE.Box3().setFromObject(mesh), size = bounds.getSize(new THREE.Vector3()), center = bounds.getCenter(new THREE.Vector3());
      if (Math.abs(center.x) > .01 || Math.abs(center.z + 44.81) > .01 || Math.abs(size.x - 12.85) > .01 || Math.abs(size.y - 2.65) > .01 || size.z > .001) return;
      changed.push({ mesh, wasVisible: mesh.visible, name: mesh.name, center: center.toArray(), size: size.toArray(), triangles: (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3 });
      mesh.visible = false;
    });
  }
  return {
    records: changed.map(({ mesh, wasVisible, ...record }) => ({ ...record, previousVisible: wasVisible, action: 'hide exact old two-triangle mural; retain ink wall and source data' })),
    restore() { changed.forEach(({ mesh, wasVisible }) => { mesh.visible = wasVisible; }); },
  };
}

const GLYPHS = {
  A: ['01110','11011','11011','11111','11011','11011','11011'],
  E: ['11111','11000','11000','11110','11000','11000','11111'],
  F: ['11111','11000','11000','11110','11000','11000','11000'],
  H: ['11011','11011','11011','11111','11011','11011','11011'],
  O: ['01110','11011','11011','11011','11011','11011','01110'],
  S: ['01111','11000','11000','01110','00011','00011','11110'],
  U: ['11011','11011','11011','11011','11011','11011','01110'],
};
function lettering(text, width, height, x, y, z, tone) {
  const units = text.length * 6 - 1, scale = width / units, parts = [];
  [...text].forEach((letter, index) => (GLYPHS[letter] ?? []).forEach((row, r) => [...row].forEach((v, c) => {
    if (v === '1') parts.push(flatPlane(scale * 1.08, height / 7 * 1.08, [x - width / 2 + (index * 6 + c + .5) * scale + (3 - r) * scale * .12, y + height / 2 - (r + .5) * height / 7, z], tone));
  })));
  return parts;
}
function fistBadge(x, y, z, yaw = 0, size = .34) {
  const parts = [];
  const transform = (lx, ly, d) => [x + Math.cos(yaw) * lx + Math.sin(yaw) * d, y + ly, z - Math.sin(yaw) * lx + Math.cos(yaw) * d];
  const b = (w, h, lx, ly, tone, depth = .03) => { const p = transform(lx * size, ly * size, depth); parts.push(box(w * size, h * size, .025, ...p, tone, yaw)); };
  b(1.2, 1.25, 0, 0, TONES.ink, .01); b(.99, 1.04, 0, 0, TONES.gold, .03);
  b(.55, .42, .02, -.1, TONES.ink, .052); b(.26, .22, -.26, -.01, TONES.ink, .052);
  for (let i = 0; i < 4; i++) b(.15, .29 + (i === 1 ? .07 : 0), -.22 + i * .155, .2, TONES.ink, .052);
  b(.33, .18, .03, -.37, TONES.ink, .052); return parts;
}

/** Four catchable stops, with a wider collision-audited neighborhood tour.
 * The pure sampled route and all ambient components repeat after 96s. */
export function sampleAliceHat(elapsed, routeElapsed = elapsed) {
  const time = Number.isFinite(elapsed) ? elapsed : 0;
  const routeTime = Number.isFinite(routeElapsed) ? routeElapsed : time;
  const lap = ((routeTime % STORY_PORTAL_PERIOD) + STORY_PORTAL_PERIOD) % STORY_PORTAL_PERIOD;
  const quarter = lap / (STORY_PORTAL_PERIOD / 4), segment = Math.floor(quarter), local = quarter - segment;
  const move = THREE.MathUtils.clamp((local - .15) / .85, 0, 1);
  const progress = move * move * (3 - 2 * move);
  const routeProgress = (segment + progress) / 4;
  const point = hatRoute.getPointAt(routeProgress), tangent = hatRoute.getTangentAt(routeProgress);
  const bounce = .5 - .5 * Math.cos(time * Math.PI * 2 / 1.6);
  const curb = THREE.MathUtils.smoothstep(Math.abs(point.x), 4.9, 5.4);
  const ground = [point.x, .131 + .13 * curb, point.z];
  return { position: [ground[0], ground[1] + .449 + bounce * .54, ground[2]], ground, yaw: Math.atan2(tangent.x,tangent.z) + .2 * Math.sin(time * Math.PI * 2 / 4.8), tilt: Math.sin(time * Math.PI * 2 / 1.6) * .16, shadowScale: .92 - bounce * .18, dwell: local < .15 };
}
function staticPortalRecords() {
  return [
    { id: 'anunaki-ufo', label: 'Anunaki signal', position: [...STORY_PORTAL_LAYOUT.ufo.position], interactionPosition: [...STORY_PORTAL_LAYOUT.ufo.landing], aimPoint: [20.4, 9.8, -42.5], radius: 2.5, yaw: -.5, camera: { position: [26.8, 2.1, -33.8], target: [20.4, 7.9, -42.5], fov: 56, roll: -.018 } },
    { id: 'underground-arena', label: 'Not So Secret Arena', position: [19.2, .031, 17.4], interactionPosition: [19.2, .031, 17.4], aimPoint: [19.2, 1.85, 19.94], radius: 2.8, yaw: Math.PI, camera: { position: [14.5, 1.3, 17.0], target: [19.2, 2.0, 19.94], fov: 60, roll: .025 } },
    { id: 'safehouse-door', label: 'Safehouse', position: [...STORY_PORTAL_LAYOUT.safehouse.position], interactionPosition: [...STORY_PORTAL_LAYOUT.safehouse.position], aimPoint: [...STORY_PORTAL_LAYOUT.safehouse.door], radius: 2.0, yaw: 0, camera: { position: [17.8, 1.7, -34.5], target: [19.82, 1.65, -38.04], fov: 54, roll: -.012 } },
  ];
}

export async function createStoryPortals({ world = null, parent = null, renderer = null, texture = null, textureLedSafehouse = false } = {}) {
  const ownsTexture = !texture;
  const atlas = texture ?? await new THREE.TextureLoader().loadAsync(STORY_PORTAL_ATLAS_URL);
  atlas.colorSpace = THREE.SRGBColorSpace;
  atlas.anisotropy = Math.min(4, renderer?.capabilities?.getMaxAnisotropy?.() ?? 1);
  const group = new THREE.Group(); group.name = 'Fadewood story portals'; group.userData.noCollision = true;
  const flat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, toneMapped: false }); flat.name = 'Story portals ink and cel colors';
  const paint = new THREE.MeshBasicMaterial({ map: atlas, side: THREE.DoubleSide, toneMapped: false }); paint.name = 'Story portals one painted atlas';
  const beamMaterial = new THREE.MeshBasicMaterial({ color: '#92f4e8', transparent: true, opacity: .105, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }); beamMaterial.name = 'Anunaki translucent signal beam';
  const shadowMaterial = new THREE.MeshBasicMaterial({ color: TONES.ink, transparent: true, opacity: .22, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }); shadowMaterial.name = 'Alice hat soft toon shadow';
  const originals = replaceOriginalStoryMural(world);
  const flatParts = [], paintParts = [];
  // Retain the source wall and its collision; only the obsolete image is hidden.
  paintParts.push(panel(...STORY_PORTAL_LAYOUT.mural.size, 0, 0, STORY_PORTAL_LAYOUT.mural.position));
  flatParts.push(box(13.05, .12, .08, 0, 2.85, -44.79), box(13.05, .11, .08, 0, .10, -44.79));

  const arena = STORY_PORTAL_LAYOUT.arena;
  const front = (x, y, depth) => [arena.position[0] - x, arena.position[1] + y, arena.position[2] - depth];
  const arenaBox = (w, h, d, x, y, depth, tone) => box(w, h, d, ...front(x, y, depth), tone, Math.PI);
  flatParts.push(arenaBox(8.12, 4.65, .10, 0, 2.29, .015, TONES.ink));
  paintParts.push(panel(arena.width, arena.height, 1, 0, front(0, 2.28, .075), Math.PI));
  // Actual structural jambs, lintel and low treads give the painted stairway
  // physical depth while the entry stays a grounded, non-collidable portal.
  flatParts.push(arenaBox(.20, 2.75, .34, -2.05, 1.375, .17, TONES.ink), arenaBox(.20, 2.75, .34, 2.05, 1.375, .17, TONES.ink), arenaBox(4.3, .14, .38, 0, 2.85, .20, TONES.ink));
  for (let i = 0; i < 3; i++) flatParts.push(arenaBox(4.32, .055, .29, 0, .055 + i * .06, .25 + (2 - i) * .25, i % 2 ? TONES.gray : TONES.ink));
  for (const sign of [-1, 1]) {
    flatParts.push(arenaBox(.16, 1.6, .15, sign * 3.43, 1.8, .18, TONES.ink), arenaBox(.07, 1.36, .18, sign * 3.43, 1.8, .19, TONES.teal));
    flatParts.push(arenaBox(.095, .9, .095, sign * 2.48, .47, 1.0, TONES.ink), arenaBox(.095, .9, .095, sign * 2.48, .47, .35, TONES.ink));
    flatParts.push(arenaBox(.10, .09, .91, sign * 2.48, .9, .72, TONES.gold));
  }
  // The atlas already paints two fist emblems beside the sign. Keep its
  // center free so added framing never covers NOT SO SECRET / KUMITE.
  // The integrated facade paints this label; standalone retains authored geometry.
  if (!textureLedSafehouse) {
  flatParts.push(box(2.42, .49, .07, 19.35, 3.24, -37.98), box(2.3, .38, .075, 19.35, 3.24, -37.935, TONES.gold));
  flatParts.push(...lettering('SAFE HOUSE', 2.10, .255, 19.35, 3.24, -37.887, TONES.ink));
  flatParts.push(...fistBadge(19.35, 3.75, -37.98, 0, .29));
  }
  // Concentric painted landing glyph on the open east path, away from the door.
  const landing = STORY_PORTAL_LAYOUT.ufo.landing;
  for (const [r, tone] of [[.94, TONES.ink], [.86, TONES.gold], [.69, TONES.ink], [.61, TONES.blue]]) {
    const g = new THREE.CircleGeometry(r, 24); g.rotateX(-Math.PI / 2).translate(landing[0], landing[1] + .005 + (1 - r) * .009, landing[2]); flatParts.push(tint(g, tone));
  }
  flatParts.push(...fistBadge(landing[0], 1.45, landing[2] - .16, 0, .4));
  flatParts.push(box(.08, 1.35, .08, landing[0], .7, landing[2] - .17, TONES.ink));
  batch(group, 'Story portal frames signs landing glyph and arena depth', flatParts, flat);
  batch(group, 'Story portal mural and arena painted faces', paintParts, paint);

  const ufo = new THREE.Group(); ufo.name = 'Anunaki hovering saucer'; ufo.position.fromArray(STORY_PORTAL_LAYOUT.ufo.position); group.add(ufo);
  const ufoSpin = new THREE.Group(); ufoSpin.name = 'Anunaki rotating hieroglyph ring'; ufo.add(ufoSpin);
  const saucer = [cylinder(2.75, 3.27, .25, 0, -.12, 0, TONES.ink, 32), cylinder(3.25, 2.42, .34, 0, -.39, 0, TONES.ink, 32), cylinder(2.93, 2.25, .25, 0, -.4, 0, TONES.darkBlue, 32), cylinder(2.62, 3.04, .21, 0, .08, 0, TONES.gold, 32), cylinder(2.48, 2.72, .26, 0, .26, 0, TONES.ink, 32), cylinder(2.32, 2.60, .22, 0, .30, 0, TONES.blue, 32), cylinder(1.30, 1.30, .12, 0, .49, 0, TONES.ink), sphere(1.19, .78, 1.19, 0, .65, 0, TONES.teal), cylinder(.84, .84, .17, 0, -.60, 0, TONES.ink), cylinder(.68, .68, .17, 0, -.64, 0, TONES.teal), cylinder(1.16, 1.16, .06, 0, -.715, 0, TONES.ink)];
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2;
    saucer.push(box(.43, .13, .22, Math.sin(a) * 2.72, -.19, Math.cos(a) * 2.72, TONES.ink, a), box(.30, .09, .23, Math.sin(a) * 2.72, -.17, Math.cos(a) * 2.72, i % 3 ? TONES.gold : TONES.teal, a));
  }
  batch(ufoSpin, 'Anunaki cel saucer with round ink silhouette', saucer, flat);
  // Match the actual ink hull's radius at both painted Y endpoints, then
  // add 8mm. An inset painted solid would disappear inside the black hull.
  const hullRadius = (y) => 3.27 + ((y + .245) / .25) * (2.75 - 3.27);
  batch(ufoSpin, 'Anunaki blue gold hieroglyph painted rim', [
    paintedCylinder(hullRadius(-.04) + .008, hullRadius(-.21) + .008, .17, -.125, 0, 1, 32),
    paintedDisc(2.44, .445, 0, 1, 1.32),
    paintedDisc(1.10, -.753, 0, 1),
  ], paint);
  // Beam ends at the roof rather than drawing through the house facade.
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(.58, 1.22, 3.55, 24, 1, true), beamMaterial); beam.name = 'Anunaki soft roof scanning beam'; beam.position.y = -2.52; beam.userData.noCollision = true; ufo.add(beam);

  const hat = new THREE.Group(); hat.name = 'Alice roaming Mad Hatter top hat'; group.add(hat);
  const hatParts = [cylinder(.83, .89, .12, 0, .08, 0, TONES.ink, 24), cylinder(.78, .84, .07, 0, .13, 0, TONES.purple, 24), cylinder(.55, .48, 1.10, 0, .72, 0, TONES.ink), cylinder(.50, .44, 1.03, 0, .72, 0, TONES.purple), cylinder(.53, .514, .27, 0, .345, 0, TONES.ink), cylinder(.527, .516, .16, 0, .35, 0, TONES.teal), outlinedDisc(.57, 1.29, TONES.ink), outlinedDisc(.52, 1.315, TONES.violet)];
  // A slanted oversized 10/6 card silhouette and gold buckle, both round-brim safe.
  hatParts.push(box(.35, .40, .045, .37, .76, .49, TONES.ink, -.25), box(.28, .33, .051, .37, .76, .51, TONES.cream, -.25), box(.20, .18, .06, 0, .35, .56, TONES.ink), box(.13, .10, .07, 0, .35, .59, TONES.gold));
  batch(hat, 'Mad Hatter bold outlined round brim and card', hatParts, flat);
  const feltRadius = (y) => .48 + ((y - .17) / 1.10) * (.55 - .48);
  batch(hat, 'Mad Hatter painted purple felt and tag', [
    paintedCylinder(feltRadius(1.22) + .008, feltRadius(.46) + .008, .76, .84, 1, 1),
    panel(.255, .30, 1, 1, [.37, .76, .542], -.25, false, 'hatTag'),
  ], paint);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(.78, 20), shadowMaterial); shadow.name = 'Alice hat ground shadow'; shadow.rotation.x = -Math.PI / 2; shadow.userData.noCollision = true; group.add(shadow);
  parent?.add(group);
  const staticRecords = staticPortalRecords();
  let motion = sampleAliceHat(0);
  let routeClock = null;
  function update(elapsed, context = null) {
    const time = Number.isFinite(elapsed) ? elapsed : 0;
    let routeTime = time;
    if (context) {
      // Only the route clock pauses near the player. Bounce/tilt and the UFO
      // keep their ambient time, and a wider release radius avoids flicker.
      if (!routeClock || time < routeClock.lastElapsed) routeClock = { elapsed: time, lastElapsed: time, lingering: false };
      const player = context.playerPosition;
      const px = player?.x ?? player?.[0], pz = player?.z ?? player?.[2];
      const canLinger = context.enabled !== false && Number.isFinite(px) && Number.isFinite(pz);
      const ground = sampleAliceHat(time, routeClock.elapsed).ground;
      const distance = canLinger ? Math.hypot(px - ground[0], pz - ground[2]) : Infinity;
      routeClock.lingering = canLinger && distance < (routeClock.lingering ? 3.4 : 2.75);
      if (!routeClock.lingering) routeClock.elapsed += time - routeClock.lastElapsed;
      routeClock.lastElapsed = time;
      routeTime = routeClock.elapsed;
    } else routeClock = null; // Authoring/export calls remain pure elapsed-time samples.
    ufo.position.y = STORY_PORTAL_LAYOUT.ufo.position[1] + Math.sin(time * Math.PI * 2 / 4) * .24;
    ufo.rotation.z = Math.sin(time * Math.PI * 2 / 12) * .025;
    ufoSpin.rotation.y = time * Math.PI * 2 / 12;
    motion = sampleAliceHat(time, routeTime); hat.position.fromArray(motion.position); hat.rotation.set(motion.tilt, motion.yaw, motion.tilt * -.55);
    shadow.position.set(motion.ground[0], motion.ground[1] + .008, motion.ground[2]); shadow.scale.setScalar(motion.shadowScale);
  }
  function getPortals() {
    return staticRecords.map((record) => ({ ...record, position: record.id === 'anunaki-ufo' ? ufo.position.toArray() : [...record.position] })).concat({ id: 'alice-hat', label: 'Alice missions', position: [...motion.position], interactionPosition: [...motion.ground], aimPoint: [motion.position[0], motion.position[1] + .70, motion.position[2]], radius: 3, yaw: motion.yaw, moving: true, dwell: motion.dwell });
  }
  update(0);
  const uniqueGeometry = new Set(), uniqueMaterials = new Set(), uniqueTextures = new Set(); let meshes = 0, triangles = 0;
  group.traverse((object) => { if (!object.isMesh) return; meshes++; triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3; uniqueGeometry.add(object.geometry); uniqueMaterials.add(object.material); if (object.material.map) uniqueTextures.add(object.material.map); });
  const stats = { portals: 4, meshes, drawCalls: meshes, triangles, materials: uniqueMaterials.size, textures: uniqueTextures.size, sourceMuralTrianglesHidden: originals.records.reduce((s, r) => s + r.triangles, 0), animationPeriodSeconds: STORY_PORTAL_PERIOD };
  const manifest = { version: 1, atlasUrl: STORY_PORTAL_ATLAS_URL, atlasLayout: 'four unequal painted regions', atlasRegions: STORY_ATLAS_REGIONS, layout: STORY_PORTAL_LAYOUT, stats, portals: getPortals(), animatedNames: [ufo.name, ufoSpin.name, hat.name, shadow.name], cameras: [{ name: 'Arena alley reveal', position: [11.2, 2.3, 15.8], target: [19.2, 1.9, 19.94], fov: 62 }, { name: 'Anunaki house signal', position: [29, 5.5, -29], target: [20.4, 8, -42.5], fov: 58 }, { name: 'Story mural', position: [0, 2.1, -36], target: [0, 1.48, -44.8], fov: 60 }], sourceChanges: originals.records };
  let disposed = false;
  return { group, stats, manifest, changes: { hiddenOriginals: originals.records }, update, getPortals,
    dispose() { if (disposed) return; disposed = true; group.removeFromParent(); originals.restore(); uniqueGeometry.forEach((g) => g.dispose()); uniqueMaterials.forEach((m) => m.dispose()); if (ownsTexture) atlas.dispose(); },
  };
}
