import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Battle } from '../src/components/Battle';
import { CardInspector } from '../src/components/CardInspector';
import { DeckWorkbench } from '../src/components/DeckWorkbench';
import { MultiplayerBattle } from '../src/components/MultiplayerBattle';
import { createMatch, createCardInstance, playTurnCard, type CardInstance, type Lane } from '../src/gameEngine';
import { createOnlineRoom, joinOnlineRoom, applyOnlineCommand, onlineRoomView } from '@workspace/squabblemon-engine/multiplayer';
import { cardCatalog, decks, ROOKIE_CORE_IDS } from '../src/data';
import { CARD_HOLD_MS } from '../src/lib/cardGestures';
import '../src/index.css';
import '../src/styles/multiplayer.css';

function Solo({ waiting }: { waiting: boolean }) {
  const [match, setMatch] = useState(() => {
    const state = createMatch('block', 'vibes');
    state.playerHand = ['cornball', 'plug', 'roaster', 'wifey', 'hooper'].map((id, i) => createCardInstance(id, 'player', 'inspect', i));
    return state;
  });
  const [selected, setSelected] = useState<string | null>(null), [lane, setLane] = useState<Lane | null>(null), [squabble, setSquabble] = useState(false);
  const [inspect, setInspect] = useState<CardInstance | null>(null);
  const play = (id: string, target: Lane, armed: boolean) => { setMatch(current => playTurnCard(current, 'player', id, target, armed)); setSelected(null); setLane(null); };
  return <><Battle match={match} deck={decks[0]} rivalDeck={decks[1]} selectedInstanceId={selected} setSelectedInstanceId={setSelected} selectedLane={lane} setSelectedLane={setLane}
    squabble={squabble} setSquabble={setSquabble} onPlayCard={play} commit={() => { if (selected && lane !== null) play(selected, lane, squabble); }}
    presentationPhase={waiting ? 'rival-thinking' : 'player-ready'} phaseMessage="Card gesture test" timerEnabled={false} setInspect={setInspect} onShowRules={() => {}} />
    {inspect && <CardInspector card={inspect} match={match} onClose={() => setInspect(null)} />}</>;
}
function Online() {
  const [room, setRoom] = useState(() => {
    const now = Date.now(), deck = decks.find(deck => deck.id === 'block')!;
    let state = joinOnlineRoom(createOnlineRoom({userId:'host',name:'Host',ready:false,deck},'player',now),{userId:'guest',name:'Guest',ready:false,deck},now);
    state = applyOnlineCommand(state,'player',{type:'ready'},now);
    return applyOnlineCommand(state,'cpu',{type:'ready'},now);
  });
  return <MultiplayerBattle room={onlineRoomView(room,'TEST','host',Date.now())} busy={false} connected reducedMotion send={command => setRoom(current => applyOnlineCommand(current,'player',command,Date.now()))} onLeave={() => {}} />;
}
async function waitForDialog() { for(let i=0;i<60 && !document.querySelector('[role=dialog]');i++) await pause(50); }
const pause = (ms = 35) => new Promise(resolve => setTimeout(resolve, ms));
const check = (value: unknown, message: string) => { if (!value) throw new Error(message); };
const find = (selector: string) => { const element = document.querySelector<HTMLElement>(selector); if (!element) throw new Error(`Missing ${selector}`); return element; };
let pointerId = 100;
function pointer(source: HTMLElement, type: string, pointerType: string, dx = 0, dy = 0, id = pointerId) {
  const rect = source.getBoundingClientRect();
  source.dispatchEvent(new PointerEvent(type, {bubbles:true,cancelable:true,isPrimary:id===pointerId,pointerId:id,pointerType,button:0,buttons:type === 'pointerup' ? 0 : 1,clientX:rect.x+rect.width/2+dx,clientY:rect.y+rect.height/2+dy}));
}
const click = (source: HTMLElement) => source.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,detail:1}));
async function closeDetails() {
  const button = document.querySelector<HTMLElement>('[data-testid=button-close-inspector]') ?? [...document.querySelectorAll('button')].find(button => button.textContent === 'Back to battle');
  check(button,'Close control exists');
  pointerId++; pointer(button!,'pointerdown','mouse'); pointer(button!,'pointerup','mouse'); click(button!); await pause();
  check(!document.querySelector('[role=dialog]'),'Details close normally after release');
}
function Fixture() {
  const [mode, setMode] = useState('deck'), [run, setRun] = useState(0), [results,setResults] = useState<string[]>([]), [busy,setBusy] = useState(false);
  async function verify() {
    setBusy(true); setResults([]);
    const pass = (message: string) => setResults(items => [...items, `PASS ${message}`]);
    try {
      for (const view of ['deck','solo','waiting','online']) {
        setMode(view); setRun(value=>value+1); await pause(150);
        const selector = view === 'deck' ? '[data-testid=deck-roster-grid] button[aria-label^="Replace"]' : view === 'online' ? '[data-testid=online-hand] [data-card-id]' : '[data-testid=hand-tray] [data-card-id]';
        const card = find(selector); card.scrollIntoView({block:'nearest'}); await pause(60);
        for (const kind of ['mouse','touch','pen']) {
          pointerId++; pointer(card,'pointerdown',kind); await pause(CARD_HOLD_MS+60); await waitForDialog();
          check(document.querySelector('[role=dialog]'),`${view}/${kind}: hold opens details`);
          check(card.getAttribute('aria-pressed') !== 'true',`${view}/${kind}: hold did not select`);
          pointer(card,'pointerup',kind);
          click(find('[role=dialog]')); await pause();
          check(document.querySelector('[role=dialog]'),`${view}/${kind}: release did not dismiss dialog`);
          check(!document.querySelector('[data-testid=battle-drag-preview]'),`${view}/${kind}: no drag remains`);
          await closeDetails(); pass(`${view}: ${kind} hold inspects without selecting or releasing into an action`);
        }
        pointerId++; pointer(card,'pointerdown','touch'); pointer(card,'pointercancel','touch'); await pause(CARD_HOLD_MS+60);
        check(!document.querySelector('[role=dialog]'),`${view}: cancelled gesture does not inspect`); pass(`${view}: pointer cancellation`);
        pointerId++; pointer(card,'pointerdown','mouse'); window.dispatchEvent(new Event('blur')); await pause(CARD_HOLD_MS+60);
        check(!document.querySelector('[role=dialog]'),`${view}: blur cancels hold`); pass(`${view}: blur cancels hold`);
        pointerId++; pointer(card,'pointerdown','touch'); pointer(card,'pointerdown','touch',0,0,pointerId+1); await pause(CARD_HOLD_MS+60);
        pointer(card,'pointercancel','touch'); check(!document.querySelector('[role=dialog]'),`${view}: second finger cancels hold`); pass(`${view}: second finger cancels hold`);
        if(view === 'deck') {
          pointerId++; pointer(card,'pointerdown','touch'); pointer(card,'pointermove','touch',30,1); pointer(card,'pointerup','touch',30,1); click(card); await pause(CARD_HOLD_MS+60);
          check(!document.querySelector('[role=dialog]') && card.getAttribute('aria-pressed')==='false','Scroll neither inspects nor changes lineup'); pass('deck: moving cancels hold without changing lineup');
        }
        if(view !== 'waiting') {
          pointerId++; pointer(card,'pointerdown','mouse'); pointer(card,'pointerup','mouse'); click(card); await pause();
          check(card.getAttribute('aria-pressed')==='true',`${view}: quick tap selects`); pass(`${view}: ordinary tap still selects`);
        }
        if(view === 'solo') {
          const expensive=find('[data-testid=hand-tray] [data-card-id=hooper]');
          expensive.scrollIntoView({block:'nearest',inline:'center'}); await pause(100);
          pointerId++; pointer(expensive,'pointerdown','touch'); await pause(CARD_HOLD_MS+60); await waitForDialog();
          check(document.querySelector('[role=dialog]')?.getAttribute('aria-label')==='Hooper battle details','Unaffordable cards remain inspectable');
          pointer(expensive,'pointerup','touch'); click(expensive); await closeDetails(); pass('solo: unaffordable cards can be inspected');
          card.scrollIntoView({block:'nearest',inline:'center'}); await pause(100);
          pointerId++; pointer(card,'pointerdown','mouse');
          const lane=find('[data-drop-lane="0"]'); const from=card.getBoundingClientRect(), to=lane.getBoundingClientRect();
          const dx=to.x+to.width/2-from.x-from.width/2, dy=to.y+to.height/2-from.y-from.height/2;
          pointer(card,'pointermove','mouse',dx,dy); await pause(CARD_HOLD_MS+60);
          check(!document.querySelector('[role=dialog]'),'Drag cancels the hold timer');
          card.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,cancelable:true,isPrimary:true,pointerId,pointerType:'mouse',button:0,buttons:0,clientX:to.x+to.width/2,clientY:to.y+to.height/2})); await pause();
          check(document.querySelector('[data-testid^=card-board-player-0-cornball]'),'Drag still plays a card'); pass('solo: dragging plays exactly once without opening details');
        }
      }
      // An owned recruit in the lineup must not be swapped in by a hold.
      setMode('deck'); setRun(value=>value+1); await pause(150);
      const slot=find('[data-testid=deck-roster-grid] button[aria-label^="Replace"]'); click(slot); await pause();
      const before=find('[data-testid=deck-roster-grid]').textContent;
      const recruit=find('[data-testid=deck-collection-grid] button[aria-label^="Add"]'); recruit.scrollIntoView({block:'center'}); await pause(60);
      pointerId++; pointer(recruit,'pointerdown','touch'); await pause(CARD_HOLD_MS+60); await waitForDialog(); check(document.querySelector('[role=dialog]'),'Recruit details opened');
      pointer(recruit,'pointerup','touch'); click(recruit); await pause();
      check(find('[data-testid=deck-roster-grid]').textContent===before,'Holding a recruit never replaces the selected slot');
      await closeDetails(); pass('deck: inspecting a recruit preserves the selected lineup');
      setResults(items=>[...items,'ALL CHECKS PASSED']);
    } catch(error) { setResults(items=>[...items,`FAIL ${String(error)}`]); }
    finally { setBusy(false); }
  }
  return <><header style={{padding:12,background:'#181818',color:'white'}}><button disabled={busy} onClick={()=>void verify()}>Run gesture checks</button>{['deck','solo','waiting','online'].map(value=><button disabled={busy} key={value} onClick={()=>{setMode(value);setRun(run+1)}} style={{marginLeft:16}}>{value}</button>)}<pre role="status" data-testid="gesture-results" style={{whiteSpace:'pre-wrap',maxHeight:80,overflow:'auto',fontSize:11}}>{results.join('\n')}</pre></header>
    <main key={`${mode}:${run}`} style={{height:'calc(100dvh - 160px)',color:'white'}}>{mode==='deck' ? <DeckWorkbench initial={{name:'Gesture Test',cardIds:[...ROOKIE_CORE_IDS],heroCardId:'hooper',recipeId:null}} ownedCardIds={cardCatalog.map(card=>card.catalogId)} equippedVariants={{}} onSave={async()=>{}} onTest={async()=>{}} /> : mode==='online' ? <Online /> : <Solo waiting={mode==='waiting'} />}</main></>;
}
const root = createRoot(document.getElementById('root')!);
root.render(<QueryClientProvider client={new QueryClient()}><Fixture /></QueryClientProvider>);
import.meta.hot?.dispose(() => root.unmount());
