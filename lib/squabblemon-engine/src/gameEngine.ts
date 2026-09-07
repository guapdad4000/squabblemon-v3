import {
  cards,
  catalogIdsToEngineIds,
  decks,
  type Card,
  type Deck,
} from "./data";

export type Owner = "player" | "cpu";
export type Phase = "player" | "cpu-reveal" | "resolved" | "complete";
export type Lane = 0 | 1 | 2;
export type StoryTrigger =
  | { readonly kind: "round"; readonly atLeast: number }
  | { readonly kind: "total-power"; readonly owner: Owner; readonly atLeast: number }
  | { readonly kind: "districts-held"; readonly owner: Owner; readonly atLeast: number };
export type StoryEffect =
  | { readonly kind: "hype"; readonly owner: Owner; readonly amount: number }
  | { readonly kind: "reinforcement"; readonly owner: Owner; readonly cardId: string }
  | { readonly kind: "lane-power"; readonly owner: Owner | "both"; readonly lane: Lane; readonly amount: number }
  | { readonly kind: "lane-lock"; readonly owner: Owner | "both"; readonly lanes: readonly Lane[] };
export type StoryEncounterSnapshot = {
  readonly id: string;
  readonly enemy: {
    readonly id: string;
    readonly name: string;
    readonly portraitAssetId: string;
    readonly deckId: string;
    readonly cardIds: readonly string[];
    readonly behaviorProfile: string;
  };
  readonly battlefieldAssetId: string;
  readonly soundHooks: Readonly<Record<string, string>>;
  readonly modifiers?: {
    readonly startingHype?: Partial<Readonly<Record<Owner, number>>>;
    readonly handSize?: Partial<Readonly<Record<Owner, number>>>;
    readonly laneLocks?: readonly { readonly round: number; readonly owner: Owner | "both"; readonly lanes: readonly Lane[] }[];
    readonly roundHypeDeltas?: readonly { readonly round: number; readonly owner: Owner; readonly amount: number }[];
    readonly lanePowerBonuses?: readonly { readonly owner: Owner | "both"; readonly lane: Lane; readonly amount: number }[];
    readonly reinforcements?: readonly { readonly round: number; readonly owner: Owner; readonly cardId: string }[];
  };
  readonly phases?: readonly {
    readonly id: string;
    readonly name: string;
    readonly trigger: StoryTrigger;
    readonly onEnter?: readonly StoryEffect[];
  }[];
};
export type StoryRuntime = {
  activePhaseIndex: number;
  appliedEffectIds: string[];
  lanePowerBonuses: { owner: Owner | "both"; lane: Lane; amount: number }[];
  laneLocks: { owner: Owner | "both"; lanes: Lane[] }[];
};
export type Statuses = { frozen: boolean; silenced: boolean; protected: boolean; blocked: boolean };
export type CardInstance = Card & {
  instanceId: string; cardId: string; owner: Owner; lane: Lane | null; playedRound: number | null;
  basePower: number; powerModifier: number; moved: boolean; statuses: Statuses; lastEffectNote: string;
};
export type EffectLogEntry = { cardInstanceId: string; cardId: string; owner: Owner; lane: Lane; kind: "ability" | "fire" | "water" | "move" | "blocked" | "story"; note: string };
export type Match = {
  round: number; phase: Phase; playerDeck: string; cpuDeck: string; playerHand: CardInstance[]; cpuHand: CardInstance[];
  playerCardIds: string[]; cpuCardIds: string[];
  boards: [CardInstance[], CardInstance[], CardInstance[]]; playerHype: number; cpuHype: number;
  playerDrawIndex: number; cpuDrawIndex: number; squabbleUsed: boolean; plugDiscountLane: Record<Owner, Lane | null>;
  cheapBuffsUsed: Record<Owner, number>; effectLog: EffectLogEntry[];
  storyEncounter?: StoryEncounterSnapshot; storyRuntime?: StoryRuntime;
};

const lane = (n: number): Lane => n as Lane;
const emptyStatuses = (): Statuses => ({ frozen: false, silenced: false, protected: false, blocked: false });
export const createCardInstance = (cardId: string, owner: Owner, deck = "custom", index = 0): CardInstance => {
  const card = cards[cardId];
  if (!card) throw new Error(`Unknown card ${cardId}`);
  return { ...card, cardId, instanceId: `${owner}:${deck}:${index}:${cardId}`, owner, deck, lane: null, playedRound: null, basePower: card.power, powerModifier: 0, moved: false, statuses: emptyStatuses(), lastEffectNote: "Ready in hand." };
};
const deckById = (id: string): Deck => {
  const deck = decks.find((item) => item.id === id);
  if (!deck) throw new Error(`Unknown deck ${id}`);
  return deck;
};

export function createMatch(playerDeck: string, cpuDeck: string): Match {
  const p = deckById(playerDeck), c = deckById(cpuDeck);
  return createMatchFromEngineCards(p.id, p.cards, c.id, c.cards);
}

export function createMatchFromEngineCards(
  playerDeck: string,
  playerCardIds: string[],
  cpuDeck: string,
  cpuCardIds: string[],
  storyEncounter?: StoryEncounterSnapshot,
): Match {
  if (playerCardIds.length !== 7 || new Set(playerCardIds).size !== 7) {
    throw new Error("Player deck must contain seven unique cards");
  }
  for (const cardId of [...playerCardIds, ...cpuCardIds]) {
    if (!cards[cardId]) throw new Error(`Unknown card ${cardId}`);
  }
  const playerHandSize = storyEncounter?.modifiers?.handSize?.player ?? 5;
  const cpuHandSize = storyEncounter?.modifiers?.handSize?.cpu ?? 5;
  let match: Match = {
    round: 1, phase: "player", playerDeck, cpuDeck,
    playerHand: playerCardIds.slice(0, playerHandSize).map((id, i) => createCardInstance(id, "player", playerDeck, i)),
    cpuHand: cpuCardIds.slice(0, cpuHandSize).map((id, i) => createCardInstance(id, "cpu", cpuDeck, i)),
    playerCardIds: [...playerCardIds], cpuCardIds: [...cpuCardIds],
    boards: [[], [], []],
    playerHype: storyEncounter?.modifiers?.startingHype?.player ?? 1,
    cpuHype: storyEncounter?.modifiers?.startingHype?.cpu ?? 1,
    playerDrawIndex: playerHandSize, cpuDrawIndex: cpuHandSize,
    squabbleUsed: false, plugDiscountLane: { player: null, cpu: null }, cheapBuffsUsed: { player: 0, cpu: 0 }, effectLog: [],
    ...(storyEncounter ? {
      storyEncounter,
      storyRuntime: { activePhaseIndex: -1, appliedEffectIds: [], lanePowerBonuses: [], laneLocks: [] },
    } : {}),
  };
  match = applyStoryEffects(match);
  return match;
}

export function createMatchFromCatalog(
  playerDeck: string,
  playerCatalogCardIds: string[],
  cpuDeck: string,
): Match {
  const cpu = deckById(cpuDeck);
  return createMatchFromEngineCards(
    playerDeck,
    catalogIdsToEngineIds(playerCatalogCardIds),
    cpu.id,
    cpu.cards,
  );
}

export function getEffectiveCardPower(card: CardInstance): number {
  return card.statuses.frozen ? 0 : Math.max(0, card.basePower + card.powerModifier);
}
export const effectiveCardPower = getEffectiveCardPower;
export function getLaneScore(cardsInLane: CardInstance[], laneIndex: number): number {
  return cardsInLane.reduce((total, card) => {
    const district = laneIndex === 0 && (card.type === "Fire" || card.type === "Dark") ? 2
      : laneIndex === 1 && card.roles?.includes("Disruption") ? 2
      : laneIndex === 2 && card.type === "Electric" ? 3 : 0;
    return total + getEffectiveCardPower(card) + district;
  }, 0);
}
export function getStoryLaneBonus(match: Match, owner: Owner, laneIndex: Lane): number {
  const base = match.storyEncounter?.modifiers?.lanePowerBonuses ?? [];
  const entered = match.storyRuntime?.lanePowerBonuses ?? [];
  return [...base, ...entered]
    .filter((bonus) => bonus.lane === laneIndex && (bonus.owner === owner || bonus.owner === "both"))
    .reduce((total, bonus) => total + bonus.amount, 0);
}
export function getLaneScoreForMatch(match: Match, cardsInLane: CardInstance[], laneIndex: Lane, owner?: Owner): number {
  const resolvedOwner = owner ?? cardsInLane[0]?.owner;
  return getLaneScore(cardsInLane, laneIndex) + (resolvedOwner ? getStoryLaneBonus(match, resolvedOwner, laneIndex) : 0);
}
export function getDistrictResults(match: Match) {
  return match.boards.map((cardsInLane, i) => {
    const player = getLaneScoreForMatch(match, cardsInLane.filter((c) => c.owner === "player"), i as Lane, "player");
    const cpu = getLaneScoreForMatch(match, cardsInLane.filter((c) => c.owner === "cpu"), i as Lane, "cpu");
    return { lane: i as Lane, player, cpu, winner: player === cpu ? "draw" as const : player > cpu ? "player" as const : "cpu" as const };
  });
}
export function getMatchWinner(match: Match): Owner | "draw" | null {
  const results = getDistrictResults(match), player = results.filter((r) => r.winner === "player").length, cpu = results.filter((r) => r.winner === "cpu").length;
  if (player >= 2) return "player";
  if (cpu >= 2) return "cpu";
  return match.round >= 6 && match.phase === "complete" ? "draw" : null;
}
export function getLegalCardCost(match: Match, owner: Owner, card: CardInstance, targetLane: Lane): number {
  const discount = match.plugDiscountLane[owner] !== null && match.plugDiscountLane[owner] !== targetLane;
  return Math.max(0, card.cost - (discount ? 1 : 0));
}
export const getDiscountedCardCost = getLegalCardCost;
export function canAffordSelection(match: Match, owner: Owner, instanceId: string, targetLane: Lane): boolean {
  const card = (owner === "player" ? match.playerHand : match.cpuHand).find((c) => c.instanceId === instanceId);
  return !!card && !getStoryLockedLanes(match, owner).includes(targetLane) && getLegalCardCost(match, owner, card, targetLane) <= (owner === "player" ? match.playerHype : match.cpuHype);
}

const modify = (m: Match, id: string, change: (c: CardInstance) => CardInstance): Match => ({ ...m, boards: m.boards.map((cardsInLane) => cardsInLane.map((c) => c.instanceId === id ? change(c) : c)) as Match["boards"] });
const addLog = (m: Match, card: CardInstance, text: string, kind: EffectLogEntry["kind"] = "ability"): Match => ({ ...m, effectLog: [...m.effectLog, { cardInstanceId: card.instanceId, cardId: card.cardId, owner: card.owner, lane: card.lane!, kind, note: text }] });
const inLane = (m: Match, owner: Owner, target: Lane) => m.boards[target].filter((c) => c.owner === owner);
const highest = (items: CardInstance[]) => [...items].sort((a, b) => getEffectiveCardPower(b) - getEffectiveCardPower(a) || a.instanceId.localeCompare(b.instanceId))[0];
const lowest = (items: CardInstance[]) => [...items].sort((a, b) => getEffectiveCardPower(a) - getEffectiveCardPower(b) || a.instanceId.localeCompare(b.instanceId))[0];
const move = (m: Match, card: CardInstance, destination: Lane, note: string): Match => {
  if (card.lane === destination) return m;
  const updated = { ...card, lane: destination, moved: true, lastEffectNote: note };
  return { ...m, boards: m.boards.map((items, i) => i === card.lane ? items.filter((c) => c.instanceId !== card.instanceId) : i === destination ? [...items, updated] : items) as Match["boards"] };
};
const lowestFriendlyLane = (m: Match, owner: Owner, except: Lane): Lane => ([0, 1, 2] as Lane[]).filter((x) => x !== except).sort((a, b) => getLaneScore(inLane(m, owner, a), a) - getLaneScore(inLane(m, owner, b), b) || a - b)[0];
const targetEnemy = (m: Match, source: CardInstance, target: CardInstance, apply: (c: CardInstance) => CardInstance): Match => {
  const guard = inLane(m, target.owner, target.lane!).find((c) => c.cardId === "wifey" && !c.statuses.silenced && !c.statuses.blocked);
  if (guard) return addLog(modify(m, guard.instanceId, (c) => ({ ...c, statuses: { ...c.statuses, blocked: true }, lastEffectNote: "Side Eye blocked a targeted effect." })), source, "Wifey blocked the targeted effect.", "blocked");
  return modify(m, target.instanceId, apply);
};

const storyLog = (match: Match, id: string, owner: Owner, note: string): Match => ({
  ...match,
  effectLog: [...match.effectLog, { cardInstanceId: `story:${id}`, cardId: "story", owner, lane: 0, kind: "story", note }],
});
const storyTriggerMet = (match: Match, trigger: StoryTrigger): boolean => {
  if (trigger.kind === "round") return match.round >= trigger.atLeast;
  if (trigger.kind === "total-power") {
    const total = ([0, 1, 2] as Lane[]).reduce((sum, targetLane) => sum + getLaneScoreForMatch(
      match,
      inLane(match, trigger.owner, targetLane),
      targetLane,
      trigger.owner,
    ), 0);
    return total >= trigger.atLeast;
  }
  return getDistrictResults(match).filter((result) => result.winner === trigger.owner).length >= trigger.atLeast;
};
const applyStoryEffect = (match: Match, effect: StoryEffect, effectId: string): Match => {
  if (!match.storyRuntime || match.storyRuntime.appliedEffectIds.includes(effectId)) return match;
  let m: Match = {
    ...match,
    storyRuntime: {
      ...match.storyRuntime,
      appliedEffectIds: [...match.storyRuntime.appliedEffectIds, effectId],
    },
  };
  if (effect.kind === "hype") {
    const key = effect.owner === "player" ? "playerHype" : "cpuHype";
    m = { ...m, [key]: Math.max(0, m[key] + effect.amount) };
  } else if (effect.kind === "reinforcement") {
    const key = effect.owner === "player" ? "playerHand" : "cpuHand";
    const card = createCardInstance(effect.cardId, effect.owner, `story:${m.storyEncounter!.id}:${effectId}`, 0);
    m = { ...m, [key]: [...m[key], card] };
  } else if (effect.kind === "lane-power") {
    m = { ...m, storyRuntime: { ...m.storyRuntime!, lanePowerBonuses: [...m.storyRuntime!.lanePowerBonuses, { ...effect }] } };
  } else {
    m = { ...m, storyRuntime: { ...m.storyRuntime!, laneLocks: [...m.storyRuntime!.laneLocks, { owner: effect.owner, lanes: [...effect.lanes] }] } };
  }
  return storyLog(m, effectId, effect.kind === "hype" || effect.kind === "reinforcement" ? effect.owner : "cpu", `Story effect ${effectId}: ${effect.kind}.`);
};
function applyStoryEffects(match: Match): Match {
  if (!match.storyEncounter || !match.storyRuntime) return match;
  let m = match;
  const snapshot = match.storyEncounter;
  for (const [index, item] of (snapshot.modifiers?.roundHypeDeltas ?? []).entries()) {
    if (item.round === m.round) m = applyStoryEffect(m, { kind: "hype", owner: item.owner, amount: item.amount }, `round-hype:${index}:${item.round}`);
  }
  for (const [index, item] of (snapshot.modifiers?.reinforcements ?? []).entries()) {
    if (item.round === m.round) m = applyStoryEffect(m, { kind: "reinforcement", owner: item.owner, cardId: item.cardId }, `reinforcement:${index}:${item.round}`);
  }
  const phases = snapshot.phases ?? [];
  let next = match.storyRuntime.activePhaseIndex + 1;
  while (next < phases.length && storyTriggerMet(m, phases[next].trigger)) {
    const phase = phases[next];
    m = {
      ...m,
      storyRuntime: { ...m.storyRuntime!, activePhaseIndex: next },
    };
    m = storyLog(m, `phase:${phase.id}`, "cpu", `Story phase entered: ${phase.name}.`);
    for (const [effectIndex, effect] of (phase.onEnter ?? []).entries()) {
      m = applyStoryEffect(m, effect, `phase:${phase.id}:${effectIndex}`);
    }
    next += 1;
  }
  return m;
}

export function getActiveStoryPhase(match: Match): NonNullable<StoryEncounterSnapshot["phases"]>[number] | null {
  const index = match.storyRuntime?.activePhaseIndex ?? -1;
  return index >= 0 ? match.storyEncounter?.phases?.[index] ?? null : null;
}
export function getStoryLockedLanes(match: Match, owner: Owner = "player"): Lane[] {
  const scheduled = (match.storyEncounter?.modifiers?.laneLocks ?? [])
    .filter((lock) => lock.round === match.round && (lock.owner === owner || lock.owner === "both"))
    .flatMap((lock) => lock.lanes);
  const entered = (match.storyRuntime?.laneLocks ?? [])
    .filter((lock) => lock.owner === owner || lock.owner === "both")
    .flatMap((lock) => lock.lanes);
  return [...new Set([...scheduled, ...entered])].sort() as Lane[];
}
export function getStoryModifierSummaries(value: Match | StoryEncounterSnapshot): string[] {
  const snapshot = "round" in value ? value.storyEncounter : value;
  if (!snapshot) return [];
  const modifiers = snapshot.modifiers;
  const summaries: string[] = [];
  if (modifiers?.startingHype) summaries.push(`Starting Hype: player ${modifiers.startingHype.player ?? 1}, CPU ${modifiers.startingHype.cpu ?? 1}`);
  if (modifiers?.handSize) summaries.push(`Opening hand: player ${modifiers.handSize.player ?? 5}, CPU ${modifiers.handSize.cpu ?? 5}`);
  for (const lock of modifiers?.laneLocks ?? []) summaries.push(`Round ${lock.round}: ${lock.owner} cannot play lane${lock.lanes.length === 1 ? "" : "s"} ${lock.lanes.join(", ")}`);
  for (const delta of modifiers?.roundHypeDeltas ?? []) summaries.push(`Round ${delta.round}: ${delta.owner} Hype ${delta.amount >= 0 ? "+" : ""}${delta.amount}`);
  for (const bonus of modifiers?.lanePowerBonuses ?? []) summaries.push(`${bonus.owner} lane ${bonus.lane} Power ${bonus.amount >= 0 ? "+" : ""}${bonus.amount}`);
  for (const reinforcement of modifiers?.reinforcements ?? []) summaries.push(`Round ${reinforcement.round}: ${reinforcement.owner} reinforces with ${reinforcement.cardId}`);
  for (const phase of snapshot.phases ?? []) summaries.push(`Phase ${phase.name}: ${phase.trigger.kind}`);
  return summaries;
}

function resolveAbility(match: Match, source: CardInstance): Match {
  if (source.statuses.silenced || source.statuses.frozen) return addLog(match, source, "Ability did not fire (silenced or frozen).");
  const l = source.lane!, enemy = source.owner === "player" ? "cpu" : "player", kind = source.type === "Fire" ? "fire" : source.type === "Water" ? "water" : "ability";
  let m = match;
  const note = (text: string) => { m = addLog(m, source, text, kind); };
  if (source.cardId === "rastamon") { const t = lowest(inLane(m, source.owner, l).filter((c) => c.instanceId !== source.instanceId && (c.statuses.frozen || c.statuses.silenced))); if (t) { m = modify(m, t.instanceId, (c) => ({ ...c, statuses: { ...c.statuses, frozen: false, silenced: false }, powerModifier: c.powerModifier + 2, lastEffectNote: "Natural Cure: cleansed, +2 Power." })); note("Natural Cure cleansed an ally and gave it +2."); } else note("Natural Cure found no status to cleanse."); }
  else if (source.cardId === "roaster") { const t = highest(inLane(m, enemy, l)); if (t) { const amount = t.playedRound === m.round ? -3 : -2; m = targetEnemy(m, source, t, (c) => ({ ...c, powerModifier: c.powerModifier + amount, lastEffectNote: `Ratio'd Receipts: ${amount} Power.` })); note(`Ratio'd Receipts targeted ${t.name}.`); } else note("Ratio'd Receipts found no enemy."); }
  else if (source.cardId === "nerd") { const t = highest(inLane(m, enemy, l)); if (t) { m = targetEnemy(m, source, t, (c) => ({ ...c, statuses: { ...c.statuses, silenced: true }, lastEffectNote: "Unaware: silenced." })); note("Unaware targeted the highest enemy."); } else note("Unaware found no enemy."); }
  else if (source.cardId === "cornball") { const t = inLane(m, enemy, l).length >= 3 ? lowest(inLane(m, enemy, l)) : undefined; if (t) { const guarded = inLane(m, enemy, l).some((c) => c.cardId === "wifey" && !c.statuses.silenced && !c.statuses.blocked); m = targetEnemy(m, source, t, (c) => c); if (!guarded) m = move(m, t, lane((l + 1) % 3), "Scare the Hoes moved this card."); note("Scare the Hoes moved the lowest enemy."); } else note("Scare the Hoes needs three enemies."); }
  else if (source.cardId === "plug") { m = { ...m, plugDiscountLane: { ...m.plugDiscountLane, [source.owner]: l } }; note("Connections: next card in another district costs 1 less."); }
  else if (source.cardId === "streamer") note("Follower Frenzy is live for the next two cheap plays.");
  else if (source.cardId === "gamer") note("Tryhard Trigger watches cheap plays here.");
  else if (source.cardId === "techbro") { const hype = source.owner === "player" ? m.playerHype : m.cpuHype; if (hype) { m = modify(m, source.instanceId, (c) => ({ ...c, powerModifier: c.powerModifier + 2, lastEffectNote: "VC Funded Flex: +2 Power." })); m = { ...m, ...(source.owner === "player" ? { playerHype: hype - 1 } : { cpuHype: hype - 1 }) }; note("VC Funded Flex spent 1 Hype for +2."); } else note("VC Funded Flex had no Hype left."); }
  else if (source.cardId === "bikelife") { const to = lowestFriendlyLane(m, source.owner, l); m = move(m, source, to, "Ride Out moved here, +1 Power."); m = modify(m, source.instanceId, (c) => ({ ...c, powerModifier: c.powerModifier + 1, lastEffectNote: "Ride Out moved here, +1 Power." })); note("Ride Out moved Bikelife and gave +1."); }
  else if (source.cardId === "vibe") { const t = lowest(m.boards.flat().filter((c) => c.owner === source.owner && c.instanceId !== source.instanceId && c.lane !== l)); if (t) { m = move(m, t, l, "Wave Check pulled this card here, +1 Power."); m = modify(m, t.instanceId, (c) => ({ ...c, powerModifier: c.powerModifier + 1, lastEffectNote: "Wave Check pulled this card here, +1 Power." })); m = modify(m, source.instanceId, (c) => ({ ...c, powerModifier: c.powerModifier + 1, lastEffectNote: "Wave Check: +1 Power." })); note("Wave Check pulled the lowest ally here; both gained +1."); } else note("Wave Check needs an ally in another district."); }
  else if (source.cardId === "hooper") { if (getLaneScore(inLane(m, source.owner, l), l) < getLaneScore(inLane(m, enemy, l), l)) { const t = highest(inLane(m, enemy, l)); if (t) m = targetEnemy(m, source, t, (c) => ({ ...c, powerModifier: c.powerModifier - 2, lastEffectNote: "Ankle Breaker: -2 Power." })); m = modify(m, source.instanceId, (c) => ({ ...c, powerModifier: c.powerModifier + 2, lastEffectNote: "Ankle Breaker: +2 Power." })); note("Ankle Breaker flipped the pressure."); } else note("Ankle Breaker only triggers while losing."); }
  else if (source.cardId === "baby") { if (inLane(m, enemy, l).length > inLane(m, source.owner, l).length) { m = modify(m, source.instanceId, (c) => ({ ...c, powerModifier: c.powerModifier + 2, lastEffectNote: "Mama Bear: +2 Power." })); note("Mama Bear gained +2."); } else note("Mama Bear found no crowd disadvantage."); }
  else if (source.cardId === "oink") { for (const t of inLane(m, enemy, l)) m = targetEnemy(m, source, t, (c) => ({ ...c, powerModifier: c.powerModifier - 1, lastEffectNote: "Civic Pressure: -1 Power." })); note("Civic Pressure applied lane pressure."); }
  else if (source.cardId === "snow") { const t = highest(inLane(m, enemy, l)); if (t) { m = targetEnemy(m, source, t, (c) => ({ ...c, statuses: { ...c.statuses, frozen: true }, lastEffectNote: "Cold Shoulder: frozen." })); note("Cold Shoulder froze the highest enemy."); } else note("Cold Shoulder found no enemy."); }
  else if (source.cardId === "wifey") { m = modify(m, source.instanceId, (c) => ({ ...c, statuses: { ...c.statuses, protected: true }, lastEffectNote: "Side Eye is protecting this lane." })); note("Side Eye will block one targeted effect this round."); }
  return m;
}

export function playCard(match: Match, owner: Owner, instanceId: string, targetLane: Lane, squabble = false): Match {
  if ((owner === "player" && match.phase !== "player") || (owner === "cpu" && match.phase !== "cpu-reveal")) throw new Error("Owner cannot play in this phase");
  if (getStoryLockedLanes(match, owner).includes(targetLane)) throw new Error("Lane is locked");
  const handKey = owner === "player" ? "playerHand" : "cpuHand", hypeKey = owner === "player" ? "playerHype" : "cpuHype", card = match[handKey].find((c) => c.instanceId === instanceId);
  if (!card) throw new Error("Card is not in this hand");
  if (squabble && (owner !== "player" || match.squabbleUsed)) throw new Error("SQUABBLE is unavailable");
  const cost = getLegalCardCost(match, owner, card, targetLane);
  if (match[hypeKey] < cost) throw new Error("Not enough Hype");
  const discountLane = match.plugDiscountLane[owner];
  const usedPlugDiscount = discountLane !== null && discountLane !== targetLane;
  let m: Match = {
    ...match,
    [handKey]: match[handKey].filter((c) => c.instanceId !== instanceId),
    [hypeKey]: match[hypeKey] - cost,
    plugDiscountLane: { ...match.plugDiscountLane, [owner]: usedPlugDiscount ? null : discountLane },
    squabbleUsed: match.squabbleUsed || squabble,
  };
  let placed: CardInstance = { ...card, lane: targetLane, playedRound: m.round, powerModifier: card.powerModifier + (squabble ? card.basePower : 0), lastEffectNote: squabble ? "SQUABBLE doubled base Power." : `Played for ${cost} Hype.` };
  m = { ...m, boards: m.boards.map((items, i) => i === targetLane ? [...items, placed] : items) as Match["boards"] };
  if (cost <= 2) for (const streamer of m.boards.flat().filter((c) => c.owner === owner && c.cardId === "streamer" && !c.statuses.silenced && !c.statuses.frozen)) if (m.cheapBuffsUsed[owner] < 2) { m = modify(m, placed.instanceId, (c) => ({ ...c, powerModifier: c.powerModifier + 1, lastEffectNote: "Follower Frenzy: +1 Power." })); m = { ...m, cheapBuffsUsed: { ...m.cheapBuffsUsed, [owner]: m.cheapBuffsUsed[owner] + 1 } }; }
  if (cost <= 2) for (const gamer of inLane(m, owner, targetLane).filter((c) => c.cardId === "gamer" && c.instanceId !== placed.instanceId && !c.statuses.silenced && !c.statuses.frozen)) { m = modify(m, gamer.instanceId, (c) => ({ ...c, powerModifier: c.powerModifier + 1 })); m = modify(m, placed.instanceId, (c) => ({ ...c, powerModifier: c.powerModifier + 1, lastEffectNote: "Tryhard Trigger: +1 Power." })); }
  placed = m.boards.flat().find((c) => c.instanceId === instanceId)!;
  m = resolveAbility(m, placed);
  return applyStoryEffects({ ...m, phase: owner === "player" ? "cpu-reveal" : "resolved" });
}
export function pass(match: Match, owner: Owner): Match {
  if ((owner === "player" && match.phase !== "player") || (owner === "cpu" && match.phase !== "cpu-reveal")) throw new Error("Owner cannot pass in this phase");
  return { ...match, phase: owner === "player" ? "cpu-reveal" : "resolved", effectLog: [...match.effectLog, { cardInstanceId: "pass", cardId: "pass", owner, lane: 0, kind: "ability", note: `${owner} passed.` }] };
}
export function chooseCpuPlay(match: Match): { instanceId: string; lane: Lane } | null {
  if (match.phase !== "cpu-reveal") return null;
  const options = match.cpuHand.flatMap((card) => ([0, 1, 2] as Lane[]).filter((l) => canAffordSelection(match, "cpu", card.instanceId, l)).map((l) => ({ card, lane: l, cost: getLegalCardCost(match, "cpu", card, l) })));
  if (!options.length) return null;
  const ranked = options.sort((a, b) => {
    const av = getLaneScoreForMatch(match, inLane(match, "cpu", a.lane), a.lane, "cpu") + a.card.basePower - getLaneScoreForMatch(match, inLane(match, "player", a.lane), a.lane, "player");
    const bv = getLaneScoreForMatch(match, inLane(match, "cpu", b.lane), b.lane, "cpu") + b.card.basePower - getLaneScoreForMatch(match, inLane(match, "player", b.lane), b.lane, "player");
    return bv - av || a.cost - b.cost || a.card.instanceId.localeCompare(b.card.instanceId) || a.lane - b.lane;
  });
  return { instanceId: ranked[0].card.instanceId, lane: ranked[0].lane };
}
export function revealCpu(match: Match): Match {
  const choice = chooseCpuPlay(match);
  return choice ? playCard(match, "cpu", choice.instanceId, choice.lane) : pass(match, "cpu");
}
export function nextRound(match: Match): Match {
  if (match.phase !== "resolved") throw new Error("Round is not resolved");
  if (match.round >= 6) return applyStoryEffects({ ...match, phase: "complete" });
  const draw = (owner: Owner, deckId: string, deckCards: string[], index: number) => index < deckCards.length ? createCardInstance(deckCards[index], owner, deckId, index) : null;
  const p = draw("player", match.playerDeck, match.playerCardIds, match.playerDrawIndex), c = draw("cpu", match.cpuDeck, match.cpuCardIds, match.cpuDrawIndex);
  const reset = (card: CardInstance) => ({ ...card, statuses: { ...card.statuses, blocked: false } });
  return applyStoryEffects({ ...match, round: match.round + 1, phase: "player", playerHype: match.round + 1, cpuHype: match.round + 1, playerHand: p ? [...match.playerHand, p] : match.playerHand, cpuHand: c ? [...match.cpuHand, c] : match.cpuHand, playerDrawIndex: match.playerDrawIndex + (p ? 1 : 0), cpuDrawIndex: match.cpuDrawIndex + (c ? 1 : 0), boards: match.boards.map((items) => items.map(reset)) as Match["boards"], effectLog: match.effectLog.filter((entry) => entry.kind === "story") });
}

export type PlayerMove = {
  cardInstanceId: string | null;
  lane: Lane | null;
  squabble: boolean;
};

export function verifyMatchTranscript(
  playerDeck: string,
  cpuDeck: string,
  moves: Array<{
    cardInstanceId: string | null;
    lane: number | null;
    squabble: boolean;
  }>,
): Match {
  if (moves.length !== 6) throw new Error("A match transcript needs six moves");
  let match = createMatch(playerDeck, cpuDeck);
  for (const move of moves) {
    if (move.cardInstanceId === null) {
      if (move.lane !== null || move.squabble) throw new Error("Invalid pass");
      match = pass(match, "player");
    } else {
      if (move.lane === null || ![0, 1, 2].includes(move.lane)) {
        throw new Error("Played cards need a valid lane");
      }
      match = playCard(match, "player", move.cardInstanceId, move.lane as Lane, move.squabble);
    }
    match = revealCpu(match);
    match = nextRound(match);
  }
  if (match.phase !== "complete") {
    throw new Error("Transcript did not complete six rounds");
  }
  return match;
}

export function createStoryMatch(
  snapshot: StoryEncounterSnapshot,
  playerDeck: string | readonly string[],
  playerCardsOrId: readonly string[] | string = "story-player",
): Match {
  if (snapshot.enemy.cardIds.length !== 7 || new Set(snapshot.enemy.cardIds).size !== 7) {
    throw new Error("Story enemy deck must contain seven unique cards");
  }
  const player = typeof playerDeck === "string"
    ? Array.isArray(playerCardsOrId)
      ? { id: playerDeck, cards: [...playerCardsOrId] }
      : deckById(playerDeck)
    : { id: typeof playerCardsOrId === "string" ? playerCardsOrId : "story-player", cards: [...playerDeck] };
  return createMatchFromEngineCards(
    player.id,
    [...player.cards],
    snapshot.enemy.deckId,
    [...snapshot.enemy.cardIds],
    snapshot,
  );
}

export function verifyStoryMatchTranscript(
  snapshot: StoryEncounterSnapshot,
  playerDeck: string | readonly string[],
  playerCardsOrMoves: readonly string[] | Array<{ cardInstanceId: string | null; lane: number | null; squabble: boolean }>,
  movesOrDeckId?: Array<{ cardInstanceId: string | null; lane: number | null; squabble: boolean }> | string,
): Match {
  const suppliedCards = playerCardsOrMoves.length > 0 && typeof playerCardsOrMoves[0] === "string";
  const moves = (suppliedCards ? movesOrDeckId : playerCardsOrMoves) as Array<{ cardInstanceId: string | null; lane: number | null; squabble: boolean }>;
  if (!Array.isArray(moves)) throw new Error("Story match transcript moves are required");
  if (moves.length !== 6) throw new Error("A story match transcript needs six moves");
  const matchCardsOrId = suppliedCards
    ? playerCardsOrMoves as readonly string[]
    : typeof movesOrDeckId === "string" ? movesOrDeckId : "story-player";
  let match = createStoryMatch(snapshot, playerDeck, matchCardsOrId);
  for (const move of moves) {
    if (move.cardInstanceId === null) {
      if (move.lane !== null || move.squabble) throw new Error("Invalid pass");
      match = pass(match, "player");
    } else {
      if (move.lane === null || ![0, 1, 2].includes(move.lane)) throw new Error("Played cards need a valid lane");
      match = playCard(match, "player", move.cardInstanceId, move.lane as Lane, move.squabble);
    }
    match = revealCpu(match);
    match = nextRound(match);
  }
  if (match.phase !== "complete") throw new Error("Transcript did not complete six rounds");
  return match;
}
