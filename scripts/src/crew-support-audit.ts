import { writeFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const baseline = process.argv.includes("--baseline");
const root = fileURLToPath(new URL("../../", import.meta.url));
const baselineCommit = "d33f9dc3b80de8bb587730d22dc3e3fde0516507";
const extraction = baseline
  ? mkdtempSync(path.join(tmpdir(), "crew-balance-"))
  : undefined;
if (extraction) {
  const archive = execFileSync(
    "git",
    ["archive", baselineCommit, "lib/squabblemon-engine/src"],
    { cwd: root },
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
  deck("focus-cellblock"),
  deck("focus-demario-luigion"),
  {
    id: "cellblock-pressure",
    name: "Cellblock Pressure",
    cardIds: [
      "inmate-crafty",
      "inmate-boyfriend",
      "inmate-informant",
      "inmate-contraband",
      "lebron-james",
      "bustdown",
      "cognac",
      "tinman",
      "counter",
      "roaster",
    ],
  },
  {
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
  },
  deck("focus-detective"),
  deck("focus-wonderland"),
  deck("focus-earth-tax"),
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
const subjects = seeded
  ? allSubjects.filter((deck) =>
      [
        "focus-cellblock",
        "focus-demario-luigion",
        "cellblock-pressure",
        "mushroom-plant",
      ].includes(deck.id),
    )
  : allSubjects;
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
const out = path.join(root, "scripts/results/crew-supports");
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
