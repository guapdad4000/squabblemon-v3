import * as THREE from 'three';

const DURATION = 2.8;
const clamp01 = (value) => Math.max(0, Math.min(1, value));
const easeOut = (value) => 1 - (1 - clamp01(value)) ** 3;
const smooth = (value) => { const t = clamp01(value); return t * t * (3 - 2 * t); };

const FIST_PERIOD = 1.55;
const FIST_STAGGER = FIST_PERIOD / 5;

// A hand starts inside the dust, emerges, throws one punch and disappears back
// into it. Each of the five hands has a short active window; there are never
// five permanently exposed hands around the silhouette.
export function sampleFistCycle(elapsedSeconds, index = 0) {
  const t = Math.max(0, Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0);
  const hand = Number.isFinite(index) ? Math.max(0, Math.floor(index)) % 5 : 0;
  const local = t - .1 - hand * FIST_STAGGER;
  if (local <= 0) return { phase: 0, extension: 0, opacity: 0, visible: false, impact: 0 };
  const cycleTime = local % FIST_PERIOD;
  const extension = smooth(cycleTime / .22) * (1 - smooth((cycleTime - .31) / .36));
  const opacity = smooth(cycleTime / .12) * (1 - smooth((cycleTime - .39) / .22));
  const impact = smooth((cycleTime - .12) / .1) * (1 - smooth((cycleTime - .27) / .11));
  return { phase: cycleTime / FIST_PERIOD, extension, opacity, visible: opacity > .002, impact };
}

// Shared low-poly dust plus five alpha-cutout anime fist sprites on one atlas.
// Route motion is world-space; billboard orientation is the only camera coupling.
// All local animation uses elapsed time, so replay/rewind remains deterministic.
export function createFightCloud(scene, options = {}) {
  const group = new THREE.Group();
  group.name = 'Fast travel | comic fist cloud';
  group.visible = false;
  group.userData.ignoreCameraCollision = true;
  group.userData.isTravelEffect = true;
  scene.add(group);

  const geometries = new Set();
  const materials = new Set();
  const geometry = (value) => { geometries.add(value); return value; };
  const material = (color, extra = {}) => {
    const value = new THREE.MeshBasicMaterial({ color, ...extra });
    materials.add(value);
    return value;
  };
  const ink = material('#18223d', { side: THREE.BackSide });
  const cream = material('#fff5d4', { vertexColors: true });
  const sparkColor = material('#ffdb57', { side: THREE.DoubleSide });
  const tickColor = material('#18223d', { side: THREE.DoubleSide });

  // Flat, three-value facets read like cel-painted gouache without light setup.
  function paintFacets(source, tones) {
    const geo = geometry(source);
    const normals = geo.getAttribute('normal');
    const colors = new Float32Array(normals.count * 3);
    const palette = tones.map((tone) => new THREE.Color(tone));
    for (let i = 0; i < normals.count; i += 3) {
      const nx = normals.getX(i) + normals.getX(i + 1) + normals.getX(i + 2);
      const ny = normals.getY(i) + normals.getY(i + 1) + normals.getY(i + 2);
      const nz = normals.getZ(i) + normals.getZ(i + 1) + normals.getZ(i + 2);
      const light = (-0.38 * nx + 0.81 * ny + 0.44 * nz) / Math.hypot(nx, ny, nz);
      const color = palette[light > 0.32 ? 0 : light > -0.28 ? 1 : 2];
      for (let j = i; j < i + 3; j += 1) color.toArray(colors, j * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geo;
  }

  const puffGeometry = paintFacets(new THREE.IcosahedronGeometry(1, 2), ['#ffffff', '#eee7f2', '#aaa8cb']);

  // The middle remains solid through the teleport cut; outer puffs tumble away.
  const puffSpecs = [
    [0, 0.94, 0, 0.96], [0, 1.65, 0, 0.75],
    [-0.64, 0.62, 0.23, 0.65], [0.65, 0.65, 0.18, 0.69],
    [-0.69, 1.31, 0.24, 0.65], [0.71, 1.33, 0.22, 0.65],
    [-0.34, 1.96, 0.11, 0.54], [0.36, 1.95, 0.09, 0.57],
    [-0.59, 0.87, -0.48, 0.59], [0.56, 1.01, -0.52, 0.63],
    [0, 0.55, 0.67, 0.64], [-0.67, 1.1, 0.68, 0.6],
    [0.65, 1.1, 0.69, 0.59], [-0.34, 1.75, 0.65, 0.57],
    [0.34, 1.76, 0.65, 0.57], [0, 1.15, 0.74, 0.69],
  ];
  const puffFill = new THREE.InstancedMesh(puffGeometry, cream, puffSpecs.length);
  const puffOutline = new THREE.InstancedMesh(puffGeometry, ink, puffSpecs.length);
  puffFill.name = 'Comic dust | instanced fill';
  puffOutline.name = 'Comic dust | instanced ink';
  // This small temporary effect needs no per-frame bounds recomputation.
  puffFill.frustumCulled = puffOutline.frustumCulled = false;
  group.add(puffOutline, puffFill);
  const puffs = puffSpecs.map(([x, y, z, radius], index) => ({
    object: new THREE.Object3D(), x, y, z, radius, phase: index * 2.39996,
  }));

  const fistPaint = material('#ffffff', {
    side: THREE.DoubleSide, alphaTest: .025, alphaHash: true, depthWrite: true,
  });
  // One atlas and material for all five cards. A tiny per-card vertex attribute
  // drives alpha-hashed coverage, so hands visibly dissolve without transparent
  // sorting errors or drawing over the opaque dust that conceals their wrists.
  fistPaint.customProgramCacheKey = () => 'comic-fist-emergence-v2';
  fistPaint.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float fistOpacity;\nvarying float vFistOpacity;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFistOpacity = fistOpacity;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vFistOpacity;')
      .replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.a *= vFistOpacity;');
  };
  let fistTexture = null;
  let textureReady = false;
  let disposed = false;
  group.userData.fistTextureReady = false;
  function setFistTexture(texture) {
    if (!texture) return;
    if (disposed) { texture.dispose(); return; }
    if (fistTexture && fistTexture !== texture) fistTexture.dispose();
    fistTexture = texture;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
    fistPaint.map = texture;
    fistPaint.needsUpdate = true;
    textureReady = true;
    group.userData.fistTextureReady = true;
  }
  if (options.texture) setFistTexture(options.texture);
  else if (options.textureUrl !== false && typeof document !== 'undefined') {
    const url = options.textureUrl ?? '/assets/v3/anime-fists.png';
    new THREE.TextureLoader().load(url, setFistTexture, undefined, () => {
      // The dust and impact marks remain usable while an atlas is unavailable.
      // No geometric hand fallback: malformed fingers were intentionally removed.
      group.userData.fistTextureError = true;
    });
  }
  const fistGeometries = Array.from({ length: 5 }, (_, index) => {
    const geo = geometry(new THREE.PlaneGeometry(1.65, 1.65));
    const uv = geo.getAttribute('uv');
    const cell = index % 4;
    const column = cell % 2, row = Math.floor(cell / 2);
    // Atlas cells are numbered left-to-right, top-to-bottom.
    for (let i = 0; i < uv.count; i += 1) {
      uv.setXY(i, (column + .012 + uv.getX(i) * .976) / 2, (1 - row + .012 + uv.getY(i) * .976) / 2);
    }
    geo.setAttribute('fistOpacity', new THREE.Float32BufferAttribute([0, 0, 0, 0], 1).setUsage(THREE.DynamicDrawUsage));
    return geo;
  });
  // Wrist-to-knuckle axes measured from the four painted atlas cells: diagonal,
  // horizontal, rising uppercut, diagonal. Rotate that axis toward the strike.
  const paintedAxes = [-.76, 0, 1.11, -.78];
  const fists = [
    { angle: -.88, size: .98 },
    { angle: .75, size: .92 },
    { angle: 2.3, size: .86 },
    { angle: 3.9, size: .86 },
    { angle: 1.6, size: .89 },
  ].map((spec, index) => {
    const object = new THREE.Mesh(fistGeometries[index], fistPaint);
    object.name = `Anime fist sprite ${index + 1}`;
    object.visible = false;
    object.userData.noCollision = true;
    group.add(object);
    return { ...spec, object, paintedAxis: paintedAxes[index % 4] };
  });

  const tickGeometry = geometry(new THREE.BufferGeometry());
  tickGeometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -0.035, -0.2, 0, 0.035, -0.2, 0, 0.018, 0.2, 0,
    -0.035, -0.2, 0, 0.018, 0.2, 0, -0.018, 0.2, 0,
  ], 3));
  const starShape = new THREE.Shape();
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2;
    const r = i % 2 === 0 ? 0.22 : 0.055;
    if (i === 0) starShape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else starShape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  starShape.closePath();
  const starGeometry = geometry(new THREE.ShapeGeometry(starShape));
  const accents = Array.from({ length: 9 }, (_, index) => {
    const isStar = index % 3 === 1;
    const object = new THREE.Group();
    if (isStar) {
      const border = new THREE.Mesh(starGeometry, tickColor);
      border.scale.setScalar(1.2);
      const fill = new THREE.Mesh(starGeometry, sparkColor);
      fill.position.z = 0.008;
      object.add(border, fill);
    } else {
      const tick = new THREE.Mesh(tickGeometry, tickColor);
      object.add(tick);
    }
    group.add(object);
    return { object, angle: index * Math.PI * 2 / 9 + 0.12, isStar, index };
  });

  const viewQuaternion = new THREE.Quaternion();
  const effectScale = new THREE.Vector3();
  let active = false;
  let currentDuration = DURATION;

  function stop() {
    active = false;
    group.visible = false;
    group.userData.activeFists = 0;
  }

  function update(elapsedSeconds, camera, frame = null) {
    if (!active) return false;
    const t = Math.max(0, Number.isFinite(elapsedSeconds) ? elapsedSeconds : currentDuration);
    if (t >= currentDuration) { stop(); return false; }
    if (frame?.position) group.position.set(...frame.position);
    const progress = clamp01(t / currentDuration);
    if (camera) camera.getWorldQuaternion(viewQuaternion);
    else viewQuaternion.identity();
    const appear = easeOut(t / 0.22);
    const disperse = smooth((progress - .84) / .16);
    group.scale.setScalar(appear * (1 - disperse * 0.1));
    puffs.forEach(({ object, x, y, z, radius, phase }, index) => {
      const wobble = Math.sin(t * 7 + phase) * 0.035;
      const drift = disperse * (index < 2 ? 0.45 : 0.9);
      object.position.set(x * (1 + drift) + wobble, y + Math.cos(t * 5 + phase) * .028 + disperse * (0.55 + index * 0.015), z * (1 + drift) + Math.sin(t * 4 + phase) * .025);
      object.rotation.set(phase * 0.12 + t * 0.15, phase + t * (index % 2 ? 0.22 : -0.2), wobble);
      const size = radius * (1 - disperse) * (1 + Math.sin(t * 18 + phase) * 0.035);
      object.scale.set(size * 1.04, size * .97, size);
      object.updateMatrix();
      puffFill.setMatrixAt(index, object.matrix);
      object.scale.multiplyScalar(1.045);
      object.updateMatrix();
      puffOutline.setMatrixAt(index, object.matrix);
    });
    puffFill.instanceMatrix.needsUpdate = puffOutline.instanceMatrix.needsUpdate = true;
    let activeFists = 0;
    fists.forEach(({ object, angle, size, paintedAxis }, index) => {
      const cycle = sampleFistCycle(t, index);
      const fade = cycle.opacity * (1 - disperse);
      const strikeAngle = angle + Math.sin(cycle.phase * Math.PI * 2) * .08;
      const reach = .36 + cycle.extension * (.86 + index * .015);
      // The cards sit behind the near dust lobes. At full extension the fist
      // breaks the edge, while the sleeve remains inside the occluding cloud.
      effectScale.set(Math.cos(strikeAngle) * reach, Math.sin(strikeAngle) * reach * .85, .15 + cycle.extension * .35);
      effectScale.applyQuaternion(viewQuaternion);
      object.position.copy(effectScale);
      object.position.y += 1.35;
      object.quaternion.copy(viewQuaternion);
      object.rotateZ(strikeAngle - paintedAxis);
      const punchSize = size * (.76 + cycle.extension * .24) * (1 - disperse);
      object.scale.set(punchSize * (1 + cycle.impact * .08), punchSize * (1 - cycle.impact * .035), 1);
      const opacity = object.geometry.getAttribute('fistOpacity');
      opacity.array.fill(fade);
      opacity.needsUpdate = true;
      object.visible = textureReady && cycle.visible && fade > .002;
      object.userData.opacity = fade;
      object.userData.extension = cycle.extension;
      object.userData.depth = .15 + cycle.extension * .35;
      if (object.visible) activeFists += 1;
    });
    group.userData.activeFists = activeFists;
    accents.forEach(({ object, angle, isStar, index }) => {
      const pulse = Math.max(0, Math.sin(t * 18 - index * 0.65));
      const envelope = easeOut((t - 0.2) / 0.22) * (1 - disperse);
      const radius = 1.58 + pulse * 0.15 + disperse * 0.6;
      effectScale.set(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.86, 0);
      effectScale.applyQuaternion(viewQuaternion);
      object.position.copy(effectScale);
      object.position.y += 1.25;
      object.position.z += 0.15;
      object.quaternion.copy(viewQuaternion);
      object.rotateZ(isStar ? t * (index % 2 ? 2 : -2) : angle - Math.PI / 2);
      object.scale.setScalar(envelope * (isStar ? 0.7 + pulse * 0.5 : 0.7 + pulse * 0.6));
    });
    return true;
  }

  function start(position, { duration = DURATION } = {}) {
    currentDuration = Number.isFinite(duration) && duration > 0 ? duration : DURATION;
    if (position) {
      if (Array.isArray(position)) group.position.set(...position);
      else group.position.copy(position);
    }
    active = true;
    group.visible = true;
    update(0);
  }

  function dispose() {
    disposed = true;
    stop();
    group.removeFromParent();
    geometries.forEach((geo) => geo.dispose());
    materials.forEach((mat) => mat.dispose());
    fistTexture?.dispose();
    puffFill.dispose();
    puffOutline.dispose();
  }

  return {
    start, update, stop, dispose, group, setFistTexture,
    get duration() { return currentDuration; },
    stats: { fistSprites: 5, fistAtlasTextures: 1, fistTriangles: 10, dustPuffs: puffs.length, dustDrawCalls: 2 },
  };
}
