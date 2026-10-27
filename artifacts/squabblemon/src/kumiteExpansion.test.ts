import { squabbledCardIds } from "./lib/battleMediaEvents";
import assert from "node:assert/strict";
import test from "node:test";
import { KUMITE_PUZZLES } from "../../../lib/squabblemon-engine/src/storyKumitePuzzles";
import { kumiteBreakTheBracketChapter } from "../../../lib/squabblemon-engine/src/storyKumite";
import {
  validateStoryPuzzle,
  isStoryPuzzleSolution,
} from "../../../lib/squabblemon-engine/src/storyPuzzles";
import {
  KUMITE_FIGHTERS,
  kumiteFighter,
  kumiteStance,
} from "@workspace/squabblemon-engine/kumiteForms";
import { BOSS_ARCHIVE } from "@workspace/squabblemon-engine/bossArchive";
import {
  cards,
  catalogCardById,
  validateSavedDeck,
  ROOKIE_CORE_IDS,
} from "@workspace/squabblemon-engine/data";
import {
  createCardInstance,
  createMatch,
  playTurnCard,
} from "@workspace/squabblemon-engine/gameEngine";
import { KUMITE_BOSS_FORMS } from "@workspace/squabblemon-engine/bossRaid";
test("all ten drill nodes are solvable, scrambled, optional and additive to eight saved episode IDs", () => {
  assert.equal(KUMITE_PUZZLES.length, 10);
  assert.equal(new Set(KUMITE_PUZZLES.map((p) => p.id)).size, 10);
  assert.equal(
    kumiteBreakTheBracketChapter.nodes.filter((n) => !n.puzzle).length,
    8,
  );
  for (const p of KUMITE_PUZZLES) {
    assert.ok(validateStoryPuzzle(p), p.id);
    assert.ok(isStoryPuzzleSolution(p, p.solution));
    assert.ok(
      !isStoryPuzzleSolution(
        p,
        p.pieces.map((x) => x.id),
      ),
    );
    assert.ok(!isStoryPuzzleSolution(p, [...p.solution].reverse()));
    const n = kumiteBreakTheBracketChapter.nodes.find((n) => n.id === p.id)!;
    assert.ok(n.optional);
    assert.equal(n.puzzle, p);
    assert.ok(
      n.prerequisites.every((id) =>
        kumiteBreakTheBracketChapter.nodes.some((n) => n.id === id),
      ),
    );
  }
});
test("form selection uses authoritative Hands and confirmed Squabble, including legacy engine aliases", () => {
  assert.equal(KUMITE_FIGHTERS.length, 8);
  assert.equal(kumiteFighter("shonuff"), "sho-nuff");
  assert.equal(kumiteFighter("undercova"), "undercova-brotha");
  assert.equal(kumiteFighter("hooper"), null);
  assert.equal(kumiteStance({ hands: 9 }), "base");
  assert.equal(kumiteStance({ hands: 9, squabble: true }), "squabble");
  assert.equal(kumiteStance({ hands: 10, squabble: true }), "awakened");
  assert.equal(kumiteStance({ hands: 1, goldenGlow: true }), "awakened");
  assert.equal(kumiteStance({ hands: 2, signature: true }), "awakened");
  const card = createCardInstance("leroy", "player", "forms-test", 0),
    m = {
      ...createMatch("block", "slide"),
      playerHand: [card],
      playerMotion: 10,
    };
  const before = structuredClone(m);
  const result = playTurnCard(m, "player", card.instanceId, 0, true);
  assert.equal(squabbledCardIds(result.effectLog).has(card.instanceId), true);
  assert.deepEqual(m, before);
});
test("every boss archive record is static metadata and remains illegal for packs and saved decks", () => {
  assert.equal(BOSS_ARCHIVE.length, 25);
  for (const entry of BOSS_ARCHIVE) {
    assert.ok(entry.archiveOnly);
    assert.equal(cards[entry.id], undefined);
    assert.equal(catalogCardById[entry.id], undefined);
    const crew = [...ROOKIE_CORE_IDS.slice(0, 9), entry.id];
    assert.equal(validateSavedDeck(crew, crew, crew[0]).valid, false);
  }
  assert.deepEqual(
    KUMITE_BOSS_FORMS.map((b) => b.fighterId),
    [
      "chonk-lee",
      "dragonfly-jones",
      "franklin-duke",
      "bushedo-brown",
      "sho-nuff",
    ],
  );
});
test("all eight alternate slots are mastery-only and have no currency purchase route", () => {
  for (const id of KUMITE_FIGHTERS) {
    const slot = catalogCardById[id].variantSlots.find(
      (v) => v.id === id + ":kumite-alt-v1",
    );
    assert.ok(slot?.progressionOnly);
  }
});

test("eighteen episode/manual map targets stay separated at the narrowest atlas surface", () => {
  const nodes = kumiteBreakTheBracketChapter.nodes;
  for (let i = 0; i < nodes.length; i++)
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i].mapPosition,
        b = nodes[j].mapPosition;
      assert.ok(
        Math.hypot((a.x - b.x) * 7, (a.y - b.y) * 3.4) >= 69,
        `${nodes[i].id} overlaps ${nodes[j].id}`,
      );
    }
});
