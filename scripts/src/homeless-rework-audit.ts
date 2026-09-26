import { writeFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const baseline = process.argv.includes("--baseline");
const root = fileURLToPath(new URL("../../", import.meta.url));
const baselineCommit = "d3387827ac9a0b8d5f1f6a052d9720807543d523";
const extraction = baseline
  ? mkdtempSync(path.join(tmpdir(), "crew-balance-"))
  : undefined;
if (extraction) {
  const archive = execFileSync(
    "git",
    ["archive", baselineCommit, "lib/squabblemon-engine/src"],
    { cwd: root, maxBuffer: 16 * 1024 * 1024 },
  );
  execFileSync("tar", ["-x", "-C", extraction], { input: archive });
}
const source = path.join(extraction ?? root, "lib/squabblemon-engine/src");
const lab: typeof import("@workspace/squabblemon-engine/balanceLab") =
  await import(pathToFileURL(source + "/balanceLab.ts").href);
const defaults = lab.createDefaultBalanceDecks();
const deck = (id: string) => {
  const found = defaults.find((d) => d.id === id);
  if (!found) throw new Error(`Missing benchmark deck: ${id}`);
  return found;
};
const allSubjects = [
  {
    id: "homeless",
    name: "Nothing to Lose",
    cardIds: [
      "homelessguy",
      "homelesslegend",
      "homelessyn",
      "homeless-wiseman",
      "ronald",
      "bonnetgirl",
      "wifey",
      "rastamon",
      "soulfood",
      "plug",
    ],
  },
  {
    id: "solidarity",
    name: "We Outside",
    cardIds: [
      "ronald",
      "homeless-wiseman",
      "homelessguy",
      "homelesslegend",
      "homelessyn",
      "lion",
      "tinman",
      "scarecrow",
      "bonnetgirl",
      "riptidebruiser",
    ],
  },
  {
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
  },
];
const seeded = process.argv.includes("--seeded");
const subjects = allSubjects;
const policy = seeded ? lab.seededLegalBalancePolicy : lab.greedyBalancePolicy;
const foes = [
  "focus-fire-guap",
  "focus-air-bond",
  "focus-counterplay-coherent",
].map(deck);
const results = [];
for (const subject of subjects) {
  let points = 0,
    games = 0;
  for (const foe of foes)
    for (const rotation of [0, 5])
      for (const tier of [0, 3] as const)
        for (const seat of ["a-player", "b-player"] as const) {
          const r = lab.simulateBalanceMatch({
            deckA: subject,
            deckB: foe,
            districtSeed: "crew-buffs-20260925",
            rotation,
            tier,
            seat,
            allowSquabble: true,
            policy,
          });
          results.push(r);
          games++;
          points +=
            r.logicalWinner === "a" ? 1 : r.logicalWinner === "draw" ? 0.5 : 0;
        }
  console.log(
    JSON.stringify({ subject: subject.id, games, score: points / games }),
  );
}
const out = path.join(root, "scripts/results/homeless-rework");
mkdirSync(out, { recursive: true });
writeFileSync(
  `${out}/${baseline ? "before" : "after"}${seeded ? "-seeded" : ""}.json`,
  JSON.stringify({
    baselineCommit,
    policy: seeded ? "seeded-legal" : "greedy",
    seed: "crew-buffs-20260925",
    subjects,
    foes,
    results,
  }),
);

if (extraction) rmSync(extraction, { recursive: true, force: true });
