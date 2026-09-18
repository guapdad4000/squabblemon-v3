export const CARD_LEVEL_CAP = 10;

export type CardProgress = {
  xp: number;
  level: number;
  /** Missing on legacy saves: previously earned move tiers are preserved. */
  moveTier?: number;
};

export type CardProgressionMap = Record<string, CardProgress>;

export function totalXpForCardLevel(level: number): number {
  const boundedLevel = Math.max(1, Math.min(CARD_LEVEL_CAP, Math.floor(level)));
  return 50 * boundedLevel * (boundedLevel - 1);
}

export const CARD_XP_CAP = totalXpForCardLevel(CARD_LEVEL_CAP);

export function cardLevelFromXp(xp: number): number {
  const safeXp = Math.max(0, Math.min(CARD_XP_CAP, Math.floor(xp)));
  for (let level = CARD_LEVEL_CAP; level >= 1; level -= 1) {
    if (safeXp >= totalXpForCardLevel(level)) return level;
  }
  return 1;
}

export function normalizeCardProgress(progress?: Partial<CardProgress> | null): CardProgress {
  const rawXp = Number.isFinite(progress?.xp) ? progress!.xp! : 0;
  const xp = Math.max(0, Math.min(CARD_XP_CAP, Math.floor(rawXp)));
  const level = cardLevelFromXp(xp);
  const eligible = [2, 5, 8].filter(required => level >= required).length;
  const legacyTier = progress ? eligible : 0;
  const rawTier = progress?.moveTier === undefined ? legacyTier : Number.isFinite(progress.moveTier) ? progress.moveTier : 0;
  return { xp, level, moveTier: Math.max(0, Math.min(eligible, Math.floor(rawTier))) };
}

export function cardProgressDetails(progress?: Partial<CardProgress> | null) {
  const normalized = normalizeCardProgress(progress);
  const levelStartXp = totalXpForCardLevel(normalized.level);
  const nextLevelXp =
    normalized.level >= CARD_LEVEL_CAP
      ? CARD_XP_CAP
      : totalXpForCardLevel(normalized.level + 1);
  return {
    ...normalized,
    levelStartXp,
    nextLevelXp,
    xpIntoLevel: normalized.xp - levelStartXp,
    xpForNextLevel: Math.max(0, nextLevelXp - levelStartXp),
    progressPercent:
      normalized.level >= CARD_LEVEL_CAP
        ? 100
        : ((normalized.xp - levelStartXp) / (nextLevelXp - levelStartXp)) * 100,
    isMaxLevel: normalized.level >= CARD_LEVEL_CAP,
  };
}
