import { completeEngineCrew, cards, decks } from '@workspace/squabblemon-engine/data';
import assert from "node:assert/strict";
import test from "node:test";
import {
  selectTrainingRival,
  trainingBandForLevel,
  trainingCrewLevel,
  trainingDifficulty,
  TRAINING_REWARD_RULES,
  TRAINING_DECK_TIERS,
} from "@workspace/squabblemon-engine/training";

const blockCards = completeEngineCrew(["cornball", "snow", "roaster", "rastamon", "wifey", "oink", "baby"]);

test('every offered training recipe has an explicit band without changing existing assignments', () => {
  assert.deepEqual(Object.keys(TRAINING_DECK_TIERS).sort(), decks.map(deck => deck.id).sort());
  const previous: Record<string, number> = { block: 1, slide: 1, crashout: 1, receipts: 2, vibes: 2, combo: 3, compound: 3 };
  for (const deck of decks) assert.equal(TRAINING_DECK_TIERS[deck.id], previous[deck.id] ?? 2, deck.id);
});

test("training bands keep developing gangs out of advanced opposition", () => {
  assert.equal(trainingBandForLevel(1), 1);
  assert.equal(trainingBandForLevel(3), 2);
  assert.equal(trainingBandForLevel(6), 3);
  assert.equal(selectTrainingRival("block", blockCards, {}), "crashout");
  assert.equal(trainingDifficulty("block", "crashout", blockCards, {}), "Even Fade");
});

test("training gang level normalizes engine IDs to owned catalog progression", () => {
  const progression = Object.fromEntries(
    blockCards.map(id => cards[id].id)
      .map((cardId) => [cardId, { xp: 1500, level: 6 }]),
  );
  assert.equal(trainingCrewLevel(blockCards, progression), 6);
  assert.equal(selectTrainingRival("block", blockCards, progression), "combo");
});

test("verified training earns participating card XP and account rewards with no repeat limit", () => {
  assert.deepEqual(TRAINING_REWARD_RULES, {
    winCardXp: 30,
    drawCardXp: 25,
    lossCardXp: 20,
    dailyLimit: null,
    repeatLimit: null,
    grantsProfileXp: true,
    grantsCurrency: true,
  });
});
