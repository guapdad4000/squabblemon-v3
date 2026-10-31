import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, BoxGeometry, Group, Mesh, MeshBasicMaterial, Vector3 } from 'three';
import { createPhysics } from '../src/physics.js';
import { DESTINATIONS } from '../src/fast-travel.js';
import { loadWorldGeometry } from './world-geometry.js';

const still = new Vector3();
const material = new MeshBasicMaterial();
function box(world, size, centre) {
  const mesh = new Mesh(new BoxGeometry(...size), material);
  mesh.position.set(...centre);
  world.add(mesh);
  return mesh;
}
function world() {
  const group = new Group();
  box(group, [50, 0.2, 50], [0, -0.1, 0]);
  return group;
}
function tick(physics, direction = still, seconds = 1, speed = 5, frame = 1 / 60) {
  for (let elapsed = 0; elapsed < seconds - 1e-8; elapsed += frame) {
    physics.move(direction, speed, Math.min(frame, seconds - elapsed));
  }
}

test('gravity settles the feet on actual geometry', () => {
  const p = createPhysics(world(), { spawn: new Vector3(0, 3, 0) });
  tick(p, still, 2);
  assert.ok(p.grounded);
  assert.ok(Math.abs(p.position.y - 0.001) < 0.006, `feet at ${p.position.y}`);
  assert.ok(Math.abs(p.velocity.y) < 0.001);
});

test('sprinting cannot cross a thin wall and diagonal motion slides along it', () => {
  const scene = world();
  box(scene, [0.03, 4, 30], [2, 2, 0]);
  const p = createPhysics(scene, { spawn: new Vector3(0, 0.01, 0) });
  tick(p, still, 0.1);
  tick(p, new Vector3(1, 0, 0), 2, 5, 0.1);
  assert.ok(p.position.x < 1.68, `crossed wall at x=${p.position.x}`);
  assert.ok(p.position.x > 1.5);
  tick(p, new Vector3(1, 0, 1).normalize(), 1.5);
  assert.ok(p.position.x < 1.68);
  assert.ok(p.position.z > 4, `failed to slide; z=${p.position.z}`);
});

test('a 0.28 m curb is climbable and its top remains grounded', () => {
  const scene = world();
  box(scene, [8, 0.28, 10], [5, 0.14, 0]);
  const p = createPhysics(scene, { spawn: new Vector3(0, 0.01, 0) });
  tick(p, still, 0.1);
  tick(p, new Vector3(1, 0, 0), 1.2, 3);
  assert.ok(p.position.x > 2.5, `stuck at curb; x=${p.position.x}, y=${p.position.y}`);
  assert.ok(Math.abs(p.position.y - 0.281) < 0.02);
  assert.ok(p.grounded);
  tick(p, still, 0.5);
  assert.ok(Math.abs(p.position.y - 0.281) < 0.02);
});

test('a tall wall and a low ceiling cannot be bypassed by curb stepping', () => {
  const scene = world();
  box(scene, [8, 0.28, 10], [5, 0.14, 0]);
  box(scene, [8, 0.2, 10], [5, 1.9, 0]);
  const p = createPhysics(scene, { spawn: new Vector3(0, 0.01, 0) });
  tick(p, still, 0.1);
  tick(p, new Vector3(1, 0, 0), 1.2, 5);
  assert.ok(p.position.x < 0.72, `stepped through low ceiling at x=${p.position.x}`);
  assert.ok(p.position.y < 0.3);
});

test('open garage geometry remains traversable while the back wall stops movement', () => {
  const scene = world();
  box(scene, [0.2, 3, 6], [-2, 1.5, -3]);
  box(scene, [0.2, 3, 6], [2, 1.5, -3]);
  box(scene, [4, 3, 0.2], [0, 1.5, -6]);
  box(scene, [4, 0.2, 6], [0, 3, -3]);
  const p = createPhysics(scene, { spawn: new Vector3(0, 0.01, 2) });
  tick(p, still, 0.1);
  tick(p, new Vector3(0, 0, -1), 2, 5);
  assert.ok(p.position.z < -4.9, `failed to enter garage; z=${p.position.z}`);
  assert.ok(p.position.z > -5.59, `crossed rear wall; z=${p.position.z}`);
  assert.ok(p.grounded);
});

test('configured bounds recover to spawn and teleports clear old momentum', () => {
  const spawn = new Vector3(0, 0.01, 0);
  const p = createPhysics(world(), {
    spawn,
    bounds: new Box3(new Vector3(-2, -5, -2), new Vector3(2, 5, 2)),
  });
  tick(p, new Vector3(1, 0, 0), 1, 5);
  assert.ok(p.resetCount > 0);
  p.teleport(new Vector3(1, 1, 1));
  assert.equal(p.velocity.length(), 0);
  assert.equal(p.position.x, 1);
  assert.equal(p.grounded, false);
});

test('shipped block supports road travel and its actual open garage', () => {
  const p = createPhysics(loadWorldGeometry());
  assert.ok(p.colliders.triangleCount > 18000);
  assert.ok(p.colliders.triangleCount < 20000, 'avatar must stay outside static collision world');
  tick(p, still, 0.25);
  assert.ok(p.grounded);
  tick(p, new Vector3(0, 0, -1), 5, 5);
  assert.ok(p.position.z < 0, `road blocked at z=${p.position.z}`);
  assert.ok(p.grounded);
  assert.equal(p.resetCount, 0);
  p.teleport(new Vector3(14.9, 0.13, -36));
  tick(p, new Vector3(0, 0, -1), 2, 3);
  assert.ok(p.position.z < -41, `garage opening blocked at z=${p.position.z}`);
  assert.ok(Math.abs(p.position.y - 0.361) < 0.02, `garage floor y=${p.position.y}`);
  tick(p, new Vector3(0, 0, -1), 2, 5);
  assert.ok(p.position.z > -45.5 && p.position.z < -44, `garage rear wall z=${p.position.z}`);
  assert.ok(p.grounded);
  assert.equal(p.resetCount, 0);
});

test('shipped road paint stays visible geometry without making the avatar bounce', () => {
  const scene = loadWorldGeometry();
  // The browser loader replaces spaces with underscores. Exercise those actual
  // runtime names, rather than relying only on the unsanitized GLB source names.
  scene.traverse((object) => { object.name = object.name.replaceAll(' ', '_'); });
  for (const fps of [30, 60, 144]) {
    const p = createPhysics(scene);
    tick(p, still, 0.3, 0, 1 / fps);
    let largestVerticalStep = 0;
    for (let frame = 0; frame < fps * 8; frame++) {
      const previousY = p.position.y;
      p.move(new Vector3(0, 0, -1), 5.2, 1 / fps);
      largestVerticalStep = Math.max(largestVerticalStep, Math.abs(p.position.y - previousY));
      assert.ok(p.grounded, `lost road contact at ${fps} Hz, z=${p.position.z}`);
    }
    // Previously the raised centre-line slabs caused repeated 13 mm jumps.
    assert.ok(largestVerticalStep < 0.0005,
      `${fps} Hz road height jump ${largestVerticalStep} m`);
    assert.ok(p.position.z < -16, `road travel blocked at ${fps} Hz`);
    assert.equal(p.resetCount, 0);
  }
});

test('render position advances smoothly between fixed updates and clears on teleport', () => {
  const p = createPhysics(world(), { spawn: new Vector3(0, 0.01, 0) });
  const direction = new Vector3(1, 0, 0);
  tick(p, direction, 2, 5, 1 / 144);
  const rendered = new Vector3();
  let previousX = p.getRenderPosition(rendered).x;
  let minTravel = Infinity, maxTravel = -Infinity;
  for (let frame = 0; frame < 144; frame++) {
    p.move(direction, 5, 1 / 144);
    p.getRenderPosition(rendered);
    const travel = rendered.x - previousX;
    minTravel = Math.min(minTravel, travel);
    maxTravel = Math.max(maxTravel, travel);
    previousX = rendered.x;
  }
  assert.ok(minTravel > 0, 'rendering must advance on frames without a physics step');
  assert.ok(maxTravel - minTravel < 0.0001, `render movement range ${minTravel}–${maxTravel}`);
  assert.ok(Math.abs(minTravel - 5 / 144) < 0.0001);
  p.teleport(new Vector3(-10, 3, 2));
  assert.deepEqual(p.getRenderPosition(rendered).toArray(), p.position.toArray());
  assert.equal(p.velocity.length(), 0);
  p.reset();
  assert.deepEqual(p.getRenderPosition(rendered).toArray(), p.position.toArray());
});

test('every fast-travel arrival settles safely on the shipped block', () => {
  const p = createPhysics(loadWorldGeometry());
  for (const destination of DESTINATIONS) {
    const arrival = new Vector3(...destination.position);
    p.teleport(arrival);
    tick(p, still, 0.4, 0, 1 / 120);
    assert.ok(p.grounded, `${destination.name}: arrival has no walkable floor`);
    assert.ok(Math.hypot(p.position.x - arrival.x, p.position.z - arrival.z) < 0.00001,
      `${destination.name}: geometry pushed the arrival away from its selected point`);
    assert.ok(p.velocity.length() < 0.00001, `${destination.name}: arrival is still moving`);
    assert.ok(p.position.y <= arrival.y + 0.001 && p.position.y > arrival.y - 0.5,
      `${destination.name}: arrival fell too far or started inside raised geometry`);
    const { octree, capsule } = p.colliders;
    const triangles = [];
    octree.getCapsuleTriangles(capsule, triangles);
    for (const triangle of triangles) {
      const contact = octree.triangleCapsuleIntersect(capsule, triangle);
      assert.ok(!contact || contact.depth < 0.00001,
        `${destination.name}: settled capsule intersects world geometry`);
    }
  }
  assert.equal(p.resetCount, 0, 'an arrival must not fall out of the scene and reset');
});
