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
};

export type Deck = {
  id: string;
  name: string;
  archetype: string;
  accent: string;
  plan: string;
  cards: string[];
  hero: string;
};

export type CardRarity = "Common" | "Uncommon" | "Rare" | "Epic";

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
  rastamon: { id: "rastamon", name: "Rastamon", type: "Plant", cost: 2, power: 2, ability: "Natural Cure", effect: "Cleanse a frozen or silenced ally here. If cleansed, give it +2 Power." },
  roaster: { id: "all-jokes-roaster", name: "All Jokes Roaster", type: "Air", cost: 2, power: 3, ability: "Ratio'd Receipts", effect: "Give the highest enemy card here -2 Power. -3 if they played here.", roles: ["Disruption"] },
  nerd: { id: "closet-nerd", name: "Closet Nerd", type: "Dark", cost: 3, power: 4, ability: "Unaware", effect: "Silence the highest-Power enemy card here.", roles: ["Disruption"] },
  cornball: { id: "cornball", name: "Cornball", type: "Normal", cost: 1, power: 1, ability: "Scare the Hoes", effect: "Move the lowest enemy card if they have at least 3 here.", roles: ["Movement", "Disruption"] },
  plug: { id: "plug", name: "Plug", type: "Electric", cost: 2, power: 2, ability: "Connections", effect: "Your next card in another district costs 1 less Hype." },
  streamer: { id: "live-streamer", name: "Live Streamer", type: "Electric", cost: 2, power: 1, ability: "Follower Frenzy", effect: "The first 2 cheap plays gain +1 Power." },
  gamer: { id: "gamer", name: "Gamer", type: "Dark", cost: 3, power: 3, ability: "Tryhard Trigger", effect: "Cheap plays here give Gamer and that card +1 Power." },
  techbro: { id: "techbro-rich", name: "Techbro Rich", type: "Electric", cost: 4, power: 4, ability: "VC Funded Flex", effect: "Spend 1 unspent Hype to gain +2 Power." },
  bikelife: { id: "bikelife-yn", name: "Bikelife YN", type: "Electric", cost: 2, power: 2, ability: "Ride Out", effect: "After reveal, ride to your weakest other district and gain +1 Power." },
  vibe: { id: "cool-vibe-yn", name: "Cool Vibe YN", type: "Water", cost: 2, power: 2, ability: "Wave Check", effect: "Pull your lowest ally from another district here. Both gain +1 Power." },
  hooper: { id: "hooper", name: "Hooper", type: "Fire", cost: 4, power: 5, ability: "Ankle Breaker", effect: "If losing here, enemy highest gets -2 and Hooper gains +2." },
  baby: { id: "baby-momma", name: "Baby Momma", type: "Fire", cost: 4, power: 4, ability: "Mama Bear", effect: "If opponent has more cards here, gain +2 Power." },
  oink: { id: "officer-oink", name: "Officer Oink", type: "Normal", cost: 5, power: 6, ability: "Civic Pressure", effect: "Every enemy card here loses 1 Power.", roles: ["Disruption"] },
  snow: { id: "snow-bunny", name: "Snow Bunny", type: "Water", cost: 2, power: 2, ability: "Cold Shoulder", effect: "Freeze the highest enemy card here. Frozen cards add 0 Power until cleansed.", roles: ["Disruption"] },
  wifey: { id: "wifey", name: "Wifey", type: "Normal", cost: 3, power: 4, ability: "Side Eye", effect: "Block the first targeted enemy effect here each round." },
};

export const decks: Deck[] = [
  { id: "block", name: "THE BLOCK IS HOT", archetype: "Turf Control", accent: "LOCK", plan: "Claim two districts, tax entry, freeze threats, and close lanes.", cards: ["cornball", "snow", "roaster", "rastamon", "wifey", "oink", "baby"], hero: "officer-oink" },
  { id: "slide", name: "SLIDE THRU", archetype: "Movement", accent: "MOVE", plan: "Spread Power early, then relocate it late into a moving target.", cards: ["cornball", "bikelife", "vibe", "plug", "snow", "hooper", "baby"], hero: "bikelife-yn" },
  { id: "combo", name: "WHO YOU KNOW", archetype: "Combo / Network", accent: "CHAIN", plan: "Chain cheap plays, discounts, generated cards, and oversized turns.", cards: ["cornball", "plug", "streamer", "gamer", "techbro", "vibe", "wifey"], hero: "techbro-rich" },
  { id: "receipts", name: "RECEIPTS", archetype: "Disruption", accent: "EXPOSE", plan: "Expose the plan, Silence engines, and turn investments into bad ones.", cards: ["cornball", "roaster", "nerd", "snow", "plug", "baby", "hooper"], hero: "all-jokes-roaster" },
  { id: "crashout", name: "CRASHOUT SEASON", archetype: "Comeback", accent: "FLIP", plan: "Absorb early deficits, then flip contested districts with late Power spikes.", cards: ["cornball", "rastamon", "snow", "wifey", "baby", "hooper", "roaster"], hero: "hooper" },
  { id: "vibes", name: "GOOD VIBES ONLY", archetype: "Sustain", accent: "CLEANSE", plan: "Cleanse, Protect, suppress hostile rules, and keep scaling pieces alive.", cards: ["rastamon", "wifey", "snow", "vibe", "hooper", "oink", "plug"], hero: "rastamon" },
  { id: "compound", name: "COMPOUND INTEREST", archetype: "Growth / Scaling", accent: "GROW", plan: "Invest early in engines and convert repeated buffs into late value.", cards: ["cornball", "plug", "streamer", "rastamon", "gamer", "techbro", "wifey"], hero: "gamer" },
];

const rarityByEngineId: Record<string, CardRarity> = {
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
};

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

export const cardCatalog: CatalogCard[] = Object.entries(cards).map(
  ([engineId, card]) => ({
    ...card,
    catalogId: card.id,
    engineId,
    artworkId: card.id,
    rarity: rarityByEngineId[engineId] ?? "Common",
    faction: factionByEngineId[engineId] ?? "Independent",
    crewTags: decks
      .filter((deck) => deck.cards.includes(engineId))
      .map((deck) => deck.id),
    acquisitionSources: sourceByEngineId[engineId] ?? ["Street Packs"],
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
  { name: "THE TOWN", rule: "Fire + Dark cards gain +2 Power." },
  { name: "GROUP CHAT", rule: "Disruption cards gain +2 Power." },
  { name: "SERVER ROOM", rule: "Electric cards gain +3 Power." },
];
