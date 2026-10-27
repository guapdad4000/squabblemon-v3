import { BOSS_NPCS } from "./bossNpcCards";
import { KUMITE_BOSS_FORMS } from "./bossRaid";
export type BossArchiveEntry = {
  id: string;
  name: string;
  ability: string;
  effect: string;
  art: string;
  mode: "precinct" | "kumite";
  tier?: number;
  hp?: number;
  archiveOnly: true;
};
export const DOJO_NPC_NAMES: Record<string, string> = {
  "raid-backup": "Dojo Gate Disciple",
  "raid-oink": "Iron Guard Captain",
  "raid-hound": "Tiger Disciple",
  "raid-drone": "Lantern Scout",
  "raid-operator": "Floor Sentinel",
  "raid-hog": "Wooden-Armor Enforcer",
  "raid-ham": "Technique Examiner",
  "raid-judge": "Red Seal Referee",
  "raid-protester": "Decoy Challenger",
  "raid-feds": "Five-Gate Warden",
};
/** Inspection metadata only: deliberately absent from cards/cardCatalog, pack pools and saved-deck validation. */
export const BOSS_ARCHIVE: readonly BossArchiveEntry[] = [
  ...Object.entries(BOSS_NPCS).map(([id, npc]): BossArchiveEntry => ({
    id: `archive:precinct:${id}`,
    name: npc.name,
    ability: npc.ability,
    effect: npc.effect,
    art: `assets/boss-raid/${npc.art}.webp`,
    mode: "precinct",
    archiveOnly: true,
  })),
  ...Object.entries(BOSS_NPCS).map(([id, npc]): BossArchiveEntry => ({
    id: `archive:dojo:${id}`,
    name: DOJO_NPC_NAMES[id],
    ability: npc.ability,
    effect: npc.effect,
    art: `assets/boss-raid/dojo-motion/npc-${id.replace("raid-", "")}-still.webp`,
    mode: "kumite",
    archiveOnly: true,
  })),
  ...KUMITE_BOSS_FORMS.map((boss): BossArchiveEntry => ({
    id: `archive:dojo:master-${boss.tier}`,
    name: boss.bossTitle,
    ability: boss.name,
    effect: boss.pressure,
    art: `assets/characters/forms/${boss.fighterId}-base.webp`,
    mode: "kumite",
    tier: boss.tier,
    hp: boss.hp,
    archiveOnly: true,
  })),
];
export function archiveDefeatedTier(
  entry: BossArchiveEntry,
  defeated: readonly number[],
): number | null {
  return entry.tier && defeated.includes(entry.tier) ? entry.tier : null;
}
