import { catalogCardByEngineId, catalogCardById, decks } from "./data";
import { normalizeCardProgress, type CardProgressionMap } from "./cardProgression";

export type TrainingDifficulty = "Rookie" | "Even Match" | "Advanced";

const deckTier: Record<string, number> = {
  block: 1,
  slide: 1,
  crashout: 1,
  receipts: 2,
  vibes: 2,
  combo: 3,
  compound: 3,
};

export const TRAINING_REWARD_RULES = {
  winCardXp: 30,
  drawCardXp: 25,
  lossCardXp: 20,
  dailyLimit: null,
  repeatLimit: null,
  grantsProfileXp: false,
  grantsCurrency: false,
} as const;

export function trainingCrewLevel(
  catalogCardIds: string[],
  progression: CardProgressionMap,
): number {
  if (catalogCardIds.length === 0) return 1;
  return catalogCardIds.reduce(
    (sum, cardId) => {
      const catalogId =
        catalogCardById[cardId]?.catalogId ??
        catalogCardByEngineId[cardId]?.catalogId ??
        cardId;
      return sum + normalizeCardProgress(progression[catalogId]).level;
    },
    0,
  ) / catalogCardIds.length;
}

export function trainingBandForLevel(averageLevel: number): number {
  return averageLevel < 3 ? 1 : averageLevel < 6 ? 2 : 3;
}

export function selectTrainingRival(
  playerDeckId: string,
  catalogCardIds: string[],
  progression: CardProgressionMap,
): string {
  const targetTier = trainingBandForLevel(trainingCrewLevel(catalogCardIds, progression));
  return [...decks]
    .filter((deck) => deck.id !== playerDeckId)
    .sort((a, b) =>
      Math.abs((deckTier[a.id] ?? 2) - targetTier) -
        Math.abs((deckTier[b.id] ?? 2) - targetTier) ||
      a.id.localeCompare(b.id),
    )[0]!.id;
}

export function trainingDifficulty(
  playerDeckId: string,
  rivalDeckId: string,
  catalogCardIds: string[],
  progression: CardProgressionMap,
): TrainingDifficulty {
  const playerBand = trainingBandForLevel(trainingCrewLevel(catalogCardIds, progression));
  const difference = (deckTier[rivalDeckId] ?? 2) - playerBand;
  if (difference < 0) return "Rookie";
  if (difference > 0) return "Advanced";
  return "Even Match";
}