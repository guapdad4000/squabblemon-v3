import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3, Raycaster, Texture, Scene, Box3 } from 'three';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { loadCpuGlb, parseGlb } from './helpers/verify-assets.mjs';
import { sourceAtVisibleHit } from '../src/world-sources.js';
import { hostDestination } from '../src/host-destinations.js';
import { createHostInteractions } from '../src/host-interactions.js';
import { Capsule } from 'three/addons/math/Capsule.js';
import { createCurbDetails, CURB_LAYOUT } from '../src/curb-details.js';
import { surfacePlacements } from '../src/anime-surfaces.js';
import { sampleAliceHat, STORY_PORTAL_PERIOD } from '../src/story-portals.js';
import { integratedGeometry } from './integrated-geometry.js';
import { loadWorldGeometry } from './world-geometry.js';

test('texture facade excludes the superseded door art and puts the painted door in a clear visible shot', async()=>{
 const {curb,scene,world}=await integratedGeometry();
 assert.ok(!surfacePlacements({textureLedSafehouse:true}).some(p=>p.name==='small-house painted doorway'));
 const old=[];world.traverse(o=>{if(o.isMesh&&o.userData.locationId==='small-house')old.push(o);});
 assert.equal(old.length,1);assert.equal(old[0].visible,false);assert.equal(old[0].userData.noCollision,true);
 const camera=new Vector3(...CURB_LAYOUT.facade.camera.position),target=new Vector3(...CURB_LAYOUT.facade.door);
 const hit=new Raycaster(camera,target.clone().sub(camera).normalize(),0,12).intersectObject(scene,true).find(h=>h.object.visible&&!h.object.userData.isPropCollider);
 assert.equal(hit?.object.userData.hostSourceId,'safehouse-door','the actual new door is visible before any mesh obstruction');
 assert.equal(curb.stats.drawCalls,6);assert.equal(curb.stats.colliders,1);
});
test('the joint booth has a grounded reachable approach and its one proxy blocks walking through the counter',async()=>{
 const {physics,curb}=await integratedGeometry(),start=new Vector3(7.7,.5,-3.6);
 physics.teleport(start);for(let i=0;i<48;i++)physics.move(new Vector3(),0,1/120);
 assert.ok(Math.abs(physics.position.x-start.x)<.01);assert.ok(physics.grounded);
 for(let i=0;i<160;i++)physics.move(new Vector3(1,0,0),3,1/60);
 assert.ok(physics.position.x<9.4,'counter proxy must stop the avatar before the booth body');
 assert.equal(curb.getPortals()[0].id,'demario-luigion-booth');
});
test('exactly five original hoop pieces move, court paint stays, and the operation restores original source geometry',async()=>{
 const world=loadWorldGeometry(),scene=new Scene();scene.add(world);const original=new Map();world.traverse(o=>{if(o.isMesh)original.set(o,o.geometry);});
 const curb=await createCurbDetails({world,parent:scene,textures:Array.from({length:3},()=>new Texture({width:1,height:1}))});
 assert.equal(curb.hoopChanges.length,5);assert.equal(curb.hoopChanges.reduce((s,r)=>s+r.triangles,0),184);
 assert.ok(curb.hoopChanges.every(r=>r.center[1]>1.8),'low court floor/lines cannot enter the relocation');
 curb.dispose();for(const[mesh,geometry]of original)assert.equal(mesh.geometry,geometry,'source geometry identity restores on teardown');
});
test('wide hat tour clears actual integrated solid geometry, booth and six prop proxies across a full loop',async()=>{
 const {physics}=await integratedGeometry(),octree=physics.colliders.octree,body=new Capsule(),brim=new Capsule();let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
 for(let time=0;time<=STORY_PORTAL_PERIOD;time+=.04){
  const pose=sampleAliceHat(time),[x,y,z]=pose.position;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minZ=Math.min(minZ,z);maxZ=Math.max(maxZ,z);
  body.radius=.55;body.start.set(x,y+.55,z);body.end.set(x,y+1.05,z);const hit=octree.capsuleIntersect(body);assert.ok(!hit||hit.depth<.01,`hat barrel crossed a solid at ${time}`);
  for(let i=0;i<16;i++){const a=i/16*Math.PI*2;brim.radius=.15;brim.start.set(x+Math.sin(a)*.74,y+.08,z+Math.cos(a)*.74);brim.end.copy(brim.start);brim.end.y+=.001;const hit=octree.capsuleIntersect(brim);assert.ok(!hit||hit.depth<.01,`hat brim crossed a solid at ${time}`);}
 }
 assert.ok(maxX-minX>17&&maxZ-minZ>68,'tour must cover both sides and the north end rather than the previous narrow ellipse');
});

const modelLoader = { async loadAsync(url) { return loadCpuGlb(await readFile(new URL('../public/assets/curb-details/'+url.split('/').at(-1),import.meta.url))); } };
test('supplied shared hosts retain exact GLB bytes, both rigs and every authored clip within the measured budget',async()=>{
 const expected=[['luigion.glb','0a863776f7527de47590b7933ffad1e76da1f4e5041d21770a97fbb3642c6bc1',3128,32,['Running','Walking']],['demario.glb','adc12b677dab768f98caedd914c592dc1c164bc6b3782519aa7532fa5b5d61af',3066,64,['Running','Walking','Walk_Turn_Right','Wave_One_Hand']]];
 let bytes=0;
 for(const[file,hash,triangles,joints,clips]of expected){
  const raw=await readFile(new URL('../public/assets/curb-details/'+file,import.meta.url)),{json}=parseGlb(raw);bytes+=raw.length;
  assert.equal(createHash('sha256').update(raw).digest('hex'),hash,'the supplied upload is delivered without resampling');
  assert.equal(json.meshes.length,1);assert.equal(json.meshes[0].primitives.length,1);assert.equal(json.skins[0].joints.length,joints);
  assert.equal(json.accessors[json.meshes[0].primitives[0].indices].count/3,triangles);assert.deepEqual(json.animations.map(a=>a.name),clips);
  assert.equal(json.images.length,3,'the complete supplied PBR master stays available');
 }
 assert.equal(bytes,1519712);
});
test('real booth hosts share direct picking, keep feet grounded, wave then rest, and release resources exactly once',async()=>{
 const scene=new Scene(),world=loadWorldGeometry();scene.add(world);
 const curb=await createCurbDetails({world,parent:scene,loader:modelLoader,textures:Array.from({length:3},()=>new Texture({width:1,height:1}))});
 assert.equal(curb.stats.hosts,2);assert.equal(curb.stats.drawCalls,6);assert.equal(curb.stats.hostBones,96);assert.equal(curb.stats.textures,5);
 assert.ok(curb.stats.triangles<6400);assert.equal(curb.stats.hostClips.find(h=>h.id==='luigion').animated,true);
 const hosts=curb.group.getObjectByName('Uploaded neighborhood character cast');assert.ok(hosts);
 const resources=new Set();hosts.traverse(o=>{if(o.geometry)resources.add(o.geometry);for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[]){resources.add(m);for(const value of Object.values(m))if(value?.isTexture)resources.add(value);}});
 const disposed=new Map();for(const resource of resources)resource.addEventListener('dispose',()=>disposed.set(resource,(disposed.get(resource)??0)+1));
 for(const host of hosts.children){
  const bounds=new Box3().setFromObject(host,true),center=bounds.getCenter(new Vector3());
  assert.ok(Math.abs(bounds.min.y-.261)<.0001,'normalization places the imported soles on the existing curb');
  const origin=center.clone().add(new Vector3(-3,0,0));const hit=new Raycaster(origin,center.clone().sub(origin).normalize(),0,6).intersectObject(curb.group,true)[0];
  assert.equal(sourceAtVisibleHit(hit),'demario-luigion-booth','clicking either real rig keeps the joint host action');
 }
 const initial=curb.sampleMotion();curb.update(.7);const waving=curb.sampleMotion();
 assert.notEqual(waving.find(h=>h.id==='demario').boneChecksum,initial.find(h=>h.id==='demario').boneChecksum);
 assert.notEqual(waving.find(h=>h.id==='luigion').boneChecksum,initial.find(h=>h.id==='luigion').boneChecksum,'the new idle breathes instead of freezing a walking frame');
 curb.update(4.5);const resting=curb.sampleMotion().find(h=>h.id==='demario');curb.update(9);const held=curb.sampleMotion().find(h=>h.id==='demario');
 assert.notEqual(resting.boneChecksum,held.boneChecksum,'the quiet interval uses a live breathing idle');
 curb.update(13);assert.equal(curb.sampleAmbient().find(h=>h.id==='demario').phase,'action');
 curb.update(18);assert.equal(curb.sampleAmbient().find(h=>h.id==='demario').phase,'idle');
 for(let t=0;t<12;t+=.1){curb.update(t);for(const m of curb.sampleMotion())assert.ok(Math.abs(m.footHeight)<.005,'cached sole support remains grounded during the full greeting');}
 const beforeDispose=curb.sampleMotion().map(m=>m.boneChecksum);curb.dispose();curb.dispose();curb.update(30);
 assert.equal(curb.group.parent,null);assert.equal(curb.collisionGroup.parent,null);assert.ok(resources.size>=6);
 for(const resource of resources)assert.equal(disposed.get(resource),1,'visible uploaded resources release exactly once');
 assert.deepEqual(curb.sampleMotion(),[]);assert.equal(beforeDispose.length,2);
});
test('a failed animated host load removes partial curb resources, and Safehouse arrival exposes its actual door interaction',async()=>{
 const scene=new Scene(),world=loadWorldGeometry();scene.add(world);const original=new Map();world.traverse(o=>{if(o.isMesh)original.set(o,o.geometry);});
 await assert.rejects(createCurbDetails({world,parent:scene,loader:{async loadAsync(){throw new Error('missing supplied host');}},textures:Array.from({length:3},()=>new Texture({width:1,height:1}))}),/missing supplied host/);
 assert.equal(scene.children.length,1);for(const[mesh,geometry]of original)assert.equal(mesh.geometry,geometry);
 const arrival=hostDestination('safehouse');assert.equal(arrival.arrivalId,'safehouse');assert.notDeepEqual(arrival.position,hostDestination('open-garage').position);
 const listeners=new Map(),interaction=createHostInteractions({window:{addEventListener(n,f){listeners.set(n,f);},removeEventListener(n){listeners.delete(n);}},kind:'portal',getRecords:()=>[{id:'safehouse-door',interactionPosition:CURB_LAYOUT.facade.interactionPosition,radius:3.1}],onInspect(){}});
 interaction.update(new Vector3(...arrival.position),0,{enabled:true});assert.equal(interaction.nearest.id,'safehouse-door');interaction.dispose();
});

test('all former beige booth surfaces share one approved wood texture with physical grain UVs',async()=>{
 const world=loadWorldGeometry(),scene=new Scene();scene.add(world);
 const textures=Array.from({length:3},()=>new Texture({width:1024,height:128}));
 const curb=await createCurbDetails({world,parent:scene,textures});
 const wood=curb.group.getObjectByName('Popup | approved wood counter roof and trim');
 assert.ok(wood?.isMesh);assert.equal(wood.material.map,textures[2]);assert.equal(wood.material.color.getHex(),0xffffff);
 assert.equal(wood.geometry.index.count/3,36,'counter, low strip and canopy remain three original boxes');
 const uv=wood.geometry.attributes.uv;assert.ok(Math.max(...uv.array)>3.9,'canopy grain repeats at authored physical scale');
 assert.ok(uv.array.every(Number.isFinite));assert.equal(textures[2].wrapS,textures[2].wrapT);
 assert.equal(curb.stats.drawCalls,4,'all timber surfaces add only one shared draw');
 assert.equal(curb.stats.textures,3);curb.dispose();
});
