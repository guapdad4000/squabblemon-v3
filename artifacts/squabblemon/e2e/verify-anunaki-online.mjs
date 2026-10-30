import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

const origin = 'http://127.0.0.1:4196';
const output = process.env.ANUNAKI_ONLINE_OUTPUT ?? '/tmp/anunaki-full-browser';
await mkdir(output, {recursive:true});
const browser = await chromium.launch({executablePath:process.env.BROWSER_PATH ?? '/usr/bin/google-chrome'});
const pages=[], contexts=[], errors=[], played=[], observations=[];
try {
  for (const [i,seat] of ['a','b'].entries()) {
    const context=await browser.newContext({viewport:i?{width:390,height:844}:{width:1440,height:1000},reducedMotion:'reduce',extraHTTPHeaders:{'x-squabblemon-capabilities':'anunaki-v1'}});
    await context.addCookies([{name:'online_test_seat',value:seat,url:origin}]);
    await context.addInitScript(()=>localStorage.setItem('squabblemon_e2e_user','signed-in'));
    const page=await context.newPage(); page.setDefaultTimeout(30000);
    page.on('pageerror',e=>errors.push(e.message)); contexts.push(context); pages.push(page);
  }
  const request=async(i,path,data)=>{
    const r=await contexts[i].request[data?'post':'get'](`${origin}/api/multiplayer${path}`,data?{data}:{});
    assert(r.ok(),`${r.status()} ${await r.text()}`); return r.json();
  };
  const created=await request(0,'',{deckId:'my-online-crew',requestId:randomUUID()});
  const code=created.code; assert(code);
  await request(1,`/${code}/join`,{deckId:'my-online-crew'});
  for(let i=0;i<2;i++) {const r=await request(i,`/${code}`);await request(i,`/${code}/actions`,{requestId:randomUUID(),expectedRevision:r.revision,command:{type:'ready'}});}
  const enter=async page=>{if(await page.getByTestId('match-arrival').count())await page.getByTestId('match-arrival').click();};
  for(const page of pages){await page.goto(`${origin}/game/online/${code}`);await page.getByTestId('online-battle').waitFor();await enter(page);}
  let reconnectChecked=false;
  for(let turn=0;turn<12;turn++) {
    let state=await request(0,`/${code}`);if(state.status==='complete')break;
    const i=state.activeSeat==='player'?0:1,page=pages[i];
    await expect(page.getByTestId('online-battle')).toHaveAttribute('data-turn','you');
    if(turn===4){const before=await request(i,`/${code}`);await page.reload();await page.getByTestId('online-battle').waitFor();await enter(page);const after=await request(i,`/${code}`);assert.deepEqual(after.hand,before.hand);assert.deepEqual(after.boards,before.boards);reconnectChecked=true;}
    for(let play=0;play<10;play++) {
      state=await request(i,`/${code}`);
      const ordered = state.round === state.roundLimit ? [...state.hand].sort((a,b)=>Number(b.cardId==='anu')-Number(a.cardId==='anu')) : state.hand;
      const card=ordered.find(c=>c.costs.some((cost,l)=>cost<=state.motion[state.seat]&&!state.lockedLanes?.includes(l)));
      if(!card)break;
      const lane=[0,1,2].find(l=>card.costs[l]<=state.motion[state.seat]&&!state.lockedLanes?.includes(l));
      await page.locator(`[data-testid="hand-tray"] [data-instance-id="${card.instanceId}"]`).click();
      if(card.cardId==='yakub'&&!state.squabble[state.seat])await page.getByTestId('button-squabble').click();
      await page.getByTestId(`lane-${lane}`).click();
      const response=page.waitForResponse(r=>r.url().endsWith('/actions')&&r.request().method()==='POST');
      await page.getByTestId('button-lock').click(); assert.equal((await response).status(),200);
      played.push({seat:i,card:card.cardId,lane});
    }
    const ended=page.waitForResponse(r=>r.url().endsWith('/actions')&&r.request().method()==='POST');
    await page.getByTestId('button-next-round').click();assert.equal((await ended).status(),200);
    const a=await request(0,`/${code}`), b=await request(1,`/${code}`);
    assert.deepEqual(a.boards,b.boards);assert.deepEqual(a.scores,b.scores);
    observations.push({round:a.round,tablets:a.ancientTablets,events:a.events,board:a.boards});
    for(const [j,p] of pages.entries()){
      await expect(p.getByTestId('online-battle')).toHaveAttribute('data-revision',String(a.revision));
      if(a.status==='active') for(const [lane,score] of a.scores.entries()){
        await expect(p.getByTestId(`score-player-${lane}`)).toHaveText(String(score[j===0?'player':'cpu']));
        await expect(p.getByTestId(`score-cpu-${lane}`)).toHaveText(String(score[j===0?'cpu':'player']));
      }
    }
    if(turn===5)for(const [j,p] of pages.entries())await p.screenshot({path:`${output}/battle-${j}.png`});
  }
  const a=await request(0,`/${code}`),b=await request(1,`/${code}`);
  assert.equal(a.status,'complete');assert.equal(a.winner,b.winner);assert(reconnectChecked);
  assert(played.some(x=>x.card==='yakub'));assert(played.some(x=>x.card==='caucus-mountaineer'));assert(played.some(x=>x.card==='anu'));
  const notes=observations.flatMap(o=>o.events.map(e=>e.note));
  assert(notes.some(n=>n.includes('Consumed an Ancient Tablet')));
  assert(notes.some(n=>n.includes('radiation')));
  assert(notes.some(n=>n.includes('Summoned 2 free')));
  for(const [i,page]of pages.entries()){await page.screenshot({path:`${output}/result-${i}.png`});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
  assert.deepEqual(errors,[]);
  await writeFile(`${output}/report.json`,JSON.stringify({passed:true,scope:'Full app battle, automated UI input, local native PostgreSQL, injected test authentication; not production or physical hardware.',played,observations,reconnectChecked,final:a},null,2));
  console.log('Full Anunaki browser match passed:',output);
} catch(error) {
  for(const [i,p]of pages.entries()){await p.screenshot({path:`${output}/failure-${i}.png`}).catch(()=>{});await writeFile(`${output}/failure-${i}.txt`,await p.locator('body').innerText().catch(()=>''));}
  throw error;
} finally {await browser.close();}
