import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { storyContent, storyDialogueToken } from '@workspace/squabblemon-engine/story';
const origin = process.env.UI_ORIGIN ?? 'http://localhost:4210';
const appBasePath = new URL(origin).pathname.replace(/\/+$/, '');
const browser = await chromium.launch();
try {
 const page = await browser.newPage({reducedMotion:'reduce'});
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const assertInViewport = async (selector:string) => {
  const target=page.locator(selector).last();
  await target.scrollIntoViewIfNeeded();
  const box=await target.boundingBox();assert(box && box.width>0 && box.height>0,`${selector} must have visible dimensions`);
  const viewport=page.viewportSize()!;
  assert(box.x>=0 && box.y>=0 && box.x+box.width<=viewport.width+1 && box.y+box.height<=viewport.height+1,`${selector} must fit in viewport`);
 };
  for(const chapter of storyContent.chapters.slice(0,8)) {
  const node=chapter.nodes.findLast(node=>node.kind!=='battle' && node.rewards.length>0)!;
  assert(node.kind!=='battle');
  let claimed=false, fail=true, requests=0;
   const issued = node.rewards.map((r,i)=>({...r,rewardKey:r.claimKey??`${node.id}:${i}:${r.kind}:${r.id}`,duplicateShards:0,description:`+${r.amount} ${r.id}`}));
   const clout=issued.filter(r=>r.kind==='currency'&&r.id==='clout').reduce((sum,r)=>sum+r.amount,0);
   const tickets=issued.filter(r=>r.kind==='pack-ticket').reduce((sum,r)=>sum+r.amount,0);
   const profile={id:'fixture-player',softCurrency:675+clout,packTickets:3+tickets,styleShards:0,streetRep:0,xp:0,ownedCardIds:[],unlockedCosmeticIds:[]};
  const progress={nodeId:node.id,chapterId:chapter.id,cleared:false,status:'available',stars:0,dialogueSeen:node.scenes.map((_,i)=>storyDialogueToken(node.id,'main',i))};
  const campaign={nodes:[progress],chapters:[]};
  await page.route('**/api/player/story**',async route=>{
   if(route.request().method()==='GET')return route.fulfill({json:campaign});
   requests++;
   if(fail){fail=false;return route.fulfill({status:503,json:{error:'Retry the save'}})}
    const rewards=claimed?[]:issued;
    const alreadyCompleted=claimed;
   claimed=true;progress.cleared=true;progress.status='cleared';
    return route.fulfill({json:{campaign,rewards,alreadyCompleted,bootstrap:{profile}}});
  });
   await page.setViewportSize({width:375,height:568});
  await page.goto(`${origin}/e2e/story-reward-recovery.fixture.html?node=${node.id}`);
   await assertInViewport('[data-testid="button-return-story-map"]');
   await assertInViewport('.story-complete-prizes .story-prize__icon');
  await page.getByRole('button',{name:'Collect story rewards',exact:true}).click();
  await page.getByRole('alert').waitFor();
  assert(!claimed);
   assert.equal(await page.locator('dialog[open].reward-reveal--story').count(),0);
  await page.getByRole('button',{name:'Collect story rewards',exact:true}).click();
  await page.locator('dialog[open].reward-reveal--story').waitFor();
    const backdropPath = new URL(await page.locator('.reward-reveal__story-backdrop').getAttribute('src')!, origin).pathname;
    assert.equal(backdropPath,`${appBasePath}/${chapter.mapAssetId.replace(/^\/+/, '')}`);
   assert.equal(await page.locator('.reward-reveal__travel-token').count(),0,'reduced motion has no traveling token');
   assert.equal(await page.locator('.reward-reveal__collection').getAttribute('data-collected'),'true');
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('.reward-reveal img')).every((i:any)=>i.complete&&i.naturalWidth>0));
   assert.equal(Number(await page.locator('.reward-reveal__collection').getAttribute('data-balance-from')),675);
   assert.equal(Number(await page.locator('.reward-reveal__collection').getAttribute('data-balance-to')),profile.softCurrency);
   assert.equal(await page.locator('.reward-reveal__story-item').count(), issued.length);
   await assertInViewport('.reward-reveal__story-item:last-child .reward-reveal__story-item-art');
   await assertInViewport('.reward-reveal__story-footer button');
   assert.equal(await page.locator('.reward-reveal__story-item img, .reward-reveal__story-item .game-glyph img').count()>0,true);
   await page.getByRole('button',{name:'Keep going'}).focus();
  await page.screenshot({path:`/tmp/story-reward-${chapter.id}.png`,fullPage:true});
  await page.getByRole('button',{name:'Keep going'}).click();
  await page.getByRole('button',{name:'Check reward delivery',exact:true}).click();
  await page.getByText('These rewards were already saved to your account.').waitFor();
  assert.equal(requests,3);
  assert.equal(await page.locator('dialog[open]').count(),0);
  await page.unroute('**/api/player/story**');
 }
  await page.route('**/api/player/story**',async route=>{
   if(route.request().method()==='GET')return route.fulfill({json:{nodes:[{nodeId:'block-crowned',chapterId:'block-party',cleared:true,status:'cleared',stars:0,dialogueSeen:storyContent.chapters[0].nodes.find(n=>n.id==='block-crowned')?.kind==='reward'?storyContent.chapters[0].nodes.find(n=>n.id==='block-crowned')!.scenes.map((_,i)=>storyDialogueToken('block-crowned','main',i)):[]}],chapters:[]}});
   return route.fulfill({json:{alreadyCompleted:true,rewards:[{kind:'currency',id:'clout',amount:250,rewardKey:'story-payout-make-good:v1:block-crowned:clout',duplicateShards:0,description:'+250 Clout'},{kind:'pack-ticket',id:'street-pack-ticket',amount:8,rewardKey:'story-payout-make-good:v1:block-crowned:tickets',duplicateShards:0,description:'+8 tickets'}],bootstrap:{profile:{id:'fixture-catchup',softCurrency:925,packTickets:11}},campaign:{nodes:[],chapters:[]}}});
  });
  await page.setViewportSize({width:1440,height:900});
  await page.goto(`${origin}/e2e/story-reward-recovery.fixture.html?node=block-crowned`);
  await page.getByRole('button',{name:'Check reward delivery'}).click();
  await page.locator('dialog[open].reward-reveal--story').waitFor();
  assert(await page.getByText('The neighborhood owed you').isVisible());
  assert.equal(await page.locator('.reward-reveal__collection').getAttribute('data-balance-from'),'675');
  await page.getByRole('button',{name:'Keep going'}).click();
  await page.unrouteAll();
  const animated=await browser.newPage({viewport:{width:390,height:667},reducedMotion:'no-preference'});
  animated.on('pageerror',e=>errors.push(e.message));
   await animated.goto(`${origin}/e2e/story-reward-recovery.fixture.html?receipt=1`);
   await animated.getByTestId('show-animated-story-receipt').waitFor();
  // Observe the production receipt in the browser while the token is in flight,
  // rather than racing Playwright against its short exit animation.
   await animated.getByTestId('show-animated-story-receipt').click();
   const token=animated.locator('.reward-reveal__travel-token');
   await token.waitFor({state:'visible'});
   const startBox=await token.boundingBox();
   const walletBox=await animated.locator('.reward-reveal__wallet').boundingBox();
   assert(startBox && walletBox,'the animated receipt exposes its traveling token and wallet');
   await animated.waitForTimeout(420);
   const midBox=await token.boundingBox();
   assert(midBox && startBox.x<walletBox.x && midBox.x>startBox.x+10,'actual Clout token moves toward on-screen balance');
  await animated.locator('.reward-reveal__collection[data-collected="true"]').waitFor();
  await animated.getByRole('status').filter({hasText:'Balance 925 Clout'}).waitFor();
  await animated.keyboard.press('Escape');
   await animated.getByTestId('show-skippable-story-receipt').click();
  await animated.getByRole('button',{name:'Skip animation'}).click();
  assert.equal(await animated.locator('.reward-reveal__collection').getAttribute('data-collected'),'true');
  await animated.getByRole('status').filter({hasText:'Balance 925 Clout'}).waitFor();
  await animated.keyboard.press('Escape');
  assert.equal(await animated.locator('dialog[open]').count(),0);
   await animated.getByTestId('show-long-story-receipt').click();
  await animated.setViewportSize({width:320,height:480});
  await animated.locator('.reward-reveal__collection[data-collected="true"]').waitFor();
  await animated.getByRole('status').filter({hasText:'Balance 925 Clout'}).waitFor();
  const lastArt=animated.locator('.reward-reveal__story-item:last-child .reward-reveal__story-item-art');
  await lastArt.scrollIntoViewIfNeeded();
  const artBox=await lastArt.boundingBox(), dismissBox=await animated.locator('.reward-reveal__story-footer button').boundingBox();
  assert(artBox && artBox.x>=0 && artBox.x+artBox.width<=320 && artBox.y>=0 && artBox.y+artBox.height<=480,'last of many item icons remains fully visible on a short phone');
  assert(dismissBox && dismissBox.y>=0 && dismissBox.y+dismissBox.height<=480,'dismissal remains visible while scrolling long loot');
  await animated.keyboard.press('Escape');
  await animated.close();
  const chapter=storyContent.chapters[0];
  const panelCampaign={chapters:[{id:chapter.id,title:chapter.title,status:'available',order:chapter.order,mapAssetId:chapter.mapAssetId}],
   nodes:chapter.nodes.map((node,index)=>({nodeId:node.id,chapterId:chapter.id,title:node.title,kind:node.kind,optional:node.optional,
    mapPosition:node.mapPosition,prerequisites:node.prerequisites,status:index===0?'cleared':index===1?'available':'locked',
    cleared:index===0,stars:index===0?3:0,dialogueSeen:[]})),recommendedNodeId:chapter.nodes[1].id};
  let pendingCatchUp=true;
  await page.route('**/api/player/story**',route=>{
   const catchUp=pendingCatchUp?{rewards:[{kind:'currency',id:'clout',amount:100,rewardKey:'story-payout-make-good:v1:welcome-to-the-block:clout',duplicateShards:0,description:'+100 Clout'},{kind:'pack-ticket',id:'street-pack-ticket',amount:1,rewardKey:'story-payout-make-good:v1:welcome-to-the-block:tickets',duplicateShards:0,description:'+1 Ticket'}],bootstrap:{profile:{id:'fixture-player',softCurrency:775,packTickets:4}}}:undefined;
   pendingCatchUp=false;
   return route.fulfill({json:{...panelCampaign,...(catchUp?{catchUp}:{})}});
  });
  for(const size of [{width:375,height:568},{width:1440,height:900}]) {
   await page.setViewportSize(size);
   await page.goto(`${origin}/e2e/story-reward-recovery.fixture.html?season=season-1&panel=1`);
   if(size.width===375){
    await page.locator('dialog[open].reward-reveal--story').waitFor();
    assert(await page.getByText('Missing first-clear rewards · added now').isVisible());
    assert.equal(await page.locator('.reward-reveal__collection').getAttribute('data-balance-to'),'775');
    await page.getByRole('button',{name:'Keep going'}).click();
   } else assert.equal(await page.locator('dialog[open]').count(),0,'repeat campaign load must not replay catch-up');
   await page.getByTestId('button-open-chapter-rewards').click();
   await page.getByRole('dialog',{name:'Chapter rewards'}).waitFor();
   assert.equal(await page.locator('.story-award-stop').count(),chapter.nodes.length);
   assert(await page.getByTestId(`story-reward-stop-${chapter.nodes[0].id}`).getByText('Earned').isVisible());
   assert(await page.getByTestId(`story-reward-stop-${chapter.nodes[1].id}`).getByText('Not earned').isVisible());
   assert(await page.getByTestId(`story-reward-stop-${chapter.nodes.at(-1)!.id}`).getByText('Locked').isVisible());
   assert(await page.getByTestId(`story-reward-stop-${chapter.nodes.at(-1)!.id}`).getByText('+10 Pack Tickets').isVisible());
   await assertInViewport('.story-award-stop--finale .story-prize__icon');
   await assertInViewport('[data-testid="button-close-chapter-rewards"]');
   await page.screenshot({path:`/tmp/story-chapter-rewards-${size.width}.png`});
   await page.getByTestId('button-close-chapter-rewards').click();
  }
  await page.unrouteAll();
 assert.deepEqual(errors,[]);
  console.log('Story rewards: retry, repeat, catch-up, receipt wallet, token skip, reduced motion, art/action bounds on short phones and desktop.');
} finally {await browser.close()}
