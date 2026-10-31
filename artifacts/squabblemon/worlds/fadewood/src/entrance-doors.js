import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const INK = '#19243b';
const IVORY = '#fff3cf';
const SHADOW = '#33415d';
const STEEL = '#adc2ce';
const GOLD = '#ffd05e';

// Painted, low-poly facade details. A location is a door-bottom center with its
// local +Z facing the street. Storefronts cover the original closed building
// faces; actual passages at the dojo, garage and park stay open in the middle.
export function createEntranceDoors(parent, locations = []) {
  const group = new THREE.Group();
  group.name = 'Squabble Block | redesigned entrances';
  group.userData.isEntranceDoor = true;
  const box = new THREE.BoxGeometry(1, 1, 1);
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 8, 1);
  const palette = new Map();
  const paintMaterial = new THREE.MeshBasicMaterial({ vertexColors: true });
  paintMaterial.name = 'Entrance cel paint';
  const finalGeometries = new Set();
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const stats = { entrances: 0, meshes: 0, triangles: 0, materials: 0 };

  function getColor(color) {
    const key = new THREE.Color(color).getHexString();
    if (!palette.has(key)) palette.set(key, new THREE.Color(color));
    return palette.get(key);
  }

  for (const location of locations) {
    const { id, name = id, style = id } = location;
    const w = Math.max(0.9, Number(location.width) || 2.2);
    const h = Math.max(1.8, Number(location.height) || 3);
    const accent = location.color || '#4a9bc0';
    const entrance = new THREE.Group();
    entrance.name = `Entrance | ${name}`;
    entrance.position.fromArray(location.position || [0, 0, 0]);
    entrance.rotation.y = Number(location.yaw) || 0;
    entrance.userData = { isEntranceDoor: true, locationId: id, style, clearOpeningWidth: 0 };
    const batches = new Map();

    function shape(source, color, center, size, rotation = [0, 0, 0]) {
      position.fromArray(center);
      scale.fromArray(size);
      euler.set(...rotation);
      quaternion.setFromEuler(euler);
      matrix.compose(position, quaternion, scale);
      const copy = source.clone().applyMatrix4(matrix);
      // Bake the exact linear-space paint color into each component. All of an
      // entrance can then share one draw while keeping its authored flat colors.
      const tint = getColor(color);
      const count = copy.getAttribute('position').count;
      const colors = new Float32Array(count * 3);
      for (let i = 0; i < count; i += 1) tint.toArray(colors, i * 3);
      copy.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      if (!batches.has(paintMaterial)) batches.set(paintMaterial, []);
      batches.get(paintMaterial).push(copy);
    }
    function block(color, center, size, rotation) { shape(box, color, center, size, rotation); }
    function pole(color, center, radius, length, rotation) {
      shape(cylinder, color, center, [radius, length, radius], rotation);
    }
    function framed(color, center, size, line = 0.035) {
      block(INK, center, size);
      block(color, [center[0], center[1], center[2] + line], [
        Math.max(0.025, size[0] - line * 2),
        Math.max(0.025, size[1] - line * 2),
        size[2],
      ]);
    }
    function frame(color, thickness = 0.2, depth = 0.24) {
      for (const sign of [-1, 1]) {
        framed(color, [sign * (w / 2 + thickness / 2), h / 2, 0.1], [thickness, h + 0.12, depth]);
      }
      framed(color, [0, h + 0.08, 0.1], [w + thickness * 2 + 0.12, 0.28, depth + 0.05]);
      block(SHADOW, [0, 0.025, 0.17], [w + thickness * 2 + 0.22, 0.05, 0.54]);
      block(IVORY, [0, 0.055, 0.23], [w + thickness * 2, 0.035, 0.42]);
    }
    function sideLeaves(color, glass = true) {
      block(INK, [0, h * 0.49, 0.09], [w, h * 0.96, 0.13]);
      for (const sign of [-1, 1]) {
        const panelWidth = w / 2 - 0.018;
        const x = sign * w / 4;
        framed(color, [x, h * 0.49, 0.14], [panelWidth, h * 0.96, 0.13]);
        if (glass) {
          framed(SHADOW, [x, h * 0.61, 0.24], [panelWidth * 0.74, h * 0.57, 0.055], 0.018);
          block('#80cbd0', [x - panelWidth * 0.22, h * 0.67, 0.3], [panelWidth * 0.12, h * 0.35, 0.015]);
          block('#b7e0da', [x - panelWidth * 0.08, h * 0.76, 0.3], [panelWidth * 0.055, h * 0.17, 0.015]);
        }
        framed(STEEL, [x, h * 0.13, 0.25], [panelWidth * 0.78, h * 0.13, 0.055], 0.018);
        framed(GOLD, [sign * w * 0.07, h * 0.45, 0.34], [0.075, h * 0.2, 0.09], 0.013);
      }
    }
    function light(x, y = h * 0.77) {
      block(INK, [x, y + 0.05, 0.2], [0.25, 0.38, 0.21]);
      block(IVORY, [x, y + 0.05, 0.32], [0.14, 0.23, 0.06]);
      block(INK, [x, y + 0.28, 0.18], [0.36, 0.1, 0.38]);
    }
    function fist(x, y, z, size = 0.3, color = IVORY) {
      // Four knuckles and a tucked thumb form a closed fist, not a crown.
      framed(color, [x, y, z], [size * 1.04, size * 0.72, size * 0.3], size * 0.055);
      for (let i = 0; i < 4; i += 1) {
        framed(color, [x + (i - 1.5) * size * 0.235, y + size * 0.37, z + size * 0.025],
          [size * 0.24, size * 0.29, size * 0.32], size * 0.035);
      }
      framed(color, [x + size * 0.42, y - size * 0.18, z + size * 0.13],
        [size * 0.4, size * 0.26, size * 0.3], size * 0.035);
      framed(accent, [x, y - size * 0.51, z - size * 0.025],
        [size * 0.55, size * 0.32, size * 0.36], size * 0.04);
    }
    function awning(colorA, colorB, depth = 0.85) {
      const aw = w + 0.9;
      block(INK, [0, h + 0.39, depth * 0.38], [aw + 0.1, 0.18, depth + 0.1], [-0.14, 0, 0]);
      const strips = 7;
      for (let i = 0; i < strips; i += 1) {
        const x = -aw / 2 + aw * (i + 0.5) / strips;
        const c = i % 2 ? colorB : colorA;
        block(c, [x, h + 0.44, depth * 0.38 + 0.025], [aw / strips - 0.012, 0.12, depth], [-0.14, 0, 0]);
        framed(c, [x, h + 0.23, depth * 0.87], [aw / strips - 0.008, 0.23, 0.08], 0.018);
      }
    }

    if (style === 'park') {
      entrance.userData.clearOpeningWidth = w;
      // One quiet timber gateway, with a compact painted plaque supplied by
      // the shared atlas. No second colored portal or extruded hand badge.
      for (const sign of [-1, 1]) {
        const x = sign * (w / 2 + 0.14);
        block('#493a32', [x, h / 2, 0.07], [0.25, h, 0.27]);
        block('#94663e', [x, h / 2, 0.10], [0.21, h, 0.22]);
        block('#b28b58', [x, h + 0.035, 0.07], [0.29, 0.07, 0.31]);
        block('#785237', [sign * (w / 2 - .08), h - .30, .075], [.53, .09, .19], [0, 0, sign * .68]);
      }
      block('#493a32', [0, h - .12, .07], [w + .65, .25, .29]);
      block('#94663e', [0, h - .12, .10], [w + .61, .20, .23]);
      block('#493a32', [0, h + .05, .12], [1.51, 1.14, .20]);
    } else if (style === 'garage') {
      entrance.userData.clearOpeningWidth = w;
      frame(STEEL, 0.24, 0.3);
      // The shutter is rolled completely above the opening.
      framed(INK, [0, h + 0.42, 0.11], [w + 0.7, 0.5, 0.42]);
      for (let i = 0; i < 4; i += 1) block(i % 2 ? STEEL : '#c9d6db', [0, h + 0.26 + i * 0.105, 0.35], [w + 0.48, 0.07, 0.055]);
      for (const sign of [-1, 1]) {
        for (let i = 0; i < 6; i += 1) {
          block(i % 2 ? GOLD : INK, [sign * (w / 2 + 0.13), 0.28 + i * 0.24, 0.29], [0.16, 0.2, 0.055], [0, 0, sign * 0.18]);
        }
        light(sign * (w / 2 + 0.43), h * 0.83);
      }
      fist(w * 0.35, h + 0.49, 0.43, 0.24, GOLD);
    } else if (style === 'dojo') {
      entrance.userData.clearOpeningWidth = w * 0.68;
      frame('#a54e47', 0.25, 0.32);
      block(INK, [0, h + 0.29, 0.11], [w + 1.05, 0.16, 0.48]);
      block('#4f3642', [0, h + 0.37, 0.11], [w + 0.83, 0.08, 0.42]);
      const leafWidth = w * 0.16;
      for (const sign of [-1, 1]) {
        const x = sign * (w / 2 - leafWidth / 2);
        framed(IVORY, [x, h * 0.47, 0.13], [leafWidth, h * 0.89, 0.11]);
        for (let i = 1; i <= 4; i += 1) block('#714844', [x, h * i * 0.18, 0.225], [leafWidth, 0.035, 0.03]);
        block('#714844', [x, h * 0.48, 0.225], [0.035, h * 0.87, 0.035]);
        const lanternX = sign * (w / 2 + 0.58);
        pole(INK, [lanternX, h * 0.78, 0.22], 0.04, 0.54);
        framed('#f27c64', [lanternX, h * 0.66, 0.23], [0.28, 0.42, 0.27]);
        block(INK, [lanternX, h * 0.66, 0.39], [0.04, 0.3, 0.03]);
      }
      fist(0, h + 0.11, 0.35, 0.3);
    } else if (style === 'civic') {
      frame('#d5c7aa', 0.29, 0.3);
      sideLeaves('#61748b', false);
      for (const sign of [-1, 1]) {
        const x = sign * (w / 2 + 0.17);
        block(INK, [x, 0.18, 0.18], [0.45, 0.34, 0.42]);
        block(IVORY, [x, h * 0.91, 0.16], [0.48, 0.18, 0.4]);
      }
      // One barred leaf, one tiny colored book row: the combined jail/library.
      for (let i = 0; i < 3; i += 1) block(INK, [-w * 0.42 + (i - 1) * w * 0.045, h * 0.58, 0.25], [0.035, h * 0.43, 0.04]);
      for (let i = 0; i < 4; i += 1) framed(['#b95d59', '#62aaa3', GOLD, '#8d84b9'][i],
        [w * 0.42, h * 0.25 + i * 0.19, 0.27], [w * 0.12, 0.15, 0.1], 0.014);
      framed('#61748b', [0, h + 0.27, 0.14], [w + 0.5, 0.24, 0.3]);
      fist(0, h + 0.29, 0.4, 0.3, GOLD);
      light(-w / 2 - 0.55);
      light(w / 2 + 0.55);
    } else if (style === 'postal') {
      frame('#66a3b5', 0.24, 0.3);
      sideLeaves(IVORY);
      framed('#d45e62', [0, h + 0.28, 0.18], [w + 0.72, 0.15, 0.34]);
      // A chunky envelope badge: ivory rectangle with an ink V flap.
      framed(IVORY, [0, h + 0.31, 0.41], [0.54, 0.34, 0.09]);
      block(INK, [-0.11, h + 0.31, 0.48], [0.28, 0.025, 0.02], [0, 0, -0.51]);
      block(INK, [0.11, h + 0.31, 0.48], [0.28, 0.025, 0.02], [0, 0, 0.51]);
      framed('#578ba0', [w / 2 + 0.56, h * 0.4, 0.22], [0.44, 0.55, 0.4]);
      block(INK, [w / 2 + 0.56, h * 0.43, 0.44], [0.27, 0.055, 0.035]);
      light(-w / 2 - 0.47);
    } else if (style === 'diner') {
      frame(GOLD, 0.22, 0.29);
      sideLeaves(STEEL);
      awning(GOLD, IVORY, 0.95);
      for (const sign of [-1, 1]) {
        framed(STEEL, [sign * (w / 2 + 0.32), h * 0.42, 0.22], [0.12, h * 0.65, 0.16], 0.018);
        light(sign * (w / 2 + 0.59), h * 0.72);
      }
      fist(0, h + 0.23, 0.96, 0.29, IVORY);
    } else if (style === 'market') {
      frame('#64a58f', 0.2, 0.27);
      sideLeaves('#6bbba2');
      awning('#d36b59', IVORY, 0.9);
      // Little hanging sale placards sit at the sides, leaving the opening clear.
      for (const sign of [-1, 1]) {
        const x = sign * (w / 2 + 0.43);
        block(INK, [x, h * 0.8, 0.3], [0.03, 0.5, 0.03]);
        framed(GOLD, [x, h * 0.66, 0.31], [0.42, 0.34, 0.08]);
        block('#b16c45', [x, h * 0.66, 0.38], [0.22, 0.045, 0.025]);
      }
      fist(0, h + 0.22, 0.91, 0.28);
    } else if (style === 'house') {
      frame('#d3a373', 0.17, 0.26);
      // A single painted timber leaf, with a warm porch cap and letter box.
      framed('#508d87', [0, h * 0.49, 0.14], [w - 0.035, h * 0.96, 0.14]);
      framed('#b5c7b4', [0, h * 0.7, 0.26], [w * 0.53, h * 0.26, 0.055], 0.025);
      block('#fff1c1', [-w * 0.13, h * 0.74, 0.33], [w * 0.12, h * 0.15, 0.018]);
      for (const sign of [-1, 1]) {
        framed('#74a39a', [sign * w * 0.21, h * 0.27, 0.25], [w * 0.33, h * 0.27, 0.05], 0.022);
      }
      framed(GOLD, [w * 0.34, h * 0.45, 0.33], [0.095, 0.2, 0.09], 0.015);
      framed('#805b47', [0, h + 0.26, 0.24], [w + 0.85, 0.16, 0.94]);
      block('#eab77f', [0, h + 0.36, 0.24], [w + 0.73, 0.12, 0.83], [-0.08, 0, 0]);
      for (const sign of [-1, 1]) block('#805b47', [sign * (w / 2 + 0.22), h + 0.1, 0.24], [0.075, 0.3, 0.48]);
      light(-w / 2 - 0.39, h * 0.79);
      framed('#b66f50', [w / 2 + 0.39, h * 0.48, 0.19], [0.34, 0.43, 0.28]);
      block(INK, [w / 2 + 0.39, h * 0.53, 0.35], [0.23, 0.04, 0.025]);
      framed(IVORY, [w / 2 + 0.39, h * 0.44, 0.36], [0.16, 0.07, 0.025], 0.009);
      fist(0, h + 0.1, 0.47, 0.2, IVORY);
    } else {
      const isRed = style === 'red-housing';
      const housing = isRed ? '#c85e63' : '#5b91c9';
      frame(housing, 0.23, 0.28);
      sideLeaves(isRed ? '#7c4353' : '#465d91', false);
      // Narrow recessed glazed panels and bright kick plates evoke painted
      // apartment security doors over the original solid building faces.
      for (const sign of [-1, 1]) {
        const x = sign * w * 0.425;
        block('#9fc9cc', [x, h * 0.64, 0.25], [w * 0.075, h * 0.33, 0.045]);
        block(INK, [x, h * 0.64, 0.28], [0.024, h * 0.34, 0.025]);
        block(STEEL, [x, h * 0.16, 0.25], [w * 0.105, h * 0.1, 0.045]);
      }
      block(INK, [0, h + 0.35, 0.25], [w + 0.86, 0.12, 0.74]);
      block(housing, [0, h + 0.42, 0.25], [w + 0.72, 0.075, 0.64]);
      fist(0, h + 0.12, 0.32, 0.27, IVORY);
      light(isRed ? w / 2 + 0.48 : -w / 2 - 0.48);
      // The opposite side carries a small intercom panel with three buttons.
      const intercomX = (isRed ? -1 : 1) * (w / 2 + 0.4);
      framed(STEEL, [intercomX, h * 0.46, 0.16], [0.2, 0.36, 0.08], 0.02);
      for (let i = 0; i < 3; i += 1) block(INK, [intercomX, h * 0.46 + (i - 1) * 0.075, 0.23], [0.07, 0.025, 0.025]);
    }

    for (const [material, pieces] of batches) {
      const geometry = mergeGeometries(pieces);
      pieces.forEach((piece) => piece.dispose());
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      finalGeometries.add(geometry);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = `${name} | ${material.name}`;
      mesh.userData = { isEntranceDoor: true, locationId: id, style };
      entrance.add(mesh);
      stats.meshes += 1;
      stats.triangles += geometry.index.count / 3;
    }
    group.add(entrance);
    stats.entrances += 1;
  }

  box.dispose();
  cylinder.dispose();
  stats.materials = 1;
  group.userData.stats = stats;
  parent.add(group);
  let disposed = false;
  function dispose() {
    if (disposed) return;
    disposed = true;
    group.removeFromParent();
    finalGeometries.forEach((geometry) => geometry.dispose());
    paintMaterial.dispose();
    group.clear();
  }
  return { group, dispose, stats };
}
