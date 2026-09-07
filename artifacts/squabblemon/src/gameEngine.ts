import { cards, decks, type Card, type Deck } from './data';

export type Owner = 'player' | 'cpu';
export type Phase = 'player' | 'cpu-reveal' | 'resolved' | 'complete';
export type Lane = 0 | 1 | 2;
export type Statuses = { frozen: boolean; silenced: boolean; protected: boolean; blocked: boolean };
export type CardInstance = Card & {
  instanceId: string; cardId: string; owner: Owner; lane: Lane | null; playedRound: number | null;
  basePower: number; powerModifier: number; moved: boolean; statuses: Statuses; lastEffectNote: string;
};
export type EffectLogEntry = { cardInstanceId: string; cardId: string; owner: Owner; lane: Lane; kind: 'ability' | 'fire' | 'water' | 'move' | 'blocked'; note: string };
export type Match = {
  round: number; phase: Phase; playerDeck: string; cpuDeck: string; playerHand: CardInstance[]; cpuHand: CardInstance[];
  boards: [CardInstance[], CardInstance[], CardInstance[]]; playerHype: number; cpuHype: number;
  playerDrawIndex: number; cpuDrawIndex: number; squabbleUsed: boolean; plugDiscountLane: Record<Owner, Lane | null>;
  cheapBuffsUsed: Record<Owner, number>; effectLog: EffectLogEntry[];
};

const lane = (n: number): Lane => n as Lane;
const emptyStatuses = (): Statuses => ({ frozen: false, silenced: false, protected: false, blocked: false });
export const createCardInstance = (cardId: string, owner: Owner, deck = 'custom', index = 0): CardInstance => {
  const card = cards[cardId];
  if (!card) throw new Error(`Unknown card ${cardId}`);
  return { ...card, cardId, instanceId: `${owner}:${deck}:${index}:${cardId}`, owner, deck, lane: null, playedRound: null, basePower: card.power, powerModifier: 0, moved: false, statuses: emptyStatuses(), lastEffectNote: 'Ready in hand.' };
};
const deckById = (id: string): Deck => {
  const deck = decks.find((item) => item.id === id);
  if (!deck) throw new Error(`Unknown deck ${id}`);
  return deck;
};

export function createMatch(playerDeck: string, cpuDeck: string): Match {
  const p = deckById(playerDeck), c = deckById(cpuDeck);
  return {
    round: 1, phase: 'player', playerDeck, cpuDeck,
    playerHand: p.cards.slice(0, 5).map((id, i) => createCardInstance(id, 'player', p.id, i)),
    cpuHand: c.cards.slice(0, 5).map((id, i) => createCardInstance(id, 'cpu', c.id, i)),
    boards: [[], [], []], playerHype: 1, cpuHype: 1, playerDrawIndex: 5, cpuDrawIndex: 5,
    squabbleUsed: false, plugDiscountLane: { player: null, cpu: null }, cheapBuffsUsed: { player: 0, cpu: 0 }, effectLog: [],
  };
}

export function getEffectiveCardPower(card: CardInstance): number {
  return card.statuses.frozen ? 0 : Math.max(0, card.basePower + card.powerModifier);
}
export const effectiveCardPower = getEffectiveCardPower;
export function getLaneScore(cardsInLane: CardInstance[], laneIndex: number): number {
  return cardsInLane.reduce((total, card) => {
    const district = laneIndex === 0 && (card.type === 'Fire' || card.type === 'Dark') ? 2
      : laneIndex === 1 && card.roles?.includes('Disruption') ? 2
      : laneIndex === 2 && card.type === 'Electric' ? 3 : 0;
    return total + getEffectiveCardPower(card) + district;
  }, 0);
}
export function getDistrictResults(match: Match) {
  return match.boards.map((cardsInLane, i) => {
    const player = getLaneScore(cardsInLane.filter((c) => c.owner === 'player'), i);
    const cpu = getLaneScore(cardsInLane.filter((c) => c.owner === 'cpu'), i);
    return { lane: i as Lane, player, cpu, winner: player === cpu ? 'draw' as const : player > cpu ? 'player' as const : 'cpu' as const };
  });
}
export function getMatchWinner(match: Match): Owner | 'draw' | null {
  const results = getDistrictResults(match), player = results.filter((r) => r.winner === 'player').length, cpu = results.filter((r) => r.winner === 'cpu').length;
  if (player >= 2) return 'player';
  if (cpu >= 2) return 'cpu';
  return match.round >= 6 && match.phase === 'complete' ? 'draw' : null;
}
export function getLegalCardCost(match: Match, owner: Owner, card: CardInstance, targetLane: Lane): number {
  const discount = match.plugDiscountLane[owner] !== null && match.plugDiscountLane[owner] !== targetLane;
  return Math.max(0, card.cost - (discount ? 1 : 0));
}
export const getDiscountedCardCost = getLegalCardCost;
export function canAffordSelection(match: Match, owner: Owner, instanceId: string, targetLane: Lane): boolean {
  const card = (owner === 'player' ? match.playerHand : match.cpuHand).find((c) => c.instanceId === instanceId);
  return !!card && getLegalCardCost(match, owner, card, targetLane) <= (owner === 'player' ? match.playerHype : match.cpuHype);
}

const modify = (m: Match, id: string, change: (c: CardInstance) => CardInstance): Match => ({ ...m, boards: m.boards.map((cardsInLane) => cardsInLane.map((c) => c.instanceId === id ? change(c) : c)) as Match['boards'] });
const addLog = (m: Match, card: CardInstance, text: string, kind: EffectLogEntry['kind'] = 'ability'): Match => ({ ...m, effectLog: [...m.effectLog, { cardInstanceId: card.instanceId, cardId: card.cardId, owner: card.owner, lane: card.lane!, kind, note: text }] });
const inLane = (m: Match, owner: Owner, target: Lane) => m.boards[target].filter((c) => c.owner === owner);
const highest = (items: CardInstance[]) => [...items].sort((a, b) => getEffectiveCardPower(b) - getEffectiveCardPower(a) || a.instanceId.localeCompare(b.instanceId))[0];
const lowest = (items: CardInstance[]) => [...items].sort((a, b) => getEffectiveCardPower(a) - getEffectiveCardPower(b) || a.instanceId.localeCompare(b.instanceId))[0];
const move = (m: Match, card: CardInstance, destination: Lane, note: string): Match => {
  if (card.lane === destination) return m;
  const updated = { ...card, lane: destination, moved: true, lastEffectNote: note };
  return { ...m, boards: m.boards.map((items, i) => i === card.lane ? items.filter((c) => c.instanceId !== card.instanceId) : i === destination ? [...items, updated] : items) as Match['boards'] };
};
const lowestFriendlyLane = (m: Match, owner: Owner, except: Lane): Lane => ([0, 1, 2] as Lane[]).filter((x) => x !== except).sort((a, b) => getLaneScore(inLane(m, owner, a), a) - getLaneScore(inLane(m, owner, b), b) || a - b)[0];
/** Wifey consumes one hostile targeted effect in her lane each round. */
const targetEnemy = (m: Match, source: CardInstance, target: CardInstance, apply: (c: CardInstance) => CardInstance): Match => {
  const guard = inLane(m, target.owner, target.lane!).find((c) => c.cardId === 'wifey' && !c.statuses.silenced && !c.statuses.blocked);
  if (guard) return addLog(modify(m, guard.instanceId, (c) => ({ ...c, statuses: { ...c.statuses, blocked: true }, lastEffectNote: 'Side Eye blocked a targeted effect.' })), source, 'Wifey blocked the targeted effect.', 'blocked');
  return modify(m, target.instanceId, apply);
};

function resolveAbility(match: Match, source: CardInstance): Match {
  if (source.statuses.silenced || source.statuses.frozen) return addLog(match, source, 'Ability did not fire (silenced or frozen).');
  const l = source.lane!, enemy = source.owner === 'player' ? 'cpu' : 'player', kind = source.type === 'Fire' ? 'fire' : source.type === 'Water' ? 'water' : 'ability';
  let m = match;
  const note = (text: string) => { m = addLog(m, source, text, kind); };
  if (source.cardId === 'rastamon') { const t = lowest(inLane(m, source.owner, l).filter((c) => c.instanceId !== source.instanceId && (c.statuses.frozen || c.statuses.silenced))); if (t) { m = modify(m, t.instanceId, (c) => ({ ...c, statuses: { ...c.statuses, frozen: false, silenced: false }, powerModifier: c.powerModifier + 2, lastEffectNote: 'Natural Cure: cleansed, +2 Power.' })); note('Natural Cure cleansed an ally and gave it +2.'); } else note('Natural Cure found no status to cleanse.'); }
  else if (source.cardId === 'roaster') { const t = highest(inLane(m, enemy, l)); if (t) { const amount = t.playedRound === m.round ? -3 : -2; m = targetEnemy(m, source, t, (c) => ({ ...c, powerModifier: c.powerModifier + amount, lastEffectNote: `Ratio'd Receipts: ${amount} Power.` })); note(`Ratio'd Receipts targeted ${t.name}.`); } else note("Ratio'd Receipts found no enemy."); }
  else if (source.cardId === 'nerd') { const t = highest(inLane(m, enemy, l)); if (t) { m = targetEnemy(m, source, t, (c) => ({ ...c, statuses: { ...c.statuses, silenced: true }, lastEffectNote: 'Unaware: silenced.' })); note('Unaware targeted the highest enemy.'); } else note('Unaware found no enemy.'); }
  else if (source.cardId === 'cornball') { const t = inLane(m, enemy, l).length >= 3 ? lowest(inLane(m, enemy, l)) : undefined; if (t) { const guarded = inLane(m, enemy, l).some((c) => c.cardId === 'wifey' && !c.statuses.silenced && !c.statuses.blocked); m = targetEnemy(m, source, t, (c) => c); if (!guarded) m = move(m, t, lane((l + 1) % 3), 'Scare the Hoes moved this card.'); note('Scare the Hoes moved the lowest enemy.'); } else note('Scare the Hoes needs three enemies.'); }
  else if (source.cardId === 'plug') { m = { ...m, plugDiscountLane: { ...m.plugDiscountLane, [source.owner]: l } }; note('Connections: next card in another district costs 1 less.'); }
  else if (source.cardId === 'streamer') note('Follower Frenzy is live for the next two cheap plays.');
  else if (source.cardId === 'gamer') note('Tryhard Trigger watches cheap plays here.');
  else if (source.cardId === 'techbro') { const hype = source.owner === 'player' ? m.playerHype : m.cpuHype; if (hype) { m = modify(m, source.instanceId, (c) => ({ ...c, powerModifier: c.powerModifier + 2, lastEffectNote: 'VC Funded Flex: +2 Power.' })); m = { ...m, ...(source.owner === 'player' ? { playerHype: hype - 1 } : { cpuHype: hype - 1 }) }; note('VC Funded Flex spent 1 Hype for +2.'); } else note('VC Funded Flex had no Hype left.'); }
  else if (source.cardId === 'bikelife') { const to = lowestFriendlyLane(m, source.owner, l); m = move(m, source, to, 'Ride Out moved here, +1 Power.'); m = modify(m, source.instanceId, (c) => ({ ...c, powerModifier: c.powerModifier + 1, lastEffectNote: 'Ride Out moved here, +1 Power.' })); note('Ride Out moved Bikelife and gave +1.'); }
  else if (source.cardId === 'vibe') { const t = lowest(m.boards.flat().filter((c) => c.owner === source.owner && c.instanceId !== source.instanceId && c.lane !== l)); if (t) { m = move(m, t, l, 'Wave Check pulled this card here, +1 Power.'); m = modify(m, t.instanceId, (c) => ({ ...c, powerModifier: c.powerModifier + 1, lastEffectNote: 'Wave Check pulled this card here, +1 Power.' })); m = modify(m, source.instanceId, (c) => ({ ...c, powerModifier: c.powerModifier + 1, lastEffectNote: 'Wave Check: +1 Power.' })); note('Wave Check pulled the lowest ally here; both gained +1.'); } else note('Wave Check needs an ally in another district.'); }
  else if (source.cardId === 'hooper') { if (getLaneScore(inLane(m, source.owner, l), l) < getLaneScore(inLane(m, enemy, l), l)) { const t = highest(inLane(m, enemy, l)); if (t) m = targetEnemy(m, source, t, (c) => ({ ...c, powerModifier: c.powerModifier - 2, lastEffectNote: 'Ankle Breaker: -2 Power.' })); m = modify(m, source.instanceId, (c) => ({ ...c, powerModifier: c.powerModifier + 2, lastEffectNote: 'Ankle Breaker: +2 Power.' })); note('Ankle Breaker flipped the pressure.'); } else note('Ankle Breaker only triggers while losing.'); }
  else if (source.cardId === 'baby') { if (inLane(m, enemy, l).length > inLane(m, source.owner, l).length) { m = modify(m, source.instanceId, (c) => ({ ...c, powerModifier: c.powerModifier + 2, lastEffectNote: 'Mama Bear: +2 Power.' })); note('Mama Bear gained +2.'); } else note('Mama Bear found no crowd disadvantage.'); }
  else if (source.cardId === 'oink') { for (const t of inLane(m, enemy, l)) m = targetEnemy(m, source, t, (c) => ({ ...c, powerModifier: c.powerModifier - 1, lastEffectNote: 'Civic Pressure: -1 Power.' })); note('Civic Pressure applied lane pressure.'); }
  else if (source.cardId === 'snow') { const t = highest(inLane(m, enemy, l)); if (t) { m = targetEnemy(m, source, t, (c) => ({ ...c, statuses: { ...c.statuses, frozen: true }, lastEffectNote: 'Cold Shoulder: frozen.' })); note('Cold Shoulder froze the highest enemy.'); } else note('Cold Shoulder found no enemy.'); }
  else if (source.cardId === 'wifey') { m = modify(m, source.instanceId, (c) => ({ ...c, statuses: { ...c.statuses, protected: true }, lastEffectNote: 'Side Eye is protecting this lane.' })); note('Side Eye will block one targeted effect this round.'); }
  return m;
}

export function playCard(match: Match, owner: Owner, instanceId: string, targetLane: Lane, squabble = false): Match {
  if ((owner === 'player' && match.phase !== 'player') || (owner === 'cpu' && match.phase !== 'cpu-reveal')) throw new Error('Owner cannot play in this phase');
  const handKey = owner === 'player' ? 'playerHand' : 'cpuHand', hypeKey = owner === 'player' ? 'playerHype' : 'cpuHype', card = match[handKey].find((c) => c.instanceId === instanceId);
  if (!card) throw new Error('Card is not in this hand');
  if (squabble && (owner !== 'player' || match.squabbleUsed)) throw new Error('SQUABBLE is unavailable');
  const cost = getLegalCardCost(match, owner, card, targetLane);
  if (match[hypeKey] < cost) throw new Error('Not enough Hype');
  const discountLane = match.plugDiscountLane[owner];
  const usedPlugDiscount = discountLane !== null && discountLane !== targetLane;
  let m: Match = {
    ...match,
    [handKey]: match[handKey].filter((c) => c.instanceId !== instanceId),
    [hypeKey]: match[hypeKey] - cost,
    plugDiscountLane: { ...match.plugDiscountLane, [owner]: usedPlugDiscount ? null : discountLane },
    squabbleUsed: match.squabbleUsed || squabble,
  };
  let placed: CardInstance = { ...card, lane: targetLane, playedRound: m.round, powerModifier: card.powerModifier + (squabble ? card.basePower : 0), lastEffectNote: squabble ? 'SQUABBLE doubled base Power.' : `Played for ${cost} Hype.` };
  m = { ...m, boards: m.boards.map((items, i) => i === targetLane ? [...items, placed] : items) as Match['boards'] };
  // Existing engines see a cheap arrival before its own ability resolves.
  if (cost <= 2) for (const streamer of m.boards.flat().filter((c) => c.owner === owner && c.cardId === 'streamer' && !c.statuses.silenced && !c.statuses.frozen)) if (m.cheapBuffsUsed[owner] < 2) { m = modify(m, placed.instanceId, (c) => ({ ...c, powerModifier: c.powerModifier + 1, lastEffectNote: 'Follower Frenzy: +1 Power.' })); m = { ...m, cheapBuffsUsed: { ...m.cheapBuffsUsed, [owner]: m.cheapBuffsUsed[owner] + 1 } }; }
  if (cost <= 2) for (const gamer of inLane(m, owner, targetLane).filter((c) => c.cardId === 'gamer' && c.instanceId !== placed.instanceId && !c.statuses.silenced && !c.statuses.frozen)) { m = modify(m, gamer.instanceId, (c) => ({ ...c, powerModifier: c.powerModifier + 1 })); m = modify(m, placed.instanceId, (c) => ({ ...c, powerModifier: c.powerModifier + 1, lastEffectNote: 'Tryhard Trigger: +1 Power.' })); }
  placed = m.boards.flat().find((c) => c.instanceId === instanceId)!;
  m = resolveAbility(m, placed);
  return { ...m, phase: owner === 'player' ? 'cpu-reveal' : 'resolved' };
}
export function pass(match: Match, owner: Owner): Match {
  if ((owner === 'player' && match.phase !== 'player') || (owner === 'cpu' && match.phase !== 'cpu-reveal')) throw new Error('Owner cannot pass in this phase');
  return { ...match, phase: owner === 'player' ? 'cpu-reveal' : 'resolved', effectLog: [...match.effectLog, { cardInstanceId: 'pass', cardId: 'pass', owner, lane: 0, kind: 'ability', note: `${owner} passed.` }] };
}
export function chooseCpuPlay(match: Match): { instanceId: string; lane: Lane } | null {
  if (match.phase !== 'cpu-reveal') return null;
  const options = match.cpuHand.flatMap((card) => ([0, 1, 2] as Lane[]).filter((l) => canAffordSelection(match, 'cpu', card.instanceId, l)).map((l) => ({ card, lane: l, cost: getLegalCardCost(match, 'cpu', card, l) })));
  if (!options.length) return null;
  const ranked = options.sort((a, b) => {
    const av = getLaneScore(inLane(match, 'cpu', a.lane), a.lane) + a.card.basePower - getLaneScore(inLane(match, 'player', a.lane), a.lane);
    const bv = getLaneScore(inLane(match, 'cpu', b.lane), b.lane) + b.card.basePower - getLaneScore(inLane(match, 'player', b.lane), b.lane);
    return bv - av || a.cost - b.cost || a.card.instanceId.localeCompare(b.card.instanceId) || a.lane - b.lane;
  });
  return { instanceId: ranked[0].card.instanceId, lane: ranked[0].lane };
}
export function revealCpu(match: Match): Match { const choice = chooseCpuPlay(match); return choice ? playCard(match, 'cpu', choice.instanceId, choice.lane) : pass(match, 'cpu'); }
export function nextRound(match: Match): Match {
  if (match.phase !== 'resolved') throw new Error('Round is not resolved');
  if (match.round >= 6) return { ...match, phase: 'complete' };
  const draw = (owner: Owner, deck: Deck, index: number) => index < deck.cards.length ? createCardInstance(deck.cards[index], owner, deck.id, index) : null;
  const p = draw('player', deckById(match.playerDeck), match.playerDrawIndex), c = draw('cpu', deckById(match.cpuDeck), match.cpuDrawIndex);
  const reset = (c: CardInstance) => ({ ...c, statuses: { ...c.statuses, blocked: false } });
  return { ...match, round: match.round + 1, phase: 'player', playerHype: match.round + 1, cpuHype: match.round + 1, playerHand: p ? [...match.playerHand, p] : match.playerHand, cpuHand: c ? [...match.cpuHand, c] : match.cpuHand, playerDrawIndex: match.playerDrawIndex + (p ? 1 : 0), cpuDrawIndex: match.cpuDrawIndex + (c ? 1 : 0), boards: match.boards.map((x) => x.map(reset)) as Match['boards'], effectLog: [] };
}