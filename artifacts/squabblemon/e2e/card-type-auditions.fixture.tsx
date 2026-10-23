import React, { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createPortal } from 'react-dom';
import { MessageCircle } from 'lucide-react';
import { TURN_SECONDS as ONLINE_TURN_SECONDS } from '@workspace/squabblemon-engine/multiplayer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CardView } from '../src/components/CardView';
import { Battle, type OnlineBattlePresentation } from '../src/components/Battle';
import type { PresentationEffect } from '../src/components/PlayLoop';
import { ReactionArt } from '../src/components/ReactionArt';
import { REACTIONS, type ReactionId } from '@workspace/squabblemon-engine/reactions';
import { DeckCarousel } from '../src/components/DeckCarousel';
import { createCardInstance, createMatch, getLegalCardCost, getMatchDistricts, getDistrictResults, playTurnCard, type CardInstance, type Lane } from '../src/gameEngine';
import { catalogCardByEngineId, decks, type Card } from '../src/data';
import { DEFAULT_UI_TYPE, UI_TYPE_ROLES, type UiTypeRole, type UiTypeSelection } from '../src/lib/uiTypography';
import additions from './card-type-auditions/font-catalog.json';
import '../src/index.css';
import './card-type-auditions.fixture.css';
import '../src/styles/battle-palette.preview.css';
import '../src/styles/battle-reactions.css';
import '../src/styles/pvp-reactions-v2.css';

const Inspector = lazy(() => import('../src/components/CardInspector').then(m => ({ default: m.CardInspector })));
type Font = { id: string; label: string; family: string; weight: number; digits: boolean; roles: string[]; plate?: string; rights?: string; digitAdvanceEm?: number; laneScale?: number };
const liveBase: Font[] = [
  { id:'classic',label:'Original bold',family:"'Clash Display', sans-serif",weight:900,digits:true,roles:['card','lane','deck','location'] },
  { id:'blzee',label:'Blzee',family:"'Blzee', sans-serif",weight:400,digits:true,roles:['card','lane','deck','location'] },
  { id:'draco',laneScale:.52,label:'Draco',family:"'Audition Draco', sans-serif",weight:400,digits:true,roles:['card','lane','deck','location'] },
];
const fonts: Font[] = [...liveBase, ...additions];
const fontById = new Map(fonts.map(f => [f.id, f]));
const cards = ['folks','guap','transplant','roaster','hooper','kyle'];
const presets: { label: string; value: UiTypeSelection }[] = [
  { label:'Approved', value:DEFAULT_UI_TYPE },
  { label:'Draco + Blzee', value:{card:'classic',lane:'draco',deck:'draco',location:'blzee'} },
  { label:'Mixed markers', value:{card:'trackvia-sub',lane:'trackvia-marker',deck:'draco',location:'blzee'} },
  { label:'Hemi + Brutalist', value:{card:'hemi',lane:'dx-heavy',deck:'draco',location:'blzee'} },
  { label:'Display mix', value:{card:'hemi-italic',lane:'dx-bold',deck:'easter',location:'adecko'} },
  { label:'M290 + Trackvia', value:{card:'m290',lane:'trackvia-rough',deck:'draco',location:'trackvia-marker'} },
];
const noop = () => {};
function initialSelection(): UiTypeSelection {
  try {
    const saved = JSON.parse(localStorage.getItem('squabblemon:typography-audition:v2') || 'null');
    return Object.fromEntries(UI_TYPE_ROLES.map(r => [r.id, fonts.some(f => f.id===saved?.[r.id] && f.roles.includes(r.id)) ? saved[r.id] : r.defaultFont])) as UiTypeSelection;
  } catch { return {...DEFAULT_UI_TYPE}; }
}
function sampleMatch(count = 2, choices = false) {
  const m=createMatch('block','combo');m.round=3;m.playerMotion=16;m.cpuMotion=4;
  m.playerHand=(choices?['homelessguy','the-dice-game','the-concert']:['folks','transplant','roaster','guap','kyle']).map((id,i)=>createCardInstance(id,'player','hand',i));
  m.boards=([0,1,2] as Lane[]).map(lane=>(['cpu','player'] as const).flatMap(owner=>Array.from({length:count},(_,i)=>({id:['hooper','plug','barber','kyle','guap','buddy'][i%6],i})).map(({id,i})=>({...createCardInstance(id,owner,`lane-${lane}`,i),lane,powerModifier:3+Number(lane===0&&owner==='player'||lane===2&&owner==='cpu')})))) as typeof m.boards;
  return m;
}
type FeedbackPreview = 'live' | 'move' | 'combo' | 'round';
function feedbackSample(count:number,mode:FeedbackPreview) {
  if(mode==='live')return null;
  const before=sampleMatch(count);
  if(mode==='round')return {match:before,effect:null};
  const actor=before.playerHand.find(c=>c.cardId==='roaster')!;
  const match=playTurnCard(before,'player',actor.instanceId,0);
  const event=match.effectLog.find(e=>e.sequence>=before.nextEventSequence&&e.type==='ability'&&e.cardId==='roaster')!;
  const effect:PresentationEffect={...event,impact:true,targetIds:event.targets.map(t=>t.cardInstanceId),
    ...(mode==='combo'?{chain:{id:'local-layout-sample',index:2,total:3,fromId:null}}:{})};
  return {match,effect};
}
function PreviewReactions() {
  const [slot,setSlot]=useState<Element|null>(null),[open,setOpen]=useState(false),[bubble,setBubble]=useState<ReactionId|null>(null);
  useEffect(()=>{setSlot(document.querySelector('.type-battle .pvp-reaction-slot--actions'));},[]);
  useEffect(()=>{if(!bubble)return;const timer=setTimeout(()=>setBubble(null),3000);return()=>clearTimeout(timer);},[bubble]);
  return <>{slot&&createPortal(<div className="pvp-reaction-controls is-docked"><button type="button" className="pvp-reaction-trigger" aria-label="Choose a reaction in the local preview" aria-expanded={open} onClick={()=>setOpen(v=>!v)}><MessageCircle size={22}/><span>React</span></button>{open&&createPortal(<div className="pvp-reaction-picker" role="region" aria-label="Local reaction preview"><button type="button" aria-label="Close local reaction preview" onClick={()=>setOpen(false)}>Close</button><div className="pvp-reaction-grid">{REACTIONS.slice(0,6).map(reaction=><button type="button" key={reaction.id} aria-label={'Preview '+reaction.name} onClick={()=>{setBubble(reaction.id);setOpen(false);}}><ReactionArt id={reaction.id} still/><strong>{reaction.name}</strong></button>)}</div></div>,document.body)}</div>,slot)}{bubble&&<div className="pvp-reaction-bubble pvp-reaction-bubble--you" role="status"><ReactionArt id={bubble}/><small>Local preview</small></div>}</>;
}
function PreviewBattle({ count,large,choices,pvp,yourTurn,clockPreview,feedbackMode,onTurn,onInspect }: {
  count:number;large:boolean;choices:boolean;pvp:boolean;yourTurn:boolean;clockPreview:number;feedbackMode:FeedbackPreview;onTurn:(value:boolean)=>void;onInspect:(card:CardInstance)=>void;
}) {
  const [liveMatch,setMatch]=useState<ReturnType<typeof sampleMatch>>(()=>{const m=sampleMatch(count,choices);return !large?m:{...m,boards:m.boards.map(board=>board.map(c=>({...c,basePower:c.owner==='player'?85:65,powerModifier:0}))) as typeof m.boards};});
  const sample=useMemo(()=>feedbackSample(count,feedbackMode),[count,feedbackMode]);
  const match=sample?.match??liveMatch,effect=sample?.effect??null;
  const [selected,setSelected]=useState<string|null>(null),[lane,setLane]=useState<Lane|null>(null),[squabble,setSquabble]=useState(false),[fast,setFast]=useState(false);
  const online:OnlineBattlePresentation|undefined=pvp?{
    playerIdentity:{name:'KyleOnTheBlock',hero:'kyle',level:18,rankPoints:740,banner:{cardId:'kyle'}},rivalIdentity:{name:'GuapDad',hero:'guap',level:19,rankPoints:1640,banner:{cardId:'guap'}},
    districts:getMatchDistricts(match),scores:getDistrictResults(match),
    costs:Object.fromEntries(match.playerHand.map(card=>[card.instanceId,([0,1,2] as Lane[]).map(l=>getLegalCardCost(match,'player',card,l)) as [number,number,number]])),
    lockedLanes:[],covered:new Set(),history:match.effectLog,turnSeconds:ONLINE_TURN_SECONDS,clockRunning:feedbackMode==='live'&&clockPreview>=0,yourTurn,mode:'ranked',status:feedbackMode==='live'?(yourTurn?'Your turn':'The Opps’ turn'):feedbackMode==='round'?'Round 3 settled':'Move resolving',rivalHandCount:5,
  }:undefined;
  const play=(id:string,target:Lane,armed:boolean,investment=0)=>{if(!yourTurn)return;setMatch(m=>playTurnCard(m,'player',id,target,armed,investment));setSelected(null);setLane(null);setSquabble(false);};
  return <div className="type-battle" data-preview-mode={pvp?'pvp':'training'}><Battle match={match} deck={decks[0]} rivalDeck={decks[1]} online={online}
    selectedInstanceId={selected} setSelectedInstanceId={setSelected} selectedLane={lane} setSelectedLane={setLane} squabble={squabble} setSquabble={setSquabble}
    onPlayCard={play} commit={()=>{if(selected&&lane!==null)play(selected,lane,squabble);}} endTurn={()=>{setSelected(null);setLane(null);onTurn(false);}}
    setInspect={onInspect} onShowRules={noop} presentationPhase={feedbackMode==='round'?'round-result':effect?'effects':yourTurn?'player-ready':'rival-thinking'} phaseMessage={feedbackMode==='round'?'Round 3 settled':effect?.note??(yourTurn?'Choose a fighter':'The Opps are choosing')} activeEffect={effect} activeEffectId={effect?.cardInstanceId} activeEffectLane={effect?.lane} impactLane={effect?.lane}
    timerEnabled timerSeconds={pvp?Math.max(0,clockPreview):20} battleSpeed={fast?1.5:1} onToggleBattleSpeed={()=>setFast(v=>!v)} skipSequence={()=>onTurn(true)}/>{pvp&&<PreviewReactions/>}</div>;
}
function Audition() {
  const [selection,setSelection]=useState(initialSelection);
  const [palette,setPalette]=useState<'ink'|'current'>('ink');
  const [crewSize,setCrewSize]=useState(2);
  const [view,setView]=useState<'cards'|'battle'|'pvp'|'decks'|'fonts'|'system'>('cards');
  const [controls,setControls]=useState(true),[large,setLarge]=useState(false),[sheet,setSheet]=useState('all');
  const [clockPreview,setClockPreview]=useState(ONLINE_TURN_SECONDS);
  const [feedbackMode,setFeedbackMode]=useState<FeedbackPreview>('live');
  const [choiceSamples,setChoiceSamples]=useState(false),[previewRun,setPreviewRun]=useState(0),[previewYourTurn,setPreviewYourTurn]=useState(true);
  const [inspect,setInspect]=useState<Card|CardInstance|null>(null),[deck,setDeck]=useState(decks[0].id);
  const lineups=useMemo(()=>[...decks.slice(0,4).map(d=>({id:d.id,name:d.name,heroCardId:d.hero,cardIds:d.cards.map(id=>catalogCardByEngineId[id].catalogId)})),{id:'default-box',name:'YOUR CUSTOM DECK',heroCardId:'cornball',cardIds:decks[0].cards.map(id=>catalogCardByEngineId[id].catalogId),subtitle:'DEFAULT BOX PREVIEW'}],[]);
  useEffect(()=>{
    const root=document.documentElement;
    const properties:Record<string,string>={};
    for(const role of UI_TYPE_ROLES){const font=fontById.get(selection[role.id])!;properties[role.fontToken]=font.family;properties[role.weightToken]=String(font.weight);root.dataset[`${role.id}Font`]=font.id;}
    properties['--font-lane-number-scale']=String(fontById.get(selection.lane)?.laneScale??1);
    properties['--font-lane-number-digit-width']=String(fontById.get(selection.lane)?.digitAdvanceEm||.75);
    properties['--font-card-number-synthesis']=selection.card==='classic'?'auto':'none';
    const previous=Object.keys(properties).map(key=>[key,root.style.getPropertyValue(key)]);
    Object.entries(properties).forEach(([key,value])=>root.style.setProperty(key,value));
    try{localStorage.setItem('squabblemon:typography-audition:v2',JSON.stringify(selection));}catch{}
    return()=>{previous.forEach(([key,value])=>value?root.style.setProperty(key,value):root.style.removeProperty(key));UI_TYPE_ROLES.forEach(r=>delete root.dataset[`${r.id}Font`]);};
  },[selection]);
  useEffect(()=>{const root=document.documentElement;const old=root.dataset.battlePalette;root.dataset.battlePalette=palette;return()=>{if(old)root.dataset.battlePalette=old;else delete root.dataset.battlePalette;};},[palette]);
  const choose=(role:UiTypeRole,id:string)=>{if(fontById.get(id)?.roles.includes(role))setSelection(s=>({...s,[role]:id}));};
  const navigate=(next:typeof view)=>{setView(next);setPreviewYourTurn(true);if(next==='battle'||next==='pvp')setControls(false);};
  return <main className="type-audition">
    <details className="type-controls" open={controls} onToggle={e=>setControls(e.currentTarget.open)}>
      <summary>TYPE SYSTEM <span>{UI_TYPE_ROLES.map(r=>fontById.get(selection[r.id])?.label).join(' / ')}</span></summary>
      <div className="type-controls__fields">{UI_TYPE_ROLES.map(role=><label key={role.id}>{role.label}<select aria-label={`${role.label} font`} value={selection[role.id]} onChange={e=>choose(role.id,e.target.value)}>{fonts.filter(f=>f.roles.includes(role.id)).map(f=><option key={f.id} value={f.id}>{f.label}</option>)}</select></label>)}</div>
      <label>Cards per lane side<select aria-label="Cards per lane side" value={crewSize} onChange={e=>{setCrewSize(Number(e.target.value));}}>{[0,1,2,3,4,5,8,12].map(n=><option key={n} value={n}>{n}</option>)}</select></label>
      <div className="type-presets">{presets.map(p=><button key={p.label} onClick={()=>setSelection({...p.value})}>{p.label}</button>)}<label><input type="checkbox" checked={large} onChange={e=>setLarge(e.target.checked)}/>Large totals</label></div>
      <div className="type-palette" role="group" aria-label="Battle palette"><span>Palette</span><button aria-pressed={palette==='current'} onClick={()=>setPalette('current')}>Current palette</button><button aria-pressed={palette==='ink'} onClick={()=>setPalette('ink')}>Ink + Motion</button></div>
    </details>
    <nav className="type-tabs" aria-label="Audition view">{(['cards','battle','pvp','decks','fonts','system'] as const).map(v=><button key={v} aria-pressed={view===v} onClick={()=>navigate(v)}>{v==='pvp'?'PvP':v[0].toUpperCase()+v.slice(1)}</button>)}<button aria-pressed={choiceSamples} onClick={()=>{setChoiceSamples(v=>!v);setPreviewYourTurn(true);if(view!=='battle'&&view!=='pvp')navigate('battle');}}>Choice cards</button>{(view==='battle'||view==='pvp')&&<><button onClick={()=>{setPreviewRun(v=>v+1);setPreviewYourTurn(true);}}>Reset board</button><select aria-label="Header update preview" value={feedbackMode} onChange={e=>setFeedbackMode(e.target.value as FeedbackPreview)}><option value="live">Live board</option><option value="move">Move update</option><option value="combo">Combo layout</option><option value="round">Round result</option></select>{view==='pvp'&&<button onClick={()=>setPreviewYourTurn(v=>!v)}>{previewYourTurn?'Show The Opps’ turn':'Show your turn'}</button>}{view==='pvp'&&<select aria-label="Preview clock" value={clockPreview} onChange={e=>setClockPreview(Number(e.target.value))}>{[ONLINE_TURN_SECONDS,31,30,20,6,5,1,0,-1].map(n=><option key={n} value={n}>{n<0?'Clock paused':n+' second'+(n===1?'':'s')}</option>)}</select>}</>}<button onClick={()=>setInspect(createCardInstance('folks','player','hand',0))}>Details</button></nav>
    <div className="type-surface">
      {view==='cards'&&<section className="type-cards" aria-label="Battle card samples">{cards.map(id=><button key={id} aria-label={`View ${catalogCardByEngineId[id].name} details`} onClick={()=>setInspect(createCardInstance(id,'player','hand',0))}><CardView card={createCardInstance(id,'player','hand',0)} effectivePower={large?128:undefined} presentationOnly disableLayout/></button>)}</section>}
      {(view==='battle'||view==='pvp')&&<PreviewBattle key={`${view}:${crewSize}:${large}:${choiceSamples}:${previewRun}`} count={crewSize} large={large} choices={choiceSamples} pvp={view==='pvp'} yourTurn={previewYourTurn} clockPreview={clockPreview} feedbackMode={feedbackMode} onTurn={value=>{setPreviewYourTurn(value);if(value)setFeedbackMode('live');}} onInspect={setInspect}/>}
      {view==='decks'&&<section className="type-decks"><DeckCarousel key={selection.deck} decks={lineups} selectedId={deck} onSelect={setDeck} onOpen={setDeck}/></section>}
      {view==='fonts'&&<section className="type-library">
        <header><h1>LIVE FONT LIBRARY</h1><select aria-label="Font preview" value={sheet} onChange={e=>setSheet(e.target.value)}><option value="all">All new additions</option>{additions.map(f=><option key={f.id} value={f.id}>{f.label}</option>)}</select></header>
        {additions.filter(f=>sheet==='all'||sheet===f.id).map(font=><figure className="type-font-preview" key={font.id}>
          <header><div><h2>{font.label}</h2><p>{font.digits?'Numbers + titles':'Titles · no numeric glyphs in this file'} · Live font</p></div></header>
          <div className="type-font-preview__samples">{UI_TYPE_ROLES.filter(role=>font.roles.includes(role.id)).map(role=><article key={role.id}>
            <small>{role.label}</small>
            <div className="type-font-preview__sample" style={{fontFamily:font.family,fontWeight:font.weight}}>{role.id==='card'?'4 12 +3 128':role.id==='lane'?'128 / 96':role.id==='deck'?'THE BLOCK IS HOT':'UNDERGROUND RING'}</div>
            <button onClick={()=>{choose(role.id,font.id);navigate(role.id==='card'?'cards':role.id==='deck'?'decks':'battle');}}>Use {font.label} for {role.label}</button>
          </article>)}</div>
        </figure>)}
      </section>}
      {view==='system'&&<section className="type-system"><h1>FOUR ROLES. INDEPENDENT CHOICES.</h1><div className="type-role-grid">{UI_TYPE_ROLES.map(r=><article key={r.id}><small>{r.label}</small><h2>{fontById.get(selection[r.id])?.label}</h2><p>{r.rule}</p><code>{r.fontToken}</code></article>)}</div><h2>Battle cards</h2><p>Element, identity, Motion, Hands and active effects. Rarity and finish labels stay in collection and details. The element label has its own slot for the new artwork.</p><h2>Font admission</h2><p>Numeral roles require genuine digits. Title-only fonts stay out of number controls. Every family is available live in its eligible role. Font choices remain independent and are saved on this device.</p><p>All eight supplied families are live, including Hemi Head and DX Brutalist. EASTER, DASH, Estrella and Adecko lack digits in these files, so they appear in title controls. Purchased font files are optimized to WOFF2 for the audition.</p><h2>Stable defaults</h2><p>Approved: Hemi Head Italic card stats and location Hands, M290 deck names, Blzee location titles and Hemi Head action signs. Body text, gameplay rules, supplied logos and card names keep their existing treatment.</p></section>}
    </div>
    {inspect&&<Suspense fallback={<div role="status">Opening details…</div>}><Inspector card={inspect} onClose={()=>setInspect(null)}/></Suspense>}
  </main>;
}
const root=createRoot(document.getElementById('root')!);
const query=new QueryClient({defaultOptions:{queries:{retry:false}}});
root.render(<QueryClientProvider client={query}><Audition/></QueryClientProvider>);
if(import.meta.hot)import.meta.hot.dispose(()=>root.unmount());
