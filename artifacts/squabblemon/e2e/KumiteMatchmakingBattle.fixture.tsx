import { useMemo, useState } from "react";
import {
  buildBreakthroughRoster,
  BREAKTHROUGH_STARTER_DECKS,
} from "@workspace/squabblemon-engine/breakthroughCatalog";
import BreakthroughArena from "../src/components/breakthrough/BreakthroughArena";
import { getCardImage } from "../src/data";
if (!import.meta.env.DEV)
  throw new Error("Synthetic Kumite entry is development-only.");

export default function KumiteMatchmakingBattle({
  reducedMotion,
  onExit,
}: {
  reducedMotion: boolean;
  onExit(): void;
}) {
  const roster = useMemo(
    () => buildBreakthroughRoster((card) => getCardImage(card.catalogId)),
    [],
  );
  const [seed] = useState(() => crypto.getRandomValues(new Uint32Array(1))[0]);
  const crew =
    BREAKTHROUGH_STARTER_DECKS.find((deck) => deck.id === "combo") ??
    BREAKTHROUGH_STARTER_DECKS[0];
  const opps =
    BREAKTHROUGH_STARTER_DECKS.find((deck) => deck.id === "voltage") ??
    BREAKTHROUGH_STARTER_DECKS[1];
  return (
    <BreakthroughArena
      roster={roster}
      playerDeck={[...crew.catalogCardIds]}
      opponentDeck={[...opps.catalogCardIds]}
      identity={{
        name: "GUAP.DAD",
        avatarKey: "kyle",
        heroCardId: crew.hero,
        level: 18,
        rank: "Park Royalty",
      }}
      initialSeed={seed}
      preferredReducedMotion={reducedMotion}
      onExit={onExit}
      onChangeDeck={onExit}
    />
  );
}
