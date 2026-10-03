import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { cards, DECK_SIZE, decks, ROOKIE_MENTOR_CORE_IDS, catalogIdsToEngineIds } from "@workspace/squabblemon-engine/data";
import { getStorySeason, getStorySeasonForChapter, isStoryPuzzleSolution, storyContent, validateStoryContent } from "@workspace/squabblemon-engine/story";
import { squabbleHouseChapters, squabbleHousePuzzles, SQUABBLE_HOUSE_ENEMY_CREWS, SQUABBLE_HOUSE_SUGGESTED_CREW } from "../../../lib/squabblemon-engine/src/storySquabbleHouse";
import { createStoryMatch, getDistrictResults, getStoryModifierSummaries, nextRound, pass, revealCpuTurn, verifyStoryMatchTranscript, type PlayerMove } from "@workspace/squabblemon-engine/gameEngine";

test("The Last Waffle is a self-contained six-chapter movie special with a connected shift", () => {
  assert.equal(validateStoryContent(storyContent), storyContent);
  const special = getStorySeason("special-squabble-house");
  assert(special);
  assert.equal(special.kind, "special");
  assert.equal(special.posterAssetId, "assets/story/posters/last-waffle.webp");
  assert.deepEqual(special.chapterIds, squabbleHouseChapters.map(c => c.id));
  assert.equal(squabbleHouseChapters.length, 6);
  assert.deepEqual(squabbleHouseChapters.map(c => c.order), [30, 31, 32, 33, 34, 35]);
  for (const [index, chapter] of squabbleHouseChapters.entries()) {
    assert.equal(getStorySeasonForChapter(chapter.id)?.id, special.id);
    assert.deepEqual(chapter.prerequisites, index === 0 ? [] : [squabbleHouseChapters[index - 1].id]);
    assert.equal(chapter.nodes.length, 4);
    assert.deepEqual(chapter.nodes.map(node => node.kind), ["dialogue", "dialogue", "battle", "reward"]);
    assert.equal(chapter.nodes[0].id, `${chapter.id}-opening`);
    assert.deepEqual(chapter.nodes[0].prerequisites, []);
    for (let i = 1; i < chapter.nodes.length; i++) assert.deepEqual(chapter.nodes[i].prerequisites, [chapter.nodes[i - 1].id]);
    assert(chapter.nodes.every(node => !node.optional));
    assert(chapter.nodes[1].puzzle);
  }
});

test("each chapter references its own movie, keyframe, environment and full-body cast", () => {
  const speakers = new Set<string>();
  for (const [index, chapter] of squabbleHouseChapters.entries()) {
    const clip = `ch${String(index + 1).padStart(2, "0")}`;
    for (const node of chapter.nodes) {
      assert.deepEqual(node.cinematic, {
        videoAssetId: `assets/story/squabble-house/media/${clip}.mp4`,
        posterAssetId: `assets/story/squabble-house/keyframes/${clip}.webp`,
        environmentAssetId: `assets/story/squabble-house/environments/${clip}.webp`,
      });
      const lines = node.kind === "battle" ? [...node.preDialogue, ...node.postDialogue] : node.scenes;
      for (const line of lines) {
        speakers.add(line.speaker);
        assert.match(line.portraitAssetId, /^assets\/story\/squabble-house\/cast\/C\d{2}_[a-z_]+\.webp$/);
      }
      if (node.kind === "battle") assert.equal(node.encounter.battlefieldAssetId, node.cinematic.environmentAssetId);
    }
  }
  assert.equal(speakers.size, 12, "All twelve supplied cast identities have dialogue callbacks.");
});

test("House card rewards are existing cards earned only after a verified battle path", () => {
  const cardRewards = squabbleHouseChapters.flatMap(chapter => chapter.nodes.flatMap(node => {
    const rewards = node.rewards.filter(reward => reward.kind === "card");
    if (rewards.length) {
      assert.equal(node.kind, "reward");
      assert.deepEqual(node.prerequisites, [`${chapter.id}-battle`]);
    }
    if (node.puzzle || node.id.endsWith("-opening")) assert.equal(node.rewards.length, 0);
    return rewards;
  }));
  assert.deepEqual(cardRewards.map(reward => reward.id), ["squabbleserver", "squabblecook", "janitor", "squabble-house-manager"]);
  for (const reward of cardRewards) {
    assert(cards[reward.id]);
    assert.equal(reward.amount, 1);
    assert.equal(reward.claimKey, `squabble-house:card:${reward.id}:v1`);
  }
  const explicitClaimKeys = squabbleHouseChapters.flatMap(c => c.nodes.flatMap(n => n.rewards.flatMap(r => r.claimKey ? [r.claimKey] : [])));
  assert.equal(new Set(explicitClaimKeys).size, explicitClaimKeys.length, "Repeat clears cannot create a second reward identity.");
});

test("Blood and Crip opponents retain canon red/blue crews and legal ten-card rosters", () => {
  assert(SQUABBLE_HOUSE_ENEMY_CREWS.bloodOg.includes("triple-og-red"));
  assert(SQUABBLE_HOUSE_ENEMY_CREWS.blood.includes("cane-corso-red"));
  assert(SQUABBLE_HOUSE_ENEMY_CREWS.crip.includes("triple-og-blue"));
  assert(SQUABBLE_HOUSE_ENEMY_CREWS.crip.includes("blue-nose-pit"));
  for (const crew of Object.values(SQUABBLE_HOUSE_ENEMY_CREWS)) {
    assert.equal(crew.length, DECK_SIZE);
    assert.equal(new Set(crew).size, DECK_SIZE);
    assert(crew.every(id => cards[id]));
  }
  const battles = squabbleHouseChapters.flatMap(chapter => chapter.nodes.filter(node => node.kind === "battle"));
  assert.deepEqual(battles.map(node => node.encounter.enemy.name), ["Red", "Blue", "Red OG", "Blue Titan", "Blue", "Red OG"]);
  assert.deepEqual(battles[4].encounter.modifiers?.laneLocks, [{ round: 3, owner: "both", lanes: [1] }]);
  assert.equal(battles[5].encounter.phases?.[0].trigger.atLeast, 4);
  assert(battles.every(node => node.encounter.roundLimit === 6));
});

test("six clue-based activities have distinct layouts and reject forged, partial or scrambled answers", () => {
  assert.deepEqual(squabbleHousePuzzles.map(puzzle => puzzle.presentation?.layout), ["tickets", "register", "booths", "pass", "route", "evidence"]);
  for (const puzzle of squabbleHousePuzzles) {
    assert.equal(puzzle.presentation?.theme, "squabble-house");
    assert.equal(puzzle.presentation?.slotLabels.length, puzzle.pieces.length);
    assert.equal(puzzle.hints.length, 2);
    assert.equal(isStoryPuzzleSolution(puzzle, puzzle.solution), true);
    for (const order of [puzzle.pieces.map(piece => piece.id), puzzle.solution.slice(1), [...puzzle.solution].reverse(), [...puzzle.solution.slice(0, -1), "forged"], puzzle.solution.map(() => puzzle.solution[0])]) {
      assert.equal(isStoryPuzzleSolution(puzzle, order), false, puzzle.id);
    }
  }
});

test("all six authored encounters complete and deterministically replay through the server engine", () => {
  const crew = catalogIdsToEngineIds(ROOKIE_MENTOR_CORE_IDS);
  for (const node of squabbleHouseChapters.flatMap(chapter => chapter.nodes)) {
    if (node.kind !== "battle") continue;
    let match = createStoryMatch(node.encounter, crew, "squabble-house-content-check");
    const moves: PlayerMove[] = [];
    for (let round = 0; round < 6 && match.phase !== "complete"; round++) {
      moves.push({ cardInstanceId: null, lane: null, squabble: false, endTurn: true });
      match = nextRound(revealCpuTurn(pass(match, "player")));
    }
    assert.equal(match.phase, "complete", node.id);
    const replay = verifyStoryMatchTranscript(node.encounter, crew, moves, "squabble-house-content-check");
    assert.deepEqual(replay.boards, match.boards, node.id);
    assert.equal(replay.round, 6, node.id);
  }
});

test("trial House cards have visible round timing and do not become collection rewards", () => {
  assert.equal(SQUABBLE_HOUSE_SUGGESTED_CREW.length, DECK_SIZE);
  assert.equal(new Set(SQUABBLE_HOUSE_SUGGESTED_CREW).size, DECK_SIZE);
  assert(SQUABBLE_HOUSE_SUGGESTED_CREW.every(id => cards[id]));
  for (const node of squabbleHouseChapters.flatMap(chapter => chapter.nodes)) {
    if (node.kind !== "battle") continue;
    assert.deepEqual(node.recommendedCollection, SQUABBLE_HOUSE_SUGGESTED_CREW);
    const support = node.encounter.modifiers?.reinforcements;
    assert(support);
    assert.deepEqual(support.map(item => item.round), [1, 2]);
    assert(support.every(item => item.owner === "player" && cards[item.cardId]));
    const summaries = getStoryModifierSummaries(node.encounter);
    for (const item of support) assert(summaries.some(summary => summary.includes(`Round ${item.round}:`) && summary.includes(item.cardId)));
    assert.match(node.encounter.passive?.description ?? "", /temporary copies/);
    assert.match(node.encounter.passive?.description ?? "", /normal Motion costs/);
    assert(node.rewards.every(reward => reward.kind !== "card"));
  }
});

test("all six battles have server-replayed wins using unupgraded starter crews", () => {
  const fixture = JSON.parse(readFileSync(new URL("./storySquabbleHouse.playthroughs.json", import.meta.url), "utf8")) as {
    proofs: { nodeId: string; recipe: string; matchDeckId: string; cardIds: string[]; moves: PlayerMove[] }[];
  };
  assert.equal(fixture.proofs.length, 6);
  const battles = squabbleHouseChapters.flatMap(chapter => chapter.nodes.filter(node => node.kind === "battle"));
  assert.deepEqual(fixture.proofs.map(proof => proof.nodeId), battles.map(node => node.id));
  for (const [index, proof] of fixture.proofs.entries()) {
    const expectedCrew = catalogIdsToEngineIds(ROOKIE_MENTOR_CORE_IDS);
    assert.deepEqual(proof.cardIds, expectedCrew);
    const replay = verifyStoryMatchTranscript(battles[index].encounter, proof.cardIds, proof.moves, proof.matchDeckId);
    assert.equal(replay.phase, "complete", proof.nodeId);
    assert(getDistrictResults(replay).filter(result => result.winner === "player").length >= 2, proof.nodeId);
  }
});
