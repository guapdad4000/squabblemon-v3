import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db, playerProfilesTable, playerStoryNodesTable, playerCollectionClaimsTable } from '@workspace/db';
import { storyContent } from '@workspace/squabblemon-engine/story';
import { STARTER_MYTHIC, starterMythicStatus } from '@workspace/squabblemon-engine/starterMythic';
import { getStarterMythic, claimStarterMythic } from './starterMythic';
import { claimAccountRewards } from './accountRewards';

async function player(t: test.TestContext, owns = false) {
  const userId = `starter-mythic-${randomUUID()}`;
  t.after(async () => { await db.delete(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, userId)); });
  await db.insert(playerProfilesTable).values({ clerkUserId: userId, onboardingStep: 'complete', softCurrency: 40, packTickets: 2, styleShards: 7, ownedCardIds: owns ? ['homeless-guy'] : [], discoveredCardIds: [], storyChapter: 99 });
  return userId;
}
async function reachChapterFive(userId: string) {
  const chapters = storyContent.chapters.slice(0, 4);
  await db.insert(playerStoryNodesTable).values(chapters.flatMap(chapter => chapter.nodes.filter(node => !node.optional).map(node => ({ clerkUserId: userId, chapterId: chapter.id, nodeId: node.id, cleared: true }))));
}
async function profile(userId: string) { return (await db.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, userId)))[0]; }

test('numeric chapter counters and unrelated specials cannot unlock the Mythical', async t => {
  const user = await player(t);
  assert.equal((await getStarterMythic(user)).state, 'locked');
  await assert.rejects(() => claimStarterMythic(user), /Reach Season 1, Chapter 5/);
  assert.equal((await profile(user)).softCurrency, 40);
  assert.equal((await db.select().from(playerCollectionClaimsTable).where(eq(playerCollectionClaimsTable.clerkUserId, user))).length, 0);
  assert.equal(starterMythicStatus([{ id: 'alice-full-stop', status: 'cleared' }], false, false).state, 'locked');
});
test('finishing Chapter 4 unlocks the reward without Chapter 5 clears, optional nodes or login claims', async t => {
  const user = await player(t);
  await reachChapterFive(user);
  const status = await getStarterMythic(user);
  assert.equal(status.state, 'ready');
  assert.equal(status.chapters[4].completed, false);
  assert.equal(status.chapters.filter(c => c.reached).length, 5);
  const claims = await Promise.all([claimStarterMythic(user), claimStarterMythic(user), claimStarterMythic(user)]);
  assert.equal(claims.filter(c => c.claimed).length, 1);
  const saved = await profile(user);
  assert.equal(saved.softCurrency, 1040);
  assert.equal(saved.packTickets, 5);
  assert.equal(saved.styleShards, 7);
  assert.deepEqual(saved.ownedCardIds, ['homeless-guy']);
  assert.deepEqual(saved.discoveredCardIds, ['homeless-guy']);
  assert.equal(saved.collectionProgress, 1);
  assert.equal((await getStarterMythic(user)).state, 'claimed');
  assert.equal((await claimStarterMythic(user)).claimed, false);
});
test('existing owners keep one card and receive 25 shards plus all currency rewards', async t => {
  const user = await player(t, true);
  await reachChapterFive(user);
  assert.equal((await getStarterMythic(user)).ownsCard, true);
  assert.equal((await claimStarterMythic(user)).duplicateShards, STARTER_MYTHIC.duplicateShards);
  const saved = await profile(user);
  assert.deepEqual(saved.ownedCardIds, ['homeless-guy']);
  assert.equal(saved.styleShards, 32);
  assert.equal(saved.softCurrency, 1040);
  assert.equal(saved.packTickets, 5);
});
test('login and milestone claims remain independent and preserve concurrent balances', async t => {
  const user = await player(t);
  await reachChapterFive(user);
  const [login] = await Promise.all([claimAccountRewards(user), claimStarterMythic(user)]);
  const saved = await profile(user);
  assert.equal(saved.softCurrency, 1040 + login.reduce((n, r) => n + r.softCurrency, 0));
  assert.equal(saved.packTickets, 5 + login.reduce((n, r) => n + r.packTickets, 0));
  assert.equal((await getStarterMythic(user)).state, 'claimed');
});

test('HTTP endpoints authenticate, use saved eligibility, ignore forged rewards, and return the persisted claim', async t => {
  const { default: express } = await import('express');
  const { default: router } = await import('../routes/starterMythic');
  const user = await player(t);
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
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/player/rewards/starter-mythic`;
  assert.equal((await fetch(origin)).status, 401);
  assert.equal((await fetch(`${origin}/claim`, { method: 'POST' })).status, 401);
  const post = () => fetch(`${origin}/claim`, { method: 'POST', headers: { 'x-test-user': user, 'Content-Type': 'application/json' }, body: JSON.stringify({ state: 'ready', softCurrency: 999999, userId: 'someone-else' }) });
  assert.equal((await post()).status, 409);
  await reachChapterFive(user);
  const response = await post();
  assert.equal(response.status, 200);
  const result = await response.json() as any;
  assert.equal(result.claimed, true);
  assert.equal(result.status.state, 'claimed');
  assert.equal(result.bootstrap.profile.softCurrency, 1040);
  assert.equal((await (await post()).json() as any).claimed, false);
  assert.equal((await profile(user)).softCurrency, 1040);
});
