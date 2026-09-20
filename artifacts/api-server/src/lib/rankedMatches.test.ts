import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { cardCatalog, ROOKIE_CORE_IDS } from '@workspace/squabblemon-engine/data';
import { awardRank, rankedStats, type OnlineRoom, type OnlineRoomView } from '@workspace/squabblemon-engine/multiplayer';

test('ranked points use reduced bot rewards, floor at zero and preserve records', () => {
  const fresh = rankedStats(null);
  assert.equal(awardRank(fresh, 'win', 1000, false).result.delta, 25);
  assert.equal(awardRank(fresh, 'win', 1000, true).result.delta, 12);
  assert.equal(awardRank(fresh, 'loss', 1000, false).result.delta, 0);
  assert.equal(awardRank({ ...fresh, points: 95 }, 'win', 1000, true).result.tier, 'Bronze');
  assert.equal(awardRank(fresh, 'draw', 1000, true).stats.draws, 1);
});

test('ranked routes: human pairing, retries, cancellation race, bot completion, reconnect and exactly-once ranks', { skip: !process.env.DATABASE_URL }, async t => {
  const { default: express } = await import('express');
  const { db, pool, playerProfilesTable: profiles, onlineRoomsTable: rooms } = await import('@workspace/db');
  const { and, eq, inArray } = await import('drizzle-orm');
  const { default: router } = await import('../routes/multiplayer');
  const users = Array.from({ length: 8 }, () => `park-test-${randomUUID()}`);
  await db.insert(profiles).values(users.map((id, index) => ({ clerkUserId: id, displayName: `Park tester ${index}`,
    onboardingStep: index === 7 ? 'welcome' : 'complete', ownedCardIds: cardCatalog.map(c => c.catalogId),
    storyProgress: { treasuredStoryProgress: { cleared: true } },
    savedDecks: [{ id: 'custom', name: 'Rookie gang', heroCardId: 'hooper', cardIds: [...ROOKIE_CORE_IDS] }],
  })));
  const app = express(); app.use(express.json());
  app.use((req, _res, next) => {
    const userId = req.header('x-test-user') || null;
    (req as unknown as { auth: unknown }).auth = Object.assign(() => ({ userId, sessionId: userId ? 'test' : null, tokenType: 'session_token', isAuthenticated: !!userId }), { [Symbol.for('@clerk/express.auth')]: true });
    next();
  });
  app.use('/api', router);
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/multiplayer`;
  t.after(async () => { await new Promise<void>(resolve => server.close(() => resolve())); await db.delete(profiles).where(inArray(profiles.clerkUserId, users)); await pool.end(); });
  const request = async (user: string, path: string, body?: unknown) => {
    const r = await fetch(origin + path, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', 'x-test-user': user }, body: body ? JSON.stringify(body) : undefined });
    assert.match(r.headers.get('cache-control') ?? '', /no-store/);
    return { status: r.status, body: await r.json() as any };
  };
  const ok = async (user: string, path: string, body?: unknown) => { const r = await request(user, path, body); assert.equal(r.status, 200, JSON.stringify(r.body)); return r.body; };
  const search = (user: string, id = randomUUID()) => ok(user, '/ranked/search', { deckId: 'custom', requestId: id });
  const action = (user: string, view: OnlineRoomView, command: object, id = randomUUID()) => ok(user, `/${view.code}/actions`, { expectedRevision: view.revision, requestId: id, command });
  const state = async (code: string) => (await db.select().from(rooms).where(eq(rooms.code, code)))[0];
  const changeState = async (code: string, update: (room: OnlineRoom) => OnlineRoom) => {
    const row = await state(code); const room = update(row.state as unknown as OnlineRoom);
    await db.update(rooms).set({ state: room as unknown as Record<string, unknown> }).where(eq(rooms.id, row.id));
  };
  assert.equal((await request('', '/ranked')).status, 401);
  assert.equal((await request(users[7], '/ranked')).status, 403);
  assert.equal((await request(users[0], '/ranked/search', { deckId: 'bad', requestId: randomUUID() })).status, 400);
  assert.equal((await request(users[0], '/ranked/search', { deckId: 'custom', requestId: randomUUID(), points: 5000 })).status, 400);

  const requestIds = [randomUUID(), randomUUID()];
  await Promise.all([search(users[0], requestIds[0]), search(users[1], requestIds[1])]);
  const a = (await ok(users[0], '/ranked')).room as OnlineRoomView;
  const b = (await ok(users[1], '/ranked')).room as OnlineRoomView;
  assert.equal(a.code, b.code); assert.equal(a.status, 'active'); assert.notEqual(a.seat, b.seat);
  assert.equal(a.ranked?.opponent, 'player'); assert.notDeepEqual(a.hand, b.hand);
  assert.equal((await search(users[0], requestIds[0])).room.code, a.code);
  assert.equal((await search(users[1], requestIds[1])).room.code, a.code);
  assert.equal((await search(users[0])).room.code, a.code, 'only one active ranked match per account');
  assert.equal((await request(users[2], `/${a.code}`)).status, 404);
  assert.equal((await request(users[2], `/${a.code}/join`, { deckId: 'custom' })).status, 403);
  assert(!JSON.stringify(a).includes('cpuHand')); assert(!JSON.stringify(a).includes(users[1]));
  const surrenderId = randomUUID();
  const loss = await action(users[0], a, { type: 'surrender' }, surrenderId);
  assert.equal(loss.ranked.result.outcome, 'loss'); assert.equal(loss.ranked.result.after, 0);
  const win = await ok(users[1], `/${a.code}`); assert.equal(win.ranked.result.delta, 25);
  await action(users[0], a, { type: 'surrender' }, surrenderId);
  assert.equal((await search(users[1], requestIds[1])).room.status, 'complete', 'lost search acknowledgement cannot create a second match');
  const rank = await ok(users[1], '/ranked'); assert.equal(rank.stats.games, 1); assert.equal(rank.stats.points, 25);
  assert.equal((await request(users[1], `/${a.code}/actions`, { expectedRevision: win.revision, requestId: randomUUID(), command: { type: 'rematch' } })).status, 409);
  const preserved = (await db.select().from(profiles).where(eq(profiles.clerkUserId, users[1])))[0];
  assert.deepEqual(preserved.storyProgress.treasuredStoryProgress, { cleared: true });
  assert.deepEqual(preserved.savedDecks[0].cardIds, [...ROOKIE_CORE_IDS]);
  assert.equal(preserved.ownedCardIds.length, cardCatalog.length);

  const waiting = (await search(users[2])).room;
  assert.equal(waiting.status, 'waiting');
  const cancelled = await ok(users[2], '/ranked/cancel', { code: waiting.code }); assert.equal(cancelled.status, 'closed');
  assert.equal((await ok(users[2], '/ranked')).room, null);
  const queued = (await search(users[2])).room;
  await search(users[3]);
  const afterPair = await ok(users[2], '/ranked/cancel', { code: queued.code });
  assert.equal(afterPair.status, 'active', 'a match won the cancellation race; show the match');
  await action(users[2], afterPair, { type: 'surrender' });

  const stale = (await search(users[4])).room;
  await changeState(stale.code, r => ({ ...r, ranked: { ...r.ranked!, heartbeatAt: Date.now() - 31000, botAfter: Date.now() - 1000 } }));
  assert.equal((await ok(users[4], '/ranked')).room, null, 'offline queues do not produce phantom matches');
  const botQueue = (await search(users[4])).room;
  await changeState(botQueue.code, r => ({ ...r, ranked: { ...r.ranked!, botAfter: Date.now() - 1 } }));
  let botView = (await ok(users[4], '/ranked')).room as OnlineRoomView;
  assert.equal(botView.status, 'active'); assert.equal(botView.ranked?.opponent, 'bot');
  assert.equal((await state(botView.code)).guestUserId, null, 'synthetic bots never become real accounts');
  assert.equal((await search(users[4])).room.code, botView.code);
  for (let step = 0; step < 160 && botView.status === 'active'; step++) {
    if (botView.activeSeat !== botView.seat) {
      await changeState(botView.code, r => ({ ...r, ranked: { ...r.ranked!, botNextAt: Date.now() - 1 } }));
      botView = await ok(users[4], `/${botView.code}`);
    } else {
      const playable = [...botView.hand].sort((a, b) => b.power - a.power).flatMap(card => ([0, 1, 2] as const)
        .filter(lane => !botView.lockedLanes?.includes(lane) && card.costs[lane] <= botView.motion[botView.seat]).map(lane => ({ card, lane })))[0];
      botView = await action(users[4], botView, playable ? { type: 'play', instanceId: playable.card.instanceId, lane: playable.lane, squabble: botView.round >= 4 && !botView.squabble[botView.seat] } : { type: 'end-turn' });
    }
  }
  assert.equal(botView.status, 'complete'); assert.equal(botView.round, 6);
  assert.equal(botView.ranked?.result?.bot, true);
  const earned = (await ok(users[4], '/ranked')).stats;
  await Promise.all([ok(users[4], `/${botView.code}`), ok(users[4], `/${botView.code}`)]);
  assert.deepEqual((await ok(users[4], '/ranked')).stats, earned);
  assert.equal(earned.games, 1);

  // A sleeping server catches up the bot turn, rather than granting a timeout win.
  const asleep = (await search(users[5])).room;
  await changeState(asleep.code, r => ({ ...r, openingSeat: 'cpu', ranked: { ...r.ranked!, botAfter: Date.now() - 1 } }));
  let resumed = (await ok(users[5], '/ranked')).room;
  await changeState(resumed.code, r => ({ ...r, deadline: Date.now() - 1000, ranked: { ...r.ranked!, botNextAt: Date.now() - 2000 } }));
  resumed = await ok(users[5], `/${resumed.code}`);
  assert.equal(resumed.status, 'active'); assert.equal(resumed.activeSeat, 'player'); assert(resumed.deadline > Date.now());
  await changeState(resumed.code, r => ({ ...r, deadline: Date.now() - 1 }));
  resumed = await ok(users[5], `/${resumed.code}`);
  assert.equal(resumed.reason, 'timeout'); assert.equal(resumed.ranked.result.outcome, 'loss');
  assert.equal((await ok(users[5], '/ranked')).stats.games, 1);
  if (process.env.FADE_PARK_BROWSER === '1') {
    const { verifyRankedBrowser } = await import(new URL('../../../squabblemon/e2e/verify-ranked-flow.ts', import.meta.url).href);
    const accounts = await Promise.all(users.slice(0, 2).map(async userId => ({ userId,
      bootstrap: { profile: { ...(await db.select().from(profiles).where(eq(profiles.clerkUserId, userId)))[0], id: userId } },
    })));
    await verifyRankedBrowser({ origin, accounts, forceBot: (code: string) => changeState(code, r => ({ ...r, ranked: { ...r.ranked!, botAfter: Date.now() - 1 } })) });
  }

});
