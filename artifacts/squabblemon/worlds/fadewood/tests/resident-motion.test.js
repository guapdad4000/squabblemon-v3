import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Capsule } from 'three/addons/math/Capsule.js';
import { createResidentMotion, MAIL_DELIVERY_STOPS, MAIL_TOUR_DURATION, sampleNovaGait, sampleResidentRoute, advanceDogHeading, DOG_TURN_RATE, DOG_TURN_ACCELERATION } from '../src/resident-motion.js';
import { createAnimeEnvironment } from '../src/anime-environment.js';
import { removeLegacyCar } from '../src/prop-colliders.js';
import { createPhysics } from '../src/physics.js';
import { loadWorldGeometry } from './world-geometry.js';

const distance = (a, b) => Math.hypot(...a.map((value, index) => value - b[index]));

function fixture(ids = ['mailman', 'sherlock', 'nova', 'golden-doberman']) {
  const group = new THREE.Group(), changes = [];
  const placements = ids.map((id) => ({
    id, name: id, locationId: 'test', position: id === 'mailman' ? [10.1, .261, -8.9] : sampleResidentRoute(id, 0)?.position ?? [0, .261, 0],
    motionClips: { walk: 'Walking', idle: { clip: 'Idle', paused: false }, fly: 'Flying', land: 'Flying' },
  }));
  for (const placement of placements) {
    const character = new THREE.Group(); character.userData.characterId = placement.id;
    character.position.fromArray(placement.position);
    if (placement.id === 'nova' || placement.id === 'golden-doberman') {
      const model = new THREE.Group(); character.add(model);
      for (const name of ['frontleg', 'R_frontleg', 'backleg', 'R_backleg', 'frontleg0', 'R_frontleg0', 'backleg0', 'R_backleg0', 'tail', 'head', 'chest']) {
        const bone = new THREE.Bone(); bone.name = name; model.add(bone);
      }
    }
    group.add(character);
  }
  const cast = { group, setAnimation: (...args) => { changes.push(args); return true; } };
  return { cast, placements, changes };
}

test('every seeded mail tour makes three different deliveries and returns to the post office', () => {
  const tours = [];
  for (let tour = 0; tour < 12; tour += 1) {
    const destinations = new Set();
    let sawFlight = false, sawReturn = false;
    for (let local = 0; local < MAIL_TOUR_DURATION; local += .5) {
      const time = tour * MAIL_TOUR_DURATION + local;
      const pose = sampleResidentRoute('mailman', time);
      assert.deepEqual(sampleResidentRoute('mailman', time), pose, 'sampling is repeatable');
      if (pose.phase === 'delivery' && pose.stopId !== 'post-office') destinations.add(pose.stopId);
      sawFlight ||= pose.phase === 'flight';
      sawReturn ||= pose.returning;
    }
    assert.equal(destinations.size, 3);
    assert.ok([...destinations].every((id) => MAIL_DELIVERY_STOPS.some((stop) => stop.id === id)));
    assert.ok(sawFlight && sawReturn);
    const home = sampleResidentRoute('mailman', (tour + 1) * MAIL_TOUR_DURATION - .01);
    assert.equal(home.stopId, 'post-office');
    assert.equal(home.phase, 'delivery');
    assert.deepEqual(home.position, [10.1, .261, -8.9]);
    tours.push([...destinations].join(','));
  }
  assert.ok(new Set(tours).size > 4, 'different tours visit different deterministic delivery combinations');
});

test('routes remain continuous, bounded and finite across deliveries, pauses, and tour changes', () => {
  for (const id of ['mailman', 'sherlock', 'nova', 'golden-doberman']) {
    let previous = sampleResidentRoute(id, 0), moving = 0, standing = 0;
    for (let step = 1; step <= 6000; step += 1) {
      const current = sampleResidentRoute(id, step * .1);
      assert.ok(current.position.every(Number.isFinite) && Number.isFinite(current.yaw));
      assert.ok(current.position[0] > -11 && current.position[0] < 22);
      assert.ok(current.position[2] >= -40 && current.position[2] <= 19);
      assert.ok(current.position[1] >= .084 && current.position[1] <= 8.201);
      assert.ok(distance(current.position, previous.position) < .85, `${id} did not teleport at ${step * .1}s`);
      if (current.moving) moving += 1; else standing += 1;
      previous = current;
    }
    assert.ok(moving > 0 && standing > 0, `${id} alternates movement and stops`);
  }
  assert.equal(sampleResidentRoute('blue-yb', 20), null, 'stationary hosts retain their authored placement');
});

test('walking paths clear the actual cleaned scene walls, benches, trunks and planters', async () => {
  const world = loadWorldGeometry(), scene = new THREE.Scene(); scene.add(world);
  const environment = await createAnimeEnvironment({ world, parent: scene, textures: {
    leaves: new THREE.Texture({ width: 1, height: 1 }), panorama: new THREE.Texture({ width: 4, height: 1 }),
  } });
  removeLegacyCar(world);
  const octree = createPhysics(world).colliders.octree;
  const body = new Capsule(), triangles = [];
  for (const id of ['sherlock', 'nova', 'golden-doberman', 'mailman']) {
    for (let time = 0; time < 400; time += .4) {
      const sample = sampleResidentRoute(id, time);
      if (!sample.grounded) continue;
      const [x, y, z] = sample.position, radius = id === 'sherlock' || id === 'mailman' ? .28 : .4;
      const height = id === 'sherlock' || id === 'mailman' ? 1.8 : .9;
      body.radius = radius; body.start.set(x, y + radius, z); body.end.set(x, y + height - radius, z);
      triangles.length = 0; octree.getCapsuleTriangles(body, triangles);
      const wall = triangles.map((triangle) => octree.triangleCapsuleIntersect(body, triangle))
        .find((hit) => hit && hit.depth > .012 && Math.abs(hit.normal.y) < .75);
      assert.ok(!wall, `${id} overlaps a solid wall/prop at ${time.toFixed(1)}s (${sample.position})`);
    }
  }
  environment.dispose();
});

test('nearby residents ease to a stop, stay approachable, and resume without jumping', () => {
  const { cast, placements, changes } = fixture(['sherlock']);
  const motion = createResidentMotion({ cast, placements });
  for (let time = .05; time <= 4; time += .05) motion.update(time);
  const player = [...motion.sample()[0].position]; player[0] += 1;
  for (let time = 4.05; time <= 8; time += .05) motion.update(time, { playerPosition: player });
  const stopped = motion.sample()[0];
  assert.ok(stopped.rate < .001 && stopped.standing);
  assert.ok(distance(stopped.position, player) < 3.5);
  const start = [...stopped.position];
  motion.update(12, { playerPosition: player, activeCharacterId: 'sherlock' });
  assert.deepEqual(motion.sample()[0].position, start, 'the conversation freezes the real actor');
  let previous = start;
  for (let time = 12.05; time <= 16; time += .05) {
    motion.update(time, { playerPosition: [100, 0, 100] });
    const current = motion.sample()[0].position;
    assert.ok(distance(current, previous) < .12, 'resuming does not catch up to the old wall clock');
    previous = [...current];
  }
  assert.ok(distance(previous, start) > 1, 'the actor resumes his patrol');
  assert.ok(changes.length < 8, 'animation selection occurs on phase changes, not every frame');
  const record = motion.getInteractionRecords()[0];
  assert.deepEqual(record.feet, cast.group.children[0].position.toArray());
  assert.equal(record, motion.getInteractionRecords()[0], 'interaction records retain their identity');
  motion.dispose();
});

test('mailman stays in flight above the player and can be approached during grounded deliveries', () => {
  const { cast, placements } = fixture(['mailman']);
  const motion = createResidentMotion({ cast, placements });
  motion.update(26);
  const above = motion.sample()[0];
  assert.equal(above.phase, 'flight');
  assert.ok(above.position[1] >= 8);
  for (let time = 26.05; time <= 29; time += .05) {
    const [x, , z] = motion.sample()[0].position;
    motion.update(time, { playerPosition: [x, .261, z] });
  }
  assert.ok(!motion.sample()[0].paused, 'ground player does not strand the mailman in midair');
  motion.update(47);
  const delivered = motion.sample()[0];
  assert.equal(delivered.phase, 'delivery');
  motion.update(48, { playerPosition: delivered.position });
  assert.ok(motion.sample()[0].paused, 'landed mailman waits for the nearby player');
  motion.dispose();
});

test('Nova gait uses existing bone rotations, preserves transforms on disposal, and adds tiny body motion', () => {
  const { cast, placements } = fixture(['nova']);
  const character = cast.group.children[0], bones = [];
  character.traverse((object) => { if (object.isBone) bones.push({ object, quaternion: object.quaternion.clone(), position: object.position.clone(), scale: object.scale.clone() }); });
  const motion = createResidentMotion({ cast, placements });
  motion.update(.17);
  assert.equal(motion.stats.proceduralPawBones, 9);
  assert.ok(bones.some(({ object, quaternion }) => !object.quaternion.equals(quaternion)));
  for (const { object, position, scale } of bones) {
    assert.ok(object.position.equals(position) && object.scale.equals(scale), 'the gait does not stretch the supplied rig');
  }
  for (let sample = 0; sample < 40; sample += 1) {
    const gait = sampleNovaGait(sample / 40);
    assert.ok(gait.bodyBob >= 0 && gait.bodyBob <= .0121);
    assert.ok(Math.abs(gait.frontleg) <= .2201);
    assert.ok(Math.abs(gait.frontleg + gait.R_frontleg) < 1e-10, 'opposite paws alternate');
  }
  motion.dispose();
  for (const { object, quaternion } of bones) assert.ok(object.quaternion.equals(quaternion));
});


test('dog headings follow bounded shortest turns across the wrap boundary, reversals and a long hidden-page gap', () => {
  let yaw = Math.PI - .03, velocity = 0;
  const dt = 1 / 60;
  for (let step = 0; step < 240; step++) {
    const target = step < 90 ? -Math.PI + .08 : .4;
    const next = advanceDogHeading(yaw, velocity, target, dt);
    assert.ok(Math.abs(next.yaw - yaw) <= DOG_TURN_RATE * dt + 1e-12);
    assert.ok(Math.abs(next.velocity - velocity) <= DOG_TURN_ACCELERATION * dt + 1e-12,
      'changing direction cannot instantly reverse the body turn');
    if (step === 0) assert.ok(next.yaw > yaw, 'the dog crosses the nearby wrap, not a full revolution');
    yaw = next.yaw; velocity = next.velocity;
  }
  const late = advanceDogHeading(yaw, velocity, yaw + Math.PI, 100);
  assert.ok(Math.abs(late.yaw - yaw) <= DOG_TURN_RATE * .25 + 1e-12, 'a suspended page cannot cause a giant body snap');
});

test('both dogs step through turns and blend gait with actual movement while preserving their exact route corridor', () => {
  for (const id of ['nova', 'golden-doberman']) {
    const { cast, placements, changes } = fixture([id]);
    const motion = createResidentMotion({ cast, placements });
    let previous = motion.sample()[0], dwellTurn = false, quietIdle = false, maxSpeed = 0;
    for (let frame = 1; frame <= 120 * 30; frame++) {
      motion.update(frame / 30);
      const pose = motion.sample()[0], route = sampleResidentRoute(id, pose.routeTime);
      assert.ok(Math.abs(pose.yaw - previous.yaw) <= DOG_TURN_RATE / 30 + 1e-10, `${id}: bounded body yaw`);
      assert.ok(Math.abs(pose.turnVelocity - previous.turnVelocity) <= DOG_TURN_ACCELERATION / 30 + 1e-10, `${id}: bounded turn acceleration`);
      assert.ok(Math.abs(pose.position[0] - route.position[0]) < 1e-10 && Math.abs(pose.position[2] - route.position[2]) < 1e-10,
        'smoothing cannot move the dog outside the already checked collision corridor');
      assert.ok(pose.gaitWeight >= 0 && pose.gaitWeight <= 1);
      if (Math.abs(pose.turnVelocity) > .05) {
        assert.equal(pose.standing, false, 'turning feet remain active');
        assert.ok(pose.procedural.weight > 0, 'Nova has paw motion and Golden keeps its native walk');
        assert.equal(changes.at(-1)[1], 'Walking');
        assert.equal(changes.at(-1)[2].paused, false);
        if (!pose.moving) dwellTurn = true;
      }
      quietIdle ||= pose.standing;
      maxSpeed = Math.max(maxSpeed, pose.groundSpeed);
      previous = pose;
    }
    assert.ok(dwellTurn && quietIdle, `${id}: deliberate stepped turns alternate with a quiet stance`);
    assert.ok(maxSpeed > .5 && maxSpeed < 1.1);
    const beforeGap = motion.sample()[0];
    motion.update(300);
    assert.ok(distance(motion.sample()[0].position, beforeGap.position) < .3, 'large elapsed gaps do not catch the dog up across the park');
    motion.dispose();
  }
});

test('an approaching player does not make dogs spin to face them; quiet dogs keep subtle idle motion and resume smoothly', () => {
  for (const id of ['nova', 'golden-doberman']) {
    const { cast, placements } = fixture([id]);
    const motion = createResidentMotion({ cast, placements });
    for (let frame = 1; frame <= 60; frame++) motion.update(frame / 30);
    const before = motion.sample()[0];
    const player = [before.position[0] - Math.sin(before.yaw), before.position[1], before.position[2] - Math.cos(before.yaw)];
    for (let frame = 61; frame <= 180; frame++) motion.update(frame / 30, { playerPosition: player });
    const stopped = motion.sample()[0];
    assert.equal(stopped.standing, true);
    assert.ok(stopped.rate < .001);
    assert.ok(Math.abs(stopped.yaw - before.yaw) < .12, 'the body follows the route instead of a 180-degree player-facing target');
    const bones = [];
    cast.group.children[0].traverse(object => { if (['head', 'chest', 'tail'].includes(object.name)) bones.push({ object, quaternion: object.quaternion.clone() }); });
    for (let frame = 181; frame <= 210; frame++) motion.update(frame / 30, { playerPosition: player });
    assert.ok(bones.some(({ object, quaternion }) => !object.quaternion.equals(quaternion)), 'idle breathing/head/tail motion continues after the route clock stops');
    assert.ok(distance(motion.sample()[0].position, stopped.position) < .001);
    const previous = motion.sample()[0];
    motion.update(7 + 1 / 30, { playerPosition: [100, 0, 100] });
    assert.ok(distance(motion.sample()[0].position, previous.position) < .035);
    assert.ok(Math.abs(motion.sample()[0].yaw - previous.yaw) < DOG_TURN_RATE / 30 + 1e-10);
    motion.dispose();
  }
});

test('grounded courier waits play the configured idle and cleanly resume flight without freezing a walking pose', () => {
  const { cast, placements, changes } = fixture(['mailman']);
  const motion = createResidentMotion({ cast, placements });
  motion.update(1, { overrides: { mailman: { position: [0, .1, 0], yaw: 0, clipRole: 'fly', moving: true, grounded: false } } });
  assert.equal(changes.at(-1)[1], 'Flying');
  motion.update(2, { overrides: { mailman: { position: [0, .1, 0], yaw: 0, clipRole: 'idle', moving: false, grounded: true } } });
  assert.equal(changes.at(-1)[1], 'Idle');
  assert.equal(changes.at(-1)[2].paused, false);
  assert.equal(changes.at(-1)[2].groundSupport, true);
  const count = changes.length;
  motion.update(3, { overrides: { mailman: { position: [0, .1, 0], yaw: 0, clipRole: 'idle', moving: false, grounded: true } } });
  assert.equal(changes.length, count, 'waiting does not restart the idle every frame');
  motion.update(4, { overrides: { mailman: { position: [0, 1, 0], yaw: 0, clipRole: 'fly', moving: true, grounded: false } } });
  assert.equal(changes.at(-1)[1], 'Flying');
  assert.equal(changes.at(-1)[2].paused, false);
  assert.equal(changes.at(-1)[2].groundSupport, false);
  motion.dispose();
  motion.update(5);
  assert.equal(changes.at(-1)[1], 'Flying', 'disposal cannot restart route animation');
});


test('the supplied dog rigs keep native/procedural paws active through turns and show a bounded living idle when stopped', async () => {
  const [{ readFile }, { loadCpuGlb }, { loadCharacterCast }, { RESIDENT_PLACEMENTS }] = await Promise.all([
    import('node:fs/promises'), import('./helpers/verify-assets.mjs'), import('../src/character-cast.js'), import('../src/character-placements.js'),
  ]);
  const loader = { async loadAsync(path) { return loadCpuGlb(await readFile(new URL(`../public/assets/${path}`, import.meta.url))); } };
  for (const id of ['nova', 'golden-doberman']) {
    const placement = RESIDENT_PLACEMENTS.find(item => item.id === id);
    const cast = await loadCharacterCast(new THREE.Scene(), { loader, placements: [placement], baseUrl: 'residents/' });
    const motion = createResidentMotion({ cast, placements: [placement] });
    let steppedTurn = false, previousPlayhead = null;
    try {
      for (let frame = 1; frame <= 600; frame++) {
        const time = frame / 10;
        cast.update(time); motion.update(time);
        const pose = motion.sample()[0], rig = cast.sampleMotion()[0];
        if (!pose.moving && Math.abs(pose.turnVelocity) > .08) {
          assert.equal(rig.animated, true, `${id}: its source clip stays live while the body is turning`);
          assert.ok(pose.procedural.weight > .01);
          if (id === 'golden-doberman' && previousPlayhead !== null) assert.notEqual(rig.playhead, previousPlayhead, 'Golden steps instead of rotating a frozen walking pose');
          steppedTurn = true;
        }
        previousPlayhead = rig.playhead;
      }
      assert.ok(steppedTurn, `${id}: exercised an actual waypoint turn`);
      const pose = motion.sample()[0];
      const player = [pose.position[0] + 1, pose.position[1], pose.position[2]];
      for (let frame = 601; frame <= 720; frame++) { cast.update(frame / 10); motion.update(frame / 10, { playerPosition: player }); }
      const stopped = motion.sample()[0];
      assert.equal(stopped.standing, true);
      const idleBones = [], feet = [];
      cast.group.children[0].traverse(object => {
        if (['head', 'chest', 'tail'].includes(object.name)) idleBones.push({ object, quaternion: object.quaternion.clone() });
        if (/^(?:R_)?(?:frontleg|backleg)0?$/.test(object.name)) feet.push({ object, quaternion: object.quaternion.clone() });
      });
      for (let frame = 721; frame <= 740; frame++) { cast.update(frame / 10); motion.update(frame / 10, { playerPosition: player }); }
      assert.ok(idleBones.some(({ object, quaternion }) => object.quaternion.angleTo(quaternion) > .001), 'the real idle is visibly changing after locomotion stops');
      assert.ok(idleBones.every(({ object, quaternion }) => object.quaternion.angleTo(quaternion) < .12), 'breathing and tail/head motion stay restrained');
      assert.ok(feet.every(({ object, quaternion }) => object.quaternion.angleTo(quaternion) < .003), 'quiet idle does not keep marching in place');
      assert.ok(distance(motion.sample()[0].position, stopped.position) < .001);
    } finally { motion.dispose(); cast.dispose(); }
  }
});
