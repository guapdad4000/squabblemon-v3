import {writeFile,unlink,mkdir} from 'node:fs/promises';
import {createServer} from 'vite';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
process.env.PORT='4206';process.env.BASE_PATH='/';
const fixture='e2e/buddy-folks-harness.tsx';
await writeFile(fixture,"import React,{useState} from 'react';\nimport {createRoot} from 'react-dom/client';\nimport {Battle} from '../src/components/Battle';\nimport {CardView} from '../src/components/CardView';\nimport {cards,decks} from '../src/data';\nimport {createMatch,createCardInstance,playTurnCard,DISTRICT_CATALOG} from '../src/gameEngine';\nimport '../src/index.css';\nconst id=new URLSearchParams(location.search).get('card')==='folks'?'folks':'buddy';\nconst source=createCardInstance(id,'player','duo',0);\nconst enemy={...createCardInstance('guap','cpu','duo',1),lane:0,basePower:8,power:8};\nconst distant={...createCardInstance('roaster','cpu','duo',2),lane:2};\nconst ally={...createCardInstance('hooper','player','duo',3),lane:1};\nconst districts={version:1,locations:['the-subway','county-jail','community-kitchen'].map(id=>structuredClone(DISTRICT_CATALOG.find(d=>d.id===id)))};\nconst initial={...createMatch('block','combo',undefined,undefined,districts),playerHand:[source],playerMotion:9,boards:[[enemy],[ally],[distant]]};\nconst noop=()=>{};\nfunction Fixture(){\n const [match,setMatch]=useState(initial),[selected,setSelected]=useState(source.instanceId),[lane,setLane]=useState(0),[squabble,setSquabble]=useState(false),[effect,setEffect]=useState(null);\n if(location.search.includes('inspect'))return <main style={{minHeight:'100dvh',background:'#111014',padding:24,display:'grid',placeItems:'center'}}><div style={{width:'min(80vw,360px)'}}><CardView card={cards[id]} isInspector fillContainer presentationOnly/></div></main>;\n const target=match.boards.flat().find(c=>c.instanceId===enemy.instanceId);\n return <div style={{height:'100dvh'}} data-testid='duo-board' data-hit={target?.powerModifier} data-burn={target?.statuses.burnStacks}><Battle match={match} deck={decks[0]} rivalDeck={decks[1]} selectedInstanceId={selected} setSelectedInstanceId={setSelected} selectedLane={lane} setSelectedLane={setLane} commit={()=>{const next=playTurnCard(match,'player',source.instanceId,lane,squabble);setMatch(next);const cue=next.effectLog.find(e=>e.cardId===id&&e.type==='ability');setEffect({...cue,targetIds:cue.targets.map(t=>t.cardInstanceId),impact:true});setSelected(null)}} skipSequence={noop} presentationPhase='player-ready' phaseMessage='Your move' timerSeconds={20} timerEnabled={false} impactLane={effect?0:null} stagedRival={null} stagedPlayer={null} activeEffectId={effect?source.instanceId:null} activeEffectLane={effect?0:null} activeEffect={effect} presentationScores={null} squabble={squabble} setSquabble={setSquabble} setInspect={noop} archiveMatch={noop} onShowRules={noop}/></div>\n}\ncreateRoot(document.getElementById('root')).render(<Fixture/>);");
const server=await createServer({server:{host:'127.0.0.1',port:4206,strictPort:true}});
let browser;
try{
 await server.listen();browser=await chromium.launch({channel:'msedge',headless:true});
 await mkdir('../../screenshots/buddy-folks',{recursive:true});
 for(const width of [320,390,1280]){
  const page=await browser.newPage({viewport:{width,height:850},isMobile:width<600,hasTouch:width<600});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/__duo**',async route=>route.fulfill({contentType:'text/html',body:await server.transformIndexHtml('/__duo','<html><head><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body><div id="root"></div><script type="module" src="/'+fixture+'"></script></body></html>')}));
  for(const card of ['buddy','folks']){
   await page.goto('http://127.0.0.1:4206/__duo?inspect&card='+card);
   await page.waitForFunction(()=>{const img=document.querySelector<HTMLImageElement>('.collector-portrait');return img?.complete&&img.naturalWidth>0});
   await page.getByText(card.toUpperCase(),{exact:true}).first().waitFor();
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'card fits screen');
   await page.screenshot({path:'../../screenshots/buddy-folks/'+card+'-'+width+'.png'});
   await page.goto('http://127.0.0.1:4206/__duo?card='+card);
   const confirm=page.getByTestId('button-lock');await confirm.click();
   await page.waitForFunction(({id,attribute,value})=>document.querySelector('[data-testid="'+id+'"]')?.getAttribute(attribute)===value,{id:'duo-board',attribute:card==='buddy'?'data-hit':'data-burn',value:card==='buddy'?'-5':'3'});
   await page.getByTestId('character-attack').waitFor();
   assert(await page.locator('.battle-choreography').evaluate(el=>getComputedStyle(el).pointerEvents==='none'),'attack cannot intercept controls');
  }
  assert.deepEqual(errors,[]);console.log(width+'px: both portraits, card text, playable battle effects and transparent controls passed.');
  await page.close();
 }
}finally{await browser?.close();await server.close();await unlink(fixture);}
