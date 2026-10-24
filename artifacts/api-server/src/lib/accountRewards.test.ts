import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, playerProfilesTable, playerMissionsTable } from "@workspace/db";
import {
  accountRewardStatus,
  LOGIN_REWARDS,
  growthLabStatus,
  GROWTH_GARDEN_REWARD,
  growthTasksForDate,
  monthlyLoginStatus,
  MONTHLY_LOGIN_MILESTONES,
  type AccountRewardGrant,
} from "@workspace/squabblemon-engine/accountRewards";
import { claimAccountRewards, waterGrowthLab, getAccountRewards, resolveAccountRewardCards } from "./accountRewards";

test("check-in streak uses UTC days, repeats weekly, and resets after a missed day", () => {
  const created = new Date("2026-01-01Z");
  const reward = {
    key: "login:2026-09-23",
    title: "Day 6",
    date: "2026-09-23",
    streak: 6,
    softCurrency: 200,
    packTickets: 0,
    styleShards: 0,
  };
  const seventh = accountRewardStatus(
    20,
    created,
    [reward],
    new Date("2026-09-24T23:59:59Z"),
  );
  assert.equal(seventh.streak, 7);
  assert.equal(seventh.pending[0].packTickets, 2);
  assert.equal(seventh.nextResetAt, "2026-09-25T00:00:00.000Z");
  assert.deepEqual(
    seventh.pending.filter((r) => r.key.startsWith("level:")).map((r) => r.key),
    ["level:10", "level:20"],
  );
  assert.equal(
    accountRewardStatus(1, created, [reward], new Date("2026-09-25Z")).streak,
    1,
  );
  const daySeven = {
    ...reward,
    key: "login:2026-09-24",
    date: "2026-09-24",
    streak: 7,
  };
  const eighth = accountRewardStatus(
    1,
    created,
    [daySeven],
    new Date("2026-09-25Z"),
  );
  assert.equal(eighth.streak, 8);
  assert.equal(eighth.pending[0].softCurrency, LOGIN_REWARDS[0].softCurrency);
});

test('Growth Lab rejects expired tasks and keeps earned plants across missed days', () => {
  const now = new Date('2026-09-25T00:00:00Z');
  const receipt = { key: 'growth:water:2026-09-20', date: '2026-09-20', title: 'Plant', softCurrency: 0, packTickets: 0, styleShards: 0 };
  const oldMissions = ['daily-show-up', 'daily-take-room'].map(missionKey => ({ missionKey, progress: 1, goal: 1, resetAt: now }));
  const status = growthLabStatus([receipt, receipt], oldMissions, now);
  assert.equal(status.totalPlants, 1, 'Receipt identity prevents duplicate plants');
  assert.equal(status.water, 0);
  assert.equal(status.ready, false);
  assert.equal(status.plantsInGarden, 1);
  assert.equal(status.tasks.filter(t => t.complete).length, 0);
});

test('watering requires verified tasks, survives retries, and pays exactly once for each seven-plant garden', async t => {
  const user = `growth-lab-${randomUUID()}`;
  t.after(async () => { await db.delete(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, user)); });
  await db.insert(playerProfilesTable).values({ clerkUserId: user, createdAt: new Date('2025-01-01Z'), softCurrency: 0 });
  for (const missionKey of ['daily-show-up', 'daily-take-room']) await db.insert(playerMissionsTable).values({ clerkUserId: user, missionKey, cadence: 'daily', title: missionKey, description: '', goal: 1, rewardCurrency: 'softCurrency', rewardAmount: 100, resetAt: new Date('2026-09-26Z') });
  const grants = [];
  for (let day = 0; day < 28; day++) {
    // Skipping two days between gardens must not erase already earned plants.
    const now = new Date(Date.UTC(2026, 8, 25 + day + (day >= 7 ? 2 : 0), 12));
    const resetAt = new Date(now); resetAt.setUTCHours(24, 0, 0, 0);
    await db.update(playerMissionsTable).set({ progress: 0, resetAt }).where(eq(playerMissionsTable.clerkUserId, user));
    assert.deepEqual(await waterGrowthLab(user, now), [], 'Incomplete days cannot grow a plant');
    await claimAccountRewards(user, now);
    assert.equal((await getAccountRewards(user, now)).growth.water, 1 / 3);
    await db.update(playerMissionsTable).set({ progress: 1 }).where(eq(playerMissionsTable.clerkUserId, user));
    await db.update(playerProfilesTable).set({storyProgress:{growthDaily:{date:now.toISOString().slice(0,10),counters:Object.fromEntries(growthTasksForDate(now).filter(t=>t.key!=='login').map(t=>[t.key,1]))}}}).where(eq(playerProfilesTable.clerkUserId,user));
    const before = (await db.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, user)))[0];
    const result = (await Promise.all([waterGrowthLab(user, now), waterGrowthLab(user, now)])).flat();
    assert.equal(result.filter(r => r.key.startsWith('growth:water:')).length, 1);
    grants.push(...result);
    const status = (await getAccountRewards(user, now)).growth;
    assert.equal(status.totalPlants, day + 1);
    assert.equal(status.plantsInGarden, day % 7 + 1);
    assert.equal(status.gardenNumber, Math.floor(day / 7) + 1);
    assert.equal(status.wateredToday, true);
    assert.equal(status.water, 0);
    assert.equal(status.ready, false);
    const after = (await db.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, user)))[0];
    assert.equal(after.softCurrency - before.softCurrency, day % 7 === 6 ? GROWTH_GARDEN_REWARD.softCurrency : 0);
    assert.equal(after.packTickets - before.packTickets, day % 7 === 6 ? 1 : 0);
    assert.equal(after.styleShards - before.styleShards, day % 7 === 6 ? 25 : 0);
    assert.deepEqual(await waterGrowthLab(user, now), []);
  }
  assert.deepEqual(grants.filter(r => r.key.startsWith('growth:garden:')).map(r => r.key), ['growth:garden:1', 'growth:garden:2', 'growth:garden:3', 'growth:garden:4']);
  const [profile]=await db.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId,user));
  assert.equal(profile.ownedCardIds.filter(id=>id==='buddy').length,1);
  assert.equal(grants.filter(r=>r.cardId==='buddy').length,1);
  assert.equal(grants.filter(r=>r.key.startsWith('growth:garden:')).reduce((sum,r)=>sum+r.styleShards,0),100);
});

test("concurrent login and level claims pay exactly once, without losing balances", async (t) => {
  const user = `check-in-${randomUUID()}`,
    now = new Date("2026-09-24T12:00:00Z");
  t.after(async () => {
    await db
      .delete(playerProfilesTable)
      .where(eq(playerProfilesTable.clerkUserId, user));
  });
  await db
    .insert(playerProfilesTable)
    .values({
      clerkUserId: user,
      level: 20,
      xp: 4750,
      createdAt: now,
      softCurrency: 10,
    });
  const grants = (
    await Promise.all([
      claimAccountRewards(user, now),
      claimAccountRewards(user, now),
    ])
  ).flat();
  assert.equal(grants.length, 6); // existing five grants plus monthly Super Common card
  assert.equal(new Set(grants.map((r) => r.key)).size, grants.length);
  const [profile] = await db
    .select()
    .from(playerProfilesTable)
    .where(eq(playerProfilesTable.clerkUserId, user));
  assert.equal(profile.softCurrency, 910);
  assert.equal(profile.packTickets, 6);
  assert.equal(profile.styleShards, 100);
  assert.deepEqual(await claimAccountRewards(user, now), []);
  const tomorrow = await claimAccountRewards(
    user,
    new Date("2026-09-25T00:00:00Z"),
  );
  assert.equal(tomorrow.length, 1);
  assert.equal(tomorrow[0].streak, 2);
});

test('daily care rotation changes objectives and ignores stale or fabricated counters',()=>{const keys=new Set<string>();for(let i=0;i<5;i++){const now=new Date(Date.UTC(2026,9,8+i));keys.add(growthTasksForDate(now).map(t=>t.key).join(','));const s=growthLabStatus([],[],now,{date:'2000-01-01',counters:{training:999,'training-win':999}});assert.equal(s.ready,false);assert.ok(s.tasks.every(t=>t.progress===0));}assert.equal(keys.size,5);});
test('previously completed three gardens can collect Buddy once, with duplicate conversion',async t=>{const {playerCollectionClaimsTable}=await import('@workspace/db');const user=`growth-legacy-${randomUUID()}`;t.after(async()=>{await db.delete(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId,user));});const now=new Date('2026-10-08T12:00:00Z');await db.insert(playerProfilesTable).values({clerkUserId:user,createdAt:new Date('2025-01-01Z'),ownedCardIds:['buddy'],styleShards:0});await db.insert(playerCollectionClaimsTable).values(Array.from({length:21},(_,i)=>{const date=new Date(now.getTime()-(i+1)*86400000).toISOString().slice(0,10);return{clerkUserId:user,milestoneKey:`account:growth:water:${date}`,reward:{accountReward:{key:`growth:water:${date}`,date,title:'Plant',softCurrency:0,packTickets:0,styleShards:0}}};}));assert.ok((await getAccountRewards(user,now)).pending.some(r=>r.cardId==='buddy'));const grants=(await Promise.all([claimAccountRewards(user,now),claimAccountRewards(user,now)])).flat();assert.equal(grants.filter(r=>r.cardId==='buddy').length,1);assert.equal(grants.find(r=>r.cardId==='buddy')?.styleShards,25);const [p]=await db.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId,user));assert.equal(p.ownedCardIds.filter(id=>id==='buddy').length,1);assert.equal((await getAccountRewards(user,now)).pending.length,0);});


const savedLogin = (date: string, streak = 1): AccountRewardGrant => ({ key: `login:${date}`, date, streak, title: 'Saved check-in', softCurrency: 0, packTickets: 0, styleShards: 0 });
const monthlyGrants = (receipts: AccountRewardGrant[], now: Date) => accountRewardStatus(1, new Date('2025-01-01Z'), receipts, now).pending.filter(reward => reward.key.startsWith('monthly-login:'));

test('monthly login counts distinct UTC check-ins, keeps missed days and resets only at the calendar boundary', () => {
  const receipts = [savedLogin('2026-10-01'), savedLogin('2026-10-03'), savedLogin('2026-10-07'), savedLogin('2026-10-12')];
  const now = new Date('2026-10-20T23:59:59Z');
  const before = JSON.stringify(receipts);
  const status = accountRewardStatus(1, new Date('2025-01-01Z'), [...receipts, receipts[0], savedLogin('2026-09-30'), savedLogin('2026-10-21')], now);
  assert.equal(status.streak, 1, 'Seven-day streak still resets independently');
  assert.equal(status.monthly.claimedDays, 4);
  assert.equal(status.monthly.requiredDays, 30);
  assert.deepEqual(status.monthly.milestones.filter(m => m.ready).map(m => m.rarity), ['SuperCommon', 'Common']);
  assert.equal(status.monthly.nextResetAt, '2026-11-01T00:00:00.000Z');
  assert.equal(JSON.stringify(receipts), before);
  const monthEnd = savedLogin('2026-10-31', 7);
  const next = accountRewardStatus(1, new Date('2025-01-01Z'), [...receipts, monthEnd], new Date('2026-11-01T00:00:00Z'));
  assert.equal(next.streak, 8, 'Monthly reset does not reset the weekly streak');
  assert.equal(next.monthly.claimedDays, 0);
  assert.deepEqual(next.monthly.milestones.filter(m => m.ready).map(m => m.rarity), ['SuperCommon']);
});

test('February makes its last card reachable on its actual last day and day31 never creates an eighth card', () => {
  for (const [year, days] of [[2026, 28], [2028, 29]] as const) {
    const dates = Array.from({ length: days - 1 }, (_, i) => savedLogin(`${year}-02-${String(i + 1).padStart(2, '0')}`));
    const last = monthlyLoginStatus(dates, new Date(`${year}-02-${days}T00:00:00Z`));
    assert.equal(last.requiredDays, days);
    assert.equal(last.milestones.at(-1)?.day, days);
    assert.equal(last.milestones.at(-1)?.ready, true);
    assert.equal(monthlyLoginStatus(dates.slice(0, -1), new Date(`${year}-02-${days - 1}T23:59:59Z`)).milestones.at(-1)?.ready, false);
  }
  const dates = Array.from({ length: 31 }, (_, i) => savedLogin(`2026-10-${String(i + 1).padStart(2, '0')}`));
  const last = monthlyLoginStatus(dates, new Date('2026-10-31T23:59:59Z'));
  assert.equal(last.claimedDays, 30);assert.equal(last.milestones.length, 7);
  assert.deepEqual(last.milestones.map(m => m.day), [1, 5, 10, 15, 20, 25, 30]);
});

test('each monthly card uses its exact eligible gacha tier and protects an unowned card before duplicates', async () => {
  const { cardCatalog, CARD_RARITIES, catalogCardById, STORY_ONLY_CARD_IDS, isKumiteExclusiveCard } = await import('@workspace/squabblemon-engine/data');
  const { isStreetPackCard } = await import('./collectionEconomy');
  const { STYLE_SHARD_TIERS, styleShardRarityForCard } = await import('@workspace/squabblemon-engine/styleShards');
  assert.deepEqual(MONTHLY_LOGIN_MILESTONES.map(m => m.rarity), [...CARD_RARITIES]);
  const now = new Date('2026-10-30T12:00:00Z');
  const dates = Array.from({ length: 29 }, (_, i) => savedLogin(`2026-10-${String(i + 1).padStart(2, '0')}`));
  const pending = monthlyGrants(dates, now);
  for (const milestone of pending) {
    const pool = cardCatalog.filter(card => card.rarity === milestone.cardRarity && isStreetPackCard(card));
    assert.ok(pool.length > 0);
    const target = pool.at(-1)!;
    const owned = pool.slice(0, -1).map(card => card.catalogId);
    const [reward] = resolveAccountRewardCards([milestone], owned, () => 0);
    assert.equal(reward.cardId, target.catalogId);assert.equal(reward.isNewCard, true);assert.equal(reward.styleShards, 0);
    assert.equal(catalogCardById[reward.cardId!].rarity, milestone.cardRarity);
    assert.ok(!new Set<string>(STORY_ONLY_CARD_IDS).has(reward.cardId!));assert.equal(isKumiteExclusiveCard(reward.cardId!), false);
    const [duplicate] = resolveAccountRewardCards([milestone], pool.map(card => card.catalogId), () => 0);
    const shardRarity = styleShardRarityForCard(milestone.cardRarity!);
    assert.equal(duplicate.isNewCard, false);assert.equal(duplicate.shardRarity, shardRarity);assert.equal(duplicate.styleShards, STYLE_SHARD_TIERS[shardRarity].duplicatePayout);
  }
});

async function monthlyPlayer(t: TestContext, options: { allOwned?: boolean; buddy?: boolean } = {}) {
  const { playerCollectionClaimsTable } = await import('@workspace/db');
  const { cardCatalog } = await import('@workspace/squabblemon-engine/data');
  const user = `monthly-login-${randomUUID()}`;
  t.after(async () => { await db.delete(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, user)); });
  await db.insert(playerProfilesTable).values({ clerkUserId: user, onboardingStep: 'complete', createdAt: new Date('2025-01-01Z'), ownedCardIds: options.allOwned ? cardCatalog.map(card => card.catalogId) : ['cornball'], discoveredCardIds: ['cornball'], softCurrency: 50, packTickets: 0, styleShards: 13 });
  const receipts = [
    { key: 'first-login', title: 'First', softCurrency: 0, packTickets: 0, styleShards: 0 },
    ...Array.from({ length: 29 }, (_, i) => savedLogin(`2026-10-${String(i + 1).padStart(2, '0')}`, i + 1)),
    ...(options.buddy ? Array.from({ length: 21 }, (_, i) => ({ key: `growth:water:2026-09-${String(i + 1).padStart(2, '0')}`, date: `2026-09-${String(i + 1).padStart(2, '0')}`, title: 'Plant', softCurrency: 0, packTickets: 0, styleShards: 0 })) : []),
  ];
  await db.insert(playerCollectionClaimsTable).values(receipts.map(accountReward => ({ clerkUserId: user, milestoneKey: `account:${accountReward.key}`, reward: { accountReward } })));
  return user;
}

test('monthly milestones and Buddy persist together once through concurrent claims and bootstrap normalization', async t => {
  const { getPlayerBootstrap } = await import('./playerState');
  const user = await monthlyPlayer(t, { buddy: true }), now = new Date('2026-10-30T12:00:00Z');
  const results = await Promise.all([claimAccountRewards(user, now), claimAccountRewards(user, now), getPlayerBootstrap(user)]);
  const grants = [...results[0], ...results[1]];
  const cards = grants.filter(reward => reward.cardId);
  assert.equal(cards.length, 8, 'All seven monthly cards and the garden recruit are applied, not just the first card');
  assert.equal(cards.filter(reward => reward.key.startsWith('monthly-login:')).length, 7);
  assert.equal(cards.filter(reward => reward.key === 'growth:buddy').length, 1);
  const [profile] = await db.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, user));
  for (const reward of cards) { assert.ok(profile.ownedCardIds.includes(reward.cardId!));assert.ok(profile.discoveredCardIds.includes(reward.cardId!)); }
  assert.equal(profile.collectionProgress, new Set(profile.ownedCardIds).size);
  assert.equal(profile.softCurrency, 50 + LOGIN_REWARDS[1].softCurrency);
  assert.deepEqual(await claimAccountRewards(user, now), []);
  const recovered = await getAccountRewards(user, now);
  assert.equal(recovered.monthly.claimedDays, 30);
  assert.deepEqual(recovered.monthly.milestones.map(m => m.reward), grants.filter(reward => reward.key.startsWith('monthly-login:')), 'Lost-response recovery returns the original chosen cards, without rerolling');
  const day31 = await claimAccountRewards(user, new Date('2026-10-31T12:00:00Z'));
  assert.deepEqual(day31.map(r => r.key), ['login:2026-10-31']);
  const nextMonth = await claimAccountRewards(user, new Date('2026-11-01T00:00:00Z'));
  assert.equal(nextMonth.filter(r => r.key.startsWith('monthly-login:2026-11:')).length, 1);
});

test('exhausted monthly tiers credit matching shard wallets exactly once without altering weekly or universal rewards', async t => {
  const { STYLE_SHARD_TIERS } = await import('@workspace/squabblemon-engine/styleShards');
  const user = await monthlyPlayer(t, { allOwned: true }), now = new Date('2026-10-30T12:00:00Z');
  const grants = (await Promise.all([claimAccountRewards(user, now), claimAccountRewards(user, now)])).flat();
  const cards = grants.filter(reward => reward.key.startsWith('monthly-login:'));
  assert.equal(cards.length, 7);assert.ok(cards.every(reward => reward.isNewCard === false));
  const [profile] = await db.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, user));
  assert.equal(profile.styleShards, 13);
  assert.equal(profile.styleShardBalances.Common, STYLE_SHARD_TIERS.Common.duplicatePayout * 2);
  for (const rarity of ['Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythical'] as const) assert.equal(profile.styleShardBalances[rarity], STYLE_SHARD_TIERS[rarity].duplicatePayout);
  assert.equal(profile.softCurrency, 50 + LOGIN_REWARDS[1].softCurrency);
  assert.deepEqual(await claimAccountRewards(user, now), []);
});

test('a failed monthly wallet update rolls back all receipts so a safe retry can grant the reward', async t => {
  const { playerCollectionClaimsTable } = await import('@workspace/db');
  const user = await monthlyPlayer(t, { allOwned: true }), now = new Date('2026-10-30T12:00:00Z');
  await db.update(playerProfilesTable).set({ styleShardBalances: { Mythical: 2147483647 } }).where(eq(playerProfilesTable.clerkUserId, user));
  await assert.rejects(claimAccountRewards(user, now), /Style Shard balance/);
  const rows = await db.select().from(playerCollectionClaimsTable).where(eq(playerCollectionClaimsTable.clerkUserId, user));
  assert.ok(rows.every(row => !row.milestoneKey.startsWith('account:monthly-login:') && row.milestoneKey !== 'account:login:2026-10-30'));
  await db.update(playerProfilesTable).set({ styleShardBalances: {} }).where(eq(playerProfilesTable.clerkUserId, user));
  assert.equal((await claimAccountRewards(user, now)).filter(r => r.key.startsWith('monthly-login:')).length, 7);
});


test('account claim route ignores client dates, tier and card IDs and recovers the saved monthly result', async t => {
  const { createApp } = await import('../app');
  const user = `monthly-api-${randomUUID()}`;
  await db.insert(playerProfilesTable).values({ clerkUserId: user, onboardingStep: 'complete', createdAt: new Date('2025-01-01Z'), ownedCardIds: ['cornball'] });
  t.after(async () => { await db.delete(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, user)); });
  const server = createApp((req, _res, next) => {
    Object.assign(req, { auth: Object.assign(() => ({ userId: user, sessionId: 'monthly-test', tokenType: 'session_token', isAuthenticated: true }), { [Symbol.for('@clerk/express.auth')]: true }) });
    next();
  }).listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => { server.once('listening', resolve);server.once('error', reject); });
  t.after(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  const origin = `http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}/api/player/rewards/account`;
  const response = await fetch(`${origin}/claim`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ date: '2099-12-30', claimedDays: 30, cardId: 'guap', cardRarity: 'Mythical', styleShards: 99999 }) });
  assert.equal(response.status, 200);
  const result = await response.json() as { rewards: AccountRewardGrant[]; status: ReturnType<typeof accountRewardStatus> };
  const monthly = result.rewards.filter(reward => reward.key.startsWith('monthly-login:'));
  assert.equal(monthly.length, 1);assert.equal(monthly[0].cardRarity, 'SuperCommon');
  assert.equal(result.status.monthly.claimedDays, 1);assert.equal(result.status.date, new Date().toISOString().slice(0, 10));
  const retry = await fetch(`${origin}/claim`, { method: 'POST' });
  assert.equal(retry.status, 200);assert.deepEqual((await retry.json() as { rewards: AccountRewardGrant[] }).rewards, []);
  const recovered = await (await fetch(origin)).json() as ReturnType<typeof accountRewardStatus>;
  assert.deepEqual(recovered.monthly.milestones[0].reward, monthly[0]);
});
