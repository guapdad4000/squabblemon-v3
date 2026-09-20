import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { writeFile, mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { CHARACTER_STYLE_SETS } from '../../../lib/squabblemon-engine/src/cosmetics.ts';
import { planShopPurchase } from '../../../lib/squabblemon-engine/src/economy.ts';
const origin='http://127.0.0.1:4205',report={checks:[],errors:[]};
const ids=Object.keys(CHARACTER_STYLE_SETS),pass=s=>{report.checks.push(s);console.log('PASS',s)};
const server=spawn(process.execPath,['../../node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4205'],{cwd:'artifacts/squabblemon',env:{...process.env,PORT:'4205',BASE_PATH:'/',VITE_E2E_AUTH:'true'},stdio:'ignore',windowsHide:true});
for(let i=0;i<100;i++){try{if((await fetch(origin)).ok)break}catch{}await new Promise(r=>setTimeout(r,100));}
let playerProfile={id:'signature-browser',displayName:'Collector',avatarKey:'kyle',onboardingStep:'complete',starterDeckId:'foundation-v1',
streetRep:0,xp:0,level:1,softCurrency:0,packTickets:0,styleShards:1000,packPity:0,deckSlots:4,cosmeticCurrency:0,collectionProgress:ids.length,
storyChapter:1,storyNode:0,tutorialCompleted:true,starterRewardClaimed:true,ageConfirmedAt:new Date(0).toISOString(),termsAcceptedAt:new Date(0).toISOString(),
settings:{reducedMotion:false,turnTimerEnabled:false},ownedCardIds:ids,discoveredCardIds:ids,cardProgression:{},ownedVariants:[],equippedVariants:{},
unlockedCosmeticIds:[],savedDecks:[],storyProgress:{},inbox:[],packHistory:[],lastActiveAt:new Date(0).toISOString()};
const bootstrap=()=>({profile:playerProfile,missions:[],nextAction:{id:'story',eyebrow:'Your story',title:'Continue',description:'Continue',destination:'story',rewardLabel:null},packConfig:{id:'street-pack',name:'Street Pack',oddsVersion:'test',softCurrencyCost:200,ticketCost:1,rewardsPerPack:3,pityLimit:10,odds:[]},collectionRoad:[]});
await mkdir('screenshots/character-packs',{recursive:true});
const browser=await chromium.launch({headless:true,channel:'msedge'}),context=await browser.newContext({viewport:{width:1440,height:1000}});
await context.addCookies([{name:'online_test_seat',value:'b',url:origin}]);
await context.addInitScript(()=>localStorage.setItem('squabblemon_e2e_user','signed-in'));
const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
const button=name=>page.getByRole('button',{name,exact:true});
const read=async()=>structuredClone(bootstrap());
const go=async id=>{await page.goto(origin+'/game/style/'+id);await page.getByTestId('character-styles').waitFor();};
const saved=async()=>page.getByText('Saved to your collection.',{exact:true}).waitFor();
try{
 await page.route('**/api/player/**',async route=>{
 const request=route.request(),url=new URL(request.url());
 if(url.pathname.endsWith('/bootstrap'))return route.fulfill({json:bootstrap()});
 if(url.pathname.endsWith('/shop/purchases')){
  const result=planShopPurchase(playerProfile,request.postDataJSON());playerProfile={...playerProfile,...result.wallet};
  return route.fulfill({json:{bootstrap:bootstrap(),receipt:result.receipt}});
 }
 if(url.pathname.endsWith('/cosmetics')){
  playerProfile={...playerProfile,settings:{...playerProfile.settings,cosmetics:request.postDataJSON()}};
  return route.fulfill({json:bootstrap()});
 }
 return route.fulfill({json:{}});});
 await page.goto(origin+'/game/style');await page.getByTestId('character-collections').waitFor();assert.equal(await page.locator('.style-library__card').count(),15);
 await button('Mythicals').click();assert.equal(await page.locator('.style-library__card').count(),12);await button('Legendaries').click();assert.equal(await page.locator('.style-library__card').count(),1);await button('All packs').click();
 await page.getByRole('searchbox').fill('church');assert.equal(await page.locator('.style-library__card').count(),1);await page.getByRole('searchbox').fill('no such character');await page.getByText('No collections match this filter.',{exact:false}).waitFor();await page.getByRole('searchbox').fill('');
 await page.locator('.style-library').screenshot({path:'screenshots/character-packs/library-desktop.jpg',type:'jpeg',quality:75});
 pass('All 15 collections are discoverable; Mythical/Legendary filters and search work.');
 for(const id of ['stockz','ashlee']){await go(id);await button('Unlock for 100 Style Shards').click();await button('Save banner stickers').waitFor();}
 assert.equal((await read()).profile.styleShards,800);
 await button('Jet set').click();await button('Guyana').click();await button('Save banner stickers').click();await saved();
 await go('stockz');assert.equal(await page.locator('.style-sticker-mix button').count(),2);await button('Gold deck').click();assert(await button('Buy money').isDisabled());await button('Remove Jet set').click();await button('Black card').click();await button('Save banner stickers').click();await saved();
 let profile=(await read()).profile;assert.equal(profile.settings.cosmetics.bannerCardId,'stockz');assert.deepEqual(profile.settings.cosmetics.stickers,['ashlee:signature','stockz:signature','stockz:keepsake']);
 await page.reload();await page.getByTestId('character-styles').waitFor();assert.equal(await page.locator('.style-sticker-mix button').count(),3);
 pass('Purchased packs mix across character banners; occupied slots can be freed and selections survive reload.');
 await button('03 / Card scene').click();await button('Unlock for 60 Style Shards').click();await button('Equip card scene').click();await saved();
 await go('ashlee');await button('03 / Card scene').click();await button('Unlock for 60 Style Shards').click();await button('Equip card scene').click();await saved();profile=(await read()).profile;assert.equal(profile.styleShards,680);assert.deepEqual(profile.settings.cosmetics.cardBackgrounds,{stockz:'blue-hour',ashlee:'blue-hour'});
 await go('church-auntie');await button('02 / Character banner').click();await button('Equip banner').click();await saved();assert.equal((await read()).profile.styleShards,680);assert.equal((await read()).profile.settings.cosmetics.bannerCardId,'church-auntie');
 pass('Each character scene keeps separate ownership; changing an included banner is free and preserves other scenes.');
 for(const width of [320,390]){
  await page.setViewportSize({width,height:844});await page.goto(origin+'/game/style');await page.getByTestId('character-collections').waitFor();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:'screenshots/character-packs/library-'+width+'.jpg',type:'jpeg',quality:80});
 }
 for(const id of ids){await go(id);await page.evaluate(()=>document.fonts.ready);assert(await page.locator('.character-styles').evaluate(e=>e.scrollWidth<=e.clientWidth+1),id+' page overflow');assert(await page.locator('.character-banner__copy>strong').first().evaluate(e=>e.scrollWidth<=e.clientWidth+1),id+' banner title overflow');await page.waitForFunction(()=>{const i=document.querySelector('.character-banner__fighter');return i?.complete&&i?.naturalWidth>0});assert.equal(await page.locator('.style-sticker-sheet button').count(),4);if(['captain-jigga','church-auntie','last-train-conductor','block-party-titan'].includes(id))await page.locator('.character-styles').screenshot({path:'screenshots/character-packs/'+id+'-mobile.jpg',type:'jpeg',quality:80});}
 pass('Every completed pack renders four stickers and its real portrait on phone, including long character names.');
 await page.setViewportSize({width:1440,height:1000});await go('church-auntie');await page.locator('.character-styles').screenshot({path:'screenshots/character-packs/church-auntie-desktop.jpg',type:'jpeg',quality:85});
 await go('last-train-conductor');await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.character-banner__fighter').first().evaluate(e=>getComputedStyle(e).animationName),'none');await page.emulateMedia({reducedMotion:'no-preference'});
 await go('ashlee');await button('Replay unlock reveal').click();await page.getByText('A MYTHICAL JOINS YOUR GANG',{exact:true}).waitFor();await button('Show my card · Skip intro').click();await page.getByText('Character banner unlocked.',{exact:true}).waitFor();
 await go('stockz');await button('Replay unlock reveal').click();await page.getByText('A NEW FACE JOINS YOUR GANG',{exact:true}).waitFor();
 pass('Reveal copy matches rarity and the animated banners respect reduced motion.');
 assert.deepEqual(report.errors,[]);report.complete=true;
}finally{await browser.close();server.kill();await writeFile('screenshots/character-packs/verification.json',JSON.stringify(report,null,2));}
