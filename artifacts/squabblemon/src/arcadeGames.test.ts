import test from "node:test";
import assert from "node:assert/strict";
import {
  createArcadeRun,
  applyArcadeAction,
  arcadeRewards,
  arcadePeriod,
  arcadeReset,
  OPPOSITE,
  blockCanAttack,
  type GirlRun,
  type MarketRun,
  type BlockRun,
} from "@workspace/squabblemon-engine/arcadeGames";
const make = (
  kind: "girl-fade" | "fade-market" | "block-takeover",
  choice = 0,
) => createArcadeRun(kind, "run", "2026-10-06", 17, 1000, choice);
test("boxing telegraph enforces timing, opposite counters win six fights, input remains immutable", () => {
  for (let choice = 0; choice < 3; choice++) {
    let run = make("girl-fade", choice) as GirlRun;
    let n = 1000;
    while (run.phase === "active") {
      const original = structuredClone(run);
      run = applyArcadeAction(run, { type: "ready" }, (n += 100)) as GirlRun;
      assert.equal(original.box.stage, "ready");
      assert.throws(
        () =>
          applyArcadeAction(
            run,
            {
              type: "pattern",
              directions: run.box.pattern.map((d) => OPPOSITE[d]),
            },
            run.box.opensAt - 1,
          ),
        /Watch/,
      );
      run = applyArcadeAction(
        run,
        {
          type: "pattern",
          directions: run.box.pattern.map((d) => OPPOSITE[d]),
        },
        (n = run.box.opensAt + 100),
      ) as GirlRun;
      assert.equal(run.health, 100);
    }
    assert.equal(run.result, "win");
    assert.equal(run.box.wins, 6);
    assert.equal(arcadeRewards(run).packTickets, 2);
    assert.throws(
      () => applyArcadeAction(run, { type: "ready" }, n),
      /finished/,
    );
  }
});
test("matching attacks and missed timers cause hits and defeat, partial early patterns are rejected", () => {
  let run = make("girl-fade") as GirlRun,
    n = 1000;
  run = applyArcadeAction(run, { type: "ready" }, n) as GirlRun;
  assert.throws(
    () =>
      applyArcadeAction(
        run,
        { type: "pattern", directions: [] },
        run.box.opensAt,
      ),
    /Finish/,
  );
  run = applyArcadeAction(
    run,
    { type: "pattern", directions: run.box.pattern },
    (n = run.box.opensAt),
  ) as GirlRun;
  assert.equal(run.health, 76);
  assert.equal(run.box.hits, 0);
  while (run.phase === "active") {
    run = applyArcadeAction(run, { type: "ready" }, (n += 100)) as GirlRun;
    run = applyArcadeAction(
      run,
      { type: "pattern", directions: [] },
      (n = run.box.deadline + 400),
    ) as GirlRun;
  }
  assert.equal(run.result, "loss");
  assert.equal(run.health, 0);
  assert.equal(arcadeRewards(run).softCurrency, 0);
});
test("market advances only at accepted beats, moves cashier, restocks all five power-ups and eventually loses to breaches", () => {
  let run = make("fade-market") as MarketRun,
    n = 1000;
  assert.throws(
    () =>
      applyArcadeAction(run, { type: "duty", aim: 0, stockLane: 0 }, n + 399),
    /advance/,
  );
  assert.throws(
    () =>
      applyArcadeAction(run, { type: "duty", aim: 5, stockLane: 0 }, n + 500),
    /five/,
  );
  const stocked = new Set<number>();
  for (let lane = 0; lane < 5; lane++)
    for (let i = 0; i < 10; i++) {
      const target = [...run.market.enemies].sort(
        (a, b) => b.position - a.position,
      )[0];
      run = applyArcadeAction(
        run,
        { type: "duty", aim: target?.lane ?? 2, stockLane: lane },
        (n += 700),
      ) as MarketRun;
      if (run.market.restock !== null) stocked.add(run.market.restock);
    }
  assert.equal(stocked.size, 5);
  assert.ok(run.market.kills > 0);
  assert.ok(run.market.power > 4);
  assert.ok(run.market.wave >= 3);
  assert.ok(arcadeRewards(run).softCurrency > 0);
  assert.equal(arcadeRewards(run).packTickets, 1);
  let ticks = 0;
  while (run.phase === "active" && ticks++ < 500)
    run = applyArcadeAction(
      run,
      { type: "duty", aim: 0, stockLane: 1 },
      (n += 700),
    ) as MarketRun;
  assert.equal(run.result, "loss");
  assert.ok(arcadeRewards(run).softCurrency <= 600);
});
test("block adjacency and HQ gate protect progression; raids and fortification resolve deterministically", () => {
  const run = make("block-takeover") as BlockRun;
  assert.equal(blockCanAttack(run, 0), false);
  assert.equal(blockCanAttack(run, 3), true);
  assert.throws(
    () => applyArcadeAction(run, { type: "attack", tile: 0 }, 1500),
    /neighboring/,
  );
  const fortified = applyArcadeAction(
    run,
    { type: "defend", tile: 6 },
    1500,
  ) as BlockRun;
  assert.equal(fortified.block.tiles[6].defense, 10);
  assert.equal(run.block.tiles[6].defense, 8);
  const captured = applyArcadeAction(
    run,
    { type: "attack", tile: 3 },
    1500,
  ) as BlockRun;
  assert.equal(captured.block.captured, 1);
  assert.equal(arcadeRewards(captured).softCurrency, 25);
  const recapture = structuredClone(captured);
  recapture.block.tiles[3] = { owner: "rival", defense: 1, captured: true };
  recapture.block.threat = 6;
  const next = applyArcadeAction(
    recapture,
    { type: "attack", tile: 3 },
    2000,
  ) as BlockRun;
  assert.equal(next.block.captured, 1);
  assert.equal(arcadeRewards(next).softCurrency, 25);
});
test("UTC daily and Monday weekly resets do not depend on local timezone", () => {
  const sun = new Date("2026-10-11T23:59:59Z");
  assert.equal(arcadePeriod("block-takeover", sun), "2026-10-05");
  assert.equal(arcadeReset("block-takeover", sun), "2026-10-12T00:00:00.000Z");
  assert.equal(arcadeReset("girl-fade", sun), "2026-10-12T00:00:00.000Z");
});

test("every crew can win a complete takeover within the turn limit without counting its starting safehouse as a capture", () => {
  for (let crew = 0; crew < 3; crew++) {
    let run = make("block-takeover", crew) as BlockRun;
    assert.equal(arcadeRewards(run).softCurrency, 0);
    for (const tile of [3, 4, 5, 7, 1, 0, 0, 0])
      run = applyArcadeAction(
        run,
        { type: "attack", tile },
        run.lastAt + 700,
      ) as BlockRun;
    assert.equal(run.result, "win");
    assert.equal(run.block.turn, 8);
    assert.equal(run.block.captured, 6);
    assert.equal(arcadeRewards(run).softCurrency, 275);
    assert.equal(arcadeRewards(run).packTickets, 2);
  }
});
