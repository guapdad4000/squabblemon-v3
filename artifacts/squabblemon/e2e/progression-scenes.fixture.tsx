import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GangWall } from "../src/components/GangWall";
import { Collection } from "../src/pages/game/Collection";
import { Missions } from "../src/pages/game/Missions";
import { Router } from "wouter";
import { CareerBoard } from "../src/pages/game/CareerBoard";
import { cardCatalog } from "../src/data";
import "../src/index.css";
import "../src/styles/studio.css";
const bootstrap: any = {
  profile: {
    ownedCardIds: cardCatalog.slice(0, 35).map((c) => c.catalogId),
    collectionProgress: 40,
    id: "progression-preview",
    settings: { reducedMotion: true },
    discoveredCardIds: [],
    ownedVariants: [],
    equippedVariants: {},
    cardProgression: {},
    packHistory: [],
    streetRep: 50,
    unlockedCosmeticIds: ["badge:street-draft"],
    storyProgress: {
      gameplay: {
        cleansed: true,
        wins: Object.fromEntries(
          cardCatalog.slice(0, 14).map((c, i) => [c.catalogId, (i % 6) + 1]),
        ),
      },
    },
  },
  missions: [],
  collectionRoad: Array.from({ length: 10 }, (_, i) => ({
    id: `test-${i}`,
    threshold: i * 10,
    title: `Block ${i + 1}`,
    description: "Grow your collection",
    rewardLabel: "100 Clout",
    status: i < 3 ? "claimed" : i === 3 ? "claimable" : "locked",
  })),
};
const hall = new URLSearchParams(location.search).has("hall");
const integrated = new URLSearchParams(location.search).has("integrated");
if (integrated && !hall)
  sessionStorage.setItem(
    "squabblemon:navigation:collection-tab:progression-preview",
    '"road"',
  );
const scene = hall ? (
  <CareerBoard bootstrap={bootstrap} />
) : (
  <GangWall
    bootstrap={bootstrap}
    busy={false}
    error=""
    onClaim={(id) => {
      document.body.dataset.claim = id;
    }}
  />
);
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={new QueryClient()}>
    {integrated ? (
      <Router
        hook={() => [hall ? "/game/missions" : "/game/collection", () => {}]}
      >
        <main className="game-route-stage" style={{ height: "100svh" }}>
          {hall ? (
            <Missions bootstrap={bootstrap} />
          ) : (
            <Collection bootstrap={bootstrap} />
          )}
        </main>
      </Router>
    ) : (
      scene
    )}
  </QueryClientProvider>,
);
