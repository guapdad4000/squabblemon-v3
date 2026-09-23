import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("player routes preserve their parsers and challenge transitions stay inside transactions", async () => {
  const [player, rewards, challenge] = await Promise.all([
    readFile(new URL("../../artifacts/api-server/src/routes/player.ts", import.meta.url), "utf8"),
    readFile(new URL("../../artifacts/api-server/src/lib/playerRewardTransactions.ts", import.meta.url), "utf8"),
    readFile(new URL("../../artifacts/api-server/src/routes/challenge.ts", import.meta.url), "utf8"),
  ]);

  assert.match(player, /router\.patch\("\/player\/profile"[\s\S]*?UpdatePlayerProfileBody\.safeParse/);
  assert.match(player, /router\.post\("\/player\/onboarding"[\s\S]*?AdvancePlayerOnboardingBody\.safeParse/);
  assert.match(player, /router\.post\("\/player\/matches"[\s\S]*?StartPlayerMatchBody\.safeParse/);
  assert.match(player, /challengeRunId && parsed\.data\.mode !== "practice"/);
  assert.match(player, /"\/player\/matches\/:matchId\/complete"[\s\S]*?CompletePlayerMatchParams\.safeParse[\s\S]*?CompletePlayerMatchBody\.safeParse/);
  assert.match(player, /tx\.insert\(playerMatchesTable\)[\s\S]*?challengeRunId[\s\S]*?tx\.update\(challengeRunsTable\)/);
  assert.match(rewards, /update\(playerMatchesTable\)[\s\S]*?update\(challengeRunsTable\)/);
  assert.match(rewards, /challengeDraw[\s\S]*?xp: 0[\s\S]*?participantCardIds = challengeDraw/);
  assert.match(challenge, /encounterSnapshot: encounterFor\(seed, 0\)/);
  assert.doesNotMatch(challenge, /encounterFor\(seed, 0, matchId\)/);

  const exportAt = player.lastIndexOf("export default router;");
  assert.ok(exportAt > 0);
  assert.equal(player.slice(exportAt + "export default router;".length).trim(), "");
});