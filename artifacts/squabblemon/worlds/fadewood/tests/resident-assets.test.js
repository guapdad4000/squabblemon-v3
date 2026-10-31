import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Box3, Scene, Texture, Vector3, DoubleSide, Raycaster } from 'three';
import { loadCpuGlb } from './helpers/verify-assets.mjs';
import { loadCharacterCast } from '../src/character-cast.js';
import { CHARACTER_PLACEMENTS, RESIDENT_PLACEMENTS } from '../src/character-placements.js';
import { createResidentMotion } from '../src/resident-motion.js';
import { createStoryPortals } from '../src/story-portals.js';
import { loadAnunakiShip } from '../src/anunaki-ship.js';
import { loadWorldGeometry } from './world-geometry.js';
import { createAnimeEnvironment } from '../src/anime-environment.js';
import { characterCameraShot } from '../src/character-interactions.js';

const loader = { async loadAsync(path) { return loadCpuGlb(await readFile(new URL(`../public/assets/${path}`, import.meta.url))); } };

test('actual supplied residents keep correct size, play flight/walk clips, and live interactions follow roaming wrappers', async () => {
  const cast = await loadCharacterCast(new Scene(), { loader, placements: RESIDENT_PLACEMENTS, baseUrl: 'residents/' });
  assert.equal(cast.stats.characters, 6); assert.equal(cast.stats.triangles, 64389);
  for (const placement of RESIDENT_PLACEMENTS) {
    const wrapper = cast.group.children.find(o => o.userData.characterId === placement.id);
    const bounds = new Box3().setFromObject(wrapper, true);
    assert.ok(Math.abs(bounds.min.y - placement.position[1]) < .00001, `${placement.id} grounded`);
    assert.ok(Math.abs(bounds.getSize(new Vector3()).y - placement.height) < .00001, `${placement.id} uniformly sized`);
  }
  const motion = createResidentMotion({ cast, placements: RESIDENT_PLACEMENTS });
  const interactions = motion.getInteractionRecords();
  for (let frame = 1; frame <= 30 * 24; frame++) { cast.update(frame / 24); motion.update(frame / 24); }
  const mail = cast.sampleMotion().find(o => o.id === 'mailman');
  assert.equal(mail.clip, '_01a18e89_f67c_70b3_ab8b_c4aa7bf664be');
  assert.equal(motion.sample().find(o => o.id === 'mailman').phase, 'flight');
  const mailBounds = new Box3().setFromObject(cast.group.children.find(o => o.userData.characterId === 'mailman'), true);
  assert.ok(mailBounds.getSize(new Vector3()).length() < 3, 'horizontal flight keeps upright normalization instead of becoming giant');
  assert.ok(mailBounds.min.y > 6, 'flight is visibly above the ground');
  const sherlock = interactions.find(o => o.id === 'sherlock');
  assert.deepEqual(sherlock.feet, cast.group.children.find(o => o.userData.characterId === 'sherlock').position.toArray());
  assert.equal(cast.setAnimation('mailman', 'missing-clip'), false);
  cast.setAnimation('mailman', 'Walking', { paused: true, time: .18 });
  const frozen = cast.sampleMotion().find(o => o.id === 'mailman').boneChecksum;
  cast.update(31);
  assert.equal(cast.sampleMotion().find(o => o.id === 'mailman').boneChecksum, frozen);
  motion.dispose(); cast.dispose();
});

test('Leon’s back rests on the actual market crate instead of floating above support from his hanging hair', async () => {
  const placement = CHARACTER_PLACEMENTS.find(o => o.id === 'homeless-guy');
  const cast = await loadCharacterCast(new Scene(), { loader, placements: [placement], baseUrl: 'characters-mobile/' });
  const bounds = new Box3().setFromObject(cast.group.children[0], true), size = bounds.getSize(new Vector3());
  const support = cast.records[0].support;
  assert.ok(support.samples > 100);
  assert.ok(Math.abs(support.contact.point[1] - .929) < .00001);
  assert.ok(bounds.min.y < .925, 'hanging hair does not suspend his back above the box');
  assert.ok(size.x > 1.7 && size.x < 2, 'the original body size survives the slight tilt across the boxes');
  assert.ok(size.y < size.x / 2, 'the reclining body is horizontal and retains its original proportions');
  const world = loadWorldGeometry(); world.updateMatrixWorld(true);
  const meshes = []; world.traverse(o => { if (o.isMesh) { o.material.side = DoubleSide; meshes.push(o); } });
  const ray = new Raycaster(new Vector3(...support.contact.point).add(new Vector3(0, .04, 0)), new Vector3(0, -1, 0), 0, .1);
  const hit = ray.intersectObjects(meshes, false)[0];
  assert.ok(hit && /07.*Street.*props/i.test(hit.object.name));
  assert.ok(Math.abs(hit.point.y - .925) < .00001, 'the contact marker is4mmabove the actual crate top');
  const before = bounds.clone(); cast.update(100);
  assert.deepEqual(new Box3().setFromObject(cast.group.children[0], true), before);
  assert.equal(cast.records[0].animated, false);
  cast.dispose();
});

test('new Anunaki ship replaces both old hulls and inherits the original hover/rotation/beam', async () => {
  const parent = new Scene(), portals = await createStoryPortals({ parent, texture: new Texture() });
  const ship = await loadAnunakiShip({ portals, loader, baseUrl: 'residents/' });
  assert.equal(ship.stats.triangles, 3000); assert.equal(ship.stats.textures, 1);
  for (const name of ship.hiddenHulls) assert.equal(portals.group.getObjectByName(name).visible, false);
  assert.equal(ship.group.parent.name, 'Anunaki rotating hieroglyph ring');
  assert.ok(Math.abs(Math.max(...ship.records[0].dimensions.filter((_, i) => i !== 1)) - 7.6) < .00001);
  assert.ok(portals.group.getObjectByName('Anunaki soft roof scanning beam').visible);
  portals.update(3); assert.ok(ship.group.parent.rotation.y > 1);
  ship.dispose(); ship.dispose();
  for (const name of ship.hiddenHulls) assert.equal(portals.group.getObjectByName(name).visible, true);
  portals.dispose();
});

test('new park and alley close-ups keep animated faces clear of gates and building walls', async () => {
  const world = loadWorldGeometry(), parent = new Scene(); parent.add(world);
  const environment = await createAnimeEnvironment({ world, parent, textures: {
    leaves: new Texture({ width: 1, height: 1 }), panorama: new Texture({ width: 4, height: 1 }), neighborhood: new Texture({ width: 2172, height: 724 }),
  } });
  world.updateMatrixWorld(true);
  const meshes = []; world.traverse(o => { if (o.isMesh && o.visible) { o.material.side = DoubleSide; meshes.push(o); } });
  for (const id of ['blue-yb', 'dr-fade']) {
    const placement = RESIDENT_PLACEMENTS.find(p => p.id === id);
    const cast = await loadCharacterCast(parent, { loader, placements: [placement], baseUrl: 'residents/' });
    let face; cast.group.traverse(o => { if (o.isBone && o.name === 'headfront') face = o; });
    assert.ok(face, 'use the supplied rig’s actual animated face marker');
    for (let frame = 0; frame <= 70; frame++) {
      cast.update(frame / 10); cast.group.updateMatrixWorld(true);
      const target = face.getWorldPosition(new Vector3()), shot = characterCameraShot(placement, 3);
      const ray = new Raycaster(shot.position, target.clone().sub(shot.position).normalize(), .01, shot.position.distanceTo(target) - .03);
      const blocker = ray.intersectObjects(meshes, false)[0];
      assert.equal(blocker, undefined, `${id} face blocked at ${frame / 10}s: ${blocker?.object.name}`);
    }
    cast.dispose();
  }
  environment.dispose();
});
