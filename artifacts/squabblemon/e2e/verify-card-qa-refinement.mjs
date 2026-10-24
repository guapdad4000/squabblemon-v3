import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {chromium, expect} from '@playwright/test';
const origin = process.env.UI_ORIGIN ?? 'http://127.0.0.1:4242';
const output = process.env.QA_OUTPUT ?? 'e2e/screenshots/card-qa';
await mkdir(output,{recursive:true});
const browser = await chromium.launch({args:['--no-sandbox']});
const report=[];
try {
 for(const viewport of [{width:1440,height:1000},{width:390,height:844},{width:320,height:740}]) {
  const page=await browser.newPage({viewport,reducedMotion:'reduce'});
  await page.routeWebSocket('**',socket=>socket.close());
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  let starts=0;
  await page.route('**/api/player/**',async route=>{
   const req=route.request(), path=new URL(req.url()).pathname;
   if(req.method()==='POST' && path.endsWith('/matches')){
    starts++;const body=req.postDataJSON();
    assert.equal(body.mode,'practice');assert.equal(body.activity,'auto');assert.equal(body.playerDeckId,'block');
    const contract=await page.evaluate(()=>window.cardQA.contract);
    return route.fulfill({status:201,json:{id:'qa-training',mode:'practice',...contract,encounterSnapshot:null,status:'active',createdAt:'2026-10-24T00:00:00Z'}});
   }
   if(req.method()==='GET' && path.endsWith('/bootstrap'))return route.fulfill({json:{profile:{id:'card-qa',softCurrency:0,xp:0,level:1,streetRep:0},missions:[],nextAction:null}});
   return route.fulfill({status:404,json:{error:'Unexpected QA API route'}});
  });
  const waitForArt=async()=>{
   await page.waitForFunction(()=>[...document.querySelectorAll('.collector-portrait, .layered-print img, .layered-element img')].every(image=>image instanceof HTMLImageElement && image.complete && image.naturalWidth>0));
   await page.evaluate(async()=>{await document.fonts.ready; await Promise.all([...document.querySelectorAll('.collector-portrait, .layered-print img, .layered-element img')].map(image=>image.decode())); await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
   const inspector=page.locator('.card-inspector-layout');
   if(await inspector.count())await expect(inspector).toHaveCSS('opacity','1');
  };
  const go=scene=>page.goto(`${origin}/e2e/card-qa-refinement.fixture.html?scene=${scene}`);
  await go('gacha');
  for(const kind of ['card','variant','styleShards']){
   const card=page.getByTestId(`gacha-${kind}`).locator('[data-layered-card=true]');
   await card.waitFor();assert.equal(await card.locator('.layered-print img').count(),1);
   assert.match(await card.locator('.layered-element img').getAttribute('src'),/plant-fist/);
  }
  await waitForArt();
  await page.screenshot({path:`${output}/gacha-print-${viewport.width}.png`,fullPage:true});
  for(const [id,ability,fist] of [['buddy','Earth Squabble','earth-fist'],['luigion','Powered Up','normal-fist']]){
   await go(id);
   const card=page.getByTestId('card-inspector');await card.waitFor();
   assert.equal(await card.getAttribute('data-layered-card'),'true');
   await expect(card.locator('.layered-rules strong')).toHaveText(ability);
   await expect(page.locator('.dossier-sticky__title')).toHaveText(ability);
   if(id==='buddy')assert.match(await card.locator('.layered-element img').getAttribute('src'),new RegExp(fist));
   if(id==='luigion')await expect(page.getByRole('dialog')).toHaveAttribute('aria-label','Powered Luigion battle details');
   assert.ok(await card.getAttribute('data-instance-id'));
   await waitForArt();
  await page.screenshot({path:`${output}/${id}-form-${viewport.width}.png`,fullPage:true});
   await page.getByTestId('button-close-inspector').click();
   await expect(page.getByRole('dialog')).toHaveCount(0);
  }
  await go('training');
  await page.getByTestId('panel-training').waitFor();
  await expect(page.locator('[data-testid^=training-lineup-][data-layered-card=true]')).toHaveCount(10);
  await waitForArt();
  await page.screenshot({path:`${output}/training-lineup-${viewport.width}.png`,fullPage:true});
  await page.getByRole('button',{name:/^Practice /}).click();
  const arena=page.getByTestId('battle-arena');await arena.waitFor({timeout:30000});
  await expect.poll(async()=>{
   const dismiss=page.getByTestId('button-dismiss-mechanic-lesson');if(await dismiss.isVisible().catch(()=>false))await dismiss.click();
   return arena.getAttribute('data-presentation-phase');
  },{timeout:30000}).toBe('player-ready');
  assert.equal(starts,1,'the real training launch starts exactly one canonical practice session');
  const hand=page.getByTestId('hand-tray').locator('[data-card-id]').first();
  await hand.press('Alt+Enter');
  await expect(page.getByTestId('card-inspector')).toHaveAttribute('data-layered-card','true');
  assert.ok(await page.getByTestId('card-inspector').getAttribute('data-instance-id'),'battle inspector retains the live card instance');
  await waitForArt();
  await page.screenshot({path:`${output}/training-battle-inspector-${viewport.width}.png`,fullPage:true});
  assert.deepEqual(errors,[]);
  report.push({viewport,gachaKinds:3,transformedInspectors:['buddy','luigion'],trainingLineup:10,canonicalTrainingStarts:starts,liveBattlePrint:true,pageErrors:errors});
  await page.close();
 }
 await writeFile(`${output}/card-qa-report.json`,JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));
} finally {await browser.close();}
