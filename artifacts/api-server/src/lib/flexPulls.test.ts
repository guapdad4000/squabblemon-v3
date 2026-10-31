import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { eq } from 'drizzle-orm';
import { db, pool, playerProfilesTable, playerPackOpeningsTable, playerCollectionClaimsTable } from '@workspace/db';
import { affordableStreetPacks, streetPackCost, pullSeasonCalendar, type PullCount } from '@workspace/squabblemon-engine/packRules';
import { openStreetPackForPlayer } from './collectionTransactions';
import { getPullSeasonProgress } from './pullSeason';
import { serializePackOpening } from './playerState';
import { createApp } from '../app';
import type { OpenPackResult } from '../../../../lib/api-zod/src/generated/types/openPackResult';

test('affordable batches preserve the ten-pack discount and reject unsafe counts before spending', async t => {
  assert.equal(affordableStreetPacks(1799, 'softCurrency'), 8);
  assert.equal(affordableStreetPacks(1800, 'softCurrency'), 10);
  assert.equal(affordableStreetPacks(7, 'ticket'), 7);
  const id = `flex-cost-${randomUUID()}`;
  await db.insert(playerProfilesTable).values({ clerkUserId: id, onboardingStep: 'complete', packTickets: 100, softCurrency: 10000 });
  t.after(() => db.delete(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, id)));
  for (const pullCount of [0, 2.5, 11]) await assert.rejects(openStreetPackForPlayer(id, { idempotencyKey: randomUUID(), paymentMethod: 'ticket', pullCount }), /Pull count/);
  assert.equal((await db.select().from(playerPackOpeningsTable).where(eq(playerPackOpeningsTable.clerkUserId, id))).length, 0);
  for (const pullCount of [1,2,3,4,5,6,7,8,9,10] as PullCount[]) {
    const result = await openStreetPackForPlayer(id, { idempotencyKey: randomUUID(), paymentMethod: 'ticket', pullCount });
    assert.equal(result.opening.cost, pullCount);
    assert.equal(result.opening.rewards.length, pullCount * 6);
    assert.equal(serializePackOpening(result.opening).pullCount, pullCount);
    assert.equal(streetPackCost(pullCount).softCurrencyCost, pullCount === 10 ? 1800 : pullCount * 200);
  }
});

test('concurrent partial openings cannot overspend the same wallet', async t => {
  const id = `flex-race-${randomUUID()}`;
  await db.insert(playerProfilesTable).values({ clerkUserId: id, packTickets: 3 });
  t.after(() => db.delete(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, id)));
  const outcomes = await Promise.allSettled([1,2].map(() => openStreetPackForPlayer(id, { idempotencyKey: randomUUID(), paymentMethod: 'ticket', pullCount: 3 })));
  assert.equal(outcomes.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal((await db.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, id)))[0].packTickets, 0);
});

test('monthly milestones count all normal packs and grant each varied bonus once, including retry across month rollover', async t => {
  let now = Date.parse('2026-10-31T23:58:00Z'); t.mock.method(Date, 'now', () => now);
  const id = `flex-season-${randomUUID()}`;
  await db.insert(playerProfilesTable).values({ clerkUserId: id, packTickets: 50 });
  t.after(() => db.delete(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, id)));
  await db.insert(playerPackOpeningsTable).values([{ clerkUserId:id, idempotencyKey:'fixed-welcome', oddsVersion:'welcome-pull-v1', paymentMethod:'ticket', cost:0, rewards:[], pityBefore:0, pityAfter:0, createdAt:new Date(now) }, { clerkUserId:id, idempotencyKey:'prior-month', oddsVersion:'street-pack-ten-v3', paymentMethod:'ticket', cost:10, rewards:[], pityBefore:0, pityAfter:0, createdAt:new Date('2026-09-30T23:59:59Z') }]);
  const receipts = []; let totalCurrency=0, totalShards=0;
  for (const pullCount of [5,5,10,10] as const) {
    const request = { idempotencyKey:randomUUID(), paymentMethod:'ticket' as const, pullCount };
    const result=await openStreetPackForPlayer(id,request); receipts.push({request,result});
    totalCurrency += result.opening.rewards.filter(r=>r.kind==='softCurrency').reduce((sum,r)=>sum+r.amount,0);
    totalShards += result.opening.rewards.filter(r=>r.kind==='styleShards'&&!r.shardRarity).reduce((sum,r)=>sum+r.amount,0);
    assert.equal(result.seasonRewards.length,1);
  }
  const progress=await getPullSeasonProgress(id,now);
  assert.equal(progress.count,30); assert.ok(progress.milestones.every(m=>m.claimed));
  const [profile]=await db.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId,id));
  assert.equal(profile.packTickets,23); assert.equal(profile.softCurrency,totalCurrency+100); assert.equal(profile.styleShards,totalShards+15);
  assert.equal((await db.select().from(playerCollectionClaimsTable).where(eq(playerCollectionClaimsTable.clerkUserId,id))).length,4);
  now=Date.parse('2026-11-01T00:00:00Z');
  const retry=await openStreetPackForPlayer(id,receipts[0].request);
  assert.equal(retry.alreadyOpened,true); assert.deepEqual(retry.seasonRewards,receipts[0].result.seasonRewards); assert.equal(retry.pullSeason.count,0); assert.equal(retry.pullSeason.id,'2026-11');
  assert.deepEqual((await db.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId,id)))[0],profile);
  assert.equal(pullSeasonCalendar(Date.parse('2028-02-29T12:00:00Z')).endsAt,'2028-03-01T00:00:00.000Z');
});

test('HTTP batch payload, original retry and seasonal bonus metadata remain exact', async t => {
  const id=`flex-http-${randomUUID()}`; await db.insert(playerProfilesTable).values({ clerkUserId:id,onboardingStep:'complete',packTickets:5 });
  const server=createApp((req,_res,next)=>{ Object.assign(req,{auth:Object.assign(()=>({userId:id,sessionId:'test',tokenType:'session_token',isAuthenticated:true}),{[Symbol.for('@clerk/express.auth')]:true})});next(); }).listen(0,'127.0.0.1');
  await new Promise<void>((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
  t.after(async()=>{ await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));await db.delete(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId,id)); });
  const origin=`http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  const request={idempotencyKey:randomUUID(),paymentMethod:'ticket',pullCount:5};
  const post=(body:unknown)=>fetch(`${origin}/player/packs/open`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  const first=await post(request);assert.equal(first.status,200);const body=await first.json() as OpenPackResult;
  assert.equal(body.opening.pullCount,5);assert.equal(body.opening.rewards.length,30);assert.equal(body.opening.cost,5);assert.equal(body.pullSeason!.count,5);assert.equal(body.opening.seasonRewards![0].softCurrency,100);
  const changed=await post({...request,pullCount:9,paymentMethod:'softCurrency'});assert.equal(changed.status,409);await changed.arrayBuffer();
  const retry=await post(request);assert.equal(retry.status,200);const recovered=await retry.json() as OpenPackResult;assert.equal(recovered.alreadyOpened,true);assert.deepEqual(recovered.opening,body.opening);assert.equal(recovered.bootstrap.profile.packTickets,0);
  const invalid=await post({...request,idempotencyKey:randomUUID(),pullCount:2.5});assert.equal(invalid.status,400);await invalid.arrayBuffer();
  const status=await fetch(`${origin}/player/packs/welcome`);const advertised=await status.json() as { supportsFlexibleBatches:boolean; pullSeason:{count:number} };assert.equal(advertised.supportsFlexibleBatches,true);assert.equal(advertised.pullSeason.count,5);
});

test('concurrent same-batch retries deliver one milestone and remain scoped to their account', async t => {
  const ids=[`flex-dedup-${randomUUID()}`,`flex-other-${randomUUID()}`];
  for(const id of ids) await db.insert(playerProfilesTable).values({clerkUserId:id,packTickets:7});
  t.after(async()=>{for(const id of ids) await db.delete(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId,id));});
  const request={idempotencyKey:randomUUID(),paymentMethod:'ticket' as const,pullCount:7};
  const results=await Promise.all([openStreetPackForPlayer(ids[0],request),openStreetPackForPlayer(ids[0],request)]);
  assert.equal(results.filter(result=>!result.alreadyOpened).length,1);
  assert.deepEqual(results[0].opening,results[1].opening);assert.deepEqual(results[0].seasonRewards,results[1].seasonRewards);
  assert.equal(results[0].seasonRewards.length,1);assert.equal(results[0].seasonRewards[0].softCurrency,100);
  assert.equal((await getPullSeasonProgress(ids[0])).count,7);
  assert.equal((await db.select().from(playerCollectionClaimsTable).where(eq(playerCollectionClaimsTable.clerkUserId,ids[0]))).length,1);
  const other=await openStreetPackForPlayer(ids[1],request);assert.equal(other.alreadyOpened,false);assert.notEqual(other.opening.id,results[0].opening.id);assert.equal(other.seasonRewards.length,1);
});

test('Clout batches debit exactly N single prices and an unaffordable retry cannot create another receipt', async t => {
  const id=`flex-clout-${randomUUID()}`;await db.insert(playerProfilesTable).values({clerkUserId:id,softCurrency:1000});
  t.after(()=>db.delete(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId,id)));
  const request={idempotencyKey:randomUUID(),paymentMethod:'softCurrency' as const,pullCount:3};
  const result=await openStreetPackForPlayer(id,request);assert.equal(result.opening.cost,600);assert.equal(result.opening.rewards.length,18);
  const currency=result.opening.rewards.filter(reward=>reward.kind==='softCurrency').reduce((sum,reward)=>sum+reward.amount,0);
  const [profile]=await db.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId,id));
  assert.equal(profile.softCurrency,400+currency);assert.equal(profile.packTickets,0);
  assert.deepEqual((await openStreetPackForPlayer(id,request)).opening,result.opening);
  await db.update(playerProfilesTable).set({softCurrency:100}).where(eq(playerProfilesTable.clerkUserId,id));
  await assert.rejects(openStreetPackForPlayer(id,{...request,idempotencyKey:randomUUID(),pullCount:2}),/400 Clout/);
  assert.equal((await db.select().from(playerPackOpeningsTable).where(eq(playerPackOpeningsTable.clerkUserId,id))).length,1);
  assert.equal((await db.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId,id)))[0].softCurrency,100);
});


test('native concurrent batch retries wait on the same profile lock before one charge and milestone grant', { skip: process.env.PAYMENT_REQUIRE_POSTGRES !== '1' }, async t => {
  const id = `flex-native-lock-${randomUUID()}`;
  await db.insert(playerProfilesTable).values({ clerkUserId: id, packTickets: 7 });
  t.after(() => db.delete(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, id)));
  assert.ok((pool.options.max ?? 0) >= 3, 'the test requires independent connections');
  const blocker = await pool.connect();
  let attempts: Promise<Awaited<ReturnType<typeof openStreetPackForPlayer>>>[] = [];
  try {
    const version = await blocker.query<{ version: string }>('select version()');
    assert.match(version.rows[0].version, /^PostgreSQL /);
    assert.doesNotMatch(version.rows[0].version, /PGlite/i);
    await blocker.query('begin');
    await blocker.query('select clerk_user_id from player_profiles where clerk_user_id = $1 for update', [id]);
    const request = { idempotencyKey: randomUUID(), paymentMethod: 'ticket' as const, pullCount: 7 };
    attempts = [openStreetPackForPlayer(id, request), openStreetPackForPlayer(id, request)];
    let waiting: number[] = [];
    const deadline = performance.now() + 5000;
    while (waiting.length < 2 && performance.now() < deadline) {
      await blocker.query('select pg_stat_clear_snapshot()');
      const result = await blocker.query<{ pid: number }>(`select pid from pg_stat_activity
        where datname = current_database() and pid <> pg_backend_pid()
          and wait_event_type = 'Lock' and query like '%player_profiles%for update%'`);
      waiting = result.rows.map(row => row.pid);
      if (waiting.length < 2) await new Promise(resolve => setTimeout(resolve, 10));
    }
    assert.equal(new Set(waiting).size, 2, 'two independent purchase backends must wait for the held profile lock');
    await blocker.query('commit');
    const results = await Promise.all(attempts);
    assert.deepEqual(results.map(result => result.alreadyOpened).sort(), [false, true]);
    assert.deepEqual(results[0].opening, results[1].opening);
    assert.deepEqual(results[0].seasonRewards, results[1].seasonRewards);
    assert.equal(results[0].seasonRewards.length, 1);
    assert.equal(results[0].seasonRewards[0].softCurrency, 100);
    assert.equal((await db.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, id)))[0].packTickets, 0);
    assert.equal((await db.select().from(playerPackOpeningsTable).where(eq(playerPackOpeningsTable.clerkUserId, id))).length, 1);
    assert.equal((await db.select().from(playerCollectionClaimsTable).where(eq(playerCollectionClaimsTable.clerkUserId, id))).length, 1);
  } finally {
    await blocker.query('rollback');
    blocker.release();
    // Settle any queued transactions before the profile cleanup, including assertion failure.
    await Promise.allSettled(attempts);
  }
});
