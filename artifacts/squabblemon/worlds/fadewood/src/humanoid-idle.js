import { AnimationClip, AnimationMixer, Bone, Group, Quaternion, QuaternionKeyframeTrack, Vector3, VectorKeyframeTrack, PropertyBinding } from 'three';
import sourceData from './relaxed-idle-source.json' with {type:'json'};
export const RELAXED_IDLE_NAME = 'Fadewood_Relaxed_Idle';
const CORE = ['spine','thighl','thighr','shinl','shinr','footl','footr','upperarml','upperarmr','forearml','forearmr','handl','handr'];
export const canonicalBoneName = name => String(name).toLowerCase().replace(/[^a-z0-9]/g,'');
function rigNode(data){const node=data.bone?new Bone():new Group();node.name=data.name;node.position.fromArray(data.position);node.quaternion.fromArray(data.quaternion);node.scale.fromArray(data.scale);for(const child of data.children)node.add(rigNode(child));return node;}
function boneMap(root){const map=new Map();root.traverse(node=>{if(node.isBone){const key=canonicalBoneName(node.name);if(map.has(key))throw new Error(`Ambiguous humanoid bone ${node.name}.`);map.set(key,node);}});return map;}
/** Fail closed rather than silently play tracks against a different upload. */
export function validateAdditionalAnimations(model, clips=[]){
 if(!Array.isArray(clips))throw new Error('Additional animations must be an array.');
 const names=new Set();
 for(const clip of clips){
  if(!clip?.isAnimationClip && !(clip instanceof AnimationClip))throw new Error('Additional animation must be an AnimationClip.');
  if(!clip.name||names.has(clip.name)||!Number.isFinite(clip.duration)||clip.duration<=0||!clip.tracks?.length)throw new Error(`Invalid or duplicate additional animation ${clip.name}.`);names.add(clip.name);
  for(const track of clip.tracks){const binding=PropertyBinding.parseTrackName(track.name),node=PropertyBinding.findNode(model,binding.nodeName);
   if(!node||!['quaternion','position','scale'].includes(binding.propertyName)||!track.times?.length||!Array.from(track.times).every(Number.isFinite)||!Array.from(track.values).every(Number.isFinite))throw new Error(`Additional animation ${clip.name} cannot bind ${track.name}.`);
   const width=binding.propertyName==='quaternion'?4:3;if(track.getValueSize()!==width||track.values.length!==track.times.length*width)throw new Error(`Invalid additional animation samples ${track.name}.`);
  }
 }
 return clips;
}
/** Retarget authored world-space rotation deltas relative to BOTH bind poses.
 * Target lengths/local offsets and unmapped fingers remain exactly their own.
 * Only the pelvis translation is proportionally transferred; cast grounding
 * anchors its horizontal motion and keeps the supporting sole on the curb.
 */
export function retargetRelaxedIdle(model,{name=RELAXED_IDLE_NAME,source=sourceData,sampleRate=30}={}){
 const donor=rigNode(source.rig),sourceBones=boneMap(donor),targetBones=boneMap(model);
 for(const key of CORE)if(!sourceBones.has(key)||!targetBones.has(key))throw new Error(`Relaxed idle requires humanoid bone ${key}.`);
 if(!Number.isFinite(sampleRate)||sampleRate<10||sampleRate>120)throw new Error('Invalid idle sampling rate.');
 donor.updateMatrixWorld(true);model.updateMatrixWorld(true);
 const decode = data => { const bytes=Uint8Array.from(atob(data),value=>value.charCodeAt(0));return new Float32Array(bytes.buffer); };
 const clipData=source.clip.encoding?{...source.clip,tracks:source.clip.tracks.map(track=>({...track,times:decode(track.times),values:decode(track.values)}))}:source.clip;
 const donorClip=AnimationClip.parse(clipData),mixer=new AnimationMixer(donor),action=mixer.clipAction(donorClip).play();
 const sourceRoot=donor.getWorldQuaternion(new Quaternion()),targetRoot=model.getWorldQuaternion(new Quaternion()),alignment=targetRoot.clone().multiply(sourceRoot.invert()).normalize(),inverseAlignment=alignment.clone().invert();
 const entries=[];
 for(const[key,target]of targetBones){const from=sourceBones.get(key);if(!from)continue;entries.push({key,target,from,sourceBindInverse:from.getWorldQuaternion(new Quaternion()).invert(),targetBind:target.getWorldQuaternion(new Quaternion()),values:[]});}
 const mapped=new Map(entries.map(entry=>[entry.target,entry])),localBind=new Map();model.traverse(node=>localBind.set(node,node.quaternion.clone()));
 const sourcePelvis=sourceBones.get('spine'),targetPelvis=targetBones.get('spine'),sourcePosition=sourcePelvis.getWorldPosition(new Vector3()),targetPosition=targetPelvis.position.clone();
 const sourceHeight=Math.abs(sourcePosition.y-donor.getWorldPosition(new Vector3()).y),targetHeight=Math.abs(targetPelvis.getWorldPosition(new Vector3()).y-model.getWorldPosition(new Vector3()).y),ratio=sourceHeight>1e-5?targetHeight/sourceHeight:1;
 const parentInverse=targetPelvis.parent.getWorldQuaternion(new Quaternion()).invert(),positionValues=[],times=[],steps=Math.max(2,Math.ceil(donorClip.duration*sampleRate));
 const delta=new Quaternion(),world=new Quaternion(),parentWorld=new Quaternion(),local=new Quaternion(),point=new Vector3();
 try{
  for(let frame=0;frame<=steps;frame++){
   const time=frame/steps*donorClip.duration;times.push(time);action.time=time===donorClip.duration?0:time;mixer.update(0);donor.updateMatrixWorld(true);
   const desired=new Map();
   for(const entry of entries){entry.from.getWorldQuaternion(delta).multiply(entry.sourceBindInverse);world.copy(alignment).multiply(delta).multiply(inverseAlignment).multiply(entry.targetBind).normalize();desired.set(entry.target,world.clone());}
   const resolved=new Map();
   function desiredWorld(node){if(!node)return new Quaternion();if(desired.has(node))return desired.get(node);if(resolved.has(node))return resolved.get(node);const value=desiredWorld(node.parent).clone().multiply(localBind.get(node)??node.quaternion);resolved.set(node,value);return value;}
   for(const entry of entries){parentWorld.copy(desiredWorld(entry.target.parent));local.copy(parentWorld).invert().multiply(desired.get(entry.target)).normalize();const previous=entry.values.length?new Quaternion().fromArray(entry.values,entry.values.length-4):null;if(previous&&previous.dot(local)<0)local.set(-local.x,-local.y,-local.z,-local.w);entry.values.push(...local.toArray());}
   sourcePelvis.getWorldPosition(point).sub(sourcePosition).applyQuaternion(alignment).multiplyScalar(ratio).applyQuaternion(parentInverse).add(targetPosition);positionValues.push(...point.toArray());
  }
  const tracks=entries.map(entry=>new QuaternionKeyframeTrack(`${entry.target.name}.quaternion`,times,entry.values));tracks.push(new VectorKeyframeTrack(`${targetPelvis.name}.position`,times,positionValues));
  const clip=new AnimationClip(name,donorClip.duration,tracks);
  clip.userData={retargeted:true,source:source.source,mappedBones:entries.length,targetBones:targetBones.size,unmappedTargetBones:[...targetBones].filter(([key])=>!sourceBones.has(key)).map(([,bone])=>bone.name),method:'world rotation delta from source bind, aligned into target bind; pelvis-only scaled translation',sampleRate};
  return{clip,report:clip.userData};
 }finally{mixer.stopAllAction();mixer.uncacheRoot(donor);donor.clear();}
}
