import assert from 'node:assert/strict';
import {chromium,type Page} from 'playwright';
import {ROOKIE_CORE_IDS,ROOKIE_FOUNDATION_IDS,catalogIdsToEngineIds} from '../src/data';
import {activities,makeActivityEncounter,validateDraft,eventWeek,type ActivityId} from '@workspace/squabblemon-engine/activities';
import {createStoryMatch,verifyStoryMatchTranscript,type Match} from '../src/gameEngine';
import {createCardProgressionSnapshot} from '../../api-server/src/lib/cardProgression';
process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY='1';
const origin=process.env.JOURNEY_ORIGIN??'http://127.0.0.1:4180/squabblemon';
async function finish(page:Page){
 for(let round=1;round<=6;round++){
  for(let i=0;i<220;i++){if(await page.locator('[data-testid="battle-arena"][data-presentation-phase="player-ready"]').count())break;const skip=page.getByTestId('button-fast-forward');if(await skip.count())await skip.click({timeout:500}).catch(()=>{});await page.waitForTimeout(60);}
  await page.getByTestId('button-next-round').click();await page.waitForTimeout(150);
 }
 for(let i=0;i<220;i++){if(await page.getByTestId('status-match-result').count())return;const skip=page.getByTestId('button-fast-forward');if(await skip.count())await skip.click({timeout:500}).catch(()=>{});await page.waitForTimeout(60);}throw Error('No result');
}
async function run(width:number,height:number){
 const browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));let owned=[...ROOKIE_FOUNDATION_IDS],choices:string[]=[],completed=0,issued:Match|null=null;
 const deck={id:'my-crew',name:'My Mixed Crew',cardIds:[...ROOKIE_CORE_IDS],heroCardId:'hooper',recipeId:null,valid:true,issues:[]};
 function bootstrap(){return {profile:{id:'gameplay-browser',displayName:'Rookie',avatarKey:'hooper',onboardingStep:'complete',starterDeckId:'foundation-v1',streetRep:0,xp:0,level:1,softCurrency:0,packTickets:0,styleShards:0,packPity:0,deckSlots:4,cosmeticCurrency:0,collectionProgress:owned.length,storyChapter:1,storyNode:0,tutorialCompleted:true,starterRewardClaimed:true,ageConfirmedAt:new Date(0).toISOString(),termsAcceptedAt:new Date(0).toISOString(),settings:{reducedMotion:true,turnTimerEnabled:false},ownedCardIds:owned,discoveredCardIds:owned,cardProgression:{cornball:{xp:2800,level:8,moveTier:3}},ownedVariants:[],equippedVariants:{},unlockedCosmeticIds:[],savedDecks:[deck],storyProgress:{gameplay:{cleansed:true,choices,wins:{cornball:2}}},inbox:[],packHistory:[],lastActiveAt:new Date(0).toISOString()},missions:[],nextAction:{id:'play',eyebrow:'Training',title:'Test your idea',description:'Build a crew',destination:'play',rewardLabel:null},packConfig:{id:'street-pack',name:'Street Pack',oddsVersion:'test',softCurrencyCost:200,ticketCost:1,rewardsPerPack:3,pityLimit:10,odds:[]},collectionRoad:[]};}
 try{
  await page.addInitScript(()=>localStorage.setItem('squabblemon_e2e_user','signed-in'));
  await page.route('**/api/player/**',async route=>{
   const req=route.request(),path=new URL(req.url()).pathname;
   if(path.endsWith('/bootstrap'))return route.fulfill({json:bootstrap()});
   if(path.endsWith('/story'))return route.fulfill({status:503,json:{error:'Not in this fixture'}});
   if(path.endsWith('/experiments/card')){const id=req.postDataJSON().cardId;assert.equal(choices.length,0);assert(!owned.includes(id));choices.push(id);owned.push(id);return route.fulfill({json:bootstrap()});}
   if(path.endsWith('/matches')){
    const body=req.postDataJSON(),kind:ActivityId=body.activity??'auto';assert(activities.some(a=>a.id===kind));if(kind==='draft')assert(validateDraft(body.draftWeek,body.draftPicks),JSON.stringify(body));
    const roster=kind==='draft'?body.draftPicks:catalogIdsToEngineIds(deck.cardIds);const encounter=makeActivityEncounter(kind,'browser-test','block',eventWeek());
    const progression=createCardProgressionSnapshot(roster,owned,encounter.activity!.normalized?{}:bootstrap().profile.cardProgression,kind==='draft',[...encounter.enemy.cardIds]);
    issued=createStoryMatch(encounter,roster,body.playerDeckId,progression.abilityUpgradeSnapshot);if(encounter.activity!.normalized)assert(issued.abilityUpgradeSnapshot.player.every(c=>c.upgradeIds.length===0));
    return route.fulfill({json:{id:'11111111-1111-4111-8111-111111111111',mode:'practice',playerDeckId:body.playerDeckId,rivalDeckId:encounter.enemy.deckId,storyNodeId:null,contentVersion:null,encounterSnapshot:encounter,abilityUpgradeSnapshot:progression.abilityUpgradeSnapshot,status:'active',createdAt:new Date().toISOString()}});
   }
   if(path.endsWith('/complete')){assert(issued);const m=verifyStoryMatchTranscript(issued.storyEncounter!,issued.playerCardIds,req.postDataJSON().moves,issued.playerDeck,issued.abilityUpgradeSnapshot);assert.equal(m.phase,'complete');completed++;return route.fulfill({json:{...bootstrap(),reward:{id:'test',label:'Match saved',xp:0,streetRep:0,softCurrency:0,packTickets:0,descriptions:[],cardXpRewards:[],storyRewards:[]},alreadyCompleted:false,campaign:null,story:null}});}
   return route.fulfill({status:404,json:{error:`Unexpected request ${path}`}});
  });
  await page.goto(`${origin}/game/decks/my-crew`);await page.getByRole('navigation',{name:'Deck navigation'}).waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:`../../screenshots/gameplay-builder-${width}.png`,fullPage:true});
  await page.goto(`${origin}/game/missions`);await page.getByRole('button',{name:'Experiments & mastery'}).click();await page.getByRole('button',{name:'Young Bull',exact:true}).click();await page.getByRole('button',{name:'Claim Young Bull',exact:true}).click();await page.getByRole('button',{name:'Young Bull',exact:true}).waitFor({state:'detached'});assert.deepEqual(choices,['young-bull']);await page.screenshot({path:`../../screenshots/gameplay-career-${width}.png`,fullPage:true});
  for(const kind of (process.env.DRAFT_ONLY ? ['draft'] : ['freeze','fair','neighborhood','boss','draft']) as ActivityId[]){
   await page.goto(`${origin}/game/play`);if(kind!=='freeze')await page.getByRole('button',{name:'Events & equal footing',exact:true}).click();
   const activity=activities.find(a=>a.id===kind)!;await page.locator('.activity-choice').filter({has:page.getByText(activity.name,{exact:true})}).click();
   if(kind==='draft'){for(let i=0;i<7;i++)await page.getByRole('button',{name:/^Draft /}).first().click();await page.getByRole('button',{name:'Undo last pick',exact:true}).click();await page.getByRole('button',{name:/^Draft /}).last().click();await page.screenshot({path:`../../screenshots/gameplay-draft-${width}.png`,fullPage:true});await page.getByRole('button',{name:'Play this draft',exact:true}).click();}
   else{if(kind==='fair')await page.screenshot({path:`../../screenshots/gameplay-events-${width}.png`,fullPage:true});await page.getByRole('button',{name:/My Mixed Crew/}).click();await page.getByRole('button',{name:'Enter fight',exact:true}).click();}
   await finish(page);await page.getByLabel('Dr. Fade match advice').waitFor();assert.equal(await page.getByRole('button',{name:'Retry Save',exact:true}).count(),0);if(kind==='draft')await page.screenshot({path:`../../screenshots/gameplay-result-${width}.png`,fullPage:true});
  }
  assert.equal(completed,process.env.DRAFT_ONLY ? 1 : 5);assert.deepEqual(errors,[]);console.log(`${width}px passed: guidance, chosen card, draft undo, five full verified activity battles, and coaching.`);
 }catch(error){await page.screenshot({path:`../../screenshots/gameplay-debug-${width}.png`,fullPage:true});throw error;}finally{await browser.close();}
}
await run(390,844);await run(1280,900);



