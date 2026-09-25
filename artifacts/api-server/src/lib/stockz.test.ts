import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, playerProfilesTable } from "@workspace/db";
import { getStockzState, startStockz, settleStockz } from "./stockz";

test("Stockz hides the closing price, survives retries, and settles only once after the bell", async (t) => {
  const user = `stockz-${randomUUID()}`,
    outsider = `stockz-${randomUUID()}`,
    now = new Date("2026-09-24T12:00:00Z");
  t.after(async () => {
    await db
      .delete(playerProfilesTable)
      .where(eq(playerProfilesTable.clerkUserId, user));
    await db
      .delete(playerProfilesTable)
      .where(eq(playerProfilesTable.clerkUserId, outsider));
  });
  await db.insert(playerProfilesTable).values([
    { clerkUserId: user, softCurrency: 500 },
    { clerkUserId: outsider, softCurrency: 500 },
  ]);
  const input = {
    id: randomUUID(),
    ticker: "DURG",
    direction: "up" as const,
    stake: 25,
  };
  const first = await startStockz(user, input, now);
  assert.equal(first.roundsToday, 1);
  assert.equal(first.active?.stake, 25);
  assert.equal(first.active?.closePrice, undefined);
  assert.deepEqual(await startStockz(user, input, now), first);
  await assert.rejects(
    startStockz(user, { ...input, stake: 50 }, now),
    /different choices/,
  );
  await assert.rejects(
    startStockz(user, { ...input, id: randomUUID() }, now),
    /open trade/,
  );
  await assert.rejects(settleStockz(user, input.id, now), /closing bell/);
  const later = new Date(now.getTime() + 9000);
  await assert.rejects(settleStockz(outsider, input.id, later), /not found/);
  await Promise.all([
    settleStockz(user, input.id, later),
    settleStockz(user, input.id, later),
  ]);
  const result = await getStockzState(user, later);
  assert.equal(result.active, null);
  assert.equal(result.recent.length, 1);
  const trade = result.recent[0];
  assert.equal(trade.payout, trade.closePrice! > trade.openPrice ? 50 : 0);
  const [profile] = await db
    .select()
    .from(playerProfilesTable)
    .where(eq(playerProfilesTable.clerkUserId, user));
  assert.equal(profile.softCurrency, 500 - 25 + trade.payout!);
  await assert.rejects(
    startStockz(user, { ...input, id: randomUUID(), stake: -25 }, later),
    /available stake/,
  );
});

test("Stockz enforces five daily trades and keeps an unfinished trade across midnight", async (t) => {
  const user = `stockz-limit-${randomUUID()}`,
    now = new Date("2026-09-24T23:58:00Z");
  t.after(async () => {
    await db
      .delete(playerProfilesTable)
      .where(eq(playerProfilesTable.clerkUserId, user));
  });
  await db
    .insert(playerProfilesTable)
    .values({ clerkUserId: user, softCurrency: 1000 });
  for (let i = 0; i < 5; i++) {
    const id = randomUUID(),
      opened = new Date(now.getTime() + i * 10000);
    await startStockz(
      user,
      { id, ticker: "SNKR", direction: "down", stake: 10 },
      opened,
    );
    await settleStockz(user, id, new Date(opened.getTime() + 9000));
  }
  const input = {
    id: randomUUID(),
    ticker: "BODE",
    direction: "up" as const,
    stake: 10,
  };
  await assert.rejects(
    startStockz(user, input, new Date("2026-09-24T23:59:00Z")),
    /closed/,
  );
  await startStockz(user, input, new Date("2026-09-25T23:59:58Z"));
  assert.equal(
    (await getStockzState(user, new Date("2026-09-26T00:00:01Z"))).active?.id,
    input.id,
  );
});
