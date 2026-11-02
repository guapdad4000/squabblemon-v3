import React from "react";
import { createRoot } from "react-dom/client";
import BreakthroughArena from "../src/components/breakthrough/BreakthroughArena";
import { buildBreakthroughRoster } from "@workspace/squabblemon-engine/breakthroughCatalog";
import { getCardImage } from "../src/data";
if (!import.meta.env.DEV) throw Error("Development-only engine fixture");
const deck = [
  "nabu",
  "enki",
  "utu",
  "ninhursag",
  "inanna",
  "yakub",
  "enlil",
  "ereshkigal",
  "caucus-mountaineer",
  "anu",
];
const roster = buildBreakthroughRoster((card) => getCardImage(card.catalogId));
const root = createRoot(document.getElementById("root")!);
import.meta.hot?.dispose(() => root.unmount());
root.render(
  <BreakthroughArena
    roster={roster}
    playerDeck={deck}
    opponentDeck={deck}
    initialSeed={129}
    identity={{ name: "Anunaki practice", avatarKey: "nabu", heroCardId: "anu", level: 1 }}
    preferredReducedMotion={new URLSearchParams(location.search).has("reduced")}
    onChangeDeck={() => {}}
    onExit={() => {}}
  />,
);
