import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Fadecade replaces Fight Challenges and opens battles without routing through the old setup", async () => {
  const [hub, app, nav] = await Promise.all([
    readFile(new URL("../../artifacts/squabblemon/src/pages/game/ChallengesHub.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../artifacts/squabblemon/src/pages/game/GameApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../artifacts/squabblemon/src/components/venue/GameNav.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(app, /path="\/game\/challenges"/);
  assert.match(hub, /<FightTabs challenges \/>/);
  assert.doesNotMatch(nav, /label: 'Challenges'/);
  assert.match(hub, /<PlayLoop/);
  assert.match(hub, /challengeRunId=/);
  assert.match(hub, /<FlagshipMachine/);
  assert.match(hub, /<BountyMachine/);
  assert.match(hub, /cadence="daily"/);
  assert.match(hub, /cadence="weekly"/);
  assert.match(hub, /<TrainingMachine/);
  assert.match(hub, /<EventsMachine/);
  assert.doesNotMatch(hub, /navigate\(['"]\/game\/(?:play|missions)['"]\)/);
  assert.match(hub, /useState<BattleConfig \| null>\(null\)/);
});