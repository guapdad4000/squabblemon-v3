import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { storyContent, storyDialogueToken } from '@workspace/squabblemon-engine/story';
const origin = process.env.UI_ORIGIN ?? 'http://localhost:4210';
const browser = await chromium.launch();
try {
 const page = await browser.newPage({reducedMotion:'reduce'});
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 for(const size of [{width:375,height:667},{width:1440,height:900}]) {
  await page.setViewportSize(size);
  await page.goto(`${origin}/e2e/result-stage.fixture.html?state=error`);
  await page.locator('.result-stage__receipt-drawer > summary').click();
  assert(await page.getByRole('button',{name:'Retry Save',exact:true}).isVisible());
  await page.goto(`${origin}/e2e/result-stage.fixture.html?state=story-pending`);
  assert(await page.getByRole('button',{name:'Continue Chapter'}).isDisabled());
  await page.getByText('Saving your story progress and rewards…').waitFor();
  await page.goto(`${origin}/e2e/result-stage.fixture.html?state=story-error`);
  assert(await page.getByRole('button',{name:'Continue Chapter'}).isDisabled());
  assert(await page.getByRole('button',{name:'Retry Save',exact:true}).isVisible());
  await page.getByRole('button',{name:'Retry Save',exact:true}).click();
  assert(await page.getByRole('button',{name:'Continue Chapter'}).isEnabled());
  await page.getByRole('button',{name:'Continue Chapter'}).click();
  assert.equal(await page.title(),'Home requested');
 }
 for(const chapter of storyContent.chapters.slice(0,8)) {
  const node=chapter.nodes.findLast(node=>node.kind!=='battle' && node.rewards.length>0)!;
  assert(node.kind!=='battle');
  let claimed=false, fail=true, requests=0;
  const progress={nodeId:node.id,chapterId:chapter.id,cleared:false,status:'available',stars:0,dialogueSeen:node.scenes.map((_,i)=>storyDialogueToken(node.id,'main',i))};
  const campaign={nodes:[progress],chapters:[]};
  await page.route('**/api/player/story**',async route=>{
   if(route.request().method()==='GET')return route.fulfill({json:campaign});
   requests++;
   if(fail){fail=false;return route.fulfill({status:503,json:{error:'Retry the save'}})}
   const rewards=claimed?[]:node.rewards.map(r=>({...r,duplicateShards:0}));
   claimed=true;progress.cleared=true;progress.status='cleared';
   return route.fulfill({json:{campaign,rewards,alreadyCompleted:!rewards.length}});
  });
  await page.setViewportSize({width:375,height:667});
  await page.goto(`${origin}/e2e/story-reward-recovery.fixture.html?node=${node.id}`);
  await page.getByRole('button',{name:'Collect story rewards',exact:true}).click();
  await page.getByRole('alert').waitFor();
  assert(!claimed);
  await page.getByRole('button',{name:'Collect story rewards',exact:true}).click();
  await page.locator('dialog[open].reward-reveal--story').waitFor();
  assert.equal(await page.locator('.reward-reveal__backdrop').getAttribute('src'),'/'+chapter.mapAssetId);
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('.reward-reveal img')).every((i:any)=>i.complete&&i.naturalWidth>0));
  await page.getByRole('button',{name:'Keep going'}).focus();
  await page.screenshot({path:`/tmp/story-reward-${chapter.id}.png`,fullPage:true});
  await page.getByRole('button',{name:'Keep going'}).click();
  await page.getByRole('button',{name:'Check reward delivery',exact:true}).click();
  await page.getByText('These rewards were already saved to your account.').waitFor();
  assert.equal(requests,3);
  assert.equal(await page.locator('dialog[open]').count(),0);
  await page.unroute('**/api/player/story**');
 }
 assert.deepEqual(errors,[]);
 console.log('Story exits wait for saved rewards; retry visible at 2 sizes; 8 chapter receipts render real art; interrupted scenes recover and repeat checks do not repeat receipts.');
} finally {await browser.close()}
