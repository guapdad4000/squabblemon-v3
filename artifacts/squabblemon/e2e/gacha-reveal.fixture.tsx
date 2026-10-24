import { useEffect, useRef, useState } from 'react';
import {createRoot} from 'react-dom/client';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {getGetPlayerBootstrapQueryKey,type PackReward} from '@workspace/api-client-react';
import {cardCatalog,catalogCardById} from '../src/data';
import {GachaRevealSequence} from '../src/components/GachaRevealSequence';
import {profileBootstrap} from './fighter-id.fixture';
import '../src/index.css';
import '../src/styles/venue.css';
import '../src/styles/ui-polish.css';
import '../src/styles/gacha-stage.css';
const params=new URLSearchParams(location.search), count=Math.max(1,Number(params.get('count')??6));
const samples=['Common','Uncommon','Rare','Epic','Legendary','Mythical'].map(rarity=>cardCatalog.find(card=>card.rarity===rarity)!);
const rewards:PackReward[]=Array.from({length:count},(_,index)=>{if(!params.has('cardsOnly')&&index%6>=4)return{kind:index%6===4?'softCurrency':'styleShards',cardId:null,name:index%6===4?'Clout':'Universal Style Shards',rarity:null,variantId:null,amount:index%6===4?125:5,isNew:false};const card=index===0&&params.get('card')?catalogCardById[params.get('card')!]:samples[index%samples.length];return{kind:index%6===1?'styleShards':'card',cardId:card.catalogId,name:card.name,rarity:card.rarity,variantId:null,amount:index%6===1?35:1,shardRarity:index%6===1?'Uncommon':undefined,isNew:params.has('intro')&&index===0};});
const client=new QueryClient({defaultOptions:{queries:{retry:false}}});client.setQueryData(getGetPlayerBootstrapQueryKey(),profileBootstrap({ownedCardIds:rewards.map(r=>r.cardId!),settings:{reducedMotion:true,turnTimerEnabled:false}}));
function Fixture(){const dialog=useRef<HTMLDialogElement>(null);const[phase,setPhase]=useState(params.get('phase')??'reveal');const[index,setIndex]=useState(Number(params.get('index')??0));useEffect(()=>{dialog.current?.showModal();},[]);return <><p>LOCAL SAMPLE · real reward components, no claims</p><button onClick={()=>{setPhase('summary');dialog.current?.showModal();}}>Open sample haul</button><dialog className="gacha-reveal-dialog" ref={dialog} onCancel={event=>{event.preventDefault();dialog.current?.close();}}><GachaRevealSequence phase={phase} rewards={rewards} revealIndex={index} pullSize={Number(params.get('pullSize')??Math.ceil(count/6))} preview rareHighlightReward={count>6?rewards.at(-1):undefined} seasonRewards={[{seasonId:'2026-10',threshold:5,softCurrency:100,packTickets:0,styleShards:0}]} onReveal={index=>{setIndex(index);setPhase('reveal');}} onSummary={()=>setPhase('summary')} onFinish={()=>dialog.current?.close()}/></dialog></>;}
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={client}><Fixture/></QueryClientProvider>);
