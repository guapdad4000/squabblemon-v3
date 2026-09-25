import assert from "node:assert/strict";
import test from "node:test";
import { storyContent } from "@workspace/squabblemon-engine/story";
import { isStoryPuzzleSolution } from "@workspace/squabblemon-engine/story";
import { ROOKIE_MENTOR_CORE_IDS, catalogIdsToEngineIds } from "./data";
import {
  createStoryMatch,
  pass,
  revealCpuTurn,
  nextRound,
  verifyStoryMatchTranscript,
  type PlayerMove,
} from "./gameEngine";
const chapters = storyContent.chapters.filter((chapter) => chapter.order >= 20);
test("expanded stories provide ninety connected scenes and scrambled, solvable puzzles", () => {
  assert.equal(chapters.length, 10);
  assert.equal(chapters.flatMap((c) => c.nodes).length, 90);
  const puzzles = chapters.flatMap((c) =>
    c.nodes.flatMap((n) => (n.puzzle ? [n.puzzle] : [])),
  );
  assert(puzzles.length >= 20);
  for (const puzzle of puzzles) {
    assert.equal(
      isStoryPuzzleSolution(
        puzzle,
        puzzle.pieces.map((p) => p.id),
      ),
      false,
      puzzle.id,
    );
    assert.equal(
      isStoryPuzzleSolution(puzzle, puzzle.solution),
      true,
      puzzle.id,
    );
    assert(puzzle.hints.length >= 2);
  }
  for (const chapter of chapters) {
    assert.equal(chapter.nodes[0].prerequisites.length, 0);
    chapter.nodes
      .slice(1)
      .forEach((node, index) =>
        assert.deepEqual(node.prerequisites, [chapter.nodes[index].id]),
      );
  }
});
test("every new encounter reaches a final result and replays with its authored rules", () => {
  const crew = catalogIdsToEngineIds(ROOKIE_MENTOR_CORE_IDS);
  for (const node of chapters.flatMap((chapter) => chapter.nodes)) {
    if (node.kind !== "battle") continue;
    let match = createStoryMatch(node.encounter, crew, "expansion-check");
    const moves: PlayerMove[] = [];
    for (let i = 0; i < 6 && match.phase !== "complete"; i++) {
      moves.push({ cardInstanceId: null, lane: null, squabble: false });
      match = nextRound(revealCpuTurn(pass(match, "player")));
    }
    assert.equal(match.phase, "complete", node.id);
    const replay = verifyStoryMatchTranscript(
      node.encounter,
      crew,
      moves,
      "expansion-check",
    );
    assert.equal(replay.phase, "complete", node.id);
    assert.equal(replay.round, match.round);
  }
});

// Editorial checks derive answers from the published evidence, not just solution IDs.
const auditedPuzzles = storyContent.chapters
  .filter((c) => c.order >= 9)
  .flatMap((c) => c.nodes.flatMap((n) => (n.puzzle ? [n.puzzle] : [])));
const findPuzzle = (id: string) => {
  const puzzle = auditedPuzzles.find((p) => p.id === id);
  assert(puzzle, id);
  return puzzle;
};
function permutations<T>(items: readonly T[]): T[][] {
  if (!items.length) return [[]];
  return items.flatMap((item, i) =>
    permutations(items.filter((_, j) => j !== i)).map((rest) => [
      item,
      ...rest,
    ]),
  );
}

test("no new investigation opens with its answer already arranged", () => {
  assert.equal(auditedPuzzles.length, 27);
  for (const p of auditedPuzzles)
    assert(
      !isStoryPuzzleSolution(
        p,
        p.pieces.map((x) => x.id),
      ),
      p.id,
    );
});

test("correcting the published clocks produces the authored chronology", () => {
  const clocks: [string, (label: string, detail: string) => number][] = [
    [
      "sherlock-clocks",
      (label) =>
        label.startsWith("Bakery") ? 4 : label.startsWith("Station") ? -7 : 0,
    ],
    [
      "sherlock-proof",
      (label) =>
        label.startsWith("Poster")
          ? -10
          : label.startsWith("Spotlight")
            ? 5
            : 0,
    ],
    [
      "oz-flight",
      (_label, detail) =>
        detail.startsWith("Repair")
          ? -6
          : detail.startsWith("Platform")
            ? 3
            : 0,
    ],
    ["alice-law", (_label, detail) => (detail.startsWith("Clerk") ? -10 : 0)],
    [
      "cellblock-forms",
      (label) =>
        label.startsWith("Library") ? 5 : label.startsWith("Unit") ? -8 : 0,
    ],
    [
      "sherlock-missing-reel-sequence",
      (_label, detail) => (/five minutes fast/.test(detail) ? -5 : 0),
    ],
  ];
  for (const [id, correction] of clocks) {
    const p = findPuzzle(id);
    const actual = p.pieces
      .map((piece) => {
        const stamp = `${piece.label} ${piece.detail}`.match(
          /(\d{1,2}):(\d{2})/,
        );
        const minutes = stamp
          ? Number(stamp[1]) * 60 + Number(stamp[2])
          : piece.label.includes("bell")
            ? 12 * 60
            : NaN;
        assert(Number.isFinite(minutes), piece.label);
        return {
          id: piece.id,
          time: minutes + correction(piece.label, piece.detail),
        };
      })
      .sort((a, b) => a.time - b.time);
    assert.equal(
      new Set(actual.map((x) => x.time)).size,
      actual.length,
      `${id}: ambiguous tied clocks`,
    );
    assert.deepEqual(
      actual.map((x) => x.id),
      p.solution,
      id,
    );
  }
});

test("socket and custody puzzles have exactly one connected path", () => {
  for (const id of [
    "sherlock-cable",
    "sherlock-ledger",
    "s2-premiere-night-evidence-order",
  ]) {
    const p = findPuzzle(id);
    const nodes = p.pieces.map((piece) => ({
      ...piece,
      input: piece.detail.match(/IN ([A-Z]\d)/)?.[1],
      output: piece.detail.match(/OUT ([A-Z]\d)/)?.[1],
    }));
    const valid = permutations(nodes).filter(
      (order) =>
        !order[0].input &&
        !order.at(-1)!.output &&
        order
          .slice(1)
          .every((node, i) => node.input && node.input === order[i].output),
    );
    assert.equal(valid.length, 1, id);
    assert.deepEqual(
      valid[0].map((p) => p.id),
      p.solution,
      id,
    );
  }
});

test("combined witness and placement clues admit one answer, not several plausible orders", () => {
  const models: [string, (positions: number[]) => boolean][] = [
    // Positions are zero based; identities here are the named witnesses, not sorted cards.
    [
      "sherlock-route",
      ([station, bakery, laundry, tower, kiosk, river]) =>
        station === 0 &&
        river === 5 &&
        tower - station === 3 &&
        tower - laundry === 1 &&
        bakery < laundry &&
        river - kiosk === 1,
    ],
    [
      "sherlock-seats",
      ([watson, alice, cornball, promoter, sherlock]) =>
        [0, 4].includes(watson) &&
        sherlock === 4 &&
        sherlock > watson &&
        Math.abs(alice - watson) === 1 &&
        cornball - alice === 1 &&
        promoter - cornball === 1,
    ],
    [
      "oz-claims",
      ([scarecrow, tin, lion, dorothy]) =>
        dorothy === 3 &&
        Math.abs(lion - dorothy) === 1 &&
        tin !== 0 &&
        tin !== 3 &&
        scarecrow < tin,
    ],
    [
      "yasuke-signals",
      ([white, blue, gold, red]) =>
        red > gold && blue === white + 1 && gold > 1,
    ],
    [
      "leon-route",
      ([library, shelter, pharmacy, church, garden, kitchen]) =>
        library === 0 &&
        kitchen === 5 &&
        church === 3 &&
        pharmacy + 1 === church &&
        shelter < pharmacy &&
        garden + 1 === kitchen,
    ],
  ];
  for (const [id, model] of models) {
    const p = findPuzzle(id);
    const identities = [...p.pieces].sort(
      (a, b) => Number(a.id.split("-").at(-1)) - Number(b.id.split("-").at(-1)),
    );
    const valid = permutations(identities).filter((order) =>
      model(identities.map((x) => order.indexOf(x))),
    );
    assert.equal(valid.length, 1, id);
    assert.deepEqual(
      valid[0].map((x) => x.id),
      p.solution,
      id,
    );
  }
});

test("Alice can perform the doorway plan and Leon can meet every posted deadline", () => {
  const p = findPuzzle("alice-sizes");
  const legal = (order: string[]) => {
    let size = "ordinary",
      key = false,
      unlocked = false;
    for (const id of order) {
      const label = p.pieces.find((x) => x.id === id)!.label;
      if (label === "Eat the cake") size = "tall";
      else if (label === "Pocket the key") {
        if (size !== "tall") return false;
        key = true;
      } else if (label === "Drink the whole bottle") size = "tiny";
      else if (label === "Turn the key") {
        if (size !== "tiny" || !key) return false;
        unlocked = true;
      } else if (
        label === "Cross the doorway" &&
        (size !== "tiny" || !unlocked)
      )
        return false;
    }
    return true;
  };
  const valid = permutations(p.pieces.map((x) => x.id)).filter(legal);
  assert.deepEqual(valid, [p.solution]);
  const day = findPuzzle("leon-day");
  assert(
    day.instruction.includes("12:00") &&
      day.instruction.includes("13:10") &&
      day.instruction.includes("14:00–14:30") &&
      day.instruction.includes("15:00"),
  );
  const chargeEnd = 12 * 60 + 20,
    callEnd = chargeEnd + 10,
    letterEnd = callEnd + 20 + 10;
  assert(letterEnd <= 13 * 60 + 10);
  assert(letterEnd + 30 <= 14 * 60);
  assert.equal(Math.max(14 * 60 + 30 + 20, 15 * 60), 15 * 60);
});
