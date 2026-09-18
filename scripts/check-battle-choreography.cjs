const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const failures=[];
 for(const [name,width,height] of [['desktop',1280,900],['phone',390,844]]) {
  const page=await browser.newPage({viewport:{width,height}});
  page.on('pageerror',e=>failures.push(e.message));
  await page.goto('http://127.0.0.1:4179/squabblemon/e2e/choreography.fixture.html');
  await page.getByTestId('character-attack').waitFor();
  await page.waitForTimeout(300);
  assert.equal(await page.getByTestId('battle-power-change').count(),0);
  await page.evaluate(()=>window.battleFixture.impact());
  await page.getByTestId('battle-power-change').filter({hasText:'Frozen'}).waitFor();
  assert.ok(await page.locator('[data-card-zone="board"][data-frozen="true"]').count());
  await page.screenshot({path:`screenshots/battle-choreography-${name}.png`});
  const geometry=await page.evaluate(()=>{
   const target=[...document.querySelectorAll('[data-card-zone="board"]')].find(n=>n.dataset.instanceId===window.battleFixture.target).getBoundingClientRect();
   const ring=document.querySelector('[data-attack-target] circle');
   return {x:target.x+target.width/2,y:target.y+target.height/2,cx:+ring.getAttribute('cx'),cy:+ring.getAttribute('cy')};
  });
  assert.ok(Math.abs(geometry.x-geometry.cx)<5 && Math.abs(geometry.y-geometry.cy)<5,JSON.stringify(geometry));
  await page.evaluate(()=>window.battleFixture.ready());
  const cards=page.getByTestId('lane-0-player-zone').locator('[data-card-zone="board"]');
  assert.equal(await cards.count(),6);
  const rects=await cards.evaluateAll(nodes=>nodes.map(n=>{const b=n.getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height}}));
  for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++)assert.ok(rects[i].x+rects[i].w<=rects[j].x+1||rects[j].x+rects[j].w<=rects[i].x+1||rects[i].y+rects[i].h<=rects[j].y+1||rects[j].y+rects[j].h<=rects[i].y+1,'Cards overlap');
  await page.getByRole('button',{name:'Inspect your crew in THE TOWN'}).click();
  await page.getByRole('dialog').waitFor();
  assert.equal(await page.getByRole('dialog').locator('[data-card-id]').count(),6);
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({state:'detached'});
  await page.goto('http://127.0.0.1:4179/squabblemon/e2e/choreography.fixture.html?mode=move');
  await page.getByTestId('character-attack').waitFor();
  await page.evaluate(()=>window.battleFixture.impact());
  await page.locator('.attack-moving-card').waitFor();
  assert.ok(await page.locator('.attack-moving-card').evaluate(async n=>{await n.decode();return n.naturalWidth>0}));
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await page.locator('.attack-moving-card').evaluate(n=>getComputedStyle(n).display),'none');
  await page.goto('http://127.0.0.1:4179/squabblemon/e2e/choreography.fixture.html?mode=victory');
  await page.getByTestId('winning-crew').waitFor();
  assert.equal(await page.getByTestId('winning-crew').locator('figure').count(),3);
  console.log(name,'freeze, exact target, six-card formation, crew dialog, movement, reduced motion, winning crew passed');
  await page.close();
 }
 assert.deepEqual(failures,[]);await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
