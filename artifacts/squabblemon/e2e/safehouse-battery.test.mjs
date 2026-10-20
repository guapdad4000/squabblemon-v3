import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as T from '../public/scenes/shared/three.module.js';
import { batchStaticMeshes } from '../public/scenes/safehouse/batch-static.js';
import { installFightingGameStyle } from '../public/scenes/safehouse/art-direction.js';

const source = readFileSync(new URL('../public/scenes/safehouse/scene.js', import.meta.url), 'utf8');
const anchorSource = source.slice(source.indexOf('const anchorPoint=new T.Vector3();'), source.indexOf('function animate(t)'));
const batchName = object => object.name === 'static-room-batch' || object.name.startsWith('static-group-batch-');

function fixture(uncached = false) {
  const scene = new T.Scene(), outer = new T.Group(), station = new T.Group(), moving = new T.Group();
  outer.name = 'outer'; station.name = 'station'; moving.name = 'moving';
  scene.add(outer); outer.add(station); station.add(moving);
  outer.position.set(1, .2, -.4); outer.rotation.set(.1, .2, .3); outer.scale.set(1.2, .9, 1.1);
  station.position.set(-1, .1, .2); moving.position.set(.3, .5, -.2);
  const material = new T.MeshStandardMaterial();
  for (const [root, count] of [[scene, 3], [station, 5], [moving, 4]]) {
    for (let i = 0; i < count; i++) {
      const mesh = new T.Mesh(new T.BoxGeometry(.7, .5, .6), material);
      mesh.position.set(i * .45, -.3, .4); mesh.rotation.y = i * .1;
      mesh.castShadow = mesh.receiveShadow = true; root.add(mesh);
    }
  }
  const dynamic = new T.Mesh(new T.BoxGeometry(.2, .3, .4), material);
  dynamic.name = 'dynamic'; station.add(dynamic);
  const transparent = new T.Mesh(new T.PlaneGeometry(3, 3), new T.MeshBasicMaterial({ transparent: true }));
  transparent.position.z = 2; scene.add(transparent);
  const result = batchStaticMeshes(scene, [station, moving, dynamic]);
  const batches = [];
  scene.traverse(object => {
    if (!batchName(object)) return;
    batches.push(object);
    // Re-enable only the old local-matrix behavior to provide an independent
    // reference for the same merged geometry and moving-parent hierarchy.
    if (uncached) object.matrixAutoUpdate = true;
  });
  return { scene, outer, station, moving, dynamic, transparent, batches, result };
}

function pose(f, frame) {
  f.outer.position.x = 1 + Math.sin(frame * .03);
  f.outer.rotation.y = frame * .005;
  f.station.rotation.z = Math.sin(frame * .07) * .25;
  f.station.scale.set(1, 1 + Math.sin(frame * .04) * .1, .9);
  f.moving.rotation.x = Math.sin(frame * .09) * .4;
  f.dynamic.position.y = Math.sin(frame * .03) * .2;
  f.dynamic.rotation.z = frame * .03;
  f.station.visible = frame % 7 !== 0;
  f.dynamic.visible = frame % 5 !== 0;
}

function trackComposes(objects) {
  let count = 0;
  for (const object of objects) {
    const update = object.updateMatrix;
    object.updateMatrix = function () { count++; return update.call(this); };
  }
  return { reset() { count = 0; }, get count() { return count; } };
}

function pick(f, origin, direction) {
  const hit = new T.Raycaster(origin, direction).intersectObjects(f.scene.children, true)
    .find(hit => hit.object.visible && !hit.object.material?.transparent && hit.object.type === 'Mesh');
  if (!hit) return null;
  let key = null;
  for (const [object, name] of [[f.moving, 'moving'], [f.station, 'station']]) {
    for (let parent = hit.object; parent; parent = parent.parent) if (parent === object) { key = name; break; }
    if (key) break;
  }
  return { key, distance: hit.distance, point: hit.point.toArray(), faceIndex: hit.faceIndex };
}

test('only generated identity-local batches cache their local matrices', () => {
  const f = fixture();
  assert.equal(f.batches.length, 3);
  assert.equal(f.result.batches, 3);
  for (const batch of f.batches) {
    assert.equal(batch.matrixAutoUpdate, false);
    assert.equal(batch.matrixWorldAutoUpdate, true, 'moving parents must still propagate');
    assert.deepEqual(batch.matrix.elements, new T.Matrix4().elements);
  }
  for (const original of [f.scene, f.outer, f.station, f.moving, f.dynamic, f.transparent]) {
    assert.equal(original.matrixAutoUpdate, true, 'never freeze the original/dynamic objects');
  }
});

test('cached batches preserve exact moving-parent matrices, geometry, visibility and picking', t => {
  const cached = fixture(), reference = fixture(true);
  const cachedWork = trackComposes(cached.batches), referenceWork = trackComposes(reference.batches);
  let rayHits = 0;
  for (let frame = 0; frame < 240; frame++) {
    pose(cached, frame); pose(reference, frame);
    cachedWork.reset(); referenceWork.reset();
    cached.scene.updateMatrixWorld(); reference.scene.updateMatrixWorld();
    assert.equal(cachedWork.count, 0);
    assert.equal(referenceWork.count, reference.batches.length);
    for (let i = 0; i < cached.batches.length; i++) {
      const a = cached.batches[i], b = reference.batches[i];
      assert.deepEqual(a.matrixWorld.elements, b.matrixWorld.elements);
      assert.deepEqual(a.geometry.attributes.position.array, b.geometry.attributes.position.array);
      assert.deepEqual(a.geometry.attributes.normal.array, b.geometry.attributes.normal.array);
      assert.equal(a.castShadow, b.castShadow); assert.equal(a.receiveShadow, b.receiveShadow);
      const vertexA = new T.Vector3().fromBufferAttribute(a.geometry.attributes.position, 9).applyMatrix4(a.matrixWorld);
      const vertexB = new T.Vector3().fromBufferAttribute(b.geometry.attributes.position, 9).applyMatrix4(b.matrixWorld);
      assert.deepEqual(vertexA, vertexB);
      const boundsA = new T.Box3().setFromObject(a, true), boundsB = new T.Box3().setFromObject(b, true);
      assert.deepEqual(boundsA, boundsB);
      const center = boundsA.getCenter(new T.Vector3());
      for (const offset of [new T.Vector3(0, 0, 10), new T.Vector3(10, 2, 0)]) {
        const origin = center.clone().add(offset), direction = offset.clone().negate().normalize();
        const actual = pick(cached, origin, direction), expected = pick(reference, origin, direction);
        assert.deepEqual(actual, expected);
        if (actual) rayHits++;
      }
    }
    assert.deepEqual(cached.dynamic.matrixWorld.elements, reference.dynamic.matrixWorld.elements);
    assert.equal(cached.station.visible, reference.station.visible);
  }
  assert.ok(rayHits > 500, 'comparison must exercise actual mesh hits, not just empty rays');
  t.diagnostic('240 frames / 3 batches: batch-local matrix compositions 720 -> 0');
});

// Use the actual application anchor publisher, including its 100 ms throttle,
// quantization threshold, visibility rules and message shape. Only the reference
// branch replaces the new transform operation with the frozen main behavior.
function publisher(interactive, camera, messages, reference = false, standalone = false) {
  assert.ok(anchorSource.includes('anchorPoint.applyMatrix4(item.object.matrixWorld)'), 'use the matrices computed by the preceding color pass');
  const body = reference ? anchorSource.replace('anchorPoint.applyMatrix4(item.object.matrixWorld)', 'item.object.localToWorld(anchorPoint)') : anchorSource;
  const window = {}, parent = standalone ? window : {};
  return new Function('T', 'interactive', 'camera', 'emit', 'parent', 'window', `
    let lastAnchorUpdate=0, previousAnchors=null;
    ${body}
    return { publish: publishAnchors, reset: () => { previousAnchors=null; } };
  `)(T, interactive, camera, message => messages.push(structuredClone(message)), parent, window);
}

function rendererDouble() {
  const calls = [], color = new T.Color('#123456');
  let alpha = 1, target = null;
  return {
    calls, shadowMap: { autoUpdate: false },
    getPixelRatio: () => 1.4,
    getDrawingBufferSize: value => value.set(390, 844),
    getClearColor: value => value.copy(color),
    getClearAlpha: () => alpha,
    setClearColor(value, nextAlpha) { color.set(value); alpha = nextAlpha; },
    setRenderTarget(value) { target = value; },
    async compileAsync(scene) { calls.push({ type: 'compile', scene, target }); },
    render(scene, camera) {
      // This is the vendored WebGLRenderer's exact transform-update contract.
      // No WebGL hardware or timing-dependent screenshots are needed to prove it.
      if (scene.matrixWorldAutoUpdate === true) scene.updateMatrixWorld();
      if (camera.parent === null && camera.matrixWorldAutoUpdate === true) camera.updateMatrixWorld();
      calls.push({ type: 'render', scene, target, override: scene.overrideMaterial });
    },
  };
}

for (const outlines of [false, true]) {
  test(`post-render anchor reuse is exact through preparation, first frame and motion (outlines=${outlines})`, async t => {
    const f = fixture(), renderer = rendererDouble(), camera = new T.PerspectiveCamera(57, 390 / 844, .1, 70);
    const art = installFightingGameStyle({ renderer, scene: f.scene, camera, outlines });
    const keys = ['mail', 'growth', 'arcade', 'story', 'training', 'music', 'profile', 'events', 'inventory', 'cards', 'phone'];
    const interactive = keys.map((key, i) => ({ key, object: i % 2 ? f.station : f.moving }));
    const actual = [], expected = [];
    const current = publisher(interactive, camera, actual), baseline = publisher(interactive, camera, expected, true);
    const objects = []; f.scene.traverse(object => objects.push(object));
    const work = trackComposes(objects);
    await art.prepare();
    assert.equal(renderer.calls.filter(call => call.type === 'compile').length, outlines ? 3 : 1);
    assert.equal(renderer.calls.filter(call => call.type === 'render').length, 0, 'prepare does not replace the first drawn frame');
    assert.equal(actual.length, 0, 'no premature anchors during preparation');
    let oldAnchorComposes = 0;
    for (let frame = 0; frame < 180; frame++) {
      pose(f, frame);
      camera.aspect = frame < 90 ? 390 / 844 : 1440 / 900;
      camera.position.set(Math.sin(frame * .02) * 3, 3 + Math.cos(frame * .03), 9);
      camera.lookAt(new T.Vector3(.5, .6, 0));
      camera.setViewOffset(390, 844, 0, Math.sin(frame * .01) * 60, 390, 844);
      const before = renderer.calls.length;
      art.render();
      assert.equal(renderer.calls.length - before, outlines ? 3 : 1);
      assert.equal(f.scene.matrixWorldAutoUpdate, true);
      assert.equal(camera.matrixWorldAutoUpdate, true);
      assert.equal(f.transparent.visible, true, 'normal-pass visibility is restored');
      work.reset(); current.publish((frame + 1) * 100);
      assert.equal(work.count, 0, 'anchor projection must not recompose scene ancestors');
      work.reset(); baseline.publish((frame + 1) * 100);
      oldAnchorComposes += work.count;
      assert.deepEqual(actual, expected);
    }
    assert.ok(actual.length > 150, 'test must exercise moving anchor messages');
    assert.ok(oldAnchorComposes > 5000, 'baseline must demonstrate repeated ancestor work');
    t.diagnostic(`180 anchor publications: ancestor compositions ${oldAnchorComposes} -> 0`);
    assert.ok(actual[0].anchors.every(anchor => Number.isFinite(anchor.x) && Number.isFinite(anchor.y)));
    art.dispose();
  });
}

test('anchor reuse preserves throttle, unchanged-message suppression, reset and standalone behavior', () => {
  const f = fixture(), camera = new T.PerspectiveCamera(57, 390 / 844, .1, 70);
  camera.position.set(0, 2, 9); camera.lookAt(0, 1, 0); camera.updateMatrixWorld(); f.scene.updateMatrixWorld();
  const actual = [], expected = [], interactive = [{ key: 'mail', object: f.moving }];
  const current = publisher(interactive, camera, actual), baseline = publisher(interactive, camera, expected, true);
  for (const time of [0, 99, 100, 150, 200, 299, 300]) { current.publish(time); baseline.publish(time); }
  assert.deepEqual(actual, expected); assert.equal(actual.length, 1);
  current.reset(); baseline.reset(); current.publish(400); baseline.publish(400);
  assert.deepEqual(actual, expected); assert.equal(actual.length, 2);
  const standalone = [];
  publisher(interactive, camera, standalone, false, true).publish(1000);
  assert.equal(standalone.length, 0);
});

test('scene publishes anchors only after the rendered frame and retains preparation/readiness gates', () => {
  const animate = source.slice(source.indexOf('function animate(t)'), source.indexOf('// Keep the loading state'));
  assert.ok(animate.indexOf('art.render()') >= 0);
  assert.ok(animate.indexOf('publishAnchors(t)') > animate.indexOf('art.render()'));
  assert.ok(animate.indexOf("emit({type:'ready'") > animate.indexOf('art.render()'));
  assert.match(source, /art\.prepare\(\)\.then\(\(\)=>\{renderPrepared=true;wakeScene\(\);\}\)/);
  const wake = source.slice(source.indexOf('function wakeScene()'), source.indexOf('function stopScene()'));
  assert.match(wake, /if\(!renderPrepared\|\|contextLost\|\|document\.hidden/);
});
