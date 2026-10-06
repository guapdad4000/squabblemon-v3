import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, playerProfilesTable } from "@workspace/db";
import { startArcadeGame, actArcadeGame, getArcadeGame } from "./arcadeGames";
import {
  OPPOSITE,
  type GirlRun,
} from "@workspace/squabblemon-engine/arcadeGames";
import { arcadeStartInput, arcadeActionInput } from "@workspace/api-zod";
async function player(t: test.TestContext) {
  const id = "arcade-" + randomUUID();
  await db
    .insert(playerProfilesTable)
    .values({
      clerkUserId: id,
      onboardingStep: "complete",
      softCurrency: 0,
      packTickets: 0,
      styleShards: 0,
    });
  t.after(() =>
    db
      .delete(playerProfilesTable)
      .where(eq(playerProfilesTable.clerkUserId, id)),
  );
  return id;
}
const day = new Date("2026-10-06T20:00:00Z");
test("concurrent starts reuse an active entry; daily and weekly limits reset on their own cadence", async (t) => {
  const user = await player(t);
  for (const kind of ["girl-fade", "fade-market", "block-takeover"] as const) {
    const starts = await Promise.all(
      Array.from({ length: 3 }, () =>
        startArcadeGame(user, kind, randomUUID(), 0, day),
      ),
    );
    assert.equal(new Set(starts.map((s) => s.run!.id)).size, 1);
    const limit = kind === "block-takeover" ? 3 : 2;
    assert.equal(starts[0].attemptsRemaining, limit - 1);
    await actArcadeGame(
      user,
      kind,
      starts[0].run!.id,
      0,
      randomUUID(),
      { type: "retire" },
      day,
    );
    for (let i = 1; i < limit; i++) {
      const id = randomUUID();
      const started = await startArcadeGame(user, kind, id, 1, day);
      await startArcadeGame(user, kind, id, 1, day);
      await actArcadeGame(
        user,
        kind,
        started.run!.id,
        0,
        randomUUID(),
        { type: "retire" },
        day,
      );
    }
    await assert.rejects(
      () => startArcadeGame(user, kind, randomUUID(), 0, day),
      /entries are used/,
    );
    const reset =
      kind === "block-takeover"
        ? new Date("2026-10-12T00:00:00Z")
        : new Date("2026-10-07T00:00:00Z");
    assert.equal(
      (await startArcadeGame(user, kind, randomUUID(), 0, reset))
        .attemptsRemaining,
      limit - 1,
    );
  }
});
test("boxing rewards bank once; retried action, stale revision and foreign run cannot double-pay", async (t) => {
  const user = await player(t),
    other = await player(t);
  let state = await startArcadeGame(user, "girl-fade", randomUUID(), 0, day);
  state = await actArcadeGame(
    user,
    "girl-fade",
    state.run!.id,
    0,
    randomUUID(),
    { type: "ready" },
    day,
  );
  const run = state.run as GirlRun,
    actionId = randomUUID(),
    action = {
      type: "pattern" as const,
      directions: run.box.pattern.map((d) => OPPOSITE[d]),
    },
    now = new Date(run.box.opensAt + 100);
  state = await actArcadeGame(
    user,
    "girl-fade",
    run.id,
    run.revision,
    actionId,
    action,
    now,
  );
  assert.ok(state.earned.softCurrency > 0);
  const retry = await actArcadeGame(
    user,
    "girl-fade",
    run.id,
    run.revision,
    actionId,
    action,
    now,
  );
  assert.equal(retry.run!.revision, state.run!.revision);
  const [profile] = await db
    .select()
    .from(playerProfilesTable)
    .where(eq(playerProfilesTable.clerkUserId, user));
  assert.equal(profile.softCurrency, state.earned.softCurrency);
  await assert.rejects(
    () =>
      actArcadeGame(
        user,
        "girl-fade",
        run.id,
        run.revision,
        randomUUID(),
        action,
        now,
      ),
    /changed/,
  );
  await assert.rejects(
    () =>
      actArcadeGame(
        other,
        "girl-fade",
        run.id,
        state.run!.revision,
        randomUUID(),
        { type: "retire" },
        now,
      ),
    /not found/,
  );
  assert.equal((await getArcadeGame(user, "girl-fade", now)).run!.id, run.id);
});
test("weekly scenario is shared across players, crews are independent and schema refuses client rewards", async (t) => {
  const a = await player(t),
    b = await player(t);
  const one = await startArcadeGame(a, "block-takeover", randomUUID(), 0, day),
    two = await startArcadeGame(b, "block-takeover", randomUUID(), 2, day);
  assert.equal(one.run!.seed, two.run!.seed);
  assert.notEqual(one.run!.health, two.run!.health);
  assert.equal(
    arcadeStartInput.safeParse({
      requestId: randomUUID(),
      choice: 0,
      score: 999,
    }).success,
    false,
  );
  assert.equal(
    arcadeActionInput.safeParse({
      revision: 0,
      actionId: randomUUID(),
      action: { type: "duty", aim: 5, stockLane: 0 },
    }).success,
    false,
  );
  assert.equal(
    arcadeActionInput.safeParse({
      revision: 0,
      actionId: randomUUID(),
      action: { type: "supply" },
      earned: { softCurrency: 10000 },
    }).success,
    false,
  );
});

test("market boosts and captured district rewards survive reads without duplicate payouts", async (t) => {
  const user = await player(t);
  let time = day.getTime();
  let market = await startArcadeGame(user, "fade-market", randomUUID(), 0, day);
  for (let i = 0; i < 6; i++)
    market = await actArcadeGame(
      user,
      "fade-market",
      market.run!.id,
      market.run!.revision,
      randomUUID(),
      { type: "duty", aim: 2, stockLane: 2 },
      new Date((time += 700)),
    );
  assert.equal(market.earned.softCurrency, 12);
  const block = await startArcadeGame(
    user,
    "block-takeover",
    randomUUID(),
    0,
    day,
  );
  const captured = await actArcadeGame(
    user,
    "block-takeover",
    block.run!.id,
    0,
    randomUUID(),
    { type: "attack", tile: 3 },
    day,
  );
  assert.equal(captured.earned.softCurrency, 25);
  const saved = await getArcadeGame(user, "fade-market", new Date(time));
  assert.equal(saved.run!.revision, 6);
  assert.equal(saved.earned.softCurrency, 12);
  const [profile] = await db
    .select()
    .from(playerProfilesTable)
    .where(eq(playerProfilesTable.clerkUserId, user));
  assert.equal(profile.softCurrency, 37);
});
