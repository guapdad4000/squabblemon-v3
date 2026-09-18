const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const errors=[];
 try {
  for(const [name,width,height] of [['desktop',1280,900],['phone',390,844]]) {
   const page=await browser.newPage({viewport:{width,height}});
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:4179/squabblemon/e2e/choreography.fixture.html?mode=destroy');
   await page.getByTestId('character-attack').waitFor();
   await page.evaluate(()=>window.battleFixture.impact());
   await page.getByTestId('destroyed-card').waitFor({state:'attached'});
   assert.equal(await page.getByTestId('lane-1-cpu-zone').locator('[data-card-zone="board"]').count(),0);
   await page.getByTestId('battle-power-change').filter({hasText:'Destroyed'}).waitFor();
   await page.screenshot({path:`screenshots/battle-destruction-${name}.png`});
   await page.goto('http://127.0.0.1:4179/squabblemon/e2e/choreography.fixture.html?mode=crowded');
   await page.getByTestId('character-attack').waitFor();
   await page.evaluate(()=>window.battleFixture.ready());
   const stack=page.getByTestId('lane-0-player-zone').locator('.battle-card-stack');
   assert.equal(await stack.locator('[data-card-zone="board"]').count(),12);
   const metrics=await stack.evaluate(n=>({scroll:n.scrollHeight,height:n.clientHeight,overflow:getComputedStyle(n).overflowY}));
   assert.equal(metrics.overflow,'auto'); assert.ok(metrics.scroll>metrics.height,JSON.stringify(metrics));
   await page.getByRole('button',{name:'Inspect your crew in THE TOWN'}).click();
   await page.getByRole('dialog').waitFor();
   assert.equal(await page.getByRole('dialog').locator('[data-card-id]').count(),12);
   await page.keyboard.press('Escape');
   for(const [seconds,state] of [[20,'calm'],[10,'warning'],[5,'urgent']]) {
    await page.evaluate(seconds=>window.battleFixture.seconds(seconds),seconds);
    await page.locator(`[data-testid="decision-clock"][data-state="${state}"]`).waitFor();
   }
   await page.screenshot({path:`screenshots/battle-crowd-timer-${name}.png`});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await page.emulateMedia({reducedMotion:'reduce'});
   assert.equal(await page.getByTestId('decision-clock').locator('strong').evaluate(n=>getComputedStyle(n).animationName),'none');
   await page.close(); console.log(name,'destruction, 12-card crew scrolling, timer thresholds and reduced motion passed');
  }
  assert.deepEqual(errors,[]);
 } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
