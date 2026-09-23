import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  getStorySeasonForChapter, isStoryPuzzleSolution, storyContent, storySeasons,
  storyDialogueToken, validateStoryContent,
} from "@workspace/squabblemon-engine/story";

const legacyIds = ["block-party", "red-side-tapes", "blue-side-blues", "side-show", "old-heads-know", "the-function", "return-of-the-block", "the-crown"];

test("season expansion preserves every legacy progression, encounter and reward identity", () => {
  const legacy = storyContent.chapters.filter(chapter => legacyIds.includes(chapter.id));
  assert.deepEqual(legacy.map(chapter => chapter.id), legacyIds);
  const mechanics = legacy.map(chapter => ({
    ...chapter,
    nodes: chapter.nodes.map(node => {
      const { preDialogue: _pre, postDialogue: _post, scenes: _scenes, ...rest } = node as typeof node & {
        preDialogue?: unknown; postDialogue?: unknown; scenes?: unknown;
      };
      return rest;
    }),
  }));
  assert.equal(createHash("sha256").update(JSON.stringify(mechanics)).digest("hex"),
    "9db094cb3a342736a8042b80703146556538096e2cfeb3b73b7304818b38ebe9",
    "Existing saves and issued matches depend on unchanged Season One identities/rules/rewards.");
  assert.equal(storyDialogueToken("welcome-to-the-block", "pre", 0), "welcome-to-the-block:script-v3:pre:0");
});

test("each chapter has exactly one presentation and every advertised chapter exists", () => {
  assert.equal(storySeasons.length, 3);
  assert.equal(storySeasons.find(season => season.id === "season-2")?.chapterIds.length, 8);
  assert.equal(storySeasons.find(season => season.kind === "special")?.chapterIds.length, 3);
  const memberships = storySeasons.flatMap(season => season.chapterIds);
  assert.equal(new Set(memberships).size, memberships.length);
  assert.deepEqual([...memberships].sort(), storyContent.chapters.map(chapter => chapter.id).sort());
  for (const chapter of storyContent.chapters) assert.ok(getStorySeasonForChapter(chapter.id));
});

test("new seasons preserve distinct entry requirements and validate as one campaign", () => {
  assert.equal(validateStoryContent(storyContent), storyContent);
  assert.deepEqual(storyContent.chapters.find(chapter => chapter.id === "s2-the-morning-after")?.prerequisites, ["the-crown"]);
  assert.deepEqual(storyContent.chapters.find(chapter => chapter.id === "special-sherlock-missing-motion")?.prerequisites, ["block-party"]);
  const fresh = storyContent.chapters.filter(chapter => !legacyIds.includes(chapter.id)).flatMap(chapter => chapter.nodes);
  assert.ok(fresh.filter(node => node.kind === "battle").length >= 30);
  assert.ok(fresh.filter(node => node.puzzle).length >= 4);
  assert.ok(fresh.every(node => !node.id.includes(":")), "New node IDs must not collide with legacy dialogue delimiters.");
});

test("puzzle solutions reject omissions, duplicates, extra pieces and the wrong order", () => {
  const puzzles = storyContent.chapters.flatMap(chapter => chapter.nodes).flatMap(node => node.puzzle ? [node.puzzle] : []);
  assert.ok(puzzles.length >= 4);
  for (const puzzle of puzzles) {
    assert.equal(isStoryPuzzleSolution(puzzle, puzzle.solution), true);
    assert.equal(isStoryPuzzleSolution(puzzle, [...puzzle.solution].reverse()), false);
    assert.equal(isStoryPuzzleSolution(puzzle, puzzle.solution.slice(1)), false);
    assert.equal(isStoryPuzzleSolution(puzzle, [...puzzle.solution, "forged-piece"]), false);
    assert.equal(isStoryPuzzleSolution(puzzle, puzzle.solution.map(() => puzzle.solution[0])), false);
  }
});