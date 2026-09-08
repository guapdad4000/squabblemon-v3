export type Card = {
  id: string;
  name: string;
  type: string;
  cost: number;
  power: number;
  ability: string;
  effect: string;
  roles?: string[];
  deck?: string;
  owner?: "player" | "cpu";
  abilityUpgrades: readonly AbilityUpgrade[];
};

/** A deliberately small, additive effect budget for the fixed card-growth path. */
export type AbilityUpgrade = {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly unlockLevel: number;
  readonly effect: AbilityUpgradeEffect;
};
export type AbilityUpgradeEffect =
  | { readonly kind: "self-power"; readonly amount: 1; readonly trigger: "base-success" }
  | { readonly kind: "target-power"; readonly amount: -1 | 1; readonly target: "friendly" | "enemy"; readonly trigger: "base-success" };

export const ABILITY_UPGRADE_UNLOCK_LEVELS = [2, 5, 8] as const;
export const ABILITY_UPGRADE_COUNT = 3;

const upgradeEffects: Record<string, readonly AbilityUpgradeEffect[]> = {
  rastamon: [{ kind: "self-power", amount: 1, trigger: "base-success" }, { kind: "target-power", amount: 1, target: "friendly", trigger: "base-success" }, { kind: "self-power", amount: 1, trigger: "base-success" }],
  roaster: [{ kind: "target-power", amount: -1, target: "enemy", trigger: "base-success" }, { kind: "self-power", amount: 1, trigger: "base-success" }, { kind: "target-power", amount: -1, target: "enemy", trigger: "base-success" }],
  nerd: [{ kind: "self-power", amount: 1, trigger: "base-success" }, { kind: "target-power", amount: -1, target: "enemy", trigger: "base-success" }, { kind: "self-power", amount: 1, trigger: "base-success" }],
  cornball: [{ kind: "self-power", amount: 1, trigger: "base-success" }, { kind: "self-power", amount: 1, trigger: "base-success" }, { kind: "target-power", amount: -1, target: "enemy", trigger: "base-success" }],
  plug: Array.from({ length: 3 }, () => ({ kind: "self-power" as const, amount: 1 as const, trigger: "base-success" as const })),
  streamer: Array.from({ length: 3 }, () => ({ kind: "self-power" as const, amount: 1 as const, trigger: "base-success" as const })),
  gamer: Array.from({ length: 3 }, () => ({ kind: "self-power" as const, amount: 1 as const, trigger: "base-success" as const })),
  techbro: Array.from({ length: 3 }, () => ({ kind: "self-power" as const, amount: 1 as const, trigger: "base-success" as const })),
  bikelife: Array.from({ length: 3 }, () => ({ kind: "self-power" as const, amount: 1 as const, trigger: "base-success" as const })),
  vibe: [{ kind: "target-power", amount: 1, target: "friendly", trigger: "base-success" }, { kind: "self-power", amount: 1, trigger: "base-success" }, { kind: "target-power", amount: 1, target: "friendly", trigger: "base-success" }],
  hooper: [{ kind: "self-power", amount: 1, trigger: "base-success" }, { kind: "target-power", amount: -1, target: "enemy", trigger: "base-success" }, { kind: "self-power", amount: 1, trigger: "base-success" }],
  baby: Array.from({ length: 3 }, () => ({ kind: "self-power" as const, amount: 1 as const, trigger: "base-success" as const })),
  oink: [{ kind: "target-power", amount: -1, target: "enemy", trigger: "base-success" }, { kind: "self-power", amount: 1, trigger: "base-success" }, { kind: "target-power", amount: -1, target: "enemy", trigger: "base-success" }],
  snow: [{ kind: "self-power", amount: 1, trigger: "base-success" }, { kind: "target-power", amount: -1, target: "enemy", trigger: "base-success" }, { kind: "self-power", amount: 1, trigger: "base-success" }],
  wifey: Array.from({ length: 3 }, () => ({ kind: "self-power" as const, amount: 1 as const, trigger: "base-success" as const })),
  barber: [{ kind: "self-power", amount: 1, trigger: "base-success" }, { kind: "target-power", amount: 1, target: "friendly", trigger: "base-success" }, { kind: "target-power", amount: -1, target: "enemy", trigger: "base-success" }],
  bottle: Array.from({ length: 3 }, () => ({ kind: "self-power" as const, amount: 1 as const, trigger: "base-success" as const })),
  sneaker: Array.from({ length: 3 }, () => ({ kind: "self-power" as const, amount: 1 as const, trigger: "base-success" as const })),
  church: [{ kind: "target-power", amount: 1, target: "friendly", trigger: "base-success" }, { kind: "self-power", amount: 1, trigger: "base-success" }, { kind: "target-power", amount: 1, target: "friendly", trigger: "base-success" }],
  landlord: Array.from({ length: 3 }, () => ({ kind: "self-power" as const, amount: 1 as const, trigger: "base-success" as const })),
  carmeet: Array.from({ length: 3 }, () => ({ kind: "self-power" as const, amount: 1 as const, trigger: "base-success" as const })),
  promoter: Array.from({ length: 3 }, () => ({ kind: "self-power" as const, amount: 1 as const, trigger: "base-success" as const })),
  nail: [{ kind: "target-power", amount: 1, target: "friendly", trigger: "base-success" }, { kind: "self-power", amount: 1, trigger: "base-success" }, { kind: "target-power", amount: 1, target: "friendly", trigger: "base-success" }],
  og: [{ kind: "self-power", amount: 1, trigger: "base-success" }, { kind: "target-power", amount: -1, target: "enemy", trigger: "base-success" }, { kind: "self-power", amount: 1, trigger: "base-success" }],
  delivery: Array.from({ length: 3 }, () => ({ kind: "self-power" as const, amount: 1 as const, trigger: "base-success" as const })),
};

const upgrade = (cardId: string, index: 0 | 1 | 2, name: string, description: string): AbilityUpgrade => {
  const effect = upgradeEffects[cardId][index];
  const mechanics = effect.kind === "self-power"
    ? "After the base ability succeeds, this card gains +1 Power."
    : `After the base ability succeeds, its ${effect.target} target ${effect.amount > 0 ? "gains +1" : "loses 1"} Power.`;
  return {
    id: `${cardId}:upgrade:${index + 1}`,
    name,
    description: `${description} ${mechanics}`,
    unlockLevel: ABILITY_UPGRADE_UNLOCK_LEVELS[index],
    effect,
  };
};

const upgrades = (cardId: string, entries: readonly [string, string, string, string, string, string][]) =>
  entries.flatMap((entry) => [0, 1, 2].map((index) =>
    upgrade(cardId, index as 0 | 1 | 2, entry[index * 2], entry[index * 2 + 1]),
  )) as readonly AbilityUpgrade[];
export type Deck = {
  id: string;
  name: string;
  archetype: string;
  accent: string;
  plan: string;
  cards: string[];
  hero: string;
};

export const CARD_RARITIES = ["Common", "Uncommon", "Rare", "Epic", "Legendary"] as const;
export type CardRarity = (typeof CARD_RARITIES)[number];

export type CardRarityDefinition = {
  name: CardRarity;
  order: number;
  color: string;
  cue: string;
  accessibilityLabel: string;
};

export const CARD_RARITY_DEFINITIONS: Record<CardRarity, CardRarityDefinition> = {
  Common: { name: "Common", order: 0, color: "#38bdf8", cue: "◆", accessibilityLabel: "Common rarity, one diamond" },
  Uncommon: { name: "Uncommon", order: 1, color: "#2563eb", cue: "◆◆", accessibilityLabel: "Uncommon rarity, two diamonds" },
  Rare: { name: "Rare", order: 2, color: "#7c3aed", cue: "◆◆◆", accessibilityLabel: "Rare rarity, three diamonds" },
  Epic: { name: "Epic", order: 3, color: "#f97316", cue: "◆◆◆◆", accessibilityLabel: "Epic rarity, four diamonds" },
  Legendary: { name: "Legendary", order: 4, color: "#eab308", cue: "◆◆◆◆◆", accessibilityLabel: "Legendary rarity, five diamonds" },
};

export type CardVariantSlot = {
  id: string;
  name: string;
  description: string;
  shardCost: number;
};

export type CatalogCard = Card & {
  catalogId: string;
  engineId: string;
  artworkId: string;
  rarity: CardRarity;
  faction: string;
  crewTags: string[];
  acquisitionSources: string[];
  variantSlots: CardVariantSlot[];
};

export type DeckLegality = {
  valid: boolean;
  issues: string[];
  missingCardIds: string[];
  unknownCardIds: string[];
};

export const cards: Record<string, Card> = {
  rastamon: { id: "rastamon", name: "Rastamon", type: "Plant", cost: 2, power: 2, ability: "Natural Cure", effect: "Cleanse a frozen or silenced ally here. If cleansed, give it +2 Power.", abilityUpgrades: upgrades("rastamon", [["Rooted Remedy", "Natural Cure grants +1 Power to Rastamon.", "Herbal Guard", "Natural Cure grants +1 Power to Rastamon.", "Evergreen", "Natural Cure grants +1 Power to Rastamon."]]) },
  roaster: { id: "all-jokes-roaster", name: "All Jokes Roaster", type: "Air", cost: 2, power: 3, ability: "Ratio'd Receipts", effect: "Give the highest enemy card here -2 Power. -3 if they played here.", roles: ["Disruption"], abilityUpgrades: upgrades("roaster", [["Extra Receipts", "Ratio'd Receipts grants +1 Power to Roaster.", "Pinned Reply", "Ratio'd Receipts grants +1 Power to Roaster.", "Closing Argument", "Ratio'd Receipts grants +1 Power to Roaster."]]) },
  nerd: { id: "closet-nerd", name: "Closet Nerd", type: "Dark", cost: 3, power: 4, ability: "Unaware", effect: "Silence the highest-Power enemy card here.", roles: ["Disruption"], abilityUpgrades: upgrades("nerd", [["Deep Read", "Unaware grants +1 Power to Nerd.", "Receipts Folder", "Unaware grants +1 Power to Nerd.", "Final Draft", "Unaware grants +1 Power to Nerd."]]) },
  cornball: { id: "cornball", name: "Cornball", type: "Normal", cost: 1, power: 1, ability: "Scare the Hoes", effect: "Move the lowest enemy card if they have at least 3 here.", roles: ["Movement", "Disruption"], abilityUpgrades: upgrades("cornball", [["Awkward Energy", "Scare the Hoes grants +1 Power to Cornball.", "No Chill", "Scare the Hoes grants +1 Power to Cornball.", "Room Clearer", "Scare the Hoes grants +1 Power to Cornball."]]) },
  plug: { id: "plug", name: "Plug", type: "Electric", cost: 2, power: 2, ability: "Connections", effect: "Your next card in another district costs 1 less Motion.", abilityUpgrades: upgrades("plug", [["Open Line", "Connections grants +1 Power to Plug.", "Direct Connect", "Connections grants +1 Power to Plug.", "Network King", "Connections grants +1 Power to Plug."]]) },
  streamer: { id: "live-streamer", name: "Live Streamer", type: "Electric", cost: 2, power: 1, ability: "Follower Frenzy", effect: "The first 2 cheap plays gain +1 Power.", abilityUpgrades: upgrades("streamer", [["Chat Hype", "Follower Frenzy grants +1 Power to Streamer.", "Trending", "Follower Frenzy grants +1 Power to Streamer.", "Front Page", "Follower Frenzy grants +1 Power to Streamer."]]) },
  gamer: { id: "gamer", name: "Gamer", type: "Dark", cost: 3, power: 3, ability: "Tryhard Trigger", effect: "Cheap plays here give Gamer and that card +1 Power.", abilityUpgrades: upgrades("gamer", [["Warmup", "Tryhard Trigger grants +1 Power to Gamer.", "Ranked Focus", "Tryhard Trigger grants +1 Power to Gamer.", "Clutch Mode", "Tryhard Trigger grants +1 Power to Gamer."]]) },
  techbro: { id: "techbro-rich", name: "Techbro Rich", type: "Electric", cost: 4, power: 4, ability: "VC Funded Flex", effect: "Spend 1 unspent Motion to gain +2 Power.", abilityUpgrades: upgrades("techbro", [["Seed Round", "VC Funded Flex grants +1 Power to Techbro.", "Series A", "VC Funded Flex grants +1 Power to Techbro.", "Unicorn", "VC Funded Flex grants +1 Power to Techbro."]]) },
  bikelife: { id: "bikelife-yn", name: "Bikelife YN", type: "Electric", cost: 2, power: 2, ability: "Ride Out", effect: "After reveal, ride to your weakest other district and gain +1 Power.", abilityUpgrades: upgrades("bikelife", [["Wheelie", "Ride Out grants +1 Power to Bikelife.", "Night Ride", "Ride Out grants +1 Power to Bikelife.", "City Loop", "Ride Out grants +1 Power to Bikelife."]]) },
  vibe: { id: "cool-vibe-yn", name: "Cool Vibe YN", type: "Water", cost: 2, power: 2, ability: "Wave Check", effect: "Pull your lowest ally from another district here. Both gain +1 Power.", abilityUpgrades: upgrades("vibe", [["Good Energy", "Wave Check grants +1 Power to Vibe.", "Tidal Pull", "Wave Check grants +1 Power to Vibe.", "High Tide", "Wave Check grants +1 Power to Vibe."]]) },
  hooper: { id: "hooper", name: "Hooper", type: "Fire", cost: 4, power: 5, ability: "Ankle Breaker", effect: "If losing here, enemy highest gets -2 and Hooper gains +2.", abilityUpgrades: upgrades("hooper", [["First Step", "Ankle Breaker grants +1 Power to Hooper.", "Hot Hand", "Ankle Breaker grants +1 Power to Hooper.", "Game Winner", "Ankle Breaker grants +1 Power to Hooper."]]) },
  baby: { id: "baby-momma", name: "Baby Momma", type: "Fire", cost: 4, power: 4, ability: "Mama Bear", effect: "If opponent has more cards here, gain +2 Power.", abilityUpgrades: upgrades("baby", [["Watchful Eye", "Mama Bear grants +1 Power to Baby Momma.", "Protective", "Mama Bear grants +1 Power to Baby Momma.", "Mama Lion", "Mama Bear grants +1 Power to Baby Momma."]]) },
  oink: { id: "officer-oink", name: "Officer Oink", type: "Normal", cost: 5, power: 6, ability: "Civic Pressure", effect: "Every enemy card here loses 1 Power.", roles: ["Disruption"], abilityUpgrades: upgrades("oink", [["Patrol", "Civic Pressure grants +1 Power to Officer Oink.", "Crackdown", "Civic Pressure grants +1 Power to Officer Oink.", "Lockdown", "Civic Pressure grants +1 Power to Officer Oink."]]) },
  snow: { id: "snow-bunny", name: "Snow Bunny", type: "Water", cost: 2, power: 2, ability: "Cold Shoulder", effect: "Freeze the highest enemy card here. Frozen cards add 0 Power until cleansed.", roles: ["Disruption"], abilityUpgrades: upgrades("snow", [["Frostbite", "Cold Shoulder grants +1 Power to Snow Bunny.", "Ice Cold", "Cold Shoulder grants +1 Power to Snow Bunny.", "Whiteout", "Cold Shoulder grants +1 Power to Snow Bunny."]]) },
  wifey: { id: "wifey", name: "Wifey", type: "Normal", cost: 3, power: 4, ability: "Side Eye", effect: "Block the first targeted enemy effect here each round.", abilityUpgrades: upgrades("wifey", [["Sharp Look", "Side Eye grants +1 Power to Wifey.", "Read the Room", "Side Eye grants +1 Power to Wifey.", "Unbothered", "Side Eye grants +1 Power to Wifey."]]) },
  barber: { id: "barber-bro", name: "Barber Bro", type: "Normal", cost: 3, power: 4, ability: "Line Up", effect: "On Reveal: Give your lowest-Power other card here +2 Power. Give the highest-Power enemy here -1 Power.", roles: ["Disruption"], abilityUpgrades: upgrades("barber", [["Fresh Fade", "Line Up grants +1 Power to Barber Bro.", "Detail Work", "Line Up grants +1 Power to its friendly target.", "Clean Finish", "Line Up makes its enemy target lose 1 more Power."]]) },
  bottle: { id: "bottle-girl", name: "Bottle Girl", type: "Poison", cost: 2, power: 2, ability: "Last Call", effect: "On Reveal: If played on Round 4 or later, gain +2 Power. If you have unspent Motion, your next 2-Cost card costs 1 less Motion.", abilityUpgrades: upgrades("bottle", [["After Hours", "Last Call grants +1 Power to Bottle Girl.", "VIP Section", "Last Call grants +1 Power to Bottle Girl.", "Closing Time", "Last Call grants +1 Power to Bottle Girl."]]) },
  sneaker: { id: "sneaker-reseller", name: "Sneaker Reseller", type: "Normal", cost: 2, power: 3, ability: "Flip Season", effect: "The first time your opponent plays a card costing 4 or more, your next card costs 1 less Motion.", abilityUpgrades: upgrades("sneaker", [["Authenticated", "Flip Season grants +1 Power to Sneaker Reseller.", "Markup", "Flip Season grants +1 Power to Sneaker Reseller.", "Sold Out", "Flip Season grants +1 Power to Sneaker Reseller."]]) },
  church: { id: "church-auntie", name: "Church Auntie", type: "Light", cost: 3, power: 3, ability: "Covered", effect: "On Reveal: Protect your lowest-Power other friendly card here. If it already has Protect, give it +2 Power instead.", abilityUpgrades: upgrades("church", [["Prayer Circle", "Covered grants +1 Power to its friendly target.", "Sunday Best", "Covered grants +1 Power to Church Auntie.", "Amen Corner", "Covered grants +1 Power to its friendly target."]]) },
  landlord: { id: "landlord", name: "Landlord", type: "Rock", cost: 4, power: 5, ability: "Rent Due", effect: "Ongoing: The first enemy card played at this district each round costs 1 additional Motion.", roles: ["Disruption"], abilityUpgrades: upgrades("landlord", [["Late Fee", "Rent Due grants +1 Power to Landlord.", "Lease Renewal", "Rent Due grants +1 Power to Landlord.", "Keyholder", "Rent Due grants +1 Power to Landlord."]]) },
  carmeet: { id: "car-meet-kid", name: "Car Meet Kid", type: "Electric", cost: 2, power: 3, ability: "Sideshow", effect: "On Reveal: Move Car Meet Kid to your weakest other district. Then give its lowest-Power other friendly card +1 Power.", roles: ["Movement"], abilityUpgrades: upgrades("carmeet", [["Clean Slide", "Sideshow grants +1 Power to Car Meet Kid.", "Rev Limit", "Sideshow grants +1 Power to Car Meet Kid.", "Burnout", "Sideshow grants +1 Power to Car Meet Kid."]]) },
  promoter: { id: "promoter", name: "Promoter", type: "Air", cost: 3, power: 3, ability: "Guest List", effect: "On Reveal: Reveal one deterministic card in your opponent's hand. If it costs 4 or more, your next card in another district costs 1 less Motion.", abilityUpgrades: upgrades("promoter", [["Plus One", "Guest List grants +1 Power to Promoter.", "Wristband", "Guest List grants +1 Power to Promoter.", "Headliner", "Guest List grants +1 Power to Promoter."]]) },
  nail: { id: "nail-tech", name: "Nail Tech", type: "Poison", cost: 2, power: 2, ability: "Fresh Set", effect: "On Reveal: Give another friendly card here +2 Power. The next time that card is hit by an enemy Power reduction, reduce that loss by 1.", abilityUpgrades: upgrades("nail", [["Chrome Finish", "Fresh Set grants +1 Power to its friendly target.", "Gem Detail", "Fresh Set grants +1 Power to Nail Tech.", "Top Coat", "Fresh Set grants +1 Power to its friendly target."]]) },
  og: { id: "og-uncle", name: "OG Uncle", type: "Fire", cost: 4, power: 6, ability: "Back In My Day", effect: "On Reveal: If your opponent has more total cards on the board than you, gain +3 Power. If they have at least 3 more, also give their lowest-Power card here -1 Power.", roles: ["Disruption"], abilityUpgrades: upgrades("og", [["Real History", "Back In My Day grants +1 Power to OG Uncle.", "Outside Check", "Back In My Day makes its enemy target lose 1 more Power.", "Old School", "Back In My Day grants +1 Power to OG Uncle."]]) },
  delivery: { id: "delivery-demon", name: "Delivery Demon", type: "Air", cost: 1, power: 1, ability: "Drop Off", effect: "On Reveal: Move the lowest-Power other friendly 1- or 2-Cost card here to your weakest other district.", roles: ["Movement"], abilityUpgrades: upgrades("delivery", [["Express Route", "Drop Off grants +1 Power to Delivery Demon.", "Priority Order", "Drop Off grants +1 Power to Delivery Demon.", "Doorstep", "Drop Off grants +1 Power to Delivery Demon."]]) },
};

/** Throws at content-build time rather than allowing an incomplete ability path to ship. */
export function validateCardAbilityUpgrades(value: Record<string, Card> = cards): Record<string, Card> {
  for (const [cardId, card] of Object.entries(value)) {
    const path = card.abilityUpgrades;
    if (!Array.isArray(path) || path.length !== ABILITY_UPGRADE_COUNT) throw new Error(`${cardId} must have exactly three ability upgrades`);
    path.forEach((item, index) => {
      if (!item.name.trim() || !item.description.trim() || item.id !== `${cardId}:upgrade:${index + 1}`) throw new Error(`${cardId} has an invalid ability upgrade`);
      const expected = upgradeEffects[cardId]?.[index];
      if (item.unlockLevel !== ABILITY_UPGRADE_UNLOCK_LEVELS[index] || !expected || JSON.stringify(item.effect) !== JSON.stringify(expected)) throw new Error(`${cardId} has an unbalanced ability upgrade`);
    });
  }
  return value;
}
export const decks: Deck[] = [
  { id: "block", name: "THE BLOCK IS HOT", archetype: "Turf Control", accent: "LOCK", plan: "Claim two districts, tax entry, freeze threats, and close lanes.", cards: ["cornball", "snow", "roaster", "rastamon", "wifey", "oink", "baby"], hero: "officer-oink" },
  { id: "slide", name: "SLIDE THRU", archetype: "Movement", accent: "MOVE", plan: "Spread Power early, then relocate it late into a moving target.", cards: ["cornball", "bikelife", "vibe", "plug", "snow", "hooper", "baby"], hero: "bikelife-yn" },
  { id: "combo", name: "WHO YOU KNOW", archetype: "Combo / Network", accent: "CHAIN", plan: "Chain cheap plays, discounts, generated cards, and oversized turns.", cards: ["cornball", "plug", "streamer", "gamer", "techbro", "vibe", "wifey"], hero: "techbro-rich" },
  { id: "receipts", name: "RECEIPTS", archetype: "Disruption", accent: "EXPOSE", plan: "Expose the plan, Silence engines, and turn investments into bad ones.", cards: ["cornball", "roaster", "nerd", "snow", "plug", "baby", "hooper"], hero: "all-jokes-roaster" },
  { id: "crashout", name: "CRASHOUT SEASON", archetype: "Comeback", accent: "FLIP", plan: "Absorb early deficits, then flip contested districts with late Power spikes.", cards: ["cornball", "rastamon", "snow", "wifey", "baby", "hooper", "roaster"], hero: "hooper" },
  { id: "vibes", name: "GOOD VIBES ONLY", archetype: "Sustain", accent: "CLEANSE", plan: "Cleanse, Protect, suppress hostile rules, and keep scaling pieces alive.", cards: ["rastamon", "wifey", "snow", "vibe", "hooper", "oink", "plug"], hero: "rastamon" },
  { id: "compound", name: "COMPOUND INTEREST", archetype: "Growth / Scaling", accent: "GROW", plan: "Invest early in engines and convert repeated buffs into late value.", cards: ["cornball", "plug", "streamer", "rastamon", "gamer", "techbro", "wifey"], hero: "gamer" },
];

export const rarityByEngineId = {
  cornball: "Common",
  hooper: "Common",
  plug: "Common",
  snow: "Common",
  wifey: "Common",
  baby: "Uncommon",
  bikelife: "Uncommon",
  gamer: "Uncommon",
  rastamon: "Uncommon",
  vibe: "Uncommon",
  nerd: "Rare",
  roaster: "Rare",
  streamer: "Rare",
  oink: "Epic",
  techbro: "Epic",
  barber: "Common",
  bottle: "Uncommon",
  sneaker: "Uncommon",
  church: "Rare",
  landlord: "Epic",
  carmeet: "Uncommon",
  promoter: "Rare",
  nail: "Common",
  og: "Legendary",
  delivery: "Common",
} as const satisfies Record<keyof typeof cards, CardRarity>;

export function validateCardCatalogRarities(
  cardEntries: Record<string, Card> = cards,
  assignments: Record<string, unknown> = rarityByEngineId,
): void {
  const supported = new Set<string>(CARD_RARITIES);
  for (const engineId of Object.keys(cardEntries)) {
    const rarity = assignments[engineId];
    if (typeof rarity !== "string" || !supported.has(rarity)) {
      throw new Error(`Card ${engineId} has missing or unsupported rarity: ${String(rarity)}`);
    }
  }
  for (const engineId of Object.keys(assignments)) {
    if (!cardEntries[engineId]) {
      throw new Error(`Rarity assignment references unknown card ${engineId}`);
    }
  }
}

const factionByEngineId: Record<string, string> = {
  rastamon: "Good Vibes",
  roaster: "Receipts",
  nerd: "Receipts",
  cornball: "The Block",
  plug: "Who You Know",
  streamer: "Who You Know",
  gamer: "Compound",
  techbro: "Compound",
  bikelife: "Slide Thru",
  vibe: "Good Vibes",
  hooper: "Crashout",
  baby: "Crashout",
  oink: "The Block",
  snow: "The Block",
  wifey: "Good Vibes",
  barber: "City Never Sleeps",
  bottle: "The Function",
  sneaker: "City Never Sleeps",
  church: "Old Heads Know",
  landlord: "Rent's Due",
  carmeet: "Side Show",
  promoter: "The Function",
  nail: "City Never Sleeps",
  og: "Old Heads Know",
  delivery: "Side Show",
};

const sourceByEngineId: Record<string, string[]> = {
  cornball: ["Starter crews", "Street Packs"],
  snow: ["Starter crews", "Collection Road"],
  roaster: ["Starter crews", "Street Packs"],
  rastamon: ["Starter crews", "Collection Road"],
  wifey: ["Starter crews", "Street Packs"],
  oink: ["Starter crews", "Collection Road"],
  baby: ["Starter crews", "Street Packs"],
  bikelife: ["Starter crews", "Collection Road"],
  vibe: ["Starter crews", "Street Packs"],
  plug: ["Starter crews", "Collection Road"],
  hooper: ["Starter crews", "Street Packs"],
  streamer: ["Starter crews", "Collection Road"],
  gamer: ["Starter crews", "Street Packs"],
  techbro: ["Starter crews", "Collection Road"],
  nerd: ["Starter crews", "Chapter One boss"],
};

validateCardCatalogRarities();

export const cardCatalog: CatalogCard[] = Object.entries(cards).map(
  ([engineId, card]) => ({
    ...card,
    catalogId: card.id,
    engineId,
    artworkId: card.id,
    rarity: rarityByEngineId[engineId as keyof typeof rarityByEngineId],
    faction: factionByEngineId[engineId] ?? "Independent",
    crewTags: decks
      .filter((deck) => deck.cards.includes(engineId))
      .map((deck) => deck.id),
    acquisitionSources: sourceByEngineId[engineId] ?? (["barber", "bottle", "sneaker", "church", "landlord", "carmeet", "promoter", "nail", "og", "delivery"].includes(engineId) ? ["City Never Sleeps"] : ["Street Packs"]),
    variantSlots: [
      {
        id: `${card.id}:tagged`,
        name: "Tagged",
        description: "Animated spray-paint frame and nameplate.",
        shardCost: 80,
      },
      {
        id: `${card.id}:chrome`,
        name: "Chrome",
        description: "Reflective showcase frame for your favorite crew.",
        shardCost: 140,
      },
    ],
  }),
);

export const catalogCardById = Object.fromEntries(
  cardCatalog.map((card) => [card.catalogId, card]),
) as Record<string, CatalogCard>;

export const catalogCardByEngineId = Object.fromEntries(
  cardCatalog.map((card) => [card.engineId, card]),
) as Record<string, CatalogCard>;

export const starterRecipes = decks.map((deck) => ({
  ...deck,
  catalogCardIds: deck.cards.map(
    (engineId) => catalogCardByEngineId[engineId].catalogId,
  ),
}));

export function catalogIdsToEngineIds(catalogIds: string[]): string[] {
  return catalogIds.map((catalogId) => {
    const card = catalogCardById[catalogId];
    if (!card) throw new Error(`Unknown catalog card ${catalogId}`);
    return card.engineId;
  });
}

export function engineIdsToCatalogIds(engineIds: string[]): string[] {
  return engineIds.map((engineId) => {
    const card = catalogCardByEngineId[engineId];
    if (!card) throw new Error(`Unknown engine card ${engineId}`);
    return card.catalogId;
  });
}

export function validateSavedDeck(
  cardIds: string[],
  ownedCardIds: string[],
  heroCardId?: string | null,
): DeckLegality {
  const unknownCardIds = cardIds.filter((id) => !catalogCardById[id]);
  const owned = new Set(ownedCardIds);
  const missingCardIds = cardIds.filter(
    (id) => catalogCardById[id] && !owned.has(id),
  );
  const issues: string[] = [];
  if (cardIds.length !== 7) {
    issues.push(
      cardIds.length < 7
        ? `Add ${7 - cardIds.length} more card${7 - cardIds.length === 1 ? "" : "s"}.`
        : `Remove ${cardIds.length - 7} card${cardIds.length - 7 === 1 ? "" : "s"}.`,
    );
  }
  if (new Set(cardIds).size !== cardIds.length) {
    issues.push("A deck can only use one gameplay copy of each card.");
  }
  if (unknownCardIds.length) {
    issues.push("Remove cards that are no longer in the catalog.");
  }
  if (missingCardIds.length) {
    issues.push(
      `Unlock ${missingCardIds.length} missing card${missingCardIds.length === 1 ? "" : "s"}.`,
    );
  }
  if (!heroCardId) {
    issues.push("Choose a crew hero.");
  } else if (!cardIds.includes(heroCardId)) {
    issues.push("Your crew hero must be one of the seven cards.");
  }
  return {
    valid: issues.length === 0,
    issues,
    missingCardIds,
    unknownCardIds,
  };
}

export const districts = [
  { name: "THE TOWN", rule: "Fire + Dark cards gain +2 Power.", strategy: "A raw-Power lane. Contest it with Fire or Dark, or bluff it to pull the rival away." },
  { name: "GROUP CHAT", rule: "Disruption cards gain +2 Power.", strategy: "Interaction pays here. Commit when your ability has a real target; abandon it when the rival is baiting disruption." },
  { name: "SERVER ROOM", rule: "Electric cards gain +3 Power.", strategy: "The biggest district bonus. Electric threats demand an answer, but stacking here can concede the other two lanes." },
];

