import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  db,
  pool,
  playerProfilesTable,
  playerCollectionClaimsTable,
  playerStoryNodesTable,
} from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import {
  decks,
  engineIdsToCatalogIds,
} from "@workspace/squabblemon-engine/data";
import { startBossRaid, getBossRaid, actBossRaid } from "./bossRaid";
import { reconcileKumiteRewards } from "./kumiteRewards";
const ids = engineIdsToCatalogIds(decks.find((d) => d.id === "block")!.cards),
  now = new Date("2026-10-26T12:00:00Z");
async function player(t: test.TestContext) {
  const id = "expansion-" + randomUUID();
  await db
    .insert(playerProfilesTable)
    .values({
      clerkUserId: id,
      ownedCardIds: [...ids, "leroy"],
      styleShards: 0,
    });
  t.after(() =>
    db
      .delete(playerProfilesTable)
      .where(eq(playerProfilesTable.clerkUserId, id)),
  );
  return id;
}
test("two Dojo entries are distinct, retried safely and capped; Precinct remains one", async (t) => {
  const id = await player(t);
  assert.equal((await getBossRaid(id, now, "kumite")).attemptsRemaining, 2);
  for (let entry = 1; entry <= 2; entry++) {
    const key = randomUUID(),
      starts = await Promise.all([
        startBossRaid(id, key, ids, now, "kumite"),
        startBossRaid(id, key, ids, now, "kumite"),
      ]);
    assert.equal(starts[0].run!.id, starts[1].run!.id);
    assert.equal(starts[0].attemptsRemaining, 2 - entry);
    const run = starts[0].run!;
    await actBossRaid(
      id,
      run.id,
      run.revision,
      randomUUID(),
      { type: "retire" },
      now,
      "kumite",
    );
    assert.equal(
      (await startBossRaid(id, key, ids, now, "kumite")).attemptsRemaining,
      2 - entry,
      "same receipt retry never consumes another entry",
    );
  }
  await assert.rejects(
    () => startBossRaid(id, randomUUID(), ids, now, "kumite"),
    /no entries remain/,
  );
  assert.equal((await getBossRaid(id, now)).attemptsRemaining, 1);
  const precinct = await startBossRaid(id, randomUUID(), ids, now);
  await actBossRaid(
    id,
    precinct.run!.id,
    precinct.run!.revision,
    randomUUID(),
    { type: "retire" },
    now,
  );
  await assert.rejects(
    () => startBossRaid(id, randomUUID(), ids, now),
    /no entries remain/,
  );
  assert.equal(
    (await getBossRaid(id, new Date("2026-10-27"), "kumite")).attemptsRemaining,
    2,
  );
});
test("concurrent reconciliation grants one personal alternate and one quest receipt, never another account", async (t) => {
  const id = await player(t),
    other = await player(t);
  await db.insert(playerCollectionClaimsTable).values([
    {
      clerkUserId: id,
      milestoneKey: "boss-campaign:kumite:v2",
      reward: {
        bossCampaign: { version: 2, state: { defeated: [1, 2, 3, 4, 5] } },
      },
    },
    {
      clerkUserId: id,
      milestoneKey: "kumite:win:expansion:once:v1",
      reward: {
        kumite: {
          tournamentId: "expansion",
          matchId: "once",
          event: "win",
          at: +now,
          crew: ["leroy"],
          sweep: true,
        },
      },
    },
  ]);
  await Promise.all(
    Array.from({ length: 4 }, () =>
      db.transaction((tx) => reconcileKumiteRewards(tx, id, +now)),
    ),
  );
  const [p] = await db
    .select()
    .from(playerProfilesTable)
    .where(eq(playerProfilesTable.clerkUserId, id));
  assert.equal(p.styleShards, 20);
  assert.deepEqual(p.ownedVariants, ["leroy:kumite-alt-v1"]);
  const receipts = await db
    .select()
    .from(playerCollectionClaimsTable)
    .where(eq(playerCollectionClaimsTable.clerkUserId, id));
  assert.equal(
    receipts.filter((r) => r.milestoneKey === "kumite:quest:leroy:sweep:v1")
      .length,
    1,
  );
  assert.equal(receipts.filter((r) => r.reward.kumiteAlternate).length, 1);
  await db.transaction((tx) => reconcileKumiteRewards(tx, other, +now));
  await db.transaction((tx) => reconcileKumiteRewards(tx, id, +now));
  const profiles = await db
    .select()
    .from(playerProfilesTable)
    .where(inArray(playerProfilesTable.clerkUserId, [id, other]));
  assert.equal(profiles.find((p) => p.clerkUserId === other)!.styleShards, 0);
  assert.deepEqual(
    profiles.find((p) => p.clerkUserId === other)!.ownedVariants,
    [],
  );
  assert.equal(profiles.find((p) => p.clerkUserId === id)!.styleShards, 20);
});

test("all ten Kumite manuals use real prerequisite, wrong-order, bypass and once-only reward checks", async (t) => {
  const { storyContent } = await import("@workspace/squabblemon-engine/story");
  const { completeStoryPuzzle } = await import("./storyTransactions");
  const id = await player(t),
    locked = await player(t);
  const chapter = storyContent.chapters.find(
    (c) => c.id === "kumite-break-the-bracket",
  )!;
  const manuals = chapter.nodes.filter((n) => n.puzzle);
  assert.equal(manuals.length, 10);
  await assert.rejects(
    () =>
      completeStoryPuzzle(
        locked,
        manuals[0].id,
        randomUUID(),
        [...manuals[0].puzzle!.solution],
        undefined,
      ),
    /locked/i,
  );
  await db
    .insert(playerStoryNodesTable)
    .values(
      storyContent.chapters.flatMap((c) =>
        c.nodes
          .filter((n) => !manuals.some((m) => m.id === n.id))
          .map((n) => ({
            clerkUserId: id,
            chapterId: c.id,
            nodeId: n.id,
            cleared: true,
          })),
      ),
    );
  for (const manual of manuals) {
    const p = manual.puzzle!;
    await assert.rejects(
      () =>
        completeStoryPuzzle(
          id,
          manual.id,
          randomUUID(),
          p.pieces.map((x) => x.id),
          undefined,
        ),
      /incorrect/i,
    );
    const key = randomUUID();
    const first = await completeStoryPuzzle(
      id,
      manual.id,
      key,
      [...p.solution],
      undefined,
    );
    const replay = await completeStoryPuzzle(
      id,
      manual.id,
      key,
      [...p.solution],
      undefined,
    );
    assert.equal(first.alreadyCompleted, false);
    assert.equal(replay.alreadyCompleted, true);
    assert.deepEqual(first.rewards, replay.rewards);
    assert.deepEqual(first.bootstrap.profile, replay.bootstrap.profile);
  }
  const cleared = await db
    .select()
    .from(playerStoryNodesTable)
    .where(eq(playerStoryNodesTable.clerkUserId, id));
  assert.equal(
    cleared.filter((n) => manuals.some((m) => m.id === n.nodeId) && n.cleared)
      .length,
    10,
  );
});

test("currency race checks use independent PostgreSQL backend connections", async () => {
  const a = await pool.connect(),
    b = await pool.connect();
  try {
    const [x, y] = await Promise.all([
      a.query("select pg_backend_pid() as pid"),
      b.query("select pg_backend_pid() as pid"),
    ]);
    assert.notEqual(x.rows[0].pid, y.rows[0].pid);
  } finally {
    a.release();
    b.release();
  }
});

test("mastery art cannot be purchased through the ordinary variant endpoint", async (t) => {
  const id = await player(t);
  const { craftPlayerVariantForPlayer } =
    await import("./collectionTransactions");
  await assert.rejects(
    () => craftPlayerVariantForPlayer(id, "leroy", "leroy:kumite-alt-v1"),
    /mastery/i,
  );
  const [p] = await db
    .select()
    .from(playerProfilesTable)
    .where(eq(playerProfilesTable.clerkUserId, id));
  assert.equal(p.styleShards, 0);
  assert.deepEqual(p.ownedVariants, []);
});
