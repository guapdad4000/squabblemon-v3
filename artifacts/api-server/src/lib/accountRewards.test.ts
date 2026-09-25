import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, playerProfilesTable } from "@workspace/db";
import {
  accountRewardStatus,
  LOGIN_REWARDS,
} from "@workspace/squabblemon-engine/accountRewards";
import { claimAccountRewards } from "./accountRewards";

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
