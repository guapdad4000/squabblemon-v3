import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { connectedComponents } from './anime-environment.js';
import { loadCharacterCast } from './character-cast.js';
import { createAmbientActions } from './ambient-actions.js';
import layout from './curb-layout.json' with { type: 'json' };
export const CURB_LAYOUT = Object.freeze(layout);
export const CURB_BOOTH_SOURCE = Object.freeze({ ...layout.booth, kind: 'portal', label: 'DeMario & Luigion' });
const FILES = ['safehouse-facade', 'demario-luigion-booth', 'booth-wood'];
const BASE_URL = import.meta.env?.BASE_URL ?? '/';
/** Move only the five source hoop parts; court paint and source geometry remain restorable. */
export function relocateParkHoop(world) {
  const changed=[],records=[],point=new THREE.Vector3(),center=new THREE.Vector3(),size=new THREE.Vector3(),normal=new THREE.Vector3();
  world?.updateWorldMatrix(true,true);
  world?.traverse(mesh=>{
    if(!mesh.isMesh||!mesh.name.replaceAll('_',' ').includes('13 FADE PARK'))return;
    const parts=connectedComponents(mesh.geometry,mesh.matrixWorld).filter(part=>{
      if(!part.triangleOffsets.length)return false;part.box.getCenter(center);part.box.getSize(size);
      return Math.abs(center.x-20.5)<.03&&center.y>1.8&&center.y<4.1&&center.z>-35.1&&center.z<-33.7&&size.x<1.8&&size.z<.8;
    });
    if(!parts.length)return;
    const original=mesh.geometry,replacement=original.clone(),inverse=mesh.matrixWorld.clone().invert();mesh.geometry=replacement;
    const positions=replacement.attributes.position,normals=replacement.attributes.normal;
    for(const part of parts){
      records.push({source:mesh.name,triangles:part.triangleOffsets.length,center:part.box.getCenter(new THREE.Vector3()).toArray()});
      for(const vertex of part.vertices){point.fromBufferAttribute(positions,vertex).applyMatrix4(mesh.matrixWorld);const dx=point.x-20.5,dz=point.z+35;point.x=23.2-dz;point.z=-31+dx;point.applyMatrix4(inverse);positions.setXYZ(vertex,point.x,point.y,point.z);
        if(normals){normal.fromBufferAttribute(normals,vertex);const nx=normal.x;normal.x=-normal.z;normal.z=nx;normals.setXYZ(vertex,normal.x,normal.y,normal.z);}}
    }
    positions.needsUpdate=true;if(normals)normals.needsUpdate=true;replacement.computeBoundingBox();replacement.computeBoundingSphere();changed.push({mesh,original,replacement});
  });
  return{records,restore(){for(const{mesh,original,replacement}of changed){mesh.geometry=original;replacement.dispose();}}};
}
/** Texture-led house and removable curb booth. No account/progression authority. */
export async function createCurbDetails({ world, parent, renderer, loader, textures, textureLoader = new THREE.TextureLoader() } = {}) {
  const owned = !textures, hidden = [];
  let hoop;
  if (!textures) {
    const results = await Promise.allSettled(FILES.map(name => textureLoader.loadAsync(`${BASE_URL}assets/curb-details/${name}.webp`)));
    const failed = results.find(result => result.status === 'rejected');
    if (failed) { results.forEach(result => { if (result.status === 'fulfilled') result.value.dispose(); }); throw failed.reason; }
    textures = results.map(result => result.value);
  }
  hoop=relocateParkHoop(world);
  world?.traverse(object => {
    if (!object.isMesh || object.userData?.locationId !== 'small-house') return;
    hidden.push({ object, visible: object.visible, noCollision: object.userData.noCollision });
    object.visible = false; object.userData.noCollision = true;
  });
  textures.forEach(texture => { texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = Math.min(4, renderer?.capabilities.getMaxAnisotropy() ?? 1); });
  if (textures[2]) textures[2].wrapS = textures[2].wrapT = THREE.MirroredRepeatWrapping;
  const group = new THREE.Group(); group.name = 'Fadewood | texture-led Safehouse and curb popup'; group.userData.noCollision = true;
  const geometries = [], materials = [];
  const material = (texture, transparent = false) => { const value = new THREE.MeshBasicMaterial({ map: texture, transparent, alphaTest: transparent ? .1 : 0 }); materials.push(value); return value; };
  const add = (parent, geometry, material, name) => { geometries.push(geometry); const mesh = new THREE.Mesh(geometry, material); mesh.name = name; mesh.userData.noCollision = true; parent.add(mesh); return mesh; };
  const facade = add(group, new THREE.PlaneGeometry(...layout.facade.size), material(textures[0]), 'Safehouse | one painted facade'); facade.position.fromArray(layout.facade.position); facade.userData.hostSourceId = 'safehouse-door';
  const booth = new THREE.Group(); booth.name = 'DeMario and Luigion | reversible curb popup'; booth.position.fromArray(layout.booth.position); booth.rotation.y = layout.booth.yaw; booth.userData.hostSourceId = layout.booth.id; group.add(booth);
  const parts = [], woodParts = [], color = new THREE.Color();
  const box = (size, position, tone, wood = false) => {
    const geo = new THREE.BoxGeometry(...size);
    if (wood) {
      const vertices = geo.attributes.position, normals = geo.attributes.normal, uv = geo.attributes.uv;
      for (let i = 0; i < vertices.count; i++) {
        const x = vertices.getX(i) + size[0] / 2, y = vertices.getY(i) + size[1] / 2, z = vertices.getZ(i) + size[2] / 2;
        const top = Math.abs(normals.getY(i)) > .5, end = Math.abs(normals.getX(i)) > .5;
        uv.setXY(i, (end ? z : x) / 3.2, (top ? z : y) / .4);
      }
      geo.translate(...position); woodParts.push(geo);
    } else {
      geo.translate(...position); color.set(tone);
      const colors = new Float32Array(geo.attributes.position.count * 3);
      for (let i = 0; i < colors.length; i += 3) color.toArray(colors, i);
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3)); parts.push(geo);
    }
  };
  box([3,1.08,1.2],[0,.54,0],'#172c28'); box([3.14,.12,1.35],[0,1.14,0],'#dfbc77',true); box([3,.12,.025],[0,.16,.612],'#e8d7a9',true);
  for (const x of [-1.48,1.48]) for (const z of [-.58,.68]) box([.07,3.2,.07],[x,1.6,z],'#243537');
  box([3.3,.13,1.6],[0,3.215,.05],'#c4b898',true); box([3.25,1.11,.05],[0,2.66,.82],'#17232c');
  const structure = mergeGeometries(parts); parts.forEach(part => part.dispose());
  const ink = new THREE.MeshBasicMaterial({ vertexColors: true }); materials.push(ink); add(booth, structure, ink, 'Popup | counter canopy and four narrow posts');
  const wood = mergeGeometries(woodParts); woodParts.forEach(part => part.dispose());
  add(booth, wood, material(textures[2]), 'Popup | approved wood counter roof and trim');
  const sign = add(booth,new THREE.PlaneGeometry(3.2,3.2/3),material(textures[1]),'Popup | painted joint-host sign'); sign.position.set(0,2.66,.855);
  const collisionGroup = new THREE.Group(); collisionGroup.name = 'Curb popup | one reversible collision proxy';
  const proxyGeometry = new THREE.BoxGeometry(...layout.booth.collisionSize), proxyMaterial = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const proxy = new THREE.Mesh(proxyGeometry,proxyMaterial); proxy.position.fromArray(layout.booth.position); proxy.position.y += layout.booth.collisionSize[1]/2; proxy.visible = false; proxy.userData.isPropCollider = true; collisionGroup.add(proxy);
  parent.add(group); group.updateMatrixWorld(true); collisionGroup.updateMatrixWorld(true);
  let disposed = false, hostCast = null, hostAmbient = null;
  function dispose() {
    if (disposed) return;
    disposed = true; hostAmbient?.dispose(); hostCast?.dispose(); hoop.restore();
    group.removeFromParent(); collisionGroup.removeFromParent();
    geometries.forEach(g=>g.dispose()); materials.forEach(m=>m.dispose());
    proxyGeometry.dispose(); proxyMaterial.dispose();
    if(owned) textures.forEach(t=>{t.dispose();t.source?.data?.close?.();});
    hidden.forEach(({object,visible,noCollision})=>{object.visible=visible;if(noCollision===undefined)delete object.userData.noCollision;else object.userData.noCollision=noCollision;});
  }
  try {
    if (loader) {
      hostCast = await loadCharacterCast(booth, { loader, placements: layout.booth.hosts.map(host=>({...host,locationId:layout.booth.id})), baseUrl: `${BASE_URL}assets/curb-details/` });
      hostAmbient = createAmbientActions({ cast: hostCast, placements: layout.booth.hosts.map(host => ({ ...host, locationId: layout.booth.id })) });
      hostAmbient.update(0);
      // Both visible rigs share the existing booth interaction, not new routes.
      hostCast.group.traverse(object=>{ delete object.userData.characterId; object.userData.hostSourceId=layout.booth.id; object.userData.noCollision=true; });
      // Refresh attached-skin bind inverses after the translated/rotated booth parent is installed.
      group.updateMatrixWorld(true);
    }
  } catch (error) { dispose(); throw error; }
  const stats = Object.freeze({ drawCalls: 4+(hostCast?.stats.drawCalls??0), triangles: geometries.reduce((sum,g)=>sum+(g.index?.count??g.attributes.position.count)/3,0)+(hostCast?.stats.triangles??0), textures: 3+(hostCast?.stats.textures??0), colliders: 1, colliderTriangles: 12, hosts: hostCast?.stats.characters??0, hostBones: hostCast?.records.reduce((sum,record)=>sum+record.bones,0)??0, hostClips: hostCast?.records.map(record=>({id:record.id,available:record.availableClips,active:record.clip,animated:record.animated}))??[] });
  return { group, collisionGroup, hoopChanges: hoop.records, getPortals: () => [CURB_BOOTH_SOURCE], stats,
    update(elapsedSeconds, options = {}) { if (!disposed) { hostAmbient?.update(elapsedSeconds, options); hostCast?.update(elapsedSeconds); } },
    sampleAmbient() { return hostAmbient?.sample() ?? []; },
    sampleMotion() { return hostCast?.sampleMotion()??[]; },
    dispose };
}
