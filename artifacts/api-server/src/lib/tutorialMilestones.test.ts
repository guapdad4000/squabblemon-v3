import assert from "node:assert/strict";
import test from "node:test";
import {
  completedTutorialMilestones,
  getTutorialMilestones,
} from "./tutorialMilestones";

const event = (
  round: number,
  type: "play" | "pass",
  options: {
    owner?: "player" | "cpu";
    playerMotion?: number;
    squabbleBefore?: boolean;
    squabbleAfter?: boolean;
  } = {},
) => ({
  round,
  type,
  owner: options.owner ?? "player",
  resources: {
    before: { playerMotion: options.playerMotion ?? 1 },
  },
  replay: {
    before: {
      squabbleUsed: options.squabbleBefore ?? false,
      squabbleByOwner: undefined,
    },
    after: {
      squabbleUsed: options.squabbleAfter ?? options.squabbleBefore ?? false,
      squabbleByOwner: undefined,
    },
  },
});

test("rejects a pass-only tutorial transcript", () => {
  const milestones = getTutorialMilestones({
    effectLog: Array.from({ length: 6 }, (_, index) =>
      event(index + 1, "pass"),
    ),
  });

  assert.deepEqual(milestones, {
    playerCardPlayed: false,
    bankedMotionAfterPlay: false,
    squabbleUsed: false,
  });
  assert.equal(completedTutorialMilestones(milestones), false);
});

test("does not count an end-turn pass or an empty pass as banking Motion", () => {
  const milestones = getTutorialMilestones({
    effectLog: [
      event(1, "play"),
      event(1, "pass"),
      event(2, "pass", { playerMotion: 0 }),
      event(4, "play", { squabbleAfter: true }),
      event(4, "pass"),
    ],
  });

  assert.equal(milestones.playerCardPlayed, true);
  assert.equal(milestones.squabbleUsed, true);
  assert.equal(milestones.bankedMotionAfterPlay, false);
  assert.equal(completedTutorialMilestones(milestones), false);
});

test("rejects banking before the authored round-three lesson", () => {
  const milestones = getTutorialMilestones({
    effectLog: [
      event(1, "play"),
      event(1, "pass"),
      event(2, "pass", { playerMotion: 2 }),
      event(3, "play"),
      event(4, "pass"),
      event(4, "play", { squabbleAfter: true }),
    ],
  });

  assert.equal(milestones.bankedMotionAfterPlay, false);
  assert.equal(milestones.squabbleUsed, true);
  assert.equal(completedTutorialMilestones(milestones), false);
});

test("rejects SQUABBLE before the authored round-four lesson", () => {
  const milestones = getTutorialMilestones({
    effectLog: [
      event(1, "play"),
      event(1, "pass"),
      event(2, "play", { squabbleAfter: true }),
      event(2, "pass", { squabbleBefore: true, squabbleAfter: true }),
      event(3, "pass", { playerMotion: 2, squabbleBefore: true, squabbleAfter: true }),
    ],
  });

  assert.equal(milestones.bankedMotionAfterPlay, true);
  assert.equal(milestones.squabbleUsed, false);
  assert.equal(completedTutorialMilestones(milestones), false);
});

test("requires the authoritative player SQUABBLE state transition", () => {
  const milestones = getTutorialMilestones({
    effectLog: [
      event(1, "play"),
      event(1, "pass"),
      event(2, "pass", { playerMotion: 2 }),
      event(3, "play", { owner: "cpu", squabbleAfter: true }),
      event(4, "play", { squabbleBefore: true, squabbleAfter: true }),
    ],
  });

  assert.equal(milestones.squabbleUsed, false);
  assert.equal(completedTutorialMilestones(milestones), false);
});

test("accepts play, later positive-Motion bank, and player SQUABBLE", () => {
  const milestones = getTutorialMilestones({
    effectLog: [
      event(1, "play"),
      event(1, "pass"),
      event(2, "play"),
      event(2, "pass"),
      event(3, "pass", { playerMotion: 2 }),
      event(4, "play", { squabbleAfter: true }),
      event(4, "pass", { squabbleBefore: true, squabbleAfter: true }),
    ],
  });

  assert.deepEqual(milestones, {
    playerCardPlayed: true,
    bankedMotionAfterPlay: true,
    squabbleUsed: true,
  });
  assert.equal(completedTutorialMilestones(milestones), true);
});
