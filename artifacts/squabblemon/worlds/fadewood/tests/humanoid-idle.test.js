import test from 'node:test';import assert from 'node:assert/strict';import {readFile}from'node:fs/promises';
import {AnimationClip,AnimationMixer,Bone,Group,Quaternion,QuaternionKeyframeTrack,Vector3,Scene,Box3,BoxGeometry,SkinnedMesh,Skeleton,MeshBasicMaterial,Float32BufferAttribute,Uint16BufferAttribute}from'three';
import{loadCpuGlb}from'./helpers/verify-assets.mjs';import{retargetRelaxedIdle,RELAXED_IDLE_NAME}from'../src/humanoid-idle.js';import{loadCharacterCast}from'../src/character-cast.js';
const loader={async loadAsync(path){return loadCpuGlb(await readFile(new URL('../public/assets/'+path,import.meta.url)));}};
const idle={clip:RELAXED_IDLE_NAME};
function snapshot(root){const data=[];root.traverse(o=>{if(o.isBone)data.push([o.name,...o.position.toArray(),...o.quaternion.toArray(),...o.scale.toArray()]);});return data;}
test('retarget uses both rest frames rather than copying local quaternions, and preserves unmapped anatomy',()=>{
 const names=['spine','thighL','thighR','shinL','shinR','footL','footR','upper_armL','upper_armR','forearmL','forearmR','handL','handR'];
 const target=new Group();target.rotation.y=Math.PI/2;const root=new Bone();root.name='spine';root.position.y=1;target.add(root);
 for(const name of names.slice(1)){const b=new Bone();b.name=name;b.position.y=.2;root.add(b);}const arm=target.getObjectByName('upper_armL');arm.quaternion.setFromAxisAngle(new Vector3(0,1,0),Math.PI/2);const finger=new Bone();finger.name='unmapped_artist_finger';finger.position.set(0,.3,0);finger.rotation.x=.37;arm.add(finger);
 const sourceArmRest=new Quaternion().setFromAxisAngle(new Vector3(1,0,0),Math.PI/2),animated=new Quaternion().setFromAxisAngle(new Vector3(0,0,1),Math.PI/2).multiply(sourceArmRest);
 const node=(name,quaternion=[0,0,0,1])=>({name,bone:true,position:name==='spine'?[0,1,0]:[0,.2,0],quaternion,scale:[1,1,1],children:[]});const sourceRoot=node('spine');sourceRoot.children=names.slice(1).map(name=>node(name,name==='upper_armL'?sourceArmRest.toArray():undefined));
 const source={source:{clip:'authored-test'},rig:{name:'Source',bone:false,position:[0,0,0],quaternion:[0,0,0,1],scale:[1,1,1],children:[sourceRoot]},clip:new AnimationClip('authored-test',2,[new QuaternionKeyframeTrack('upper_armL.quaternion',[0,1,2],[...sourceArmRest.toArray(),...animated.toArray(),...sourceArmRest.toArray()])]).toJSON()};
 const before=snapshot(target),{clip,report}=retargetRelaxedIdle(target,{source,sampleRate:30});assert.deepEqual(snapshot(target),before,'generation cannot alter the artist bind pose');assert.equal(report.mappedBones,13);assert.ok(report.unmappedTargetBones.includes(finger.name));
 const mixer=new AnimationMixer(target),action=mixer.clipAction(clip).play();action.time=1;mixer.update(0);target.updateMatrixWorld(true);
 const axis=new Vector3(0,1,0).applyQuaternion(arm.getWorldQuaternion(new Quaternion()));assert.ok(axis.distanceTo(new Vector3(0,0,1))<1e-5,'source world-Z rotation becomes target world-X motion after the rig-frame turn');assert.equal(finger.rotation.x,.37,'unmapped finger keeps its own local pose');mixer.uncacheRoot(target);
});
test('real uploaded humanoid idles remain planted, anatomically bounded and continuous across repeated loops',async()=>{
 for(const asset of['curb-details/demario.glb','curb-details/luigion.glb','residents/mailman.glb']){
  const cast=await loadCharacterCast(new Scene(),{loader,baseUrl:'',placements:[{id:'host',asset,position:[2,.261,3],height:1.8,idle,animation:{clip:RELAXED_IDLE_NAME,loop:true}}]});
  assert.ok(cast.records[0].availableClips.includes(RELAXED_IDLE_NAME));assert.equal(cast.records[0].registeredIdle.source.clip,'Short_Breathe_and_Look_Around');assert.ok(cast.records[0].registeredIdle.mappedBones>=26);
  const geometry=[];cast.group.traverse(o=>{if(o.geometry)geometry.push(o.geometry);});let disposals=0;for(const g of geometry)g.addEventListener('dispose',()=>disposals++);
  cast.update(0);const start=cast.sampleMotion()[0],duration=start.duration;let activity=0;
  for(let frame=1;frame<=duration*60*2;frame++){cast.update(frame/60);const motion=cast.sampleMotion()[0];activity+=motion.activity;assert.ok(Math.abs(motion.footHeight-.261)<.001);assert.ok(Math.hypot(...motion.rootOffset)<1e-5);const bounds=new Box3().setFromObject(cast.group,true),size=bounds.getSize(new Vector3());assert.ok(Math.abs(bounds.min.y-.261)<.003,'actual shoe skin stays planted');assert.ok(size.x<1.2&&size.z<1.2&&size.y<2,'breathing cannot become a stretch, stride or exploded rig');}
  assert.ok(activity>.5,'idle has continuous real bone motion');
  cast.update(duration-1/240);const end=cast.sampleMotion()[0];cast.update(duration+1/240);const next=cast.sampleMotion()[0];assert.ok(Math.abs(end.boneChecksum-next.boneChecksum)<5,'loop boundary stays within a normal small-frame movement');
  cast.dispose();cast.dispose();cast.update(100);assert.equal(disposals,geometry.length);assert.deepEqual(cast.sampleMotion(),[]);
 }
});
test('registration fails explicitly on non-humanoid or missing core bones while partial finger mappings remain supported',async()=>{
 const gltf=await loader.loadAsync('curb-details/luigion.glb'),before=snapshot(gltf.scene);gltf.scene.getObjectByName('footL').name='missing_artist_foot';assert.throws(()=>retargetRelaxedIdle(gltf.scene),/requires humanoid bone footl/);gltf.scene.getObjectByName('missing_artist_foot').name='footL';assert.deepEqual(snapshot(gltf.scene),before);
 assert.throws(()=>retargetRelaxedIdle(new Group()),/requires humanoid bone/);
});
function oneBone(){const scene=new Group(),bone=new Bone();bone.name='Body';const geometry=new BoxGeometry(1,2,1),count=geometry.attributes.position.count;geometry.translate(0,1,0);geometry.setAttribute('skinIndex',new Uint16BufferAttribute(new Uint16Array(count*4),4));const weights=new Float32Array(count*4);for(let i=0;i<count;i++)weights[i*4]=1;geometry.setAttribute('skinWeight',new Float32BufferAttribute(weights,4));const mesh=new SkinnedMesh(geometry,new MeshBasicMaterial());mesh.add(bone);mesh.bind(new Skeleton([bone]));scene.add(mesh);const hold=new AnimationClip('Hold',1,[new QuaternionKeyframeTrack('Body.quaternion',[0,1],[0,0,0,1,0,0,0,1])]);return{scene,animations:[hold]};}
test('additional original-rig clips validate their targets, play native clamped one-shots, and restart without wrapping',async()=>{
 const asset=oneBone(),q=new Quaternion().setFromAxisAngle(new Vector3(0,0,1),.6),one=new AnimationClip('AuthoredTransition',1,[new QuaternionKeyframeTrack('Body.quaternion',[0,1],[0,0,0,1,...q.toArray()])]);
 const options={loader:{loadAsync:async()=>asset},baseUrl:'/',placements:[{id:'host',asset:'host.glb',position:[0,0,0],height:1.8,animation:{clip:'Hold',loop:true}}]};
 const cast=await loadCharacterCast(new Scene(),{...options,additionalAnimations:{host:[one]}});assert.ok(cast.records[0].availableClips.includes(one.name));assert.equal(cast.setAnimation('host',one.name,{loop:false,clampWhenFinished:true,restart:true,fadeDuration:0}),true);cast.update(1.5);const end=cast.sampleMotion()[0];assert.equal(end.playhead,1);cast.update(2.5);assert.equal(cast.sampleMotion()[0].boneChecksum,end.boneChecksum,'one-shot holds its authored final frame');
 cast.setAnimation('host',one.name,{loop:false,clampWhenFinished:true,restart:true,fadeDuration:0});cast.update(2.75);assert.ok(Math.abs(cast.sampleMotion()[0].playhead-.25)<1e-6);cast.dispose();
 const bad=new AnimationClip('InvalidRig',1,[new QuaternionKeyframeTrack('MissingArm.quaternion',[0,1],[0,0,0,1,0,0,0,1])]);await assert.rejects(loadCharacterCast(new Scene(),{...options,loader:{loadAsync:async()=>oneBone()},additionalAnimations:{host:[bad]}}),/cannot bind MissingArm/);
 await assert.rejects(loadCharacterCast(new Scene(),{...options,additionalAnimations:{wrongId:[one]}}),/unknown character wrongId/);
});

test('every supplied humanoid rig can receive the body idle without changing its rest pose or limb lengths',async()=>{
 const assets=['characters-mobile/og-blue-compressed.glb','characters-mobile/og-red-compreseed.glb','characters-mobile/ganger-blue-compressed.glb','characters-mobile/squabblehouse-manager-compressed.glb','characters-mobile/inmate-kingpin-compressed.glb','entrance-cast/snitch.glb','entrance-cast/cracked-head.glb','entrance-cast/officer-oinkston.glb','residents/dr-fade.glb','residents/blue-yb.glb'];
 for(const asset of assets){const gltf=await loader.loadAsync(asset),before=snapshot(gltf.scene),{clip,report}=retargetRelaxedIdle(gltf.scene);assert.deepEqual(snapshot(gltf.scene),before,asset);if(report.targetBones===28){assert.equal(report.mappedBones,23,asset);assert.deepEqual(report.unmappedTargetBones.sort(),['LeftHand_End','LeftToe_end','RightHand_End','RightToe_end','head_end'].sort());}else assert.ok(report.mappedBones>=26,asset);const mixer=new AnimationMixer(gltf.scene),action=mixer.clipAction(clip).play();for(const fraction of[0,.25,.5,.75]){action.time=clip.duration*fraction;mixer.update(0);gltf.scene.updateMatrixWorld(true);const bounds=new Box3().setFromObject(gltf.scene,true),size=bounds.getSize(new Vector3());assert.ok(size.toArray().every(Number.isFinite)&&size.y>.8&&size.y<3&&size.x<2.3&&size.z<2,'retarget cannot explode '+asset);}mixer.stopAllAction();mixer.uncacheRoot(gltf.scene);}
});

test('an explicit local action seek survives a real OG rewind after nonzero action switches and resumes by delta',async()=>{
 const pack=await loader.loadAsync('ambient/og-blue.glb');
 const cast=await loadCharacterCast(new Scene(),{loader,baseUrl:'',additionalAnimations:{'og-blue':pack.animations},placements:[{id:'og-blue',asset:'characters-mobile/og-blue-compressed.glb',position:[0,.261,0],height:2,idle,animation:{clip:RELAXED_IDLE_NAME,loop:true}}]});
 cast.update(30);cast.setAnimation('og-blue','push_up',{seek:true,time:4.2,loop:true,fadeDuration:0});cast.update(35);let state=cast.sampleMotion()[0];assert.ok(Math.abs(state.playhead-1.2)<1e-5,'repeating seek uses clip duration, not schedule duration');
 cast.setAnimation('og-blue',RELAXED_IDLE_NAME,{seek:true,time:2.8,loop:true,fadeDuration:0});cast.update(45);
 cast.setAnimation('og-blue','push_up_to_idle',{seek:true,time:.9,loop:false,clampWhenFinished:true,fadeDuration:0});cast.update(40);state=cast.sampleMotion()[0];assert.equal(state.clip,'push_up_to_idle');assert.ok(Math.abs(state.playhead-.9)<1e-6,'backwards cast clock must not replay forty seconds into the selected one-shot');
 cast.update(40.1);assert.ok(Math.abs(cast.sampleMotion()[0].playhead-1)<1e-5,'next frame resumes from the requested local playhead');
 cast.update(44);const end=cast.sampleMotion()[0];assert.equal(end.playhead,end.duration);
 cast.setAnimation('og-blue','push_up_to_idle',{seek:true,time:.25,loop:false,clampWhenFinished:true,fadeDuration:0});cast.update(41);assert.ok(Math.abs(cast.sampleMotion()[0].playhead-.25)<1e-6,'same-clip seek reactivates a completed native LoopOnce action');cast.update(41.1);assert.ok(Math.abs(cast.sampleMotion()[0].playhead-.35)<1e-5);
 cast.setAnimation('og-blue','push_up_to_idle',{seek:true,time:100,loop:false,clampWhenFinished:true,fadeDuration:0});cast.update(41.1);assert.equal(cast.sampleMotion()[0].playhead,end.duration,'one-shot seek clamps instead of wrapping');
 assert.equal(cast.setAnimation('og-blue','push_up',{seek:true,time:NaN}),false);cast.dispose();
});
