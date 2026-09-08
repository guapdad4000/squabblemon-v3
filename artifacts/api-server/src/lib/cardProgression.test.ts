import assert from "node:assert/strict";
import test from "node:test";
import {
  applyCardXp,
  cardXpForOutcome,
  createCardProgressionSnapshot,
  parseCardProgressionSnapshot,
} from "./cardProgression";

test("card progression snapshots reject forged or unowned card ids", () => {
  assert.throws(
    () => createCardProgressionSnapshot(
      ["cornball", "forged-card"],
      ["cornball"],
      {},
    ),
    /unowned card/,
  );
});

test("card XP only changes unique participants present in the match snapshot", () => {
  const snapshot = createCardProgressionSnapshot(
    ["cornball", "snow-bunny"],
    ["cornball", "snow-bunny"],
    { cornball: { xp: 90, level: 99 } },
  );
  const result = applyCardXp(
    { cornball: { xp: 90, level: 99 }, "snow-bunny": { xp: 0, level: 1 } },
    snapshot,
    ["cornball", "cornball", "forged-card"],
    "win",
  );
  assert.equal(cardXpForOutcome("win"), 30);
  assert.deepEqual(result.rewards, [{
    cardId: "cornball",
    xpGained: 30,
    previousXp: 90,
    previousLevel: 1,
    xp: 120,
    level: 2,
  }]);
  assert.deepEqual(result.progression["snow-bunny"], { xp: 0, level: 1 });
  assert.equal(result.progression["forged-card"], undefined);
});

test("a match progression snapshot stays unchanged after live progression advances", () => {
  const live = { cornball: { xp: 90, level: 1 } };
  const snapshot = createCardProgressionSnapshot(
    ["cornball"],
    ["cornball"],
    live,
  );
  live.cornball = { xp: 120, level: 2 };
  assert.deepEqual(
    snapshot.cards.map(({ cardId, xp, level }) => ({ cardId, xp, level })),
    [{ cardId: "cornball", xp: 90, level: 1 }],
  );
  assert.deepEqual(
    snapshot.abilityUpgradeSnapshot,
    createCardProgressionSnapshot(["cornball"], ["cornball"], {
      cornball: { xp: 90, level: 1 },
    }).abilityUpgradeSnapshot,
  );
});

test("match upgrade snapshots reject forged, stale, and malformed upgrades", () => {
  const snapshot = createCardProgressionSnapshot(
    ["cornball"],
    ["cornball"],
    { cornball: { xp: 999, level: 9 } },
  );
  assert.deepEqual(
    parseCardProgressionSnapshot(snapshot, ["cornball"], []),
    snapshot,
  );

  const forged = structuredClone(snapshot);
  forged.abilityUpgradeSnapshot.player[0]!.upgradeIds.push("forged");
  assert.throws(
    () => parseCardProgressionSnapshot(forged, ["cornball"], []),
    /stale or forged/,
  );
  assert.throws(
    () => parseCardProgressionSnapshot({ cards: [{ cardId: "cornball" }] }, ["cornball"], []),
    /missing/,
  );
  assert.throws(
    () => parseCardProgressionSnapshot([{ cardId: "cornball", xp: 0, level: 1 }], ["cornball"], []),
    /missing/,
  );
});