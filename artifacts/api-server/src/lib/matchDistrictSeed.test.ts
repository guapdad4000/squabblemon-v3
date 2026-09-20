import assert from "node:assert/strict";
import test from "node:test";
import {
  districtSeedForMatch,
  ROOKIE_ROAD_DISTRICT_SEED,
  STORY_DISTRICT_SEED_VERSION,
} from "./matchDistrictSeed";

test("Rookie Road uses one versioned district seed", () => {
  assert.equal(districtSeedForMatch("tutorial", "random-a"), ROOKIE_ROAD_DISTRICT_SEED);
  assert.equal(districtSeedForMatch("tutorial", "random-b"), ROOKIE_ROAD_DISTRICT_SEED);
});

test("each authored story node has one stable versioned district seed", () => {
  const welcome = `${STORY_DISTRICT_SEED_VERSION}:welcome-to-the-block`;
  assert.equal(districtSeedForMatch("story", "random-a", "welcome-to-the-block"), welcome);
  assert.equal(districtSeedForMatch("story", "random-b", "welcome-to-the-block"), welcome);
  assert.notEqual(
    districtSeedForMatch("story", "random-c", "blue-side-pressure"),
    welcome,
  );
});

test("practice, activity, draft, and malformed story requests retain their issued random seed", () => {
  for (const mode of ["practice", "activity", "draft"]) {
    assert.equal(districtSeedForMatch(mode, `${mode}-random`), `${mode}-random`);
  }
  assert.equal(districtSeedForMatch("story", "story-random"), "story-random");
});