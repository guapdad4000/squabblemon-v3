import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { db, playerProfilesTable, playerStoryNodesTable, playerCollectionClaimsTable } from '@workspace/db';
import { storyContent } from '@workspace/squabblemon-engine/story';
import { ANUNAKI_EVENT_GAMEPLAY_READY, ANUNAKI_EVENT_MILESTONES, ANUNAKI_STORY_CHAPTERS } from '@workspace/squabblemon-engine/anunakiEvent';
import { claimAnunakiEvent, getAnunakiEvent } from './anunakiEvent';
import { equipCosmetics } from './cosmeticTransactions';
import { ownsPlayerMat, equippedPlayerMat } from '@workspace/squabblemon-engine/playerMats';
import { addReaction, ownedReactions, resolveReactionTray } from '@workspace/squabblemon-engine/reactions';

test(ANUNAKI_EVENT_GAMEPLAY_READY
  ? 'enabled journey grants cards, cosmetics, clout and tickets once after verified progress'
  : 'event release gate remains disabled', async t => {
  // Exercise grants in an isolated test copy with the flag enabled, never by changing the release default.
  if (!ANUNAKI_EVENT_GAMEPLAY_READY) { assert.equal(ANUNAKI_EVENT_GAMEPLAY_READY, false); return; }
  const userId = `anunaki-enabled-${randomUUID()}`;
  t.after(async () => { await db.delete(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, userId)); });
  await db.insert(playerProfilesTable).values({
    clerkUserId: userId, onboardingStep: 'complete', softCurrency: 40, packTickets: 4, styleShards: 7,
    ownedCardIds: ['yakub'], discoveredCardIds: ['yakub'], unlockedCosmeticIds: ['player-mat:anunaki-yakub'],
  });
  const chapters = ANUNAKI_STORY_CHAPTERS.map(id => storyContent.chapters.find(chapter => chapter.id === id)!);
  assert.ok(chapters.every(Boolean));
  const rows = chapters.flatMap(chapter => chapter.nodes.filter(node => !node.optional).map(node => ({ clerkUserId: userId, chapterId: chapter.id, nodeId: node.id, cleared: true })));
  await db.insert(playerStoryNodesTable).values(rows);
  const masteryBattle=chapters.at(-1)!.nodes.find(node=>node.kind==='battle')!;
  await db.update(playerStoryNodesTable).set({stars:3}).where(eq(playerStoryNodesTable.clerkUserId,userId));
  await db.update(playerStoryNodesTable).set({stars:0}).where(and(eq(playerStoryNodesTable.clerkUserId,userId),eq(playerStoryNodesTable.nodeId,masteryBattle.id)));
  const initial = await getAnunakiEvent(userId);
  const yakubReaction = 'reaction:yakub:laugh:v1';
  const anuReaction = 'reaction:anu:respect:v1';
  assert(!ownedReactions().includes(yakubReaction));
  assert(!ownedReactions().includes(anuReaction));
  assert.deepEqual(resolveReactionTray([yakubReaction, anuReaction], []), []);
  assert.throws(() => addReaction(undefined, { id: 'locked', reactionId: yakubReaction, seat: 'player', gameNumber: 1 }, ownedReactions(), 10000));
  await assert.rejects(equipCosmetics(userId, { bannerCardId: 'yakub', stickers: ['yakub:arrival-sticker'] }), /Unlock this sticker pack/);
  assert.equal(initial.milestones.find(m => m.id === 'yakub')?.state, 'ready');
  assert.equal(initial.milestones.find(m => m.id === 'anu')?.state, 'ready');
  assert.equal(initial.milestones.find(m => m.id === 'anu-stickers')?.state, 'locked', 'mastery is independent of chapter completion');
  assert.equal(initial.milestones.find(m => m.id === 'anu-stickers')?.progress, 9);
  await assert.rejects(claimAnunakiEvent(userId, 'anu-stickers'), /Optional mastery/);
  await assert.rejects(equipCosmetics(userId, { playerMatId: 'anunaki-anu' }), /Unlock/);

  const yakub = await Promise.all([claimAnunakiEvent(userId, 'yakub'), claimAnunakiEvent(userId, 'yakub'), claimAnunakiEvent(userId, 'yakub')]);
  assert.equal(yakub.filter(result => result.claimed).length, 1);
  assert.equal(yakub.reduce((sum, result) => sum + result.duplicateShards, 0), 25);
  const preownedMat = await claimAnunakiEvent(userId, 'yakub-mat');
  assert.equal(preownedMat.duplicateShards, 25);
  for (const milestone of ANUNAKI_EVENT_MILESTONES) {
    if (milestone.id === 'yakub' || milestone.id === 'yakub-mat' || milestone.id === 'anu-stickers') continue;
    assert.equal((await claimAnunakiEvent(userId, milestone.id)).claimed, true, milestone.id);
  }
  await assert.rejects(equipCosmetics(userId, { bannerCardId: 'anu', stickers: ['anu:arrival-sticker'] }), /Unlock this sticker pack/);
  await equipCosmetics(userId, { bannerCardId: 'yakub', stickers: ['yakub:arrival-sticker'] });
  const [yakubStyle] = await db.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, userId));
  assert.deepEqual(yakubStyle.settings.cosmetics?.stickers, ['yakub:arrival-sticker']);
  assert(ownedReactions(yakubStyle.unlockedCosmeticIds).includes(yakubReaction));
  assert(!ownedReactions(yakubStyle.unlockedCosmeticIds).includes(anuReaction));
  assert.deepEqual(resolveReactionTray([yakubReaction, anuReaction], yakubStyle.unlockedCosmeticIds), [yakubReaction]);
  assert.equal(addReaction(undefined, { id: 'yakub-unlocked', reactionId: yakubReaction, seat: 'player', gameNumber: 1 }, ownedReactions(yakubStyle.unlockedCosmeticIds), 10000).latest.player?.reactionId, yakubReaction);
  assert.equal((await getAnunakiEvent(userId)).milestones.find(m => m.id === 'anu-stickers')?.state, 'locked', 'claiming Anu does not bypass mastery');
  await db.update(playerStoryNodesTable).set({stars:3}).where(and(eq(playerStoryNodesTable.clerkUserId,userId),eq(playerStoryNodesTable.nodeId,masteryBattle.id)));
  assert.equal((await getAnunakiEvent(userId)).milestones.find(m => m.id === 'anu-stickers')?.state, 'ready');
  assert.equal((await claimAnunakiEvent(userId, 'anu-stickers')).claimed, true);
  await equipCosmetics(userId, { playerMatId: 'anunaki-anu', bannerCardId: 'anu', stickers: ['anu:arrival-sticker'] });
  for (const milestone of ANUNAKI_EVENT_MILESTONES) {
    const retry = await claimAnunakiEvent(userId, milestone.id);
    assert.equal(retry.claimed, false, milestone.id);
    assert.equal(retry.duplicateShards, 0);
  }
  const [profile] = await db.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, userId));
  assert.deepEqual(new Set(profile.ownedCardIds), new Set(['yakub', 'caucus-mountaineer', 'anu']));
  assert.deepEqual(new Set(profile.discoveredCardIds), new Set(['yakub', 'caucus-mountaineer', 'anu']));
  assert.deepEqual(new Set(profile.unlockedCosmeticIds), new Set(ANUNAKI_EVENT_MILESTONES.filter(m=>!['card','currency','tickets'].includes(m.reward.kind)).map(m=>m.reward.id)));
  assert.deepEqual(resolveReactionTray([yakubReaction, anuReaction], profile.unlockedCosmeticIds), [yakubReaction, anuReaction]);
  assert.equal(addReaction(undefined, { id: 'anu-unlocked', reactionId: anuReaction, seat: 'player', gameNumber: 1 }, ownedReactions(profile.unlockedCosmeticIds), 10000).latest.player?.reactionId, anuReaction);
  assert(ownsPlayerMat(profile, 'anunaki-anu'));
  assert.equal(equippedPlayerMat(profile), 'anunaki-anu');
  assert.equal(profile.settings.cosmetics?.bannerCardId, 'anu');
  assert.deepEqual(profile.settings.cosmetics?.stickers, ['anu:arrival-sticker']);
  assert.equal(profile.softCurrency, 40 + ANUNAKI_EVENT_MILESTONES.reduce((sum,m)=>sum+(m.reward.kind==='currency' ? m.reward.amount ?? 0 : 0),0));
  assert.equal(profile.packTickets, 10);
  assert.equal(profile.styleShards, 57);
  assert.equal((await db.select().from(playerCollectionClaimsTable).where(eq(playerCollectionClaimsTable.clerkUserId, userId))).length, ANUNAKI_EVENT_MILESTONES.length);
  assert.ok((await getAnunakiEvent(userId)).milestones.every(m => m.state === 'claimed'));
});

test('legacy Anunaki receipts remain claimed after campaign migration and new Story does not inherit perfect-ticket windfalls',async t=>{
  const userId=`anunaki-legacy-${randomUUID()}`;
  t.after(async()=>{await db.delete(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId,userId));});
  await db.insert(playerProfilesTable).values({clerkUserId:userId,onboardingStep:'complete',ownedCardIds:['yakub'],discoveredCardIds:['yakub'],packTickets:3,softCurrency:12});
  const {anunakiClaimKey}=await import('@workspace/squabblemon-engine/anunakiEvent');
  await db.insert(playerCollectionClaimsTable).values({clerkUserId:userId,milestoneKey:anunakiClaimKey('yakub'),reward:{cardId:'yakub',softCurrency:0,duplicateShards:0}});
  const before=await getAnunakiEvent(userId);
  assert.equal(before.milestones.find(m=>m.id==='yakub')?.state,'claimed');
  assert.equal((await claimAnunakiEvent(userId,'yakub')).claimed,false);
  const {grantStoryTicketAward}=await import('./storyTransactions');
  const chapter=storyContent.chapters.find(c=>c.id===ANUNAKI_STORY_CHAPTERS[0])!;
  const battle=chapter.nodes.find(n=>n.kind==='battle')!;
  const grant=await db.transaction(tx=>grantStoryTicketAward(tx,userId,chapter.id,battle.id,3));
  assert.equal(grant,null);
  const [profile]=await db.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId,userId));
  assert.equal(profile.packTickets,3);assert.equal(profile.softCurrency,12);
  assert.equal(profile.styleShards,0,'the legacy receipt cannot become duplicate shards');
});

test('earned covers equip through the normal cosmetic transaction and survive legacy loadout writes',async t=>{
  const userId=`anunaki-cover-${randomUUID()}`;
  t.after(async()=>{await db.delete(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId,userId));});
  await db.insert(playerProfilesTable).values({clerkUserId:userId,onboardingStep:'complete',ownedCardIds:[],unlockedCosmeticIds:['style:enki:deck-cover'],settings:{reducedMotion:true,turnTimerEnabled:false}});
  await assert.rejects(equipCosmetics(userId,{deckCoverId:'anunaki-raid:cover'}),/Earn this deck cover/);
  await equipCosmetics(userId,{deckCoverId:'style:enki:deck-cover'});
  await equipCosmetics(userId,{});
  let [profile]=await db.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId,userId));
  assert.equal(profile.settings.cosmetics?.deckCoverId,'style:enki:deck-cover');
  assert.equal(profile.settings.reducedMotion,true);
  await equipCosmetics(userId,{deckCoverId:null});
  [profile]=await db.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId,userId));
  assert.equal(profile.settings.cosmetics?.deckCoverId,null);
});
