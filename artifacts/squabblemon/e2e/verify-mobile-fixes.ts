import { writeFile, unlink, mkdir } from 'node:fs/promises';
import { createServer } from 'vite';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
process.env.PORT='4203';process.env.BASE_PATH='/';
const fixture='e2e/mobile-fixes-harness.tsx';
await writeFile(fixture,`import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {Battle} from '../src/components/Battle';
import {Story} from '../src/pages/game/Story';
import {CinemaNavSheet} from '../src/components/venue/GameNav';
import {decks} from '../src/data';
import {createMatch,createDistrictSnapshot,DISTRICT_CATALOG,createCardInstance,playTurnCard} from '../src/gameEngine';
import {storyContent} from '@workspace/squabblemon-engine/story';
import {getGetPlayerStoryQueryKey} from '@workspace/api-client-react';
import '../src/index.css';
const client=new QueryClient({defaultOptions:{queries:{retry:false,staleTime:Infinity}}});
client.setQueryData(getGetPlayerStoryQueryKey(),{chapters:storyContent.chapters.map(c=>({...c,status:'available',clearedNodes:0,totalNodes:c.nodes.length})),nodes:storyContent.chapters.flatMap(c=>c.nodes.map(n=>({...n,nodeId:n.id,chapterId:c.id,status:'available',stars:0}))),recommendedNodeId:storyContent.chapters[0].nodes[0].id});
const profile={id:'layout-preview',settings:{reducedMotion:true},ownedCardIds:[]};
const snapshot={...createDistrictSnapshot('subway-mobile'),locations:['the-subway','county-jail','community-kitchen'].map(id=>DISTRICT_CATALOG.find(d=>d.id===id))};
const base=createMatch('block','vibes',undefined,undefined,snapshot);
let initial={...base,districtSnapshot:snapshot,playerMotion:8,playerHand:[createCardInstance('shiesty','player','block',1000),createCardInstance('hooper','player','block',2)]};
for(let i=1000;i<1128;i++){const c=createCardInstance('shiesty','player','block',i);const m=playTurnCard({...initial,playerHand:[c,...initial.playerHand.slice(1)]},'player',c.instanceId,0);if(m.boards[0].length>2){initial=m;break}}
const noop=()=>{};
function Fixture(){const [match,setMatch]=useState(initial),[selected,setSelected]=useState(null),[lane,setLane]=useState(null),[squabble,setSquabble]=useState(false);return location.search.includes('story')?<div style={{height:'100dvh'}}><Story bootstrap={{profile} as any}/></div>:<div style={{height:'100dvh'}}><Battle match={match} deck={decks[0]} rivalDeck={decks[1]} selectedInstanceId={selected} setSelectedInstanceId={setSelected} selectedLane={lane} setSelectedLane={setLane} commit={()=>{document.body.dataset.confirmed='true';setSelected(null)}} skipSequence={noop} presentationPhase='player-ready' phaseMessage='Your move' timerSeconds={20} timerEnabled={true} impactLane={null} stagedRival={null} stagedPlayer={null} activeEffectId={null} activeEffectLane={null} activeEffect={null} presentationScores={null} squabble={squabble} setSquabble={setSquabble} setInspect={noop} archiveMatch={noop} onShowRules={noop}/></div>}
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={client}><CinemaNavSheet location='/game/story' navigate={()=>{}} rewards={0}/><Fixture/></QueryClientProvider>);`);
const server=await createServer({server:{host:'127.0.0.1',port:4203,strictPort:true}});let browser;
try{
 await server.listen();browser=await chromium.launch({headless:true,channel:'msedge'});
 await mkdir('../../screenshots',{recursive:true});
 for(const [width,height] of [[390,700],[320,568],[844,390],[1280,900]]) {
  const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce',isMobile:width<601,hasTouch:width<601});const errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/__fixes**',async route=>route.fulfill({contentType:'text/html',body:await server.transformIndexHtml('/__fixes','<html><head><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body><div id="root"></div><script type="module" src="/'+fixture+'"></script></body></html>')}));
  await page.goto('http://127.0.0.1:4203/__fixes');await page.getByTestId('battle-arena').waitFor();
  await page.getByTestId('hand-tray').locator('[data-card-zone=hand]').first().click();await page.getByTestId('lane-0').click();
  const confirm=page.getByTestId('button-lock');await confirm.waitFor();
  await page.waitForFunction(()=>[...document.querySelectorAll<HTMLImageElement>('.battlefield-grid img.collector-portrait')].every(i=>i.complete && i.naturalWidth>0));
  const portraits=await page.locator('.battlefield-grid [data-card-id="shiesty-yn"] .collector-portrait').count();assert(portraits>=3,'original and cloned Shiestys render their portrait');
  const hit=await confirm.evaluate(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,bottom:r.bottom,right:r.right,visible:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('[data-testid=button-lock]')===el}});
  assert(hit.visible && hit.bottom<=height && hit.right<=width,'Confirm stays visible, inside screen and above artwork');
  const express=page.getByRole('button',{name:'Open game navigation'});
  assert.equal(await express.count(),0,'Express is tucked away while battle menu is closed');
  await page.getByRole('button',{name:'Open game navigation',includeHidden:true}).waitFor({state:'attached'});
  await page.getByLabel('Battle menu',{exact:true}).click();await express.click();await page.getByRole('dialog',{name:'Squabble Express'}).waitFor();await page.getByRole('button',{name:'Close game navigation'}).click();await page.getByLabel('Battle menu',{exact:true}).click();
  await page.screenshot({path:'../../screenshots/mobile-board-fixed-'+width+'.png'});if(width<601){const box=await confirm.boundingBox();assert(box);await page.touchscreen.tap(box.x+box.width/2,box.y+box.height/2)}else await confirm.click();assert.equal(await page.locator('body').getAttribute('data-confirmed'),'true');
  if(width!==844) {
   await page.goto('http://127.0.0.1:4203/__fixes?story');const strip=page.locator('.chapter-passes__strip');await strip.waitFor();
   assert(await strip.evaluate(el=>el.scrollWidth>el.clientWidth),'all unlocked chapters remain reachable');
   if(width<601){
    const box=await strip.boundingBox();assert(box);const active=await strip.locator('[aria-current=true] .chapter-pass__stub b').innerText();
    const touch=await page.context().newCDPSession(page);const x=box.x+box.width*.85,y=box.y+box.height/2;
    await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
    for(let step=1;step<=8;step++){await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-step*22,y}]});await page.waitForTimeout(16)}
    await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForFunction(()=>document.querySelector('.chapter-passes__strip')!.scrollLeft>20);
    assert.equal(await strip.locator('[aria-current=true] .chapter-pass__stub b').innerText(),active,'swiping does not select a chapter');await touch.detach();
   }
   await page.getByRole('button',{name:'Scroll to later chapters'}).click();await page.waitForFunction(()=>document.querySelector('.chapter-passes__strip')!.scrollLeft>0);
   await strip.focus();await page.keyboard.press('End');await page.waitForFunction(()=>{const e=document.querySelector('.chapter-passes__strip')!;return e.scrollLeft>=e.scrollWidth-e.clientWidth-2});
   await page.keyboard.press('Home');await page.waitForFunction(()=>document.querySelector('.chapter-passes__strip')!.scrollLeft===0);
   const rect=await strip.boundingBox();assert(rect);await page.mouse.move(rect.x+rect.width*.7,rect.y+40);await page.mouse.down();await page.mouse.move(rect.x+30,rect.y+40,{steps:8});await page.mouse.up();assert(await strip.evaluate(el=>el.scrollLeft>0));
   const before=await strip.evaluate(el=>el.scrollLeft);await page.mouse.wheel(0,250);await page.waitForFunction(before=>document.querySelector('.chapter-passes__strip')!.scrollLeft>before,before);
   await strip.evaluate(el=>{el.scrollLeft=0});await strip.locator('.chapter-pass').nth(1).click();assert.equal(await strip.locator('[aria-current=true] .chapter-pass__stub b').innerText(),'02');
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'story fits viewport');
   await page.screenshot({path:'../../screenshots/story-tickets-fixed-'+width+'.png'});
  }
  assert.deepEqual(errors,[]);console.log(width+'x'+height+': clone art, Confirm hit target'+(width!==844?', chapter arrows, keyboard, mouse drag, wheel, selection and overflow':'')+' passed.');await page.close();
 }
}finally{await browser?.close();await server.close();await unlink(fixture)}
