import assert from "node:assert/strict";
import test from "node:test";
import {
  createMatch,
  createCardInstance,
  mergeStoryObjectiveProgress,
  recoverLegacyStoryObjectiveIds,
  type Match,
  type StoryStarObjective,
} from "./gameEngine";
import { autoBuildDeck } from "./lib/deckWorkshop";
import {
  cardCatalog,
  catalogCardById,
  canonicalElement,
  validateSavedDeck,
} from "./data";
import {
  RANKED_BOT_WAIT_MS,
  rankMilestoneRewards,
} from "@workspace/squabblemon-engine/ranked";
import {
  PARK_BOT_PERSONAS,
  reactParkBot,
  parkBotUsesSquabble,
} from "@workspace/squabblemon-engine/parkBots";
import {
  createOnlineRoom,
  type OnlineRoom,
} from "@workspace/squabblemon-engine/multiplayer";
import { LEGEND_BOUNTIES } from "@workspace/squabblemon-engine/legendBounties";
const objectives: StoryStarObjective[] = [
  { id: "win", description: "Win", criterion: { kind: "win" } },
  {
    id: "sweep",
    description: "Hold three",
    criterion: { kind: "districts-held", owner: "player", atLeast: 3 },
  },
  {
    id: "clean",
    description: "Without squabble",
    criterion: { kind: "squabble-used", owner: "player", used: false },
  },
];
function won(sweep = false, squabble = false): Match {
  const m = createMatch("block", "combo");
  m.phase = "complete";
  m.round = 6;
  m.squabbleByOwner = { player: squabble, cpu: false };
  m.storyEncounter = {
    id: "notes",
    enemy: {
      name: "Rival",
      deckId: "combo",
      cardIds: m.cpuCardIds,
      behaviorProfile: "balanced",
    },
    starObjectives: objectives,
  };
  m.boards = ([0, 1, 2] as const).map((lane) => {
    const c = createCardInstance(
      "cornball",
      lane === 2 && !sweep ? "cpu" : "player",
      "notes",
      lane,
    );
    c.lane = lane;
    c.basePower = 10;
    return [c];
  });
  return m;
}
test("story replay banks a missing objective without repeating the other two", () => {
  const first = mergeStoryObjectiveProgress(won());
  assert.equal(first.stars, 2);
  assert.deepEqual(first.completedObjectiveIds, ["win", "clean"]);
  const second = mergeStoryObjectiveProgress(
    won(true, true),
    first.completedObjectiveIds,
    first.stars,
  );
  assert.equal(second.stars, 3);
  assert.deepEqual(second.completedObjectiveIds, ["win", "clean", "sweep"]);
  assert.deepEqual(
    mergeStoryObjectiveProgress(won(), second.completedObjectiveIds, 3),
    second,
  );
  const loss = won();
  loss.boards[0][0].owner = "cpu";
  assert.equal(mergeStoryObjectiveProgress(loss, ["win"], 1).stars, 1);
});
test("legacy two-star receipts recover provable objectives without guessing", () => {
  assert.deepEqual(
    recoverLegacyStoryObjectiveIds([
      { outcome: "win", districtsWon: 2, storyStars: 2, objectives },
    ]),
    ["win", "clean"],
  );
  assert.deepEqual(
    recoverLegacyStoryObjectiveIds([
      { outcome: "win", districtsWon: 3, storyStars: 2, objectives },
    ]),
    ["win", "sweep"],
  );
  assert.deepEqual(
    recoverLegacyStoryObjectiveIds([
      { outcome: "loss", districtsWon: 1, storyStars: 0, objectives },
    ]),
    [],
  );
});
test("each element auto-build uses owned unique cards, changes the cover, and orders playable openers", () => {
  const owned = cardCatalog
    .filter((c) => c.kind !== "token")
    .map((c) => c.catalogId);
  for (const element of new Set(
    cardCatalog.map((c) => canonicalElement(c.type)),
  )) {
    const next = autoBuildDeck(
      {
        name: "Player crew",
        cardIds: owned.slice(0, 10),
        heroCardId: owned[0],
        recipeId: null,
      },
      owned,
      element,
    );
    assert(
      validateSavedDeck(next.cardIds, owned, next.heroCardId).valid,
      element,
    );
    assert.equal(
      canonicalElement(catalogCardById[next.heroCardId].type),
      element,
    );
    const count = next.cardIds.filter(
      (id) => canonicalElement(catalogCardById[id].type) === element,
    ).length;
    assert(
      count >=
        Math.min(
          10,
          owned.filter(
            (id) => canonicalElement(catalogCardById[id].type) === element,
          ).length,
        ),
      `${element} focus ${count}`,
    );
    assert.equal(next.recipeId, null);
    assert(new Set(next.cardIds).size === 10);
  }
});
test("promotion rewards include skipped tiers and exclude previously reached tiers", () => {
  assert.equal(RANKED_BOT_WAIT_MS, 6000);
  assert.deepEqual(
    rankMilestoneRewards(99, 100).map((r) => r.tier),
    ["Bronze"],
  );
  assert.deepEqual(
    rankMilestoneRewards(300, 1000).map((r) => r.tier),
    ["Gold", "Platinum"],
  );
  assert.deepEqual(rankMilestoneRewards(1000, 600), []);
});
test("park personas have distinct valid portraits and bounded gameplay reactions", () => {
  assert.equal(new Set(PARK_BOT_PERSONAS.map((p) => p.name)).size, 4);
  for (const persona of PARK_BOT_PERSONAS)
    assert(catalogCardById[persona.bannerCardId], persona.bannerCardId);
  const member = {
    userId: "human",
    name: "Human",
    deck: {
      id: "block",
      name: "Block",
      hero: "cornball",
      cards: createMatch("block", "combo").playerCardIds,
    },
    ready: true,
  };
  const before = createOnlineRoom(member, "player", 0) as OnlineRoom;
  before.status = "active";
  before.match = won(false, false);
  before.match.phase = "player";
  before.ranked = {
    queuedAt: 0,
    heartbeatAt: 0,
    botAfter: 0,
    bot: true,
    botPersona: "loudmouth",
    ratings: { player: 1000, cpu: 1000 },
  };
  const after = structuredClone(before);
  after.match!.squabbleByOwner!.player = true;
  after.revision++;
  const blocker = createCardInstance("the-concert", "cpu", "notes", 0);
  blocker.basePower = 8;
  before.match!.round = 6;
  assert.equal(
    parkBotUsesSquabble(before, blocker),
    false,
    "Blockbusters never use SQUABBLE",
  );
  const reacted = reactParkBot(before, after, 1000);
  assert.equal(
    reacted.reactions?.latest.cpu?.reactionId,
    "reaction:kyle:shocked:v1",
  );
  assert.equal(reacted.ranked?.botReactionCount, 1);
  assert.equal(reactParkBot(before, reacted, 2000), reacted);
  const capped = {
    ...after,
    ranked: { ...after.ranked!, botReactionCount: 3 },
  };
  assert.equal(reactParkBot(before, capped, 20000), capped);
  assert.equal(
    LEGEND_BOUNTIES.find((b) => b.id === "kyle")!.nodes[1].description,
    "Win all 3 districts in 4 verified fades.",
  );
  assert(LEGEND_BOUNTIES.every((b) => b.nodes.every((n) => n.goal >= 2)));
});

test("after a first clear, a skill-only objective can earn its missing star even on a loss", () => {
  const first = won();
  first.storyEncounter = {
    ...first.storyEncounter!,
    starObjectives: [
      { id: "win", description: "Win", criterion: { kind: "win" } },
      {
        id: "motion",
        description: "Finish with 1 Motion",
        criterion: { kind: "motion-remaining", owner: "player", atLeast: 1 },
      },
      {
        id: "movement",
        description: "Move an ally",
        criterion: { kind: "cards-moved", owner: "player", atLeast: 1 },
      },
    ],
  };
  const banked = mergeStoryObjectiveProgress(first);
  assert.equal(banked.stars, 2);
  const replay = structuredClone(first);
  replay.boards[0][0].owner = "cpu";
  replay.boards[1][0].moved = true;
  replay.playerMotion = 0;
  assert.equal(
    mergeStoryObjectiveProgress(replay, banked.completedObjectiveIds, 2, false)
      .stars,
    2,
    "a first clear is required",
  );
  assert.equal(
    mergeStoryObjectiveProgress(replay, banked.completedObjectiveIds, 2, true)
      .stars,
    3,
    "only the missing movement objective is earned",
  );
  const victoryOnly = won();
  victoryOnly.boards[0][0].owner = "cpu";
  assert.equal(
    mergeStoryObjectiveProgress(
      victoryOnly,
      [],
      0,
      true,
    ).completedObjectiveIds.includes("clean"),
    false,
    "win without SQUABBLE remains a victory goal",
  );
});
