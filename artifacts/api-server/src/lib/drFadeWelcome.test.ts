import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { db, playerProfilesTable, playerStoryRewardClaimsTable } from '@workspace/db';
import { eq } from 'drizzle-orm';
import { ROOKIE_DECK_ID, ROOKIE_CORE_IDS, ROOKIE_MENTOR_CORE_IDS } from '@workspace/squabblemon-engine/data';
import { getStoryNode } from '@workspace/squabblemon-engine/story';
import { planShopPurchase, type ShopWallet } from '@workspace/squabblemon-engine/economy';
import { getPlayerBootstrap } from './playerState';
import { grantFirstCollection, lockPlayerProfile } from './playerRewardTransactions';
import { grantStoryRewards } from './storyTransactions';

async function player(t: test.TestContext, values: Partial<typeof playerProfilesTable.$inferInsert> = {}) {
  const clerkUserId='dr-fade-'+randomUUID();
  await db.insert(playerProfilesTable).values({clerkUserId,onboardingStep:'tutorial',...values});
  t.after(async()=>{await db.delete(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId,clerkUserId))});
  return clerkUserId;
}
test('new players receive Dr. Fade once, in their legal opening lineup, before the first battle',async t=>{
  const id=await player(t);
  const empty=await getPlayerBootstrap(id); assert.equal(empty.profile.ownedCardIds.includes('dr-fade'),false);
  await Promise.all([grantFirstCollection(id),grantFirstCollection(id),getPlayerBootstrap(id)]);
  const state=await getPlayerBootstrap(id);
  assert.equal(state.profile.ownedCardIds.filter(id=>id==='dr-fade').length,1);
  const gang=state.profile.savedDecks.find(d=>d.id===ROOKIE_DECK_ID)!;
  assert.deepEqual(gang.cardIds,ROOKIE_MENTOR_CORE_IDS); assert.equal(gang.heroCardId,'dr-fade'); assert.equal(gang.valid,true);
  assert.deepEqual(state.profile.cardProgression['dr-fade'],{xp:0,level:1,moveTier:0});
  assert.equal(state.profile.softCurrency,0);assert.equal(state.profile.onboardingStep,'tutorial');
});
test('returning players receive the mentor without changing existing decks, ownership, upgrades or wallet',async t=>{
  const gang={id:'custom-gang',name:'Keep this',cardIds:[...ROOKIE_CORE_IDS.slice(0,8),'kyle','stockz'],heroCardId:'kyle',recipeId:null,deckSize:10};
  const id=await player(t,{onboardingStep:'complete',starterRewardClaimed:true,tutorialCompleted:true,
    ownedCardIds:gang.cardIds,savedDecks:[gang],softCurrency:725,packTickets:9,styleShards:88,
    cardProgression:{kyle:{xp:2800,level:8,moveTier:3},stockz:{xp:1000,level:5,moveTier:2}}});
  await Promise.all([getPlayerBootstrap(id),getPlayerBootstrap(id)]);
  const state=await getPlayerBootstrap(id);
  assert.deepEqual(state.profile.savedDecks[0].cardIds,gang.cardIds);assert.equal(state.profile.savedDecks[0].heroCardId,'kyle');
  assert.deepEqual(new Set(state.profile.ownedCardIds),new Set([...gang.cardIds,'dr-fade']));
  assert.equal(state.profile.cardProgression.kyle.moveTier,3);assert.equal(state.profile.cardProgression.stockz.moveTier,2);
  assert.equal(state.profile.softCurrency,725);assert.equal(state.profile.packTickets,9);assert.equal(state.profile.styleShards,88);
  assert.equal(state.profile.onboardingStep,'complete');
});
test('chapter training funds grant once and the first fund can buy Dr. Fade first upgrade without duplicate pulls',async t=>{
  const id=await player(t,{ownedCardIds:['dr-fade']});
  const award=async(nodeId:string,chapterId:string)=>db.transaction(async tx=>{
    await lockPlayerProfile(tx,id);
    const rewards=getStoryNode(nodeId)!.rewards.filter(r=>r.kind==='currency'&&r.id==='clout');
    return grantStoryRewards(tx,id,chapterId,nodeId,rewards);
  });
  const first=await Promise.all([award('block-crowned','block-party'),award('block-crowned','block-party')]);
  assert.equal(first.flat().length,1); assert.match(first.flat()[0].description,/250 Clout/);
  const [profile]=await db.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId,id));
  assert.equal(profile.softCurrency,250);
  const trained=planShopPurchase(profile as ShopWallet,{itemId:'training',cardId:'dr-fade'});
  const coached=planShopPurchase(trained.wallet,{itemId:'move-training',cardId:'dr-fade'});
  assert.equal(coached.wallet.softCurrency,0);assert.equal(coached.wallet.cardProgression['dr-fade'].moveTier,1);
  const second=await Promise.all([award('red-tapes-let-her-grieve','red-side-tapes'),award('red-tapes-let-her-grieve','red-side-tapes')]);
  assert.equal(second.flat().length,1);
  const [after]=await db.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId,id));
  assert.equal(after.softCurrency,750);
  assert.equal((await db.select().from(playerStoryRewardClaimsTable).where(eq(playerStoryRewardClaimsTable.clerkUserId,id))).length,2);
});
