import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createStreetLighting, NIGHT_BACKDROP_URLS } from '../src/street-lighting.js';
import { createAnimeEnvironment } from '../src/anime-environment.js';
import { createHostBridge, CHANNEL } from '../src/host-bridge.js';

const texture = () => new THREE.Texture({ width: 2172, height: 724 });
function fixture(loadAsync = async () => texture()) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#4eafce'); scene.fog = new THREE.Fog('#7da9b6',64,150);
  const world = new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial({ color: '#d7b578' }));
  const portrait = new THREE.Mesh(new THREE.PlaneGeometry(),new THREE.MeshBasicMaterial({ color: '#ffffff' }));
  portrait.userData.nightArtwork = true;
  scene.add(world,portrait);
  const applied = [], statuses = [];
  const environment = { setBackdrop: (...maps) => applied.push(maps), restoreBackdrop: () => applied.push('day') };
  const lighting = createStreetLighting({scene,environment,textureLoader:{loadAsync},onStatus:value=>statuses.push(value)});
  return {scene,world,portrait,applied,statuses,lighting};
}
test('night artwork loads only on intent; daylight restores exact colors and releases the night pair',async()=>{
  const loaded=[];
  const f=fixture(async url=>{const map=texture();map.userData.url=url;loaded.push(map);return map;});
  const sky=f.scene.background.clone(),fog=f.scene.fog.color.clone(),color=f.world.material.color.clone();
  assert.equal(loaded.length,0);
  await f.lighting.setNight(false); assert.equal(loaded.length,0);
  await f.lighting.setNight(true);
  assert.equal(f.lighting.night,true);assert.equal(loaded.length,2);
  assert.deepEqual(loaded.map(t=>t.userData.url),NIGHT_BACKDROP_URLS);
  assert.notEqual(f.scene.background.getHex(),sky.getHex());
  assert.notDeepEqual(f.world.material.color.toArray(),color.toArray());
  assert.deepEqual(f.portrait.material.color.toArray(),[1,1,1],'painted night skyline is not tinted twice');
  let disposed=0;loaded.forEach(t=>t.addEventListener('dispose',()=>disposed++));
  await f.lighting.setNight(false);
  assert.equal(disposed,2);assert.equal(f.lighting.night,false);
  assert.deepEqual(f.scene.background.toArray(),sky.toArray());assert.deepEqual(f.scene.fog.color.toArray(),fog.toArray());
  assert.deepEqual(f.world.material.color.toArray(),color.toArray());
  f.lighting.dispose();
});
test('daylight cancellation during a load cannot apply a stale night sky',async()=>{
  const resolves=[],loaded=[];
  const f=fixture(()=>new Promise(resolve=>resolves.push(resolve)));
  const pending=f.lighting.setNight(true);
  assert.equal(f.statuses.at(-1).status,'loading');
  await f.lighting.setNight(false);
  let disposed=0;
  resolves.forEach(resolve=>{const t=texture();loaded.push(t);t.addEventListener('dispose',()=>disposed++);resolve(t);});
  await pending;
  assert.equal(f.lighting.night,false);assert.equal(disposed,2);
  assert.equal(f.applied.filter(Array.isArray).length,0);
  assert.equal(f.statuses.at(-1).requestedNight,false);
  f.lighting.dispose();
});
test('a newer night request shares an in-flight load and owns its final result',async()=>{
  const resolves=[];const f=fixture(()=>new Promise(resolve=>resolves.push(resolve)));
  const old=f.lighting.setNight(true);await f.lighting.setNight(false);const latest=f.lighting.setNight(true);
  assert.equal(resolves.length,2,'at most one pair is loaded during rapid changes');
  resolves.forEach(resolve=>resolve(texture()));
  await Promise.all([old,latest]);
  assert.equal(f.lighting.night,true);assert.equal(f.applied.filter(Array.isArray).length,1);
  assert.equal(f.statuses.at(-1).status,'ready');f.lighting.dispose();
});
test('a missing night asset releases partial resources and leaves exploration in daylight',async()=>{
  let disposed=0;const good=texture();good.addEventListener('dispose',()=>disposed++);
  const f=fixture(url=>url.includes('night-panorama')?Promise.resolve(good):Promise.reject(new Error('offline')));
  const day=f.scene.background.getHex();await f.lighting.setNight(true);
  assert.equal(f.lighting.night,false);assert.equal(f.scene.background.getHex(),day);assert.equal(disposed,1);
  assert.equal(f.statuses.at(-1).status,'error');assert.equal(f.statuses.at(-1).requestedNight,true);
  assert.equal(f.applied.length,0);f.lighting.dispose();
});
test('unmount disposes late maps without emitting or applying a late theme',async()=>{
  const resolves=[];const f=fixture(()=>new Promise(resolve=>resolves.push(resolve)));
  const pending=f.lighting.setNight(true);f.lighting.dispose();const count=f.statuses.length;
  let disposed=0;resolves.forEach(resolve=>{const t=texture();t.addEventListener('dispose',()=>disposed++);resolve(t);});
  await pending;assert.equal(disposed,2);assert.equal(f.statuses.length,count);
  assert.equal(f.applied.filter(Array.isArray).length,0);
});
test('lighting commands retain same-origin and nonce validation and require actual booleans',()=>{
  const handlers=new Map(),commands=[],parent={postMessage(){}};
  const win={parent,location:{href:'https://game.test/?host=1',origin:'https://game.test'},addEventListener:(name,fn)=>handlers.set(name,fn),removeEventListener:name=>handlers.delete(name)};
  const bridge=createHostBridge({window:win,onCommand:c=>commands.push(c)});
  const send=(data,override={})=>handlers.get('message')({...{source:parent,origin:win.location.origin,data:{channel:CHANNEL,version:1,instanceId:'world',...data}},...override});
  send({type:'init',reducedMotion:false,night:'night'});assert.equal(commands.length,0);
  send({type:'init',reducedMotion:false,night:true});assert.equal(commands.at(-1).night,true);
  send({type:'lighting',night:'false'});send({type:'lighting',night:false,instanceId:'other'});send({type:'lighting',night:false},{source:{}});
  assert.equal(commands.length,1);
  send({type:'lighting',night:false});assert.deepEqual(commands.at(-1),{type:'lighting',night:false});
  bridge.dispose();
});


test('lighting changes synchronize the real panorama rim while the menu pauses RAF, without resetting foliage time', async () => {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#4eafce');
  scene.fog = new THREE.Fog('#7da9b6', 64, 150);
  const world = new THREE.Group(); scene.add(world);
  const environment = await createAnimeEnvironment({ world, parent: scene,
    textures: { leaves: texture(), panorama: texture(), neighborhood: texture() } });
  const panorama = environment.group.getObjectByName('Fadewood | painted skyline at 133 metres');
  const leaves = environment.group.getObjectByName('Fadewood | layered painted leaf clusters');
  const skyShader = { uniforms: {}, fragmentShader: THREE.ShaderLib.basic.fragmentShader };
  const leafShader = { uniforms: {}, vertexShader: THREE.ShaderLib.basic.vertexShader, fragmentShader: THREE.ShaderLib.basic.fragmentShader };
  panorama.material.onBeforeCompile(skyShader);
  leaves.material.onBeforeCompile(leafShader);
  environment.update(17.25);
  // The real help menu is an overlay: there is no RAF update before its one-off render.
  environment.update = () => { throw new Error('a paused lighting change must not advance/reset foliage animation'); };
  const snapshots = [];
  const lighting = createStreetLighting({ scene, environment, textureLoader: { loadAsync: async () => texture() },
    onStatus: value => {
      snapshots.push({ status: value.status, night: value.night,
        rim: skyShader.uniforms.fadewoodPanoramaSky.value.getHexString(), sky: scene.background.getHexString() });
    } });
  const day = scene.background.clone();
  try {
    await lighting.setNight(true);
    assert.deepEqual(snapshots.at(-1), { status: 'ready', night: true, rim: '071c37', sky: '071c37' },
      'night maps and the solid sky have one matching rim on the paused render');
    assert.equal(leafShader.uniforms.fadewoodTime.value, 17.25);
    await lighting.setNight(false);
    assert.equal(snapshots.at(-1).rim, day.getHexString(), 'day restoration updates the same already-compiled uniform');
    assert.equal(snapshots.at(-1).rim, snapshots.at(-1).sky);
    assert.equal(leafShader.uniforms.fadewoodTime.value, 17.25);
  } finally {
    lighting.dispose(); environment.dispose();
  }
});
