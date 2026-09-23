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
import {
  ABILITY_UPGRADE_SNAPSHOT_VERSION,
  unlockedAbilityUpgrades,
} from "@workspace/squabblemon-engine/abilityUpgrades";
import { CARD_BALANCE_VERSION } from "@workspace/squabblemon-engine/multiplayer";
import type { Match } from "@workspace/squabblemon-engine/gameEngine";

export const CARD_UPGRADE_SNAPSHOT_VERSION = ABILITY_UPGRADE_SNAPSHOT_VERSION;

export type AbilityUpgradeSnapshot = {
  version: typeof CARD_UPGRADE_SNAPSHOT_VERSION;
  player: Array<{ cardId: string; level: number; moveTier?: number; upgradeIds: string[] }>;
  cpu: Array<{ cardId: string; level: number; moveTier?: number; upgradeIds: string[] }>;
};
export type CardProgressionSnapshotEntry = {
  cardId: string;
  xp: number;
  level: number;
  moveTier?: number;
};

export type CardProgressionSnapshot = {
  version: typeof CARD_UPGRADE_SNAPSHOT_VERSION;
  /** The card rules used to issue and verify this reward-bearing fade. */
  balanceRulesVersion: typeof CARD_BALANCE_VERSION;
  cards: CardProgressionSnapshotEntry[];
  abilityUpgradeSnapshot: AbilityUpgradeSnapshot;
};

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

function resolveUpgradeIds(cardId: string, level: number): string[] {
  const card = catalogCardByEngineId[cardId] ?? catalogCardById[cardId];
  // Upgrades are authored on catalog cards by the engine content package.
  // Keep this narrow runtime boundary here so a malformed content release
  // cannot become a reward-bearing match snapshot.
  const upgrades = card?.abilityUpgrades;
  if (!Array.isArray(upgrades) || upgrades.length !== 3) {
    throw new Error(`Card ${cardId} has an incomplete upgrade path`);
  }
  return [...unlockedAbilityUpgrades(card.engineId, level)].map(
    (upgrade) => upgrade.id,
  );
}

export function createCardProgressionSnapshot(
  cardIds: string[],
  ownedCardIds: string[],
  progression: CardProgressionMap,
  allowUnowned = false,
  cpuCardIds: string[] = [],
): CardProgressionSnapshot {
  const owned = new Set(ownedCardIds);
  const normalized = cardIds.map(normalizeCatalogCardId);
  if (
    normalized.some(
      (cardId) => !cardId || (!allowUnowned && !owned.has(cardId)),
    )
  ) {
    throw new Error("Fade roster contains an unowned card");
  }
  const cards = [...new Set(normalized as string[])].map((cardId) => {
    const progress = normalizeCardProgress(progression[cardId]);
    return {
      cardId,
      ...progress,
    };
  });
  const player = cardIds.map((engineId) => {
    const catalogId = normalizeCatalogCardId(engineId);
    if (!catalogId) throw new Error(`Unknown card ${engineId}`);
    const progress = cards.find((card) => card.cardId === catalogId);
    const level = progress?.level;
    if (!level) throw new Error(`Missing progression for ${engineId}`);
    return { cardId: engineId, level, moveTier: progress.moveTier, upgradeIds: resolveUpgradeIds(engineId, level).slice(0, progress.moveTier) };
  });
  const cpu = cpuCardIds.map((cardId) => ({
    cardId,
    level: 1,
    upgradeIds: resolveUpgradeIds(cardId, 1),
  }));
  return {
    version: CARD_UPGRADE_SNAPSHOT_VERSION,
    balanceRulesVersion: CARD_BALANCE_VERSION,
    cards,
    abilityUpgradeSnapshot: {
      version: CARD_UPGRADE_SNAPSHOT_VERSION,
      player,
      cpu,
    },
  };
}

/**
 * Treat persisted snapshots as hostile input.  The level is bound to the
 * stored progression snapshot and every resolved upgrade is compared to the
 * authored definition at that level.  This prevents a manually altered JSONB
 * value from granting an unearned or fabricated effect during verification.
 */
export function parseCardProgressionSnapshot(
  value: unknown,
  expectedPlayerCards: readonly string[],
  expectedCpuCards: readonly string[],
): CardProgressionSnapshot {
  if (
    !value ||
    typeof value !== "object" ||
    (value as CardProgressionSnapshot).version !== CARD_UPGRADE_SNAPSHOT_VERSION ||
    (value as CardProgressionSnapshot).balanceRulesVersion !== CARD_BALANCE_VERSION ||
    !Array.isArray((value as CardProgressionSnapshot).cards) ||
    !(value as CardProgressionSnapshot).abilityUpgradeSnapshot
  ) {
    throw new Error("Fade upgrade snapshot is missing");
  }
  const snapshot = value as CardProgressionSnapshot;
  const entries = snapshot.cards.map((entry) => {
    if (
      !entry ||
      typeof entry !== "object" ||
      typeof (entry as CardProgressionSnapshotEntry).cardId !== "string" ||
      !Number.isInteger((entry as CardProgressionSnapshotEntry).xp) ||
       !Number.isInteger((entry as CardProgressionSnapshotEntry).level)
    ) {
      throw new Error("Fade upgrade snapshot is malformed");
    }
    const parsed = entry as CardProgressionSnapshotEntry;
    const canonicalId = normalizeCatalogCardId(parsed.cardId);
    if (!canonicalId || canonicalId !== parsed.cardId) {
      throw new Error("Fade upgrade snapshot has an unknown card");
    }
    const normalized = normalizeCardProgress(parsed);
    if (normalized.xp !== parsed.xp || normalized.level !== parsed.level || (parsed.moveTier !== undefined && normalized.moveTier !== parsed.moveTier)) {
      throw new Error("Fade upgrade snapshot has invalid progression");
    }
    return {
      cardId: parsed.cardId,
      xp: parsed.xp,
      level: parsed.level,
      ...(parsed.moveTier !== undefined ? { moveTier: parsed.moveTier } : {}),
    };
  });
  if (new Set(entries.map((entry) => entry.cardId)).size !== entries.length) {
    throw new Error("Fade upgrade snapshot has duplicate cards");
  }
  const expectedCatalogIds = expectedPlayerCards.map(normalizeCatalogCardId);
  if (
    expectedCatalogIds.some((cardId) => !cardId) ||
    entries.length !== expectedCatalogIds.length ||
    entries.some((entry) => !expectedCatalogIds.includes(entry.cardId))
  ) {
    throw new Error("Fade upgrade snapshot has a mismatched roster");
  }
  const expected = createCardProgressionSnapshot(
    [...expectedPlayerCards],
    entries.map((entry) => entry.cardId),
    Object.fromEntries(entries.map((entry) => [entry.cardId, entry])),
    false,
    [...expectedCpuCards],
  );
  // JSONB reorders object keys. Compare explicit fields, never serialized objects.
  const canonicalUpgrades = (entries: AbilityUpgradeSnapshot['player']) => entries.map(entry => [entry.cardId, entry.level, entry.moveTier ?? entry.upgradeIds.length, entry.upgradeIds]);
  if (
    JSON.stringify(canonicalUpgrades(snapshot.abilityUpgradeSnapshot.player)) !== JSON.stringify(canonicalUpgrades(expected.abilityUpgradeSnapshot.player)) ||
    JSON.stringify(canonicalUpgrades(snapshot.abilityUpgradeSnapshot.cpu)) !== JSON.stringify(canonicalUpgrades(expected.abilityUpgradeSnapshot.cpu))
  ) {
    throw new Error("Fade upgrade snapshot is stale or forged");
  }
  return {
    version: CARD_UPGRADE_SNAPSHOT_VERSION,
    balanceRulesVersion: CARD_BALANCE_VERSION,
    cards: entries,
    abilityUpgradeSnapshot: structuredClone(expected.abilityUpgradeSnapshot),
  };
}

export function participatingCatalogCardIds(match: Match): string[] {
  // Participation survives destruction: use the authoritative summon events.
  const played = match.effectLog.filter(event => event.type === 'play' && event.owner === 'player')
    .map(event => normalizeCatalogCardId(event.cardId ?? ''))
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
  const eligible = new Set(snapshot.cards.map((card) => card.cardId));
  const next = { ...progression };
  const rewards = [...new Set(participantCardIds)]
    .filter((cardId) => eligible.has(cardId))
    .map((cardId) => {
      const previous = normalizeCardProgress(next[cardId]);
      const xp = Math.min(CARD_XP_CAP, previous.xp + cardXpForOutcome(outcome));
      const updated = { xp, level: cardLevelFromXp(xp), moveTier: previous.moveTier };
      next[cardId] = updated;
      return {
        cardId,
        xpGained: xp - previous.xp,
        previousXp: previous.xp,
        previousLevel: previous.level,
        xp: updated.xp, level: updated.level,
      };
    });
  return { progression: next, rewards };
}
