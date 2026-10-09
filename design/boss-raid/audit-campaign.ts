import {
  createBossCampaign,
  createBossRaid,
  applyBossAction,
  bossBlastPreview,
  settleBossCampaign,
  BOSS_FORMS,
} from "../../lib/squabblemon-engine/src/bossRaid.ts";
import {
  decks,
  engineIdsToCatalogIds,
} from "../../lib/squabblemon-engine/src/data.ts";
import { writeFileSync } from "node:fs";
const report = [];
for (const deck of decks) {
  let c = createBossCampaign(),
    days = [0, 0, 0, 0, 0],
    scores: number[][] = [[], [], [], [], []];
  try {
    for (let day = 0; day < 100 && !c.completed; day++) {
      const date = new Date(Date.UTC(2026, 9, 8 + day))
          .toISOString()
          .slice(0, 10),
        tier = c.tier;
      days[tier - 1]++;
      let r = createBossRaid(
          "audit",
          date,
          engineIdsToCatalogIds(deck.cards),
          deck.name,
          { tier, hp: c.hp },
        ),
        plays = 0;
      while (r.phase === "active") {
        const candidates = r.match.playerHand
          .flatMap((card) =>
            ([0, 1, 2] as const).flatMap((lane) => {
              try {
                const n = applyBossAction(r, {
                  type: "play",
                  instanceId: card.instanceId,
                  lane,
                });
                return [
                  {
                    n,
                    value:
                      bossBlastPreview(n.match, tier).total * 4 +
                      n.match.playerMotion,
                  },
                ];
              } catch {
                return [];
              }
            }),
          )
          .sort((a, b) => b.value - a.value);
        const next = candidates.length
          ? candidates[0].n
          : applyBossAction(r, { type: "blast" });
        if (candidates.length && ++plays > 50) throw Error("Excessive plays");
        c = settleBossCampaign(c, r, next).campaign;
        r = next;
      }
      scores[tier - 1].push(r.score);
    }
    report.push({ deck: deck.id, days, scores, completed: c.completed });
    console.log(JSON.stringify({ deck: deck.id, days }));
  } catch (e) {
    report.push({ deck: deck.id, error: String(e) });
  }
}
writeFileSync(
  new URL("./campaign-audit.json", import.meta.url),
  JSON.stringify(report, null, 2),
);
console.log(
  JSON.stringify(
    {
      decks: report.length,
      errors: report.filter((x) => x.error),
      tiers: BOSS_FORMS.map((f, i) => {
        const ds = report
          .filter((x) => x.days)
          .map((x) => x.days![i])
          .sort((a, b) => a - b);
        return {
          tier: f.tier,
          hp: f.hp,
          min: ds[0],
          median: ds[Math.floor(ds.length / 2)],
          max: ds.at(-1),
        };
      }),
    },
    null,
    2,
  ),
);
