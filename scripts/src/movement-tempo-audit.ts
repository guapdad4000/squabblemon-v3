import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  readFileSync,
} from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import type {
  BalanceDeck,
  BalancePolicy,
} from "@workspace/squabblemon-engine/balanceLab";
const root = fileURLToPath(new URL("../../", import.meta.url));
const baselineCommit = "1926c7d6f3ed10db96b3f0e394bdf20233b2c5d0";
const args = process.argv.slice(2);
const arg = (name: string, fallback: string) =>
  args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const experiment = arg("--experiment", "baseline");
const policyName = arg("--policy", "greedy");
const temporary = mkdtempSync(path.join(tmpdir(), "movement-audit-"));
try {
  const archive = execFileSync(
    "git",
    ["archive", baselineCommit, "lib/squabblemon-engine/src"],
    { cwd: root },
  );
  execFileSync("tar", ["-x", "-C", temporary], { input: archive });
  const source = path.join(temporary, "lib/squabblemon-engine/src");
  const engineFile = path.join(source, "gameEngine.ts");
  if (experiment === "candidate")
    writeFileSync(
      engineFile,
      readFileSync(
        path.join(root, "lib/squabblemon-engine/src/gameEngine.ts"),
        "utf8",
      ),
    );
  if (experiment === "tin-protection-only") {
    const content = readFileSync(engineFile, "utf8");
    const original =
      "m = grantProtection(m, tin, id);\n    m = modify(m, id, c => ({ ...c, powerModifier: c.powerModifier + 1 }));";
    if (!content.includes(original)) throw new Error("Tin Man fixture drift");
    writeFileSync(
      engineFile,
      content.replace(original, "m = grantProtection(m, tin, id);"),
    );
  }
  if (experiment === "ev-no-refund") {
    const content = readFileSync(engineFile, "utf8");
    const original =
      "if (!allies.length) m = refundMotion(m, source.owner, 1);";
    if (!content.includes(original)) throw new Error("EV fixture drift");
    writeFileSync(
      engineFile,
      content.replace(
        original,
        "// Offline ablation: EV retains its discount but no refund.",
      ),
    );
  }
  const lab: typeof import("@workspace/squabblemon-engine/balanceLab") =
    await import(pathToFileURL(path.join(source, "balanceLab.ts")).href);
  const data: typeof import("@workspace/squabblemon-engine/data") =
    await import(pathToFileURL(path.join(source, "data.ts")).href);
  if (experiment === "earth-no-bonds")
    for (const id of ["concrete", "torta"])
      data.cards[id].elementalBond = undefined;
  if (experiment === "electric-no-bond")
    data.cards.circuitcaptain.elementalBond = undefined;
  if (
    ![
      "baseline",
      "candidate",
      "tin-protection-only",
      "ev-no-refund",
      "earth-no-bonds",
      "electric-no-bond",
    ].includes(experiment)
  )
    throw new Error("Unknown experiment");
  const defaults = lab.createDefaultBalanceDecks();
  const deck = (id: string) => {
    const found = defaults.find((d) => d.id === id);
    if (!found) throw new Error(id);
    return found;
  };
  const electric = deck("starter-voltage");
  const earth: BalanceDeck = {
    id: "earth-rides",
    name: "Earth Rides",
    cardIds: [
      "yn-atv-lord",
      "scarecrow",
      "lion",
      "tinman",
      "asphaltapostle",
      "landlord",
      "concrete",
      "torta",
      "bigzoey",
      "johnhenry",
    ],
  };
  const plant: BalanceDeck = {
    id: "mushroom-plant",
    name: "Mushroom Garden",
    cardIds: [
      "demario",
      "luigion",
      "gardener",
      "sprout",
      "rootnurse",
      "canopykeeper",
      "gardenwall",
      "hair-stylist",
      "stylist",
      "black-cowboy",
    ],
  };
  const foes = [
    ...[
      "focus-fire-guap",
      "focus-air-bond",
      "focus-counterplay-coherent",
      "focus-poison-entry",
      "focus-wonderland",
      "focus-wiz",
    ].map(deck),
    plant,
  ];
  const subjects =
    experiment.startsWith("earth-") || experiment.startsWith("tin-")
      ? [earth]
      : experiment.startsWith("electric-") || experiment.startsWith("ev-")
        ? [electric]
        : [earth, electric];
  const policyBase =
    policyName === "greedy"
      ? lab.greedyBalancePolicy
      : policyName === "seeded"
        ? lab.seededLegalBalancePolicy
        : undefined;
  if (!policyBase) throw new Error("Unknown policy");
  const results = [];
  for (const subject of subjects) {
    let points = 0,
      games = 0;
    for (const foe of foes)
      for (const seed of ["movement-audit-0", "movement-audit-1"])
        for (const rotation of [0, 5])
          for (const tier of [0, 3] as const)
            for (const seat of ["a-player", "b-player"] as const) {
              const tempo = {
                a: {
                  plays: 0,
                  freePlays: 0,
                  paidMotion: 0,
                  restoredMotion: 0,
                  existingCardMoves: 0,
                },
                b: {
                  plays: 0,
                  freePlays: 0,
                  paidMotion: 0,
                  restoredMotion: 0,
                  existingCardMoves: 0,
                },
              };
              const policy: BalancePolicy = (context) => {
                const chosen = policyBase(context);
                if (!chosen) return null;
                const side =
                  context.owner === (seat === "a-player" ? "player" : "cpu")
                    ? "a"
                    : "b";
                const meter = tempo[side],
                  key =
                    context.owner === "player" ? "playerMotion" : "cpuMotion";
                meter.plays++;
                meter.freePlays += Number(chosen.cost === 0);
                meter.paidMotion += chosen.cost;
                meter.restoredMotion += Math.max(
                  0,
                  chosen.preview[key] - context.match[key] + chosen.cost,
                );
                meter.existingCardMoves += context.match.boards
                  .flat()
                  .filter(
                    (c) =>
                      c.owner === context.owner &&
                      chosen.preview.boards
                        .flat()
                        .some(
                          (n) =>
                            n.instanceId === c.instanceId && n.lane !== c.lane,
                        ),
                  ).length;
                return chosen;
              };
              const result = lab.simulateBalanceMatch({
                deckA: subject,
                deckB: foe,
                districtSeed: seed,
                rotation,
                tier,
                seat,
                policy,
                allowSquabble: true,
              });
              results.push({ ...result, tempo });
              games++;
              points +=
                result.logicalWinner === "a"
                  ? 1
                  : result.logicalWinner === "draw"
                    ? 0.5
                    : 0;
            }
    console.log(
      JSON.stringify({
        experiment,
        policy: policyName,
        subject: subject.id,
        games,
        score: points / games,
      }),
    );
  }
  const out = path.join(root, "scripts/results/movement-tempo");
  mkdirSync(out, { recursive: true });
  writeFileSync(
    path.join(out, `${experiment}-${policyName}.json`),
    JSON.stringify({
      baselineCommit,
      experiment,
      policy: policyName,
      subjects,
      foes,
      results,
    }),
  );
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
