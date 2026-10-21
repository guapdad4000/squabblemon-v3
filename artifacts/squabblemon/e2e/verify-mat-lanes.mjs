import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const out=process.env.MAT_LANE_OUTPUT ?? '/tmp/player-mat-lanes';
await mkdir(out,{recursive:true});
const playerMat=process.env.MAT_PLAYER ?? 'signature-buddy', rivalMat=process.env.MAT_RIVAL ?? 'signature-kyle';
const browser=await chromium.launch({headless:true});const results=[];
try {
 for(const [width,height] of [[320,568],[390,844],[768,1024],[844,390],[1280,800],[1920,1080]]) {
  const p=await browser.newPage({viewport:{width,height},hasTouch:width<600,reducedMotion:'reduce'});const errors=[];p.on('pageerror',e=>errors.push(e.message));
  for(const mode of ['pvp','training']) {
   await p.goto(`http://127.0.0.1:4228/e2e/art-recovery/fixture.html?${mode==='pvp'?'pvp&':''}playerMat=${playerMat}&rivalMat=${rivalMat}`,{waitUntil:'networkidle'});
   await p.locator('.battlefield-grid').waitFor();
   await p.locator('.battle-mat-characters img').first().waitFor();
   await p.locator('.battle-mat-characters img').evaluateAll(async imgs=>await Promise.all(imgs.map(img=>img.decode())));
   const geometry=await p.evaluate(()=>{
    const rect=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,b:r.bottom,r:r.right}};
    return {field:rect(document.querySelector('.battlefield-grid')),lanes:[...document.querySelectorAll('.district-lane')].map(el=>({lane:rect(el),art:[...el.querySelectorAll('.battle-lane-mat svg')].map(s=>({box:rect(s),view:s.getAttribute('viewBox'),aspect:s.getAttribute('preserveAspectRatio'),side:s.dataset.side}))})),characters:[...document.querySelectorAll('.battle-mat-characters img')].map(el=>({box:rect(el),side:el.dataset.side,fit:getComputedStyle(el).objectFit})),overflow:document.documentElement.scrollWidth>innerWidth+1};
   });
   assert(!geometry.overflow);assert.equal(geometry.characters.length,mode==='pvp'?2:1);
   for(const [i,l] of geometry.lanes.entries()) for(const a of l.art) {
    assert(Math.abs(a.box.x+a.box.w/2-l.lane.x-l.lane.w/2)<1,`${width}: lane${i} center`);
    assert(Math.abs(a.box.h-l.lane.h/(mode==='pvp'?2:1))<2,`${width}: equal halves`);
    assert.equal(a.view,`${i*512} 0 512 1024`);assert.equal(a.aspect,'xMidYMid slice');
   }
   for(const c of geometry.characters) {assert(c.box.x>=-1&&c.box.r<=width+1&&c.box.y>=0&&c.box.b<=height,`${width}: corner in viewport`);assert.equal(c.fit,'contain');}
   assert(Math.abs(geometry.characters.find(c=>c.side==='player').box.b-geometry.field.b)<2,`${width}: player stays above hand`);
   await p.screenshot({path:`${out}/${mode}-${width}.png`});
   if(mode==='pvp') {
    const trigger=p.getByRole('button',{name:'Choose a reaction'});await trigger.waitFor();
    const positions=await p.evaluate(()=>{const t=document.querySelector('.pvp-reaction-trigger').getBoundingClientRect(),m=document.querySelector('.battle-player-motion').getBoundingClientRect();return {right:t.right,left:m.left,w:t.width,h:t.height}});assert(positions.right<=positions.left+1);assert(positions.w>=44&&positions.h>=44);
    await trigger.click();await p.getByRole('button',{name:'Send Big W',exact:true}).waitFor();
    const box=await p.locator('.pvp-reaction-picker').boundingBox();assert(box.y>=0&&box.x>=0&&box.y+box.height<=height,`${width}: picker in viewport`);
    await p.screenshot({path:`${out}/reactions-${width}.png`});
    await p.getByRole('button',{name:'Send Big W',exact:true}).click();await p.locator('.pvp-reaction-bubble--you').waitFor();assert.equal(await trigger.getAttribute('aria-expanded'),'false');assert(await trigger.evaluate(el=>el===document.activeElement));
    await trigger.click();assert(await p.getByRole('button',{name:'Send Big W',exact:true}).isDisabled());await p.keyboard.press('Escape');assert.equal(await trigger.getAttribute('aria-expanded'),'false');
   }
   await p.locator('.battlefield-grid').evaluate(el=>el.scrollTop=el.scrollHeight);await p.waitForTimeout(100);
   const still=await p.locator('.battle-mat-character-anchor--player img').boundingBox();assert(Math.abs(still.y+still.height-geometry.field.b)<2);
   await p.locator('.battlefield-grid').evaluate(el=>el.scrollTop=0);
   await p.locator('.battle-hand-row [data-card-id="buddy"]').click();await p.getByTestId('lane-0').click({position:{x:25,y:25}});await p.getByRole('button',{name:/^Play card/}).click();assert.equal(await p.getByTestId('review-commits').textContent(),'1');
   results.push({width,height,mode,geometry});
  }
  assert.deepEqual(errors,[]);await p.close();
 }
 const p=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
 await p.goto('http://127.0.0.1:4228/e2e/art-recovery/fixture.html?pvp&seat-cpu&playerMat=signature-kyle&rivalMat=signature-buddy',{waitUntil:'networkidle'});
 await p.getByRole('button',{name:'Choose a reaction'}).click();await p.getByRole('button',{name:'Send Big W',exact:true}).click();await p.locator('.pvp-reaction-bubble--you').waitFor();
 await p.goto('http://127.0.0.1:4228/e2e/art-recovery/fixture.html?pvp&offline&playerMat=signature-buddy',{waitUntil:'networkidle'});await p.getByRole('button',{name:'Choose a reaction'}).click();assert(await p.getByText('Reconnect to send reactions.',{exact:true}).isVisible());
 await p.close();await writeFile(`${out}/checks.json`,JSON.stringify({passed:true,results,extra:['cpu seat emote send','offline state']},null,2));console.log(`Passed ${results.length} viewport/mode cases + CPU seat/offline emote checks`);
} finally {await browser.close();}
