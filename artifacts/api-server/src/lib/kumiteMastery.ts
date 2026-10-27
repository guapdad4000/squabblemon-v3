import {
  KUMITE_FIGHTERS,
  KUMITE_ALT_TIERS,
  kumiteFighter,
  kumiteAltId,
} from "@workspace/squabblemon-engine/kumiteForms";
import { getEffectiveCardPower } from "@workspace/squabblemon-engine/gameEngine";
import type { BossRaid } from "@workspace/squabblemon-engine/bossRaid";
import type { CollectionRoadRewardRecord } from "@workspace/db";
export function kumiteMastery(
  rows: readonly { key: string; reward: CollectionRoadRewardRecord }[],
  ownedVariants: readonly string[],
) {
  const keys = new Set(rows.map((r) => r.key));
  const campaign = rows.find((r) => r.key === "boss-campaign:kumite:v2")?.reward
    .bossCampaign?.state as { defeated?: number[] } | undefined;
  const defeated = campaign?.defeated ?? [];
  const raids = rows
    .filter((r) => r.key.startsWith("boss-raid:kumite:"))
    .map((r) => r.reward.bossRaid?.state as BossRaid | undefined)
    .filter((r): r is BossRaid => !!r && r.mode === "kumite");
  return KUMITE_FIGHTERS.map((cardId) => {
    const wins = rows.filter(
      (r) =>
        r.reward.kumite?.event === "win" &&
        r.reward.kumite.crew?.some((id) => kumiteFighter(id) === cardId),
    );
    const personal = raids.filter((r) =>
      r.match.playerCardIds.some((id) => kumiteFighter(id) === cardId),
    );
    const quest = (id: string, label: string, complete: boolean) => ({
      id: `kumite:quest:${cardId}:${id}:v1`,
      label,
      complete,
      claimed: keys.has(`kumite:quest:${cardId}:${id}:v1`),
      styleShards: 20,
    });
    return {
      cardId,
      variantId: kumiteAltId(cardId),
      requiredTier: KUMITE_ALT_TIERS[cardId],
      dojoCleared: defeated.includes(KUMITE_ALT_TIERS[cardId]),
      weeklyWin: wins.length > 0,
      altOwned: ownedVariants.includes(kumiteAltId(cardId)),
      quests: [
        quest(
          "sweep",
          "WIN · 3 DISTRICTS",
          wins.some((r) => r.reward.kumite?.sweep === true),
        ),
        quest(
          "boss-damage",
          "35+ DAMAGE · TIER 3+",
          personal.some(
            (r) => r.phase !== "active" && r.bossTier >= 3 && r.score >= 35,
          ),
        ),
        quest(
          "glo",
          "AWAKEN · 10+ HANDS",
          personal.some((r) =>
            r.blasts.some((b) =>
              b.boards
                .flat()
                .some(
                  (c) =>
                    c.owner === "player" &&
                    kumiteFighter(c.cardId) === cardId &&
                    getEffectiveCardPower(c) >= 10,
                ),
            ),
          ),
        ),
      ],
    };
  });
}
export type KumiteMastery = ReturnType<typeof kumiteMastery>;
