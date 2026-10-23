import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { applyOnlineCommand, type Seat } from '@workspace/squabblemon-engine/multiplayer';
import { MultiplayerBattle } from '../src/components/MultiplayerBattle';
import { effectsRoom, effectsView, effectsPlay } from './pvp-effects.scenarios';
import '../src/index.css';
import '../src/styles/multiplayer.css';

function Review() {
  const [room,setRoom]=useState(effectsRoom),[seat,setSeat]=useState<Seat>('player'),[key,setKey]=useState(0),[reduced,setReduced]=useState(false);
  const view=useMemo(()=>effectsView(room,seat),[room,seat]);
  const output=useRef<HTMLOutputElement>(null), host=useRef<HTMLDivElement>(null);
  const audit=useRef<{start:number;entries:unknown[];frames:number[]}>({start:performance.now(),entries:[],frames:[]});
  const write=(event:string,extra:Record<string,unknown>={})=>{
    const arena=host.current?.querySelector<HTMLElement>('[data-testid="battle-arena"]');
    const attack=arena?.querySelector<HTMLElement>('[data-testid="character-attack"]');
    const canvas=arena?.querySelector<HTMLElement>('canvas.special-move-canvas');
    const dead=arena?.querySelector<HTMLElement>('[data-testid="destroyed-card"]');
    const row={ms:Math.round(performance.now()-audit.current.start),event,actor:attack?.dataset.character??null,impact:attack?.dataset.impact??null,
      cards:arena?.querySelectorAll('[data-card-zone="board"]').length??0,death:!!dead,deathVisible:!!dead&&getComputedStyle(dead).display!=='none',
      ready:canvas?.dataset.ready,rate:canvas?.dataset.playbackRate,aura:arena?.querySelectorAll('[data-battle-media="squabble-aura"]').length??0,...extra};
    audit.current.entries.push(row);
    const frames=[...audit.current.frames].sort((a,b)=>a-b);
    if(output.current)output.current.textContent=JSON.stringify({localFixture:true,entries:audit.current.entries,frameSample:{count:frames.length,p95Ms:frames[Math.floor(frames.length*.95)]??0,over50ms:frames.filter(v=>v>50).length}});
  };
  useEffect(()=>{
    let last='';
    const observer=new MutationObserver(()=>{
      const arena=host.current?.querySelector('[data-testid="battle-arena"]');
      const attack=arena?.querySelector<HTMLElement>('[data-testid="character-attack"]');
      const canvas=arena?.querySelector<HTMLElement>('canvas.special-move-canvas');
      const signature=[attack?.dataset.character,attack?.dataset.impact,arena?.querySelectorAll('[data-card-zone="board"]').length,
        arena?.querySelectorAll('[data-testid="destroyed-card"]').length,canvas?.dataset.ready,canvas?.dataset.playbackRate,
        arena?.querySelectorAll('[data-battle-media="squabble-aura"]').length].join(':');
      if(signature!==last){last=signature;write('state');}
    });
    observer.observe(host.current!,{subtree:true,childList:true,attributes:true,attributeFilter:['data-impact','data-ready','data-playback-rate']});
    let frame=0,previous=performance.now();
    const sample=(now:number)=>{if(now-audit.current.start<15000)audit.current.frames.push(now-previous);previous=now;frame=requestAnimationFrame(sample);};
    frame=requestAnimationFrame(sample);
    return()=>{observer.disconnect();cancelAnimationFrame(frame);};
  },[]);
  const reset=()=>{setRoom(effectsRoom());setKey(k=>k+1);audit.current={start:performance.now(),entries:[],frames:[]};};
  const run=(id:string,lane:0|1|2=0,armed=false)=>{audit.current={start:performance.now(),entries:[],frames:[]};write('start');setRoom(r=>effectsPlay(r,id,lane,armed));};
  return <><style>{`.online-arena{height:100%;min-height:0}`}</style><nav style={{display:'flex',gap:8,flexWrap:'wrap',padding:8,background:'#171713',color:'white',fontSize:12}}>
    <b>Local PvP regression</b><button onClick={reset}>Reset</button><button onClick={()=>run('roaster')}>Run knockout</button>
    <button onClick={()=>run('folks',1)}>Fire and burn</button><button onClick={()=>run('hooper',2,true)}>Squabble</button>
    <button onClick={()=>{audit.current={start:performance.now(),entries:[],frames:[]};setRoom(r=>effectsPlay(effectsPlay(r,'roaster'),'cornball',1));}}>Queue two plays</button>
    <button onClick={()=>setSeat(s=>s==='player'?'cpu':'player')}>Switch perspective</button>
    <label><input type="checkbox" checked={reduced} onChange={e=>setReduced(e.target.checked)}/>Reduced motion</label>
  </nav><div ref={host} style={{height:'calc(100dvh - 45px)'}} onAnimationStart={e=>{if(e.animationName==='defeat-tombstone-life')write('ghost-start');}}
    onAnimationEnd={e=>{if(e.animationName==='defeat-tombstone-life')write('ghost-end');}}>
    <MultiplayerBattle key={`${key}:${seat}`} room={view} busy={false} connected reducedMotion={reduced}
      send={command=>{setRoom(r=>applyOnlineCommand(r,seat,command,Date.now()));return Promise.resolve(true);}} onLeave={()=>{}}/>
  </div><details style={{position:'fixed',bottom:0,left:0,zIndex:100,fontSize:10,maxWidth:'95vw',background:'#111',color:'white'}}><summary>Timing evidence</summary><output ref={output} data-testid="pvp-effect-audit" style={{display:'block',maxHeight:200,overflow:'auto',overflowWrap:'anywhere'}}/></details></>;
}
const query=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});
const root=createRoot(document.getElementById('root')!);
root.render(<QueryClientProvider client={query}><Review/></QueryClientProvider>);
if(import.meta.hot)import.meta.hot.dispose(()=>root.unmount());
