import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { popupApiResponse } from './popup-test-responses.mjs';
const origin=process.env.STORY_ENVIRONMENT_ORIGIN||'http://127.0.0.1:4198';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome'});
const ids=['block-party','red-side-tapes','blue-side-blues','side-show','old-heads-know'];
async function installOtherApis(page) {
 // Missions also mounts John Henry. Its query must receive a valid roadmap
 // instead of the dev server's HTML SPA fallback during this focused fixture.
 await page.route('**/api/**',route=>{
  const path=new URL(route.request().url()).pathname;
  return route.fulfill({json:path.endsWith('/legend-bounties')?[]:popupApiResponse(path)});
 });
 page.on('pageerror',error=>console.log('PAGE ERROR',error.message));
}
try {
 for(const [width,height,state,owns,screen] of [[1440,900,'ready',false,'bounties'],[390,844,'locked',false,'bounties'],[375,667,'ready',true,'bounties'],[390,844,'ready',false,'home']]) {
  const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await installOtherApis(page);
  let saved=false,calls=0;
  const status=()=>({state:saved?'claimed':state,ownsCard:saved||owns,chapters:ids.map((id,i)=>({id,reached:state==='ready'||i<2,completed:state==='ready'?i<4:i<1}))});
  await page.route('**/api/player/rewards/starter-mythic**',async route=>{
   if(route.request().method()==='POST') {
    calls++;saved=true;
    const bootstrap=await page.evaluate(()=>window.__mythicBootstrap());
    bootstrap.profile.softCurrency+=1000;bootstrap.profile.packTickets+=3;
    if(owns)bootstrap.profile.styleShards+=25;else bootstrap.profile.ownedCardIds.push('homeless-guy');
    await route.fulfill({json:{claimed:true,duplicateShards:owns?25:0,status:status(),bootstrap}});
   } else await route.fulfill({json:status()});
  });
  await page.goto(`${origin}/e2e/starter-mythic.fixture.html?screen=${screen}`);
  const startingWallet=await page.evaluate(()=>window.__mythicBootstrap().profile);
  const trigger=page.locator(screen==='home'?'.starter-mythic-shortcut':'.starter-mythic-banner');
  await trigger.waitFor();
  if(screen==='home'){
   const bounty=await page.locator('.safehouse-bounty-logo').boundingBox(),mythic=await trigger.boundingBox();assert(mythic.y>=bounty.y+bounty.height,'Chibi must sit below Bounties');
  } else {
   assert.equal(await page.locator('.studio-tabs').count(),0);
   await page.locator('.bounty-mastery-strip').click();await page.getByRole('region',{name:'Hall of Hands',exact:true}).waitFor();
   await page.locator('.bounty-mastery-strip').click();
  }
  await trigger.click();const dialog=page.locator('.starter-mythic-dialog');await dialog.waitFor({state:'visible'});
  await page.locator('.starter-mythic-chapters li').last().waitFor();
  await page.waitForFunction(()=>[...document.querySelectorAll('.starter-mythic-dialog img')].every(img=>img.complete&&img.naturalWidth>0));
  await dialog.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(img=>img.decode())));
  assert.equal(await dialog.locator('img').evaluateAll(imgs=>imgs.every(img=>img.complete&&img.naturalWidth>0)),true);
  assert(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'No horizontal clipping');
  const bounds=await dialog.boundingBox();assert(Math.abs(bounds.x+bounds.width/2-width/2)<2,'Popup must be centered');
  const action=dialog.locator('.starter-mythic-cta');await action.scrollIntoViewIfNeeded();
  assert(await action.evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),'Reward action must be reachable');
  await page.screenshot({path:`/tmp/starter-mythic-${width}-${screen}.png`});
  if(state==='locked'){assert.equal(await page.getByRole('button',{name:'Claim your Mythic'}).count(),0);await page.getByRole('link',{name:'Continue story'}).scrollIntoViewIfNeeded();}
  else {
   await page.getByRole('button',{name:'Claim your Mythic'}).click();
   const celebration=page.locator('.character-recruitment[data-character="homeless-guy"]');
   await celebration.waitFor({state:'visible'});await dialog.waitFor({state:'hidden'});assert.equal(calls,1);
   await celebration.getByRole('heading',{name:'Homeless Guy',exact:true}).waitFor();
   await celebration.getByRole('link',{name:'Meet your crew →',exact:true}).waitFor();
   assert.match(await celebration.locator('.bounty-node-rewards').innerText(),/\+1000\s*Clout/);
   assert.match(await celebration.locator('.bounty-node-rewards').innerText(),/\+3\s*Tickets/);
   if(owns)assert.match(await celebration.locator('.bounty-node-rewards').innerText(),/\+25\s*Style Shards/);
   await page.waitForFunction(()=>[...document.querySelectorAll('.character-recruitment img')].every(img=>img.complete&&img.naturalWidth>0));
   assert(await celebration.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'Recruitment celebration has no horizontal clipping');
   const cached=await page.evaluate(()=>window.__mythicBootstrap());assert.equal(cached.profile.softCurrency,1250);assert.equal(cached.profile.packTickets,3);
   if(owns)assert.equal(cached.profile.styleShards,startingWallet.styleShards+25,'Duplicate reward grants actual saved shards');
   else assert(cached.profile.ownedCardIds.includes('homeless-guy'),'Fresh claim saves the character');
   if(screen==='home')assert.equal(await trigger.count(),0);
   await page.keyboard.press('Escape');await celebration.waitFor({state:'hidden'});
  }
  await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
  if(screen==='bounties')assert(await trigger.evaluate(el=>document.activeElement===el),'Focus returns to banner');
  assert.deepEqual(errors,[]);console.log(`PASS ${width}x${height} ${screen} ${state}${owns?' existing owner':''}`);await page.close();
 }
 // Presentation history is independent from authoritative claim state.
 const page=await browser.newPage({viewport:{width:390,height:844}});
 await installOtherApis(page);
 let phase='locked';
 const status=()=>({state:phase,ownsCard:false,chapters:ids.map((id,i)=>({id,reached:phase==='ready'||i===0,completed:phase==='ready'&&i<4}))});
 await page.route('**/api/player/rewards/starter-mythic',route=>route.fulfill({json:status()}));
 await page.goto(`${origin}/e2e/starter-mythic.fixture.html?screen=home&auto`);
 const dialog=page.locator('.starter-mythic-dialog');await dialog.waitFor({state:'visible'});
 await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
 await page.reload();await page.waitForTimeout(2100);assert.equal(await dialog.isVisible(),false,'Intro is shown only once');
 phase='ready';await page.reload();await dialog.waitFor({state:'visible'});await page.getByRole('button',{name:'Claim your Mythic'}).waitFor();
 await page.keyboard.press('Escape');phase='claimed';await page.reload();await page.waitForTimeout(2100);assert.equal(await page.locator('.starter-mythic-shortcut').count(),0);assert.equal(await dialog.isVisible(),false);
 console.log('PASS one-time introduction, eligibility celebration, and retired shortcut');await page.close();
 const retry=await browser.newPage({viewport:{width:390,height:844}});let gets=0,posts=0;
 await installOtherApis(retry);
 await retry.route('**/api/player/rewards/starter-mythic**',async route=>{
  if(route.request().method()==='POST') {posts++;if(posts===1){await route.fulfill({status:503,json:{error:'Temporary claim failure'}});return;}const bootstrap=await retry.evaluate(()=>window.__mythicBootstrap());await route.fulfill({json:{claimed:false,duplicateShards:0,status:{...status(),state:'claimed'},bootstrap}});}
  else {gets++;await route.fulfill(gets<=2?{status:503,json:{error:'Unavailable'}}:{json:{...status(),state:'ready'}});}
 });
 await retry.goto(`${origin}/e2e/starter-mythic.fixture.html?screen=home`);await retry.locator('.starter-mythic-shortcut').click();
 await retry.getByRole('button',{name:'Try again'}).click();await retry.getByRole('button',{name:'Claim your Mythic'}).click();await retry.getByRole('alert').waitFor();
 assert.equal(await retry.locator('.starter-mythic-shortcut').count(),1,'Failed request must not retire the reward');
 await retry.getByRole('button',{name:'Claim your Mythic'}).click();await retry.getByRole('status').filter({hasText:'Already collected'}).waitFor();assert.equal(posts,2);
 console.log('PASS loading failure, claim failure, and recovery of a saved claim');await retry.close();
} finally {await browser.close();}
