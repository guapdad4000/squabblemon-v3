import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createGame,
  deploy,
  advance,
  deploymentCost,
  type GameState,
  type Unit,
  type Side,
  type Lane,
} from "./src/breakthrough";
import { BREAKTHROUGH_ROSTER } from "./src/breakthroughCatalog";
import {
  ANUNAKI_ADAPTERS,
  anunakiEntrance,
  type AnunakiContext,
} from "./src/breakthroughAnunaki";
const deck = Object.keys(ANUNAKI_ADAPTERS);
function game() {
  return createGame(BREAKTHROUGH_ROSTER, {
    decks: { player: deck, opponent: deck },
    seed: 1234,
    travelMs: 1e9,
  });
}
function play(
  s: GameState,
  card: string,
  lane: Lane = 0,
  side: Side = "player",
  squabble = false,
) {
  s.players[side].hand = [card];
  s.players[side].motion = 9;
  const result = deploy(s, side, card, lane, squabble);
  assert.equal(result.error, undefined);
  return result.state;
}
const unit = (s: GameState, card: string) =>
  s.units.find((u) => u.cardId === card)!;
test("Tablets do not stack, survive source death, isolate sides and clone independently", () => {
  let s = play(game(), "nabu");
  s = play(s, "nabu");
  s = play(s, "nabu", 0, "opponent");
  assert.deepEqual(s.anunaki?.tablets, { player: [0], opponent: [0] });
  s.units = [];
  const before = structuredClone(s);
  const next = play(s, "inanna");
  assert.deepEqual(next.anunaki?.tablets, { player: [], opponent: [0] });
  assert.equal(unit(next, "inanna").hands, 7);
  assert.deepEqual(s.anunaki, before.anunaki);
});
test("Enki buffs weakest other ally despite an occupied Tablet; empty lane still places", () => {
  let s = play(game(), "nabu");
  s = play(s, "enki");
  assert.equal(unit(s, "nabu").hands, 4);
  assert.deepEqual(s.anunaki?.tablets.player, [0]);
  assert.deepEqual(play(game(), "enki", 2).anunaki?.tablets.player, [2]);
});
test("Utu and Enlil consume before defended damage; Enlil with no enemy retains Tablet", () => {
  for (const card of ["utu", "enlil"]) {
    let s = play(game(), "nabu");
    s = play(s, "anu", 0, "opponent");
    unit(s, "anu").protected = true;
    const hands = unit(s, "anu").hands;
    s = play(s, card);
    assert.deepEqual(s.anunaki?.tablets.player, []);
    assert.equal(unit(s, "anu").hands, hands);
  }
  let s = play(game(), "nabu");
  s = play(s, "enlil");
  assert.deepEqual(s.anunaki?.tablets.player, [0]);
  assert.deepEqual(play(game(), "utu").anunaki?.tablets.player, [0]);
});
test("Utu and Enlil deal one combined packet with correct amount", () => {
  for (const [card, amount] of [
    ["utu", 2],
    ["enlil", 4],
  ] as const) {
    let s = play(game(), "nabu");
    s = play(s, "anu", 0, "opponent");
    const before = unit(s, "anu").hands;
    s = play(s, card);
    assert.equal(unit(s, "anu").hands, before - amount);
    assert.equal(
      s.events.filter(
        (e) => e.type === "damage" && e.sourceUnitId === unit(s, card).id,
      ).length,
      1,
    );
  }
});
test("Ereshkigal consumes and gains even without an enemy; Inanna fallback ignores enemy Tablet", () => {
  let s = play(game(), "nabu");
  s = play(s, "ereshkigal");
  assert.equal(unit(s, "ereshkigal").hands, 6);
  s = play(game(), "nabu", 0, "opponent");
  s = play(s, "inanna");
  assert.equal(unit(s, "inanna").hands, 4);
  assert.deepEqual(s.anunaki?.tablets.opponent, [0]);
});
test("every active Ninhursag reacts once; cleanse targets weakest afflicted other local ally", () => {
  let s = play(game(), "ninhursag");
  s = play(s, "ninhursag");
  s = play(s, "nabu");
  const nabu = unit(s, "nabu");
  nabu.weakened = true;
  s.statuses.push({
    id: 777,
    kind: "weaken",
    targetId: nabu.id,
    stacks: 1,
    appliedAt: 0,
    nextTickAt: 5000,
    expiresAt: 10000,
  });
  s = play(s, "inanna");
  assert.deepEqual(
    s.units.filter((u) => u.cardId === "ninhursag").map((u) => u.hands),
    [5, 5],
  );
  assert.equal(unit(s, "nabu").weakened, false);
  s = play(s, "nabu");
  s.units
    .filter((u) => u.cardId === "ninhursag")
    .forEach((u) => (u.silenced = true));
  s = play(s, "inanna");
  assert.deepEqual(
    s.units.filter((u) => u.cardId === "ninhursag").map((u) => u.hands),
    [5, 5],
  );
});
test("Anu quote is pure, failed payment preserves Tablets, successful payment selects paid lane first", () => {
  let s = play(game(), "nabu", 0);
  s = play(s, "nabu", 2);
  s = play(s, "ninhursag", 2);
  s.players.player.hand = ["anu"];
  s.players.player.motion = 3;
  const before = structuredClone(s);
  assert.equal(deploymentCost(s, "player", "anu", 2), 4);
  assert.deepEqual(s, before);
  assert.equal(deploy(s, "player", "anu", 2).error, "Not enough Motion");
  assert.deepEqual(s, before);
  s.players.player.motion = 4;
  const result = deploy(s, "player", "anu", 2);
  assert.equal(result.error, undefined);
  s = result.state;
  assert.equal(s.players.player.motion, 0);
  assert.equal(unit(s, "anu").hands, 11);
  assert.equal(unit(s, "ninhursag").hands, 5);
  assert.deepEqual(
    s.events.filter((e) => e.text === "TABLET CONSUMED").map((e) => e.lane),
    [2, 0],
  );
});
test("Anu discount beats one-point alternative but preserves equal or better alternatives", () => {
  let s = play(game(), "nabu");
  s.players.player.discount = { origin: 1 };
  s.players.player.hand = ["anu"];
  s.players.player.motion = 9;
  let result = deploy(s, "player", "anu", 0);
  assert.equal(result.state.players.player.motion, 5);
  assert.deepEqual(result.state.players.player.discount, { origin: 1 });
  s = play(game(), "nabu");
  s = play(s, "buddy");
  s.players.player.discount = { origin: 1 };
  s.players.player.hand = ["anu"];
  s.players.player.motion = 9;
  result = deploy(s, "player", "anu", 0);
  assert.equal(result.state.players.player.motion, 5);
  assert.equal(unit(result.state, "anu").hands, 11); // tie preserves Tablet for entrance
  assert.equal(
    result.state.events.filter((e) => e.text === "TABLET CONSUMED").length,
    1,
  );
  assert.equal(result.state.players.player.discount, undefined);
});
test("Yakub ordinary and Squabbled summons have suppressed entrances and never recycle", () => {
  for (const squabble of [false, true]) {
    let s = play(game(), "yakub", 0, "player", squabble);
    const summoned = s.units.filter((u) => u.origin === "summon");
    assert.equal(summoned.length, squabble ? 2 : 1);
    assert(
      summoned.every(
        (u) =>
          u.cardId === "caucus-mountaineer" && u.hands === 3 && !u.squabbled,
      ),
    );
    summoned.forEach((u) => (u.hands = 0));
    s = advance(s, 50);
    assert(
      !s.players.player.returns.some((r) => r.cardId === "caucus-mountaineer"),
    );
  }
});
test("Caucus chain is bounded at eight extras, uses each source, stops on a blocked hit, and echoes Yakub once", () => {
  let s = play(game(), "caucus-mountaineer");
  const source = unit(s, "caucus-mountaineer");
  const enemy: Unit = { ...source, id: "enemy", side: "opponent", hands: 100 };
  s.units.push(enemy);
  let rolls = 0,
    hits = 0;
  const ctx: AnunakiContext = {
    state: s,
    definition: (u) => s.roster.find((c) => c.id === u.cardId)!,
    active: (u) => u.hands > 0,
    power: (u) => u.hands,
    gain: (u, n) => {
      u.hands += n;
    },
    cleanse: () => {},
    emit: () => {},
    random: () => {
      rolls++;
      return 0;
    },
    damage: (_u, t, n) => {
      hits++;
      t.hands -= n;
      return n;
    },
    spawn: (u) => {
      const child = {
        ...u,
        id: `child-${s.nextUnitId++}`,
        squabbled: false,
        origin: "summon" as const,
      };
      s.units.push(child);
      return child;
    },
  };
  anunakiEntrance(ctx, source, false);
  assert.equal(hits, 9);
  assert.equal(rolls, 8);
  assert.equal(s.units.length, 10);
  hits = 0;
  rolls = 0;
  ctx.damage = () => 0;
  anunakiEntrance(ctx, source, false);
  assert.equal(rolls, 0);
  const yakub = { ...source, cardId: "yakub", squabbled: true };
  const count = s.units.length;
  anunakiEntrance(ctx, yakub, true);
  assert.equal(s.units.length, count + 1);
});
test("radiation uses global boundaries, survives Last Stand, and JSON replay is identical", () => {
  let s = play(game(), "nabu");
  s = play(s, "caucus-mountaineer");
  s = advance(s, 9950);
  const hands = unit(s, "caucus-mountaineer").hands;
  const a = advance(s, 50),
    b = advance(JSON.parse(JSON.stringify(s)), 50);
  assert.deepEqual(a, b);
  assert.equal(unit(a, "caucus-mountaineer").hands, hands + 1);
  assert.equal(unit(advance(a, 50), "caucus-mountaineer").hands, hands + 1);
  s.elapsedMs = s.durationMs - 10000;
  s.anunaki!.lastPulse = Math.floor(s.elapsedMs / 10000);
  assert.equal(unit(advance(s, 10000), "caucus-mountaineer").hands, hands + 1);
});
test('Scammer copies Ninhursag ongoing reactions without firing its Tablet entrance', () => {
  let s = play(game(), 'ninhursag', 0, 'opponent');
  s = play(s, 'scammer');
  assert.equal(unit(s, 'scammer').copiedAbility, 'makers-touch');
  assert.deepEqual(s.anunaki?.tablets.player, []);
  s = play(s, 'nabu'); const before = unit(s, 'scammer').hands;
  s = play(s, 'inanna'); assert.equal(unit(s, 'scammer').hands, before + 2);
});
test('Anu paid discount retains taxes and receipt identifies the actual arriving fighter', () => {
  let s = play(game(), 'nabu'); s = play(s, 'landlord', 0, 'opponent');
  s.players.player.hand = ['anu']; s.players.player.motion = 4;
  assert.equal(deploymentCost(s, 'player', 'anu', 0), 5);
  assert.equal(deploy(s, 'player', 'anu', 0).error, 'Not enough Motion');
  s.players.player.motion = 5; s = deploy(s, 'player', 'anu', 0).state;
  assert.equal(s.players.player.motion, 0);
  assert.equal(s.events.find(e => e.text === 'TABLET CONSUMED')?.sourceUnitId, unit(s, 'anu').id);
});
test('Caucus blocked hits do not roll RNG or spawn; seeded native activations replay exactly', () => {
  let s=play(game(),'anu',0,'opponent'); unit(s,'anu').protected=true;
  const rng=s.effectsRng; const blocked=play(s,'caucus-mountaineer');
  assert.equal(blocked.effectsRng,rng); assert(!blocked.units.some(u=>u.origin==='summon'));
  unit(s,'anu').protected=false; const copy=JSON.parse(JSON.stringify(s));
  assert.deepEqual(play(s,'caucus-mountaineer'),play(copy,'caucus-mountaineer'));
});
