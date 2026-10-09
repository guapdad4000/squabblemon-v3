import type { DistrictDefinition, DistrictSnapshot } from "./districts";
/** Raid-only lanes, deliberately absent from the standard location roll pool. */
export const BOSS_DISTRICTS: [
  DistrictDefinition,
  DistrictDefinition,
  DistrictDefinition,
] = [
  {
    id: "raid-checkpoint",
    name: "CHECKPOINT",
    rule: "No location bonus. Contest police Hands; round results charge the boss attack.",
    strategy: "Read the officer stationed here before committing.",
    accent: "#8ae8ff",
    effect: { kind: "raid-neutral" },
  },
  {
    id: "raid-barricade",
    name: "THE BARRICADE",
    rule: "No location bonus. Contest police Hands; round results charge the boss attack.",
    strategy: "Switch off police armor with silence or freeze.",
    accent: "#f4d68c",
    effect: { kind: "raid-neutral" },
  },
  {
    id: "raid-evidence",
    name: "EVIDENCE LOCKUP",
    rule: "No location bonus. Contest police Hands; round results charge the boss attack.",
    strategy: "Protect your crew from round-end police pressure.",
    accent: "#f45864",
    effect: { kind: "raid-neutral" },
  },
];
export const BOSS_DISTRICT_SNAPSHOT: DistrictSnapshot = {
  version: 1,
  locations: BOSS_DISTRICTS,
};
