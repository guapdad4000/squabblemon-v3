import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { and, count, eq } from 'drizzle-orm';
import { db, playerProfilesTable, playerStoryNodesTable, playerStoryRewardClaimsTable } from '@workspace/db';
import { catalogCardByEngineId } from '@workspace/squabblemon-engine/data';
import { STORY_DUPLICATE_STYLE_SHARDS } from '@workspace/squabblemon-engine/economy';
import { storyContent } from '@workspace/squabblemon-engine/story';
import { completeNonBattleStoryNode, completeStoryPuzzle } from './storyTransactions';
import { getPlayerStoryCampaign, StoryRequestError } from './storyService';

const chapters = storyContent.chapters.filter(chapter => chapter.id.startsWith('squabble-house-'));
const failure = (status: number, message: RegExp) => (error: unknown) => error instanceof StoryRequestError && error.status === status && message.test(error.message);

async function player(t: test.TestContext, chapterIndex: number) {
  const userId = `house-audit-${randomUUID()}`;
  await db.insert(playerProfilesTable).values({ clerkUserId: userId, onboardingStep: 'complete', ownedCardIds: [], discoveredCardIds: [], styleShards: 0 });
  t.after(async () => { await db.delete(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, userId)); });
  const prior = chapters.slice(0, chapterIndex).flatMap(chapter => chapter.nodes.map(node => ({ clerkUserId: userId, chapterId: chapter.id, nodeId: node.id, cleared: true })));
  if (prior.length) await db.insert(playerStoryNodesTable).values(prior);
  return userId;
}
async function profile(userId: string) { return (await db.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, userId)))[0]; }

for (const [index, chapter] of chapters.entries()) {
  for (const skip of [false, true]) test(`${chapter.id}: ${skip ? 'skip' : 'solve'} authority and victory-gated rewards persist once`, async t => {
    const userId = await player(t, index);
    const opening = chapter.nodes.find(node => node.id.endsWith('-opening'))!;
    const puzzle = chapter.nodes.find(node => node.puzzle)!;
    const battle = chapter.nodes.find(node => node.kind === 'battle')!;
    const closing = chapter.nodes.find(node => node.kind === 'reward')!;
    await assert.rejects(completeStoryPuzzle(userId, puzzle.id, randomUUID(), [...puzzle.puzzle!.solution], false), failure(409, /locked/i));
    await assert.rejects(completeNonBattleStoryNode(userId, closing.id, randomUUID(), []), failure(409, /locked/i));
    await completeNonBattleStoryNode(userId, opening.id, randomUUID(), []);
    await assert.rejects(completeStoryPuzzle(userId, puzzle.id, randomUUID(), [...puzzle.puzzle!.solution].reverse(), false), failure(400, /incorrect/i));
    await assert.rejects(completeNonBattleStoryNode(userId, puzzle.id, randomUUID(), []), failure(400, /puzzle endpoint/i));
    const before = await profile(userId);
    const key = randomUUID();
    const solved = await completeStoryPuzzle(userId, puzzle.id, key, skip ? undefined : [...puzzle.puzzle!.solution], skip);
    assert.equal(solved.resolution, skip ? 'skipped' : 'solved');
    assert.deepEqual(solved.rewards.map(reward => reward.id), puzzle.rewards.map(reward => reward.id));
    assert(solved.rewards.every(reward => reward.kind !== 'card'), 'Puzzle payout never grants a House card');
    assert.deepEqual((await profile(userId)).ownedCardIds, before.ownedCardIds);
    const afterPuzzle = await profile(userId);
    assert.equal(afterPuzzle.xp, before.xp);
    assert.equal(afterPuzzle.softCurrency - before.softCurrency, puzzle.rewards.filter(reward => reward.kind === 'currency' && reward.id === 'clout').reduce((sum, reward) => sum + reward.amount, 0));
    assert.equal(afterPuzzle.packTickets - before.packTickets, puzzle.rewards.filter(reward => reward.kind === 'pack-ticket').reduce((sum, reward) => sum + reward.amount, 0));
    const retry = await completeStoryPuzzle(userId, puzzle.id, key, skip ? undefined : [...puzzle.puzzle!.solution], skip);
    assert.equal(retry.alreadyCompleted, true);
    const campaign = await getPlayerStoryCampaign(userId);
    assert.equal(campaign.nodes.find(node => node.nodeId === battle.id)?.status, 'available');
    assert.equal(campaign.nodes.find(node => node.nodeId === closing.id)?.status, 'locked');
    await assert.rejects(completeNonBattleStoryNode(userId, battle.id, randomUUID(), []), failure(400, /completed by a fade/i));
    await assert.rejects(completeNonBattleStoryNode(userId, closing.id, randomUUID(), []), failure(409, /locked/i));

    // This is a persisted verified-victory fixture, not a client completion bypass.
    // Combat transcript verification is covered by the content/engine suite.
    await db.insert(playerStoryNodesTable).values({ clerkUserId: userId, chapterId: chapter.id, nodeId: battle.id, cleared: true, wins: 1, attempts: 1, lastOutcome: 'win' });
    const awardKey = randomUUID();
    const first = await completeNonBattleStoryNode(userId, closing.id, awardKey, []);
    assert.deepEqual(first.rewards.map(reward => reward.id), closing.rewards.map(reward => reward.id));
    const awarded = await profile(userId);
    for (const reward of closing.rewards.filter(reward => reward.kind === 'card')) {
      const catalogId = catalogCardByEngineId[reward.id].catalogId;
      assert.equal(awarded.ownedCardIds.filter(id => id === catalogId).length, 1);
      assert.ok(awarded.discoveredCardIds.includes(catalogId));
    }
    const replay = await completeNonBattleStoryNode(userId, closing.id, awardKey, []);
    assert.equal(replay.alreadyCompleted, true);
    assert.deepEqual(replay.rewards, [], 'Reopening a completed closing scene never grants its rewards again');
    assert.deepEqual((await completeNonBattleStoryNode(userId, closing.id, randomUUID(), [])).rewards, []);
    const stable = await profile(userId);
    assert.deepEqual(stable.ownedCardIds, awarded.ownedCardIds);
    assert.equal(stable.packTickets, awarded.packTickets);
    assert.equal(stable.softCurrency, awarded.softCurrency);
    assert.equal(stable.styleShards, awarded.styleShards);
    const [claims] = await db.select({ value: count() }).from(playerStoryRewardClaimsTable).where(and(eq(playerStoryRewardClaimsTable.clerkUserId, userId), eq(playerStoryRewardClaimsTable.nodeId, closing.id)));
    assert.equal(claims.value, closing.rewards.length);
    if (index + 1 < chapters.length) assert.equal((await getPlayerStoryCampaign(userId)).chapters.find(item => item.id === chapters[index + 1].id)?.status, 'available');
  });
}

test('an already-owned House card converts to shards once and keeps a single collection entry', async t => {
  const userId = await player(t, 0), chapter = chapters[0];
  const closing = chapter.nodes.find(node => node.kind === 'reward')!;
  const reward = closing.rewards.find(item => item.kind === 'card')!;
  const catalogId = catalogCardByEngineId[reward.id].catalogId;
  await db.update(playerProfilesTable).set({ ownedCardIds: [catalogId], discoveredCardIds: [catalogId], styleShards: 0 }).where(eq(playerProfilesTable.clerkUserId, userId));
  await db.insert(playerStoryNodesTable).values(chapter.nodes.filter(node => node.id !== closing.id).map(node => ({ clerkUserId: userId, chapterId: chapter.id, nodeId: node.id, cleared: true })));
  const first = await completeNonBattleStoryNode(userId, closing.id, randomUUID(), []);
  assert.equal(first.rewards[0].duplicateShards, STORY_DUPLICATE_STYLE_SHARDS);
  await completeNonBattleStoryNode(userId, closing.id, randomUUID(), []);
  const after = await profile(userId);
  assert.deepEqual(after.ownedCardIds, [catalogId]);
  assert.equal(after.styleShards, STORY_DUPLICATE_STYLE_SHARDS);
});
