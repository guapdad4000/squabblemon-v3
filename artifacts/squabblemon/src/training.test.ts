import assert from "node:assert/strict";
import test from "node:test";
import {
  selectTrainingRival,
  trainingBandForLevel,
  trainingCrewLevel,
  trainingDifficulty,
  TRAINING_REWARD_RULES,
} from "@workspace/squabblemon-engine/training";

const blockCards = ["cornball", "snow", "roaster", "rastamon", "wifey", "oink", "baby"];

test("training bands keep developing crews out of advanced opposition", () => {
  assert.equal(trainingBandForLevel(1), 1);
  assert.equal(trainingBandForLevel(3), 2);
  assert.equal(trainingBandForLevel(6), 3);
  assert.equal(selectTrainingRival("block", blockCards, {}), "crashout");
  assert.equal(trainingDifficulty("block", "crashout", blockCards, {}), "Even Match");
});

test("training crew level normalizes engine IDs to owned catalog progression", () => {
  const progression = Object.fromEntries(
    ["cornball", "snow-bunny", "all-jokes-roaster", "rastamon", "wifey", "officer-oink", "baby-momma"]
      .map((cardId) => [cardId, { xp: 1500, level: 6 }]),
  );
  assert.equal(trainingCrewLevel(blockCards, progression), 6);
  assert.equal(selectTrainingRival("block", blockCards, progression), "combo");
});

test("training rewards only participating card progression with no repeat limit", () => {
  assert.deepEqual(TRAINING_REWARD_RULES, {
    winCardXp: 30,
    drawCardXp: 25,
    lossCardXp: 20,
    dailyLimit: null,
    repeatLimit: null,
    grantsProfileXp: false,
    grantsCurrency: false,
  });
});