import { readFile } from 'node:fs/promises';
import { Group, Scene, Texture } from 'three';
import { createAnimeEnvironment } from '../src/anime-environment.js';
import { createEntranceDoors } from '../src/entrance-doors.js';
import { createCurbDetails } from '../src/curb-details.js';
import { createPhysics } from '../src/physics.js';
import { createPropColliders, removeLegacyCar } from '../src/prop-colliders.js';
import { loadNeighborhoodProps } from '../src/neighborhood-props.js';
import { PROP_PLACEMENTS } from '../src/prop-placements.js';
import { ENTRANCE_PROP_PLACEMENTS } from '../src/entrance-placements.js';
import { LANDMARKS, EXTRA_ENTRANCES } from '../src/landmarks.js';
import { loadWorldGeometry } from './world-geometry.js';
import { loadCpuGlb } from './helpers/verify-assets.mjs';
let prepared;
export function integratedGeometry(){return prepared??=(async()=>{
  const scene=new Scene(),world=loadWorldGeometry();scene.add(world);
  const environment=await createAnimeEnvironment({world,parent:scene,preserveParkBulletin:true,textures:{leaves:new Texture({width:1,height:1}),panorama:new Texture({width:1,height:1})}});
  const doors=createEntranceDoors(world,[...LANDMARKS,...EXTRA_ENTRANCES].map(item=>({...item.entry,id:item.id,name:item.name,color:item.color})));
  const curb=await createCurbDetails({world,parent:scene,textures:Array.from({length:3},()=>new Texture({width:1,height:1})),loader:{async loadAsync(url){return loadCpuGlb(await readFile(new URL('../public/assets/curb-details/'+url.split('/').at(-1),import.meta.url)));}}});
  removeLegacyCar(world);
  const props=await loadNeighborhoodProps({parent:scene,placements:[...PROP_PLACEMENTS,...ENTRANCE_PROP_PLACEMENTS],baseUrl:'/props/',loader:{async loadAsync(url){const file=url.split('/').at(-1);const folder=file==='oink-patrol.glb'?'entrance-cast':'props';return loadCpuGlb(await readFile(new URL(`../public/assets/${folder}/${file}`,import.meta.url)));}}});
  const proxies=createPropColliders(props.records),collisionRoot=new Group();scene.add(collisionRoot);collisionRoot.add(world,proxies.group,curb.collisionGroup);
  return{scene,world,curb,doors,environment,props,proxies,collisionRoot,physics:createPhysics(collisionRoot)};
})();}
