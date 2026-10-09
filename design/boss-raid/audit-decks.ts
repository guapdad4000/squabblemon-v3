import {
  createBossRaid,
  applyBossAction,
  bossBlastPreview,
  bossRewards,
} from "../../lib/squabblemon-engine/src/bossRaid.ts";
import {
  decks,
  engineIdsToCatalogIds,
} from "../../lib/squabblemon-engine/src/data.ts";
import { writeFileSync } from "node:fs";
const report = [];
for (const deck of decks)
  for (const day of ["2026-10-08", "2026-10-09", "2026-10-10"]) {
    try {
      let r = createBossRaid(
          "audit",
          day,
          engineIdsToCatalogIds(deck.cards),
          deck.name,
        ),
        actions = 0;
      while (r.phase === "active") {
        const candidates = r.match.playerHand
          .flatMap((c) =>
            ([0, 1, 2] as const).flatMap((lane) => {
              try {
                const n = applyBossAction(r, {
                  type: "play",
                  instanceId: c.instanceId,
                  lane,
                });
                return [
                  {
                    n,
                    value:
                      bossBlastPreview(n.match).total * 4 +
                      n.match.playerMotion,
                  },
                ];
              } catch {
                return [];
              }
            }),
          )
          .sort((a, b) => b.value - a.value);
        if (candidates.length) {
          r = candidates[0].n;
          actions++;
          if (actions > 40) throw Error("excessive plays");
        } else r = applyBossAction(r, { type: "blast" });
      }
      report.push({
        deck: deck.id,
        day,
        score: r.score,
        tier: bossRewards(r),
        actions,
      });
    } catch (e) {
      report.push({ deck: deck.id, day, error: String(e) });
    }
  }
writeFileSync(
  new URL("./deck-audit.json", import.meta.url),
  JSON.stringify(report, null, 2),
);
console.log(
  JSON.stringify({
    runs: report.length,
    errors: report.filter((r) => "error" in r),
    kills: report.filter((r) => r.score === 160).length,
    min: Math.min(
      ...report.filter((r) => r.score !== undefined).map((r) => r.score!),
    ),
    max: Math.max(
      ...report.filter((r) => r.score !== undefined).map((r) => r.score!),
    ),
  }),
);
