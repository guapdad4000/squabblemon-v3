import {
  CARD_XP_CAP,
  cardLevelFromXp,
  normalizeCardProgress,
  type CardProgressionMap,
} from "@workspace/squabblemon-engine/cardProgression";
import {
  catalogCardByEngineId,
  catalogCardById,
} from "@workspace/squabblemon-engine/data";
import type { Match } from "@workspace/squabblemon-engine/gameEngine";

export type CardProgressionSnapshot = Array<{
  cardId: string;
  xp: number;
  level: number;
}>;

export type CardXpReward = {
  cardId: string;
  xpGained: number;
  previousXp: number;
  previousLevel: number;
  xp: number;
  level: number;
};

export function normalizeCatalogCardId(cardId: string): string | null {
  return (
    catalogCardById[cardId]?.catalogId ??
    catalogCardByEngineId[cardId]?.catalogId ??
    null
  );
}

export function createCardProgressionSnapshot(
  cardIds: string[],
  ownedCardIds: string[],
  progression: CardProgressionMap,
  allowUnowned = false,
): CardProgressionSnapshot {
  const owned = new Set(ownedCardIds);
  const normalized = cardIds.map(normalizeCatalogCardId);
  if (
    normalized.some(
      (cardId) => !cardId || (!allowUnowned && !owned.has(cardId)),
    )
  ) {
    throw new Error("Match roster contains an unowned card");
  }
  return [...new Set(normalized as string[])].map((cardId) => ({
    cardId,
    ...normalizeCardProgress(progression[cardId]),
  }));
}

export function participatingCatalogCardIds(match: Match): string[] {
  const played = match.boards
    .flat()
    .filter((card) => card.owner === "player" && card.playedRound !== null)
    .map((card) => normalizeCatalogCardId(card.cardId))
    .filter((cardId): cardId is string => Boolean(cardId));
  return [...new Set(played)];
}

export function cardXpForOutcome(outcome: "win" | "loss" | "draw"): number {
  return outcome === "win" ? 30 : outcome === "draw" ? 25 : 20;
}

export function applyCardXp(
  progression: CardProgressionMap,
  snapshot: CardProgressionSnapshot,
  participantCardIds: string[],
  outcome: "win" | "loss" | "draw",
): { progression: CardProgressionMap; rewards: CardXpReward[] } {
  const eligible = new Set(snapshot.map((card) => card.cardId));
  const next = { ...progression };
  const rewards = [...new Set(participantCardIds)]
    .filter((cardId) => eligible.has(cardId))
    .map((cardId) => {
      const previous = normalizeCardProgress(next[cardId]);
      const xp = Math.min(CARD_XP_CAP, previous.xp + cardXpForOutcome(outcome));
      const updated = { xp, level: cardLevelFromXp(xp) };
      next[cardId] = updated;
      return {
        cardId,
        xpGained: xp - previous.xp,
        previousXp: previous.xp,
        previousLevel: previous.level,
        ...updated,
      };
    });
  return { progression: next, rewards };
}