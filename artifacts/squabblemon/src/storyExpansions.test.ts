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
