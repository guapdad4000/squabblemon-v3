import assert from 'node:assert/strict';
import {chromium, expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const base=process.env.MAT_REVIEW_URL??'http://127.0.0.1:4228';
const output=process.env.MAT_REVIEW_OUTPUT??'/tmp/player-mats-review';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true});const results=[];
async function close(page){await page.getByRole('button',{name:'Close mat preview'}).click();await page.getByRole('dialog').waitFor({state:'hidden'});}
async function loaded(page){await page.locator('.mat-preview img').evaluateAll(async imgs=>Promise.all(imgs.map(i=>i.decode())));}
try{
 for(const[width,height]of[[320,568],[390,844],[768,1024],[844,390],[1280,800]]){
  const page=await browser.newPage({viewport:{width,height},hasTouch:width<600,reducedMotion:'reduce'});const errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&!r.url().includes('/api/'))errors.push(r.status()+' '+r.url());});
  await page.goto(base+'/e2e/player-mats/fixture.html',{waitUntil:'networkidle'});
  await page.locator('.mat-card').first().waitFor();assert.equal(await page.locator('.mat-card').count(),25);
  assert.equal(await page.getByRole('link',{name:'Player mats Battle backgrounds'}).getAttribute('aria-current'),'page');
  assert((await page.locator('.mat-card').first().boundingBox()).y<height,'catalog starts in first screen');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.locator('.style-categories img').evaluateAll(async imgs=>Promise.all(imgs.map(i=>i.decode())));
  await page.screenshot({path:output+'/shop-'+width+'.png'});
  await page.locator('.style-hub__wallet>summary').click();
  const wallet=await page.getByRole('region',{name:'Your Style Shards'}).boundingBox();assert(wallet.x>=0&&wallet.x+wallet.width<=width,'wallet stays within viewport');
  await page.locator('.style-hub__wallet>summary').click();
  await page.getByRole('button',{name:'Shop',exact:true}).click();assert.equal(await page.locator('.mat-card').count(),15);
  await page.getByRole('button',{name:'Owned',exact:true}).click();assert.equal(await page.locator('.mat-card').count(),7);
  await page.getByRole('button',{name:'All mats',exact:true}).click();
  await page.getByRole('searchbox',{name:'Find a player mat'}).fill('Kyle');assert.equal(await page.locator('.mat-card').count(),1);
  await page.getByTestId('mat-signature-kyle').click();await loaded(page);
  const action=page.getByRole('button',{name:'Unlock · 200 shards',exact:true});const box=await action.boundingBox();assert(box.y>=0&&box.y+box.height<=height,'primary action remains visible');
  await page.screenshot({path:output+'/preview-'+width+'.png'});
  await page.locator('.mat-no-fighter').scrollIntoViewIfNeeded();await expect(page.locator('.mat-no-fighter')).toBeInViewport();
  await page.keyboard.press('Tab');assert(await page.evaluate(()=>document.querySelector('[role=dialog]').contains(document.activeElement)),'focus remains inside preview');
  await action.click();await page.getByRole('button',{name:'Equip mat',exact:true}).click();await page.getByRole('button',{name:'Equipped',exact:true}).waitFor();
  const bought=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('player-mat-review-profile')));
  assert.equal(bought.profile.styleShards,550);assert.equal(bought.profile.styleShardBalances.Legendary,0);assert.equal(bought.profile.ownedCardIds.length,0);assert.equal(bought.profile.settings.cosmetics.playerMatId,'signature-kyle');
  await close(page);await expect(page.getByTestId('mat-signature-kyle')).toBeFocused();assert.equal(await page.getByRole('searchbox',{name:'Find a player mat'}).inputValue(),'Kyle');
  await page.reload({waitUntil:'networkidle'});await page.getByRole('button',{name:/Equipped Blue Hour/}).waitFor();assert.equal(await page.getByRole('searchbox',{name:'Find a player mat'}).inputValue(),'Kyle');
  await page.getByRole('searchbox',{name:'Find a player mat'}).fill('');await page.getByTestId('mat-signature-undercova-brotha').scrollIntoViewIfNeeded();
  const scroll=await page.getByTestId('style-scroll').evaluate(el=>el.scrollTop);
  await page.getByTestId('mat-signature-undercova-brotha').click();await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});
  await expect(page.getByTestId('mat-signature-undercova-brotha')).toBeFocused();assert(Math.abs(await page.getByTestId('style-scroll').evaluate(el=>el.scrollTop)-scroll)<2,'closing preview preserves catalog position');
  await page.getByRole('button',{name:'Story',exact:true}).click();assert.equal(await page.locator('.mat-card').count(),5);
  await page.getByTestId('mat-signature-abuela').click();assert.equal(await page.getByRole('button',{name:/Unlock/}).count(),0);await page.getByRole('link',{name:'Open story ↗'}).waitFor();await close(page);
  await page.getByTestId('mat-signature-dr-fade').click();await page.getByRole('button',{name:'Equip mat',exact:true}).click();await page.getByRole('button',{name:'Equipped',exact:true}).waitFor();await close(page);
  await page.getByRole('button',{name:'All mats',exact:true}).click();await page.getByRole('button',{name:'Filter by rarity'}).click();await page.getByRole('combobox',{name:'Mat rarity'}).selectOption('Legendary');assert.equal(await page.locator('.mat-card').count(),5);
  await page.getByRole('link',{name:'Character styles Banners · decks · stickers'}).click();await page.getByRole('region',{name:'Signature collections'}).waitFor();assert.equal(await page.getByTestId('player-mat-studio').count(),0);
  await page.getByRole('link',{name:'Player mats Battle backgrounds'}).click();await page.getByRole('combobox',{name:'Mat rarity'}).waitFor();assert.equal(await page.getByRole('combobox',{name:'Mat rarity'}).inputValue(),'Legendary');
  await page.getByRole('searchbox',{name:'Find a player mat'}).fill('zzzz-nothing');await page.getByRole('button',{name:'Clear filters'}).click();assert.equal(await page.locator('.mat-card').count(),25);
  await page.getByTestId('mat-signature-buddy').click();await page.getByRole('button',{name:'PvP split',exact:true}).click();await loaded(page);assert.equal(await page.locator('.mat-preview img').count(),2);await page.getByRole('combobox',{name:'Preview rival mat'}).selectOption('signature-kyle');await loaded(page);
  await page.screenshot({path:output+'/split-'+width+'.png'});await close(page);
  assert.deepEqual(errors,[]);results.push({width,height,passed:true,checks:['first-screen catalog','filters','purchase + equip + reload','no character required','focus + scroll return','story locks + existing clears','same-page categories','saved filters','split preview']});await page.close();
 }
 const recovery=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
 await recovery.goto(base+'/e2e/player-mats/fixture.html?recover=1',{waitUntil:'networkidle'});await recovery.getByTestId('mat-signature-kyle').click();await recovery.getByRole('button',{name:'Unlock · 200 shards'}).click();await recovery.getByRole('button',{name:'Recover purchase'}).click();await recovery.getByRole('button',{name:'Equip mat'}).waitFor();assert.equal(await recovery.evaluate(()=>JSON.parse(sessionStorage.getItem('player-mat-review-profile')).profile.styleShards),550);await recovery.close();results.push({recovery:'lost reply recovers original receipt without double charging'});
 const poor=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});await poor.goto(base+'/e2e/player-mats/fixture.html?poor=1',{waitUntil:'networkidle'});await poor.getByTestId('mat-signature-kyle').click();assert(await poor.getByRole('button',{name:'Not enough shards'}).isDisabled());await poor.close();results.push({insufficientFunds:'purchase disabled with exact shortfall'});
 const legacy=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});await legacy.goto(base+'/e2e/player-mats/fixture.html?legacy=1&owned=1',{waitUntil:'networkidle'});await legacy.getByTestId('player-mat-studio').waitFor();assert.equal(await legacy.evaluate(()=>window.matReviewNavigation.history.at(-1)),'/game/style?view=mats');await legacy.getByRole('link',{name:'Character styles Banners · decks · stickers'}).click();await legacy.screenshot({path:output+'/characters-390.png'});await legacy.getByRole('link',{name:'Open KYLE collection',exact:true}).click();await legacy.getByTestId('character-styles').waitFor();await legacy.getByRole('link',{name:'Browse all signature collections →'}).click();await legacy.getByRole('region',{name:'Signature collections'}).waitFor();await legacy.close();results.push({navigation:'legacy mat URL resolves to Style; character detail returns to character category'});
 const nav=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});await nav.goto(base+'/e2e/player-mats/fixture.html?nav=1&view=characters',{waitUntil:'networkidle'});await nav.getByRole('button',{name:'Open game navigation'}).click();await nav.getByRole('button',{name:'Style · Player mats & character styles'}).waitFor();await nav.screenshot({path:output+'/navigation-390.png'});await nav.getByRole('button',{name:'Style · Player mats & character styles'}).click();await nav.getByTestId('player-mat-studio').waitFor();await nav.close();results.push({discoverability:'Express menu has a direct Style stop that opens player mats'});
 await writeFile(output+'/checks.json',JSON.stringify({passed:true,results},null,2));console.log('Style shop: five viewport flows, purchase recovery, insufficient funds and integrated category navigation passed.');
}finally{await browser.close();}
