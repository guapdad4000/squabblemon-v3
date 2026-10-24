import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { PackGymFinale, preloadPackGymFinale } from '../src/components/PackGymFinale';
import '../src/index.css';
const params = new URLSearchParams(location.search), ten = params.get('ten') === '1', reduced = params.get('reduced') === '1', rarity = params.get('rarity') ?? 'Common', sound = params.get('sound') === '1', skippable = params.get('skip') === '1', premount = params.get('premount') === '1';
function Fixture() {
 const frame = useRef<HTMLIFrameElement>(null), [active,setActive] = useState(false), [ready,setReady] = useState(false), [done,setDone] = useState(0), [speed,setSpeed] = useState(1), [skipped,setSkipped] = useState(0), [armed,setArmed] = useState(false);
 const send = (data: object) => frame.current?.contentWindow?.postMessage({channel:'squabblemon-scene',...data},location.origin);
 useEffect(() => { if(!reduced)preloadPackGymFinale(ten?10:1); const receive = (event: MessageEvent) => { if(event.source!==frame.current?.contentWindow)return; if(event.data.type==='ready'){setReady(true);send({type:'settings',sound,speed:1});} if(event.data.type==='complete')setActive(true); };window.addEventListener('message',receive);return()=>window.removeEventListener('message',receive); },[]);
 return <main style={{margin:0,background:'#0b100e',minHeight:'100dvh'}}><div id="arena" style={{position:'relative',overflow:'hidden',width:'100%',height:active?'100dvh':'min(78dvh,720px)',minHeight:280,background:'url(/assets/scenes/gatcha-bg/background.webp) center 60% / cover'}}>
  {!reduced&&<iframe ref={frame} title="Real pack gym" src="/scenes/gym/index.html?gpuTier=low" style={{position:'absolute',inset:0,width:'100%',height:'100%',border:0}}/>}
  {(active||(premount&&armed))&&<PackGymFinale active={active} pullCount={ten?10:1} reducedMotion={reduced} speed={speed} rarity={rarity} onSkip={skippable?()=>{send({type:'reset'});setActive(false);setArmed(false);setSkipped(value=>value+1);}:undefined} onComplete={()=>{setDone(value=>value+1);setActive(false);setArmed(false);}}/>}
 </div><button disabled={!ready&&!reduced} onClick={()=>{setArmed(true);send({type:'reset'});send({type:'arm',omen:rarity,targetHits:ten?9:3,hitsPerPunch:ten?3:1});setDone(0);if(reduced)setActive(true);}}>Arm</button><button onClick={()=>send({type:'punch'})}>Punch</button><button onClick={()=>{setActive(false);setArmed(false);}}>Unmount finale</button><button onClick={()=>{setSpeed(2);send({type:'settings',sound,speed:2});}}>Change speed</button><output aria-label="Completions">{done}</output><output aria-label="Skips">{skipped}</output></main>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
