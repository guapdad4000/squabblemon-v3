const assert=require('node:assert/strict'); const {chromium}=require('playwright');
(async()=>{
 const b=await chromium.launch({channel:'msedge',headless:true}); const p=await b.newPage({viewport:{width:390,height:844}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:4179/squabblemon/play/guest');await p.getByTestId('button-start').click();await p.getByRole('button',{name:/^Continue past /}).click();
 for(let round=1;round<=6;round++) { console.log('Playing round',round);
  await p.waitForFunction(()=>document.querySelector('[data-testid="battle-arena"]')?.dataset.presentationPhase==='player-ready');
  const card=p.getByTestId('hand-tray').locator('[data-card-zone="hand"]:not([title])').first();
  if(await card.count()) {
   await card.click();await p.getByRole('button',{name:/^Deploy /}).first().click();if(round===1)await p.getByTestId('button-squabble').click();await p.getByTestId('button-lock').click();
   if(round===1){
    await p.waitForFunction(()=>document.querySelector('[data-testid="battle-arena"]')?.dataset.presentationPhase==='player-reveal');
    assert.equal(await p.getByTestId('score-player-0').innerText(),'0','Score changed before the hit');
    await p.waitForFunction(()=>document.querySelector('[data-testid="battle-arena"]')?.dataset.impactStrength==='squabble');
    await p.getByTestId('battle-power-change').first().waitFor();
    await p.screenshot({path:'screenshots/battle-squabble-phone.png'});
   }
  }else await p.getByTestId('button-next-round').click();
  for(let step=0;step<100;step++) {
   if(await p.getByTestId('status-match-result').count())break;
   if(await p.getByTestId('battle-arena').getAttribute('data-presentation-phase')==='player-ready')break;
   const skip=p.getByTestId('button-fast-forward'); const next=p.getByRole('button',{name:/^Continue past /});
   if(await skip.count())await skip.click({timeout:600}).catch(()=>{});else if(await next.count())await next.click({timeout:600}).catch(()=>{});
   await p.waitForTimeout(120);
  }
 }
 await p.getByTestId('status-match-result').waitFor();
 await p.screenshot({path:'screenshots/battle-full-match-result-phone.png'});
 if(!(await p.getByTestId('status-match-result').innerText()).toLowerCase().includes('nobody'))await p.getByTestId('winning-crew').waitFor();
 assert.deepEqual(errors,[]);console.log('Six-round phone match, synchronized Squabble score, fast-forward, result and crew passed');await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
