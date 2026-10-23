import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CardView, type CollectibleCardLayers } from '../src/components/CardView';
import { CollectibleCard } from '../src/components/CollectibleCard';
import { getCardRarity } from '../src/components/CardRarityTreatment';
import { catalogCardByEngineId } from '../src/data';
import { createCardInstance } from '../src/gameEngine';
import { mountFinish, setFinishOptions, type Finish } from './card-name-tags/materials/renderer';
import '../src/index.css';
import './card-name-tags/materials/materials.css';
import '../src/styles/card-name-tag.preview.css';
import './card-name-tags.fixture.css';

const Inspector = lazy(() => import('../src/components/CardInspector').then(m => ({default:m.CardInspector})));
const samples = ['folks','guap','transplant','roaster','kyle','buddy','leroy','hooper', Object.keys(catalogCardByEngineId).find(id=>catalogCardByEngineId[id].rarity==='Epic')!] as const;
const elementSamples = ['Normal','Fire','Water','Plant','Air','Electric','Poison','Light','Dark','Earth'].map(element => {
  const [id] = Object.entries(catalogCardByEngineId).find(([,card])=>card.type===element && (card.kind??'character')==='character')!;
  return {element,id};
});
type CardProps = React.ComponentProps<typeof CardView>;
type Surface = 'collection' | 'deck-builder' | 'details' | 'battle';
const labels: Record<Surface,string> = {collection:'Collection','deck-builder':'Deck builder',details:'Card details',battle:'Battle check'};
function materialFor(card:CardProps['card']):Finish|null {
  const rarity=getCardRarity('cardId' in card?card.cardId:card.id,card.kind);
  return rarity==='Legendary'?'gold':rarity==='Mythical'?'cosmos':rarity==='Rare'||rarity==='Epic'?'shards':null;
}
function attachMaterial(root:HTMLElement,finish:Finish,live:boolean) {
  const inner=root.querySelector<HTMLElement>('.collector-frame > div');
  const rotor=root.querySelector<HTMLElement>('.collector-frame');
  if(!inner||!rotor)return ()=>{};
  const host=document.createElement('span');host.className='holo-finish';host.dataset.finish=finish;host.dataset.renderer='css';host.setAttribute('aria-hidden','true');
  const previousTabIndex=root.getAttribute('tabindex');
  if(live&&previousTabIndex===null)root.tabIndex=0;
  root.dataset.nameTagMaterial=finish;inner.append(host);
  const dispose=live?mountFinish(root,host,rotor,finish):()=>{};
  return ()=>{dispose();host.remove();delete root.dataset.nameTagMaterial;if(live&&previousTabIndex===null)root.removeAttribute('tabindex');};
}
// Audition-only optical sizing. Measure loaded Blzee ink, not character count.
// FOLKS is the approved paper-width anchor; larger names keep their existing shape.
const postalInkWidths = new Map<string,number>();
function fitPostalLabel(root:HTMLElement,name:string) {
  let disposed=false;
  if(name.length<=10)void document.fonts.load('100px Blzee').then(()=>{
    if(disposed||!root.isConnected)return;
    const context=document.createElement('canvas').getContext('2d');
    if(!context)return;
    context.font='100px Blzee';
    const ink=(value:string)=>{
      const key=value.toUpperCase();
      let width=postalInkWidths.get(key);
      if(width===undefined){const m=context.measureText(key);width=m.actualBoundingBoxLeft+m.actualBoundingBoxRight;postalInkWidths.set(key,width);}
      return width;
    };
    const widthDelta=(ink(name)-ink('FOLKS'))*.097;
    const minimum=widthDelta > -4 ? 52 : Math.max(39,52+widthDelta);
    root.style.setProperty('--postal-label-min',`${minimum.toFixed(2)}cqw`);
  }).catch(()=>{});
  return ()=>{disposed=true;root.style.removeProperty('--postal-label-min');};
}
function PreviewCard({updated,layered=false,live=false,...props}:CardProps&{updated:boolean;layered?:boolean;live?:boolean}) {
  const host=useRef<HTMLDivElement>(null);
  const finish=materialFor(props.card);
  useEffect(()=>{const root=host.current;if(!root)return;return fitPostalLabel(root,props.card.name);},[props.card.name]);
  useEffect(()=>{
    const card=host.current?.querySelector<HTMLElement>('.collector-card');
    if(layered||!updated||!finish||!card)return;
    return attachMaterial(card,finish,live);
  },[updated,layered,finish,live,props.card.id]);
  if(layered)return <CollectibleCard {...props} foil={updated}/>;
  return <div className="name-tag-card" ref={host} data-name-tag-short={props.card.name.length<=10}><CardView {...props}/></div>;
}
function PreviewInspector({card,onClose,updated,layered}:{card:CardProps['card'];onClose:()=>void;updated:boolean;layered:boolean}) {
  return <Inspector card={card} onClose={onClose} renderCard={(props:CardProps) =>
    <PreviewCard {...props} updated={updated} layered={layered} live />}/>;
}

function NameTagAudition() {
  const [surface,setSurface] = useState<Surface>('collection');
  const [shipping,setShipping] = useState(true);
  const [selected,setSelected] = useState<string>('folks');
  const [inspect,setInspect] = useState(false);
  const [elements,setElements]=useState('text');
  const [backdrop,setBackdrop]=useState('quiet');
  const [placement,setPlacement]=useState('left');
  const [finishes,setFinishes]=useState('updated');
  const [composition,setComposition]=useState('layers');
  const card = catalogCardByEngineId[selected];
  useEffect(()=>{setFinishOptions({drift:false,intensity:.56,enabled:finishes==='updated'&&composition!=='layers'});},[finishes,composition]);
  useEffect(() => {
    const data=document.body.dataset;
    if(shipping)data.nameTagAudition='shipping';else delete data.nameTagAudition;
    data.nameTagElements=elements;data.nameTagBackdrop=backdrop;data.nameTagPlacement=placement;data.nameTagShort=String(card.name.length<=10);
    return ()=>{for(const key of ['nameTagAudition','nameTagElements','nameTagBackdrop','nameTagPlacement','nameTagShort'])delete data[key];};
  },[shipping,elements,backdrop,placement,card.name]);
  const scope = shipping && surface !== 'battle' ? surface : undefined;
  const updated=finishes==='updated'&&surface!=='battle';
  const layered=shipping&&composition==='layers'&&surface!=='battle';
  return <main className="name-tag-study">
    <header className="name-tag-study__header"><div><small>CARD DESIGN / 06</small><h1>Print. Prism. Punch.</h1><p>Beveled foil frames. Glittered Motion. Prismatic postage.</p></div><button type="button" className="name-tag-compare" aria-pressed={shipping} onClick={()=>setShipping(v=>!v)}>{shipping?'New card design':'Original card'}</button></header>
    <fieldset className="name-tag-tuning"><legend>Compare the treatment</legend>
      <label>Composition<select aria-label="Composition" value={composition} onChange={e=>setComposition(e.target.value)}><option value="layers">Layered graphic cards</option><option value="postal">Earlier postal audition</option></select></label>
      <label hidden={composition==='layers'}>Element marks<select aria-label="Element marks" value={elements} onChange={e=>setElements(e.target.value)}><option value="text">Small text</option><option value="artwork">Supplied artwork</option></select></label>
      <label hidden={composition==='layers'}>Card background<select aria-label="Card background" value={backdrop} onChange={e=>setBackdrop(e.target.value)}><option value="quiet">Quiet</option><option value="scene">Current scenes</option></select></label>
      <label hidden={composition==='layers'}>Label placement<select aria-label="Label placement" value={placement} onChange={e=>setPlacement(e.target.value)}><option value="left">Low left · angled</option><option value="center">Centered · angled</option><option value="straight">Low left · straight</option></select></label>
      <label>Fighter<select aria-label="Fighter" value={selected} onChange={e=>setSelected(e.target.value)}>{Object.entries(catalogCardByEngineId).sort(([,a],[,b])=>a.name.localeCompare(b.name)).map(([id,c])=><option key={id} value={id}>{c.name}</option>)}</select></label>
      <label>Rarity finish<select aria-label="Rarity finish" value={finishes} onChange={e=>setFinishes(e.target.value)}><option value="updated">{composition==='layers'?'Selective rarity foil':'Updated holo materials'}</option><option value="current">{composition==='layers'?'Matte print':'Current card finish'}</option></select></label>
    </fieldset>
    <nav className="name-tag-study__tabs" aria-label="Card display context">{(Object.keys(labels) as Surface[]).map(id=><button type="button" key={id} aria-pressed={surface===id} onClick={()=>setSurface(id)}>{labels[id]}</button>)}</nav>
    <section className="name-tag-stage" data-context={surface}>
      <div className="name-tag-hero">
        <div className="name-tag-hero__caption"><span>{labels[surface]}</span><small>{surface==='battle'?'Current battle faces retained':layered?'Original numbers · layered artwork · fitted postal label':shipping?'Measured Blzee widths · long-name shape retained':'Existing name treatment'}</small></div>
        {surface==='battle'?<div className="name-tag-battle-check battle-arena" aria-label="Battle card scope check"><div><small>ON THE MAT</small><CardView card={createCardInstance(selected,'player','lane-0',0)} isBoard boardPresentation="combat" presentationOnly disableLayout /></div><div><small>IN THE HAND</small><CardView card={createCardInstance(selected,'player','hand',0)} presentationOnly disableLayout /></div><p>The shipping label stays off battle cards.</p></div>:<div className="name-tag-hero__card" data-name-tag-surface={scope}><PreviewCard layered={layered} updated={updated} live card={card} isBoard={surface!=='details'} isInspector={layered||surface==='details'} fillContainer presentationOnly disableLayout /></div>}
        {surface!=='battle'&&<button type="button" className="name-tag-inspect" onClick={()=>setInspect(true)}>Open full card details ↗</button>}
      </div>
      <aside className="name-tag-samples"><div className="name-tag-samples__head"><h2>{surface==='deck-builder'?'Your lineup':'Material lineup'}</h2><p>Select a fighter to inspect the full composition.</p></div><div className="name-tag-sample-grid" data-name-tag-surface={scope}>{samples.map(id=><button key={id} type="button" className="name-tag-sample" aria-label={'Preview '+catalogCardByEngineId[id].name} aria-pressed={selected===id} onClick={()=>setSelected(id)}><PreviewCard layered={layered} updated={updated} card={catalogCardByEngineId[id]} isBoard fillContainer presentationOnly disableLayout /></button>)}</div></aside>
    </section>
    <details className="name-tag-elements" hidden={composition==='layers'}><summary>Element artwork comparison</summary><p>Green is Plant. Earth keeps its text label.</p><div className="name-tag-element-grid">{elementSamples.map(({element,id})=><button type="button" key={element} aria-label={'Preview '+element+' card'} onClick={()=>setSelected(id)}><span className="element-badge-preview" data-element={element} aria-hidden="true">{element==='Earth'?'EARTH':''}</span><strong>{element}</strong></button>)}</div></details>
    <a className="name-tag-system-link" href="./card-name-tags/system/REVIEW.html">Explore the full card-system plan ↗</a>
    <a className="name-tag-system-link" style={{marginLeft:24}} href="./card-name-tags/system/v2-materials/REVIEW.html">V2 border &amp; foil plan ↗</a>
    <footer className="name-tag-study__footer"><strong>Audition only</strong><span>Collection · Deck builder · Full card details</span><span>Element print · Character · Rules paper · Postal label · Top stats</span></footer>
    {inspect&&<Suspense fallback={<div role="status">Opening details…</div>}><PreviewInspector layered={layered} card={card} updated={finishes==='updated'} onClose={()=>setInspect(false)}/></Suspense>}
  </main>;
}
const root=createRoot(document.getElementById('root')!);
root.render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><NameTagAudition/></QueryClientProvider>);
if(import.meta.hot)import.meta.hot.dispose(()=>root.unmount());
