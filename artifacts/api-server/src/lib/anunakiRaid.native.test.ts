import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { and, eq } from 'drizzle-orm';
import { db, pool, playerCollectionClaimsTable, playerProfilesTable, playerStoryNodesTable } from '@workspace/db';
import { ANUNAKI_RAID_LOANER, type AnunakiRaid } from '@workspace/squabblemon-engine/anunakiRaid';
import { createCardInstance } from '@workspace/squabblemon-engine/gameEngine';
import { storyContent } from '@workspace/squabblemon-engine/story';
import { startAnunakiRaid, actAnunakiRaid } from './anunakiRaid';

test('native raid: gates, exact retries, first clears, weekly cap and concurrent transactions', { skip: process.env.ANUNAKI_NATIVE_TEST_OWNED !== '1' }, async t => {
 const userId = `anunaki-raid-${randomUUID()}`;
 t.after(async () => { await db.delete(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId,userId)); });
 assert.ok((pool.options.max ?? 0) >= 2);
 await db.insert(playerProfilesTable).values({ clerkUserId:userId, onboardingStep:'complete', ownedCardIds:[...ANUNAKI_RAID_LOANER] });
 await assert.rejects(startAnunakiRaid(userId, randomUUID(), 'training', []), /required story/);
 for (const chapterId of ['anunaki-07-wrong-millennium','anunaki-08-original-arrival']) {
  const chapter = storyContent.chapters.find(c=>c.id===chapterId); assert.ok(chapter);
  await db.insert(playerStoryNodesTable).values(chapter.nodes.filter(node=>!node.optional).map(node=>({clerkUserId:userId,chapterId,nodeId:node.id,cleared:true})));
 }
 const trainingId = randomUUID(), training = await startAnunakiRaid(userId,trainingId,'training',[]);
 assert.equal(training.run.difficulty,'training');
 const trainAction = randomUUID(), retire = {type:'retire'} as const;
 const trainingRetired = await actAnunakiRaid(userId,trainingId,0,trainAction,retire);
 assert.equal(trainingRetired.run.status,'retired');
 assert.deepEqual(await actAnunakiRaid(userId,trainingId,0,trainAction,retire),trainingRetired);
 await assert.rejects(actAnunakiRaid(userId,trainingId,0,trainAction,{type:'blast'}), /already used/);
 const id = randomUUID(), start = await startAnunakiRaid(userId,id,'standard',[...ANUNAKI_RAID_LOANER]);
 assert.equal(start.run.status,'active');
 await assert.rejects(startAnunakiRaid(userId,id,'training',[]), /already used/);
 async function arrangeWin(runId:string) {
  const [row] = await db.select().from(playerCollectionClaimsTable).where(and(eq(playerCollectionClaimsTable.clerkUserId,userId),eq(playerCollectionClaimsTable.milestoneKey,'anunaki-raid:run:'+runId)));
  assert.ok(row?.reward.anunakiRaid); const run = row.reward.anunakiRaid.state as AnunakiRaid;
  run.hp=1; run.match.cpuHand=[]; run.match.cpuDrawIndex=run.match.cpuCardIds.length;
  const fighter=createCardInstance('enlil','player','force-win',0); fighter.lane=0; fighter.powerModifier=10; run.match.boards[0].push(fighter);
  await db.update(playerCollectionClaimsTable).set({reward:{...row.reward,anunakiRaid:{...row.reward.anunakiRaid,state:run}}}).where(eq(playerCollectionClaimsTable.id,row.id));
 }
 await arrangeWin(id);
 const actionId=randomUUID();
 const results=await Promise.all([actAnunakiRaid(userId,id,0,actionId,{type:'blast'}),actAnunakiRaid(userId,id,0,actionId,{type:'blast'})]);
 assert.deepEqual(results[0],results[1]); assert.equal(results[0].run.status,'won');
 let [profile]=await db.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId,userId));
 assert.equal(profile.packTickets,3); assert.equal(profile.softCurrency,300); assert.equal(profile.styleShards,30);
 assert(profile.unlockedCosmeticIds.includes('anunaki-raid:cover')); assert(profile.unlockedCosmeticIds.includes('anunaki-raid:title'));
 assert.deepEqual(await startAnunakiRaid(userId,id,'standard',[...ANUNAKI_RAID_LOANER]),start);
 const second = randomUUID(); await startAnunakiRaid(userId,second,'standard',[...ANUNAKI_RAID_LOANER]); await arrangeWin(second); await actAnunakiRaid(userId,second,0,randomUUID(),{type:'blast'});
 [profile]=await db.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId,userId));
 assert.equal(profile.packTickets,3); assert.equal(profile.softCurrency,300); assert.equal(profile.styleShards,30);
 const ascended=randomUUID(); const begun=await startAnunakiRaid(userId,ascended,'ascended',[...ANUNAKI_RAID_LOANER]); assert.equal(begun.run.difficulty,'ascended'); await arrangeWin(ascended); await actAnunakiRaid(userId,ascended,0,randomUUID(),{type:'blast'});
 [profile]=await db.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId,userId));
 assert(profile.unlockedCosmeticIds.includes('player-mat:anunaki-raid-ascended')); assert(profile.unlockedCosmeticIds.includes('anunaki-raid:reaction'));
 assert.equal(profile.packTickets,6); assert.equal(profile.softCurrency,600); assert.equal(profile.styleShards,60);
});
