import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Box3,Group,Scene} from 'three';
import {loadCpuGlb,parseGlb,viewBytes} from './helpers/verify-assets.mjs';
import {loadCharacterCast} from '../src/character-cast.js';
import {CHARACTER_PLACEMENTS} from '../src/character-placements.js';
import {AMBIENT_PACKS,AMBIENT_SCHEDULES,createAmbientActions,loadAmbientAnimations,sampleAmbientAction} from '../src/ambient-actions.js';
const assets=new URL('../public/assets/',import.meta.url),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const loader={async loadAsync(url){return loadCpuGlb(await readFile(new URL(url,assets)));}};
test('ambient packs contain only exact authored animation bytes and the unchanged original rest nodes',async()=>{
 const audit=JSON.parse(await readFile(new URL('ambient/provenance.json',assets),'utf8'));
 assert.equal(audit.assets.length,5);assert.equal(audit.totalBytes,993872);
 for(const record of audit.assets){
  const raw=await readFile(new URL('ambient/'+record.file,assets));assert.equal(sha(raw),record.sha256);
  const pack=parseGlb(raw),modelRaw=await readFile(new URL('characters-mobile/'+record.runtimeModel.split('/').at(-1),assets));
  assert.equal(sha(modelRaw),record.runtimeModelSha256);
  const source=parseGlb(modelRaw).json;
  assert.ok(!pack.json.meshes&&!pack.json.images&&!pack.json.materials&&!pack.json.skins);
  assert.deepEqual(pack.json.animations.map(a=>a.name),record.clips);
  assert.deepEqual(pack.json.nodes,source.nodes.map(node=>{const value={...node};delete value.mesh;delete value.skin;return value;}));
  const hashes=Object.values(record.sourceAccessorSha256);
  pack.json.accessors.forEach((_,index)=>assert.equal(sha(viewBytes(pack,pack.json.accessors[index].bufferView)),hashes[index]));
 }
});
test('both OGs have a complete authored lower, push-up and stand-up sequence with quiet intervals',()=>{
 for(const id of ['og-blue','og-red']){
  const schedule=AMBIENT_SCHEDULES[id],names=schedule.map(s=>s.clip);
  assert.ok(names.indexOf('idle_to_push_up')<names.indexOf('push_up'));
  assert.ok(names.indexOf('push_up')<names.indexOf('push_up_to_idle'));
  assert.ok(schedule.filter(s=>s.idle).length>=3);
  const duration=schedule.reduce((sum,s)=>sum+s.seconds,0);
  for(let t=0;t<duration*3;t+=.1){const pose=sampleAmbientAction(id,t);assert.ok(pose.local>=0&&pose.local<=pose.seconds+.001);}
  assert.equal(sampleAmbientAction(id,duration).index,0);
 }
});
function fixture(){const group=new Group(),calls=[];for(const id of ['og-blue','demario']){const actor=new Group();actor.userData.characterId=id;actor.position.set(0,.261,0);group.add(actor);}return{cast:{group,setAnimation(...args){calls.push(args);return true;}},calls,placements:[{id:'og-blue',locationId:'blue-block'},{id:'demario',locationId:'demario-luigion-booth'}]};}
test('approach, focus and reduced motion settle actors into idle without repeating animation commands',()=>{
 const f=fixture(),ambient=createAmbientActions(f);
 ambient.update(0);ambient.update(10);assert.equal(ambient.sample().find(s=>s.id==='og-blue').phase,'action');
 ambient.update(10.1,{playerPosition:[1,.261,1]});assert.equal(ambient.sample().find(s=>s.id==='og-blue').phase,'idle');
 const count=f.calls.length;ambient.update(10.2,{playerPosition:[1,.261,1]});assert.equal(f.calls.length,count);
 ambient.update(13,{activeCharacterId:'demario-luigion-booth'});assert.equal(ambient.sample().find(s=>s.id==='demario').phase,'idle');
 ambient.update(30,{reducedMotion:true});assert.ok(ambient.sample().every(s=>s.phase==='idle'));
 ambient.dispose();ambient.dispose();const done=f.calls.length;ambient.update(99);assert.equal(f.calls.length,done);assert.deepEqual(ambient.sample(),[]);
});
test('animation-only loading is bounded to two requests and returns all five actor libraries',async()=>{
 let active=0,peak=0;const calls=[];
 const result=await loadAmbientAnimations({async loadAsync(url){calls.push(url);peak=Math.max(peak,++active);await Promise.resolve();active--;return{animations:[{name:url}]};}},{baseUrl:'/packs/'});
 assert.equal(peak,2);assert.equal(calls.length,5);assert.deepEqual(Object.keys(result).sort(),[...AMBIENT_PACKS].sort());
});
test('real OG rigs play the whole push-up routine without drifting, stretching or sinking through the curb',async()=>{
 const extras=await loadAmbientAnimations(loader,{baseUrl:'ambient/'});
 for(const id of ['og-blue','og-red']){
  const placement=CHARACTER_PLACEMENTS.find(p=>p.id===id),cast=await loadCharacterCast(new Scene(),{loader,placements:[placement],baseUrl:'characters-mobile/',additionalAnimations:{[id]:extras[id]}});
  const ambient=createAmbientActions({cast,placements:[placement]});let sawPushup=false,sawStand=false,minHeight=Infinity;
  for(let t=0;t<92;t+=.35){
   ambient.update(t);cast.update(t);const state=ambient.sample()[0],pose=cast.sampleMotion()[0];
   sawPushup||=state.clip==='push_up';sawStand||=state.clip==='push_up_to_idle';
   const bounds=new Box3().setFromObject(cast.group,true);minHeight=Math.min(minHeight,bounds.min.y);
   assert.ok(bounds.max.x-bounds.min.x<2.8&&bounds.max.z-bounds.min.z<2.8,'authored limbs stay within the checked training area');
   assert.ok(bounds.min.y>=placement.position[1]-.06,'hands and soles remain at the curb surface');
   assert.ok(pose.rootOffset.every(v=>Math.abs(v)<.002),'no root-motion drift');
   assert.ok(Math.abs(pose.footHeight-placement.position[1])<.006,'the supporting sole remains grounded');
  }
  assert.ok(sawPushup&&sawStand);assert.ok(Number.isFinite(minHeight));ambient.dispose();cast.dispose();
 }
});

test('approaching a push-up uses the authored getting-up clip; active inspection settles immediately',()=>{
 const f=fixture(),ambient=createAmbientActions(f);
 ambient.update(31);assert.equal(ambient.sample().find(s=>s.id==='og-blue').clip,'push_up');
 ambient.update(31.1,{playerPosition:[1,.261,1]});assert.equal(ambient.sample().find(s=>s.id==='og-blue').phase,'settle');
 assert.equal(f.calls.at(-1)[2].loop,false);
 ambient.update(34.3,{playerPosition:[1,.261,1]});assert.equal(ambient.sample().find(s=>s.id==='og-blue').phase,'idle');
 ambient.update(0);ambient.update(31);ambient.update(31.1,{activeCharacterId:'og-blue'});assert.equal(ambient.sample().find(s=>s.id==='og-blue').phase,'idle');ambient.dispose();
});
test('real action phases survive missed frames and backward seeks at their correct local playhead',async()=>{
 const placement=CHARACTER_PLACEMENTS.find(p=>p.id==='og-blue'),extras=await loadAmbientAnimations(loader,{baseUrl:'ambient/'});
 const cast=await loadCharacterCast(new Scene(),{loader,placements:[placement],baseUrl:'characters-mobile/',additionalAnimations:{'og-blue':extras['og-blue']}}),ambient=createAmbientActions({cast,placements:[placement]});
 for(const time of [0,35,45,40]){ambient.update(time);cast.update(time);}
 const stage=ambient.sample()[0],pose=cast.sampleMotion()[0];
 assert.equal(stage.clip,'push_up_to_idle');assert.ok(Math.abs(stage.local-pose.playhead)<.0001);
 ambient.update(40.1);cast.update(40.1);assert.ok(Math.abs(cast.sampleMotion()[0].playhead-stage.local-.1)<.0001);
 ambient.dispose();cast.dispose();
});
