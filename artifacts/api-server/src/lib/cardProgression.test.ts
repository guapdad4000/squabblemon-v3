import assert from "node:assert/strict";
import test from "node:test";
import { cardLevelFromXp, cardProgressDetails, CARD_XP_CAP } from "@workspace/squabblemon-engine/cardProgression";
import {
  applyCardXp,
  cardXpForOutcome,
  createCardProgressionSnapshot,
  parseCardProgressionSnapshot,
} from "./cardProgression";
import { CARD_BALANCE_VERSION } from "@workspace/squabblemon-engine/multiplayer";

test("card levels change at every XP threshold and stop at level 10", () => {
  const thresholds = [0, 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500];
  thresholds.forEach((xp, index) => {
    assert.equal(cardLevelFromXp(xp), index + 1);
    if (index > 0) assert.equal(cardLevelFromXp(xp - 1), index);
  });
  assert.equal(cardLevelFromXp(-10), 1);
  assert.equal(cardLevelFromXp(999999), 10);
  assert.equal(CARD_XP_CAP, 4500);
  assert.equal(cardProgressDetails({ xp: 100 }).progressPercent, 0);
  assert.equal(cardProgressDetails({ xp: 4500 }).progressPercent, 100);
});

test("earning XP reaches move eligibility without purchasing the next move tier", () => {
  for (const [threshold, count] of [[100, 1], [1000, 2], [2800, 3]]) {
    const progression = { cornball: { xp: threshold - 20, level: 1 } };
    const before = createCardProgressionSnapshot(["cornball"], ["cornball"], progression);
    const earned = applyCardXp(progression, before, ["cornball"], "loss");
    const after = createCardProgressionSnapshot(["cornball"], ["cornball"], earned.progression);
    assert.equal(before.abilityUpgradeSnapshot.player[0]!.upgradeIds.length, count - 1);
    assert.equal(after.abilityUpgradeSnapshot.player[0]!.upgradeIds.length, count - 1);
    assert.equal(after.cards[0].xp, threshold);
  }
});

test("all outcomes award the expected XP and cap rewards at the remaining XP", () => {
  for (const [outcome, amount] of [["win", 30], ["draw", 25], ["loss", 20]] as const) {
    const snapshot = createCardProgressionSnapshot(["cornball"], ["cornball"], {});
    assert.equal(applyCardXp({}, snapshot, ["cornball"], outcome).rewards[0]!.xpGained, amount);
    const result = applyCardXp({ cornball: { xp: 4490, level: 9 } }, snapshot, ["cornball"], outcome);
    assert.equal(result.rewards[0]!.xpGained, 10);
    assert.deepEqual(result.progression.cornball, { xp: 4500, level: 10, moveTier: 3 });
    assert.equal(applyCardXp(result.progression, snapshot, ["cornball"], outcome).rewards[0]!.xpGained, 0);
  }
});

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

test("card XP only changes unique participants present in the fade snapshot", () => {
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

test("a fade progression snapshot stays unchanged after live progression advances", () => {
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

test("fade upgrade snapshots reject forged, stale, and malformed upgrades", () => {
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

test("reward snapshots carry the card balance version and reject older rules", () => {
  const snapshot = createCardProgressionSnapshot(["cornball"], ["cornball"], {});
  assert.equal(snapshot.balanceRulesVersion, CARD_BALANCE_VERSION);
  const stale = { ...snapshot, balanceRulesVersion: CARD_BALANCE_VERSION - 1 };
  assert.throws(
    () => parseCardProgressionSnapshot(stale, ["cornball"], []),
    /missing/,
  );
  const legacy = { ...snapshot };
  delete (legacy as { balanceRulesVersion?: number }).balanceRulesVersion;
  assert.throws(
    () => parseCardProgressionSnapshot(legacy, ["cornball"], []),
    /missing/,
  );
});


test('stored JSONB key order does not invalidate a genuine progression snapshot', () => {
  const original = createCardProgressionSnapshot(['cornball'], ['cornball'], {}, false, ['snow']);
  const reorder = (value: any): any => Array.isArray(value) ? value.map(reorder) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).sort(([a],[b]) => a.localeCompare(b)).map(([key,item]) => [key,reorder(item)])) : value;
  assert.deepEqual(parseCardProgressionSnapshot(reorder(original), ['cornball'], ['snow']), original);
});
