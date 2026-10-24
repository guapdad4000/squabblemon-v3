import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const out = process.env.REVIEW_OUTPUT ?? '/home/falcon/Documents/New project 9/output/v2-first-wave/boss';
const base = process.env.ARCADE_BASE_URL ?? 'http://127.0.0.1:4245';
await mkdir(out, {recursive:true});
const browser = await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH ?? '/usr/bin/google-chrome',args:['--enable-unsafe-swiftshader']});
const report=[];
const viewports=process.env.BOSS_VIEWPORT ? process.env.BOSS_VIEWPORT.split(',').map(value=>value.split('x').map(Number)) : [[1440,1000],[390,844],[320,568],[844,390]];
try {
for (const [width,height] of viewports) {
 const page=await browser.newPage({viewport:{width,height}}); const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/e2e/boss-raid.fixture.html?reset=1&demo=1');
 await page.locator('.raid-boss-figure').waitFor();
 await page.evaluate(()=>document.fonts.ready);
 await page.waitForTimeout(350);
 await page.screenshot({path:`${out}/${width}x${height}-precinct.png`});
 const sizes=await page.evaluate(()=>{
  const box=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom}};
  return {boss:box('.raid-boss-figure'), field:box('.raid-field'), hand:box('.raid-hand-dock'),overflow:document.documentElement.scrollWidth>innerWidth+1};
 });
 assert(!sizes.overflow,'no horizontal viewport overflow');
 assert(sizes.boss.height>=210,'boss has scene-scale presence');
 assert(sizes.hand.bottom<=height+1,'hand stays in viewport');
 assert.equal(await page.evaluate(()=>window.__raidMusic),'boss');
 assert.equal(await page.locator('.raid-overdrive-bar,.raid-overdrive-cutin').count(),0);
 await page.getByRole('button',{name:'Inspect Officer Oink tiers'}).click();
 await page.getByRole('dialog').waitFor();
 assert.equal(await page.locator('.raid-boss-figure .boss-idle-frames').evaluate(n=>getComputedStyle(n).animationName),'none');
 await page.keyboard.press('Escape');
 await page.getByRole('button',{name:/How to fight/}).click();
 await page.getByRole('dialog').waitFor();
 assert.equal(await page.locator('.raid-score-tiers').count(),1);
 await page.keyboard.press('Escape');
 // Every crowded formation remains reachable through its actual expanded view.
 for(const expand of await page.locator('.raid-formation-expand').all()) {
   await expand.click(); await page.locator('.raid-formation-dialog[open]').waitFor();
   const first=page.locator('.raid-formation-card .collector-card').first();
   await first.click(); await page.waitForTimeout(100);
   assert(await page.locator('.card-inspector,.card-inspector-backdrop,[data-testid="card-inspector"]').count() || await page.getByRole('dialog').count()>=2,'card detail opens');
   await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
 }
 await page.goto(base+'/e2e/boss-raid.fixture.html?reset=1&hp=1');
 await page.getByRole('button',{name:'FIGHT THE PRECINCT →'}).click();
 await page.locator('.raid-field').waitFor();
 const first=(await page.evaluate(()=>window.__raidLegal))[0];
 const before=await page.locator('.raid-field').boundingBox();
 await page.locator(`.raid-hand-card[data-instance="${first.instanceId}"]`).click();
 await page.locator(`.raid-lane[data-lane="${first.lane}"] .raid-deploy`).click();
 await page.locator('.raid-target-line path').last().waitFor();
 const after=await page.locator('.raid-field').boundingBox();
 assert(Math.abs(before.y-after.y)<1,'selection does not move field');
 await page.getByRole('button',{name:/PLAY CARD/}).click();
 await page.waitForFunction(id=>!window.__raid.match.playerHand.some(c=>c.instanceId===id),first.instanceId);
 const oldHp=await page.locator('.raid-hp').getAttribute('aria-valuenow');
 await page.getByRole('button',{name:'END TURN →'}).click();
 await page.locator('.raid-boss-scene[data-hit="true"]').waitFor();
 assert.equal(await page.locator('.raid-boss-figure').evaluate(n=>getComputedStyle(n).animationName),'raid-scene-stagger','real damage starts the bounded boss reaction');
 await page.emulateMedia({reducedMotion:'reduce'});
 const visual=await page.locator('.raid-boss-figure').evaluate(n=>({opacity:getComputedStyle(n).opacity,animation:getComputedStyle(n).animationName}));
 assert(Number(visual.opacity)>0,'reduced-motion boss never disappears on hit');
 assert.equal(visual.animation,'none');
 await page.locator('.raid-impact').waitFor({state:'attached'});
 const impact = await page.evaluate(()=>{
   const hit=document.querySelector('.raid-impact'); const anchor=document.querySelector('.raid-boss-impact-anchor').getBoundingClientRect();
   const point=new DOMPoint(Number(hit.getAttribute('cx')),Number(hit.getAttribute('cy'))).matrixTransform(hit.getScreenCTM());
   return {x:point.x,y:point.y,left:anchor.left,right:anchor.right,top:anchor.top,bottom:anchor.bottom};
 });
 assert(impact.x>=impact.left&&impact.x<=impact.right&&impact.y>=impact.top&&impact.y<=impact.bottom,`real strike targets the scene boss, not the inspection button: ${JSON.stringify(impact)}`);
 await page.screenshot({path:`${out}/${width}x${height}-reduced-impact.png`});
 await page.locator('.raid-results-popup').waitFor();
 assert.equal(await page.locator('.raid-results-reward > span').count(),3);
 assert.match(await page.locator('.raid-results-reward').innerText(),/500[\s\S]*5[\s\S]*50/);
 assert.equal(await page.locator('.raid-results-reward img').count(),3,'all actual currencies use existing reward art');
 assert(await page.locator('.raid-results-popup').evaluate(n=>getComputedStyle(n).getPropertyValue('--reward-file-scene').includes('underpass.webp')));
 await page.getByRole('button',{name:'Review battlefield'}).click();
 await page.locator('.raid-results-reopen').click();
 await page.locator('.raid-results-popup').waitFor();
 const receipt = await page.locator('.raid-results-popup').evaluate(n=>({height:n.clientHeight,scrollHeight:n.scrollHeight,width:n.clientWidth,scrollWidth:n.scrollWidth,actions:[...n.querySelectorAll('.raid-fire,.raid-results-inspect')].map(b=>{const r=b.getBoundingClientRect();return {top:r.top,bottom:r.bottom}})}));
 assert(receipt.scrollWidth<=receipt.width+1,'receipt does not scroll horizontally');
 if(width>600&&height<541) assert(receipt.actions.every(b=>b.top>=0&&b.bottom<=height),'short landscape receipt keeps both actions in view');
 await page.screenshot({path:`${out}/${width}x${height}-receipt.png`});
 await page.getByRole('button',{name:'BACK TO FADECADE →'}).click();
 assert.equal(await page.evaluate(()=>document.body.dataset.exited),'true');
 await page.evaluate(()=>window.__raidUnmount());
 assert.equal(await page.evaluate(()=>window.__raidMusic),null,'boss music override releases on unmount');
 await page.goto(base+'/e2e/boss-raid.fixture.html?reset=1&raid=kumite&demo=1');
 await page.locator('.raid-scene-portrait').waitFor();
 await page.waitForTimeout(250);
 assert.equal(await page.locator('.raid-boss-title h1').innerText(),'BUSHEDO BROWN');
 assert.match(await page.locator('.raid-lane-label').first().innerText(),/WEST DOJO/i);
 await page.screenshot({path:`${out}/${width}x${height}-kumite.png`});
 assert.deepEqual(errors,[]);
 report.push({width,height,...sizes,oldHp,reduced:visual,impact,receipt,errors});
 await page.close();
 console.log(`PASS ${width}x${height}: boss, cards, selection, tier clear, receipt, reduced, Kumite`);
}
} finally {await browser.close();await writeFile(out+(process.env.BOSS_VIEWPORT?'/boss-cinematic-targeted.json':'/boss-cinematic.json'),JSON.stringify(report,null,2));}
