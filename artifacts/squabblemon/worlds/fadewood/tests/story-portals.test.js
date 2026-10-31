import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, DoubleSide, Group, PlaneGeometry, Raycaster, Texture, Vector3 } from 'three';
import { createStoryPortals, sampleAliceHat, storyAtlasGeometry, STORY_PORTAL_LAYOUT, STORY_PORTAL_PERIOD, STORY_ATLAS_REGIONS } from '../src/story-portals.js';
import { loadWorldGeometry } from './world-geometry.js';
import { createPhysics } from '../src/physics.js';
import { portalCameraShot } from '../src/world-portal-interactions.js';
import { connectedComponents } from '../src/anime-environment.js';
import { CHARACTER_PLACEMENTS } from '../src/character-placements.js';
import { PROP_PLACEMENTS } from '../src/prop-placements.js';

const close = (a, b, tolerance = 1e-7) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);
const still = new Vector3();
function settled(physics, coordinates) {
  physics.teleport(new Vector3(...coordinates));
  for (let i = 0; i < 120; i++) physics.move(still, 0, 1 / 120);
  return physics.position.clone();
}

test('only actual two-triangle legacy mural is hidden; wall geometry and every other source mesh remain identical and restoration is exact', async () => {
  const world = loadWorldGeometry(); const before = [];
  world.traverse((mesh) => { if (mesh.isMesh) before.push({ mesh, geometry: mesh.geometry, index: mesh.geometry.index, positions: mesh.geometry.attributes.position.array.slice(), visible: mesh.visible }); });
  const portals = await createStoryPortals({ world, texture: new Texture() });
  assert.equal(portals.changes.hiddenOriginals.length, 1); assert.equal(portals.changes.hiddenOriginals[0].name, 'End of block painted mural');
  assert.equal(portals.stats.sourceMuralTrianglesHidden, 2);
  assert.ok(world.getObjectByName('End of block mural wall').children[0].visible, 'physical source wall remains visible');
  for (const record of before) {
    assert.equal(record.mesh.geometry, record.geometry); assert.equal(record.mesh.geometry.index, record.index);
    assert.deepEqual(record.mesh.geometry.attributes.position.array, record.positions);
    assert.equal(record.mesh.visible, record.mesh.name === 'End of block painted mural' ? false : record.visible);
  }
  portals.dispose(); for (const record of before) assert.equal(record.mesh.visible, record.visible);
});

test('arena is on the actual back of Fade Market with grounded clear entry; house and signal triggers are distinct and walkable', async () => {
  const world = loadWorldGeometry(); const portals = await createStoryPortals({ world, texture: new Texture() });
  const physics = createPhysics(world); const records = portals.getPortals();
  for (const id of ['underground-arena', 'safehouse-door', 'anunaki-ufo']) {
    const p = records.find((record) => record.id === id), result = settled(physics, p.interactionPosition);
    close(result.x, p.interactionPosition[0], .025); close(result.z, p.interactionPosition[2], .025); close(result.y, p.interactionPosition[1], .002);
    assert.ok(p.camera.position.every(Number.isFinite) && p.camera.target.every(Number.isFinite));
  }
  const house = records.find((r) => r.id === 'safehouse-door'), signal = records.find((r) => r.id === 'anunaki-ufo');
  assert.ok(new Vector3(...house.position).distanceTo(new Vector3(...signal.interactionPosition)) > house.radius + signal.radius, 'door and UFO prompts do not overlap at their centers');
  settled(physics, [10.5, .28, 17.4]);
  for (let i = 0; i < 180; i++) physics.move(new Vector3(1, 0, 0), 6, 1 / 120);
  assert.ok(physics.position.x > 18.4, 'walk straight from street through the rear alley without hitting an invisible entrance wall');
  const marketBounds = [];
  world.updateWorldMatrix(true, true); world.traverse((mesh) => { if (mesh.isMesh && /02 FADE MARKET.*01 Ink navy/.test(mesh.name)) marketBounds.push(...connectedComponents(mesh.geometry, mesh.matrixWorld).map((part) => part.box)); });
  assert.ok(marketBounds.some((b) => Math.abs(b.min.z - STORY_PORTAL_LAYOUT.arena.position[2]) < .05), 'arena projects against actual market shell');
  portals.dispose();
});

test('roaming hat pauses and bounces smoothly while staying clear of actual supplied cast and parked model footprints', () => {
  let dwelling = 0, moving = 0, maxStep = 0;
  let previous = sampleAliceHat(0);
  for (let time = 0; time <= STORY_PORTAL_PERIOD; time += .02) {
    const motion = sampleAliceHat(time); assert.ok(motion.position.every(Number.isFinite));
    assert.ok(Math.abs(motion.ground[0]) < 9.5 && motion.ground[2] >= -40.5 && motion.ground[2] <= 29.001);
    assert.ok(motion.position[1] >= .579 && motion.position[1] <= 1.251);
    if (motion.dwell) dwelling++; else moving++;
    maxStep = Math.max(maxStep, new Vector3(...motion.position).distanceTo(new Vector3(...previous.position)));
    for (const npc of CHARACTER_PLACEMENTS) assert.ok(Math.hypot(motion.ground[0] - npc.position[0], motion.ground[2] - npc.position[2]) > 2.0, `clear ${npc.id}`);
    for (const prop of PROP_PLACEMENTS) {
      const dx = Math.abs(motion.ground[0] - prop.position[0]), dz = Math.abs(motion.ground[2] - prop.position[2]);
      // Uploaded street cars have their length along Z; this conservative 2.2m
      // body-width box includes their original visual bounds plus hat brim.
      const car = ['purple-scraper', 'beige-sedan'].includes(prop.id);
      assert.ok(dx > (car ? 1.1 : 1.3) + .89 || dz > prop.targetLength / 2 + .89, `hat clears ${prop.id}`);
    }
    previous = motion;
  }
  assert.ok(dwelling > 100 && moving > dwelling); assert.ok(maxStep < .15, `no abrupt route jump: ${maxStep}`);
  assert.deepEqual(sampleAliceHat(NaN), sampleAliceHat(0));
  const a = sampleAliceHat(0), b = sampleAliceHat(STORY_PORTAL_PERIOD);
  a.position.forEach((v, i) => close(v, b.position[i]));
  close(sampleAliceHat(-.001).position[2], sampleAliceHat(.001).position[2], 1e-5);
});

test('UFO and hat animation loops exactly, finite independent of update order; live Alice trigger follows hat', async () => {
  const portals = await createStoryPortals({ texture: new Texture() });
  const moving = portals.manifest.animatedNames.map((name) => portals.group.getObjectByName(name));
  for (const time of [0, .71, 13.3, 47.9]) {
    portals.update(time); const poses = moving.map((o) => { o.updateMatrix(); return o.matrix.toArray(); });
    portals.update(time + STORY_PORTAL_PERIOD); const later = moving.map((o) => { o.updateMatrix(); return o.matrix.toArray(); });
    for (let i = 0; i < poses.length; i++) poses[i].forEach((value, j) => close(value, later[i][j], 1e-7));
    const record = portals.getPortals().find((r) => r.id === 'alice-hat'); const hat = portals.group.getObjectByName('Alice roaming Mad Hatter top hat');
    assert.deepEqual(record.position, hat.position.toArray()); close(record.interactionPosition[0], hat.position.x); close(record.interactionPosition[2], hat.position.z);
    assert.doesNotThrow(() => JSON.stringify(portals.getPortals()));
  }
  portals.update(NaN); for (const object of moving) { object.updateMatrix(); assert.ok(object.matrix.toArray().every(Number.isFinite)); }
  portals.dispose();
});

test('nearby player holds the hat route while bounce and UFO continue; hysteresis releases it after walking away', async () => {
  const portals = await createStoryPortals({ texture: new Texture() });
  const start = sampleAliceHat(6).ground, player = new Vector3(...start);
  const current = () => portals.getPortals().find((record) => record.id === 'alice-hat');
  portals.update(6, { playerPosition: player }); const first = current();
  const ufo = portals.group.getObjectByName('Anunaki hovering saucer'), ufoY = ufo.position.y;
  portals.update(6.4, { playerPosition: player }); const bounced = current();
  assert.deepEqual(bounced.interactionPosition, first.interactionPosition, 'moving entrance stays within reach');
  assert.ok(Math.abs(bounced.position[1] - first.position[1]) > .1, 'hat keeps bouncing');
  assert.ok(Math.abs(ufo.position.y - ufoY) > .05, 'UFO remains animated');
  player.x += 3.1;
  portals.update(6.8, { playerPosition: player }); assert.deepEqual(current().interactionPosition, first.interactionPosition, '3.1m remains inside release hysteresis');
  player.x += .5;
  portals.update(7.2, { playerPosition: player });
  assert.ok(new Vector3(...current().interactionPosition).distanceTo(new Vector3(...first.interactionPosition)) > .01, 'walking beyond 3.4m resumes the route');
  portals.update(8, { playerPosition: new Vector3(...current().interactionPosition), enabled: false });
  assert.ok(new Vector3(...current().interactionPosition).distanceTo(new Vector3(...first.interactionPosition)) > .1, 'disabled proximity handling leaves the route moving');
  portals.update(6.4); assert.deepEqual(current().position, sampleAliceHat(6.4).position, 'context-free export ignores contextual route history');
  portals.update(6.4 + STORY_PORTAL_PERIOD);
  current().position.forEach((value, axis) => close(value, sampleAliceHat(6.4).position[axis]));
  portals.dispose();
});

test('painted UFO and hat surfaces are outside the ink shells; arena framing leaves both sign lines exposed', async () => {
  const portals = await createStoryPortals({ texture: new Texture() }); portals.group.updateWorldMatrix(true, true);
  const ufo = portals.group.getObjectByName('Anunaki rotating hieroglyph ring'), hat = portals.group.getObjectByName('Alice roaming Mad Hatter top hat');
  function localRay(object, origin, direction) {
    const a = object.localToWorld(new Vector3(...origin)), b = object.localToWorld(new Vector3(...origin).add(new Vector3(...direction)));
    return new Raycaster(a, b.sub(a).normalize()).intersectObject(object, true)[0];
  }
  for (let i = 0; i < 64; i++) {
    const angle = i / 64 * Math.PI * 2, x = Math.sin(angle), z = Math.cos(angle);
    const saucer = localRay(ufo, [x * 5, -.12, z * 5], [-x, 0, -z]);
    assert.ok(saucer.object.material.map, `UFO painted rim must be outermost from side angle ${i}`);
    const felt = localRay(hat, [x * 5, .84, z * 5], [-x, 0, -z]);
    const point = hat.worldToLocal(felt.point.clone());
    const priceCard = point.x > .17 && point.x < .57 && point.z > .42 && point.y > .55 && point.y < .98;
    assert.ok(felt.object.material.map || priceCard, `hat paint cannot be enclosed by the ink barrel at angle ${i}`);
  }
  for (const [origin, direction] of [[[2, 4, 0], [0, -1, 0]], [[0, -4, 0], [0, 1, 0]]]) {
    assert.ok(localRay(ufo, origin, direction).object.material.map, 'decorated saucer visible from above and below');
  }
  const dome = localRay(ufo, [0, 4, 0], [0, -1, 0]);
  const color = dome.object.geometry.attributes.color;
  assert.ok(color.getY(dome.face.a) > color.getX(dome.face.a) * 3, 'teal dome is exposed above its ink base ring');
  for (const y of [3.3, 3.55, 3.9, 4.2, 4.4]) for (const x of [17.5, 19.2, 20.8]) {
    const hit = new Raycaster(new Vector3(x, y, 17), new Vector3(0, 0, 1)).intersectObject(portals.group, true)[0];
    assert.ok(hit.object.material.map, `arena sign is unobstructed at ${x},${y}`);
  }
  portals.dispose();
});

test('authored portal cameras and representative moving-hat angles have clear sightlines through actual world geometry', async () => {
  const world = loadWorldGeometry(); world.traverse((mesh) => { if (mesh.material) mesh.material.side = DoubleSide; });
  const portals = await createStoryPortals({ world, texture: new Texture() }); world.updateWorldMatrix(true, true);
  for (const time of [0, 6, 12, 24, 36, 44]) {
    portals.update(time);
    for (const record of portals.getPortals()) {
      if (time && record.id !== 'alice-hat') continue;
      const shot = portalCameraShot(record, 1), direction = shot.target.clone().sub(shot.position);
      const ray = new Raycaster(shot.position, direction.clone().normalize(), .02, direction.length() - .08);
      const blockers = ray.intersectObject(world, true).filter((hit) => hit.object.visible);
      assert.deepEqual(blockers.map((hit) => hit.object.name), [], `${record.id} camera at time ${time} has no source-wall occlusion`);
    }
  }
  portals.dispose();
});

test('one atlas samples only each unequal art region plus the inset 10/6 tag; all portal decoration stays outside physics and disposes only its own resources once', async () => {
  for (const [column, row, name] of [[0, 0, 'mural'], [1, 0, 'arena'], [0, 1, 'ufo'], [1, 1, 'hat'], [1, 1, 'hatTag']]) {
    const g = storyAtlasGeometry(new PlaneGeometry(2, 2), column, row, name === 'hatTag' ? name : null), uv = g.attributes.uv;
    const [left, top, right, bottom] = STORY_ATLAS_REGIONS[name];
    const expectedU = [left + (right - left) * .01, right - (right - left) * .01];
    const expectedV = [1 - bottom + (bottom - top) * .01, 1 - top - (bottom - top) * .01];
    for (let i = 0; i < uv.count; i++) {
      assert.ok(uv.getX(i) > left && uv.getX(i) < right, `${name}: neighboring art excluded horizontally`);
      assert.ok(uv.getY(i) > 1 - bottom && uv.getY(i) < 1 - top, `${name}: neighboring art excluded vertically`);
      assert.ok(expectedU.some((value) => Math.abs(value - uv.getX(i)) < 1e-7));
      assert.ok(expectedV.some((value) => Math.abs(value - uv.getY(i)) < 1e-7));
    }
    if (name === 'mural') assert.ok(Math.max(...Array.from(uv.array).filter((_, i) => i % 2 === 0)) > .55, 'mural keeps artwork beyond a false equal-half crop');
    g.dispose();
  }
  const parent = new Group(), texture = new Texture(); let textureDisposals = 0; texture.addEventListener('dispose', () => textureDisposals++);
  const portals = await createStoryPortals({ parent, texture }); const geometries = new Set(), materials = new Set();
  portals.group.traverse((o) => { if (!o.isMesh) return; assert.equal(o.userData.noCollision, true); geometries.add(o.geometry); materials.add(o.material); });
  assert.equal(portals.stats.textures, 1); assert.equal(portals.stats.drawCalls, 8); assert.ok(portals.stats.triangles < 8000); assert.equal(portals.stats.portals, 4);
  const maps = new Set([...materials].flatMap((m) => m.map ? [m.map] : [])); assert.equal(maps.size, 1); assert.ok(maps.has(texture));
  let geometryDisposals = 0, materialDisposals = 0;
  for (const g of geometries) g.addEventListener('dispose', () => geometryDisposals++);
  for (const m of materials) m.addEventListener('dispose', () => materialDisposals++);
  portals.dispose(); portals.dispose(); assert.equal(parent.children.length, 0); assert.equal(geometryDisposals, geometries.size); assert.equal(materialDisposals, materials.size); assert.equal(textureDisposals, 0);
});
