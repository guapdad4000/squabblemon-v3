import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { STREET_PACK_RULES } from '@workspace/squabblemon-engine/packRules';
const browser=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
try {
 for (const viewport of [{width:375,height:667},{width:1440,height:900},{width:375,height:812,animated:true}]) {
  const page=await browser.newPage({viewport,reducedMotion:viewport.animated?'no-preference':'reduce'});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(() => {
   const NativeAudio=window.Audio;
   (window as any).__welcomeAudio=[];
   (window as any).__welcomeOverlap=false;
   window.Audio=function(src?:string){const audio=new NativeAudio(src);
    if(src?.includes('/tutorial/welcome-pull-')){
     (window as any).__welcomeAudio.push(audio);
     audio.addEventListener('playing',()=>{if((window as any).__welcomeAudio.some((other:HTMLAudioElement)=>other!==audio&&!other.paused&&!other.ended))(window as any).__welcomeOverlap=true});
    }return audio;
   } as typeof Audio;
  });
  const hear=async(cue:string)=>page.waitForFunction(cue=>(window as any).__welcomeAudio.some((a:HTMLAudioElement)=>a.src.includes(`welcome-pull-${cue}.`)&&a.currentTime>0.1&&!a.paused),cue);
  let requests=0,fail=true,claimed=false;
  await page.route('**/api/player/packs/welcome',async route=>{
   if(route.request().method()==='GET')return route.fulfill({json:{available:!claimed}});
   requests++;if(fail){fail=false;return route.fulfill({status:503,json:{error:'offline'}})}
   claimed=true;
   const bootstrap:any=await page.evaluate(()=>(window as any).__welcomeBootstrap());
   const opening={id:'welcome',oddsVersion:'dr-fade-welcome-v1',paymentMethod:'ticket',cost:0,pullCount:1,pityBefore:3,pityAfter:3,createdAt:new Date().toISOString(),rewards:[{kind:'styleShards',cardId:'dr-fade',variantId:null,name:'Dr. Fade',rarity:'Rare',isNew:false,amount:STREET_PACK_RULES.duplicateStyleShards}]};
   bootstrap.profile.packHistory=[opening];bootstrap.profile.styleShards=STREET_PACK_RULES.duplicateStyleShards;
   return route.fulfill({json:{opening,bootstrap,alreadyOpened:false}});
  });
  await page.route('**/api/player/packs/open',()=>{throw new Error('Welcome must not call paid opening')});
  await page.goto(`${process.env.UI_ORIGIN??'http://localhost:4210'}/e2e/welcome-pull.fixture.html${viewport.animated?'':'?reduced'}`);
  await hear('intro');
  await page.getByRole('button',{name:'Mute gym sound'}).click();
  assert(await page.evaluate(()=>(window as any).__welcomeAudio.every((a:HTMLAudioElement)=>a.paused)));
  await page.getByRole('button',{name:'Enable gym sound'}).click();
  await hear('intro');
  await page.getByRole('button',{name:'Show me my ticket'}).click();
  await hear('ticket');
  await page.getByRole('button',{name:'Use free welcome ticket'}).waitFor();
  await page.screenshot({path:`/tmp/welcome-ticket-${viewport.width}.png`});
  await page.getByRole('button',{name:'Use free welcome ticket'}).click();
  await page.getByRole('alert').waitFor();
  await page.reload();
  if(viewport.animated) await page.locator('.venue-scene.is-ready').waitFor();
  await page.getByRole('button',{name:'Retry free pull'}).click();
  if(viewport.animated){
   for(let i=0;i<3;i++){
    await page.getByText(`DR. FADE · ${i+1} / 3`,{exact:true}).waitFor();
    await hear(['jab','hook','finish'][i]);
    await page.locator('.gacha-stage__strike').click();
   }
  }
  await page.locator('dialog[open].gym-results').waitFor();
  await page.getByText('DR. FADE · FREE WELCOME PULL',{exact:true}).waitFor();
  await hear('reveal');
  await hear('duplicate');
  await hear('done');
  assert.equal(await page.evaluate(()=>(window as any).__welcomeOverlap),false);
  await page.screenshot({path:`/tmp/welcome-reveal-${viewport.width}.png`});
  assert.equal(requests,2);
  const profile=await page.evaluate(()=>(window as any).__welcomeBootstrap().profile);
  assert.equal(profile.packTickets,0);assert.equal(profile.softCurrency,0);
  await page.reload();await page.locator('dialog[open].gym-results').waitFor();
  assert.equal(requests,2);assert.deepEqual(errors,[]);await page.keyboard.press('Escape');assert(await page.evaluate(()=>(window as any).__welcomeAudio.every((a:HTMLAudioElement)=>a.paused)));await page.close();
 }
 console.log('Welcome ticket passes at phone/desktop: free request, failure/reload retry, saved reveal recovery, no paid endpoint or wallet cost; real VO playback, punch cues, mute, exit cleanup, and no narration overlap.');
}finally{await browser.close()}
