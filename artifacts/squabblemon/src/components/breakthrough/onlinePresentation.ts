import type {
  FighterDefinition,
  GameState,
  Side,
  Unit,
  TimedStatus,
  Hazard,
} from "@workspace/squabblemon-engine/breakthrough";
import type { BreakthroughRoomView } from "@workspace/squabblemon-engine/breakthroughRoom";
/** Rendering adapter only. Never advance/deploy this object: private simulation fields are intentionally absent/empty.
 * The guest sees their base at the bottom. IDs/lane indices stay authoritative; only sides and positions flip.
 */
export function onlinePresentation(
  view: BreakthroughRoomView,
  roster: FighterDefinition[],
): GameState {
  const side = (s: Side): Side => (s === view.side ? "player" : "opponent");
  const position = (p: number) => (view.side === "player" ? p : 1 - p);
  const player = (s: Side) => ({
    motion: view.players[s].motion,
    breaches: view.players[s].breaches,
    squabbleUsed: view.players[s].squabbleUsed,
    nextDrawAt: view.players[s].nextDrawAt,
    hand: s === view.side ? view.hand : [],
    queue: s === view.side && view.nextCard ? [view.nextCard] : [],
    returns: s === view.side ? view.returns : [],
    reinforcements: [],
    ...(s === view.side
      ? {
          transferTicket: view.transferTicket,
          returnedHands: Object.fromEntries(
            Object.entries(view.handPlans).map(([id, p]) => [id, p.hands]),
          ),
        }
      : {}),
  });
  return {
    tick: view.tick,
    elapsedMs: view.elapsedMs,
    durationMs: view.durationMs,
    travelMs: view.travelMs,
    ruleset: view.ruleset,
    status: view.phase === "active" ? "playing" : "complete",
    drawsLocked: view.drawsLocked,
    winner:
      view.winner === "draw" || view.winner === null
        ? view.winner
        : side(view.winner),
    reason: view.reason,
    players: {
      player: player(view.side),
      opponent: player(view.side === "player" ? "opponent" : "player"),
    },
    units: view.units.map(
      (u) =>
        ({
          ...u,
          side: side(u.side),
          position: position(u.position),
          copiedAbility: u.ability as FighterDefinition["ability"],
          formCost: u.cost,
          nextEffectAt: Infinity,
          immunityScope:
            u.immunityScope === "abilities" ? "abilities" : undefined,
          movementLocks: u.movementLocked
            ? [{ sourceId: "public", expiresAt: Infinity }]
            : [],
        }) satisfies Unit,
    ),
    events: view.events.map((e) => ({
      ...e,
      ...(e.side ? { side: side(e.side) } : {}),
      ...(e.sourceSide ? { sourceSide: side(e.sourceSide) } : {}),
      ...(e.position !== undefined ? { position: position(e.position) } : {}),
      ...(e.sourcePosition !== undefined
        ? { sourcePosition: position(e.sourcePosition) }
        : {}),
    })),
    statuses: view.statuses.map((s) => ({
      ...s,
      kind: s.kind as TimedStatus["kind"],
      sourceUnitId: "",
      sourceSide: "player",
      sourceLane: 0,
      sourcePosition: 0,
    })),
    hazards: view.hazards.map((h) => ({
      ...h,
      kind: h.kind as Hazard["kind"],
      side: side(h.side),
      sourceUnitId: "",
      sourcePosition: 0,
      sourceLane: h.lane,
    })),
    anunaki: {
      lastPulse: view.elapsedMs,
      tablets: {
        player: view.tablets
          .filter((t) => t.side === view.side)
          .map((t) => t.lane),
        opponent: view.tablets
          .filter((t) => t.side !== view.side)
          .map((t) => t.lane),
      },
    },
    metrics: {
      player: view.metrics[view.side],
      opponent: view.metrics[view.side === "player" ? "opponent" : "player"],
    },
    roster,
    seed: 0,
    accumulatorMs: 0,
    nextUnitId: 0,
    nextEventId: 0,
    decks: { player: [], opponent: [] },
    effectsRng: 0,
    aiSeed: 0,
    aiStyle: "counter",
    nextEffectId: 0,
    commands: [],
  };
}
