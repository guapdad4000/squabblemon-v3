import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { installFadecadeApi } from './fadecade.fixture';
import { signIn } from './fighter-id.fixture';
import type { StockzState, StockzRound } from '@workspace/squabblemon-engine/accountRewards';
import { assertSpriteArt } from './motion-sprite-proof';
const base=process.env.ARCADE_BASE_URL??'http://127.0.0.1:4231';
const out=process.env.REVIEW_OUTPUT??'../../screenshots/minigame-motion';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true, executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH});
try {
 for(const [name,width,height] of [['desktop',1440,1000],['phone',390,844],['short-phone',360,640]] as const){
  const page=await browser.newPage({viewport:{width,height}});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await signIn(page);const fixture=await installFadecadeApi(page);let balance=250,starts=0,settles=0,failSaved=false;
  let state:StockzState={active:null,roundsToday:0,recent:[]};
  await page.route('**/api/player/bootstrap',route=>{const boot=fixture.bootstrap();boot.profile.softCurrency=balance;return route.fulfill({json:boot});});
  await page.route('**/api/player/stockz**',async route=>{
   const request=route.request();const path=new URL(request.url()).pathname;
   if(path.endsWith('/start')){
    const input=request.postDataJSON();starts++;
    assert.equal(input.ticker,'SNKR');assert.equal(input.direction,'down');assert.equal(input.stake,25);
    const round:StockzRound={...input,openPrice:85,startedAt:new Date().toISOString(),closesAt:new Date(Date.now()+1800).toISOString(),date:new Date().toISOString().slice(0,10)};
    state={...state,active:round,roundsToday:state.roundsToday+1};balance-=input.stake;
    if(failSaved){failSaved=false;return route.fulfill({status:503,json:{error:'Saved trade; connection interrupted.'}});}
   } else if(path.endsWith('/settle')){
    settles++;assert.equal(request.postDataJSON().id,state.active!.id);const round={...state.active!,closePrice:84,payout:50};balance+=50;state={...state,active:null,recent:[round,...state.recent]};
   }
   return route.fulfill({json:state});
  });
  await page.goto(`${base}/game/challenges`);
  const opener=page.getByRole('button',{name:'Play Stockz'});await opener.scrollIntoViewIfNeeded();await page.screenshot({path:`${out}/stockz-cabinet-${name}.png`});await opener.click();
  const dialog=page.getByRole('dialog',{name:'Stockz · Clout Exchange'});await expect(dialog).toBeVisible();await expect(page.getByRole('button',{name:'Bet 25 Clout'})).toBeEnabled();
  await assertSpriteArt(page,'.stockz-panel .motion-sprite');
  await dialog.evaluate(el=>Promise.all(el.getAnimations().map(a=>a.finished.catch(()=>{}))));
  const artworkBox=(await dialog.locator('.fadecade-dialog-artwork-shell').boundingBox())!;
  assert.ok(artworkBox.x>=0&&artworkBox.y>=0&&artworkBox.x+artworkBox.width<=width+1&&artworkBox.y+artworkBox.height<=height+1,JSON.stringify({name,artworkBox,width,height}));
  assert.ok(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'Stockz fits popup');
  const box=(await dialog.boundingBox())!;assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=width+1&&box.y+box.height<=height+1);
  await page.screenshot({path:`${out}/stockz-setup-${name}.png`});
  await page.getByRole('button',{name:/SNKR Sneaker Supply/}).click();await page.getByRole('button',{name:'↘ Down',exact:true}).click();
  await page.getByRole('button',{name:'Bet 25 Clout'}).scrollIntoViewIfNeeded();await page.screenshot({path:`${out}/stockz-controls-${name}.png`});failSaved=true;await page.getByRole('button',{name:'Bet 25 Clout'}).click();
  await expect(page.locator('.stockz-active')).toBeVisible();await expect(page.locator('[data-sprite="stockz-waiting"]')).toHaveCount(1);assert.equal(starts,1);
  await page.locator('.fadecade-dialog-scroll-body').evaluate(el=>el.scrollTop=0);await page.screenshot({path:`${out}/stockz-waiting-${name}.png`});
  await page.keyboard.press('Escape');await expect(dialog).toBeHidden();await expect(opener).toBeFocused();await opener.click();await expect(page.locator('.stockz-active')).toBeVisible();assert.equal(starts,1,'reopening never creates a second bet');
  const reveal=page.getByRole('button',{name:/Reveal closing price|Check closing price/});await expect(reveal).toBeEnabled({timeout:8000});await reveal.click();await expect(page.locator('.stockz-history')).toBeVisible();await expect(page.locator('[data-sprite="stockz-win"]')).toHaveCount(1);assert.equal(settles,1);assert.equal(balance,275);assert.equal(state.recent.length,1);
  await assertSpriteArt(page,'.stockz-panel .motion-sprite');await page.locator('.fadecade-dialog-scroll-body').evaluate(el=>el.scrollTop=0);await page.screenshot({path:`${out}/stockz-result-${name}.png`});
  await page.emulateMedia({reducedMotion:'reduce'});await page.locator('.stockz-host-sprite').scrollIntoViewIfNeeded();const image=page.locator('.stockz-host-sprite image');await page.waitForTimeout(50);const pose=await image.evaluate(el=>getComputedStyle(el).transform);await page.waitForTimeout(400);assert.equal(await image.evaluate(el=>getComputedStyle(el).transform),pose);
  assert.deepEqual(errors,[]);console.log(`${name}: Stockz art, trade controls, saved-error recovery, close/reopen, settlement, win animation and reduced motion passed.`);await page.close();
 }
 await writeFile(`${out}/stockz-proof.json`,JSON.stringify({viewports:3,savedTradeRecovery:true,settlement:true,renderErrors:0})+'\n');
} finally {await browser.close();}
