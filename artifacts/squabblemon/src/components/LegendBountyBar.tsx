import { LegendBountyJourney } from './LegendBountyJourney';
import { LEGEND_SEAT_ORDER } from '@workspace/squabblemon-engine/legendBounties';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { LegendBountyStatus } from '@workspace/squabblemon-engine/legendBounties';
import { getCardImage } from '../data';
import { getAssetUrl } from '../lib/assets';
export function LegendBountyBar({statuses,busy,onClaim,loading,error,onRetry,openJourney}:{statuses:LegendBountyStatus[];busy:boolean;onClaim:(id:string)=>void;loading:boolean;error:boolean;onRetry:()=>void;openJourney?:string}) {
 const [selectedId,setSelectedId]=useState<string|null>(null);
 useEffect(()=>{if(openJourney)setSelectedId(openJourney);},[openJourney]);
 const selected=statuses.find(b=>b.id===selectedId);
 const next=selected?statuses.find(b=>b.order===selected.order+1):undefined;
 const seatedStatuses=[...statuses].sort((a,b)=>LEGEND_SEAT_ORDER.indexOf(a.id)-LEGEND_SEAT_ORDER.indexOf(b.id));
 const previous = useRef(new Map<string,string>());
 const [revealed,setRevealed] = useState<string[]>([]);
 useEffect(()=>{
   const arrivals=statuses.filter(b=>b.state==='claimed'&&previous.current.get(b.id)==='ready').map(b=>b.id);
   previous.current=new Map(statuses.map(b=>[b.id,b.state]));
   if(!arrivals.length)return;
   setRevealed(arrivals);const timer=window.setTimeout(()=>setRevealed([]),1400);
   return ()=>window.clearTimeout(timer);
 },[statuses]);
 return <section className="legend-bar" aria-labelledby="legend-bar-title">
 <header><span>THE AFTER HOURS CLUB</span><h2 id="legend-bar-title">A seat for the legends.</h2><p>Earn their respect. Bring them into your crew. Complete Nothing to Lose, then follow the trail inward. Three reward nodes per legend.</p></header>
 <nav className="bounty-contract-trail" aria-label="Bounty campaign order">{[...statuses].sort((a,b)=>a.order-b.order).map(b=><button key={b.id} onClick={()=>setSelectedId(b.id)} data-state={b.state}><span>{b.order}</span>{b.name}</button>)}</nav>
 <div className="legend-bar__scene" style={{'--legend-stool': `url(${getAssetUrl('assets/bounty-hunter/v4/stool.webp')})`, backgroundImage:`url(${getAssetUrl('assets/bounty-hunter/v3/legend-bar.webp')})`} as CSSProperties}>
 {loading?<p role="status">Checking your saved achievements…</p>:error?<p role="alert">The guest list could not load. <button onClick={onRetry}>Try again</button></p>:seatedStatuses.map(b=><article className="legend-seat" key={b.id} data-state={b.state} data-owned={b.ownsCard} data-revealed={revealed.includes(b.id)}>
 <div className="legend-seat__flier" aria-label={`${b.name} wanted flyer`}><strong>WANTED</strong><span>{b.name}</span><img src={getCardImage(b.id)} alt="" draggable={false}/></div>
 <div className="legend-seat__portrait"><img src={getAssetUrl(`assets/bounty-hunter/v4/characters/${b.id}.webp`)} alt={b.state==='claimed'||b.ownsCard?b.name:`${b.name} silhouette`} draggable={false}/><span aria-hidden="true">{b.state==='claimed'||b.ownsCard?'✓':b.state==='ready'?'!':'?'}</span></div>
 <div className="legend-seat__caption"><small>{b.title}</small><h3>{b.name}</h3><p>{b.gate??b.rule}</p><progress aria-label={`${b.name} bounty progress`} value={b.progress} max={b.goal}/><span className="legend-seat__count">{b.progress} / {b.goal}</span>
 <button disabled={busy} onClick={()=>setSelectedId(b.id)}>{b.state==='claimed'?'View completed bounty':b.state==='ready'?'Reward ready · View bounty':b.state==='active'?'Continue bounty':'View locked bounty'}</button></div>
 </article>)}
 </div>{selected&&<LegendBountyJourney key={selected.id} bounty={selected} busy={busy} onClaim={onClaim} onClose={()=>setSelectedId(null)} onNext={setSelectedId} next={next}/>}</section>;
}
