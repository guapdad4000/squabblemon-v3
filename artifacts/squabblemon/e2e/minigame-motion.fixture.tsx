import { Profiler, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AnimatedSprite } from '../src/components/fadecade/AnimatedSprite';
import { arcadeSpriteAnimation, waffleSpriteAnimation, stockzSpriteAnimation, blockSpriteAnimation, roadSpriteAnimation } from '../src/components/fadecade/motionSpriteCatalog';
import '../src/index.css';
let commits = 0;
Object.defineProperty(window, '__spriteCommits', { get: () => commits });
const names = [0,1,2].flatMap(i => ['front','back'].flatMap(view => ['', '-jab-left', '-jab-right', '-uppercut', '-duck'].map(move => `girl-${i}-${view}${move}`)));
const animations = [
 ...names.map(name => ({ name, animation: arcadeSpriteAnimation(name)! })),
 ...['market-doctor-north','market-punch-north','market-cashier','market-restock','market-yn-0','market-yn-1'].map(name => ({name,animation:arcadeSpriteAnimation(name)!})),
 ...['pigeon-idle','pigeon-hop','pigeon-attack','pigeon-back','pigeon-syrup','pigeon-hurt','staff-0','staff-1','staff-2','staff-3'].map(name=>({name,animation:waffleSpriteAnimation(name)!})),
 ...['idle','waiting','win','miss'].map(mood=>({name:`stockz-${mood}`,animation:stockzSpriteAnimation(mood as 'idle')})),
 ...[0,1,2].map(crew=>({name:`block-${crew}`,animation:blockSpriteAnimation(crew)})),
 ...[false,true].map(defeated=>({name:`road-${defeated?'defeat':'idle'}`,animation:roadSpriteAnimation(defeated)})),
];
function Review() {
 const [paused,setPaused]=useState(false),[reduced,setReduced]=useState(false);
 return <main data-reduce-motion={reduced} style={{padding:20,background:'#10231e',color:'#ffedba'}}>
 <h1>CHALLENGE MOTION · 220 ART FRAMES</h1>
 <button onClick={()=>setPaused(v=>!v)}>Pause sprites</button>{' '}
 <button onClick={()=>setReduced(v=>!v)}>Reduced motion</button>
 <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12}}>
 {animations.map(({name,animation})=><figure key={name} style={{margin:0,padding:10,background:'#20352f'}}>
 <AnimatedSprite defer name={name} animation={{...animation,loop:true}} paused={paused} style={{width:'100%',height:210}} fallback="/assets/arcade-games/girl-0-front.webp"/>
 <figcaption style={{fontSize:12}}>{name}</figcaption></figure>)}
 </div></main>;
}
createRoot(document.getElementById('root')!).render(<Profiler id="sprites" onRender={()=>commits++}><Review/></Profiler>);
