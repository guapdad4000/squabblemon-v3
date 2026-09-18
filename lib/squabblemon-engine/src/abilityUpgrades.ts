import { CARD_LEVEL_CAP, normalizeCardProgress, type CardProgressionMap } from "./cardProgression";
import { cards, type AbilityUpgrade } from "./data";

export const ABILITY_UPGRADE_SNAPSHOT_VERSION = 1 as const;

export type CardAbilityUpgradeSnapshot = {
  readonly cardId: string;
  readonly level: number;
  readonly moveTier?: number;
  readonly upgradeIds: readonly string[];
};

/** Match-start-only payload. Do not derive active abilities from live progression during a match. */
export type AbilityUpgradeSnapshot = {
  readonly version: typeof ABILITY_UPGRADE_SNAPSHOT_VERSION;
  readonly player: readonly CardAbilityUpgradeSnapshot[];
  readonly cpu: readonly CardAbilityUpgradeSnapshot[];
};

const freeze = <T>(value: T): T => {
  if (value && typeof value === "object") {
    Object.freeze(value);
    Object.values(value as Record<string, unknown>).forEach(freeze);
  }
  return value;
};

export function unlockedAbilityUpgrades(cardId: string, level: number): readonly AbilityUpgrade[] {
  const card = cards[cardId];
  if (!card) throw new Error(`Unknown card ${cardId}`);
  const safeLevel = Math.max(1, Math.min(CARD_LEVEL_CAP, Math.floor(level)));
  return card.abilityUpgrades.filter((upgrade) => upgrade.unlockLevel <= safeLevel);
}

function snapshotCards(cardIds: readonly string[], progress: CardProgressionMap = {}): readonly CardAbilityUpgradeSnapshot[] {
  return cardIds.map((cardId) => {
    if (!cards[cardId]) throw new Error(`Unknown card ${cardId}`);
    const { level, moveTier } = normalizeCardProgress(progress[cardId]);
    return { cardId, level, moveTier, upgradeIds: unlockedAbilityUpgrades(cardId, level).slice(0, moveTier).map((upgrade) => upgrade.id) };
  });
}

export function createAbilityUpgradeSnapshot(
  playerCardIds: readonly string[],
  cpuCardIds: readonly string[],
  progression: { readonly player?: CardProgressionMap; readonly cpu?: CardProgressionMap } = {},
): AbilityUpgradeSnapshot {
  return freeze({
    version: ABILITY_UPGRADE_SNAPSHOT_VERSION,
    player: snapshotCards(playerCardIds, progression.player),
    cpu: snapshotCards(cpuCardIds, progression.cpu),
  });
}

/** Rejects altered, stale-schema, duplicate, or mismatched snapshot entries. */
export function validateAbilityUpgradeSnapshot(
  snapshot: AbilityUpgradeSnapshot,
  playerCardIds: readonly string[],
  cpuCardIds: readonly string[],
): AbilityUpgradeSnapshot {
  if (!snapshot || snapshot.version !== ABILITY_UPGRADE_SNAPSHOT_VERSION) throw new Error("Unsupported ability upgrade snapshot version");
  const validateSide = (entries: readonly CardAbilityUpgradeSnapshot[], expected: readonly string[], side: string) => {
    if (!Array.isArray(entries) || entries.length !== expected.length) throw new Error(`Invalid ${side} ability upgrade snapshot`);
    entries.forEach((entry, index) => {
      const card = cards[expected[index]];
      if (!card || entry.cardId !== expected[index] || !Number.isInteger(entry.level) || entry.level < 1 || entry.level > CARD_LEVEL_CAP) throw new Error(`Invalid ${side} ability upgrade snapshot`);
      const eligible = unlockedAbilityUpgrades(entry.cardId, entry.level);
      if (entry.moveTier !== undefined && (!Number.isInteger(entry.moveTier) || entry.moveTier < 0 || entry.moveTier > eligible.length)) throw new Error(`Forged ${side} move tier`);
      const expectedIds = eligible.slice(0, entry.moveTier ?? eligible.length).map((upgrade) => upgrade.id);
      const upgradeIds = entry.upgradeIds as readonly string[];
      if (!Array.isArray(upgradeIds) || upgradeIds.length !== expectedIds.length || upgradeIds.some((id: string, i: number) => id !== expectedIds[i])) throw new Error(`Forged ${side} ability upgrade snapshot`);
    });
  };
  validateSide(snapshot.player, playerCardIds, "player");
  validateSide(snapshot.cpu, cpuCardIds, "cpu");
  return freeze({
    version: ABILITY_UPGRADE_SNAPSHOT_VERSION,
    player: snapshot.player.map((entry) => ({ ...entry, upgradeIds: [...entry.upgradeIds] })),
    cpu: snapshot.cpu.map((entry) => ({ ...entry, upgradeIds: [...entry.upgradeIds] })),
  });
}

export function snapshotUpgradesForCard(snapshot: AbilityUpgradeSnapshot, owner: "player" | "cpu", cardId: string): readonly AbilityUpgrade[] {
  const entry = snapshot[owner].find((item) => item.cardId === cardId);
  if (!entry) return [];
  return entry.upgradeIds.map((id) => cards[cardId].abilityUpgrades.find((upgrade) => upgrade.id === id)!).filter(Boolean);
}
