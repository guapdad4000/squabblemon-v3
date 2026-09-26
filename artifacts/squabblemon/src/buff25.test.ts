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
  suppressMatchPresentationEvents,
  getMatchRoundLimit,
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
  test(`${owner}: Coach records failed entrances without logs and retains unsuccessful practice`, () => {
    for (const fast of [false, true]) {
      let m = fast ? suppressMatchPresentationEvents(blank()) : blank();
      const trainee = cast(m, "edgar", owner);
      m = trainee.after;
      m = cast(m, "cornercoach", owner).after;
      assert(m.creativeMarks?.find((x) => x.kind === "coach")?.ready);
      m = cast(m, "og", owner, 1).after;
      assert(kinds(m).includes("coach"));
      m = cast(m, "cornball", owner).after;
      assert.equal(find(m, trainee.source)?.powerModifier, 2);
      assert(!kinds(m).includes("coach"));
      m = cast(m, "cornball", owner, 2).after;
      assert.equal(find(m, trainee.source)?.powerModifier, 2);
    }
  });
  test(`${owner}: Cashier pays now or cashes out at actual final round`, () => {
    for (const round of [4, 6]) {
      let m = cast({ ...blank(), round }, "nightcashier", owner).after;
      const customer = cast(m, "cornball", owner);
      m = customer.after;
      assert(!kinds(m).includes("receipt"));
      if (round === 6) {
        assert.equal(find(m, customer.source)?.powerModifier, 2);
        assert.equal(m.discountTokens.length, 0);
      } else
        assert.equal(
          getLegalCardCost(m, owner, createCardInstance("og", owner), 0),
          3,
        );
    }
    let m = cast({ ...blank(), round: 6 }, "the-after-party", owner).after;
    assert.equal(getMatchRoundLimit(m), 7);
    m = cast(m, "nightcashier", owner).after;
    m = cast(m, "cornball", owner).after;
    assert.equal(
      getLegalCardCost(m, owner, createCardInstance("og", owner), 0),
      3,
    );
  });
  test(`${owner}: Barber selects bonus Hands and respects shields without damage credit`, () => {
    let m = blank();
    const ally = unit("edgar", owner, 0),
      strong = unit("og", enemy, 0),
      bonus = { ...unit("cornball", enemy, 0), powerModifier: 2 };
    m.boards = [[ally, strong, bonus], [], []];
    m = cast(m, "barber", owner).after;
    assert.equal(find(m, bonus)?.powerModifier, 0);
    assert.equal(find(m, ally)?.powerModifier, 2);
    assert.equal(find(m, bonus)?.recoverableDamage ?? 0, 0);
  });
  test(`${owner}: Trick sponsors the next arrival and rewards statuses but not blocked statuses`, () => {
    for (const shield of [false, true]) {
      let m = blank();
      const victim = unit("og", enemy, 0);
      m.boards = [[victim], [], []];
      if (shield) m = cast(m, "bustdown", enemy).after;
      m = cast(m, "mr-trick", owner).after;
      const guest = cast(m, "snow", owner);
      m = guest.after;
      assert.equal(
        m.creativeMarks?.find((x) => x.kind === "tab")?.amount,
        shield ? 0 : 1,
      );
      m = end(m);
      assert.equal(find(m, guest.source)?.powerModifier, shield ? 0 : 2);
    }
  });
  test(`${owner}: Stoner always welcomes and a cleanse passes a smaller token exactly once`, () => {
    for (const dirty of [false, true]) {
      let m = blank();
      const target = unit("cornball", owner, 0);
      target.statuses.silenced = dirty;
      m.boards = [[target], [], []];
      m = cast(m, "stonersr", owner).after;
      const first = cast(m, "og", owner);
      m = first.after;
      assert.equal(find(m, first.source)?.powerModifier, 2);
      const second = cast(m, "bodegacat", owner);
      m = second.after;
      assert.equal(find(m, second.source)?.powerModifier, dirty ? 1 : 0);
      assert(!kinds(m).includes("chill"));
    }
  });
  test(`${owner}: Busker pays two distinct visitors in one round, never twice that round`, () => {
    let m = blank();
    const busker = unit("busker", owner, 0),
      a = unit("cornball", owner, 1),
      b = unit("cornball", owner, 2, 1);
    m.boards = [[busker], [a], [b]];
    m = cast(m, "vibe", owner).after;
    m = {
      ...m,
      boards: m.boards.map((cs) =>
        cs.filter((c) => c.cardId !== "vibe"),
      ) as Match["boards"],
    };
    m = cast(m, "vibe", owner).after;
    assert.equal(find(m, busker)?.creativeCount, 0);
    assert.equal(find(m, busker)?.creativeRound, m.round);
    assert(
      m.boards[0].some((c) => c.cardId === "cornball" && c.powerModifier >= 3),
    );
  });
  test(`${owner}: Athlete deployed behind waits for a later enemy and only pays once`, () => {
    let m = blank();
    m.boards = [[unit("og", enemy, 0)], [], []];
    const athlete = cast(m, "failedathlete", owner);
    m = athlete.after;
    assert.equal(find(m, athlete.source)?.powerModifier, 0);
    m = cast(m, "og", enemy).after;
    assert.equal(find(m, athlete.source)?.powerModifier, 4);
    m = cast(m, "og", enemy).after;
    assert.equal(find(m, athlete.source)?.powerModifier, 4);
  });
  test(`${owner}: Mayor protects the qualifying mover immediately, and ATL pays theft or fallback`, () => {
    let m = blank();
    m.boards = [[unit("cornball", owner, 0)], [], []];
    m = cast(m, "midnightmayor", owner).after;
    m = cast(m, "break", owner).after;
    const mover = m.boards.flat().find(c => c.cardId === "cornball")!;
    assert.equal(mover.lane, 1);
    assert(mover.statuses.protected);
    assert(!kinds(m).includes("key"));
    assert(!kinds(m).includes("nomination"));
    assert.equal(m.discountTokens.length, 1);
    m = cast(blank(), "atl-scammer", owner).after;
    m = end(end(m));
    assert.equal(m.discountTokens.length, 1);
    assert(!kinds(m).includes("claim"));
    m = cast(blank(), "atl-scammer", owner).after;
    m = cast(m, "energydrink", enemy).after;
    m = end(end(m));
    assert.equal(m.discountTokens.length, 0);
  });
  test(`${owner}: Tattoo and Hair Stylist reward the first move only`, () => {
    for (const id of ["tattoo-artist", "hair-stylist"]) {
      let m = blank();
      const target = unit("cornball", owner, 0);
      target.statuses.silenced = true;
      m.boards = [[target], [], []];
      m = cast(m, id, owner).after;
      m = cast(m, "break", owner).after;
      assert.equal(find(m, target)?.powerModifier, 2);
      assert(!kinds(m).includes(id === "hair-stylist" ? "blowout" : "ink"));
      if (id === "tattoo-artist") assert(find(m, target)?.statuses.protected);
    }
  });
  test(`${owner}: Chair reacts to a blocked hit once, and Watch only pays for its own ward`, () => {
    let m = blank();
    const ally = unit("cornball", owner, 0);
    m.boards = [[ally], [], []];
    m = cast(m, "bustdown", owner).after;
    m = cast(m, "juneteenth-chair-guy", owner).after;
    const attacker = cast(m, "inmate-informant", enemy);
    m = attacker.after;
    // Informant attacks strongest (Chair), so use a stronger protected ally for the shield scenario.
    m = blank();
    const big = { ...unit("og", owner, 0), powerModifier: 5 };
    m.boards = [[big], [], []];
    m = cast(m, "bustdown", owner).after;
    m = cast(m, "juneteenth-chair-guy", owner).after;
    const hit = cast(m, "inmate-informant", enemy);
    m = hit.after;
    assert.equal(find(m, big)?.powerModifier, 7);
    assert(!find(m, hit.source));
    assert(
      m.boards.flat().find((c) => c.cardId === "juneteenth-chair-guy")
        ?.creativeUsed?.chair,
    );
    assert(!kinds(m).includes("watch"));
    m = blank();
    m.boards = [[big], [], []];
    m = cast(m, "workboots", owner).after;
    m = cast(m, "bustdown", owner).after;
    m = cast(m, "inmate-informant", enemy).after;
    assert.equal(find(m, big)?.powerModifier, 7);
  });
  test(`${owner}: Lawyer only earns legal fees after dismissing a pending status`, () => {
    let m = blank();
    const client = unit("og", owner, 0);
    m.boards = [[client], [], []];
    m = cast(m, "lawyer", owner).after;
    m = cast(m, "snow", enemy).after;
    assert(kinds(m).includes("pending-appeal"));
    assert.equal(m.discountTokens.length, 0);
    m = cast(m, "foodz", owner, 1).after;
    assert(!kinds(m).includes("pending-appeal"));
    assert.equal(m.discountTokens.length, 1);
    m = cast(m, "foodz", owner, 2).after;
    assert.equal(m.discountTokens.length, 1);
  });
  test(`${owner}: First Aid prevents lethal damage once without healing or consuming on friendly loss`, () => {
    let m = blank();
    const target = unit("cornball", owner, 0);
    m.boards = [[target], [], []];
    m = cast(m, "firstaid", owner).after;
    m = cast(m, "inmate-informant", enemy).after;
    assert(find(m, target));
    assert.equal(find(m, target)?.powerModifier, 0);
    assert(!kinds(m).includes("kit"));
    assert.equal(find(m, target)?.recoverableDamage ?? 0, 0);
    m = cast(m, "inmate-informant", enemy).after;
    assert(!find(m, target));
  });
  test(`${owner}: Crossing ignores one movement Lock without clearing it`, () => {
    let m = blank();
    const target = unit("cornball", owner, 0);
    target.statuses.locked = true;
    m.boards = [[target], [], []];
    m = cast(m, "crossingguard", owner).after;
    m = cast(m, "break", owner).after;
    assert.equal(find(m, target)?.lane, 1);
    assert(find(m, target)?.statuses.locked);
    assert(!kinds(m).includes("crossing"));
    m = cast(m, "vibe", owner, 2).after;
    assert.equal(find(m, target)?.lane, 1);
  });
  test(`${owner}: Boombox has one movement Encore, not a deployment Encore`, () => {
    let m = blank();
    const rider = unit("cornball", owner, 1);
    m.boards = [[], [rider], []];
    m = cast(m, "boombox", owner).after;
    m = cast(m, "edgar", owner).after;
    assert(kinds(m).includes("encore"));
    m = cast(m, "vibe", owner).after;
    assert.equal(find(m, rider)?.powerModifier, 2);
    assert(!kinds(m).includes("encore"));
  });
  test(`${owner}: Torta pairs with herself and Concrete chooses a single reward branch`, () => {
    let m = blank();
    const ally = unit("landlord", owner, 0);
    m.boards = [[ally], [], []];
    const torta = cast(m, "torta", owner);
    m = end(end(torta.after));
    assert.equal(find(m, ally)?.powerModifier, 2);
    assert.equal(find(m, torta.source)?.powerModifier, 2);
    m = blank();
    m.boards = [[ally], [], []];
    m = cast(m, "concrete", owner).after;
    m = end(end(m));
    assert.equal(find(m, ally)?.powerModifier, 1);
    assert(!kinds(m).includes("anchor"));
  });
  test(`${owner}: Abuela healthy lunch heals actual subsequent loss only once`, () => {
    let m = blank();
    const ally = { ...unit("og", owner, 0), powerModifier: 3 };
    m.boards = [[ally], [], []];
    m = cast(m, "abuela", owner).after;
    assert(kinds(m).includes("lunch"));
    m = cast(m, "inmate-informant", enemy).after;
    assert(kinds(m).includes("lunch")); // ward absorbs first
    m = cast(m, "inmate-informant", enemy).after;
    assert.equal(find(m, ally)?.powerModifier, 3);
    assert(!kinds(m).includes("lunch"));
  });
  test(`${owner}: STUD protects his partner only after a successful paired escape`, () => {
    let m = blank();
    const ally = { ...unit("og", owner, 0), powerModifier: 4 };
    m.boards = [[ally], [], []];
    const stud = cast(m, "stud", owner);
    m = cast(stud.after, "inmate-informant", enemy).after;
    assert.equal(find(m, ally)?.lane, 1);
    assert.equal(find(m, stud.source)?.lane, 1);
    assert(find(m, ally)?.statuses.protected);
  });
  test(`${owner}: Kingpin pays partial progress without raising the completed reward`, () => {
    let m = blank();
    const a = unit("inmate-crafty", owner, 0);
    m.boards = [[a], [], []];
    m = cast(m, "inmate-kingpin", owner).after;
    assert.equal(find(m, a)?.powerModifier, 1);
    const b = cast(m, "inmate-informant", owner, 1);
    m = b.after;
    assert.equal(find(m, b.source)?.powerModifier, 1);
    const c = cast(m, "inmate-contraband", owner, 2);
    m = c.after;
    for (const x of [a, b.source, c.source])
      assert.equal(find(m, x)?.powerModifier, 2);
  });
  test(`${owner}: Nigerian Father tutors first, then requires a further two Hands`, () => {
    let m = blank();
    const child = unit("cornball", owner, 0);
    m.boards = [[child], [], []];
    m = cast(m, "nigerian-father", owner).after;
    assert.equal(find(m, child)?.powerModifier, 1);
    m = cast(m, "cognac", owner).after;
    m = end(end(m));
    assert.equal(find(m, child)?.powerModifier, 5);
    assert(find(m, child)?.statuses.protected);
  });
  test(`${owner}: Nerd reveals a hand card only on disabling an active ongoing ability`, () => {
    for (const protectedTarget of [false, true]) {
      let m = blank();
      const target = unit("stockz", enemy, 0);
      m.boards = [[target], [], []];
      if (protectedTarget) m = cast(m, "bustdown", enemy).after;
      const hidden = createCardInstance("og", enemy, "hidden");
      m = { ...m, [enemy === "player" ? "playerHand" : "cpuHand"]: [hidden] };
      m = cast(m, "nerd", owner).after;
      assert.equal(
        m.effectLog.some((e) => e.note.includes("Read the source:")),
        !protectedTarget,
      );
    }
  });
  test(`${owner}: Baby follows family only once and does not teleport through a full district`, () => {
    let m = blank();
    const child = unit("cornball", owner, 0);
    m.boards = [[child], [], []];
    const mother = cast(m, "baby", owner);
    m = cast(mother.after, "break", owner).after;
    assert.equal(find(m, child)?.lane, 1);
    assert.equal(find(m, mother.source)?.lane, 1);
    assert(!kinds(m).includes("follow-family"));
    m = cast(m, "break", owner, 1).after;
    assert.equal(find(m, mother.source)?.lane, 1);
  });
}
for (const owner of ["player", "cpu"] as const) {
  const enemy: Owner = owner === "player" ? "cpu" : "player";
  test(`${owner}: kit ignores friendly damage and bonus trimming, then reduces enemy Burn`, () => {
    let m = blank();
    const ally = { ...unit("og", owner, 0), powerModifier: 3 };
    m.boards = [[ally], [], []];
    m = cast(m, "firstaid", owner).after;
    m = cast(m, "corruptpastor", owner).after;
    assert(kinds(m).includes("kit"));
    assert.equal(find(m, ally)?.powerModifier, 2);
    m = cast(m, "barber", enemy).after;
    assert(kinds(m).includes("kit"));
    assert.equal(find(m, ally)?.powerModifier, 0);
    m = cast(m, "cornball", enemy).after;
    assert(kinds(m).includes("kit"));
    m = end(m);
    assert(!kinds(m).includes("kit"));
    assert.equal(find(m, ally)?.powerModifier, 0);
  });
  test(`${owner}: Janitor's reversal preserves the kit for the next actual hit`, () => {
    let m = blank();
    const ally = unit("og", owner, 0);
    m.boards = [[ally], [], []];
    m = cast(m, "firstaid", owner).after;
    m = cast(m, "janitor", owner).after;
    m = cast(m, "inmate-informant", enemy).after;
    assert(kinds(m).includes("kit"));
    assert.equal(find(m, ally)?.powerModifier, 2);
    m = cast(m, "inmate-informant", enemy).after;
    assert(!kinds(m).includes("kit"));
    assert.equal(find(m, ally)?.powerModifier, 2);
  });
  test(`${owner}: Trick waits for appealed status to actually land and pays at that round end`, () => {
    let m = blank();
    const client = unit("og", enemy, 0);
    m.boards = [[client], [], []];
    m = cast(m, "lawyer", enemy).after;
    m = cast(m, "mr-trick", owner).after;
    const guest = cast(m, "snow", owner);
    m = guest.after;
    assert.equal(m.creativeMarks?.find((x) => x.kind === "tab")?.amount, 0);
    assert(!find(m, client)?.statuses.frozen);
    m = end(m);
    assert(find(m, client)?.statuses.frozen);
    assert.equal(find(m, guest.source)?.powerModifier, 2);
    assert(!kinds(m).includes("tab"));
  });
  test(`${owner}: Safe Crossing cannot overfill a district and its permit survives failed movement`, () => {
    let m = blank();
    const child = unit("cornball", owner, 0);
    child.statuses.locked = true;
    m.boards = [
      [child],
      Array.from({ length: 4 }, (_, i) => unit("og", owner, 1, i)),
      Array.from({ length: 4 }, (_, i) => unit("og", owner, 2, i)),
    ];
    m = cast(m, "crossingguard", owner).after;
    m = cast(m, "break", owner).after;
    assert.equal(find(m, child)?.lane, 0);
    assert(kinds(m).includes("crossing"));
    assert(
      m.boards.every((cs) => cs.filter((c) => c.owner === owner).length <= 4),
    );
  });
  test(`${owner}: Baby does not spend her follow when family takes the destination's final slot`, () => {
    let m = blank();
    const child = unit("cornball", owner, 0);
    m.boards = [
      [child],
      Array.from({ length: 3 }, (_, i) => unit("cornball", owner, 1, i + 1)),
      Array.from({ length: 4 }, (_, i) => unit("og", owner, 2, i)),
    ];
    const mother = cast(m, "baby", owner);
    m = cast(mother.after, "break", owner).after;
    assert.equal(find(m, child)?.lane, 1);
    assert.equal(find(m, mother.source)?.lane, 0);
    assert(kinds(m).includes("follow-family"));
  });
}
for (const owner of ["player", "cpu"] as const) {
  const enemy: Owner = owner === "player" ? "cpu" : "player";
  test(`${owner}: Nerd recognizes Wifey's legacy passive text while bypassing her guard`, () => {
    let m = cast(blank(), "wifey", enemy).after;
    m = {
      ...m,
      [enemy === "player" ? "playerHand" : "cpuHand"]: [
        createCardInstance("og", enemy),
      ],
    };
    m = cast(m, "nerd", owner).after;
    assert(m.effectLog.some((e) => e.note.includes("Read the source:")));
  });
  test(`${owner}: a Wifey block does not consume an unrelated revenge mark`, () => {
    let m = blank();
    const ally = { ...unit("og", owner, 0), powerModifier: 3 };
    m.boards = [[ally], [], []];
    m = cast(m, "lebron-james", owner).after;
    m = {
      ...m,
      timedEffects: [],
      boards: m.boards.map((cs) =>
        cs.map((c) => ({
          ...c,
          statuses: { ...c.statuses, protected: false },
        })),
      ) as Match["boards"],
    };
    m = cast(m, "wifey", owner).after;
    m = cast(m, "inmate-informant", enemy).after;
    assert(kinds(m).includes("revenge"));
  });
}
for (const owner of ["player", "cpu"] as const) {
  const enemy: Owner = owner === "player" ? "cpu" : "player";
  test(`${owner}: STUD protects the surviving partner when neither district has two spaces`, () => {
    let m = blank();
    const ally = { ...unit("og", owner, 0), powerModifier: 4 };
    m.boards = [
      [ally],
      Array.from({ length: 3 }, (_, i) => unit("og", owner, 1, i)),
      Array.from({ length: 3 }, (_, i) => unit("og", owner, 2, i)),
    ];
    const stud = cast(m, "stud", owner);
    m = cast(stud.after, "inmate-informant", enemy).after;
    assert.equal(find(m, ally)?.lane, 0);
    assert.equal(find(m, stud.source)?.lane, 0);
    assert(find(m, ally)?.statuses.protected);
  });
}
