// Run from any directory:
//   node playable/scripts/export-entrance-design.mjs
// Exports additions only, ready to import over the preserved Blender scene.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BackSide, FrontSide, PerspectiveCamera, Scene, Vector3 } from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { createEntranceDoors } from '../src/entrance-doors.js';
import { createEntranceCharacters } from '../src/entrance-characters.js';
import { createFollowCameraRig } from '../src/camera.js';
import { LANDMARKS, EXTRA_ENTRANCES } from '../src/landmarks.js';
import { createPhysics } from '../src/physics.js';
import { loadWorldGeometry } from '../tests/world-geometry.js';

const playableDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.resolve(playableDir, '../outputs');

// GLTFExporter only needs this FileReader method for a texture-free binary GLB.
// Node provides Blob natively; its promise resolves after onloadend is assigned.
if (!globalThis.FileReader) {
  globalThis.FileReader = class {
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((result) => {
        this.result = result;
        this.onloadend?.({ target: this });
      });
    }
  };
}

function bakeInverseHulls(root) {
  // glTF has no BackSide-only material flag. Reverse the ink hull's winding and
  // normals so Blender renders the same silhouette rather than a black shell.
  const convertedMaterials = new Map();
  root.traverse((mesh) => {
    if (!mesh.isMesh || mesh.material.side !== BackSide) return;
    const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
    for (const attribute of Object.values(geometry.attributes)) {
      const { array, itemSize, count } = attribute;
      for (let triangle = 0; triangle < count; triangle += 3) {
        for (let component = 0; component < itemSize; component++) {
          const second = (triangle + 1) * itemSize + component;
          const third = (triangle + 2) * itemSize + component;
          const value = array[second];
          array[second] = array[third];
          array[third] = value;
        }
      }
    }
    const normal = geometry.getAttribute('normal');
    for (let index = 0; index < normal.count; index++) {
      normal.setXYZ(index, -normal.getX(index), -normal.getY(index), -normal.getZ(index));
    }
    if (!convertedMaterials.has(mesh.material)) {
      const material = mesh.material.clone();
      material.name = 'Placeholder character | inverted ink hull';
      material.side = FrontSide;
      convertedMaterials.set(mesh.material, material);
    }
    mesh.geometry = geometry;
    mesh.material = convertedMaterials.get(mesh.material);
    mesh.userData.exportInverseHullBaked = true;
  });
}

export async function exportEntranceDesign() {
  const scene = new Scene();
  scene.name = 'Squabble Block | entrance design additions';
  scene.userData = {
    purpose: 'Additions only: redesigned entrances, replaceable hosts and authored arrival cameras.',
    sourceWorld: 'squabble-friendly-fades.blend / squabble-block.glb',
    coordinates: 'glTF Y-up, metres; Blender import performs the axis conversion.',
  };
  const entrances = [...LANDMARKS, ...EXTRA_ENTRANCES];
  const doors = createEntranceDoors(scene, entrances.map((location) => ({
    ...location.entry, id: location.id, name: location.name, color: location.color,
  })));
  const characters = createEntranceCharacters(scene, entrances.map((location) => ({
    ...location.host, id: location.id, name: location.name, color: location.color,
  })));
  characters.update(0);
  bakeInverseHulls(characters.group);

  // Reuse the exact collision triangles solely to settle the camera's feet.
  // This source world is never parented to the exported scene.
  const sourceWorld = loadWorldGeometry();
  const physics = createPhysics(sourceWorld);
  const still = new Vector3();
  const cameraLayout = [];
  for (const location of LANDMARKS) {
    const { arrival } = location;
    physics.teleport(new Vector3(...arrival.position));
    for (let step = 0; step < 48; step++) physics.move(still, 0, 1 / 120);
    if (!physics.grounded) throw new Error(`${location.name}: authored camera feet are not grounded.`);
    const feet = physics.position.clone();
    const rig = createFollowCameraRig();
    rig.aim(feet, arrival.yaw, arrival.pitch, 1, true, arrival);
    rig.place(arrival.distance, Infinity, 1, true);
    const camera = new PerspectiveCamera(arrival.fov ?? 58, 16 / 9, .06, 240);
    camera.name = `ARRIVAL | ${location.name}`;
    camera.position.copy(rig.position);
    camera.lookAt(rig.target);
    camera.rotateZ(arrival.roll ?? 0);
    camera.updateMatrixWorld(true);
    camera.userData = {
      locationId: location.id, shot: location.shot,
      settledFeet: feet.toArray(), lookAt: rig.target.toArray(),
      authoredRoll: arrival.roll ?? 0,
      note: 'Settled end of the browser arrival dolly. WASD or look input returns camera control.',
    };
    scene.add(camera);
    cameraLayout.push({
      id: location.id, name: camera.name, settledFeet: feet.toArray(),
      position: camera.position.toArray(), quaternion: camera.quaternion.toArray(),
      target: rig.target.toArray(), fov: camera.fov, aspect: camera.aspect,
      roll: arrival.roll ?? 0,
    });
  }
  scene.updateMatrixWorld(true);
  scene.traverse((object) => {
    if (!object.isMesh) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (Object.values(material).some((value) => value?.isTexture)) {
        throw new Error('The entrance additions export must contain zero image textures.');
      }
    }
  });

  const binary = await new GLTFExporter().parseAsync(scene, {
    binary: true, onlyVisible: true, trs: true, animations: [],
  });
  const buffer = Buffer.from(binary);
  if (buffer.toString('utf8', 0, 4) !== 'glTF' || buffer.readUInt32LE(4) !== 2) {
    throw new Error('Exporter did not produce a glTF 2.0 binary.');
  }
  const jsonLength = buffer.readUInt32LE(12);
  const gltf = JSON.parse(buffer.toString('utf8', 20, 20 + jsonLength));
  if ((gltf.images?.length ?? 0) !== 0) throw new Error('Unexpected embedded image in props export.');
  if ((gltf.cameras?.length ?? 0) !== LANDMARKS.length) throw new Error('An arrival camera was omitted.');
  const stats = {
    entrances: { ...doors.stats },
    placeholders: { ...characters.stats },
    export: {
      bytes: buffer.length, nodes: gltf.nodes?.length ?? 0,
      meshes: gltf.meshes?.length ?? 0, materials: gltf.materials?.length ?? 0,
      cameras: gltf.cameras?.length ?? 0, images: gltf.images?.length ?? 0,
      triangles: doors.stats.triangles + characters.stats.triangles,
    },
  };
  const propsPath = path.join(outputDir, 'squabble-entrance-design-props.glb');
  const layoutPath = path.join(outputDir, 'squabble-entrance-layout.json');
  const layout = {
    version: 1, createdAt: new Date().toISOString(),
    coordinates: 'glTF Y-up, metres; entry and host positions are feet/bottom centre.',
    sourceWorld: '../playable/public/assets/squabble-block.glb',
    propsFile: path.basename(propsPath),
    landmarks: LANDMARKS, extraEntrances: EXTRA_ENTRANCES,
    arrivalCameras: cameraLayout, stats,
  };
  await mkdir(outputDir, { recursive: true });
  await writeFile(propsPath, buffer);
  await writeFile(layoutPath, `${JSON.stringify(layout, null, 2)}\n`);
  console.log(JSON.stringify({ propsPath, layoutPath, stats }, null, 2));
  return { propsPath, layoutPath, stats };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await exportEntranceDesign();
}
