import assert from "node:assert/strict";
import test from "node:test";
import { cards } from "./data";
import {
  CREATIVE_KITS,
  REPLACED_BONDS,
} from "../../../lib/squabblemon-engine/src/creativeReworks";
import {
  createMatch,
  createAbilityUpgradeSnapshot,
  createCardInstance,
  playTurnCard,
  nextRound,
  getLegalCardCost,
  getCharacterDistrictMarks,
  type Match,
  type Owner,
  type Lane,
  type CardInstance,
} from "./gameEngine";
const json = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const blank = (): Match => ({
  ...createMatch("block", "block"),
  round: 3,
  boards: [[], [], []],
  playerHand: [],
  cpuHand: [],
  playerMotion: 9,
  cpuMotion: 9,
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
  m.boards.flat().find((x) => x.instanceId === c.instanceId);
function cast(
  m: Match,
  id: string,
  owner: Owner,
  lane: Lane = 0,
  disabled = false,
) {
  const source = createCardInstance(id, owner, "play", m.nextEventSequence);
  if (disabled) source.statuses.weakened = true;
  const after = playTurnCard(
    {
      ...m,
      phase: owner === "player" ? "player" : "cpu-reveal",
      [owner === "player" ? "playerHand" : "cpuHand"]: [source],
      playerMotion: 9,
      cpuMotion: 9,
    },
    owner,
    source.instanceId,
    lane,
  );
  return { after, source };
}
const end = (m: Match) => nextRound({ ...m, phase: "resolved" });
const kinds = (m: Match) => m.creativeMarks?.map((x) => x.kind) ?? [];
for (const owner of ["player", "cpu"] as const) {
  const enemy: Owner = owner === "player" ? "cpu" : "player";
  for (const id of Object.keys(CREATIVE_KITS))
    test(`${owner}: ${id} rework preserves deterministic state and capacity`, () => {
      const m = blank();
      m.boards = [
        [
          unit("edgar", owner, 0),
          unit("nguyen", owner, 0),
          unit("og", enemy, 0),
        ],
        [unit("inmate-crafty", owner, 1), unit("og", enemy, 1, 1)],
        [unit("bikelife", owner, 2), unit("og", enemy, 2, 2)],
      ];
      const frozen = json(m);
      const result = cast(m, id, owner).after;
      assert.deepEqual(json(m), frozen);
      assert.deepEqual(json(result), json(cast(json(m), id, owner).after));
      for (const lane of result.boards)
        for (const side of ["player", "cpu"])
          assert(lane.filter((c) => c.owner === side).length <= 4);
      assert.equal(
        new Set(result.boards.flat().map((c) => c.instanceId)).size,
        result.boards.flat().length,
      );
      assert(
        result.playerMotion >= 0 &&
          result.playerMotion <= 9 &&
          result.cpuMotion >= 0 &&
          result.cpuMotion <= 9,
      );
      assert.deepEqual(json(end(result)), json(end(json(result))));
      const blocked = cast(m, id, owner, 0, true).after;
      assert(
        !blocked.creativeMarks?.some((x) => x.source.cardId === id),
        "Weaken must block setup",
      );
    });
  test(`${owner}: ATV reserves two slots and carries its passenger with real movement hooks`, () => {
    let m = blank();
    const p = unit("cornball", owner, 0),
      lion = unit("lion", owner, 0);
    m.boards = [[p, lion], [], []];
    const { after, source } = cast(m, "yn-atv-lord", owner);
    assert.equal(find(after, p)?.lane, 1);
    assert.equal(find(after, source)?.lane, 1);
    assert(find(after, p)?.statuses.protected);
    assert.equal(find(after, lion)?.powerModifier, 2);
    m = json(m);
    m.boards[0][0].statuses.locked = true;
    const locked = cast(m, "yn-atv-lord", owner).after;
    assert.equal(find(locked, p)?.lane, 0);
    assert.equal(
      locked.boards[0].find((c) => c.cardId === "yn-atv-lord")?.lane,
      0,
    );
  });
  test(`${owner}: Mr Trick pays for the next guest's real damage, then consumes his Tab`, () => {
    let m = blank();
    const victim = unit("og", enemy, 0);
    m.boards = [[victim], [], []];
    m = cast(m, "mr-trick", owner).after;
    const played = cast(m, "inmate-informant", owner);
    const informant = played.source;
    m = played.after;
    assert.equal(m.creativeMarks?.find((x) => x.kind === "tab")?.amount, 1);
    const prior = find(m, informant)!.powerModifier;
    m = end(m);
    assert.equal(find(m, informant)?.powerModifier, prior + 2);
    assert(!kinds(m).includes("tab"));
  });
  test(`${owner}: Hooper resolves a visible challenge after its full response window`, () => {
    let m = blank();
    const target = unit("og", enemy, 0);
    m.boards = [[target], [], []];
    const played = cast(m, "hooper", owner);
    m = played.after;
    assert(kinds(m).includes("duel"));
    assert(
      getCharacterDistrictMarks(m).some((x) =>
        x.text.includes("Ankle Breaker"),
      ),
    );
    m = end(m);
    assert.equal(find(m, target)?.powerModifier, 0);
    m = end(m);
    assert((find(m, target)?.powerModifier ?? -99) <= -3);
    assert.equal(find(m, played.source)?.powerModifier, 1);
  });
  test(`${owner}: DMV delays the entrance once and respects disabling before release`, () => {
    let m = cast(blank(), "dmvworker", owner).after;
    const played = cast(m, "youngbull", enemy);
    m = played.after;
    assert.equal(find(m, played.source)?.powerModifier, 0);
    assert(kinds(m).includes("delayed"));
    const released = end(m);
    assert.equal(find(released, played.source)?.powerModifier, 1);
    assert(!kinds(released).includes("delayed"));
    m = {
      ...m,
      boards: m.boards.map((cs) =>
        cs.map((c) =>
          c.instanceId === played.source.instanceId
            ? { ...c, statuses: { ...c.statuses, silenced: true } }
            : c,
        ),
      ) as Match["boards"],
    };
    assert.equal(find(end(m), played.source)?.powerModifier, 0);
  });
  test(`${owner}: Tattoo grants its ward on movement and cannot be reapplied`, () => {
    const target = unit("cornball", owner, 0);
    let m = blank();
    m.boards = [[target], [], []];
    m = cast(m, "tattoo-artist", owner).after;
    assert.equal(find(m, target)?.powerModifier, 1);
    assert(!find(m, target)?.statuses.protected);
    m = cast(m, "break", owner).after;
    assert(find(m, target)?.statuses.protected);
    assert.equal(find(m, target)?.lane, 1);
    assert(!kinds(m).includes("ink"));
    m = cast(m, "tattoo-artist", owner, 1).after;
    assert(!kinds(m).includes("ink"));
  });
  test(`${owner}: Bboy visits at most two other districts and Gokarter counts distinct visits`, () => {
    let m = blank();
    m.boards = [[], [unit("cornball", owner, 1)], []];
    const b = cast(m, "bboy", owner);
    assert.equal(find(b.after, b.source)?.lane, 2);
    assert.equal(find(b.after, b.source)?.powerModifier, 2);
    const g = cast(blank(), "yn-gokarter", owner);
    m = g.after;
    assert.equal(find(m, g.source)?.creativeVisits?.length, 2);
    m = cast(m, "vibe", owner, 2).after;
    assert.equal(find(m, g.source)?.creativeVisits?.length, 3);
    assert.equal(find(m, g.source)?.powerModifier, 4);
  });
  test(`${owner}: pending transfer redirects a real refund once`, () => {
    let m = cast(blank(), "atl-scammer", owner).after;
    const refund = cast(m, "energydrink", enemy);
    m = refund.after;
    assert(!kinds(m).includes("claim"));
    assert.equal(m[enemy === "player" ? "playerMotion" : "cpuMotion"], 8);
  });
  test(`${owner}: tech funding repays unused funds and carries only spent debt`, () => {
    const source = createCardInstance("techbro", owner);
    const key = owner === "player" ? "playerMotion" : "cpuMotion",
      hand = owner === "player" ? "playerHand" : "cpuHand";
    let m = playTurnCard(
      {
        ...blank(),
        phase: owner === "player" ? "player" : "cpu-reveal",
        [key]: 4,
        [hand]: [source],
      },
      owner,
      source.instanceId,
      0,
    );
    assert.equal(m[key], 2);
    m = { ...m, [key]: 0 };
    const next = end(m);
    assert.equal(next[key], Math.max(0, Math.min(9, next.round) - 2));
    assert(!kinds(next).includes("debt"));
  });
  test(`${owner}: pure bonds no longer scale the whole board from hand`, () => {
    for (const id of REPLACED_BONDS) {
      const m = blank(),
        target = unit("og", owner, 0);
      target.type = cards[id].type;
      m.boards = [[target], [], []];
      m[owner === "player" ? "playerHand" : "cpuHand"] = [
        createCardInstance(id, owner),
      ];
      assert.equal(find(end(m), target)?.powerModifier, 0, id);
      assert.equal(cards[id].elementalBond, undefined);
    }
  });
}

for (const owner of ["player", "cpu"] as const) {
  const enemy: Owner = owner === "player" ? "cpu" : "player";
  test(`${owner}: the protection trio separates interception, revenge, and recovery`, () => {
    const target = unit("og", owner, 0);
    target.powerModifier = 10;
    for (const id of ["stud", "lebron-james", "firstaid"]) {
      let m = blank();
      m.boards = [[target], [], []];
      const setup = cast(m, id, owner);
      m = cast(setup.after, "inmate-informant", enemy).after;
      if (id === "stud") {
        assert.equal(find(m, target)?.powerModifier, 10);
        assert.equal(find(m, target)?.lane, 1);
        assert.equal(find(m, setup.source)?.powerModifier, -2);
      }
      if (id === "lebron-james") {
        assert.equal(find(m, target)?.powerModifier, 10);
        assert(
          !m.boards
            .flat()
            .some((c) => c.cardId === "inmate-informant" && c.owner === enemy),
        );
        assert(!kinds(m).includes("revenge"));
      }
      if (id === "firstaid") {
        assert.equal(find(m, target)?.powerModifier, 10);
        assert(!kinds(m).includes("kit"));
      }
    }
  });
  test(`${owner}: Lawyer status appeal is delayed and movement dismisses it`, () => {
    const target = unit("og", owner, 0);
    target.powerModifier = 10;
    let m = blank();
    m.boards = [[target], [], []];
    m = cast(m, "lawyer", owner).after;
    m = cast(m, "snow", enemy).after;
    assert.equal(find(m, target)?.statuses.frozen, false);
    assert(kinds(m).includes("pending-appeal"));
    assert.equal(find(end(m), target)?.statuses.frozen, true);
    const moved = cast(m, "break", owner).after; // Break chooses Lawyer, so explicitly move the client using its isolated lane.
    const isolated = {
      ...m,
      boards: m.boards.map((cs) =>
        cs.filter(
          (c) => c.instanceId === target.instanceId || c.owner === enemy,
        ),
      ) as Match["boards"],
    };
    const dismissed = cast(isolated, "break", owner).after;
    assert(!kinds(dismissed).includes("pending-appeal"));
    assert.equal(find(end(dismissed), target)?.statuses.frozen, false);
    assert(moved);
  });
  test(`${owner}: Floor Sweep, Mall Rules, and Concrete react to movement without permanent locks`, () => {
    let m = blank();
    const passenger = unit("cornball", owner, 0);
    m.boards = [[passenger], [], []];
    m = cast(m, "break", owner).after;
    assert(kinds(m).includes("floor"));
    const entrant = cast(m, "og", enemy);
    assert(find(entrant.after, entrant.source)?.statuses.weakened);
    assert(!kinds(entrant.after).includes("floor"));
    m = cast(blank(), "rent-a-cop", owner).after;
    const rider = cast(m, "bikelife", enemy);
    assert(!kinds(rider.after).includes("warning"));
    assert((find(rider.after, rider.source)?.powerModifier ?? -99) <= -1);
    m = blank();
    const earth = unit("landlord", owner, 1);
    m.boards = [[], [earth], []];
    m = cast(m, "concrete", owner, 1).after;
    m = {
      ...m,
      boards: m.boards.map((cs) =>
        cs.map((c) =>
          c.cardId === "concrete" ? { ...c, powerModifier: 20 } : c,
        ),
      ) as Match["boards"],
    };
    m = cast(m, "black-cowboy", enemy, 0).after;
    assert.equal(find(m, earth)?.lane, 1);
    assert.equal(find(m, earth)?.powerModifier, 2);
    assert(!kinds(m).includes("anchor"));
  });
  test(`${owner}: delayed arrival gifts consume once and respect element matching`, () => {
    for (const [id, kind, arrivalId] of [
      ["failedrapper", "verse", "og"],
      ["mural", "paint", "og"],
      ["icecream", "treat", "og"],
    ] as const) {
      let m = cast(blank(), id, owner).after;
      assert(kinds(m).includes(kind));
      const played = cast(m, arrivalId, owner);
      assert.equal(find(played.after, played.source)?.powerModifier, 2, id);
      assert(!kinds(played.after).includes(kind));
    }
    let m = cast(blank(), "honestthot", owner).after;
    const lane = m.creativeMarks!.find((x) => x.kind === "welcome")!.lane;
    const nonAir = cast(m, "og", owner, lane);
    assert(kinds(nonAir.after).includes("welcome"));
    const air = cast(nonAir.after, "snow", owner, lane); // Snow is Water; use Bboy's arrival type for the actual Air welcome below.
    const actualId = Object.keys(cards).find(
      (id) =>
        cards[id].type === "Air" &&
        !CREATIVE_KITS[id] &&
        id !== "bikelife" &&
        id !== "carmeet",
    )!;
    const delivered = cast(m, actualId, owner, lane);
    assert(!kinds(delivered.after).includes("welcome"));
    assert(air);
  });
  test(`${owner}: Fork and Drama resolve only on the next enemy character placement`, () => {
    let m = blank();
    const first = unit("og", enemy, 0),
      second = unit("og", enemy, 1, 1);
    m.boards = [[first], [second], []];
    m = cast(m, "chessregular", owner, 2).after;
    assert(kinds(m).includes("fork"));
    m = cast(m, "og", enemy, 0).after;
    assert.equal(find(m, first)?.powerModifier, 0);
    assert.equal(find(m, second)?.powerModifier, -2);
    assert(!kinds(m).includes("fork"));
    const demon = cast(blank(), "bbldemon", owner, 2);
    m = cast(demon.after, "og", enemy, 1).after;
    assert.equal(find(m, demon.source)?.powerModifier, 2);
    assert(!kinds(m).includes("drama"));
  });
  test(`${owner}: Mama Bear and Chair Guy retaliate once without damage loops`, () => {
    for (const id of ["baby", "juneteenth-chair-guy"]) {
      let m = blank();
      const target = unit("og", owner, 0);
      target.powerModifier = 10;
      m.boards = [[target], [], []];
      const setup = cast(m, id, owner);
      const attacked = cast(setup.after, "inmate-informant", enemy);
      m = attacked.after;
      assert((find(m, attacked.source)?.powerModifier ?? -99) <= -2);
      const again = cast(m, "inmate-informant", enemy);
      assert.equal(find(again.after, again.source)?.powerModifier, 0);
    }
  });
  test(`${owner}: Laundry queues a movement cleanse and Stoner Sr queues a welcome`, () => {
    for (const id of ["laundry", "stonersr"]) {
      let m = blank();
      const target = unit("cornball", owner, 0);
      target.statuses.silenced = true;
      m.boards = [[target], [], []];
      m = cast(m, id, owner).after;
      assert.equal(find(m, target)?.statuses.silenced, false);
      if (id === "laundry") {
        m = {
          ...m,
          boards: m.boards.map((cs) =>
            cs.map((c) =>
              c.instanceId === target.instanceId
                ? { ...c, statuses: { ...c.statuses, weakened: true } }
                : c,
            ),
          ) as Match["boards"],
        };
        m = cast(m, "break", owner).after;
        assert.equal(find(m, target)?.statuses.weakened, false);
        assert(!kinds(m).includes("cycle"));
      } else {
        const arrival = cast(m, "og", owner);
        assert.equal(find(arrival.after, arrival.source)?.powerModifier, 2);
        assert.equal(
          arrival.after.creativeMarks?.find((x) => x.kind === "chill")?.amount,
          1,
        );
      }
    }
  });
  test(`${owner}: Good Company shares external gains once and Hater cannot remove base Hands`, () => {
    let m = blank();
    const a = unit("cornball", owner, 0),
      b = unit("edgar", owner, 0);
    m.boards = [[a, b], [], []];
    m = cast(m, "bblnice", owner).after;
    m = cast(m, "cognac", owner).after;
    assert.equal(find(m, a)?.powerModifier, 2);
    assert.equal(find(m, b)?.powerModifier, 2);
    m = cast(m, "cognac", owner).after;
    assert.equal(find(m, b)?.powerModifier, 2);
    m = cast(blank(), "hater", owner).after;
    const grown = cast(m, "youngbull", enemy);
    assert.equal(
      find(grown.after, grown.source)?.powerModifier,
      1,
      "a new entrant does not count as an existing buff target",
    );
    m = cast(grown.after, "cognac", enemy).after;
    assert.equal(
      m.boards.flat().find((c) => c.cardId === "hater")?.powerModifier,
      1,
    );
  });
  test(`${owner}: gardener, Torta, Nigerian Father, and Incel have bounded round payoffs`, () => {
    let m = blank();
    const plant = unit("rastamon", owner, 0);
    m.boards = [[plant], [], []];
    m = cast(m, "gardener", owner).after;
    m = end(end(m));
    assert.equal(
      m.boards.flat().find((c) => c.cardId === "gardener")?.powerModifier,
      3,
    );
    assert(!kinds(m).includes("seed"));
    m = blank();
    const a = unit("landlord", owner, 0),
      b = unit("manman", owner, 0);
    m.boards = [[a, b], [], []];
    m = cast(m, "torta", owner).after;
    m = end(end(m));
    assert.equal(find(m, a)?.powerModifier, 2);
    assert.equal(find(m, b)?.powerModifier, 0);
    assert.equal(
      m.boards.flat().find((c) => c.cardId === "torta")?.powerModifier,
      2,
    );
    m = blank();
    const child = unit("edgar", owner, 0);
    m.boards = [[child], [], []];
    m = cast(m, "nigerian-father", owner).after;
    m = cast(m, "cognac", owner).after;
    m = cast(m, "cognac", owner).after;
    m = end(end(m));
    assert(find(m, child)?.statuses.protected);
    assert.equal(find(m, child)?.powerModifier, 5);
    const loner = cast(blank(), "incel", owner);
    m = end(end(end(loner.after)));
    assert.equal(find(m, loner.source)?.powerModifier, 4);
  });
  test(`${owner}: visitation and loyalty have actual return conditions`, () => {
    let m = blank();
    const guest = unit("cornball", owner, 1);
    m.boards = [[], [guest], []];
    m = cast(m, "divorceddad", owner).after;
    assert.equal(find(m, guest)?.lane, 0);
    m = end(end(m));
    assert.equal(find(m, guest)?.lane, 1);
    assert(!kinds(m).includes("visit"));
    m = blank();
    const regular = unit("cornball", owner, 0);
    m.boards = [[regular], [], []];
    m = cast(m, "ahki", owner).after;
    m = cast(m, "break", owner).after;
    assert.equal(find(m, regular)?.lane, 1);
    m = cast(m, "vibe", owner, 0).after;
    assert.equal(find(m, regular)?.powerModifier, 4);
    assert(!kinds(m).includes("loyalty"));
  });
  test(`${owner}: actual healing fulfills the promise; Abuela heals actual damage`, () => {
    let m = blank();
    const hurt = unit("og", owner, 0);
    hurt.powerModifier = -2;
    hurt.recoverableDamage = 2;
    m.boards = [[hurt], [], []];
    const promise = cast(m, "canopykeeper", owner);
    m = cast(promise.after, "abuela", owner).after;
    assert.equal(find(m, hurt)?.powerModifier, 2);
    assert.equal(find(m, promise.source)?.powerModifier, 1);
    assert(!kinds(m).includes("promise"));
  });
  test(`${owner}: Kingpin pays only after three distinct inmate carriers`, () => {
    let m = blank();
    const first = unit("inmate-crafty", owner, 0);
    m.boards = [[first], [], []];
    m = cast(m, "inmate-kingpin", owner).after;
    const second = cast(m, "inmate-informant", owner, 1);
    const third = cast(second.after, "inmate-contraband", owner, 2);
    assert(!kinds(third.after).includes("stash"));
    for (const target of [first, second.source, third.source])
      assert.equal(find(third.after, target)?.powerModifier, 2);
  });
  test(`${owner}: mayor and cashier issue local, expiring, minimum-one discounts`, () => {
    let m = blank();
    const rider = unit("cornball", owner, 0);
    m.boards = [[rider], [], []];
    m = cast(m, "midnightmayor", owner).after;
    const lane = m.creativeMarks!.find((x) => x.kind === "nomination")!.lane;
    m = cast(m, "break", owner).after;
    assert(m.discountTokens.some((x) => x.eligibility === "creative-local"));
    assert.equal(
      getLegalCardCost(m, owner, createCardInstance("og", owner), lane),
      3,
    );
    m = cast({ ...blank(), round: 4 }, "nightcashier", owner).after;
    m = cast(m, "edgar", owner).after;
    assert.equal(
      getLegalCardCost(m, owner, createCardInstance("og", owner), 0),
      3,
    );
    m = end(m);
    assert.equal(
      getLegalCardCost(m, owner, createCardInstance("og", owner), 0),
      3,
    );
    assert.equal(
      getLegalCardCost(m, owner, createCardInstance("cornball", owner), 0),
      1,
    );
  });
}
for (const owner of ["player", "cpu"] as const) {
  const enemy: Owner = owner === "player" ? "cpu" : "player";
  test(`${owner}: Group Project requires two different successful contributors`, () => {
    let m = cast(blank(), "dr-umah", owner, 2).after;
    const first = cast(m, "youngbull", owner, 0);
    m = first.after;
    assert.deepEqual(m.creativeMarks?.find((x) => x.kind === "project")?.seen, [
      first.source.instanceId,
    ]);
    const second = cast(m, "plug", owner, 1);
    m = second.after;
    assert(!kinds(m).includes("project"));
    assert.equal(find(m, first.source)?.powerModifier, 4);
    assert.equal(find(m, second.source)?.powerModifier, 3);
  });
  test(`${owner}: Foreman jobs require both assigned workers and pay once`, () => {
    let m = blank();
    const a = unit("streamer", owner, 0),
      b = unit("wiretap", owner, 0);
    m.boards = [[a, b], [], []];
    m = cast(m, "circuitcaptain", owner).after;
    assert(kinds(m).includes("jobs"));
    m = cast(m, "vibe", owner, 1).after;
    assert(kinds(m).includes("jobs"));
    m = cast(m, "break", owner, 0).after;
    assert(!kinds(m).includes("jobs"));
    assert.equal(find(m, a)?.powerModifier, 4);
    assert.equal(find(m, b)?.powerModifier, 3);
    assert.equal(m[owner === "player" ? "playerMotion" : "cpuMotion"], 8);
  });
  test(`${owner}: Coach retries a failed eligible entrance once, without replay loops`, () => {
    let m = blank();
    const trainee = unit("edgar", owner, 0);
    m.boards = [[trainee], [], []];
    m = cast(m, "cornercoach", owner, 0).after;
    m = { ...m, entranceHistory: [trainee.instanceId] };
    m = cast(m, "oz", owner, 1).after;
    assert(m.creativeMarks?.find((x) => x.kind === "coach")?.ready);
    m = cast(m, "cornball", owner, 0).after;
    assert.equal(find(m, trainee)?.powerModifier, 1);
    assert(!kinds(m).includes("coach"));
  });
  test(`${owner}: Bounty needs an actual kill by the owner, not merely leaving the board`, () => {
    let m = blank();
    const target = unit("rastamon", enemy, 1);
    m.boards = [[], [target], []];
    const cowboy = cast(m, "black-cowboy", owner);
    m = cowboy.after;
    assert(kinds(m).includes("bounty"));
    m = cast(m, "inmate-informant", owner).after;
    assert.equal(find(m, target), undefined);
    assert.equal(find(m, cowboy.source)?.powerModifier, 3);
    assert(!kinds(m).includes("bounty"));
  });
  test(`${owner}: Chain Reaction splashes only once on Burn damage`, () => {
    let m = blank();
    const a = unit("og", enemy, 0),
      b = unit("rastamon", enemy, 0);
    m.boards = [[a, b], [], []];
    m = cast(m, "redneck-evil", owner).after;
    assert(kinds(m).includes("primer"));
    m = end(m);
    assert(!kinds(m).includes("primer"));
    assert.equal(find(m, b), undefined);
    assert.equal(find(m, a)?.statuses.burnStacks, 0);
  });
  test(`${owner}: Skater route, Flight Plug pass, and Titan rally have bounded moves`, () => {
    const skater = cast(blank(), "og-skater", owner);
    const entrant = cast(skater.after, "og", owner);
    assert.equal(find(entrant.after, entrant.source)?.lane, 1);
    assert(!kinds(entrant.after).includes("route"));
    let m = blank();
    const air = unit("roaster", owner, 0);
    m.boards = [[air], [], []];
    m = cast(m, "slipstream", owner).after;
    m = cast(m, "break", owner).after;
    assert.equal(find(m, air)?.powerModifier, 2);
    assert(find(m, air)?.statuses.protected);
    assert(!kinds(m).includes("boarding"));
    m = blank();
    const a = unit("cornball", owner, 1),
      b = unit("cornball", owner, 2, 2);
    m.boards = [[], [a], [b]];
    const titan = cast(m, "partytitan", owner);
    assert.equal(find(titan.after, a)?.lane, 0);
    assert.equal(find(titan.after, b)?.lane, 0);
    assert.equal(find(titan.after, titan.source)?.powerModifier, 2);
  });
  test(`${owner}: Failed Athlete needs a later score reversal; Barber transfers actual bonus only`, () => {
    const athlete = cast(blank(), "failedathlete", owner);
    const m = cast(athlete.after, "og", enemy).after;
    assert.equal(find(m, athlete.source)?.powerModifier, 4);
    assert(find(m, athlete.source)?.statuses.protected);
    assert.equal(
      find(cast(m, "og", enemy).after, athlete.source)?.powerModifier,
      4,
    );
    const state = blank(),
      ally = unit("cornball", owner, 0),
      foe = unit("og", enemy, 0);
    foe.powerModifier = 3;
    state.boards = [[ally, foe], [], []];
    const trimmed = cast(state, "barber", owner).after;
    assert.equal(find(trimmed, foe)?.powerModifier, 1);
    assert.equal(find(trimmed, ally)?.powerModifier, 2);
  });
}
for (const owner of ["player", "cpu"] as const) {
  const enemy: Owner = owner === "player" ? "cpu" : "player";
  test(`${owner}: a deferred harmful status cannot pay Dark disruption rewards early`, () => {
    let m = blank();
    const target = unit("og", owner, 0),
      gamer = unit("gamer", enemy, 1);
    target.powerModifier = 10;
    gamer.powerModifier = 10;
    m.boards = [[target], [gamer], []];
    m = cast(m, "lawyer", owner).after;
    const attack = cast(m, "redpill", enemy);
    m = attack.after;
    assert.equal(find(m, target)?.statuses.weakened, false);
    assert.equal(find(m, attack.source)?.powerModifier, 0);
    m = end(m);
    assert.equal(find(m, target)?.statuses.weakened, true);
    assert.equal(find(m, attack.source)?.powerModifier, 2);
  });
  test(`${owner}: final-round finishers resolve before scoring rather than waiting for a nonexistent round`, () => {
    let m = { ...blank(), round: 6 };
    const enemyCard = unit("og", enemy, 0);
    m.boards = [[enemyCard], [], []];
    const h = cast(m, "hooper", owner);
    m = end(h.after);
    assert.equal(m.phase, "complete");
    assert.equal(find(m, enemyCard)?.powerModifier, -3);
    assert.equal(find(m, h.source)?.powerModifier, 1);
    const seed = cast({ ...blank(), round: 6 }, "gardener", owner);
    m = end(seed.after);
    assert.equal(find(m, seed.source)?.powerModifier, 3);
  });
  test(`${owner}: trimming bonus Hands never becomes damage recovery credit`, () => {
    let m = blank();
    const target = unit("og", enemy, 0),
      recipient = unit("cornball", owner, 0);
    target.powerModifier = 3;
    m.boards = [[target, recipient], [], []];
    m = cast(m, "barber", owner).after;
    assert.equal(find(m, target)?.powerModifier, 1);
    assert.equal(find(m, target)?.recoverableDamage ?? 0, 0);
  });
}
for (const owner of ["player", "cpu"] as const) {
  const enemy: Owner = owner === "player" ? "cpu" : "player";
  test(`${owner}: public forecasts use placement district even when the entrant moves or dies`, () => {
    let m = cast(blank(), "bbldemon", owner, 2).after;
    m = cast(m, "rent-a-cop", owner, 0).after;
    const entrant = createCardInstance("bikelife", enemy, "fragile");
    entrant.basePower = 1;
    m = playTurnCard(
      {
        ...m,
        phase: enemy === "player" ? "player" : "cpu-reveal",
        [enemy === "player" ? "playerHand" : "cpuHand"]: [entrant],
        [enemy === "player" ? "playerMotion" : "cpuMotion"]: 9,
      },
      enemy,
      entrant.instanceId,
      0,
    );
    assert(!kinds(m).includes("drama"));
    assert(!kinds(m).includes("warning"));
    assert.equal(
      m.boards.flat().find((c) => c.cardId === "bbldemon")?.powerModifier,
      0,
      "playing into Drama is not dodging it by moving",
    );
    assert.equal(find(m, entrant), undefined);
  });
}
for (const owner of ["player", "cpu"] as const) {
  test(`${owner}: trained comeback rewards activate only once on the actual payoff`, () => {
    const enemy: Owner = owner === "player" ? "cpu" : "player";
    let m = blank();
    m.abilityUpgradeSnapshot = createAbilityUpgradeSnapshot(
      owner === "player" ? ["failedathlete"] : [],
      owner === "cpu" ? ["failedathlete"] : [],
      { [owner]: { failedathlete: { level: 8, xp: 2800, moveTier: 3 } } },
    );
    const athlete = cast(m, "failedathlete", owner);
    assert.equal(find(athlete.after, athlete.source)?.powerModifier, 0);
    m = cast(athlete.after, "og", enemy).after;
    assert.equal(find(m, athlete.source)?.powerModifier, 7);
    assert.equal(
      m.effectLog.filter(
        (e) => e.abilityMetadata?.sourceCardId === "failedathlete",
      ).length,
      3,
    );
    m = cast(m, "og", enemy).after;
    assert.equal(
      m.effectLog.filter(
        (e) => e.abilityMetadata?.sourceCardId === "failedathlete",
      ).length,
      3,
    );
  });
}
for (const owner of ["player", "cpu"] as const) {
  test(`${owner}: Dance Captain pays a different dancer following the first destination once`, () => {
    let m = blank();
    const captain = unit("dancecaptain", owner, 2),
      dancer = unit("break", owner, 0),
      local = unit("cornball", owner, 1);
    m.boards = [[dancer], [local], [captain]];
    m = cast(m, "bboy", owner, 0).after;
    assert.equal(find(m, captain)?.creativeLane, 1);
    m = cast(m, "vibe", owner, 1).after;
    assert.equal(find(m, dancer)?.lane, 1);
    assert.equal(find(m, dancer)?.powerModifier, 3);
    assert.equal(find(m, captain)?.creativeCount, 1);
  });
  test(`${owner}: Busker carries unfinished Tips across rounds and consumes two on payment`, () => {
    let m = blank();
    const busker = unit("busker", owner, 0),
      first = unit("cornball", owner, 1),
      second = unit("cornball", owner, 2, 1);
    m.boards = [[busker], [first], [second]];
    m = cast(m, "vibe", owner, 0).after;
    assert.equal(find(m, busker)?.creativeCount, 1);
    m = end(m);
    m = {
      ...m,
      boards: m.boards.map((cs) =>
        cs.filter((c) => c.cardId !== "vibe"),
      ) as Match["boards"],
    };
    m = cast(m, "vibe", owner, 0).after;
    assert.equal(find(m, busker)?.creativeCount, 0);
    assert(
      m.boards[0].some((c) => c.cardId === "cornball" && c.powerModifier >= 3),
    );
  });
}
for (const owner of ["player", "cpu"] as const) {
  test(`${owner}: Good Company also shares round-end growth and lane-event buffs`, () => {
    let m = blank();
    const a = unit("cornball", owner, 0),
      b = unit("edgar", owner, 0);
    a.statuses.boosted = true;
    m.boards = [[a, b], [], []];
    m = cast(m, "bblnice", owner, 1).after;
    m = end(m);
    assert.equal(find(m, a)?.powerModifier, 1);
    assert.equal(find(m, b)?.powerModifier, 1);
    const concert = cast(m, "the-concert", owner, 0).after;
    assert.equal(find(concert, a)?.powerModifier, 2);
    assert.equal(find(concert, b)?.powerModifier, 3);
  });
}
for (const owner of ["player", "cpu"] as const) {
  const enemy: Owner = owner === "player" ? "cpu" : "player";
  test(`${owner}: audit - Verse rewards the deployment, not the ally it pulls in`, () => {
    let m = blank();
    const guest = unit("cornball", owner, 1);
    m.boards = [[], [guest], []];
    m = cast(m, "failedrapper", owner).after;
    const pull = cast(m, "vibe", owner);
    m = pull.after;
    assert.equal(find(m, guest)?.powerModifier, 1);
    assert.equal(find(m, pull.source)?.powerModifier, 3);
    assert(!kinds(m).includes("verse"));
  });
  test(`${owner}: audit - Dance Captain rejects a non-dancer following the route`, () => {
    let m = blank();
    const captain = unit("dancecaptain", owner, 2),
      dancer = unit("break", owner, 0),
      visitor = unit("cornball", owner, 0),
      local = unit("cornball", owner, 1, 1);
    m.boards = [[dancer, visitor], [local], [captain]];
    m = cast(m, "bboy", owner).after;
    assert.equal(find(m, captain)?.creativeLane, 1);
    m = cast(m, "vibe", owner, 1).after;
    assert.equal(find(m, visitor)?.lane, 1);
    assert.equal(find(m, visitor)?.powerModifier, 1);
    assert.equal(find(m, captain)?.creativeCount, 0);
  });
  test(`${owner}: audit - Ahki retains his return reward after departure without paying it`, () => {
    let m = blank();
    const guest = unit("cornball", owner, 0);
    m.boards = [[guest], [], []];
    m = cast(m, "ahki", owner).after;
    m = cast(m, "break", owner).after;
    assert.equal(find(m, guest)?.powerModifier, 1);
    assert.equal(find(m, guest)?.lane, 1);
    assert(m.creativeMarks?.find((x) => x.kind === "loyalty")?.ready);
  });
  test(`${owner}: audit - Chess needs two enemy districts at deployment, not later`, () => {
    let m = blank();
    m.boards = [[unit("og", enemy, 0)], [], []];
    const chess = cast(m, "chessregular", owner, 2);
    m = chess.after;
    assert(!kinds(m).includes("fork"));
    m = cast(m, "og", enemy, 1).after;
    assert(!kinds(m).includes("fork"));
    assert.equal(find(m, chess.source)?.powerModifier, 0);
  });
  test(`${owner}: audit - Mall Rules ignores stationary deployments, then consumes on movement`, () => {
    let m = cast(blank(), "rent-a-cop", owner).after;
    const stationary = cast(m, "og", enemy);
    m = stationary.after;
    assert(kinds(m).includes("warning"));
    assert.equal(find(m, stationary.source)?.powerModifier, 0);
    const moving = cast(m, "bikelife", enemy);
    m = moving.after;
    assert(!kinds(m).includes("warning"));
    assert((find(m, moving.source)?.powerModifier ?? -99) < 0);
  });
}
