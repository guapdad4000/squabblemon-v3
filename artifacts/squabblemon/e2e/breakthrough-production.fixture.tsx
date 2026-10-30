// Local-only synthetic audition. The public route remains protected by the all-card release gate.
import React from "react";
import { createRoot } from "react-dom/client";
import { Router, type AroundNavHandler } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BreakthroughPractice } from "../src/pages/game/Breakthrough";
import { getE2EBootstrap } from "../src/pages/game/E2EGamePreview";
import { BREAKTHROUGH_STARTER_DECKS } from "@workspace/squabblemon-engine/breakthroughCatalog";
import {
  rankProgress,
  rankedStats,
} from "@workspace/squabblemon-engine/ranked";
if (!import.meta.env.DEV)
  throw new Error("The synthetic Breakthrough audition is development-only.");
const query = new URLSearchParams(location.search),
  bootstrap = getE2EBootstrap(),
  recipe =
    BREAKTHROUGH_STARTER_DECKS.find((deck) => deck.id === query.get("crew")) ??
    BREAKTHROUGH_STARTER_DECKS[0];
bootstrap.profile.id = query.get("profile")
  ? `breakthrough-synthetic-${query.get("profile")}`
  : "breakthrough-synthetic-account";
bootstrap.profile.displayName = "Studio Player";
bootstrap.profile.level = 18;
bootstrap.profile.avatarKey = "kyle";
bootstrap.profile.settings.reducedMotion = query.get("motion") === "reduced";
const cardIds = [...recipe.catalogCardIds];
if (query.get("unsupported") === "1")
  cardIds[cardIds.length - 1] = "not-a-canonical-card";
bootstrap.profile.savedDecks = [
  {
    id: "fixture-saved-deck",
    name: "My Saved Crew",
    cardIds,
    heroCardId: recipe.hero,
    recipeId: recipe.id,
    valid: true,
    issues: [],
  },
];
const client = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});
client.setQueryData(["fade-park", bootstrap.profile.id], {
  stats: rankedStats({ points: 2350 }),
  progress: rankProgress(2350),
  room: null,
});
// A standalone fixture has no application route switch. Leave this document
// rather than pushing an app URL while the practice renderer stays mounted.
const fixtureHref = (to: string) => {
  if (to !== "/game/kumite") return to;
  const target = new URL("./kumite-matchmaking.fixture.html", location.href);
  if (query.get("motion") === "reduced")
    target.searchParams.set("motion", "reduced");
  return target.href;
};
const navigateFixture: AroundNavHandler = (_navigate, to, options) => {
  const target = fixtureHref(to);
  if (options?.replace) window.location.replace(target);
  else window.location.assign(target);
};
const root = createRoot(document.getElementById("root")!);
import.meta.hot?.dispose(() => root.unmount());
root.render(
  <React.StrictMode>
    <Router hrefs={fixtureHref} aroundNav={navigateFixture}>
      <QueryClientProvider client={client}>
        <BreakthroughPractice bootstrap={bootstrap} />
      </QueryClientProvider>
    </Router>
  </React.StrictMode>,
);
