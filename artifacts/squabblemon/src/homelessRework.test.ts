import assert from "node:assert/strict";
import test from "node:test";
import {
  createMatch,
  createCardInstance,
  playTurnCard,
  getLegalCardCost,
  getCharacterDistrictMarks,
  type Match,
  type Owner,
  type Lane,
  type CardInstance,
} from "./gameEngine";
const blank = (): Match => ({
  ...createMatch("block", "block"),
  round: 3,
  playerMotion: 9,
  cpuMotion: 9,
  playerHand: [],
  cpuHand: [],
  boards: [[], [], []],
});
const unit = (
  id: string,
  owner: Owner,
  lane: Lane,
  index = 0,
): CardInstance => ({
  ...createCardInstance(id, owner, "fixture", index),
  lane,
});
const find = (m: Match, c: CardInstance) =>
  m.boards.flat().find((x) => x.instanceId === c.instanceId)!;
function cast(m: Match, id: string, owner: Owner, lane: Lane = 0) {
  const source = createCardInstance(id, owner, "cast", m.nextEventSequence);
  return {
    source,
    after: playTurnCard(
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
    ),
  };
}
for (const owner of ["player", "cpu"] as const) {
  const enemy: Owner = owner === "player" ? "cpu" : "player";
  test(`${owner}: Ronald brings one protected backup per round and activates normal movement hooks`, () => {
    const m = blank(),
      ron = unit("ronald", owner, 0),
      victim = unit("hooper", owner, 0),
      tin = unit("tinman", owner, 0),
      lion = unit("lion", owner, 1),
      backup = unit("cornball", owner, 1),
      other = unit("hooper", owner, 2, 2);
    victim.powerModifier = 20;
    m.boards = [[ron, victim, tin], [lion, backup], [other]];
    const before = JSON.stringify(m),
      hit = cast(m, "inmate-informant", enemy).after;
    assert.equal(JSON.stringify(m), before);
    assert.deepEqual(
      hit,
      cast(JSON.parse(before), "inmate-informant", enemy).after,
    );
    assert.equal(find(hit, backup).lane, 0);
    assert(find(hit, backup).statuses.protected);
    assert.equal(find(hit, backup).powerModifier, 1, "Tin Man arrival");
    assert.equal(find(hit, lion).powerModifier, 2, "Lion departure");
    assert.equal(find(hit, ron).waveRounds?.ronald, 3);
    const second = cast(hit, "inmate-informant", enemy).after;
    assert.equal(find(second, other).lane, 2);
    const space = {
      ...second,
      round: 4,
      boards: second.boards.map((l) =>
        l.filter((c) => c.instanceId !== backup.instanceId),
      ) as Match["boards"],
    };
    const next = cast(space, "inmate-informant", enemy).after;
    assert.equal(find(next, other).lane, 0);
    assert(find(next, other).statuses.protected);
  });
  test(`${owner}: Ronald respects capacity, locks, source debuffs, supports, and damage ownership`, () => {
    for (const reason of [
      "full",
      "locked",
      "support",
      "silenced",
      "frozen",
      "weakened",
      "self-hit",
      "shielded",
    ] as const) {
      const m = blank(),
        ron = unit("ronald", owner, 0),
        victim = unit("hooper", owner, 0),
        backup = unit("cornball", owner, 1);
      victim.powerModifier = 20;
      m.boards = [[ron, victim], [backup], []];
      if (reason === "full")
        m.boards[0].push(
          unit("cornball", owner, 0, 2),
          unit("cornball", owner, 0, 3),
        );
      if (reason === "locked") backup.statuses.locked = true;
      if (reason === "support") backup.kind = "support";
      if (["silenced", "frozen", "weakened"].includes(reason))
        ron.statuses[reason as "silenced" | "frozen" | "weakened"] = true;
      if (reason === "shielded") {
        victim.statuses.protected = true;
        m.timedEffects = [
          {
            id: "cover",
            kind: "church-protection",
            sourceInstanceId: victim.instanceId,
            targetInstanceId: victim.instanceId,
            owner,
            lane: 0,
            startsAtRound: 1,
            expiresAtRound: 99,
            expiration: "match-complete",
          },
        ];
      }
      if (reason === "self-hit") {
        ron.powerModifier = 30;
        victim.powerModifier = 0;
      }
      const after = cast(m, "inmate-informant", enemy).after;
      assert.equal(find(after, backup).lane, 1, reason);
      assert.equal(find(after, backup).statuses.protected, false, reason);
    }
  });
  test(`${owner}: Wiseman dodge grants one local character discount, minimum one, with visible expiry`, () => {
    const issued = cast(blank(), "homeless-wiseman", owner, 2).after;
    const lane = issued.districtTraps!.find((t) => t.kind === "wiseman")!.lane;
    const dodge = ((lane + 1) % 3) as Lane;
    const m = cast(issued, "cornball", enemy, dodge).after;
    assert(!m.districtTraps?.some((t) => t.kind === "wiseman"));
    const token = m.discountTokens.find(
      (t) => t.eligibility === "wiseman-prediction",
    )!;
    assert.equal(token.owner, owner);
    assert.equal(token.targetLane, lane);
    assert.equal(token.expiresAfterRound, 4);
    const card = createCardInstance("ronald", owner),
      cheap = createCardInstance("cornball", owner),
      support = createCardInstance("charger", owner);
    assert.equal(getLegalCardCost(m, owner, card, lane), card.cost - 2);
    assert.equal(getLegalCardCost(m, owner, card, dodge), card.cost);
    assert.equal(getLegalCardCost(m, owner, cheap, lane), 1);
    assert.equal(getLegalCardCost(m, owner, support, lane), support.cost);
    assert.equal(
      getLegalCardCost(m, enemy, createCardInstance("ronald", enemy), lane),
      card.cost,
    );
    assert(
      getCharacterDistrictMarks(m).some(
        (mark) =>
          mark.owner === owner &&
          mark.lane === lane &&
          mark.text.includes("minimum 1"),
      ),
    );
    const expired = { ...m, round: 5 };
    assert.equal(getLegalCardCost(expired, owner, card, lane), card.cost);
    assert(
      !getCharacterDistrictMarks(expired).some((mark) =>
        mark.text.startsWith("Told You"),
      ),
    );
    m.discountTokens.unshift({
      ...token,
      id: "older-generic",
      eligibility: "any",
      createdOrder: 0,
    });
    assert.equal(
      getLegalCardCost(m, owner, card, lane),
      card.cost - 2,
      "stronger discount wins without stacking",
    );
    const consumed = cast(m, "ronald", owner, lane).after;
    assert.equal(
      consumed[owner === "player" ? "playerMotion" : "cpuMotion"],
      9 - card.cost + 2,
    );
    assert(
      !consumed.discountTokens.some(
        (t) => t.eligibility === "wiseman-prediction",
      ),
    );
    assert(consumed.discountTokens.some((t) => t.id === "older-generic"));
    assert.equal(getLegalCardCost(consumed, owner, card, lane), card.cost - 1);
  });
  test(`${owner}: supports do not resolve a prediction; the next character resolves it even after Wiseman leaves`, () => {
    let m = cast(blank(), "homeless-wiseman", owner, 2).after;
    const lane = m.districtTraps![0].lane;
    m = cast(m, "charger", enemy, 1).after;
    assert.equal(m.districtTraps?.length, 1);
    m = {
      ...m,
      boards: m.boards.map((l) =>
        l.filter((c) => c.cardId !== "homeless-wiseman"),
      ) as Match["boards"],
    };
    const hit = cast(JSON.parse(JSON.stringify(m)), "cornball", enemy, lane);
    assert.equal(find(hit.after, hit.source).statuses.weakened, true);
    assert.equal(
      find(hit.after, hit.source).powerModifier,
      0,
      "prediction deals no Hands damage",
    );
    assert(
      !hit.after.discountTokens.some(
        (t) => t.eligibility === "wiseman-prediction",
      ),
    );
    const second = cast(hit.after, "cornball", enemy, lane);
    assert.equal(find(second.after, second.source).statuses.weakened, false);
    const expired = cast({ ...m, round: 5 }, "cornball", enemy, 1).after;
    assert(
      !expired.discountTokens.some(
        (t) => t.eligibility === "wiseman-prediction",
      ),
    );
  });
  test(`${owner}: a later prediction replaces the first without accumulating dodge discounts in one district`, () => {
    let m = cast(blank(), "homeless-wiseman", owner, 2).after;
    m = cast(m, "homeless-wiseman", owner, 2).after;
    assert.equal(
      m.districtTraps?.filter((t) => t.kind === "wiseman" && t.owner === owner)
        .length,
      1,
    );
    const lane = m.districtTraps![0].lane,
      dodge = ((lane + 1) % 3) as Lane;
    m = cast(m, "cornball", enemy, dodge).after;
    m = cast(m, "homeless-wiseman", owner, 2).after;
    m = cast(m, "cornball", enemy, dodge).after;
    assert.equal(
      m.discountTokens.filter(
        (t) => t.eligibility === "wiseman-prediction" && t.targetLane === lane,
      ).length,
      1,
    );
  });
}
