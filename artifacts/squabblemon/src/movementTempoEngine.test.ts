import assert from "node:assert/strict";
import test from "node:test";
import {
  createMatch,
  createCardInstance,
  playTurnCard,
  nextRound,
  type Match,
  type Owner,
  type Lane,
} from "./gameEngine";
const blank = (): Match => ({
  ...createMatch("block", "block"),
  round: 3,
  playerMotion: 9,
  cpuMotion: 9,
  boards: [[], [], []],
  playerHand: [],
  cpuHand: [],
});
function play(m: Match, id: string, owner: Owner, lane: Lane, index: number) {
  const source = createCardInstance(id, owner, "tempo", index);
  return playTurnCard(
    {
      ...m,
      phase: owner === "player" ? "player" : "cpu-reveal",
      playerMotion: 9,
      cpuMotion: 9,
      [owner === "player" ? "playerHand" : "cpuHand"]: [source],
    },
    owner,
    source.instanceId,
    lane,
  );
}
for (const owner of ["player", "cpu"] as const) {
  for (const id of ["stockz", "streamer", "bossbabe"])
    test(`${owner}: Weaken stops ${id} without spending its trigger; cleansing restores it`, () => {
      let m = blank();
      const leader = {
        ...createCardInstance(id, owner, "leader", 0),
        lane: 0 as const,
      };
      leader.statuses.weakened = true;
      m.boards[0] = [leader];
      const original = m,
        before = JSON.stringify(m);
      m = play(m, "cornball", owner, 1, 1);
      assert.equal(m.boards[0][0].powerModifier, 0);
      assert.equal(m.boards[1][0].powerModifier, 0);
      assert.equal(m.cheapBuffsUsed[owner], 0);
      assert.equal(m.boards[0][0].networkBoosts, undefined);
      assert.equal(JSON.stringify(original), before);
      m = play(m, "hair-stylist", owner, 0, 2);
      assert.equal(
        m.boards[0].find((c) => c.instanceId === leader.instanceId)!.statuses
          .weakened,
        false,
      );
      const afterCleanse = m.boards[0].find(
        (c) => c.instanceId === leader.instanceId,
      )!.powerModifier;
      m = play(JSON.parse(JSON.stringify(m)), "cornball", owner, 1, 3);
      const active = m.boards[0].find(
        (c) => c.instanceId === leader.instanceId,
      )!;
      if (id === "streamer") {
        assert.equal(m.boards[1].at(-1)!.powerModifier, 1);
        assert.equal(m.cheapBuffsUsed[owner], 1);
      } else assert.equal(active.powerModifier, afterCleanse + 1);
      if (id === "bossbabe") {
        assert.equal(active.networkBoosts, 1);
        m = play(m, "cornball", owner, 2, 4);
        assert.equal(
          m.discountTokens.filter(
            (t) => t.owner === owner && t.eligibility === "printed-four-plus",
          ).length,
          1,
        );
        m = play(m, "cornball", owner, 2, 5);
        assert.equal(
          m.discountTokens.filter(
            (t) => t.owner === owner && t.eligibility === "printed-four-plus",
          ).length,
          1,
        );
      }
    });
  test(`${owner}: weakened Wifey cannot refresh Protection at round start`, () => {
    const m = blank(),
      guard = {
        ...createCardInstance("wifey", owner, "guard", 0),
        lane: 0 as const,
      };
    guard.statuses.weakened = true;
    m.boards[0] = [guard];
    const after = nextRound({ ...m, phase: "resolved" });
    assert.equal(after.boards[0][0].statuses.protected, false);
    assert.equal(
      after.timedEffects.some(
        (e) =>
          e.kind === "wifey-protection" &&
          e.sourceInstanceId === guard.instanceId,
      ),
      false,
    );
  });
}
