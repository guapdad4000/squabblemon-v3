import {useEffect,useRef,useState,type CSSProperties} from 'react';
import {Link} from 'wouter';
import {Radio,Leaf,Wind,Heart,Flame,Smile,Utensils,Check,Lock,Gift,X,ArrowRight} from 'lucide-react';
import {LEGEND_BOUNTIES,type LegendBountyStatus,type BountyReward} from '@workspace/squabblemon-engine/legendBounties';
import {getAssetUrl} from '../lib/assets';
import {GameGlyph} from './venue/GameGlyph';
import '../styles/bounty-campaign.css';
const emblems={titan:Radio,ashlee:Leaf,ptang:Wind,simmy:Heart,folks:Flame,kyle:Smile,foodz:Utensils};
export const bountyBanner=(id:string)=>getAssetUrl(`assets/bounty-hunter/v5/banners/${id}.webp`);
const seated=(id:string)=>getAssetUrl(`assets/bounty-hunter/v4/characters/${id}.webp`);
function RewardItems({reward,character}:{reward:BountyReward;character?:string}){return <div className="bounty-node-rewards" aria-label="Node rewards">{reward.softCurrency>0&&<span><GameGlyph name="cloutStack"/><b>{reward.softCurrency}</b> Clout</span>}{reward.packTickets>0&&<span><GameGlyph name="ticket"/><b>{reward.packTickets}</b> Ticket</span>}{reward.styleShards>0&&<span><GameGlyph name="shards"/><b>{reward.styleShards}</b> Shards</span>}{character&&<span className="bounty-node-card"><Gift size={18}/><b>{character}</b> character</span>}</div>;}
export function LegendBountyJourney({bounty,busy,onClaim,onClose,onNext,next}:{bounty:LegendBountyStatus;busy:boolean;onClaim:(id:string)=>void;onClose:()=>void;onNext:(id:string)=>void;next?:LegendBountyStatus}){
 const dialog=useRef<HTMLDialogElement>(null),opener=useRef<HTMLElement|null>(null);
 const [selected,setSelected]=useState(bounty.currentNodeId??bounty.nodes[2].id);
 useEffect(()=>{opener.current=document.activeElement instanceof HTMLElement?document.activeElement:null;dialog.current?.showModal();return()=>{dialog.current?.close();opener.current?.isConnected&&opener.current.focus({preventScroll:true});};},[]);
 useEffect(()=>{setSelected(bounty.currentNodeId??bounty.nodes[2].id);},[bounty.id,bounty.currentNodeId]);
 const node=bounty.nodes.find(n=>n.id===selected)??bounty.nodes[0];const Emblem=emblems[bounty.theme];
 return <dialog ref={dialog} className="bounty-journey" data-theme={bounty.theme} aria-labelledby="bounty-journey-title" onCancel={onClose} style={{'--bounty-accent':bounty.accent} as CSSProperties}>
 <button className="bounty-dialog-close" aria-label="Close bounty journey" onClick={onClose}><X size={22}/></button>
 <header className="bounty-journey-banner" style={{backgroundImage:`url(${bountyBanner(bounty.id)})`}}><div className="bounty-journey-ink"><span><Emblem size={18}/> BOUNTY {bounty.order} / 7</span><h2 id="bounty-journey-title">{bounty.name}</h2><b>{bounty.title}</b><p>{bounty.flavor}</p></div><img className="bounty-journey-character" src={seated(bounty.id)} alt={bounty.name}/><div className="bounty-theme-motion" aria-hidden="true"><i/><i/><i/><i/><i/></div></header>
 <div className="bounty-journey-body"><div className="bounty-journey-status"><span>{bounty.state==='claimed'?'RECRUITED':bounty.gate?'TRAIL LOCKED':`NODE ${bounty.progress+1} OF 3`}</span><p>{bounty.gate??'Complete each task and collect its payout to open the next node. Only the active node earns progress.'}</p></div>
 <ol className="bounty-path" aria-label={`${bounty.name} progress nodes`}>{bounty.nodes.map((n,i)=><li key={n.id} data-state={n.state} data-selected={selected===n.id}><button onClick={()=>setSelected(n.id)} aria-pressed={selected===n.id}><span className="bounty-node-seal">{n.state==='claimed'?<Check/>:n.state==='locked'?<Lock/>:i+1}</span><small>{i===2?'CHARACTER UNLOCK':`PAYOUT ${i+1}`}</small><b>{n.title}</b><span>{n.state==='claimed'?'Collected':n.state==='locked'?'Locked':`${n.progress} / ${n.goal}`}</span></button></li>)}</ol>
 <section className="bounty-node-brief" data-state={node.state} aria-live="polite"><div><span>MISSION BRIEF · NODE {bounty.nodes.indexOf(node)+1}</span><h3>{node.title}</h3><p>{node.description}</p><small>{node.tip}</small></div><RewardItems reward={node.reward} character={node.id===bounty.nodes[2].id?bounty.name:undefined}/>
 <div className="bounty-node-meter"><progress value={node.progress} max={node.goal} aria-label={`${node.title} progress`}/><b>{node.progress} / {node.goal}</b></div>
 {node.state==='claimed'?<p className="bounty-saved">✓ Reward collected and saved.</p>:node.state==='ready'?<button className="bounty-campaign-action" disabled={busy} onClick={()=>onClaim(bounty.id)}>{busy?'Saving your payout…':node.id===bounty.nodes[2].id?'Recruit '+bounty.name:'Collect node reward'} <Gift size={18}/></button>:node.state==='active'?<Link className="bounty-campaign-action" href={node.href} onClick={onClose}>Go to mission <ArrowRight size={18}/></Link>:<p className="bounty-saved"><Lock size={15}/>{bounty.gate??'Collect the previous node reward first.'}</p>}
 </section>{bounty.state==='claimed'&&next&&<button className="bounty-next-contract" onClick={()=>onNext(next.id)}>NEXT CONTRACT · {next.name} <ArrowRight size={20}/></button>}
 </div></dialog>;
}
export type BountyPayoutData={id:string;nodeId:string;unlocked:boolean;duplicateShards:number;reward:BountyReward};
export function BountyPayout({payout,onContinue,onClose,reducedMotion}:{payout:BountyPayoutData;onContinue:(id:string)=>void;onClose:()=>void;reducedMotion:boolean}){
 const dialog=useRef<HTMLDialogElement>(null);const bounty=LEGEND_BOUNTIES.find(b=>b.id===payout.id)!;const node=bounty.nodes.find(n=>n.id===payout.nodeId)!;const Emblem=emblems[bounty.theme];
 const next=LEGEND_BOUNTIES[LEGEND_BOUNTIES.indexOf(bounty)+1];
 useEffect(()=>{dialog.current?.showModal();return()=>dialog.current?.close();},[]);
 return <dialog ref={dialog} className="bounty-unlock" data-theme={bounty.theme} data-unlocked={payout.unlocked} data-reduced-motion={reducedMotion} aria-labelledby="bounty-unlock-title" onCancel={onClose} style={{'--bounty-accent':bounty.accent,'--bounty-banner':`url(${bountyBanner(bounty.id)})`} as CSSProperties}>
 <button className="bounty-dialog-close" onClick={onClose} aria-label="Close bounty payout"><X size={22}/></button><div className="bounty-unlock-stage"><div className="bounty-unlock-rays" aria-hidden="true"/><div className="bounty-theme-motion" aria-hidden="true"><i/><i/><i/><i/><i/></div>
 <div className="bounty-unlock-copy"><span><Emblem size={22}/> {payout.unlocked?'LEGEND RECRUITED':'BOUNTY NODE COMPLETE'}</span><h2 id="bounty-unlock-title">{payout.unlocked?bounty.name:node.title}</h2><b>{bounty.title}</b><p>{payout.unlocked?'The seat is yours. Your character reward is saved to your collection.':'You put in the work. Your payout is saved and the next node is open.'}</p><div className="bounty-unlock-stamp">{payout.unlocked?'RECRUITED':'PAID IN FULL'}</div></div><img className="bounty-unlock-character" src={seated(bounty.id)} alt={bounty.name}/></div>
 <footer><RewardItems reward={payout.reward} character={payout.unlocked&&!payout.duplicateShards?bounty.name:undefined}/>{payout.duplicateShards>0&&<p className="bounty-duplicate">Already in your crew: +{payout.duplicateShards} duplicate Style Shards.</p>}<div className="bounty-unlock-actions"><button autoFocus className="bounty-campaign-action" onClick={()=>onContinue(payout.unlocked&&next?next.id:bounty.id)}>{payout.unlocked&&next?'Next bounty · '+next.name:payout.unlocked?'View completed bounty':'Continue bounty'} <ArrowRight size={19}/></button>{payout.unlocked&&<Link href="/game/collection" onClick={onClose}>Meet your crew →</Link>}</div></footer></dialog>;
}
