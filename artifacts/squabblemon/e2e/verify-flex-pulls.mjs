import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
const origin=process.env.UI_ORIGIN??'http://127.0.0.1:4245';
const output=process.env.PULL_OUTPUT??'/tmp/squabblemon-flex-pulls';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/google-chrome',args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
const report=[];
try {
 for(const viewport of [{width:390,height:844},{width:1440,height:1000}]) {
  const page=await browser.newPage({viewport,reducedMotion:'reduce'});const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{
   localStorage.setItem('squabblemon_battle_speed','1.5');
   window.__played=[]; const play=HTMLMediaElement.prototype.play;
   HTMLMediaElement.prototype.play=function(){window.__played.push({src:this.src,rate:this.playbackRate,volume:this.volume});return play.call(this);};
  });
  let count=3,interrupt=true,charges=0,supportsFlexibleBatches=true;const requests=[],receipts=new Map();
  const milestones=[{threshold:5,softCurrency:100,packTickets:0,styleShards:0},{threshold:10,softCurrency:0,packTickets:1,styleShards:0},{threshold:20,softCurrency:0,packTickets:0,styleShards:15},{threshold:30,softCurrency:0,packTickets:2,styleShards:0}];
  const progress=()=>({id:'2026-10',name:'October 2026 · Street Pack season',startsAt:'2026-10-01T00:00:00.000Z',endsAt:'2026-11-01T00:00:00.000Z',count,milestones:milestones.map(m=>({...m,seasonId:'2026-10',claimed:count>=m.threshold}))});
  await page.route('**/api/player/packs/welcome',route=>route.fulfill({json:{available:false,supportsFlexibleBatches,serverNow:Date.parse('2026-10-24T12:00:00Z'),pullSeason:progress()}}));
  await page.route('**/api/player/packs/open',async route=>{
   const input=route.request().postDataJSON();requests.push(input);let saved=receipts.get(input.idempotencyKey);
   if(!saved){
    const bootstrap=await page.evaluate(()=>window.__flexBootstrap()); const n=input.pullCount??1; const cost=input.paymentMethod==='ticket'?n:n===10?1800:200*n;
    const before=count;count+=n;charges++;
    const seasonRewards=milestones.filter(m=>m.threshold>before&&m.threshold<=count).map(m=>({...m,seasonId:'2026-10'}));
    const opening={id:input.idempotencyKey,oddsVersion:n===10?'street-pack-ten-v3':n===1?'street-pack-v7':`street-pack-batch-${n}-v1`,paymentMethod:input.paymentMethod,cost,pullCount:n,pityBefore:4,pityAfter:5,createdAt:'2026-10-24T12:00:00Z',rewards:Array.from({length:n*6},(_,i)=>({kind:'card',cardId:i===0&&n===10?'big-zoey':'dr-fade',variantId:null,name:i===0&&n===10?'Big Zoey':'Dr. Fade',rarity:i===0&&n===10?'Rare':'Common',isNew:false,amount:1})),seasonRewards};
    bootstrap.profile.packTickets-=(input.paymentMethod==='ticket'?cost:0);bootstrap.profile.softCurrency-=(input.paymentMethod==='softCurrency'?cost:0);
    for(const reward of seasonRewards){bootstrap.profile.packTickets+=reward.packTickets;bootstrap.profile.softCurrency+=reward.softCurrency;bootstrap.profile.styleShards+=reward.styleShards;}
    bootstrap.profile.packHistory.unshift(opening);saved={opening,bootstrap,pullSeason:progress(),alreadyOpened:false};receipts.set(input.idempotencyKey,saved);
   }
   if(interrupt){interrupt=false;return route.fulfill({status:503,json:{error:'Interrupted after receipt persisted'}});}
   return route.fulfill({json:{...saved,alreadyOpened:requests.length>1}});
  });
  await page.goto(`${origin}/e2e/flex-pulls.fixture.html`);
  await expect(page.getByRole('button',{name:'Open 7 packs · 7 tickets',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Open 3 packs · 600 Clout',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Open · 1 ticket',exact:true})).toBeEnabled();
  await expect(page.getByRole('region',{name:'Monthly pull milestones'})).toContainText('3 packs opened');
  const paper=await page.locator('.fight-bill').evaluate(node=>getComputedStyle(node).backgroundColor);assert.equal(paper,'rgb(244, 234, 213)');
  await page.evaluate(()=>document.fonts.ready); await page.screenshot({path:`${output}/affordable-${viewport.width}.png`,fullPage:true});
  await page.getByRole('button',{name:'Open 7 packs · 7 tickets',exact:true}).click();
  await expect(page.getByRole('alert').filter({visible:true})).toBeVisible();
  await page.reload();
  await page.getByRole('button',{name:'Retry this opening',exact:true}).click();
  const dialog=page.locator('dialog[open].gacha-reveal-dialog');await expect(dialog).toBeVisible();
  assert.deepEqual(requests[1],requests[0]);assert.equal(requests[0].pullCount,7);assert.equal(charges,1);
  await expect(dialog).toHaveAttribute('data-pull-size','7');await expect(dialog.locator('.gacha-reveal__item')).toHaveCount(42);
  await expect(dialog.getByRole('region',{name:'Monthly milestone rewards'})).toContainText('+100 Clout');
  await expect(dialog.getByRole('region',{name:'Monthly milestone rewards'})).toContainText('+1 Street Pack ticket');
  await dialog.getByRole('region',{name:'Monthly milestone rewards'}).scrollIntoViewIfNeeded();
  await expect(dialog.getByRole('region',{name:'Monthly milestone rewards'})).toBeVisible();
  await page.screenshot({path:`${output}/batch-receipt-${viewport.width}.png`,fullPage:true});
  const clips=await page.evaluate(()=>window.__played.filter(clip=>/generated\/pack-/.test(clip.src)));
  assert.ok(clips.some(clip=>/pack-tear/.test(clip.src)));assert.ok(clips.some(clip=>/pack-break/.test(clip.src)));
  assert.ok(clips.every(clip=>clip.rate===1&&clip.volume<=0.36));
  for(const clip of clips){const response=await page.request.get(clip.src);assert.equal(response.status(),200);assert.ok((await response.body()).length>100);}
  await dialog.getByRole('button',{name:'Close rewards',exact:true}).click();
  await expect(page.getByRole('region',{name:'Monthly pull milestones'})).toContainText('10 packs opened');
  await page.evaluate(async()=>{const {saveFeedbackPreferences}=await import('/src/battleFeedback.ts');saveFeedbackPreferences({audioEnabled:false,hapticsEnabled:true});});
  const playedBefore=await page.evaluate(()=>window.__played.length);
  await page.getByRole('button',{name:'Open 4 packs · 800 Clout',exact:true}).click();
  await expect(dialog).toBeVisible();assert.equal(requests.at(-1).pullCount,4);assert.equal(requests.at(-1).paymentMethod,'softCurrency');
  assert.equal(await page.evaluate(()=>window.__played.length),playedBefore,'mute stops all purchase and reduced-motion success cues');
  await dialog.getByRole('button',{name:'Close rewards',exact:true}).click();
  assert.equal(await page.evaluate(()=>window.__flexBootstrap().profile.softCurrency),50);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.evaluate(()=>{sessionStorage.clear();localStorage.removeItem('squabblemon_battle_feedback');});
  await page.goto(`${origin}/e2e/flex-pulls.fixture.html?tickets=10&clout=1800`);
  await page.getByRole('button',{name:'10 PULL',exact:true}).click();
  await page.getByRole('button',{name:'Open 10× · 10 tickets',exact:true}).click();
  await expect(dialog).toBeVisible();await expect(dialog).toHaveAttribute('data-pull-size','10');await expect(dialog.locator('.gacha-reveal__item')).toHaveCount(60);await expect(dialog.locator('.gacha-reveal__guarantee')).toContainText('GUARANTEED');
  await dialog.getByRole('button',{name:'Close rewards',exact:true}).click();
  supportsFlexibleBatches=false;await page.reload();
  await expect(page.getByRole('region',{name:'Use your available packs'})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Open · 1 ticket',exact:true})).toBeEnabled();
  assert.deepEqual(errors,[]);
  report.push({viewport,partialTicketCount:7,partialCloutCount:4,exactRetry:true,firstOpeningCharges:1,partialRewardCount:42,fullTenRewardCount:60,seasonBonusPreserved:true,authoredAudioFiles:clips.map(c=>c.src.split('/').at(-1)),cinematicSpeed:1,battleSpeed:1.5,reducedVolume:true,mute:true,horizontalOverflow:false,pageErrors:errors});
  await page.close();
 }
 await writeFile(`${output}/flex-pulls.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
