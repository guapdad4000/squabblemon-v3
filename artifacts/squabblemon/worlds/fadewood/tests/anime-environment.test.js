import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createAnimeEnvironment, BENCH_FACING, PANORAMA_SEAM_WIDTH, PANORAMA_SKY_FADE_START } from '../src/anime-environment.js';
import { loadWorldGeometry } from './world-geometry.js';

function texture(width = 4, height = 1) {
  const image = { width, height };
  return new THREE.Texture(image);
}
async function fixture() {
  const world = loadWorldGeometry();
  const parent = new THREE.Scene(); parent.add(world);
  const originals = new Map();
  world.traverse((mesh) => { if (mesh.isMesh) originals.set(mesh, mesh.geometry); });
  const environment = await createAnimeEnvironment({ world, parent, textures: { leaves: texture(1, 1), panorama: texture(), neighborhood: texture(2172, 724) } });
  return { world, parent, originals, environment };
}

test('foliage and park cleanup preserve source structures while removing only identified parts', async () => {
  const { world, originals, environment } = await fixture();
  assert.equal(environment.stats.removedFoliageComponents, 38);
  assert.equal(environment.stats.removedFoliageTriangles, 2040);
  let oldCount = 0, newCount = 0, meshes = 0;
  for (const [object, geometry] of originals) {
    oldCount += (geometry.index?.count ?? geometry.attributes.position.count) / 3;
    newCount += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3;
  }
  world.traverse((object) => { if (object.isMesh) meshes++; });
  assert.equal(meshes, originals.size, 'no source structure or avatar object was removed');
  assert.equal(oldCount - newCount, 2040 + environment.stats.removedParkClutterTriangles,
    'leaf triangles and explicitly identified obsolete park parts are the only removals');
  environment.dispose();
  for (const [object, geometry] of originals) assert.equal(object.geometry, geometry, 'source geometry can be restored intact');
});

test('obsolete park signs and the post-office hoop are gone while the car and park court remain', async () => {
  const { world, environment } = await fixture();
  assert.equal(environment.stats.removedStrayHoopComponents, 5);
  assert.equal(environment.stats.removedParkClutterComponents, 27);
  const point = new THREE.Vector3();
  const activePoints = (name) => {
    const points = [];
    world.traverse((mesh) => {
      if (!mesh.isMesh || !name.test(mesh.name)) return;
      const p = mesh.geometry.attributes.position;
      const indices = mesh.geometry.index?.array ?? Array.from({ length: p.count }, (_, i) => i);
      for (const i of indices) points.push(point.fromBufferAttribute(p, i).applyMatrix4(mesh.matrixWorld).clone());
    });
    return points;
  };
  const oldCorner = activePoints(/08 Parked car and basketball corner/);
  assert.ok(oldCorner.length > 0 && oldCorner.every(p => p.x < 0), 'the teal car remains; every component of the stray east-side hoop is removed');
  const park = activePoints(/13 FADE PARK/);
  assert.ok(park.some(p => p.x > 20 && p.z < -34 && p.y > 3), 'the actual basketball-court hoop remains in the park');
  assert.ok(!park.some(p => p.x > 14 && p.x < 22 && p.z > -16.3 && p.z < -15.9 && p.y > 2), 'the duplicate garden billboard, lettering and tall posts are removed');
  assert.ok(!park.some(p => p.x > 11.5 && p.x < 11.9 && p.z > -22 && p.z < -20 && p.y > 2), 'the street-side teal placard and lettering are removed');
  environment.dispose();
});

test('whole benches face toward the street or park path, with all six authored locations retained', async () => {
  const { environment } = await fixture();
  assert.equal(environment.stats.benches, 6);
  assert.equal(environment.stats.benchesCorrected, 3);
  const corrected = environment.changes.benches.filter((bench) => bench.rotate);
  assert.ok(corrected.every((bench) => bench.transformedVertices >= 90), 'seat, back, legs and arms all turn together');
  assert.deepEqual(corrected.map((bench) => bench.id), ['west-street-south', 'west-street-north', 'park-west']);
  assert.ok(BENCH_FACING.slice(0, 4).every((bench) => bench.facing[0] * bench.center[0] < 0), 'street benches face toward street centre');
  assert.ok(BENCH_FACING.slice(4).every((bench) => bench.facing[0] * (17.5 - bench.center[0]) > 0), 'park benches face the main path');
  environment.dispose();
});

test('all layered leaves share one clipped map and wind changes only a uniform', async () => {
  const { environment } = await fixture();
  const leaves = environment.group.getObjectByName('Fadewood | layered painted leaf clusters');
  assert.ok(leaves.isInstancedMesh);
  assert.equal(leaves.count, 328);
  assert.equal(environment.stats.leafDrawCalls, 1);
  assert.equal(environment.stats.leafTextures, 1);
  assert.equal(leaves.material.transparent, false);
  assert.ok(leaves.material.alphaTest > 0 && leaves.material.alphaToCoverage);
  const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.basic.vertexShader, fragmentShader: THREE.ShaderLib.basic.fragmentShader };
  leaves.material.onBeforeCompile(shader);
  const version = leaves.instanceMatrix.version;
  const matrices = Array.from(leaves.instanceMatrix.array);
  environment.update(19.5, new THREE.PerspectiveCamera());
  assert.equal(shader.uniforms.fadewoodTime.value, 19.5);
  assert.equal(leaves.instanceMatrix.version, version);
  assert.deepEqual(Array.from(leaves.instanceMatrix.array), matrices, 'GPU wind avoids rewriting every card transform');
  assert.equal(environment.stats.mailboxes, 4);
  assert.equal(environment.stats.panoramaLayers, 2);
  assert.equal(environment.stats.textures, 3);
  assert.equal(environment.stats.meshes, 4);
  environment.dispose();
});

test('panorama sampling joins asymmetric source edges continuously without reflecting the painting', async () => {
  const { environment } = await fixture();
  const panorama = environment.group.getObjectByName('Fadewood | painted skyline at 133 metres');
  const shader = { uniforms: {}, fragmentShader: THREE.ShaderLib.basic.fragmentShader };
  panorama.material.onBeforeCompile(shader);
  const kernel = shader.fragmentShader.match(/vec3 fadewoodPanoramaSeam\(float across\)\s*\{([^}]+)\}/)?.[1];
  assert.ok(kernel, 'the production material installs the periodic sampling kernel');
  // Execute the small arithmetic kernel installed in the actual GLSL. This
  // avoids proving continuity with a separate copy of its formula.
  const smoothstep = (low, high, value) => {
    const t = Math.max(0, Math.min(1, (value - low) / (high - low)));
    return t * t * (3 - 2 * t);
  };
  const seam = new Function('across', 'smoothstep', kernel
    .replaceAll('float ', 'const ')
    .replace(/return vec3\(([^)]+)\);/, 'return [$1];'));
  // Unequal endpoint colours and slopes make ordinary repeat fail visibly.
  const source = (u) => .12 + .68 * u + .15 * Math.sin(u * 13);
  const edge = PANORAMA_SEAM_WIDTH;
  const sample = (u) => {
    const phase = u - Math.floor(u);
    if (phase >= edge && phase <= 1 - edge) return source(phase);
    const [left, right, mix] = seam(phase < .5 ? phase : phase - 1, smoothstep);
    return source(right) * (1 - mix) + source(left) * mix;
  };
  const epsilon = 1e-7;
  const derivative = (u) => (sample(u + epsilon) - sample(u - epsilon)) / (2 * epsilon);
  for (let join = -12; join <= 12; join++) {
    assert.ok(Math.abs(sample(join - epsilon) - sample(join + epsilon)) < 1e-5, `tile ${join} colours meet`);
    assert.ok(Math.abs(derivative(join - epsilon * 2) - derivative(join + epsilon * 2)) < .001, `tile ${join} slopes meet`);
  }
  for (const boundary of [edge, 1 - edge]) {
    assert.ok(Math.abs(sample(boundary - epsilon) - sample(boundary + epsilon)) < 1e-5, 'overlap meets the original image continuously');
    assert.ok(Math.abs(derivative(boundary - epsilon * 2) - derivative(boundary + epsilon * 2)) < .001, 'overlap does not introduce an outer-edge crease');
  }
  for (const u of [.1, .25, .5, .75, .9]) assert.equal(sample(u), source(u), 'the centre of the original painting is untouched');
  let previous = [-Infinity, -Infinity];
  for (let i = 0; i <= 100; i++) {
    const [left, right] = seam(-edge + 2 * edge * i / 100, smoothstep);
    assert.ok(left >= previous[0] && right >= previous[1], 'both source strips keep their original left-to-right direction');
    previous = [left, right];
  }
  assert.ok(shader.fragmentShader.indexOf('dFdx(vMapUv)') < shader.fragmentShader.indexOf('float panoramaU = fract'), 'mip derivatives are taken before the wrapped coordinate jumps');
  assert.ok(shader.fragmentShader.includes('textureGrad(map,'), 'seam samples use explicit stable mip gradients');
  environment.dispose();
});

test('both painted cylinders close on integer repeats with one texture and draw per belt', async () => {
  const { environment } = await fixture();
  const horizon = environment.group.getObjectByName('Fadewood | layered parallax horizon');
  for (const panorama of horizon.children) {
    const map = panorama.material.map;
    assert.equal(map.wrapS, THREE.RepeatWrapping);
    assert.equal(Number.isInteger(map.repeat.x), true);
    const geometry = panorama.geometry;
    const positions = geometry.attributes.position;
    const uv = geometry.attributes.uv;
    const row = geometry.parameters.radialSegments + 1;
    const aspect = map.image.width / map.image.height;
    assert.equal(map.repeat.x, Math.max(1, Math.round((2 * Math.PI * geometry.parameters.radiusTop / geometry.parameters.height) / aspect)), 'repeat count follows image aspect while closing the full circle');
    for (let y = 0; y <= geometry.parameters.heightSegments; y++) {
      const first = y * row, last = first + row - 1;
      assert.ok(new THREE.Vector3().fromBufferAttribute(positions, first).distanceTo(new THREE.Vector3().fromBufferAttribute(positions, last)) < 1e-9, 'world positions close at every cylinder row');
      assert.equal(Math.abs(uv.getX(first) - uv.getX(last)) * map.repeat.x, map.repeat.x, 'the cylinder closure lands on the same periodic sample');
      assert.equal(uv.getY(first), uv.getY(last));
    }
  }
  assert.equal(environment.stats.panoramaLayers, 2);
  assert.equal(environment.stats.panoramaDrawCalls, 2);
  assert.equal(environment.stats.meshes, 4);
  assert.equal(environment.stats.textures, 3, 'leaves and both independent paintings each own one texture');
  environment.dispose();
});

test('the panorama top blends smoothly to the owning scene linear sky colour without changing the skyline', async () => {
  const { parent, environment } = await fixture();
  parent.background = new THREE.Color('#6aa8da');
  environment.update(0);
  const panorama = environment.group.getObjectByName('Fadewood | painted skyline at 133 metres');
  const shader = { uniforms: {}, fragmentShader: THREE.ShaderLib.basic.fragmentShader };
  panorama.material.onBeforeCompile(shader);
  const kernel = shader.fragmentShader.match(/float fadewoodPanoramaSkyBlend\(float v\)\s*\{([^}]+)\}/)?.[1];
  assert.ok(kernel, 'the material installs the production sky blend');
  const smoothstep = (low, high, value) => {
    const t = Math.max(0, Math.min(1, (value - low) / (high - low)));
    return t * t * (3 - 2 * t);
  };
  const skyBlend = new Function('v', 'smoothstep', kernel);
  const sample = (v) => skyBlend(v, smoothstep);
  const start = PANORAMA_SKY_FADE_START;
  const epsilon = 1e-7;
  for (const v of [0, .25, .5, .75, start]) assert.equal(sample(v), 0, 'hills, buildings and the cloud core below the upper band retain their colours');
  assert.equal(sample(1), 1, 'the upper cylinder edge is exactly the sky colour');
  assert.ok(Math.abs(sample((start + 1) / 2) - .5) < 1e-12);
  for (const edge of [start, 1]) {
    assert.ok(Math.abs(sample(edge + epsilon) - sample(edge - epsilon)) < 1e-10, 'fade colour is continuous at the band endpoints');
    assert.ok(Math.abs((sample(edge + epsilon) - sample(edge - epsilon)) / (2 * epsilon)) < 1e-4, 'fade slope reaches zero at the band endpoints');
  }
  assert.deepEqual(shader.uniforms.fadewoodPanoramaSky.value, parent.background, 'the uniform uses the actual scene working-space Color');
  assert.ok(shader.uniforms.fadewoodPanoramaSky.value.r < 0x6a / 255, 'the uniform is linear, not raw sRGB display values');
  parent.background = new THREE.Color('#4eafce');
  environment.update(1);
  assert.deepEqual(shader.uniforms.fadewoodPanoramaSky.value, parent.background, 'changing the scene background updates the existing uniform');
  parent.background = null;
  environment.update(2);
  assert.deepEqual(shader.uniforms.fadewoodPanoramaSky.value, new THREE.Color('#4eafce'), 'a missing or image background uses the authored sky fallback');
  assert.equal(panorama.material.transparent, false);
  assert.equal(panorama.material.toneMapped, false, 'the edge uses the same output conversion as the solid scene background');
  assert.equal(environment.stats.meshes, 4);
  assert.equal(environment.stats.textures, 3);
  environment.dispose();
});

test('the near horizon is one alpha-clipped painted strip with no building geometry or collision', async () => {
  const { environment } = await fixture();
  const horizon = environment.group.getObjectByName('Fadewood | layered parallax horizon');
  const far = horizon.getObjectByName('Fadewood | painted skyline at 133 metres');
  const near = horizon.getObjectByName('Fadewood | painted near neighborhood at 94 metres');
  assert.equal(horizon.children.length, 2);
  assert.ok(horizon.children.every((mesh) => mesh.geometry.type === 'CylinderGeometry'), 'skyline shapes come from the paintings, without boxes or pitched-roof meshes');
  assert.notEqual(near.material.map, far.material.map, 'the near neighborhood has independent artwork and UV settings');
  assert.equal(near.geometry.parameters.radiusTop, 94);
  assert.equal(near.geometry.parameters.height, 52, 'the transparent upper artwork leaves the painted roofs above ground');
  assert.deepEqual(near.position.toArray(), [0, 4, -5]);
  assert.equal(near.material.map.repeat.x, 4, 'the 3:1 painting closes around the neighborhood in four repeats');
  assert.equal(near.geometry.parameters.radialSegments, 96);
  assert.equal(near.geometry.parameters.openEnded, true);
  assert.equal(near.geometry.attributes.color, undefined, 'the strip uses its painted map rather than flat blue vertex colours');
  assert.equal(near.geometry.index.count / 3, 192, 'the painted strip uses fewer triangles than the previous 47 boxes and roofs');
  near.geometry.computeBoundingBox();
  assert.ok(near.geometry.boundingBox.min.y + near.position.y < -20, 'the painted base extends below the ground instead of floating above it');
  assert.equal(near.material.side, THREE.BackSide, 'only the inward cylinder wall renders');
  assert.equal(near.material.map.wrapT, THREE.ClampToEdgeWrapping, 'transparent sky never repeats down the strip');
  assert.equal(near.material.transparent, false);
  assert.equal(near.material.alphaTest, .1);
  assert.equal(near.material.alphaToCoverage, true);
  assert.equal(near.material.depthWrite, false);
  assert.equal(near.material.fog, true, 'the nearer painting keeps the existing atmospheric fade');
  assert.equal(near.material.toneMapped, false);
  horizon.traverse((object) => assert.equal(object.userData.noCollision, true));
  assert.equal(far.geometry.parameters.height, 48, 'the original distant panorama framing stays intact');
  assert.deepEqual(far.position.toArray(), [0, 13, -5]);
  assert.equal(far.rotation.y, .56);
  environment.dispose();
});

test('the cutout joins alpha continuously without fading its skyline into an opaque sky band', async () => {
  const { environment } = await fixture();
  const near = environment.group.getObjectByName('Fadewood | painted near neighborhood at 94 metres');
  const shader = { uniforms: {}, fragmentShader: THREE.ShaderLib.basic.fragmentShader };
  near.material.onBeforeCompile(shader);
  const kernel = shader.fragmentShader.match(/vec3 fadewoodPanoramaSeam\(float across\)\s*\{([^}]+)\}/)?.[1];
  const smoothstep = (low, high, value) => {
    const t = Math.max(0, Math.min(1, (value - low) / (high - low)));
    return t * t * (3 - 2 * t);
  };
  assert.ok(kernel);
  const seam = new Function('across', 'smoothstep', kernel
    .replaceAll('float ', 'const ')
    .replace(/return vec3\(([^)]+)\);/, 'return [$1];'));
  const alpha = (u) => .2 + .7 * u + .05 * Math.sin(u * 19);
  const sampleAlpha = (u) => {
    const phase = u - Math.floor(u);
    if (phase >= PANORAMA_SEAM_WIDTH && phase <= 1 - PANORAMA_SEAM_WIDTH) return alpha(phase);
    const [left, right, blend] = seam(phase < .5 ? phase : phase - 1, smoothstep);
    return alpha(right) * (1 - blend) + alpha(left) * blend;
  };
  const epsilon = 1e-7;
  const derivative = (u) => (sampleAlpha(u + epsilon) - sampleAlpha(u - epsilon)) / (2 * epsilon);
  for (let join = -4; join <= 4; join++) {
    assert.ok(Math.abs(sampleAlpha(join - epsilon) - sampleAlpha(join + epsilon)) < 1e-5, 'asymmetric alpha edges join continuously');
    assert.ok(Math.abs(derivative(join - epsilon * 2) - derivative(join + epsilon * 2)) < .001, 'alpha edge slopes meet across the repeat');
  }
  assert.ok(shader.fragmentShader.includes('rightEdge.rgb * rightEdge.a'), 'seam colours are weighted by their visible alpha');
  assert.ok(shader.fragmentShader.includes('seamColor / max(seamAlpha,'), 'premultiplied seam colours return to straight alpha for the material');
  assert.ok(!shader.fragmentShader.includes('fadewoodPanoramaSkyBlend'), 'transparent roof and foliage contours remain open to the farther painting');
  assert.equal(shader.uniforms.fadewoodPanoramaSky, undefined);
  assert.ok(shader.fragmentShader.indexOf('dFdx(vMapUv)') < shader.fragmentShader.indexOf('float panoramaU = fract'));
  assert.notEqual(near.material.customProgramCacheKey(), environment.group.getObjectByName('Fadewood | painted skyline at 133 metres').material.customProgramCacheKey(), 'opaque and cutout shader programs cannot be confused');
  environment.dispose();
});

test('both horizon layers remain fixed in world space as walking creates relative parallax', async () => {
  const { parent, environment } = await fixture();
  const horizon = environment.group.getObjectByName('Fadewood | layered parallax horizon');
  parent.updateMatrixWorld(true);
  const transforms = horizon.children.map((mesh) => mesh.matrixWorld.clone());
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(12, 2, 0);
  environment.update(10, camera);
  parent.updateMatrixWorld(true);
  horizon.children.forEach((mesh, i) => assert.deepEqual(mesh.matrixWorld, transforms[i], 'walking never recenters or rotates either painted cylinder'));
  const viewChange = (mesh) => {
    const worldPoint = new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position, 0).applyMatrix4(mesh.matrixWorld);
    return worldPoint.clone().sub(new THREE.Vector3(0, 2, 0)).angleTo(worldPoint.clone().sub(camera.position));
  };
  const nearChange = viewChange(horizon.getObjectByName('Fadewood | painted near neighborhood at 94 metres'));
  const farChange = viewChange(horizon.getObjectByName('Fadewood | painted skyline at 133 metres'));
  assert.ok(nearChange > farChange, 'the nearer world-space painting moves through a larger viewing angle');
  environment.dispose();
});

test('production loads a third cutout image while legacy texture fixtures remain deterministic', async () => {
  const world = loadWorldGeometry();
  const parent = new THREE.Scene(); parent.add(world);
  const requested = [];
  const environment = await createAnimeEnvironment({ world, parent, textureLoader: {
    async loadAsync(url) { requested.push(url); return texture(); },
  } });
  assert.deepEqual(requested, ['/assets/v3/anime-leaves.png', '/assets/v3/fadewood-panorama.webp', '/assets/v3/fadewood-near-neighborhood.webp']);
  assert.equal(environment.stats.textures, 3);
  environment.dispose();
  const panorama = texture();
  const fallback = await createAnimeEnvironment({ world, parent, textures: { leaves: texture(1, 1), panorama }, textureLoader: {
    async loadAsync() { assert.fail('injected CPU fixtures must never start a DOM image load'); },
  } });
  const near = fallback.group.getObjectByName('Fadewood | painted near neighborhood at 94 metres');
  assert.notEqual(near.material.map, panorama, 'the fixture fallback cannot change the far panorama repeat');
  assert.equal(fallback.stats.textures, 3);
  fallback.dispose();
});
