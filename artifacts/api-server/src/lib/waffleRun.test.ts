import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  db,
  playerProfilesTable,
  playerCollectionClaimsTable,
  playerStoryNodesTable,
} from "@workspace/db";
import { startWaffleRun, actWaffleRun, getWaffleRun } from "./waffleRun";
import { getJohnHenryMythic, claimJohnHenryMythic } from "./johnHenryMythic";
import { JOHN_HENRY_CHAPTERS } from "@workspace/squabblemon-engine/johnHenryMythic";
import { storyContent } from "@workspace/squabblemon-engine/story";
import {
  waffleHopTargets,
  waffleWatchedPlate,
} from "@workspace/squabblemon-engine/waffleRun";
import { waffleStartInput, waffleActionInput } from "@workspace/api-zod";
async function player(t: test.TestContext, owns = false) {
  const id = `waffle-${randomUUID()}`;
  await db
    .insert(playerProfilesTable)
    .values({
      clerkUserId: id,
      onboardingStep: "complete",
      softCurrency: 0,
      packTickets: 0,
      styleShards: 0,
      ownedCardIds: owns ? ["john-henry"] : [],
      discoveredCardIds: [],
    });
  t.after(() =>
    db
      .delete(playerProfilesTable)
      .where(eq(playerProfilesTable.clerkUserId, id)),
  );
  return id;
}
const day = new Date("2026-10-06T20:00:00Z");
test("concurrent starts reuse one active run; retries do not spend another attempt; exactly two runs per UTC day", async (t) => {
  const user = await player(t),
    results = await Promise.all(
      Array.from({ length: 3 }, () => startWaffleRun(user, randomUUID(), day)),
    );
  assert.equal(new Set(results.map((s) => s.run?.id)).size, 1);
  assert.equal(results[0].attemptsRemaining, 1);
  let state = await actWaffleRun(
    user,
    results[0].run!.id,
    0,
    randomUUID(),
    { type: "retire" },
    day,
  );
  const id = randomUUID();
  state = await startWaffleRun(user, id, day);
  assert.equal(state.attemptsRemaining, 0);
  await startWaffleRun(user, id, day);
  state = await actWaffleRun(
    user,
    id,
    0,
    randomUUID(),
    { type: "retire" },
    day,
  );
  await assert.rejects(
    () => startWaffleRun(user, randomUUID(), day),
    /Both daily/,
  );
  state = await startWaffleRun(
    user,
    randomUUID(),
    new Date("2026-10-07T00:00:00Z"),
  );
  assert.equal(state.attemptsRemaining, 1);
});
test("hop earnings bank atomically, duplicate actions cannot double-pay, stale and foreign run actions are rejected", async (t) => {
  const user = await player(t),
    other = await player(t);
  let state = await startWaffleRun(user, randomUUID(), day);
  let time = day.getTime();
  let lastAction = "";
  let lastRevision = 0;
  let lastPlate = 0;
  for (let i = 0; i < 3; i++) {
    time += 500;
    const run = state.run!;
    const watched = waffleWatchedPlate(run, time);
    const plate = waffleHopTargets(run).find((p) => p !== watched)!;
    lastAction = randomUUID();
    lastRevision = run.revision;
    lastPlate = plate;
    state = await actWaffleRun(
      user,
      run.id,
      run.revision,
      lastAction,
      { type: "hop", plate },
      new Date(time),
    );
  }
  assert.equal(state.earned.softCurrency, 20);
  const retry = await actWaffleRun(
    user,
    state.run!.id,
    lastRevision,
    lastAction,
    { type: "hop", plate: lastPlate },
    new Date(time),
  );
  assert.equal(retry.run?.revision, state.run?.revision);
  const [profile] = await db
    .select()
    .from(playerProfilesTable)
    .where(eq(playerProfilesTable.clerkUserId, user));
  assert.equal(profile.softCurrency, 20);
  await assert.rejects(
    () =>
      actWaffleRun(
        user,
        state.run!.id,
        0,
        randomUUID(),
        { type: "hop", plate: 0 },
        new Date(time),
      ),
    /another tab/,
  );
  await assert.rejects(
    () =>
      actWaffleRun(
        other,
        state.run!.id,
        state.run!.revision,
        randomUUID(),
        { type: "retire" },
        new Date(time),
      ),
    /not found/,
  );
  const resumed = await getWaffleRun(user, new Date(time));
  assert.deepEqual(resumed.run, state.run);
  assert.equal(resumed.attemptsRemaining, 1);
});
test("active runs survive midnight without spending a fresh attempt; invalid actions do not alter progress", async (t) => {
  const user = await player(t),
    state = await startWaffleRun(user, randomUUID(), day);
  const resumed = await startWaffleRun(
    user,
    randomUUID(),
    new Date("2026-10-07T00:00:01Z"),
  );
  assert.equal(resumed.run?.id, state.run?.id);
  assert.equal(resumed.attemptsRemaining, 2);
  await assert.rejects(
    () =>
      actWaffleRun(
        user,
        state.run!.id,
        0,
        randomUUID(),
        { type: "move", move: "peck" },
        day,
      ),
    /not available/,
  );
  assert.equal((await getWaffleRun(user, day)).run?.revision, 0);
});
test("John Henry requires actual campaign clears and concurrent claims award once, including duplicate protection", async (t) => {
  const user = await player(t, true);
  assert.equal((await getJohnHenryMythic(user)).state, "locked");
  await assert.rejects(() => claimJohnHenryMythic(user), /eight/);
  const chapters = storyContent.chapters.filter((c) =>
    JOHN_HENRY_CHAPTERS.includes(c.id as (typeof JOHN_HENRY_CHAPTERS)[number]),
  );
  await db
    .insert(playerStoryNodesTable)
    .values(
      chapters.flatMap((c) =>
        c.nodes
          .filter((n) => !n.optional)
          .map((n) => ({
            clerkUserId: user,
            chapterId: c.id,
            nodeId: n.id,
            cleared: true,
          })),
      ),
    );
  assert.equal((await getJohnHenryMythic(user)).state, "ready");
  const claims = await Promise.all([
    claimJohnHenryMythic(user),
    claimJohnHenryMythic(user),
    claimJohnHenryMythic(user),
  ]);
  assert.equal(claims.filter((r) => r.claimed).length, 1);
  const [profile] = await db
    .select()
    .from(playerProfilesTable)
    .where(eq(playerProfilesTable.clerkUserId, user));
  assert.equal(profile.softCurrency, 1500);
  assert.equal(profile.packTickets, 5);
  assert.equal(profile.styleShards, 50);
  assert.deepEqual(profile.ownedCardIds, ["john-henry"]);
  assert.equal((await getJohnHenryMythic(user)).state, "claimed");
});
test("minigame schemas reject forged scores, invalid actions, revisions and request IDs", () => {
  assert.equal(
    waffleStartInput.safeParse({ requestId: "fake" }).success,
    false,
  );
  assert.equal(
    waffleActionInput.safeParse({
      revision: 0,
      actionId: randomUUID(),
      action: { type: "hop", plate: 6 },
    }).success,
    false,
  );
  assert.equal(
    waffleActionInput.safeParse({
      revision: 0,
      actionId: randomUUID(),
      action: { type: "hop", plate: 1 },
      waffles: 99,
    }).success,
    false,
  );
  assert.equal(
    waffleActionInput.safeParse({
      revision: -1,
      actionId: randomUUID(),
      action: { type: "retire" },
    }).success,
    false,
  );
});


test("the final diner action retries as the same saved completion", async (t) => {
 const user = await player(t);
 const started = await startWaffleRun(user, randomUUID(), day);
 const run = started.run!;
 const actionId = randomUUID();
 const ended = await actWaffleRun(user, run.id, run.revision, actionId, {type: "retire"}, day);
 const retry = await actWaffleRun(user, run.id, run.revision, actionId, {type: "retire"}, day);
 assert.equal(ended.run!.phase, "ended");
 assert.deepEqual(retry, ended);
 assert.equal((await getWaffleRun(user, day)).run!.phase, "ended");
});
