import { writeFileSync, mkdirSync } from "node:fs";
import { cards, decks } from "@workspace/squabblemon-engine/data";
import {
  simulateBalanceMatch,
  greedyBalancePolicy,
  seededLegalBalancePolicy,
} from "@workspace/squabblemon-engine/balanceLab";
import { allRankingDecks } from "./all-decks-ranking-decks";
const targets = decks
  .filter((d) =>
    [
      "sunday-dinner",
      "fitness-routes",
      "music-tour",
      "community-table",
    ].includes(d.id),
  )
  .map((d) => ({ id: d.id, name: d.name, cardIds: d.cards }));
const pool = allRankingDecks(),
  threats = [
    "element-water",
    "mushroom-plant",
    "element-air",
    "element-light",
    "element-dark",
  ];
const rows: Array<{
  a: string;
  b: string;
  rotation: number;
  tier: 0 | 3;
  seat: "a-player" | "b-player";
  policy: "greedy" | "seeded";
  winner: ReturnType<typeof simulateBalanceMatch>["logicalWinner"];
  score: number;
}> = [];
for (const a of targets)
  for (const bId of threats)
    for (const rotation of [2, 7])
      for (const tier of [0, 3] as const)
        for (const seat of ["a-player", "b-player"] as const)
          for (const [policyName, policy] of [
            ["greedy", greedyBalancePolicy],
            ["seeded", seededLegalBalancePolicy],
          ] as const) {
            const b = pool.find((d) => d.id === bId)!;
            const r = simulateBalanceMatch({
              deckA: a,
              deckB: b,
              tier,
              seat,
              policy,
              rotation,
              districtSeed: `selected-wave-${rotation}`,
              allowSquabble: true,
            });
            rows.push({
              a: a.id,
              b: b.id,
              rotation,
              tier,
              seat,
              policy: policyName,
              winner: r.logicalWinner,
              score:
                r.logicalWinner === "a"
                  ? 1
                  : r.logicalWinner === "draw"
                    ? 0.5
                    : 0,
            });
          }
const out = "artifacts/deliverables/selected-wave-2026-10-08";
mkdirSync(out, { recursive: true });
writeFileSync(out + "/matchup-diagnostics.json", JSON.stringify(rows, null, 2));
const scores = targets.map((d) => {
  const games = rows.filter((r) => r.a === d.id);
  return {
    deck: d.id,
    games: games.length,
    botScore: games.reduce((n, r) => n + r.score, 0) / games.length,
  };
});
writeFileSync(out + "/matchup-summary.json", JSON.stringify(scores, null, 2));
console.log(JSON.stringify(scores));
