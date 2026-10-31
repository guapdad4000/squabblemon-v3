/** Animation-only local-source extraction; supplied model/texture files stay unchanged. */
import {readFile,writeFile}from'node:fs/promises';
import {createHash}from'node:crypto';
import {loadCpuGlb}from'../tests/helpers/verify-assets.mjs';
const path=new URL('../public/assets/characters-mobile/yasuke-compressed.glb',import.meta.url);
const raw=await readFile(path),gltf=await loadCpuGlb(raw),clip=gltf.animations.find(c=>c.name==='Short_Breathe_and_Look_Around');
if(!clip)throw new Error('Local authored breathing idle missing.');
const bones=new Set();gltf.scene.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.bones.forEach(b=>bones.add(b));});
const retain=new Set();for(const bone of bones)for(let node=bone;node;node=node.parent)retain.add(node);
function node(o){return{name:o.name,bone:o.isBone===true,position:o.position.toArray(),quaternion:o.quaternion.toArray(),scale:o.scale.toArray(),children:o.children.filter(c=>retain.has(c)).map(node)};}
const selected=clip.clone();selected.tracks=selected.tracks.filter(t=>t.name.endsWith('.quaternion')||t.name==='spine.position');
const encodedClip=selected.toJSON();for(const track of encodedClip.tracks){track.times=Buffer.from(new Float32Array(track.times).buffer).toString('base64');track.values=Buffer.from(new Float32Array(track.values).buffer).toString('base64');}encodedClip.encoding='base64-float32-le';
const data={version:1,source:{path:'assets/characters-mobile/yasuke-compressed.glb',sha256:createHash('sha256').update(raw).digest('hex'),clip:'Short_Breathe_and_Look_Around',purpose:'Authored calm breathing/weight-shift, animation and bind hierarchy only; no geometry/images.'},rig:node(gltf.scene),joints:[...bones].map(b=>b.name),clip:encodedClip};
await writeFile(new URL('../src/relaxed-idle-source.json',import.meta.url),JSON.stringify(data)+'\n');
console.log({bytes:JSON.stringify(data).length,joints:bones.size,tracks:selected.tracks.length,duration:clip.duration,sourceSha:data.source.sha256});
