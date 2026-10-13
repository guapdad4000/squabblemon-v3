import { ChallengesHub } from '../src/pages/game/ChallengesHub';
import { PersonalFadeRecordDisplay } from '../src/components/social/PersonalFadeRecord';
import { johnHenryMythicStatus } from "@workspace/squabblemon-engine/johnHenryMythic";
import { recommendedWorkshopCrews } from "../src/lib/deckWorkshop";
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Dialog } from "../src/components/ui/dialog";
import {
  cardCatalog,
  starterRecipes,
  catalogCardByEngineId,
} from "../src/data";
import { profileBootstrap } from "./fighter-id.fixture";
import {
  CommunityCrews,
  type CommunityFeed,
} from "../src/components/CommunityCrews";
import { DeckWorkbench } from "../src/components/DeckWorkbench";
import { FadePark } from "../src/pages/game/FadePark";
import { ParkResult } from "../src/components/ParkResult";
import { LegendBountyJourney } from "../src/components/LegendBountyJourney";
import { Missions } from "../src/pages/game/Missions";
import { CityHeader } from "../src/components/venue/CityHeader";
import {
  rankedStats,
  rankProgress,
} from "@workspace/squabblemon-engine/multiplayer";
import { legendBountyStatuses } from "@workspace/squabblemon-engine/legendBounties";
import {
  STARTER_MYTHIC,
  starterMythicStatus,
} from "@workspace/squabblemon-engine/starterMythic";
import { getGetPlayerBootstrapQueryKey } from "@workspace/api-client-react";
import "../src/index.css";
import "../src/styles/venue.css";
const params = new URLSearchParams(location.search),
  screen = params.get("screen") ?? "community",
  recipe = starterRecipes[0];
const bootstrap = profileBootstrap({
  id: "player-notes-demo",
  displayName: "GUAP.DAD",
  avatarKey: "guap",
  ownedCardIds: cardCatalog
    .filter((c) => c.kind !== "token")
    .map((c) => c.catalogId),
  savedDecks: [
    {
      id: "custom",
      name: "MY CREW",
      cardIds: recipe.catalogCardIds,
      heroCardId: recipe.hero,
      recipeId: null,
    },
  ],
  settings: {
    reducedMotion: params.get("motion") === "reduce",
    turnTimerEnabled: false,
  },
});
bootstrap.missions = [
  {
    id: "demo-mission",
    title: "Take A Room",
    description: "Win 2 fades today.",
    cadence: "daily",
    goal: 2,
    progress: 2,
    rewardCurrency: "softCurrency",
    rewardAmount: 150,
    status: "claimable",
    resetAt: "2026-10-13T00:00:00Z",
  },
];
const stats = {
  ...rankedStats(null),
  points: 675,
  wins: 24,
  losses: 14,
  games: 38,
};
const statuses = legendBountyStatuses(
  {},
  [],
  bootstrap.profile.ownedCardIds,
  [STARTER_MYTHIC.key],
  {},
);
const mkCrew = (i: number, week = "2026-10-12") => ({
  id: `00000000-0000-4000-8000-00000000000${i}`,
  week,
  name: ["THE CIRCUIT", "TOUR MONEY", "EVERYBODY EATS"][i % 3],
  strategy: [
    "Open cheap movers. Visit three districts, protect your runner, then finish the circuit.",
    "Spread performers early. Bring the tour together for a protected late-game finale.",
    "Feed the weakest ally, keep the family safe, and make the whole board eat.",
  ][i % 3],
  cardIds: [
    recommendedWorkshopCrews.fitness,
    recommendedWorkshopCrews.music,
    recommendedWorkshopCrews.family,
  ][i % 3].map((id) => catalogCardByEngineId[id].catalogId),
  heroCardId: ["personal-trainer", "the-rapper", "plate-auntie"][i % 3],
  author: ["MYA MOVES", "AUX LORD", "PLATE AUNTIE"][i % 3],
  avatarKey: ["ashlee", "guap", "church-auntie"][i % 3],
  votes: 28 - i * 5,
  voted: false,
  isOwn: false,
  createdAt: "2026-10-12T12:00:00Z",
});
let feed: CommunityFeed = {
  week: "2026-10-12",
  previousWeek: "2026-10-05",
  submissions: [mkCrew(0), mkCrew(1), mkCrew(2)],
  weeklyPicks: [
    mkCrew(0, "2026-10-05"),
    mkCrew(1, "2026-10-05"),
    mkCrew(2, "2026-10-05"),
  ],
  submitted: false,
  selectionRule:
    "Last week’s three most voted crews. Ties go to the earliest submission. Voting closes Monday at 00:00 UTC.",
};
if (params.get('limited') === 'true') bootstrap.profile.ownedCardIds = [...new Set([...feed.weeklyPicks[0].cardIds, ...bootstrap.profile.ownedCardIds.slice(0,35)])].filter(id=>id!==feed.weeklyPicks[0].cardIds[2]);
const originalFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const url = String(input instanceof Request ? input.url : input);
  if (!url.includes("/api/")) return originalFetch(input, init);
  const path = new URL(url, location.origin).pathname;
  let data: unknown = {};
  if (path === "/api/multiplayer/ranked")
    data = { stats, progress: rankProgress(stats.points), room: null };
  else if (path.endsWith("/standings"))
    data = {
      season: stats.season,
      total: 842,
      updatedAt: new Date().toISOString(),
      you: {
        name: "GUAP.DAD",
        avatarKey: "guap",
        position: 18,
        points: 675,
        wins: 24,
        games: 38,
        tier: "Gold",
        isYou: true,
      },
      leaders: Array.from({ length: 20 }, (_, i) => ({
        name:
          ["NORTHSIDE MYA", "UNC GOT HANDS", "AUX LORD"][i % 3] +
          (i > 2 ? " " + i : ""),
        avatarKey: ["ashlee", "church-auntie", "guap"][i % 3],
        position: i + 1,
        points: 2150 - i * 60,
        wins: 35 - i,
        games: 50 - i,
        tier: rankProgress(2150 - i * 60).tier,
        isYou: false,
      })),
    };
  else if (path.endsWith("/community-decks/archive")) data = {weeks:[{week:feed.previousWeek,picks:feed.weeklyPicks}]};
  else if (path.includes("/player/decks/")) data=bootstrap;
  else if (path.includes("/community-decks")) {
    if (init?.method === "POST") {
      if (path.endsWith("/vote"))
        feed = {
          ...feed,
          submissions: feed.submissions.map((c) =>
            path.includes(c.id) ? { ...c, voted: true, votes: c.votes + 1 } : c,
          ),
        };
      else feed = { ...feed, submitted: true };
    }
    data = feed;
  } else if (path.includes("/challenges/runs")) data=params.get("badRuns")==="true"?{error:"bad response"}:[];
  else if (path.endsWith("/starter-mythic"))
    data = starterMythicStatus([], false, true);
  else if (path.endsWith("/john-henry"))
    data = johnHenryMythicStatus([], false, true);
  else if (path.endsWith("/legend-bounties")) data = statuses;
  else if (path.endsWith("/bootstrap")) data = bootstrap;
  else if (path.includes("/missions/"))
    data = {
      ...bootstrap,
      missions: bootstrap.missions.map((m) => ({ ...m, status: "claimed" })),
      profile: {
        ...bootstrap.profile,
        softCurrency: bootstrap.profile.softCurrency + 150,
      },
    };
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
  });
};
Object.assign(window, {
  playerNotesFixture: { feed: () => feed, bootstrap: () => bootstrap },
});
const client = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});
client.setQueryData(getGetPlayerBootstrapQueryKey(), bootstrap);
function Fixture() {
  const [open, setOpen] = useState(true);
  return (
    <main
      style={{ minHeight: "100dvh", background: "#101b22", color: "#fff1d6" }}
    >
      {screen !== "park" && screen !== "rank" && (
        <CityHeader bootstrap={bootstrap} />
      )}
      {screen === "friendly-record" && <div style={{maxWidth:640,margin:'4rem auto'}}><h1>FRIENDLY FADE</h1><PersonalFadeRecordDisplay rival="LOUDMOUTH KYLE" player={{friendCode:'ABCDEF000001',homie:true,personal:{wins:7,losses:3,draws:1},overall:{wins:42,losses:27,draws:4}}} /><p>Records shown are demonstration data.</p></div>}
      {screen === "community" && <CommunityCrews bootstrap={bootstrap} />}
      {screen === "fadecade" && <ChallengesHub bootstrap={bootstrap} />}
      {screen === "park" && <FadePark bootstrap={bootstrap} />}
      {screen === "auto" && (
        <div
          style={{
            height: "calc(100dvh - 66px)",
            minHeight: 0,
            overflow: "hidden",
          }}
        >
          <DeckWorkbench
            initial={{
              name: "MY CREW",
              cardIds: recipe.catalogCardIds,
              heroCardId: recipe.hero,
              recipeId: null,
            }}
            ownedCardIds={bootstrap.profile.ownedCardIds}
            equippedVariants={{}}
            onDraftChange={(draft) =>
              Object.assign(window, { notesDraft: draft })
            }
            onSave={async () => {}}
            onTest={async () => {}}
          />
        </div>
      )}
      {screen === "bounties" && <Missions bootstrap={bootstrap} />}
      {screen === "journey" && open && (
        <LegendBountyJourney
          bounty={statuses[0]}
          busy={false}
          onClose={() => setOpen(false)}
          onClaim={() => {}}
          onNext={() => {}}
        />
      )}
      {screen === "rank" && (
        <Dialog open={open} onOpenChange={setOpen}>
          <ParkResult
            outcome="win"
            ranked
            rank={{
              before: 280,
              after: 305,
              delta: 25,
              tier: "Silver",
              outcome: "win",
              bot: false,
              rewards: [
                {
                  tier: "Silver",
                  softCurrency: 350,
                  packTickets: 1,
                  styleShards: 30,
                },
              ],
            }}
            description="You won the full fade."
            claimed={2}
            rivalClaimed={1}
            reducedMotion={bootstrap.profile.settings.reducedMotion}
          >
            <button onClick={() => setOpen(false)}>Back to park</button>
          </ParkResult>
        </Dialog>
      )}
    </main>
  );
}
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={client}>
    <Fixture />
  </QueryClientProvider>,
);
