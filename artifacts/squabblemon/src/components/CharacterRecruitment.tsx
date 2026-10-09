import {useEffect,useRef,type CSSProperties} from 'react';
import {Link} from 'wouter';
import {X,ArrowRight} from 'lucide-react';
import {getAssetUrl} from '../lib/assets';
import {GameGlyph} from './venue/GameGlyph';
import type {RewardItem} from '../lib/rewardReceipts';
import '../styles/bounty-campaign.css';
const designs={
 'homeless-guy':{name:'Homeless Guy',title:'Nothing to Lose',theme:'titan',accent:'#e7b760',banner:'assets/starter-mythic/background.webp',portrait:'assets/starter-mythic/chibi.webp',copy:'A legend hiding in plain sight. Your first Mythical is with you now.'},
 'john-henry':{name:'John Henry',title:'Built to Last',theme:'folks',accent:'#a8cfe0',banner:'assets/cosmetics/john-henry/banner-v3.webp',portrait:'assets/cosmetics/john-henry/sticker-action-v3.webp',copy:'Steel in his hands. Heart in his work. The Steel Driver joins your crew.'},
 buddy:{name:'BUDDY',title:'Three Gardens. Strong Roots.',theme:'ashlee',accent:'#9ed279',banner:'assets/locations/rooftop-garden.webp',portrait:'assets/buddy-growth/buddy-welcome.webp',copy:'Three completed gardens. A growing crew. BUDDY is yours to keep.'},
};
export type RecruitmentCharacter=keyof typeof designs;
export function CharacterRecruitment({id,items=[],onClose,reduced=false,returnFocus}:{id:RecruitmentCharacter;items?:RewardItem[];onClose:()=>void;reduced?:boolean;returnFocus?:HTMLElement|null}){
 const d=designs[id],dialog=useRef<HTMLDialogElement>(null),opener=useRef<HTMLElement|null>(null);
 useEffect(()=>{opener.current=returnFocus??(document.activeElement instanceof HTMLElement?document.activeElement:null);dialog.current?.showModal();return()=>{dialog.current?.close();if(opener.current?.isConnected)opener.current.focus({preventScroll:true});};},[]);
 return <dialog ref={dialog} className="bounty-unlock character-recruitment" data-character={id} data-theme={d.theme} data-reduced-motion={reduced} aria-labelledby="character-recruitment-title" onCancel={onClose} style={{'--bounty-accent':d.accent,'--bounty-banner':`url(${getAssetUrl(d.banner)})`} as CSSProperties}><button className="bounty-dialog-close" aria-label="Close character unlock" onClick={onClose}><X/></button><div className="bounty-unlock-stage"><div className="bounty-unlock-rays" aria-hidden="true"/><div className="bounty-theme-motion" aria-hidden="true"><i/><i/><i/><i/><i/></div><div className="bounty-unlock-copy"><span>{id==='buddy'?'GARDEN LEGEND':'MYTHICAL'} · CREW UNLOCK</span><h2 id="character-recruitment-title">{d.name}</h2><b>{d.title}</b><p>{d.copy}</p><div className="bounty-unlock-stamp">RECRUITED</div></div><img className="bounty-unlock-character" src={getAssetUrl(d.portrait)} alt={d.name}/></div><footer><div className="bounty-node-rewards">{items.map((item,i)=><span key={i}>{item.image?<img src={item.image} alt="" style={{width:28,height:28,objectFit:'contain'}}/>:<GameGlyph name={item.glyph??'mastery'}/>}<b>{item.amount?`+${item.amount}`:''}</b>{item.label}</span>)}</div><div className="bounty-unlock-actions"><button autoFocus className="bounty-campaign-action" onClick={onClose}>Keep going <ArrowRight size={18}/></button><Link href="/game/collection" onClick={onClose}>Meet your crew →</Link></div></footer></dialog>;
}
