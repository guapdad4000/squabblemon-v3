import type { RankedResult } from './ranked';
export { RANKED_BOT_WAIT_MS, RANKED_QUEUE_IDLE_MS, RANKED_SEASON, RANK_TIERS, rankedStats, rankProgress, awardRank } from './ranked';
export type { RankedStats, RankedResult } from './ranked';
import {
  createDistrictSnapshot,
  getMatchDistricts,
  getCharacterDistrictMarks,
  type CharacterDistrictMark,
  createMatchFromEngineCards,
  getDistrictResults,
  getEffectiveCardPower,
  getLegalCardCost,
  getStoryLockedLanes,
  getMatchWinner,
  getMatchRoundLimit,
  nextRound,
  pass,
  playTurnCard,
  type CardInstance,
  type EffectKind,
  type EventType,
  type Lane,
  type Match,
  type Owner,
  type Statuses,
} from "./gameEngine";

/** Bumped whenever a persisted online room can no longer be replayed safely. */
export const ONLINE_RULES_VERSION = 11;
/**
 * Card values and trigger semantics are part of a reward match's issued
 * snapshot.  Keep this separate from the transport rules version so a
 * cosmetic/network change does not invalidate an in-progress reward fade.
 */
export const CARD_BALANCE_VERSION = 11;
export const TURN_SECONDS = 75;
export const ROOM_LIFETIME_MS = 30 * 60 * 1000;
export type Seat = Owner;
export const otherSeat = (seat: Seat): Seat =>
  seat === "player" ? "cpu" : "player";
export type OnlineDeck = {
  id: string;
  name: string;
  hero: string;
  cards: string[];
};
export type OnlineMember = {
  userId: string;
  name: string;
  avatarKey?: string;
  level?: number;
  streetRep?: number;
  deck: OnlineDeck;
  ready: boolean;
};
export type OnlineCommand =
  | { type: "ready" | "end-turn" | "surrender" | "rematch" }
  | { type: "play"; instanceId: string; lane: Lane; squabble: boolean; investment?: number };
export type OnlineRoom = {
  ranked?: { redirectCode?: string; queuedAt: number; heartbeatAt: number; botAfter: number; bot: boolean; botNextAt?: number; ratings: { player: number; cpu?: number }; settlement?: Partial<Record<Seat, RankedResult>> };
  rulesVersion: number;
  revision: number;
  gameNumber: number;
  members: { player: OnlineMember; cpu: OnlineMember | null };
  status: "waiting" | "active" | "complete" | "closed";
  match: Match | null;
  openingSeat: Seat;
  activeSeat: Seat;
  turnsEnded: number;
  deadline: number | null;
  expiresAt: number;
  winner: Seat | "draw" | null;
  reason: "districts" | "surrender" | "timeout" | "expired" | null;
  rematch: Record<Seat, boolean>;
};
export class OnlineError extends Error {
  constructor(
    message: string,
    public status = 409,
  ) {
    super(message);
  }
}
export function memberSeat(room: OnlineRoom, userId: string): Seat {
  if (room.members.player.userId === userId) return "player";
  if (room.members.cpu?.userId === userId) return "cpu";
  throw new OnlineError("Room not found or you are not a participant.", 404);
}
export function createOnlineRoom(
  host: OnlineMember,
  openingSeat: Seat,
  now: number,
): OnlineRoom {
  return {
    rulesVersion: ONLINE_RULES_VERSION,
    revision: 0,
    gameNumber: 1,
    members: { player: { ...host, ready: false }, cpu: null },
    status: "waiting",
    match: null,
    openingSeat,
    activeSeat: openingSeat,
    turnsEnded: 0,
    deadline: null,
    expiresAt: now + ROOM_LIFETIME_MS,
    winner: null,
    reason: null,
    rematch: { player: false, cpu: false },
  };
}
export function joinOnlineRoom(
  room: OnlineRoom,
  member: OnlineMember,
  now: number,
): OnlineRoom {
  if (
    room.members.player.userId === member.userId ||
    room.members.cpu?.userId === member.userId
  )
    return room;
  if (room.status !== "waiting" || room.members.cpu || now >= room.expiresAt)
    throw new OnlineError("This room is full or has expired.");
  return {
    ...room,
    revision: room.revision + 1,
    members: { ...room.members, cpu: { ...member, ready: false } },
  };
}
/** Called under the room lock on every read/write. No browser clock decides a timeout. */
export function expireOnlineRoom(room: OnlineRoom, now: number): OnlineRoom {
  if (
    room.status === "active" &&
    room.deadline !== null &&
    now >= room.deadline
  ) {
    return {
      ...room,
      revision: room.revision + 1,
      status: "complete",
      winner: otherSeat(room.activeSeat),
      reason: "timeout",
      deadline: null,
      expiresAt: now + ROOM_LIFETIME_MS,
    };
  }
  if (
    (room.status === "waiting" || room.status === "complete") &&
    now >= room.expiresAt
  ) {
    return {
      ...room,
      revision: room.revision + 1,
      status: "closed",
      reason: "expired",
      deadline: null,
    };
  }
  return room;
}
function startOnlineMatch(room: OnlineRoom, now: number): OnlineRoom {
  const a = room.members.player.deck,
    b = room.members.cpu!.deck;
  const match = createMatchFromEngineCards(
    a.id,
    [...a.cards],
    b.id,
    [...b.cards],
    undefined,
    undefined,
    undefined,
    createDistrictSnapshot(`${room.expiresAt}:${room.gameNumber}:${now}`),
  );
  match.squabbleByOwner = { player: false, cpu: false };
  match.phase = room.openingSeat === "player" ? "player" : "cpu-reveal";
  return {
    ...room,
    status: "active",
    match,
    activeSeat: room.openingSeat,
    turnsEnded: 0,
    deadline: now + TURN_SECONDS * 1000,
    expiresAt: now + ROOM_LIFETIME_MS,
  };
}
/** Both human seats use the shared card rules. CPU decision functions are never called. */
export function applyOnlineCommand(
  room: OnlineRoom,
  seat: Seat,
  command: OnlineCommand,
  now: number,
): OnlineRoom {
  if (room.rulesVersion !== ONLINE_RULES_VERSION)
    throw new OnlineError(
      "This fade uses an older rules version. Create a new room.",
    );
  if (!room.members[seat])
    throw new OnlineError("Participant is missing.", 403);
  let next = { ...room, revision: room.revision + 1 };
  if (command.type === "surrender") {
    if (room.status !== "active" && room.status !== "waiting")
      throw new OnlineError("This fade has already ended.");
    return {
      ...next,
      status: room.status === "active" ? "complete" : "closed",
      winner: room.status === "active" ? otherSeat(seat) : null,
      reason: "surrender",
      deadline: null,
      expiresAt: now + ROOM_LIFETIME_MS,
    };
  }
  if (command.type === "ready") {
    if (room.status !== "waiting" || !room.members.cpu)
      throw new OnlineError("Both players must join before getting ready.");
    next.members = {
      ...room.members,
      [seat]: { ...room.members[seat]!, ready: true },
    };
    return next.members.player.ready && next.members.cpu!.ready
      ? startOnlineMatch(next, now)
      : next;
  }
  if (command.type === "rematch") {
    if (room.ranked) throw new OnlineError("Return to Fade Park to find your next ranked opponent.");
    if (room.status !== "complete" || !room.members.cpu)
      throw new OnlineError("Finish this fade first.");
    next.rematch = { ...room.rematch, [seat]: true };
    if (!next.rematch.player || !next.rematch.cpu) return next;
    return {
      ...next,
      status: "waiting",
      gameNumber: room.gameNumber + 1,
      match: null,
      openingSeat: otherSeat(room.openingSeat),
      members: {
        player: { ...room.members.player, ready: false },
        cpu: { ...room.members.cpu, ready: false },
      },
      winner: null,
      reason: null,
      deadline: null,
      expiresAt: now + ROOM_LIFETIME_MS,
      rematch: { player: false, cpu: false },
    };
  }
  if (room.status !== "active" || !room.match)
    throw new OnlineError("This fade is not active.");
  if (room.deadline !== null && now >= room.deadline)
    throw new OnlineError("The turn deadline has passed.");
  if (room.activeSeat !== seat) throw new OnlineError("Wait for your turn.");
  if (command.type === "play") {
    if (![0, 1, 2].includes(command.lane))
      throw new OnlineError("Choose a valid district.", 400);
    try {
      next.match = playTurnCard(
        room.match,
        seat,
        command.instanceId,
        command.lane,
        command.squabble,
        command.investment,
      );
    } catch (error) {
      throw new OnlineError(
        error instanceof Error ? error.message : "That play is not legal.",
        400,
      );
    }
    return next;
  }
  let match = pass(room.match, seat);
  if (room.turnsEnded === 0) {
    const activeSeat = otherSeat(seat);
    match = {
      ...match,
      phase: activeSeat === "player" ? "player" : "cpu-reveal",
    };
    return {
      ...next,
      match,
      turnsEnded: 1,
      activeSeat,
      deadline: now + TURN_SECONDS * 1000,
    };
  }
  match = nextRound({ ...match, phase: "resolved" });
  if (match.phase === "complete")
    return {
      ...next,
      match,
      status: "complete",
      winner: getMatchWinner(match),
      reason: "districts",
      deadline: null,
      expiresAt: now + ROOM_LIFETIME_MS,
    };
  const activeSeat =
    match.round % 2 === 1 ? room.openingSeat : otherSeat(room.openingSeat);
  return {
    ...next,
    match: {
      ...match,
      phase: activeSeat === "player" ? "player" : "cpu-reveal",
    },
    activeSeat,
    turnsEnded: 0,
    deadline: now + TURN_SECONDS * 1000,
  };
}

export type PublicCard = {
  /** Public artwork identity; summons may share mechanics but use different portraits. */
  artworkId?: string;
  /** Public battle form presentation; never changes collection identity. */
  form?: { name: string; ability: string; effect: string };
  /** Buddy's battle-only state; Buddy Buds are tokens, never collectible cards. */
  buddyForm?: CardInstance['buddyForm'];
  buddyGrowthAtRound?: number;
  buddyBud?: CardInstance['buddyBud'];
  buddyEarthExpiresAtRound?: number;
  /** Stable summon/play order survives lane movement and reconnects. */
  arrivalOrder?: number;
  kind?: CardInstance['kind'];
  type: CardInstance['type'];
  hazard: boolean;
  smileBomb?: CardInstance['smileBomb'];
  bankedMotion?: number;
  aliceReady?: boolean;
  idolId?: string;
  instanceId: string;
  cardId: string;
  owner: Seat;
  lane: Lane | null;
  power: number;
  basePower: number;
  powerModifier: number;
  statuses: Statuses;
  covered: boolean;
  moved: boolean;
  costs: [number, number, number];
};
export type PublicEvent = {
  round: number;
  sequence: number;
  type: EventType;
  kind: EffectKind;
  note: string;
  owner: Seat;
  lane: Lane;
  cardId: string | null;
};
export type OnlineRoomView = {
  ranked?: { opponent: "player" | "bot" | "searching"; queuedAt: number; botAfter: number; rating: number; result: RankedResult | null };
  lockedLanes?: Lane[];
  districtMarks?: CharacterDistrictMark[];
  districts: ReturnType<typeof getMatchDistricts>;
  code: string;
  revision: number;
  gameNumber: number;
  status: OnlineRoom["status"];
  seat: Seat;
  members: Record<Seat, { name: string; hero: string; avatarKey?: string; level?: number; streetRep?: number; rp?: number; ready: boolean } | null>;
  ownDeck: OnlineDeck;
  revealedDecks: Record<Seat, OnlineDeck> | null;
  activeSeat: Seat;
  firstThisRound: Seat;
  deadline: number | null;
  serverTime: number;
  round: number;
  roundLimit?: number;
  diceResult?: Match['diceResult'];
  motion: Record<Seat, number>;
  hand: PublicCard[];
  rivalHandCount: number;
  boards: PublicCard[][];
  scores: ReturnType<typeof getDistrictResults>;
  events: PublicEvent[];
  squabble: Record<Seat, boolean>;
  winner: OnlineRoom["winner"];
  reason: OnlineRoom["reason"];
  rematch: Record<Seat, boolean>;
};
/** Explicit allowlist: full engine snapshots, event replays, user IDs and rival hands NEVER cross this boundary. */
export function onlineRoomView(
  room: OnlineRoom,
  code: string,
  userId: string,
  now: number,
): OnlineRoomView {
  const seat = memberSeat(room, userId),
    match = room.match;
  const showCard = (card: CardInstance): PublicCard => ({
    artworkId: card.id,
    ...(card.cardId === 'luigion' && card.id === 'luigion-powered'
      ? { form: { name: card.name, ability: card.ability, effect: card.effect } } : {}),
    ...(card.buddyForm ? { buddyForm: card.buddyForm } : {}),
    ...(card.buddyGrowthAtRound !== undefined ? { buddyGrowthAtRound: card.buddyGrowthAtRound } : {}),
    ...(card.buddyBud ? { buddyBud: { ...card.buddyBud } } : {}),
    ...(card.buddyEarthExpiresAtRound !== undefined ? { buddyEarthExpiresAtRound: card.buddyEarthExpiresAtRound } : {}),
    ...(card.arrivalOrder !== undefined ? { arrivalOrder: card.arrivalOrder } : {}),
    kind: card.kind ?? 'character',
    type: card.type,
    hazard: !!card.hazard,
    ...(card.cardId === 'powerhouse' ? { bankedMotion: card.bankedMotion ?? 0 } : {}),
    ...(card.aliceReady ? { aliceReady: true } : {}),
    ...(card.idolId ? { idolId: card.idolId } : {}),
    ...(card.smileBomb ? { smileBomb: { ...card.smileBomb } } : {}),
    instanceId: card.instanceId,
    cardId: card.cardId,
    owner: card.owner,
    lane: card.lane,
    power: getEffectiveCardPower(card),
    basePower: card.basePower,
    powerModifier: card.powerModifier,
    statuses: { ...card.statuses },
    covered: match?.timedEffects.some(effect => (effect.kind === 'church-protection' || effect.kind === 'salon-protection') && effect.targetInstanceId === card.instanceId) ?? false,
    moved: card.moved,
    costs: [0, 1, 2].map((lane) =>
      getLegalCardCost(match!, card.owner, card, lane as Lane),
    ) as [number, number, number],
  });
  const publicMember = (member: OnlineMember | null, memberSeat: Seat) =>
    member
      ? { name: member.name, hero: member.deck.hero, avatarKey: member.avatarKey, level: member.level,
          streetRep: member.streetRep, rp: room.ranked?.ratings[memberSeat], ready: member.ready }
      : null;
  return {
    ...(room.ranked ? { ranked: { opponent: room.members.cpu ? room.ranked.bot ? "bot" as const : "player" as const : "searching" as const, queuedAt: room.ranked.queuedAt, botAfter: room.ranked.botAfter, rating: room.ranked.ratings[seat] ?? 1000, result: room.ranked.settlement?.[seat] ?? null } } : {}),
    districts: getMatchDistricts(match, seat),
    lockedLanes: match ? getStoryLockedLanes(match, seat) : [],
    districtMarks: match ? getCharacterDistrictMarks(match) : [],
    code,
    revision: room.revision,
    gameNumber: room.gameNumber,
    status: room.status,
    seat,
    members: {
      player: publicMember(room.members.player, 'player'),
      cpu: publicMember(room.members.cpu, 'cpu'),
    },
    ownDeck: room.members[seat]!.deck,
    revealedDecks:
      room.status === "complete" && room.members.cpu
        ? { player: room.members.player.deck, cpu: room.members.cpu.deck }
        : null,
    activeSeat: room.activeSeat,
    firstThisRound:
      (match?.round ?? 1) % 2 === 1
        ? room.openingSeat
        : otherSeat(room.openingSeat),
    deadline: room.deadline,
    serverTime: now,
    round: match?.round ?? 1,
    roundLimit: getMatchRoundLimit(match),
    diceResult: match?.diceResult,
    motion: { player: match?.playerMotion ?? 2, cpu: match?.cpuMotion ?? 2 },
    hand: match
      ? (seat === "player" ? match.playerHand : match.cpuHand).map(showCard)
      : [],
    rivalHandCount: match
      ? (seat === "player" ? match.cpuHand : match.playerHand).length
      : 0,
    boards: match
      ? match.boards.map((lane) => lane.map(showCard))
      : [[], [], []],
    scores: match ? getDistrictResults(match) : [],
    events: (match?.effectLog ?? [])
      .slice(-24)
      .map((event) => ({
        sequence: event.sequence,
        round: event.round,
        type: event.type,
        kind: event.kind,
        note: event.type === "pass" ? "Turn ended." : event.note,
        owner: event.owner,
        lane: event.lane,
        cardId:
          event.type === "play" || event.type === "reveal"
            ? event.cardId
            : null,
      })),
    squabble: match?.squabbleByOwner ?? { player: false, cpu: false },
    winner: room.winner,
    reason: room.reason,
    rematch: room.rematch,
  };
}
