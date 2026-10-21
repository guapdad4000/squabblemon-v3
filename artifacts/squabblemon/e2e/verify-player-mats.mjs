import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const base=process.env.MAT_REVIEW_URL??'http://127.0.0.1:4228';
const output=process.env.MAT_REVIEW_OUTPUT??'/tmp/player-mats-review';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true});
const results=[];
async function loaded(page,selector){await page.locator(selector).first().waitFor();await page.locator(selector).evaluateAll(async images=>{await Promise.all(images.map(img=>img.decode().catch(()=>{})));});}
try{
  for(const [width,height] of [[320,568],[390,844],[768,1024],[844,390],[1280,800]]){
    const page=await browser.newPage({viewport:{width,height},hasTouch:width<600,reducedMotion:'reduce'});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`${base}/e2e/player-mats/fixture.html`,{waitUntil:'networkidle'});
    await page.locator('[data-testid="player-mat-studio"]').waitFor();
    assert.equal(await page.locator('.mat-card').count(),25);
    await page.getByTestId('mat-signature-kyle').click();
    await page.getByRole('button',{name:'Unlock · 200 shards',exact:true}).click();
    await page.getByRole('button',{name:'Equip mat',exact:true}).click();
    await page.getByRole('button',{name:'Equipped',exact:true}).waitFor();
    const bought=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('player-mat-review-profile')));
    assert.equal(bought.profile.styleShards,550);assert.equal(bought.profile.styleShardBalances.Legendary,0);
    assert.equal(bought.profile.ownedCardIds.length,0);
    await page.reload({waitUntil:'networkidle'});
    await page.getByRole('button',{name:'Equipped',exact:true}).waitFor();
    assert.equal(await page.locator('.mat-selection h2').textContent(),'Blue Hour');
    await page.getByRole('button',{name:'Story',exact:true}).click();
    assert.equal(await page.locator('.mat-card').count(),5);
    await page.getByTestId('mat-signature-abuela').click();
    assert.equal(await page.locator('.mat-selection .mat-action').count(),0);
    await page.getByTestId('mat-signature-dr-fade').click();
    await page.getByRole('button',{name:'Equip mat',exact:true}).click();
    await page.getByRole('button',{name:'Equipped',exact:true}).waitFor();
    await page.getByRole('button',{name:'All',exact:true}).click();
    await page.getByTestId('mat-signature-kyle').click();
    await loaded(page,'.mat-preview img');
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${width}: no horizontal overflow`);
    const scrollable=await page.locator('.mat-studio').evaluate(el=>{const root=el.parentElement;root.scrollTop=500;const ok=root.scrollTop>0;root.scrollTop=0;return ok;});assert(scrollable,`${width}: gallery scrolls`);
    await page.screenshot({path:`${output}/studio-${width}.png`});
    for(const mode of ['pvp','training']){
      await page.goto(`${base}/e2e/art-recovery/fixture.html?${mode==='pvp'?'pvp&':''}playerMat=signature-kyle&rivalMat=signature-guap`,{waitUntil:'networkidle'});
      await loaded(page,'.battle-player-mats img');
      const check=await page.getByTestId('battle-player-mats').evaluate(el=>{
        const arena=el.closest('.battle-arena'),hub=arena.querySelector('.district-lane'),r=arena.getBoundingClientRect(),h=hub.getBoundingClientRect();
        return {player:el.dataset.playerMat,rival:el.dataset.rivalMat,split:parseFloat(el.style.getPropertyValue('--mat-split')),expected:h.top+h.height/2-r.top,images:[...el.querySelectorAll('img')].map(img=>({loaded:img.complete&&img.naturalWidth>0,fit:getComputedStyle(img).objectFit})),pointer:getComputedStyle(el).pointerEvents};
      });
      assert.equal(check.player,'signature-kyle');assert.equal(check.rival,mode==='pvp'?'signature-guap':'corner-store');
      assert(Math.abs(check.split-check.expected)<2,`${width}: join follows district row`);
      assert(check.images.every(i=>i.loaded&&['contain','cover'].includes(i.fit)));assert.equal(check.pointer,'none');
      await page.locator('.battle-tools > summary').click();
      assert(await page.locator('.battle-tools').evaluate(el=>el.open));
      await page.locator('.battle-tools > summary').click();
      await page.screenshot({path:`${output}/${mode}-${width}.png`});
      await page.locator('.battle-hand-row [data-card-id="buddy"]').click();
      await page.getByTestId('lane-0').click({position:{x:25,y:25}});
      await page.getByRole('button',{name:/^Play card/}).click();
      assert.equal(await page.getByTestId('review-commits').textContent(),'1',`${width}: mats do not block play`);
      results.push({width,height,mode,...check});
    }
    assert.deepEqual(errors,[],`${width}: browser errors`);await page.close();
  }
  const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
  await page.goto(`${base}/e2e/player-mats/fixture.html?recover=1`,{waitUntil:'networkidle'});
  await page.getByTestId('mat-signature-kyle').click();await page.getByRole('button',{name:'Unlock · 200 shards',exact:true}).click();
  await page.getByRole('button',{name:'Recover purchase'}).click();await page.getByRole('button',{name:'Equip mat',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('player-mat-review-profile')).profile.styleShards),550);
  results.push({recovery:'lost reply returns same receipt without a second debit'});
  const gallery=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  await gallery.goto(`${base}/e2e/player-mats/fixture.html`,{waitUntil:'networkidle'});
  await gallery.locator('.mat-studio').evaluate(el=>{el.parentElement.style.height='auto';el.parentElement.style.overflow='visible';el.querySelectorAll('img').forEach(img=>img.loading='eager');});
  await loaded(gallery,'.mat-grid img');
  await gallery.locator('.mat-library').screenshot({path:`${output}/collection-full.png`});
  await gallery.close();
  await writeFile(`${output}/checks.json`,JSON.stringify(results,null,2));console.log(JSON.stringify({passed:true,checks:results.length,output}));
}finally{await browser.close();}
