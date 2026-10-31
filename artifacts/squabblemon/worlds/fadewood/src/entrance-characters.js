import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const INK = '#17213b';
const WAIST = .77;
const LOOKS = {
  'squabble-house': { skin: '#b87550', shirt: '#f6b82e', pants: '#4b4461', hair: '#31253b', accent: '#fff3ca', type: 'cook', pose: 'hip' },
  'fade-market': { skin: '#cc8b61', shirt: '#58b7a9', pants: '#253d65', hair: '#241f39', accent: '#f9eab8', type: 'apron', pose: 'fold' },
  'blue-block': { skin: '#8b513d', shirt: '#4077dc', pants: '#25385c', hair: '#211d30', accent: '#a6ddf5', type: 'hood', pose: 'guard' },
  'red-block': { skin: '#a96746', shirt: '#e45c66', pants: '#4f314c', hair: '#252136', accent: '#ffe5a6', type: 'puffs', pose: 'hip' },
  county: { skin: '#784630', shirt: '#a991cd', pants: '#393b57', hair: '#252236', accent: '#f4deb0', type: 'book', pose: 'book' },
  'post-office': { skin: '#bf8356', shirt: '#6aadd2', pants: '#314866', hair: '#352438', accent: '#ffdb70', type: 'post', pose: 'hip' },
  'fade-park': { skin: '#8d533b', shirt: '#7eaf57', pants: '#35464e', hair: '#32263d', accent: '#ffcb65', type: 'beanie', pose: 'fold' },
  dojo: { skin: '#c78b65', shirt: '#f2e6cb', pants: '#e1c9aa', hair: '#29253d', accent: '#c94750', type: 'gi', pose: 'guard' },
  'open-garage': { skin: '#89513b', shirt: '#e59c4d', pants: '#40566c', hair: '#272335', accent: '#f2dd9e', type: 'overalls', pose: 'hip' },
};

/** Lightweight art stand-ins. Local +Z is the front; positions are feet. */
export function createEntranceCharacters(parent, locations) {
  const group = new THREE.Group();
  group.name = 'Entrance cast | replaceable character stand-ins';
  group.userData.isEntranceCharacter = true;
  group.userData.ignoreCameraCollision = true;
  parent.add(group);

  const fillMaterial = new THREE.MeshBasicMaterial({ vertexColors: true });
  const outlineMaterial = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
  const box = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
  const facet = new THREE.IcosahedronGeometry(1, 0);
  const generated = [];
  const idles = [];
  let disposed = false;
  let triangles = 0;
  let meshes = 0;

  function buildBatch(root, pivotY = 0) {
    const fills = [], outlines = [];
    const transform = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const color = new THREE.Color();
    const light = new THREE.Vector3(-.4, .78, .48).normalize();
    const normal = new THREE.Vector3();

    function part(shape, tint, xyz, size, rotation = [0, 0, 0], border = true) {
      quaternion.setFromEuler(new THREE.Euler(...rotation));
      position.set(xyz[0], xyz[1] - pivotY, xyz[2]);
      scale.set(...size);
      transform.compose(position, quaternion, scale);
      const painted = shape.clone().applyMatrix4(transform);
      const normals = painted.getAttribute('normal');
      const colors = new Float32Array(normals.count * 3);
      const base = new THREE.Color(tint);
      for (let i = 0; i < normals.count; i += 1) {
        normal.fromBufferAttribute(normals, i);
        const amount = normal.dot(light);
        color.copy(base).multiplyScalar(amount > .28 ? 1 : amount > -.25 ? .78 : .56);
        color.toArray(colors, i * 3);
      }
      painted.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      fills.push(painted);
      if (border) {
        // Grow each component around its own center. This keeps the ink width
        // useful on a hand or collar without swelling the entire character.
        scale.set(size[0] + .018, size[1] + .018, size[2] + .018);
        transform.compose(position, quaternion, scale);
        outlines.push(shape.clone().applyMatrix4(transform));
      }
    }

    return {
      box: (tint, xyz, size, rotation, border) => part(box, tint, xyz, size, rotation, border),
      facet: (tint, xyz, size, rotation, border) => part(facet, tint, xyz, size, rotation, border),
      finish() {
        for (const [pieces, material] of [[outlines, outlineMaterial], [fills, fillMaterial]]) {
          if (!pieces.length) continue;
          const geometry = mergeGeometries(pieces);
          pieces.forEach((piece) => piece.dispose());
          generated.push(geometry);
          const mesh = new THREE.Mesh(geometry, material);
          mesh.name = material === outlineMaterial ? 'Ink silhouette' : 'Cel-painted shapes';
          mesh.userData.isEntranceCharacter = true;
          mesh.userData.ignoreCameraCollision = true;
          mesh.frustumCulled = true;
          root.add(mesh);
          meshes += 1;
          triangles += (geometry.index?.count ?? geometry.getAttribute('position').count) / 3;
        }
      },
    };
  }

  function hand(batch, xyz, skin, turn = 0) {
    // Closed palm, four squared knuckles, and a thumb curled across the front.
    // The small ink seams are baked with the fill, not separate draw calls.
    const [x, y, z] = xyz;
    batch.box(skin, [x, y, z], [.17, .15, .14], [0, 0, turn]);
    for (let i = 0; i < 4; i += 1) {
      batch.box(skin, [x + (i - 1.5) * .038, y + .076, z + .027], [.035, .05, .11], [0, 0, turn], false);
    }
    batch.box(skin, [x + .065, y - .044, z + .068], [.09, .053, .065], [0, 0, -.35 + turn]);
    for (let i = 0; i < 3; i += 1) {
      batch.box(INK, [x + (i - 1) * .038, y + .066, z + .084], [.007, .052, .006], undefined, false);
    }
  }

  function arm(batch, start, elbow, end, cloth, skin) {
    const a = new THREE.Vector3(...start), b = new THREE.Vector3(...elbow), c = new THREE.Vector3(...end);
    const direction = new THREE.Vector3(), midpoint = new THREE.Vector3();
    const quaternion = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    const euler = new THREE.Euler();
    for (const [from, to, width] of [[a, b, .175], [b, c, .14]]) {
      direction.subVectors(to, from);
      quaternion.setFromUnitVectors(up, direction.clone().normalize());
      euler.setFromQuaternion(quaternion);
      midpoint.addVectors(from, to).multiplyScalar(.5);
      batch.box(cloth, midpoint.toArray(), [width, direction.length() + .045, width], euler.toArray().slice(0, 3));
    }
    hand(batch, end, skin);
  }

  for (const [index, location] of locations.entries()) {
    const look = LOOKS[location.id] ?? LOOKS['blue-block'];
    const clothing = location.color ?? look.shirt;
    const character = new THREE.Group();
    character.name = `${location.name ?? location.id} | placeholder character`;
    character.position.fromArray(location.position);
    character.rotation.y = Number.isFinite(location.yaw) ? location.yaw : 0;
    character.userData.isEntranceCharacter = true;
    character.userData.locationId = location.id;
    character.userData.replaceable = true;
    group.add(character);

    const lower = buildBatch(character);
    // Sole bottoms stay exactly at the supplied entrance level.
    lower.box(look.pants, [-.14, .44, -.015], [.18, .6, .21], [0, 0, -.045]);
    lower.box(look.pants, [.14, .44, .005], [.18, .6, .21], [0, 0, .045]);
    lower.box(look.pants, [0, .73, 0], [.46, .2, .25]);
    lower.box(INK, [-.14, .073, .074], [.255, .146, .41]);
    lower.box(INK, [.14, .073, .094], [.255, .146, .41]);
    lower.box(look.accent, [-.14, .052, .089], [.26, .035, .42], undefined, false);
    lower.box(look.accent, [.14, .052, .109], [.26, .035, .42], undefined, false);
    lower.box(look.accent, [-.14, .142, .13], [.12, .025, .15], undefined, false);
    lower.box(look.accent, [.14, .142, .15], [.12, .025, .15], undefined, false);
    lower.finish();

    const upper = new THREE.Group();
    upper.position.y = WAIST;
    upper.name = 'Breathing, weight shift, and looking around';
    character.add(upper);
    const body = buildBatch(upper, WAIST);
    const bulky = look.type === 'hood' || look.type === 'beanie';
    body.box(clothing, [0, 1.025, 0], [bulky ? .53 : .46, .55, bulky ? .32 : .28], [0, 0, index % 2 ? -.025 : .025]);
    body.box(look.accent, [0, 1.285, .018], [.24, .075, .28]);
    body.box(look.skin, [0, 1.355, .018], [.14, .15, .16]);

    // Faceted head and small, readable graphic face on the forward (+Z) side.
    if (look.type === 'hood') body.facet(clothing, [0, 1.59, -.04], [.295, .325, .27]);
    body.facet(look.skin, [0, 1.585, .018], [.235, .276, .225]);
    body.facet(look.skin, [-.231, 1.57, 0], [.06, .085, .055]);
    body.facet(look.skin, [.231, 1.57, 0], [.06, .085, .055]);
    body.box(INK, [-.078, 1.625, .197], [.055, .031, .021], [0, 0, -.08], false);
    body.box(INK, [.078, 1.625, .197], [.055, .031, .021], [0, 0, .08], false);
    body.box(look.skin, [0, 1.564, .222], [.052, .066, .055], [0, 0, -.08], false);
    body.box(INK, [0, 1.508, .198], [.075, .014, .015], [0, 0, -.07], false);

    if (look.type === 'beanie') {
      body.facet(clothing, [0, 1.78, -.003], [.255, .195, .235]);
      body.box(look.accent, [0, 1.734, .015], [.47, .09, .37]);
    } else if (look.type === 'cook' || look.type === 'post') {
      body.facet(look.type === 'cook' ? look.accent : clothing, [0, 1.779, -.018], [.25, .14, .23]);
      body.box(look.type === 'cook' ? clothing : look.accent, [0, 1.74, .17], [.43, .045, .26], [.035, 0, 0]);
    } else if (look.type === 'puffs') {
      body.facet(look.hair, [0, 1.77, -.028], [.25, .165, .22]);
      body.facet(look.hair, [-.25, 1.81, -.04], [.19, .2, .18], [0, 0, -.2]);
      body.facet(look.hair, [.25, 1.81, -.04], [.19, .2, .18], [0, 0, .2]);
      body.box(look.accent, [-.2, 1.81, .03], [.055, .16, .07], [0, 0, -.3]);
      body.box(look.accent, [.2, 1.81, .03], [.055, .16, .07], [0, 0, .3]);
    } else {
      body.facet(look.hair, [0, 1.77, -.035], [.25, .15, .225]);
      for (let i = 0; i < 3; i += 1) {
        body.box(look.hair, [(i - 1) * .12, 1.745 + (i % 2) * .026, .145], [.145, .115, .12], [0, 0, .18 - i * .18]);
      }
    }

    const shoulder = 1.21;
    if (look.pose === 'guard') {
      arm(body, [-.28, shoulder, 0], [-.4, 1.03, .08], [-.245, 1.35, .32], clothing, look.skin);
      arm(body, [.28, shoulder, 0], [.4, 1.04, .1], [.245, 1.29, .34], clothing, look.skin);
    } else if (look.pose === 'fold') {
      arm(body, [-.27, shoulder, 0], [-.36, .98, .14], [.15, 1.06, .29], clothing, look.skin);
      arm(body, [.27, shoulder, 0], [.36, 1.01, .16], [-.12, 1.12, .34], clothing, look.skin);
    } else if (look.pose === 'book') {
      arm(body, [-.27, shoulder, 0], [-.33, .94, .11], [-.15, 1.01, .33], clothing, look.skin);
      arm(body, [.27, shoulder, 0], [.34, .96, .08], [.19, 1.04, .31], clothing, look.skin);
    } else {
      arm(body, [-.27, shoulder, 0], [-.46, .99, .01], [-.24, .91, .16], clothing, look.skin);
      arm(body, [.27, shoulder, 0], [.34, .98, .025], [.36, .8, .08], clothing, look.skin);
    }

    if (look.type === 'apron' || look.type === 'cook') {
      body.box(look.accent, [0, .965, .161], [.32, .42, .025]);
      body.box(clothing, [0, .925, .183], [.19, .11, .018], undefined, false);
      body.box(look.accent, [0, 1.205, .162], [.19, .12, .027]);
    }
    if (look.type === 'gi') {
      body.box(look.accent, [0, .835, .157], [.49, .07, .045]);
      body.box(look.accent, [-.055, .75, .18], [.055, .2, .045], [0, 0, -.12]);
      body.box(look.accent, [.043, .77, .18], [.055, .17, .045], [0, 0, .2]);
      body.box(INK, [-.057, 1.16, .163], [.032, .3, .025], [0, 0, -.36], false);
      body.box(INK, [.065, 1.16, .164], [.032, .3, .025], [0, 0, .36], false);
      body.box(look.accent, [0, 1.747, .189], [.43, .052, .026]);
      body.box(look.accent, [.2, 1.7, -.19], [.055, .27, .035], [.12, 0, -.3]);
    }
    if (look.type === 'book') {
      body.box('#7741a4', [0, 1.07, .29], [.31, .36, .09], [0, 0, -.13]);
      body.box('#fff3ce', [.013, 1.07, .344], [.255, .29, .018], [0, 0, -.13], false);
      body.box(look.accent, [-.09, 1.1, .36], [.035, .15, .012], [0, 0, -.13], false);
    }
    if (look.type === 'post') {
      body.box(look.accent, [.12, 1.16, .167], [.09, .055, .027]);
      body.box('#755643', [-.07, 1.045, .18], [.06, .56, .05], [0, 0, -.48]);
      body.box('#536b86', [-.27, .85, .12], [.22, .26, .17], [0, 0, -.08]);
      body.box(look.accent, [-.27, .93, .213], [.15, .03, .02], undefined, false);
    }
    if (look.type === 'overalls') {
      body.box(look.pants, [0, 1.045, .163], [.31, .34, .04]);
      for (const x of [-.13, .13]) {
        body.box(look.pants, [x, 1.21, .169], [.064, .2, .035]);
        body.box(look.accent, [x, 1.14, .195], [.035, .035, .014], undefined, false);
      }
      body.box(clothing, [0, 1.035, .19], [.18, .12, .025]);
    }
    if (look.type === 'hood' || look.type === 'beanie') {
      body.box(look.accent, [0, 1.05, .184], [.16, .055, .025], undefined, false);
      body.box(look.pants, [0, .9, .17], [.26, .1, .04]);
      for (const x of [-.055, .055]) body.box(look.accent, [x, 1.21, .187], [.014, .17, .014], undefined, false);
    }
    if (look.type === 'puffs') {
      body.box(look.accent, [0, .82, .167], [.4, .065, .04]);
      body.box(look.accent, [.11, 1.15, .163], [.075, .075, .02], [0, 0, .35], false);
    }
    body.finish();
    idles.push({ character, upper, phase: index * 1.79, attitude: index % 2 ? -1 : 1 });
  }

  box.dispose();
  facet.dispose();
  const stats = Object.freeze({ characters: idles.length, meshes, drawCalls: meshes, triangles, textures: 0 });
  group.userData.stats = stats;

  function update(elapsedSeconds) {
    if (disposed) return;
    const time = Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0;
    for (const { upper, phase, attitude } of idles) {
      // Only the upper body moves: the baked legs and soles stay planted at the
      // entrance. Different phases keep the cast from swaying in unison.
      const cycle = time * Math.PI * 2 / 16;
      const breath = Math.sin(cycle * 5 + phase);
      const weight = Math.sin(cycle * 2 + phase);
      const glance = Math.sin(cycle + phase * .7);
      upper.position.x = weight * .027;
      upper.position.y = WAIST + breath * .014;
      upper.position.z = Math.cos(cycle * 2 + phase) * .009;
      upper.rotation.x = Math.sin(cycle * 2 + phase + .8) * .022;
      upper.rotation.y = glance * .115;
      upper.rotation.z = attitude * .013 + weight * .038;
    }
  }

  function getMotionState() {
    return idles.map(({ character, upper }) => ({
      id: character.userData.locationId,
      feet: character.position.toArray(),
      upperPosition: upper.position.toArray(),
      upperRotation: [upper.rotation.x, upper.rotation.y, upper.rotation.z],
    }));
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    group.removeFromParent();
    generated.forEach((geometry) => geometry.dispose());
    fillMaterial.dispose();
    outlineMaterial.dispose();
    group.clear();
    idles.length = 0;
  }

  update(0);
  return { group, update, getMotionState, dispose, stats };
}
