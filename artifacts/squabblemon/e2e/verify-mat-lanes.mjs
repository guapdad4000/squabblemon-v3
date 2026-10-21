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
   await p.locator('.battle-player-mats img').evaluateAll(async imgs=>await Promise.all(imgs.map(img=>img.decode())));
   const geometry=await p.evaluate(()=>{
    const rect=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,b:r.bottom,r:r.right}};
    const root=document.querySelector('.battle-player-mats'), field=document.querySelector('.battlefield-grid'), lane=field.querySelector('.district-lane');
    return {root:rect(root),field:rect(field),lane:rect(lane),split:parseFloat(root.style.getPropertyValue('--mat-split')),layers:[...root.querySelectorAll('.player-mat-art')].map(el=>({box:rect(el),side:el.dataset.side,src:el.querySelector('img').currentSrc,fit:getComputedStyle(el.querySelector('img')).objectFit,position:getComputedStyle(el.querySelector('img')).objectPosition,visibleWidthFraction:Math.min(1,el.clientWidth/(el.clientHeight*el.querySelector('img').naturalWidth/el.querySelector('img').naturalHeight)),mask:getComputedStyle(el.parentElement).maskImage})),laneCopies:document.querySelectorAll('.battle-lane-mat').length,stickers:document.querySelectorAll('.player-mat-character,.battle-mat-characters').length,overflow:document.documentElement.scrollWidth>innerWidth+1};
   });
   assert(!geometry.overflow);assert.equal(geometry.laneCopies,0);assert.equal(geometry.stickers,0);
   assert.equal(geometry.layers.length,mode==='pvp'?2:1);
   for(const layer of geometry.layers){assert.equal(layer.fit,'cover');assert.equal(layer.position,'50% 50%');assert(Math.abs(layer.box.w-geometry.root.w)<1);}
   if(mode==='pvp'){
    const [a,b]=geometry.layers;
    if(width<=600&&height>width){
     assert(Math.abs(a.box.y-geometry.root.y)<1,'phone rival art starts at true top');
     assert(Math.abs(b.box.b-geometry.root.b)<1,'phone player art reaches true bottom');
     assert(Math.abs(a.box.h-b.box.h)<1,'phone halves retain a shared scale');
    }else{
     assert.deepEqual(a.box,b.box,'both worlds share one canvas');
     assert(Math.abs(a.box.y+a.box.h/2-geometry.root.y-geometry.split)<1,'source midpoint aligned to split');
    }
    assert(a.mask.includes('linear-gradient')&&b.mask.includes('linear-gradient'));
    assert.equal(a.side,'rival');assert.equal(b.side,'player');
   }else if(width<=600&&height>width){
    const art=geometry.layers[0].box;assert(Math.abs(art.y+art.h/2-geometry.field.y-geometry.field.h/2)<1,'training frames visible play area');
   }else assert.deepEqual(geometry.layers[0].box,geometry.root,'wide training has one full background');
   if(width<=600&&height>width)for(const layer of geometry.layers)assert(layer.visibleWidthFraction>=.45,'portrait shows at least 45% of the wide scene');
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
   const scrolled=await p.locator('.battle-player-mats').evaluate(el=>{const b=el.getBoundingClientRect(),lane=document.querySelector('.district-lane').getBoundingClientRect();return {actual:parseFloat(el.style.getPropertyValue('--mat-split')),expected:Math.max(0,Math.min(b.height,lane.top+lane.height/2-b.top))};});
   assert(Math.abs(scrolled.actual-scrolled.expected)<1,'split follows field scroll');
   if(width<=600&&height>width){const heightAfter=await p.locator('.battle-player-mats .player-mat-art').first().evaluate(el=>el.getBoundingClientRect().height);assert(Math.abs(heightAfter-geometry.layers[0].box.h)<1,'mobile camera scale stays steady while scrolling');}
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
 await p.close();await writeFile(`${out}/checks.json`,JSON.stringify({passed:true,results,extra:['cpu seat emote send','offline state']},null,2));console.log(`Passed ${results.length} continuous-background viewport/mode cases + CPU seat/offline emote checks`);
} finally {await browser.close();}
