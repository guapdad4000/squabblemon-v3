import { bossFormForMode, KUMITE_BOSS_FORMS, type BossRaidMode, type BossStatus } from "@workspace/squabblemon-engine/bossRaid";

/** Give every actual opponent play its own readable entrance beat. */
export const POLICE_ENTRANCE_MS = 900;
export const policeRevealDuration = (plays: number) => 150 + plays * POLICE_ENTRANCE_MS;

export function raidIdentity(mode: BossRaidMode, tier: 1 | 2 | 3 | 4 | 5) {
  return mode === "kumite"
    ? { title: KUMITE_BOSS_FORMS[tier - 1].bossTitle, operation: "WAY OF THE FIST", opposition: "Opposition", lanes: ["West Dojo", "Center Ring", "East Dojo"] }
    : { title: "OFFICER OINK", operation: "PUNCH ON PATROL", opposition: "Police", lanes: ["Checkpoint", "Barricade", "Lockup"] };
}

/** The response already contains the banked daily reward. A cleared campaign tier
 * confirms its separate bonus; never infer a payout from a projected strike. */
export function raidBankedRewards(status: BossStatus, mode: BossRaidMode) {
  const run = status.run;
  const tierCleared = !!run && run.phase === "complete" && run.hp === 0
    && status.campaign.defeated.includes(run.bossTier);
  const bonus = tierCleared ? bossFormForMode(run!.bossTier, mode).reward
    : { softCurrency: 0, packTickets: 0, styleShards: 0 };
  return {
    tierCleared,
    softCurrency: status.earned.softCurrency + bonus.softCurrency,
    packTickets: status.earned.packTickets + bonus.packTickets,
    styleShards: status.earned.styleShards + bonus.styleShards,
  };
}
