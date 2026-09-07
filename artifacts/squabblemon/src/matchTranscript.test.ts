import assert from "node:assert/strict";
import test from "node:test";
import {
  canAffordSelection,
  createMatch,
  getDistrictResults,
  getMatchWinner,
  nextRound,
  pass,
  playCard,
  revealCpu,
  verifyMatchTranscript,
  type Lane,
  type PlayerMove,
} from "./gameEngine";

test("the server-verifiable transcript reproduces the local match", () => {
  let local = createMatch("block", "slide");
  const moves: PlayerMove[] = [];

  for (let round = 0; round < 6; round += 1) {
    const choice = local.playerHand
      .flatMap((card) =>
        ([0, 1, 2] as Lane[]).map((lane) => ({ card, lane })),
      )
      .find(({ card, lane }) =>
        canAffordSelection(local, "player", card.instanceId, lane),
      );

    if (choice) {
      moves.push({
        cardInstanceId: choice.card.instanceId,
        lane: choice.lane,
        squabble: false,
      });
      local = playCard(
        local,
        "player",
        choice.card.instanceId,
        choice.lane,
      );
    } else {
      moves.push({ cardInstanceId: null, lane: null, squabble: false });
      local = pass(local, "player");
    }
    local = revealCpu(local);
    local = nextRound(local);
  }

  const verified = verifyMatchTranscript("block", "slide", moves);
  assert.equal(getMatchWinner(verified), getMatchWinner(local));
  assert.deepEqual(getDistrictResults(verified), getDistrictResults(local));
});

test("illegal or incomplete transcripts are rejected", () => {
  assert.throws(() => verifyMatchTranscript("block", "slide", []));
  assert.throws(() =>
    verifyMatchTranscript(
      "block",
      "slide",
      Array.from({ length: 6 }, () => ({
        cardInstanceId: "forged-card",
        lane: 0 as Lane,
        squabble: false,
      })),
    ),
  );
});