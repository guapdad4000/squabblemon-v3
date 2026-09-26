import { writeFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const baseline = process.argv.includes("--baseline");
const root = fileURLToPath(new URL("../../", import.meta.url));
const baselineCommit = "c6b024a57518b2fe5ebcb5bfa7f0d4617f625fc6";
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
  {
    id: "electric-jobs",
    name: "Electric Jobs",
    cardIds: [
      "batteryback",
      "circuitcaptain",
      "wiretap",
      "livewire",
      "stockz",
      "bossbabe",
      "plug",
      "streamer",
      "techbro",
      "bikelife",
    ],
  },
  {
    id: "club",
    name: "Club",
    cardIds: [
      "promoter",
      "bottle",
      "piratedj",
      "dancecaptain",
      "break",
      "bboy",
      "mr-trick",
      "bblnice",
      "bbldemon",
      "nightcashier",
    ],
  },
  {
    id: "protection",
    name: "Protect and Retaliate",
    cardIds: [
      "lebron-james",
      "juneteenth-chair-guy",
      "stud",
      "baby",
      "firstaid",
      "lawyer",
      "tattoo-artist",
      "church",
      "watson",
      "ronald",
    ],
  },
  {
    id: "comeback",
    name: "Comeback",
    cardIds: [
      "hooper",
      "failedathlete",
      "sportsprodigy",
      "cornercoach",
      "bonnetgirl",
      "homelessguy",
      "homelesslegend",
      "rastamon",
      "wifey",
      "black-cowboy",
    ],
  },
  {
    id: "plant-care",
    name: "Plant Care",
    cardIds: [
      "gardener",
      "canopykeeper",
      "streetapostle",
      "rastamon",
      "laundry",
      "stonersr",
      "sprout",
      "rootnurse",
      "gardenwall",
      "ashlee",
    ],
  },
  {
    id: "air-routes",
    name: "Air Routes",
    cardIds: [
      "honestthot",
      "slipstream",
      "bboy",
      "og-skater",
      "bikelife",
      "carmeet",
      "promoter",
      "roaster",
      "captainjigga",
      "cloudbreak",
    ],
  },
  {
    id: "contracts",
    name: "Public Contracts",
    cardIds: [
      "dr-umah",
      "chessregular",
      "dmvworker",
      "midnightmayor",
      "hater",
      "atl-scammer",
      "rent-a-cop",
      "redneck-evil",
      "nigerian-father",
      "inmate-kingpin",
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
            districtSeed: "creative-wave-20260925",
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
const out = path.join(root, "scripts/results/creative-wave");
mkdirSync(out, { recursive: true });
writeFileSync(
  `${out}/${baseline ? "before" : "after"}${seeded ? "-seeded" : ""}.json`,
  JSON.stringify({
    baselineCommit,
    policy: seeded ? "seeded-legal" : "greedy",
    seed: "creative-wave-20260925",
    subjects,
    foes,
    results,
  }),
);

if (extraction) rmSync(extraction, { recursive: true, force: true });
