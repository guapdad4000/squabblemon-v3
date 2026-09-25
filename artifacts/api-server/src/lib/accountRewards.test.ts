import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, playerProfilesTable, playerMissionsTable } from "@workspace/db";
import {
  accountRewardStatus,
  LOGIN_REWARDS,
  growthLabStatus,
  GROWTH_GARDEN_REWARD,
} from "@workspace/squabblemon-engine/accountRewards";
import { claimAccountRewards, waterGrowthLab, getAccountRewards } from "./accountRewards";

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
  for (let day = 0; day < 14; day++) {
    // Skipping two days between gardens must not erase already earned plants.
    const now = new Date(Date.UTC(2026, 8, 25 + day + (day >= 7 ? 2 : 0), 12));
    const resetAt = new Date(now); resetAt.setUTCHours(24, 0, 0, 0);
    await db.update(playerMissionsTable).set({ progress: 0, resetAt }).where(eq(playerMissionsTable.clerkUserId, user));
    assert.deepEqual(await waterGrowthLab(user, now), [], 'Incomplete days cannot grow a plant');
    await claimAccountRewards(user, now);
    assert.equal((await getAccountRewards(user, now)).growth.water, 1 / 3);
    await db.update(playerMissionsTable).set({ progress: 1 }).where(eq(playerMissionsTable.clerkUserId, user));
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
  assert.deepEqual(grants.filter(r => r.key.startsWith('growth:garden:')).map(r => r.key), ['growth:garden:1', 'growth:garden:2']);
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
  assert.equal(grants.length, 5); // daily, first check-in, new player, levels 10 and 20
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
