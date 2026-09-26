import { mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import {
  createDefaultBalanceDecks,
  simulateBalanceMatch,
  greedyBalancePolicy,
  seededLegalBalancePolicy,
  type BalanceDeck,
} from "@workspace/squabblemon-engine/balanceLab";
import type { Match, Owner } from "@workspace/squabblemon-engine/gameEngine";
const seeded = process.argv.includes("--seeded");
const subjects = [
  {
    id: "failedrapper",
    replacement: "mural",
    kind: "verse",
    core: [
      "cornball",
      "youngbull",
      "krump",
      "mr-trick",
      "bblnice",
      "bottle",
      "promoter",
      "break",
      "guap",
    ],
  },
  {
    id: "dancecaptain",
    replacement: "promoter",
    kind: "dance",
    core: [
      "bboy",
      "break",
      "busker",
      "vibe",
      "carmeet",
      "bikelife",
      "honestthot",
      "bblnice",
      "icecream",
    ],
  },
  {
    id: "ahki",
    replacement: "nail",
    kind: "loyalty",
    core: [
      "break",
      "vibe",
      "bboy",
      "busker",
      "og-skater",
      "bikelife",
      "scarecrow",
      "tinman",
      "honestthot",
    ],
  },
  {
    id: "chessregular",
    replacement: "redpill",
    kind: "fork",
    core: [
      "gamer",
      "gothkid",
      "nerd",
      "counter",
      "plug",
      "bustdown",
      "buddy",
      "wifey",
      "cornball",
    ],
  },
  {
    id: "rent-a-cop",
    replacement: "sugarfoot",
    kind: "warning",
    core: [
      "gamer",
      "counter",
      "gothkid",
      "nerd",
      "redpill",
      "plug",
      "buddy",
      "wifey",
      "bustdown",
    ],
  },
];
function activation(
  m: Readonly<Match>,
  owner: Owner,
  id: string,
  kind: string,
) {
  const setups = new Set<string>(),
    resolutions = new Set<string>(),
    positive = new Set<string>();
  const played = new Set<string>();
  for (const e of m.effectLog) {
    if (e.owner === owner && e.cardId === id && e.type === "play")
      played.add(e.cardInstanceId);
    for (const mark of e.replay.after.creativeMarks ?? [])
      if (
        mark.kind === kind &&
        mark.source.cardId === id &&
        mark.owner === owner
      )
        setups.add(mark.id);
    if (
      e.owner !== owner ||
      e.cardId !== id ||
      e.type !== "ability" ||
      e.abilityMetadata
    )
      continue;
    const before = e.replay.before.boards.flat(),
      after = e.replay.after.boards.flat();
    const source = after.find((c) => c.instanceId === e.cardInstanceId);
    let resolved = false,
      key = String(e.sequence);
    if (kind === "dance" && e.note.includes("movement reaction")) {
      if (source?.creativeRound === e.round) {
        setups.add(`${e.cardInstanceId}:${e.round}`);
      }
      resolved =
        source?.creativeRound === e.round && source?.creativeCount === 1;
      key = `${e.cardInstanceId}:${e.round}`;
    } else if (kind === "loyalty")
      resolved =
        e.note.includes("movement payoff") &&
        !(e.replay.after.creativeMarks ?? []).some(
          (x) => x.kind === kind && x.source.instanceId === e.cardInstanceId,
        );
    else
      resolved = e.note.includes(
        kind === "warning" ? "arrival resolved" : "placement resolved",
      );
    if (resolved) {
      resolutions.add(key);
      const benefit = before.some((old) => {
        const now = after.find((c) => c.instanceId === old.instanceId);
        return old.owner === owner
          ? !!now && now.powerModifier > old.powerModifier
          : !now || now.powerModifier < old.powerModifier;
      });
      if (benefit) positive.add(key);
    }
  }
  return {
    deployments: played.size,
    setups: setups.size,
    resolutions: resolutions.size,
    observedBenefitEvents: positive.size,
  };
}
const foes = createDefaultBalanceDecks().filter((d) =>
  ["focus-fire-guap", "focus-air-bond", "focus-counterplay-coherent"].includes(
    d.id,
  ),
);
const results = [];
for (const subject of subjects) {
  for (const variant of ["candidate", "replacement"] as const) {
    const id = variant === "candidate" ? subject.id : subject.replacement;
    const deck: BalanceDeck = {
      id: `${subject.id}-${variant}`,
      name: `${subject.id}: ${id}`,
      orderKey: `five-${subject.id}`,
      cardIds: [id, ...subject.core],
    };
    for (const foe of foes)
      for (const districtSeed of [
        "next-five-a-20260926",
        "next-five-b-20260926",
      ])
        for (const rotation of [0, 5])
          for (const tier of [0, 3] as const)
            for (const seat of ["a-player", "b-player"] as const) {
              let observed: ReturnType<typeof activation> | undefined;
              const r = simulateBalanceMatch({
                deckA: deck,
                deckB: foe,
                districtSeed,
                rotation,
                tier,
                seat,
                allowSquabble: true,
                policy: seeded ? seededLegalBalancePolicy : greedyBalancePolicy,
                observeComplete: (m) => {
                  if (variant === "candidate")
                    observed = activation(
                      m,
                      seat === "a-player" ? "player" : "cpu",
                      subject.id,
                      subject.kind,
                    );
                },
              });
              results.push({
                subject: subject.id,
                variant,
                ...r,
                activation: observed,
              });
            }
  }
  console.log(
    JSON.stringify({
      completed: subject.id,
      games: results.filter((r) => r.subject === subject.id).length,
    }),
  );
}
const out = "results/next-five";
mkdirSync(out, { recursive: true });
writeFileSync(
  `${out}/${seeded ? "seeded" : "greedy"}.json`,
  JSON.stringify({
    commit: execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim(),
    policy: seeded ? "seeded-legal" : "greedy",
    subjects,
    foes,
    notes:
      "Same-cost substitutions in fixed coherent shells; orderKey preserves index permutation. Resolution events may be blocked. Observed-benefit events exclude upgrade events but nested reaction logging may hide benefit, especially at tier 3. Neither metric is a live win rate.",
    results,
  }),
);
