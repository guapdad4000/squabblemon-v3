import { commonUpgradeEffects, neighborhoodCommons } from './commonCards';
import { superCommonCards, superCommonUpgradeEffects } from './superCommonCards';
import { expansionCards, expansionRarities, expansionUpgradeEffects } from './blockExpansion';
import { supportCards, supportRarities, supportUpgradeEffects } from './supportCards';
import { streetWaveCards, streetWaveRarities, streetWaveUpgradeEffects } from './streetWave';
import { mythicLegendCards, mythicLegendRarities, mythicLegendUpgradeEffects } from './mythicLegends';

export const DECK_SIZE = 10;
export const MAX_MOTION = 9;

export type Card = {
  id: string;
  name: string;
  type: string;
  cost: number;
  power: number;
  ability: string;
  effect: string;
  roles?: string[];
  kind?: 'character' | 'support' | 'token';
  /** Planted hazards occupy the board visually, but do not score or join a crew. */
  hazard?: true;
  /** Supplied full portrait art may intentionally retain its original backdrop. */
  artworkLayout?: 'portrait';
  deck?: string;
  owner?: "player" | "cpu";
  abilityUpgrades: readonly AbilityUpgrade[];
  /** When set, while this card is in its owner's hand every other friendly character of the
   *  same type gains +1 Hand at round end. The elemental-bond system uses GUAP's hand effect
   *  as the template; future bond cards (Water / Electric / Plant / Air) plug into the same
   *  field. Engine reads this in applyOngoingRoundEndHandEffects. */
  elementalBond?: string;
  /** Per-card entry vfx descriptor. The UI uses this to color/scale the staged card on play. */
  entryVfx?: {
    readonly accent: string;
    readonly keyframeId?: string;
  };
  /** When set, the inspector renders a 3-layer parallax scene for the "looking at it" loop. */
  immersiveAssetId?: {
    readonly backgroundAssetId: string;
    readonly midgroundAssetId?: string;
    readonly foregroundAssetId: string;
  };
  /** Per-card portrait pop color used on hand draw. Falls back to the card type's accent. */
  portraitAccent?: string;
};

/** Resolve the per-card entry accent, falling back to a card-type-derived color. */
export const cardEntryAccent = (card: Card): string =>
  card.entryVfx?.accent ?? card.portraitAccent ?? defaultEntryAccent(card.type);

const defaultEntryAccent = (type: string): string => {
  const t = type.toLowerCase();
  if (t === "fire" || t === "dark") return "#fb923c";
  if (t === "electric") return "#22d3ee";
  if (t === "water") return "#60a5fa";
  if (t === "plant") return "#4ade80";
  if (t === "air") return "#a78bfa";
  if (t === "earth") return "#d4a373";
  if (t === "shadow") return "#a3a3a3";
  if (t === "light") return "#fde68a";
  return "#facc15";
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
  kyle: Array.from({ length: 3 }, () => ({ kind: 'self-power' as const, amount: 1 as const, trigger: 'base-success' as const })),
  stockz: Array.from({ length: 3 }, () => ({ kind: 'self-power' as const, amount: 1 as const, trigger: 'base-success' as const })),
  guap: Array.from({ length: 3 }, () => ({ kind: "self-power" as const, amount: 1 as const, trigger: "base-success" as const })),
  ...commonUpgradeEffects,
  ...superCommonUpgradeEffects,
  ...expansionUpgradeEffects,
  ...supportUpgradeEffects,
  ...streetWaveUpgradeEffects,
  ...mythicLegendUpgradeEffects,
  bossbabe: Array.from({ length: 3 }, () => ({ kind: "self-power" as const, amount: 1 as const, trigger: "base-success" as const })),
  scammer: Array.from({ length: 3 }, () => ({ kind: "self-power" as const, amount: 1 as const, trigger: "base-success" as const })),
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
    ? "After the base ability succeeds, this card gains +1 Hands."
    : `After the base ability succeeds, its ${effect.target} target ${effect.amount > 0 ? "gains +1" : "loses 1"} Hands.`;
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

export const CARD_RARITIES = ["SuperCommon", "Common", "Uncommon", "Rare", "Epic", "Legendary", "Mythical"] as const;
export type CardRarity = (typeof CARD_RARITIES)[number];

export type CardRarityDefinition = {
  name: CardRarity;
  label: string;
  order: number;
  color: string;
  cue: string;
  accessibilityLabel: string;
};

export const CARD_RARITY_DEFINITIONS: Record<CardRarity, CardRarityDefinition> = {
  SuperCommon: { name: "SuperCommon", label: "Super Common", order: -1, color: "#cbb99c", cue: "◇", accessibilityLabel: "Super Common rarity, one outline diamond" },
  Common: { name: "Common", label: "Common", order: 0, color: "#a8ada9", cue: "◆", accessibilityLabel: "Common rarity, one diamond" },
  Uncommon: { name: "Uncommon", label: "Uncommon", order: 1, color: "#4ade80", cue: "◆◆", accessibilityLabel: "Uncommon rarity, two diamonds" },
  Rare: { name: "Rare", label: "Rare", order: 2, color: "#3b82f6", cue: "◆◆◆", accessibilityLabel: "Rare rarity, three diamonds" },
  Epic: { name: "Epic", label: "Super Rare", order: 3, color: "#a855f7", cue: "◆◆◆◆", accessibilityLabel: "Super Rare rarity, four diamonds" },
  Legendary: { name: "Legendary", label: "Legendary", order: 4, color: "#eab308", cue: "◆◆◆◆◆", accessibilityLabel: "Legendary rarity, five diamonds" },
  Mythical: { name: "Mythical", label: "Mythical", order: 5, color: "#ef4444", cue: "◆◆◆◆◆◆", accessibilityLabel: "Mythical rarity, six diamonds" },
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
  guap: { id: "guap", name: "GUAP", type: "Fire", cost: 6, power: 5, ability: "FINNAM!", effect: "On Reveal: Gain +1 Hands for each other friendly card here, up to +5. Give every enemy here -1 Hands. Ongoing: While GUAP is in your hand, your other Fire characters gain +1 Hands at round end.", roles: ["Pressure", "Disruption"], elementalBond: "Fire", abilityUpgrades: upgrades("guap", [["Golden Charge", "FINNAM! gathers golden energy.", "Falcon Ascendant", "FINNAM! spreads its burning wings.", "Phoenix Supernova", "FINNAM! erupts in a golden supernova."]]), entryVfx: { accent: "#f5c542" }, portraitAccent: "#f5c542" /* GUAP is the Fire bond in the elemental-bond system; Ice Cream Truck is Water, Rooftop Gardener is Plant, Pirate Radio DJ is Electric. */ },
  bossbabe: { id: "boss-babe", name: "Boss Bae", type: "Electric", cost: 3, power: 3, ability: "Network Boost", effect: "The first 2 times you play a card in another district, gain +1 Hands. After the second, your next card costing 4 or more costs 1 less Motion.", abilityUpgrades: upgrades("bossbabe", [["First Meeting", "Network Boost grants +1 Hands to Boss Bae.", "Closing Deals", "Network Boost grants +1 Hands to Boss Bae.", "Corner Office", "Network Boost grants +1 Hands to Boss Bae."]]) },
  scammer: { id: "scammer", name: "Scammer", type: "Dark", cost: 3, power: 3, ability: "Imposter", effect: "On Reveal: Copy the base Hands (up to 7) and printed ability of the highest-Hands enemy here. Copied On Reveal abilities do not trigger.", roles: ["Disruption", "Copy"], abilityUpgrades: upgrades("scammer", [["New Alias", "Imposter grants +1 Hands to Scammer.", "Fine Print", "Imposter grants +1 Hands to Scammer.", "Perfect Cover", "Imposter grants +1 Hands to Scammer."]]) },
  rastamon: { id: "rastamon", name: "Rastamon", type: "Plant", cost: 2, power: 2, ability: "Natural Cure", effect: "Cleanse a frozen or silenced ally here. If cleansed, give it +2 Hands.", abilityUpgrades: upgrades("rastamon", [["Rooted Remedy", "Natural Cure grants +1 Hands to Rastamon.", "Herbal Guard", "Natural Cure grants +1 Hands to Rastamon.", "Evergreen", "Natural Cure grants +1 Hands to Rastamon."]]), entryVfx: { accent: "#4ade80", keyframeId: "vine-burst" }, portraitAccent: "#4ade80", immersiveAssetId: { backgroundAssetId: "assets/cards/immersive/rastamon/bg.webp", foregroundAssetId: "assets/cards/immersive/rastamon/fg.webp" } },
  roaster: { id: "all-jokes-roaster", name: "All Jokes Roaster", type: "Air", cost: 3, power: 3, ability: "Ratio'd Receipts", effect: "On Reveal: Apply 2 Burn to the highest enemy card here. -3 Hands if they played here.", roles: ["Disruption"], abilityUpgrades: upgrades("roaster", [["Extra Receipts", "Ratio'd Receipts grants +1 Hands to Roaster.", "Pinned Reply", "Ratio'd Receipts grants +1 Hands to Roaster.", "Closing Argument", "Ratio'd Receipts grants +1 Hands to Roaster."]]), entryVfx: { accent: "#a78bfa" }, portraitAccent: "#a78bfa" },
  nerd: { id: "closet-nerd", name: "Closet Nerd", type: "Dark", cost: 4, power: 3, ability: "Unaware", effect: "Silence the highest-Hands enemy here, bypassing Wifey's Side Eye. Protection on that enemy still blocks this.", roles: ["Disruption"], abilityUpgrades: upgrades("nerd", [["Deep Read", "Unaware grants +1 Hands to Nerd.", "Receipts Folder", "Unaware grants +1 Hands to Nerd.", "Final Draft", "Unaware grants +1 Hands to Nerd."]]) },
  cornball: { id: "cornball", name: "Cornball", type: "Normal", cost: 1, power: 1, ability: "Scare the Hoes", effect: "On Reveal: Apply 1 Burn to every enemy here.", roles: ["Disruption"], abilityUpgrades: upgrades("cornball", [["Awkward Energy", "Scare the Hoes grants +1 Hands to Cornball.", "No Chill", "Scare the Hoes grants +1 Hands to Cornball.", "Room Clearer", "Scare the Hoes grants +1 Hands to Cornball."]]) },
  plug: { id: "plug", name: "Plug", type: "Electric", cost: 1, power: 2, ability: "Connections", effect: "Your next card in another district costs 1 less Motion.", abilityUpgrades: upgrades("plug", [["Open Line", "Connections grants +1 Hands to Plug.", "Direct Connect", "Connections grants +1 Hands to Plug.", "Network King", "Connections grants +1 Hands to Plug."]]), entryVfx: { accent: "#22d3ee" }, portraitAccent: "#22d3ee" },
  streamer: { id: "live-streamer", name: "Live Streamer", type: "Electric", cost: 2, power: 1, ability: "Follower Frenzy", effect: "On Reveal: Reset your cheap-play trigger counter. The next 2 cards you play this turn with cost 2 or less gain +1 Hand each.", abilityUpgrades: upgrades("streamer", [["Chat Hype", "Follower Frenzy grants +1 Hands to Streamer.", "Trending", "Follower Frenzy grants +1 Hands to Streamer.", "Front Page", "Follower Frenzy grants +1 Hands to Streamer."]]) },
  gamer: { id: "gamer", name: "Gamer", type: "Dark", cost: 3, power: 3, ability: "City Tour", effect: "On Reveal: For each other district, give the lowest-Hands friendly card there +1 Hand.", abilityUpgrades: upgrades("gamer", [["Warmup", "City Tour grants +1 Hands to Gamer.", "Ranked Focus", "City Tour grants +1 Hands to Gamer.", "Clutch Mode", "City Tour grants +1 Hands to Gamer."]]) },
  techbro: { id: "techbro-rich", name: "Techbro Rich", type: "Electric", cost: 4, power: 5, ability: "VC Funded Flex", effect: "On Reveal: If another friendly card is here, gain +2 Hands.", abilityUpgrades: upgrades("techbro", [["Seed Round", "VC Funded Flex grants +1 Hands to Techbro.", "Series A", "VC Funded Flex grants +1 Hands to Techbro.", "Unicorn", "VC Funded Flex grants +1 Hands to Techbro."]]) },
  bikelife: { id: "bikelife-yn", name: "Bikelife YN", type: "Electric", cost: 2, power: 2, ability: "Ride Out", effect: "After reveal, ride to your weakest other district and gain +1 Hands.", abilityUpgrades: upgrades("bikelife", [["Wheelie", "Ride Out grants +1 Hands to Bikelife.", "Night Ride", "Ride Out grants +1 Hands to Bikelife.", "City Loop", "Ride Out grants +1 Hands to Bikelife."]]) },
  vibe: { id: "cool-vibe-yn", name: "Cool Vibe YN", type: "Water", cost: 2, power: 2, ability: "Wave Check", effect: "Pull your lowest ally from another district here. Both gain +1 Hands.", abilityUpgrades: upgrades("vibe", [["Good Energy", "Wave Check grants +1 Hands to Vibe.", "Tidal Pull", "Wave Check grants +1 Hands to Vibe.", "High Tide", "Wave Check grants +1 Hands to Vibe."]]) },
  hooper: { id: "hooper", name: "Hooper", type: "Fire", cost: 5, power: 5, ability: "Ankle Breaker", effect: "If losing here, enemy highest gets -2 and Hooper gains +2.", abilityUpgrades: upgrades("hooper", [["First Step", "Ankle Breaker grants +1 Hands to Hooper.", "Hot Hand", "Ankle Breaker grants +1 Hands to Hooper.", "Game Winner", "Ankle Breaker grants +1 Hands to Hooper."]]) },
  baby: { id: "baby-momma", name: "Baby Momma", type: "Fire", cost: 4, power: 5, ability: "Mama Bear", effect: "If opponent has more cards here, gain +2 Hands.", abilityUpgrades: upgrades("baby", [["Watchful Eye", "Mama Bear grants +1 Hands to Baby Momma.", "Protective", "Mama Bear grants +1 Hands to Baby Momma.", "Mama Lion", "Mama Bear grants +1 Hands to Baby Momma."]]) },
  oink: { id: "officer-oink", name: "Officer Oink", type: "Normal", cost: 5, power: 6, ability: "Civic Pressure", effect: "On Reveal: Apply Weaken to every enemy card here. Gain +1 Hands for each enemy Weakened.", roles: ["Disruption"], abilityUpgrades: upgrades("oink", [["Patrol", "Civic Pressure grants +1 Hands to Officer Oink.", "Crackdown", "Civic Pressure grants +1 Hands to Officer Oink.", "Lockdown", "Civic Pressure grants +1 Hands to Officer Oink."]]) },
  snow: { id: "snow-bunny", name: "Snow Bunny", type: "Water", cost: 3, power: 2, ability: "Cold Shoulder", effect: "Freeze the highest enemy card here. Frozen cards add 0 Hands until cleansed.", roles: ["Disruption"], abilityUpgrades: upgrades("snow", [["Frostbite", "Cold Shoulder grants +1 Hands to Snow Bunny.", "Ice Cold", "Cold Shoulder grants +1 Hands to Snow Bunny.", "Whiteout", "Cold Shoulder grants +1 Hands to Snow Bunny."]]), entryVfx: { accent: "#60a5fa" }, portraitAccent: "#60a5fa" },
  wifey: { id: "wifey", name: "Wifey", type: "Normal", cost: 4, power: 4, ability: "Side Eye", effect: "Block the first targeted enemy effect here each round.", abilityUpgrades: upgrades("wifey", [["Sharp Look", "Side Eye grants +1 Hands to Wifey.", "Read the Room", "Side Eye grants +1 Hands to Wifey.", "Unbothered", "Side Eye grants +1 Hands to Wifey."]]), entryVfx: { accent: "#fda4af" }, portraitAccent: "#fda4af", immersiveAssetId: { backgroundAssetId: "assets/cards/immersive/wifey/bg.webp", foregroundAssetId: "assets/cards/immersive/wifey/fg.webp" } },
  barber: { id: "barber-bro", name: "Barber Bro", type: "Normal", cost: 4, power: 4, ability: "Line Up", effect: "On Reveal: Give your lowest-Hands other card here +2 Hands. Give the highest-Hands enemy here -1 Hands.", roles: ["Disruption"], abilityUpgrades: upgrades("barber", [["Fresh Fade", "Line Up grants +1 Hands to Barber Bro.", "Detail Work", "Line Up grants +1 Hands to its friendly target.", "Clean Finish", "Line Up makes its enemy target lose 1 more Hands."]]) },
  bottle: { id: "bottle-girl", name: "Bottle Girl", type: "Poison", cost: 2, power: 3, ability: "Last Call", effect: "On Reveal: If played on Round 4 or later, gain +2 Hands. Your next 2-Cost card costs 1 less Motion.", abilityUpgrades: upgrades("bottle", [["After Hours", "Last Call grants +1 Hands to Bottle Girl.", "VIP Section", "Last Call grants +1 Hands to Bottle Girl.", "Closing Time", "Last Call grants +1 Hands to Bottle Girl."]]) },
  sneaker: { id: "sneaker-reseller", name: "Sneaker Reseller", type: "Normal", cost: 3, power: 3, ability: "Flip Season", effect: "On Reveal: Gain +X Hands where X is the printed Power of the highest-Hands enemy on the board, up to +7. Apply Weaken to that enemy.", abilityUpgrades: upgrades("sneaker", [["Authenticated", "Flip Season grants +1 Hands to Sneaker Reseller.", "Markup", "Flip Season grants +1 Hands to Sneaker Reseller.", "Sold Out", "Flip Season grants +1 Hands to Sneaker Reseller."]]) },
  church: { id: "church-auntie", name: "Church Auntie", type: "Light", cost: 3, power: 4, artworkLayout: "portrait", ability: "Covered", effect: "On Reveal: Give your lowest-Hands other friendly card here +2 Hands and Protect it from one targeted enemy ability. If already protected, it still gains +2 Hands.", abilityUpgrades: upgrades("church", [["Prayer Circle", "Covered grants +1 Hands to its friendly target.", "Sunday Best", "Covered grants +1 Hands to Church Auntie.", "Amen Corner", "Covered grants +1 Hands to its friendly target."]]) },
  landlord: { id: "landlord", name: "Landlord", type: "Rock", cost: 4, power: 6, ability: "Rent Due", effect: "Ongoing: The first enemy card played at this district each round costs 1 additional Motion.", roles: ["Disruption"], abilityUpgrades: upgrades("landlord", [["Late Fee", "Rent Due grants +1 Hands to Landlord.", "Lease Renewal", "Rent Due grants +1 Hands to Landlord.", "Keyholder", "Rent Due grants +1 Hands to Landlord."]]), entryVfx: { accent: "#d4a373" }, portraitAccent: "#d4a373" },
  carmeet: { id: "car-meet-kid", name: "Car Meet Kid", type: "Electric", cost: 2, power: 2, ability: "Sideshow", effect: "On Reveal: Move Car Meet Kid to your weakest other district. Then give its lowest-Hands other friendly card +1 Hands.", roles: ["Movement"], abilityUpgrades: upgrades("carmeet", [["Clean Slide", "Sideshow grants +1 Hands to Car Meet Kid.", "Rev Limit", "Sideshow grants +1 Hands to Car Meet Kid.", "Burnout", "Sideshow grants +1 Hands to Car Meet Kid."]]) },
  promoter: { id: "promoter", name: "Promoter", type: "Air", cost: 3, power: 3, ability: "Guest List", effect: "On Reveal: Reveal one deterministic card in your opponent's hand. If it costs 4 or more, your next card in another district costs 1 less Motion.", abilityUpgrades: upgrades("promoter", [["Plus One", "Guest List grants +1 Hands to Promoter.", "Wristband", "Guest List grants +1 Hands to Promoter.", "Headliner", "Guest List grants +1 Hands to Promoter."]]) },
  nail: { id: "nail-tech", name: "Nail Tech", type: "Poison", cost: 2, power: 3, ability: "Fresh Set", effect: "On Reveal: Give another friendly card here +2 Hands. The next time that card is hit by an enemy Hands reduction, reduce that loss by 1.", abilityUpgrades: upgrades("nail", [["Chrome Finish", "Fresh Set grants +1 Hands to its friendly target.", "Gem Detail", "Fresh Set grants +1 Hands to Nail Tech.", "Top Coat", "Fresh Set grants +1 Hands to its friendly target."]]) },
  og: { id: "og-uncle", name: "OG Uncle", type: "Fire", cost: 4, power: 5, ability: "Back In My Day", effect: "On Reveal: If your opponent has more total cards on the board than you, gain +3 Hands. If they have at least 3 more, also give their lowest-Hands card here -1 Hands.", roles: ["Disruption"], abilityUpgrades: upgrades("og", [["Real History", "Back In My Day grants +1 Hands to OG Uncle.", "Outside Check", "Back In My Day makes its enemy target lose 1 more Hands.", "Old School", "Back In My Day grants +1 Hands to OG Uncle."]]) },
  delivery: { id: "delivery-demon", name: "Delivery Demon", type: "Air", cost: 1, power: 1, ability: "Drop Off", effect: "On Reveal: Move the lowest-Hands other friendly 1- or 2-Cost card here to your weakest other district.", roles: ["Movement"], abilityUpgrades: upgrades("delivery", [["Express Route", "Drop Off grants +1 Hands to Delivery Demon.", "Priority Order", "Drop Off grants +1 Hands to Delivery Demon.", "Doorstep", "Drop Off grants +1 Hands to Delivery Demon."]]) },
  ...neighborhoodCommons,
  ...superCommonCards,
  ...expansionCards,
  ...supportCards,
  ...streetWaveCards,
  ...mythicLegendCards,
  kyle: { id: 'kyle', name: 'KYLE', kind: 'character', type: 'Fire', cost: 4, power: 4, ability: 'Smile Bombs', effect: 'On Reveal: Plant 4 Smile Bombs in random enemy districts. At the start of the next round, each explodes for -2 Hands to one random enemy in its district. KYLE gains +1 Hands for every enemy hit, plus +1 more if that enemy is destroyed.', roles: ['Disruption', 'Growth'], artworkLayout: 'portrait', abilityUpgrades: upgrades('kyle', [['Good Company', 'Keep smiling.', 'Big Grin', 'Turn up the pressure.', 'Last Laugh', 'Make it count.']]), entryVfx: { accent: '#ffe02e' }, portraitAccent: '#ffe02e' },
  stockz: { id: 'stockz', name: 'STOCKZ', kind: 'character', type: 'Electric', cost: 3, power: 3, ability: 'Compound Interest', effect: 'Ongoing: After you play another character in any district, gain +1 Hand. This continues for the rest of the game.', roles: ['Growth', 'Combo'], artworkLayout: 'portrait', abilityUpgrades: upgrades('stockz', [['Seed Money', 'Build your position.', 'Reinvest', 'Let the gains compound.', 'Long Game', 'Stay invested.']]), entryVfx: { accent: '#8aff68' }, portraitAccent: '#8aff68' },
};

/** Complete authored crews without changing their existing draw order. Never use for submitted decks. */
export function completeEngineCrew(ids: readonly string[], candidates: readonly string[] = ['buspass', 'soulfood', 'cognac', 'bustdown', 'energydrink', 'subwaymap']): string[] {
  const result = [...ids];
  for (const id of [...candidates, ...Object.keys(cards)]) {
    if (result.length >= DECK_SIZE) break;
    if (cards[id] && !result.includes(id)) result.push(id);
  }
  return result;
}

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
  { id: "slide", name: "SLIDE THRU", archetype: "Movement", accent: "MOVE", plan: "Spread Hands early, then relocate it late into a moving target.", cards: ["cornball", "bikelife", "vibe", "plug", "snow", "hooper", "baby"], hero: "bikelife-yn" },
  { id: "combo", name: "WHO YOU KNOW", archetype: "Combo / Network", accent: "CHAIN", plan: "Chain cheap plays, discounts, generated cards, and oversized turns.", cards: ["cornball", "plug", "streamer", "gamer", "techbro", "vibe", "wifey"], hero: "techbro-rich" },
  { id: "receipts", name: "RECEIPTS", archetype: "Disruption", accent: "EXPOSE", plan: "Expose the plan, Silence engines, and turn investments into bad ones.", cards: ["cornball", "roaster", "nerd", "snow", "plug", "baby", "hooper"], hero: "all-jokes-roaster" },
  { id: "crashout", name: "CRASHOUT SEASON", archetype: "Comeback", accent: "FLIP", plan: "Absorb early deficits, then flip contested districts with late Hands spikes.", cards: ["cornball", "rastamon", "snow", "wifey", "baby", "hooper", "roaster"], hero: "hooper" },
  { id: "vibes", name: "GOOD VIBES ONLY", archetype: "Sustain", accent: "CLEANSE", plan: "Cleanse, Protect, suppress hostile rules, and keep scaling pieces alive.", cards: ["rastamon", "wifey", "snow", "vibe", "hooper", "oink", "plug"], hero: "rastamon" },
  { id: "compound", name: "COMPOUND INTEREST", archetype: "Growth / Scaling", accent: "GROW", plan: "Invest early in engines and convert repeated buffs into late value.", cards: ["cornball", "plug", "streamer", "rastamon", "gamer", "techbro", "wifey"], hero: "gamer" },
].map(deck => ({ ...deck, cards: completeEngineCrew(deck.cards) }));

export const rarityByEngineId = {
  ...streetWaveRarities,
  ...mythicLegendRarities,
  // City Legends overrides: four utility focused legends sit below the Mythical finishers.
  dragonflyjones: "Legendary",
  tron: "Legendary",
  mansamusa: "Legendary",
  shonuff: "Legendary",
  ashlee: "Mythical",
  captainjigga: "Mythical",
  // johnhenry + yasuke stay Mythical — no override needed (source already says Mythical).
  ...supportRarities,
  guap: "Mythical",
  ...expansionRarities,
  // Street Wave + Expansion overrides — Wave 1 tier inflation cleanup.
  bbldemon: "Legendary",
  redpill: "Legendary",
  sportsprodigy: "Legendary",
  failedathlete: "Rare",
  piratedj: "Epic",
  cornercoach: "Uncommon",
  mural: "Uncommon",
  shiesty: "SuperCommon", torta: "SuperCommon", waterboy: "SuperCommon", buspass: "SuperCommon",
  cognac: "SuperCommon", bustdown: "SuperCommon", soulfood: "SuperCommon", concrete: "SuperCommon",
  bossbabe: "Rare", scammer: "Rare",
  youngbull: "Common", transplant: "Common", tayaty: "Common", edgar: "Common", nguyen: "Common", manman: "Common",
  pinaynurse: "Common", honestthot: "Common", earthy: "Common", abuela: "Common", icecream: "Common",
  cornball: "Common",
  hooper: "Rare",
  plug: "Common",
  snow: "Common",
  wifey: "Common",
  baby: "Uncommon",
  bikelife: "Uncommon",
  gamer: "Epic",
  rastamon: "Uncommon",
  vibe: "Rare",
  nerd: "Rare",
  roaster: "Rare",
  streamer: "Rare",
  oink: "Legendary",
  kyle: "Legendary",
  stockz: "Rare",
  techbro: "Legendary",
  barber: "Uncommon",
  bottle: "Rare",
  sneaker: "Legendary",
  church: "Rare",
  landlord: "Legendary",
  carmeet: "Uncommon",
  promoter: "Epic",
  nail: "Uncommon",
  og: "Mythical",
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
  ...Object.fromEntries(Object.keys(streetWaveCards).map(id => [id, streetWaveRarities[id] === 'Mythical' ? 'City Legends' : ['break', 'krump', 'bboy'].includes(id) ? 'The Cypher' : 'Around the Block'])),
  ...Object.fromEntries(Object.keys(mythicLegendCards).map(id => [id, 'City Legends'])),
  ...Object.fromEntries(Object.keys(supportCards).map(id => [id, 'Everyday Essentials'])),
  guap: "City Legends",
  ...Object.fromEntries(Object.keys(expansionCards).map(id => [id, expansionRarities[id] === 'Mythical' ? 'City Legends' : 'Around the Block'])),
  bossbabe: "Who You Know",
  scammer: "Receipts",
  ...Object.fromEntries(Object.keys(neighborhoodCommons).map(id => [id, "Around the Block"])),
  ...Object.fromEntries(Object.keys(superCommonCards).map(id => [id, "Everyday Essentials"])),
  rastamon: "Good Vibes",
  roaster: "Receipts",
  nerd: "Receipts",
  cornball: "The Block",
  plug: "Who You Know",
  streamer: "Who You Know",
  gamer: "Compound",
  kyle: "Good Vibes",
  stockz: "Compound",
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
  ashlee: "City Legends",
  captainjigga: "City Legends",
};

const sourceByEngineId: Record<string, string[]> = {
  cornball: ["Starter gangs", "Street Packs"],
  snow: ["Starter gangs", "Collection Road"],
  roaster: ["Starter gangs", "Street Packs"],
  rastamon: ["Starter gangs", "Collection Road"],
  wifey: ["Starter gangs", "Street Packs"],
  oink: ["Starter gangs", "Collection Road"],
  baby: ["Starter gangs", "Street Packs"],
  bikelife: ["Starter gangs", "Collection Road"],
  vibe: ["Starter gangs", "Street Packs"],
  plug: ["Starter gangs", "Collection Road"],
  hooper: ["Starter gangs", "Street Packs"],
  streamer: ["Starter gangs", "Collection Road"],
  gamer: ["Starter gangs", "Street Packs"],
  techbro: ["Starter gangs", "Collection Road"],
  nerd: ["Starter gangs", "Chapter One boss"],
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
        description: "Raised gold ink, vermilion tags and a lacquered frame over the original foil.",
        shardCost: 80,
      },
      {
        id: `${card.id}:chrome`,
        name: "Chrome",
        description: "Reflective showcase frame for your favorite gang.",
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

// Versioned onboarding entitlement, not a playable recipe or faction restriction.
export const ROOKIE_FOUNDATION_ID = "foundation-v1";
export const ROOKIE_DECK_ID = "my-first-crew";
export const ROOKIE_CORE_IDS = ["cornball", "plug", "snow-bunny", "wifey", "hooper", "rastamon", "all-jokes-roaster", "bus-pass", "soul-food", "cognac-bottle"];
export const ROOKIE_FOUNDATION_IDS = [...ROOKIE_CORE_IDS, ...["barber", "bottle", "sneaker", "church", "landlord", "carmeet", "promoter", "nail", "og", "delivery"].map(id => catalogCardByEngineId[id].catalogId)];

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

/** Expand a previously legal seven-card save using only cards already owned. */
export function upgradeLegacySavedDeck(cardIds: readonly string[], ownedCardIds: readonly string[]): string[] {
  const result = [...cardIds];
  if (result.length !== 7 || new Set(result).size !== 7 || result.some(id => !catalogCardById[id] || !ownedCardIds.includes(id))) return result;
  const candidates = [...new Set(ownedCardIds)].filter(id => catalogCardById[id] && !result.includes(id))
    .sort((a, b) => Number(catalogCardById[b].kind === 'support') - Number(catalogCardById[a].kind === 'support') || catalogCardById[a].cost - catalogCardById[b].cost || a.localeCompare(b));
  return [...result, ...candidates.slice(0, DECK_SIZE - result.length)];
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
  if (cardIds.length !== DECK_SIZE) {
    issues.push(
      cardIds.length < DECK_SIZE
        ? `Add ${DECK_SIZE - cardIds.length} more card${DECK_SIZE - cardIds.length === 1 ? "" : "s"}.`
        : `Remove ${cardIds.length - DECK_SIZE} card${cardIds.length - DECK_SIZE === 1 ? "" : "s"}.`,
    );
  }
  if (new Set(cardIds).size !== cardIds.length) {
    issues.push("A deck can only use one gameplay copy of each card.");
  }
  if (unknownCardIds.length) {
    issues.push("Some saved cards are temporarily unavailable. Your lineup is preserved.");
  }
  if (missingCardIds.length) {
    issues.push(
      `Unlock ${missingCardIds.length} missing card${missingCardIds.length === 1 ? "" : "s"}.`,
    );
  }
  if (!heroCardId) {
    issues.push("Choose a gang hero.");
  } else if (!cardIds.includes(heroCardId)) {
    issues.push("Your gang hero must be one of the ten cards.");
  }
  return {
    valid: issues.length === 0,
    issues,
    missingCardIds,
    unknownCardIds,
  };
}

export const districts = [
  { name: "THE TOWN", rule: "Fire + Dark cards gain +2 Hands.", strategy: "A raw-Hands lane. Contest it with Fire or Dark, or bluff it to pull the rival away." },
  { name: "GROUP CHAT", rule: "Disruption cards gain +2 Hands.", strategy: "Interaction pays here. Commit when your ability has a real target; abandon it when the rival is baiting disruption." },
  { name: "SERVER ROOM", rule: "Electric cards gain +3 Hands.", strategy: "The biggest district bonus. Electric threats demand an answer, but stacking here can concede the other two lanes." },
];
