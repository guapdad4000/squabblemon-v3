import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db, playerProfilesTable, playerStoryNodesTable, playerCollectionClaimsTable } from '@workspace/db';
import { ANUNAKI_EVENT_GAMEPLAY_READY, ANUNAKI_STORY_CHAPTERS } from '@workspace/squabblemon-engine/anunakiEvent';
import { storyContent } from '@workspace/squabblemon-engine/story';
import { claimAnunakiEvent, getAnunakiEvent } from './anunakiEvent';

async function player(t: test.TestContext) {
  const userId = `anunaki-event-${randomUUID()}`;
  t.after(async () => { await db.delete(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, userId)); });
  await db.insert(playerProfilesTable).values({ clerkUserId: userId, onboardingStep: 'complete', softCurrency: 40, styleShards: 7, ownedCardIds: [], discoveredCardIds: [] });
  return userId;
}
test('server counts real battle clears and complete required chapter nodes while the gate is disabled', async t => {
  const userId = await player(t);
  const chapter1 = storyContent.chapters.find(chapter => chapter.id === ANUNAKI_STORY_CHAPTERS[0])!;
  const chapter2 = storyContent.chapters.find(chapter => chapter.id === ANUNAKI_STORY_CHAPTERS[1])!;
  const required1 = chapter1.nodes.filter(node => !node.optional);
  const required2 = chapter2.nodes.filter(node => !node.optional);
  const closing1 = required1.at(-1)!;
  const closing2 = required2.at(-1)!;
  assert.ok(closing1 && closing2, 'required non-battle nodes must participate in chapter completion');
  const insert = async (chapterId: string, ids: readonly string[]) => db.insert(playerStoryNodesTable).values(ids.map(nodeId => ({ clerkUserId: userId, chapterId, nodeId, cleared: true })));
  const step = async (id: string) => (await getAnunakiEvent(userId)).milestones.find(m => m.id === id)!;
  await insert(chapter1.id, required1.filter(node => node.id !== closing1.id).map(node => node.id));
  assert.equal((await step('yakub-mat')).progress, 0, 'all battles alone do not finish a chapter');
  assert.equal((await step('yakub')).progress, 0);
  await insert(chapter1.id, [closing1.id]);
  assert.equal((await step('yakub-mat')).progress, 1);
  assert.equal((await step('yakub')).progress, 1);
  await insert(chapter2.id, required2.filter(node => node.id !== closing2.id).map(node => node.id));
  assert.equal((await step('yakub')).progress, 1, 'the required closing scene still matters');
  await insert(chapter2.id, [closing2.id]);
  const status = await getAnunakiEvent(userId);
  assert.equal(status.available, ANUNAKI_EVENT_GAMEPLAY_READY);
  assert.equal(status.milestones.find(m => m.id === 'yakub')?.progress, 2);
  assert.equal(status.milestones.find(m => m.id === 'yakub')?.state, ANUNAKI_EVENT_GAMEPLAY_READY ? 'ready' : 'locked');
  if (!ANUNAKI_EVENT_GAMEPLAY_READY) assert.ok(status.milestones.every(m => m.state === 'locked'));
  if (!ANUNAKI_EVENT_GAMEPLAY_READY) await assert.rejects(claimAnunakiEvent(userId, 'anu'), /still being prepared/);
  await assert.rejects(claimAnunakiEvent(userId, 'forged'), /Unknown Anunaki reward/);
  const [profile] = await db.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, userId));
  assert.deepEqual(profile.ownedCardIds, []);
  assert.equal(profile.styleShards, 7);
  assert.equal((await db.select().from(playerCollectionClaimsTable).where(eq(playerCollectionClaimsTable.clerkUserId, userId))).length, 0);
});
test('routes require authentication and reject forged body rewards', async t => {
  const { default: express } = await import('express');
  const { default: router } = await import('../routes/anunakiEvent');
  const userId = await player(t);
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const userId = req.header('x-test-user') ?? null;
    (req as any).auth = Object.assign(() => ({ userId, sessionId: 'test', tokenType: 'session_token', isAuthenticated: !!userId }), { [Symbol.for('@clerk/express.auth')]: true });
    next();
  });
  app.use('/api', router);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  t.after(() => new Promise<void>(resolve => server.close(() => resolve())));
  const base = `http://127.0.0.1:${(server.address() as {port: number}).port}/api/player/rewards/anunaki-event`;
  assert.equal((await fetch(base)).status, 401);
  assert.equal((await fetch(`${base}/claim`, { method: 'POST' })).status, 401);
  const response = await fetch(`${base}/claim`, { method: 'POST', headers: { 'x-test-user': userId, 'content-type': 'application/json' }, body: JSON.stringify({ milestoneId: 'anu', cardId: 'anu', progress: 999 }) });
  assert.equal(response.status, 409);
  assert.equal((await db.select().from(playerCollectionClaimsTable).where(eq(playerCollectionClaimsTable.clerkUserId, userId))).length, 0);
});
