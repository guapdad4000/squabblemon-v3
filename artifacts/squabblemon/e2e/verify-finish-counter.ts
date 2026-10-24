import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import { planShopPurchase, type ShopRequest, type ShopReceipt } from '@workspace/squabblemon-engine/economy';
import { profileBootstrap } from './fighter-id.fixture';
const origin=process.env.UI_ORIGIN??'http://127.0.0.1:4245';
const output=process.env.FINISH_OUTPUT??'/tmp/squabblemon-finish-counter';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/google-chrome',args:['--no-sandbox']});
const report:unknown[]=[];
const makeProfile=()=>profileBootstrap({id:'finish-counter-player',ownedCardIds:['cornball','kyle'],discoveredCardIds:['cornball','kyle'],styleShards:200,styleShardBalances:{Common:60},settings:{reducedMotion:true,turnTimerEnabled:true}});
try {
  for(const viewport of [{width:320,height:740},{width:390,height:844},{width:844,height:390},{width:1440,height:1000}]) {
    const page=await browser.newPage({viewport}),errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(`${origin}/e2e/finish-counter.fixture.html?view=finishes&item=chrome-style&card=cornball`);
    const counter=page.getByTestId('finish-counter');await expect(counter).toBeVisible();
    await expect(page.getByRole('link',{name:/Card finishes Tagged/})).toHaveAttribute('aria-current','page');
    await expect(counter.getByRole('region',{name:'Your Style Shards'})).toHaveCount(1);
    await expect(counter.locator('[data-card-variant="chrome"]')).toHaveCount(1);
    await expect(counter.getByRole('button',{name:/Unlock Chrome Finish/})).toBeEnabled();
    await page.getByRole('combobox',{name:'Choose your character'}).click();
    await expect(page.getByRole('option')).toHaveCount(2);
    await page.getByRole('option',{name:/Kyle/i}).click();
    await expect(counter.locator('h3')).toContainText('KYLE');
    await page.getByRole('combobox',{name:'Choose your character'}).click();await page.getByRole('option',{name:/Cornball/}).click();
    await page.evaluate(async()=>{await Promise.race([document.fonts.ready,new Promise(resolve=>setTimeout(resolve,1500))]);await Promise.race([Promise.all([...document.images].filter(image=>image.getBoundingClientRect().width>0).map(image=>image.decode().catch(()=>{}))),new Promise(resolve=>setTimeout(resolve,2500))]);});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.screenshot({path:`${output}/finish-counter-${viewport.width}.png`,fullPage:true});
    await counter.getByRole('button',{name:/Unlock Chrome Finish/}).scrollIntoViewIfNeeded();
    assert.equal(await counter.getByRole('button',{name:/Unlock Chrome Finish/}).evaluate(element=>{const box=element.getBoundingClientRect();return box.height>=44&&document.elementFromPoint(box.x+box.width/2,box.y+box.height/2)===element;}),true);
    assert.deepEqual(errors,[]);report.push({viewport,realFinishPreview:true,ownedSelector:true,wallet:true,reachablePurchase:true,noOverflow:true});await page.close();
  }
  const page=await browser.newPage({viewport:{width:390,height:844}}),requests:ShopRequest[]=[];
  let server=makeProfile(),grants=0;
  const receipts=new Map<string,{request:ShopRequest;receipt:ShopReceipt}>();
  await page.route('**/api/player/shop/purchases',async route=>{
    const request=route.request().postDataJSON() as ShopRequest;requests.push(request);
    const saved=receipts.get(request.idempotencyKey);
    if(saved){assert.deepEqual(request,saved.request);await route.fulfill({json:{receipt:saved.receipt,bootstrap:server}});return;}
    const planned=planShopPurchase(server.profile,request);server={...server,profile:{...server.profile,...planned.wallet}};grants++;
    receipts.set(request.idempotencyKey,{request,receipt:planned.receipt});
    await route.abort('failed'); // Server accepted the purchase, but its response was lost.
  });
  await page.goto(`${origin}/e2e/finish-counter.fixture.html?view=finishes&item=tagged-style&card=cornball`);
  const buy=page.getByRole('button',{name:/Unlock Tagged Finish/});await expect(buy).toBeEnabled();
  await buy.evaluate(button=>{(button as HTMLButtonElement).click();(button as HTMLButtonElement).click();});
  await expect(page.getByRole('alert')).toContainText('Purchase not confirmed');assert.equal(requests.length,1);
  await expect(page.getByRole('combobox',{name:'Choose your character'})).toBeDisabled();
  const first=structuredClone(requests[0]);
  await page.goto(`${origin}/e2e/finish-counter.fixture.html?view=finishes&item=chrome-style&card=kyle`);
  await expect(page.locator('.finish-counter__checkout h3')).toContainText('Cornball · Tagged Finish');
  await page.getByRole('button',{name:'Recover purchase',exact:true}).click();
  await expect(page.locator('.finish-counter__owned')).toHaveText('Already unlocked');
  await expect(page.locator('.finish-counter__receipt')).toContainText('Paid 60 Common + 20 Universal shards.');
  assert.equal(grants,1);assert.equal(requests.length,2);assert.deepEqual(requests[1],first);assert.equal(server.profile.styleShards,180);assert.equal(server.profile.styleShardBalances?.Common,0);assert.deepEqual(server.profile.ownedVariants,['cornball:tagged']);
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('squabblemon.shop.pending.v1:finish-counter-player')),null);
  await expect(page.getByRole('link',{name:'View & equip in Collection →'})).toHaveAttribute('href','/game/collection?card=cornball&variant=cornball%3Atagged');
  report.push({retryAfterLostResponse:true,exactOriginalIntent:true,oneGrant:true,matchingShardsFirst:true,httpRequests:requests});
  await page.evaluate(()=>sessionStorage.setItem('squabblemon.shop.pending.v1:finish-counter-player',JSON.stringify({idempotencyKey:'99dbe5b8-9512-4a27-9938-44e589bcc653',itemId:'deck-slot'})));
  await page.goto(`${origin}/e2e/finish-counter.fixture.html?view=finishes&item=tagged-style&card=cornball`);
  await expect(page.getByRole('link',{name:'Recover that purchase →'})).toHaveAttribute('href','/game/shop?view=corner&item=deck-slot');
  await expect(page.getByRole('button',{name:/Unlock Tagged Finish/})).toBeDisabled();assert.equal(requests.length,2);
  report.push({foreignRequestPreserved:true,noForeignFinishCharge:true});
  await page.evaluate(()=>sessionStorage.setItem('squabblemon.shop.pending.v1:finish-counter-player',JSON.stringify({idempotencyKey:'79dbe5b8-9512-4a27-9938-44e589bcc653',itemId:'common-recruit',cardId:'young-bull'})));
  await page.goto(`${origin}/e2e/finish-counter.fixture.html?view=finishes&item=chrome-style&card=kyle`);
  await expect(page.getByRole('link',{name:'Recover that purchase →'})).toHaveAttribute('href','/game/shop?view=packs&banner=neighborhood&card=young-bull');
  await expect(page.getByRole('button',{name:/Unlock Chrome Finish/})).toBeDisabled();assert.equal(requests.length,2);
  assert.equal(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('squabblemon.shop.pending.v1:finish-counter-player')!).cardId),'young-bull');
  report.push({foreignCommonRecovery:true,originalRecruitCardPreserved:true});await page.close();
  await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
} finally {await browser.close();}
