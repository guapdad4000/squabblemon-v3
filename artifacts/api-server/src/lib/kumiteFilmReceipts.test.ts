import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';

test('Kumite films use earned, account-bound, once-only receipts and reconcile P. Tang', { skip: !process.env.DATABASE_URL }, async t => {
  const { default: express } = await import('express');
  const { db, pool, playerProfilesTable, playerCollectionClaimsTable } = await import('@workspace/db');
  const { eq, inArray } = await import('drizzle-orm');
  const { default: router } = await import('../routes/kumite');
  const users = [`film-owner-${randomUUID()}`, `film-other-${randomUUID()}`];
  await db.insert(playerProfilesTable).values(users.map(clerkUserId => ({ clerkUserId, displayName: 'Film test',
    ownedCardIds: ['undercova-brotha'], cardProgression: { 'undercova-brotha': { xp: 123, level: 6 } } })));
  await db.insert(playerCollectionClaimsTable).values(Array.from({ length: 4 }, (_, i) => ({
    clerkUserId: users[0], milestoneKey: `kumite:win:film-test-${i}:v1`,
    reward: { kumite: { tournamentId: 'fixture', matchId: `m${i}`, event: 'win' as const, at: Date.now() } },
  })));
  const app = express(); app.use(express.json());
  app.use((req, _res, next) => {
    const userId = req.header('x-test-user') || null;
    (req as unknown as { auth: unknown }).auth = Object.assign(() => ({ userId, sessionId: userId ? 'test' : null,
      tokenType: 'session_token', isAuthenticated: !!userId }), { [Symbol.for('@clerk/express.auth')]: true }); next();
  });
  app.use('/api', router);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/kumite/film-receipts`;
  t.after(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
    await db.delete(playerProfilesTable).where(inArray(playerProfilesTable.clerkUserId, users)); await pool.end();
  });
  async function request(user: string, body?: unknown) {
    const response = await fetch(base + (body ? '/claim' : ''), { method: body ? 'POST' : 'GET',
      headers: { 'content-type': 'application/json', 'x-test-user': user }, body: body ? JSON.stringify(body) : undefined });
    assert.match(response.headers.get('cache-control') ?? '', /no-store/);
    return { status: response.status, body: await response.json() as { receipts?: { id: string; cardId: string }[]; receipt?: { id: string; cardId: string } | null } };
  }
  assert.equal((await request('')).status, 401);
  assert.equal((await request('', { receiptId: 'kumite:card:p-tang:v1' })).status, 401);
  assert.equal((await request(users[0], { receiptId: 'fabricated' })).status, 400);
  const first = await request(users[0]); assert.equal(first.status, 200);
  const tang = first.body.receipts!.find(row => row.cardId === 'p-tang'); assert(tang, 'four existing wins reconcile the real P. Tang card');
  const [earned] = await db.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, users[0]));
  assert.equal(earned.ownedCardIds.filter(id => id === 'p-tang').length, 1);
  assert.deepEqual(earned.cardProgression['undercova-brotha'], { xp: 123, level: 6 });
  assert.equal((await request(users[1], { receiptId: tang.id })).body.receipt, null, 'another account cannot consume an earned receipt');
  const attempts = await Promise.all(Array.from({ length: 8 }, () => request(users[0], { receiptId: tang.id })));
  assert.equal(attempts.filter(result => result.body.receipt?.id === tang.id).length, 1, 'only one tab wins the presentation claim');
  assert.equal((await request(users[0], { receiptId: tang.id })).body.receipt, null, 'reload cannot repeat auto presentation');
  assert(!(await request(users[0])).body.receipts!.some(row => row.id === tang.id));
  const [after] = await db.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, users[0]));
  assert.deepEqual(after.ownedCardIds, earned.ownedCardIds, 'skip/failure acknowledgement never changes ownership');
  const receipts = await db.select().from(playerCollectionClaimsTable).where(eq(playerCollectionClaimsTable.clerkUserId, users[0]));
  assert.equal(receipts.filter(row => row.milestoneKey === tang.id).length, 1, 'award remains idempotent');
  assert.equal(receipts.filter(row => row.reward.kumitePresentation?.receiptId === tang.id).length, 1);
  // Legacy grants and already-owned fighters must not create a mass replay after deployment.
  await db.insert(playerCollectionClaimsTable).values({ clerkUserId: users[1], milestoneKey: 'kumite:card:undercova-brotha:v1', reward: { cardId: 'undercova-brotha' } });
  assert.deepEqual((await request(users[1])).body.receipts, []);
  assert.equal((await request(users[1], { receiptId: 'kumite:card:undercova-brotha:v1' })).body.receipt, null);
});
