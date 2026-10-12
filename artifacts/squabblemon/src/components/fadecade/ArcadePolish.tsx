import { getAssetUrl } from "../../lib/assets";
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import '../../styles/arcade-polish.css';

/** Health changes are derived from confirmed game state, never prediction. */
export function ArcadeGauge({value,max,label,className}:{value:number;max:number;label:string;className:string}) {
 const safe=Math.max(0,Math.min(max,value));
 const previous=useRef(safe);
 const [change,setChange]=useState({amount:0,id:0});
 const [trail,setTrail]=useState(safe);
 useEffect(()=>{
  const delta=safe-previous.current;
  if(!delta)return;
  setTrail(Math.max(previous.current,safe));
  previous.current=safe;
  setChange(old=>({amount:delta,id:old.id+1}));
  const timer=setTimeout(()=>setTrail(safe),240);
  return ()=>clearTimeout(timer);
 },[safe]);
 return <div className={`${className} arcade-gauge`} data-low={safe/max<.25} data-health-state={safe/max>.5?'healthy':safe/max>.25?'warning':'danger'}>
  <span>{label}</span>
  <div role="progressbar" aria-label={`${label} health`} aria-valuenow={safe} aria-valuemin={0} aria-valuemax={max}>
   <i className="arcade-gauge__trail" style={{width:`${trail/max*100}%`}}/>
   <i className="arcade-gauge__fill" style={{width:`${safe/max*100}%`}}/>
  </div>
  <b>{safe}/{max}</b>
  {change.amount!==0&&<span key={`flash-${change.id}`} className="arcade-gauge__flash" aria-hidden="true"/>}
  {change.amount!==0&&<em key={change.id} className="arcade-gauge__number" data-heal={change.amount>0} aria-hidden="true">{change.amount>0?'+':''}{change.amount}</em>}
 </div>;
}
export function ArcadeObjective({chapter,title,detail,value,max,banked}:{chapter:string;title:string;detail:string;value:number;max:number;banked?:number}){
 return <aside className="arcade-objective" aria-label="Run objective" style={{'--objective-progress':`${Math.min(100,Math.max(0,value/max*100))}%`} as CSSProperties}>
  <div><small>{chapter}</small><strong>{title}</strong><span>{detail}</span></div>
  <div className="arcade-objective__progress"><b>{value}<small> / {max}</small></b><div role="progressbar" aria-label={title} aria-valuenow={Math.min(max,Math.max(0,value))} aria-valuemin={0} aria-valuemax={max}><i/></div></div>
  {banked!==undefined&&<div className="arcade-objective__bank"><small>CLOUT BANKED</small><strong key={banked}>{banked}</strong><span>Yours even if you lose</span></div>}
 </aside>;
}
export function ArcadeMilestones({steps,value}:{steps:readonly {at:number;label:string}[];value:number}){
 return <ol className="arcade-milestones" aria-label="Reward milestones">{steps.map(step=><li key={step.at} data-earned={value>=step.at}><span aria-hidden="true">{value>=step.at?'✓':'◆'}</span><b>{step.at}</b><small>{step.label}</small></li>)}</ol>;
}

export function ArcadePrizeArt(){return <img className="arcade-prize-art" src={getAssetUrl('assets/minigames/polish-v2/banked-fist.webp')} alt="" aria-hidden="true"/>;}
