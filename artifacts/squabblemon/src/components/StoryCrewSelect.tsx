import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { getCardImage, catalogCardById } from '../data';
import { getAssetUrl } from '../lib/assets';
import type { PickerDeck } from './CompactDeckPicker';
import '../styles/story-crew-select.css';
export function StoryCrewSelect({ decks, selectedId, onSelect, onBack, action }: { decks: PickerDeck[]; selectedId: string; onSelect: (id: string) => void; onBack: () => void; action: ReactNode }) {
 const selected = decks.find(deck => deck.id === selectedId) ?? decks[0];
 const roster = useRef<HTMLDivElement>(null);
 const grid = useRef<HTMLDivElement>(null);
 const [columns,setColumns]=useState(4);
 const [threads,setThreads]=useState<{x1:number;y1:number;x2:number;y2:number}[]>([]);
 useLayoutEffect(()=>{
  const host=roster.current, tiles=grid.current;
  if(!host || !tiles) return;
  const measure=()=>{
   const box=host.getBoundingClientRect(), area=tiles.getBoundingClientRect();
   setColumns(Math.max(2,Math.min(6,Math.ceil(Math.sqrt(decks.length*area.width/Math.max(area.height,1)*.85)))));
   const source=tiles.querySelector('[aria-pressed="true"]')?.getBoundingClientRect();
   if(source) setThreads(Array.from(host.querySelectorAll('.crew-case__photo')).map(el=>{const r=el.getBoundingClientRect();return {x1:source.x+source.width/2-box.x,y1:source.bottom-box.y,x2:r.x+r.width/2-box.x,y2:r.y+8-box.y};}));
  };
  measure();const observer=new ResizeObserver(measure);observer.observe(host);observer.observe(tiles);
  return ()=>observer.disconnect();
 },[selectedId,decks.length,columns]);
 return <section className="story-crew-select" style={{backgroundImage:`url(${getAssetUrl('assets/selection/underpass.png')})`}} aria-label="Select your story crew">
  <header><button className="crew-street-sign crew-street-sign--back" onClick={onBack}>Back</button><img src={getAssetUrl('assets/results/v3/wordmark.webp')} alt="Squabblemon" /><span>STORY / CREW SELECT</span></header>
  <div className="story-crew-select__body">
   <figure className="story-crew-select__hero">{selected && <><img key={selected.heroCardId} src={getCardImage(selected.heroCardId)} alt={catalogCardById[selected.heroCardId]?.name ?? selected.name} /><figcaption><small>PLAYER 1 / STREET FILE</small><h1>{selected.name}</h1><p>{catalogCardById[selected.heroCardId]?.name} · {selected.cardIds.length} cards</p></figcaption></>}</figure>
   <div ref={roster} className="story-crew-select__roster"><h2>Who all in there?</h2>
    <svg className="crew-evidence-threads" aria-hidden="true">{threads.map((line,i)=><line key={i} {...line} />)}</svg>
    <div ref={grid} className="story-crew-select__grid" style={{gridTemplateColumns:`repeat(${columns},minmax(0,1fr))`,gridTemplateRows:`repeat(${Math.max(1,Math.ceil(decks.length/columns))},minmax(0,1fr))`}} role="group" aria-label="Available crews">{decks.map(deck => <button key={deck.id} aria-pressed={selected?.id === deck.id} onClick={() => onSelect(deck.id)}><img src={getCardImage(deck.heroCardId)} alt="" /><span>{deck.name}</span>{selected?.id === deck.id && <><b>P1</b><i className="crew-paperclip" aria-hidden="true" /></>}</button>)}</div>
    {selected && <div className="crew-case" aria-label="Selected crew evidence dossier">
     <img className="crew-case__folder" src={getAssetUrl('assets/selection/dossier.png')} alt="" />
     <span className="crew-case__stamp">PERSONS OF INTEREST</span>
     {selected.cardIds.map((id,i)=> <figure className="crew-case__photo" key={`${id}-${i}`} style={{'--photo-x':`${12+(i%5)*18}%`,'--photo-y':`${i<5?27:66}%`,'--photo-angle':`${(i%5-2)*5+(i<5?-3:3)}deg`} as CSSProperties}><img src={getCardImage(id)} alt={catalogCardById[id]?.name ?? id}/><figcaption>{catalogCardById[id]?.name ?? id}</figcaption><i aria-hidden="true" /></figure>)}
    </div>}
    {!decks.length && <p>No battle-ready crew. Build a ten-card deck first.</p>}
    <footer>{action}</footer>
   </div>
  </div>
 </section>;
}
