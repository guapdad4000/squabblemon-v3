import { writeFile, unlink, mkdir } from 'node:fs/promises';
import { createServer } from 'vite';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
process.env.PORT='4204';process.env.BASE_PATH='/';
const fixture='e2e/dr-fade-harness.tsx';
await writeFile(fixture,"import React,{useState,useEffect} from 'react';\nimport {createRoot} from 'react-dom/client';\nimport {Battle} from '../src/components/Battle';\nimport {DrFadeWelcome} from '../src/components/DrFadeWelcome';\nimport {CardView} from '../src/components/CardView';\nimport {decks,cards} from '../src/data';\nimport {createMatch,DISTRICT_CATALOG,createCardInstance,playTurnCard} from '../src/gameEngine';\nimport '../src/index.css';\nconst snapshot={version:1,locations:['the-subway','county-jail','community-kitchen'].map(id=>structuredClone(DISTRICT_CATALOG.find(d=>d.id===id)))};\nconst source=createCardInstance('drfade','player','fade',0);\nconst enemy={...createCardInstance('landlord','cpu','fade',1),lane:0};\nconst ally={...createCardInstance('cornball','player','fade',2),lane:1};\nconst initial={...createMatch('block','vibes',undefined,undefined,snapshot),playerMotion:9,playerHand:[source],boards:[[enemy],[ally],[]]};\nconst resolved=playTurnCard(initial,'player',source.instanceId,0,true);\nconst hand=createCardInstance('hooper','player','fade',3);\nconst match={...resolved,playerMotion:9,playerHand:[hand],phase:'player'};\nconst base=resolved.effectLog.find(e=>e.cardId==='drfade'&&e.type==='ability'&&!e.abilityMetadata?.upgradeId);\nconst noop=()=>{};\nfunction Fixture(){\n const [selected,setSelected]=useState(hand.instanceId),[lane,setLane]=useState(2),[squabble,setSquabble]=useState(false),[tick,setTick]=useState(0);\n useEffect(()=>{const id=setInterval(()=>setTick(t=>t+1),90);return()=>clearInterval(id)},[]);\n if(location.search.includes('welcome'))return <DrFadeWelcome onContinue={()=>document.body.dataset.continued='true'}/>;\n if(location.search.includes('inspect'))return <div style={{height:'100dvh',display:'grid',placeItems:'center',background:'#091710'}}><div style={{width:'min(75vw,360px)'}}><CardView card={cards.drfade} isInspector fillContainer presentationOnly/></div></div>;\n return <div style={{height:'100dvh'}} data-poll={tick}><Battle match={match} deck={decks[0]} rivalDeck={decks[1]} selectedInstanceId={selected} setSelectedInstanceId={setSelected} selectedLane={lane} setSelectedLane={setLane} commit={()=>{document.body.dataset.confirmed='true'}} skipSequence={noop} presentationPhase='player-ready' phaseMessage='Your move' timerSeconds={20} timerEnabled={false} impactLane={0} stagedRival={null} stagedPlayer={null} activeEffectId={source.instanceId} activeEffectLane={0} activeEffect={{...base,targetIds:base.targets.map(t=>t.cardInstanceId),impact:true}} presentationScores={null} squabble={squabble} setSquabble={setSquabble} setInspect={noop} archiveMatch={noop} onShowRules={noop}/></div>\n}\ncreateRoot(document.getElementById('root')).render(<Fixture/>);");
const server=await createServer({server:{host:'127.0.0.1',port:4204,strictPort:true}});
let browser;
try {
 await server.listen();browser=await chromium.launch({channel:'msedge',headless:true});
 await mkdir('../../screenshots',{recursive:true});
 for(const [width,height,reduced] of [[390,700,false],[320,568,false],[844,390,false],[1280,900,false],[390,700,true]] as const){
  const page=await browser.newPage({viewport:{width,height},reducedMotion:reduced?'reduce':'no-preference',isMobile:width<600,hasTouch:width<600});
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/__fade**',async route=>route.fulfill({contentType:'text/html',body:await server.transformIndexHtml('/__fade','<html><head><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body><div id="root"></div><script type="module" src="/'+fixture+'"></script></body></html>')}));
  await page.goto('http://127.0.0.1:4204/__fade');
  const confirm=page.getByTestId('button-lock');await confirm.waitFor();
  const entrance=page.getByTestId('dr-fade-entrance');
  await entrance.waitFor({state:'attached'});
  assert(await confirm.evaluate(el=>{const r=el.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('[data-testid="button-lock"]')===el}),'animation never intercepts Confirm');
  await page.screenshot({path:'../../screenshots/dr-fade-impact-'+width+(reduced?'-reduced':'')+'.png'});
  await entrance.waitFor({state:'detached',timeout:1600});
  await page.waitForTimeout(300);assert.equal(await entrance.count(),0,'polling cannot restart the cue');
  await confirm.click();assert.equal(await page.locator('body').getAttribute('data-confirmed'),'true');
  await page.goto('http://127.0.0.1:4204/__fade?inspect');
  await page.waitForFunction(()=>[...document.querySelectorAll<HTMLImageElement>('.dr-fade-art img')].every(img=>img.complete&&img.naturalWidth>0));
  const proportions=await page.locator('.dr-fade-art__canvas').evaluate(el=>{const r=el.getBoundingClientRect();return r.width/r.height});
  assert(Math.abs(proportions-1008/1792)<.01,'layers retain original proportions');
  if(reduced)assert(await page.locator('.dr-fade-art__fighter').evaluate(el=>getComputedStyle(el).animationName==='none'));
  if(width===1280){await page.locator('[data-card-id="dr-fade"]').hover({position:{x:280,y:100}});}
  await page.screenshot({path:'../../screenshots/dr-fade-inspector-'+width+(reduced?'-reduced':'')+'.png'});
  if(width<600&&!reduced){
    await page.goto('http://127.0.0.1:4204/__fade?welcome');
    await page.getByRole('button',{name:'Build with Dr. Fade'}).click();
    assert.equal(await page.locator('body').getAttribute('data-continued'),'true');
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'welcome fits mobile width');
    await page.screenshot({path:'../../screenshots/dr-fade-welcome-polished-'+width+'.png',fullPage:true});
  }
  assert.deepEqual(errors,[]);console.log(width+'x'+height+(reduced?' reduced motion':'')+': artwork, Confirm, automatic dismissal and polling passed.');
  await page.close();
 }
}finally{await browser?.close();await server.close();await unlink(fixture);}
