import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { tallyFadeRecords, getSocialRecords } from "./socialRecords";
import {
  db,
  pool,
  playerProfilesTable as profiles,
  socialRelationshipsTable as relations,
  socialIdentitiesTable as identities,
  onlineRoomsTable as rooms,
  socialBlocksTable as blocks,
} from "@workspace/db";
import { inArray } from "drizzle-orm";
test("personal records include earlier rooms and count each series once", () => {
  const rows = [
    {
      hostUserId: "a",
      guestUserId: "b",
      state: { series: { player: 3, cpu: 1, draws: 2 } },
    },
    {
      hostUserId: "b",
      guestUserId: "a",
      state: { series: { player: 2, cpu: 4, draws: 1 } },
    },
    {
      hostUserId: "a",
      guestUserId: "c",
      state: { series: { player: 9, cpu: 0, draws: 0 } },
    },
  ];
  assert.deepEqual(tallyFadeRecords(rows, "a", "b"), {
    wins: 7,
    losses: 3,
    draws: 3,
  });
  assert.deepEqual(tallyFadeRecords(rows, "b"), {
    wins: 3,
    losses: 7,
    draws: 3,
  });
  assert.deepEqual(
    tallyFadeRecords(
      [
        {
          hostUserId: "a",
          guestUserId: "b",
          state: { ranked: { settlement: { player: {} } }, winner: "cpu" },
        },
      ],
      "a",
    ),
    { wins: 0, losses: 1, draws: 0 },
  );
  assert.deepEqual(
    tallyFadeRecords(
      [
        {
          hostUserId: "a",
          guestUserId: "b",
          state: { ranked: {}, winner: "cpu" },
        },
      ],
      "a",
    ),
    { wins: 0, losses: 0, draws: 0 },
  );
});
test(
  "records authorize room membership and hide blocked friends",
  { skip: !process.env.DATABASE_URL },
  async () => {
    const ids = ["a", "b", "c"].map((x) => `records-${x}-${randomUUID()}`);
    const sorted = [ids[0], ids[1]].sort();
    try {
      await db
        .insert(profiles)
        .values(ids.map((clerkUserId) => ({ clerkUserId })));
      await db
        .insert(identities)
        .values(
          ids.map((userId, i) => ({
            userId,
            friendCode: `ABCDE000000${i}`,
            username: `rec_${randomUUID().replaceAll("-", "").slice(0, 12)}`,
          })),
        );
      await db
        .insert(relations)
        .values({
          low: sorted[0],
          high: sorted[1],
          sender: ids[0],
          status: "homie",
        });
      const code = randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase();
      await db
        .insert(rooms)
        .values({
          code,
          hostUserId: ids[0],
          guestUserId: ids[1],
          createRequestId: randomUUID(),
          expiresAt: new Date(0),
          state: { series: { player: 2, cpu: 1, draws: 1 } },
        });
      const record = await getSocialRecords(ids[0], code);
      assert.deepEqual(record.players[0].personal, {
        wins: 2,
        losses: 1,
        draws: 1,
      });
      assert.equal(record.players[0].homie, true);
      assert.deepEqual(record.players[0].overall, {
        wins: 1,
        losses: 2,
        draws: 1,
      });
      assert.ok(!JSON.stringify(record).includes(ids[1]));
      await assert.rejects(getSocialRecords(ids[2], code), /participants/);
      await db.insert(blocks).values({ userId: ids[1], targetId: ids[0] });
      assert.equal((await getSocialRecords(ids[0], code)).players.length, 0);
    } finally {
      await db.delete(profiles).where(inArray(profiles.clerkUserId, ids));
      await pool.end();
    }
  },
);
