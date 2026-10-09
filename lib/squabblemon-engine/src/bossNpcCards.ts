import type { Card } from "./data";
/** Encounter-only definitions. Never merged into cards, catalog, packs or rewards. */
export const BOSS_NPCS = {
  "raid-backup": {
    name: "Plainclothes Backup", art: "protester", power: 3,
    ability: "Undercover Detail", effect: "A cheap body used to contest an open lane.",
  },
  "raid-oink": {
    name: "Officer Oink",
    art: "oink",
    power: 8,
    ability: "Protection Racket",
    effect:
      "Round end: all your characters lose 1 Hand. His squad grants armor to their lane.",
  },
  "raid-hound": {
    name: "Police Hound",
    art: "hound",
    power: 3,
    ability: "Follow the Scent",
    effect:
      "The first 1–2 Motion card played here each round loses 2 Hands. Counters cheap swarms.",
  },
  "raid-drone": {
    name: "Police Drone",
    art: "drone",
    power: 2,
    ability: "No Blind Spots",
    effect:
      "The first character deployed here each round is silenced for that round. Counters reveals and auras.",
  },
  "raid-operator": {
    name: "Drone Operator",
    art: "operator",
    power: 4,
    ability: "Airspace Denied",
    effect:
      "At round start, characters here cannot move until this round ends. Counters movement and bounce.",
  },
  "raid-hog": {
    name: "Sergeant Hog",
    art: "hog",
    power: 6,
    ability: "Riot Shield",
    effect:
      "Adds 4 armor to this lane’s blast. Round end: all characters here lose 1 Hand. Counters tall lanes.",
  },
  "raid-ham": {
    name: "Lieutenant Ham",
    art: "ham",
    power: 4,
    ability: "Asset Forfeiture",
    effect:
      "Round end: strips up to 3 bonus Hands from each character here. Counters growth and buffs.",
  },
  "raid-judge": {
    name: "Corrupt Judge",
    art: "judge",
    power: 5,
    ability: "Maximum Sentence",
    effect:
      "Round end: your highest-Hands character on the board loses 3 Hands. Counters finishers.",
  },
  "raid-protester": {
    name: "Fake Protester Fed",
    art: "protester",
    power: 3,
    ability: "Entrapment",
    effect:
      "Round end: clears your planted hazards and district traps here. Counters trap decks.",
  },
  "raid-feds": {
    name: "The Feds",
    art: "feds",
    power: 5,
    ability: "RICO Sweep",
    effect:
      "Your first deployment here each round costs 1 extra Motion. Round end: summoned tokens here lose 2 Hands.",
  },
} as const;
export type BossNpcId = keyof typeof BOSS_NPCS;
export const bossNpcCards: Record<string, Card> = Object.fromEntries(
  Object.entries(BOSS_NPCS).map(([id, npc]) => [
    id,
    {
      id,
      name: npc.name,
      type: "Normal",
      cost: ({ "raid-backup": 1, "raid-hound": 1, "raid-drone": 1, "raid-ham": 2, "raid-protester": 2, "raid-operator": 3, "raid-feds": 3, "raid-hog": 4, "raid-judge": 4, "raid-oink": 5 } as Record<string, number>)[id],
      power: npc.power,
      ability: npc.ability,
      effect: npc.effect,
      kind: "character",
      roles: ["Boss only"],
      abilityUpgrades: [],
    } as Card,
  ]),
);
