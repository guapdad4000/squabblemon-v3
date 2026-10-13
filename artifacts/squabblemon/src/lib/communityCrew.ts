import { catalogCardById, type Deck } from "../data";
import { autoBuildDeck, type DeckDraft } from "./deckWorkshop";
export function crewLoaner(crew: {
  id: string;
  name: string;
  strategy: string;
  cardIds: string[];
  heroCardId: string;
}): Deck {
  if (
    crew.cardIds.length !== 10 ||
    new Set(crew.cardIds).size !== 10 ||
    crew.cardIds.some(
      (id) => !catalogCardById[id] || catalogCardById[id].kind === "token",
    ) ||
    !crew.cardIds.includes(crew.heroCardId)
  )
    throw new Error(
      "This crew needs an updated legal lineup before it can be tried.",
    );
  return {
    id: `loaner-${crew.id}`,
    name: crew.name,
    archetype: "Player loaner",
    accent: "#ffc46d",
    plan: crew.strategy,
    cards: [...crew.cardIds],
    hero: crew.heroCardId,
  };
}
export function ownedCrewVersion(
  crew: { name: string; cardIds: string[]; heroCardId: string },
  ownedIds: readonly string[],
): { draft: DeckDraft; missing: string[] } {
  const owned = new Set(ownedIds);
  const kept = crew.cardIds.filter((id) => owned.has(id));
  const draft = {
    name: `${crew.name.slice(0, 23)} · My Mix`,
    cardIds: kept,
    heroCardId: owned.has(crew.heroCardId)
      ? crew.heroCardId
      : (kept.find((id) => catalogCardById[id].kind !== "support") ??
        kept[0] ??
        ""),
    recipeId: null,
  };
  return {
    draft: kept.length === 10 ? draft : autoBuildDeck(draft, ownedIds),
    missing: crew.cardIds.filter((id) => !owned.has(id)),
  };
}
