process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY='1';
const assert=require('node:assert/strict');const {chromium}=require('playwright');
(async()=>{
 const b=await chromium.launch({channel:'msedge',headless:true});const errors=[];
 for(const [name,width,height]of[['phone',390,844],['desktop',1280,900]].filter(view=>!process.env.BATTLE_CHECK_VIEW||view[0]===process.env.BATTLE_CHECK_VIEW)){
  const p=await b.newPage({viewport:{width,height}});p.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.message)});
  await p.goto('http://127.0.0.1:4179/squabblemon/play/guest');await p.getByTestId('button-start').click();await p.getByRole('button',{name:/^Continue past /}).click();
  await p.waitForFunction(()=>document.querySelector('[data-testid="battle-arena"]')?.dataset.presentationPhase==='player-ready');
  await p.getByTestId('hand-tray').locator('[data-card-zone="hand"]:not([title])').first().click();
  await p.getByTestId('preview-lane-0').waitFor();await p.getByRole('button',{name:/^Deploy /}).first().click();
  const preview=await p.getByTestId('preview-lane-0').boundingBox();assert.ok(preview.y>=0&&preview.y+preview.height<=height);
  await p.screenshot({path:`screenshots/battle-preview-${name}.png`});
  await p.getByTestId('button-lock').click();
  await p.waitForFunction(()=>document.querySelector('[data-testid="battle-arena"]')?.dataset.presentationPhase==='player-reveal');
  assert.ok(await p.locator('.card-reveal-flip').count());
  for(let i=0;i<120;i++){
   if(await p.getByTestId('battle-arena').getAttribute('data-presentation-phase')==='player-ready')break;
   const skip=p.getByTestId('button-fast-forward');if(await skip.count())await skip.click({timeout:500}).catch(()=>{});await p.waitForTimeout(120);
  }
  await p.locator('[data-card-zone="board"]').first().click();await p.getByTestId('battle-power-breakdown').waitFor();
  assert.ok((await p.getByTestId('battle-power-breakdown').innerText()).includes('Contribution to district'));
  await p.screenshot({path:`screenshots/battle-inspection-${name}.png`});
  await p.keyboard.press('Escape');await p.getByTestId('card-inspector').waitFor({state:'detached'});
  for(const mode of ['thaw','chain']){
   await p.goto(`http://127.0.0.1:4179/squabblemon/e2e/choreography.fixture.html?mode=${mode}`);await p.getByTestId('character-attack').waitFor();
   if(mode==='chain'){await p.getByTestId('ability-chain').waitFor();assert.ok(await p.locator('.chain-link').count());}
   await p.evaluate(()=>window.battleFixture.impact());
   if(mode==='thaw'){await p.getByTestId('status-release').waitFor();assert.equal(await p.locator('[data-frozen="true"]').count(),0);}
  }
  console.log(name,'preview, reveal, contextual power inspector, thaw and chain passed');await p.close();
 }
 assert.deepEqual(errors,[]);await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
