import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CardInspector } from '../src/components/CardInspector';
import { CardView } from '../src/components/CardView';
import { cardCatalog, CARD_RARITY_DEFINITIONS, type CardRarity } from '../src/data';
import { CARD_FINISH, cardFinishLabel } from '../src/lib/cardFinish';
import '../src/index.css';
import './foil-studio.css';
const rarities = Object.keys(CARD_RARITY_DEFINITIONS) as CardRarity[];
const picks = rarities.map(rarity => cardCatalog.find(card => card.rarity === rarity && (rarity !== 'Legendary' || card.engineId === 'kyle'))!);
function Studio() {
 const [tier, setTier] = useState(5), [variant,setVariant] = useState('base'), [mounted,setMounted] = useState(true), [inspect,setInspect] = useState(false);
 const card = picks[tier];
 return <main className="foil-studio"><header><span>SQUABBLEMON / COLLECTOR SERIES</span><h1>THE FINISH ROOM</h1><p>Seven stocks. Three custom editions. Move across the card to catch the light.</p></header>
 {inspect && <CardInspector card={card} bootstrap={{profile:{ownedCardIds:[card.catalogId],equippedVariants:{},cardProgression:{[card.catalogId]:{xp:2800,level:8,moveTier:2}},styleShards:400,ownedVariants:[],savedDecks:[]}}} onClose={()=>setInspect(false)}/>}<section className="foil-stage"><div className="foil-stage__portrait">{mounted && <CardView card={card} variantId={variant === 'base' ? undefined : card.id+':'+variant} isInspector presentationOnly disableLayout className="w-full aspect-[63/88]"/>}</div><aside><span>COLLECTOR FINISH / {String(tier+1).padStart(2,'0')}</span><h2>{cardFinishLabel(card.rarity, variant === 'base' ? null : variant as 'tagged' | 'chrome' | 'prismatic')}</h2><p>{CARD_RARITY_DEFINITIONS[card.rarity].label} · {card.name}</p><nav aria-label="Edition">{['base','tagged','chrome','prismatic'].map(v=><button key={v} aria-pressed={variant===v} onClick={()=>setVariant(v)}>{v}</button>)}</nav><button className="mount-toggle" onClick={()=>setMounted(v=>!v)}>{mounted?'Close display':'Open display'}</button><button style={{marginLeft:8}} onClick={()=>setInspect(true)}>Card details</button></aside></section>
 <section className="foil-lineup" aria-label="Finish tiers">{picks.map((item,i)=><article key={item.id}><button aria-label={'Show '+item.rarity} aria-pressed={tier===i} onClick={()=>setTier(i)}><CardView card={item} variantId={variant==='base'?undefined:item.id+':'+variant} fillContainer presentationOnly disableLayout/><strong>{CARD_RARITY_DEFINITIONS[item.rarity].label}</strong><small>{CARD_FINISH[item.rarity]}</small></button></article>)}</section><section className="foil-lineup" aria-label="Blockbuster full art">{cardCatalog.filter(c=>c.kind==='blockbuster').slice(0,7).map(item=><article key={item.id}><CardView card={item} fillContainer presentationOnly disableLayout/><strong>{item.name}</strong></article>)}</section></main>;
}
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={new QueryClient()}><Studio/></QueryClientProvider>);
