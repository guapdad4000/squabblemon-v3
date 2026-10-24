import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cardCatalog, cards } from '../src/data';
import { CollectibleCard } from '../src/components/CollectibleCard';
import { CardInspector } from '../src/components/CardInspector';
import { createCardInstance, createMatch, playTurnCard } from '../src/gameEngine';
import '../src/index.css';
import '../src/pages/game/gameStyles';
function Fixture() {
  const params = new URLSearchParams(location.search), rarity = params.get('rarity') ?? 'Common';
  const card = params.get('card') ? cards[params.get('card')!] : cardCatalog.find(c => c.rarity === rarity && c.kind === 'character')!;
  const [open, setOpen] = useState(false), parent = useRef<HTMLDialogElement>(null);
  const nested = params.get('nested') === 'true', battle = params.get('battle') === 'true';
  const [match] = useState(() => {
    const state = createMatch('block','combo'); state.playerMotion = 30;
    state.playerHand = [createCardInstance('buddy', 'player', 'details-review', 0)];
    return playTurnCard(state, 'player', state.playerHand[0].instanceId, 0, true);
  });
  useEffect(() => { if (nested) parent.current?.showModal(); return () => parent.current?.close(); }, [nested]);
  const button = <button type="button" data-testid="open-details" onClick={() => setOpen(true)} style={{padding:12,background:'#eee',color:'#111'}}>Open card details</button>;
  const content = <><div style={{display:'flex',alignItems:'start',gap:24,flexWrap:'wrap'}}>{[128,320].map(width => <div key={width} data-testid={`frame-${width}`} style={{width,maxWidth:'100%',aspectRatio:'63/88'}}><CollectibleCard card={card} foil={params.get('foil') !== 'false'} fillContainer isBoard presentationOnly disableLayout /></div>)}</div>{button}</>;
  return <main style={{background:'#151918',color:'#fff',minHeight:'100dvh',padding:24}}>
    <h1>{rarity} frame review</h1>
    {nested ? <dialog ref={parent} data-testid="parent-dialog" aria-label="Parent card popup" style={{position:'fixed',left:'50%',top:'50%',transform:'translate(-50%,-50%)',margin:0,width:'min(600px,90vw)',height:'min(520px,85dvh)',padding:20,overflow:'auto',background:'#202722'}}>{content}</dialog> : content}
    {open && <CardInspector card={battle ? match.boards.flat().find(c=>c.cardId==='buddy') : card} match={battle ? match : undefined} onClose={() => setOpen(false)}/>}
  </main>;
}
const root=createRoot(document.getElementById('root')!);
root.render(<QueryClientProvider client={new QueryClient()}><Fixture/></QueryClientProvider>);
import.meta.hot?.dispose(()=>root.unmount());
