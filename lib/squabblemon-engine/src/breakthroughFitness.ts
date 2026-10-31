/** Fitness route/circuit rules. Ten-second pulses use authoritative engine time;
 * animations and wall-clock callbacks never participate in any payout. */
import type {
  BattleEvent,
  FighterDefinition,
  GameState,
  Lane,
  Side,
  TimedStatus,
  Unit,
} from './breakthrough';
type EffectSource = Pick<Unit, 'id' | 'cardId' | 'side' | 'lane' | 'position'>;

export const FITNESS_PULSE_MS = 10000;
export const FITNESS_ABILITY_DESCRIPTIONS = {
  'first-lap':
    'Deploy: move to your weakest other legal lane. Movement keeps progress and obeys enemy positions and movement restrictions.',
  'bag-check':
    'Deploy: move your weakest other local Fitness ally to its weakest other legal lane. One successful Bag Check per side per10-second pulse.',
  'take-the-stairs':
    'Deploy: move to your weakest unvisited legal lane. The first successful entrance move for this instance grants+1. All successful Fitness lane visits are recorded.',
  'finish-the-circuit':
    'Deploy: if a surviving friendly Fitness fighter has visited all3 lanes, your weakest Fitness fighter in each occupied lane gains+2, once per side per match. Otherwise Protect your weakest other local Fitness ally.',
  'i-got-you':
    'Deploy: your weakest other local Fitness ally gains+1 and Protection. Its next successful lane move through the following10-second pulse interval grants+1 once.',
  bodyweight:
    'While active: the first successful move by this fighter in each10-second pulse grants it+2. At most2 payouts per instance per match.',
  'no-equipment-needed':
    'While held: the first successful friendly Fitness move in a10-second pulse grants that mover+1, twice per side per match. Deploy once per side per match: if Fitness fighters occupy all3 lanes, the weakest in each gains+3. Otherwise your weakest other local Fitness ally gains+3 and Protection.',
  'double-dutch':
    'While active: the first distinct friendly Fitness mover in a10-second pulse gives this fighter+2; the second gives it+1. Each leg pays at most twice per side per match. Copies share both limits.',
  'hop-on':
    'Deploy: ride with your weakest other local ally to the weakest other lane that both can legally enter. Only a passenger who arrives gains+1 and Protection. Breakthrough has no population cap; enemy positions and movement restrictions still apply to both.',
  'key-for-that':
    'Deploy: fully cleanse your weakest other local ally and clear its timed movement restrictions, then move it to its weakest other legal lane. Protect it only if it arrives.',
  'lash-out':
    'Deploy: attempt1 damage against the strongest enemy here through normal defenses. Only actual damage gives your weakest other local ally+2. Fully absorbed hits do not pay.',
  'one-more-rep':
    'While active: at each10-second pulse boundary, gain+3 if another real character was played in a different lane during the completed interval. One Rep per interval,3 Reps per side per match; the third grants Protection. Copies share progress. Supports, tokens, moves and echoes do not count as plays.',
  'active-recovery':
    'Deploy: move to your weakest other legal lane. On arrival, remove Burn from local friendly Fitness fighters. Then heal up to3 actual damage and remove Burn from your weakest injured other ally; otherwise cleanse your weakest burning other ally, or give your weakest other ally+1 if no recovery is needed. Failed moves give no benefit.',
  'circuit-training':
    'Deploy: train your weakest other local untrained ally through the next2 pulse intervals. Its first successful move out gains+3; a later visit to the remaining third lane gains+3 and Protection. One current circuit per side, each character identity once per match. Trainer must remain active.',
  'no-days-off':
    "While already active: the first other real friendly Fitness fighter destroyed by an enemy in a10-second interval gives this fighter+2 and attempts1 damage on the strongest enemy in the fallen fighter's lane. Two payouts per side per match; copies share progress. Friendly damage, sacrifices and tokens never count.",
  'one-last-shot':
    'While active, once per friendly card identity per match: when this lane changes from tied/winning to losing, gain+4 and Protection. If deployed losing, a later enemy arrival here while still losing can also trigger it.',
  'next-up':
    'Deploy: if losing this lane, gain+2 and attempt1 damage on its strongest enemy. Otherwise arm one comeback through the next pulse interval, once per card identity per match: an enemy arrival that turns this lane from tied/winning to losing grants+2 and attempts1 damage on its strongest enemy.',
} as const;
export const FITNESS_ADAPTERS = {
  'track-suit-auntie': { ability: 'first-lap', tacticalRoles: ['support'] },
  'gym-bag-yn': { ability: 'bag-check', tacticalRoles: ['support'] },
  'stairwell-sprinter': {
    ability: 'take-the-stairs',
    tacticalRoles: ['support'],
  },
  'last-set-og': { ability: 'finish-the-circuit', tacticalRoles: ['support'] },
  'gym-spotter-yn': { ability: 'i-got-you', tacticalRoles: ['support'] },
  'calisthenics-yn': { ability: 'bodyweight', tacticalRoles: ['support'] },
  'og-calisthenics': {
    ability: 'no-equipment-needed',
    tacticalRoles: ['support'],
  },
  'jump-rope-menace': { ability: 'double-dutch', tacticalRoles: ['support'] },
  'yn-atv-lord': { ability: 'hop-on', tacticalRoles: ['support'] },
  'apartment-maintenance-sage': {
    ability: 'key-for-that',
    tacticalRoles: ['support'],
  },
  'lash-tech': { ability: 'lash-out', tacticalRoles: ['support', 'control'] },
  'fitness-bro': { ability: 'one-more-rep', tacticalRoles: ['support'] },
  'fitness-girl': { ability: 'active-recovery', tacticalRoles: ['support'] },
  'personal-trainer': {
    ability: 'circuit-training',
    tacticalRoles: ['support'],
  },
  'demon-trainer': { ability: 'no-days-off', tacticalRoles: ['control'] },
  'failed-athlete': { ability: 'one-last-shot', tacticalRoles: ['support'] },
  'sports-prodigy': { ability: 'next-up', tacticalRoles: ['control'] },
} as const;
export type FitnessAbility = keyof typeof FITNESS_ABILITY_DESCRIPTIONS;
interface FitnessSource {
  sourceCardId?: string;
  sourceUnitId: string;
  sourceSide: Side;
  sourceLane: Lane;
  sourcePosition: number;
}
interface FitnessWard extends FitnessSource {
  targetId: string;
  expiresAt: number;
}
interface FitnessCircuit extends FitnessSource {
  targetId: string;
  origin: Lane;
  visited: Lane[];
  expiresAt: number;
}
interface FitnessWatcher {
  ahead: boolean;
  losingStart: boolean;
  expiresAt?: number;
}
interface FitnessSeat {
  bagPulse: number;
  finishUsed: boolean;
  ogEntranceUsed: boolean;
  heldPulse: number;
  heldPayouts: number;
  moverPulse: number;
  movers: string[];
  ropeFirstPayouts: number;
  ropeSecondPayouts: number;
  reps: number;
  repReadyPulse: number;
  demonPulse: number;
  demonPayouts: number;
  trainedCards: Record<string, true>;
  comebackCards: Record<string, true>;
  sportsArmedCards: Record<string, true>;
  circuit?: FitnessCircuit;
}
export interface FitnessMatchState {
  seats: Record<Side, FitnessSeat>;
  routes: Record<string, Lane[]>;
  stairPayouts: Record<string, true>;
  bodyweight: Record<string, { pulse: number; payouts: number }>;
  wards: FitnessWard[];
  watchers: Record<string, FitnessWatcher>;
  processedDeaths: Record<string, true>;
  lastPulse: number;
  resolvingBoardChange: boolean;
}
type FitnessCard = Pick<FighterDefinition, 'id' | 'kind' | 'traits'> & {
  ability?: string;
};
export interface FitnessContext {
  state: GameState & { fitness?: FitnessMatchState };
  definition(unit: Unit): FitnessCard;
  active(unit: Unit): boolean;
  effectiveHands(unit: Unit): number;
  gain(
    unit: Unit,
    amount: number,
    copied?: boolean,
    source?: EffectSource,
  ): void;
  protect(unit: Unit): void;
  cleanse(
    unit: Unit,
    kinds?: readonly TimedStatus['kind'][],
    source?: EffectSource,
  ): void;
  heal(unit: Unit, cap: number, source?: EffectSource): number;
  clearMovementRestriction(unit: Unit): void;
  move(unit: Unit, lane: Lane): boolean;
  openForMove(unit: Unit, lane: Lane): boolean;
  /** Return actual damage after defenses, shields and damage prevention. */
  strike(source: Unit, target: Unit, amount: number): number;
  event(event: Omit<BattleEvent, 'id'>): void;
  /** Future summons must opt out even when their artwork resembles a fighter. */
  isToken?(unit: Unit): boolean;
}
const SIDES: readonly Side[] = ['player', 'opponent'];
const LANES: readonly Lane[] = [0, 1, 2];
const freshSeat = (): FitnessSeat => ({
  bagPulse: -1,
  finishUsed: false,
  ogEntranceUsed: false,
  heldPulse: -1,
  heldPayouts: 0,
  moverPulse: -1,
  movers: [],
  ropeFirstPayouts: 0,
  ropeSecondPayouts: 0,
  reps: 0,
  repReadyPulse: -1,
  demonPulse: -1,
  demonPayouts: 0,
  trainedCards: {},
  comebackCards: {},
  sportsArmedCards: {},
});
function runtime(ctx: FitnessContext): FitnessMatchState {
  return (ctx.state.fitness ??= {
    seats: { player: freshSeat(), opponent: freshSeat() },
    routes: {},
    stairPayouts: {},
    bodyweight: {},
    wards: [],
    watchers: {},
    processedDeaths: {},
    lastPulse: Math.floor(ctx.state.elapsedMs / FITNESS_PULSE_MS),
    resolvingBoardChange: false,
  });
}
export function cloneFitnessState(
  value?: FitnessMatchState,
): FitnessMatchState | undefined {
  if (!value) return undefined;
  return {
    ...value,
    seats: Object.fromEntries(
      SIDES.map((side) => {
        const s = value.seats[side];
        return [
          side,
          {
            ...s,
            movers: [...s.movers],
            trainedCards: { ...s.trainedCards },
            comebackCards: { ...s.comebackCards },
            sportsArmedCards: { ...s.sportsArmedCards },
            ...(s.circuit
              ? { circuit: { ...s.circuit, visited: [...s.circuit.visited] } }
              : {}),
          },
        ];
      }),
    ) as Record<Side, FitnessSeat>,
    routes: Object.fromEntries(
      Object.entries(value.routes).map(([id, route]) => [id, [...route]]),
    ),
    stairPayouts: { ...value.stairPayouts },
    bodyweight: Object.fromEntries(
      Object.entries(value.bodyweight).map(([id, x]) => [id, { ...x }]),
    ),
    wards: value.wards.map((x) => ({ ...x })),
    watchers: Object.fromEntries(
      Object.entries(value.watchers).map(([id, x]) => [id, { ...x }]),
    ),
    processedDeaths: { ...value.processedDeaths },
    resolvingBoardChange: false,
  };
}
const pulse = (ctx: FitnessContext) =>
  Math.floor(ctx.state.elapsedMs / FITNESS_PULSE_MS);
const stamp = (unit: Unit): FitnessSource => ({
  sourceUnitId: unit.id,
  sourceCardId: unit.cardId,
  sourceSide: unit.side,
  sourceLane: unit.lane,
  sourcePosition: unit.position,
});
const identity = (unit: Unit) => `${unit.side}:${unit.cardId}`;
const real = (ctx: FitnessContext, unit: Unit) =>
  !ctx.isToken?.(unit) &&
  (ctx.definition(unit).kind ?? 'character') === 'character';
const athletes = (ctx: FitnessContext, unit: Unit) =>
  real(ctx, unit) && !!ctx.definition(unit).traits?.includes('fitness');
const board = (ctx: FitnessContext) =>
  ctx.state.units.filter((u) => u.hands > 0 && real(ctx, u));
const activeSources = (
  ctx: FitnessContext,
  side: Side,
  ability: FitnessAbility,
) =>
  board(ctx)
    .filter(
      (u) =>
        u.side === side &&
        ctx.active(u) &&
        ctx.definition(u).ability === ability,
    )
    .sort((a, b) => a.id.localeCompare(b.id));
const localOther = (ctx: FitnessContext, source: Unit) =>
  board(ctx).filter(
    (u) =>
      u.side === source.side && u.lane === source.lane && u.id !== source.id,
  );
function low(ctx: FitnessContext, units: readonly Unit[]) {
  return [...units].sort(
    (a, b) =>
      ctx.effectiveHands(a) - ctx.effectiveHands(b) || a.id.localeCompare(b.id),
  )[0];
}
function high(ctx: FitnessContext, units: readonly Unit[]) {
  return [...units].sort(
    (a, b) =>
      ctx.effectiveHands(b) - ctx.effectiveHands(a) || a.id.localeCompare(b.id),
  )[0];
}
function laneScore(ctx: FitnessContext, side: Side, lane: Lane) {
  return board(ctx)
    .filter((u) => u.side === side && u.lane === lane)
    .reduce((n, u) => n + ctx.effectiveHands(u), 0);
}
const ahead = (ctx: FitnessContext, unit: Unit) =>
  laneScore(ctx, unit.side, unit.lane) >=
  laneScore(ctx, unit.side === 'player' ? 'opponent' : 'player', unit.lane);
function destinations(
  ctx: FitnessContext,
  unit: Unit,
  extra: (lane: Lane) => boolean = () => true,
) {
  return LANES.filter(
    (lane) => lane !== unit.lane && ctx.openForMove(unit, lane) && extra(lane),
  ).sort(
    (a, b) =>
      laneScore(ctx, unit.side, a) - laneScore(ctx, unit.side, b) || a - b,
  );
}
function effectSource(
  ctx: FitnessContext,
  source: Unit | FitnessSource,
): EffectSource | undefined {
  if ('id' in source) return source;
  const current = ctx.state.units.find(
    (unit) => unit.id === source.sourceUnitId,
  );
  if (current) return current;
  if (!source.sourceCardId) return undefined;
  return {
    id: source.sourceUnitId,
    cardId: source.sourceCardId,
    side: source.sourceSide,
    lane: source.sourceLane,
    position: source.sourcePosition,
  };
}
function attributed(
  ctx: FitnessContext,
  source: Unit | FitnessSource,
  effect: () => void,
) {
  const first = ctx.state.nextEventId;
  effect();
  const mark = 'id' in source ? stamp(source) : source;
  for (const event of ctx.state.events)
    if (event.id >= first && event.sourceUnitId === undefined)
      Object.assign(event, mark);
}
function give(
  ctx: FitnessContext,
  source: Unit | FitnessSource,
  target: Unit | undefined,
  amount: number,
) {
  if (target && target.hands > 0)
    attributed(ctx, source, () =>
      ctx.gain(target, amount, undefined, effectSource(ctx, source)),
    );
}
function cover(
  ctx: FitnessContext,
  source: Unit | FitnessSource,
  target: Unit | undefined,
) {
  if (target && target.hands > 0)
    attributed(ctx, source, () => ctx.protect(target));
}
function note(
  ctx: FitnessContext,
  source: Unit | FitnessSource,
  text: string,
  target?: Unit,
) {
  const mark = 'id' in source ? stamp(source) : source;
  ctx.event({
    type: 'fitness',
    side: target?.side ?? mark.sourceSide,
    lane: target?.lane ?? mark.sourceLane,
    position: target?.position ?? mark.sourcePosition,
    ...(target ? { targetUnitId: target.id, cardId: target.cardId } : {}),
    ...mark,
    text,
  });
}
function rememberRoute(ctx: FitnessContext, unit: Unit, oldLane?: Lane) {
  if (!athletes(ctx, unit)) return;
  const data = runtime(ctx);
  data.routes[unit.id] = [
    ...new Set([
      ...(data.routes[unit.id] ?? []),
      ...(oldLane === undefined ? [] : [oldLane]),
      unit.lane,
    ]),
  ];
}
/** Called once for a real paid deployment, never a summon, support or echoed reveal.
 * This records the paid lane before entrance movement changes the fighter's lane. */
export function fitnessPlayed(ctx: FitnessContext, unit: Unit): void {
  if (!real(ctx, unit) || unit.hands <= 0) return;
  const data = runtime(ctx),
    seat = data.seats[unit.side];
  rememberRoute(ctx, unit);
  if (
    activeSources(ctx, unit.side, 'one-more-rep').some(
      (bro) => bro.id !== unit.id && bro.lane !== unit.lane,
    )
  )
    seat.repReadyPulse = pulse(ctx);
}
/** Return undefined only for a card outside this reviewed family. */
export function fitnessEntrance(
  ctx: FitnessContext,
  unit: Unit,
): boolean | undefined {
  const ability = ctx.definition(unit).ability;
  if (!Object.hasOwn(FITNESS_ABILITY_DESCRIPTIONS, ability ?? ''))
    return undefined;
  const data = runtime(ctx),
    seat = data.seats[unit.side];
  rememberRoute(ctx, unit);
  if (!ctx.active(unit) || unit.hands <= 0) return false;
  const friendly = localOther(ctx, unit);
  switch (ability) {
    case 'first-lap': {
      const destination = destinations(ctx, unit)[0];
      return destination !== undefined && ctx.move(unit, destination);
    }
    case 'bag-check': {
      if (seat.bagPulse === pulse(ctx)) return false;
      const target = low(
        ctx,
        friendly.filter((u) => athletes(ctx, u)),
      );
      const destination = target && destinations(ctx, target)[0];
      if (
        !target ||
        destination === undefined ||
        !ctx.move(target, destination)
      )
        return false;
      seat.bagPulse = pulse(ctx);
      return true;
    }
    case 'take-the-stairs': {
      const visited = data.routes[unit.id] ?? [unit.lane];
      const destination = destinations(
        ctx,
        unit,
        (lane) => !visited.includes(lane),
      )[0];
      if (destination === undefined || !ctx.move(unit, destination))
        return false;
      if (!data.stairPayouts[unit.id]) {
        data.stairPayouts[unit.id] = true;
        give(ctx, unit, unit, 1);
      }
      return true;
    }
    case 'finish-the-circuit': {
      const fitness = board(ctx).filter(
        (u) => u.side === unit.side && athletes(ctx, u),
      );
      if (fitness.some((u) => (data.routes[u.id] ?? [u.lane]).length === 3)) {
        if (seat.finishUsed) return false;
        seat.finishUsed = true;
        for (const lane of LANES)
          give(
            ctx,
            unit,
            low(
              ctx,
              fitness.filter((u) => u.lane === lane),
            ),
            2,
          );
        return true;
      }
      const target = low(
        ctx,
        friendly.filter((u) => athletes(ctx, u)),
      );
      cover(ctx, unit, target);
      return !!target;
    }
    case 'i-got-you': {
      const target = low(
        ctx,
        friendly.filter((u) => athletes(ctx, u)),
      );
      if (!target) return false;
      give(ctx, unit, target, 1);
      cover(ctx, unit, target);
      data.wards = data.wards.filter((x) => x.targetId !== target.id);
      data.wards.push({
        ...stamp(unit),
        targetId: target.id,
        expiresAt: (pulse(ctx) + 2) * FITNESS_PULSE_MS,
      });
      return true;
    }
    case 'no-equipment-needed': {
      if (seat.ogEntranceUsed) return false;
      const fitness = board(ctx).filter(
        (u) => u.side === unit.side && athletes(ctx, u),
      );
      if (LANES.every((lane) => fitness.some((u) => u.lane === lane))) {
        seat.ogEntranceUsed = true;
        for (const lane of LANES)
          give(
            ctx,
            unit,
            low(
              ctx,
              fitness.filter((u) => u.lane === lane),
            ),
            3,
          );
        return true;
      }
      const target = low(
        ctx,
        friendly.filter((u) => athletes(ctx, u)),
      );
      if (!target) return false;
      seat.ogEntranceUsed = true;
      give(ctx, unit, target, 3);
      cover(ctx, unit, target);
      return true;
    }
    case 'hop-on': {
      const passenger = low(ctx, friendly);
      const destination =
        passenger &&
        destinations(ctx, unit, (lane) => ctx.openForMove(passenger, lane))[0];
      if (!passenger || destination === undefined) return false;
      // Preflight both entrances before moving either; friendly populations are unlimited.
      if (!ctx.move(unit, destination)) return false;
      if (
        passenger.hands <= 0 ||
        (passenger.lane !== destination && !ctx.move(passenger, destination))
      )
        return true;
      give(ctx, unit, passenger, 1);
      cover(ctx, unit, passenger);
      return true;
    }
    case 'key-for-that': {
      const target = low(ctx, friendly);
      if (!target) return false;
      attributed(ctx, unit, () => {
        ctx.cleanse(target, undefined, unit);
        ctx.clearMovementRestriction(target);
      });
      const destination = destinations(ctx, target)[0];
      if (destination !== undefined && ctx.move(target, destination))
        cover(ctx, unit, target);
      return true;
    }
    case 'lash-out': {
      const enemy = high(
        ctx,
        board(ctx).filter((u) => u.side !== unit.side && u.lane === unit.lane),
      );
      if (!enemy || ctx.strike(unit, enemy, 1) <= 0) return false;
      give(ctx, unit, low(ctx, friendly), 2);
      return true;
    }
    case 'active-recovery': {
      const destination = destinations(ctx, unit)[0];
      if (destination === undefined || !ctx.move(unit, destination))
        return false;
      const local = localOther(ctx, unit);
      for (const athlete of [unit, ...local].filter(
        (u) => athletes(ctx, u) && (u.burnStacks ?? 0) > 0,
      ))
        attributed(ctx, unit, () => ctx.cleanse(athlete, ['burn'], unit));
      const injured = low(
        ctx,
        local.filter((u) => (u.damageTaken ?? 0) > 0 && u.hands < u.maxHands),
      );
      const burning = low(
        ctx,
        local.filter((u) => (u.burnStacks ?? 0) > 0),
      );
      const target = injured ?? burning;
      if (target)
        attributed(ctx, unit, () => {
          ctx.heal(target, 3, unit);
          ctx.cleanse(target, ['burn'], unit);
        });
      else give(ctx, unit, low(ctx, local), 1);
      return true;
    }
    case 'circuit-training': {
      if (
        seat.circuit &&
        seat.circuit.expiresAt > ctx.state.elapsedMs &&
        board(ctx).some((u) => u.id === seat.circuit!.targetId)
      )
        return false;
      const target = low(
        ctx,
        friendly.filter((u) => !seat.trainedCards[identity(u)]),
      );
      if (!target) return false;
      seat.trainedCards[identity(target)] = true;
      seat.circuit = {
        ...stamp(unit),
        targetId: target.id,
        origin: target.lane,
        visited: [target.lane],
        expiresAt: (pulse(ctx) + 3) * FITNESS_PULSE_MS,
      };
      note(ctx, unit, 'CIRCUIT TRAINING', target);
      return true;
    }
    case 'one-last-shot':
      data.watchers[unit.id] = {
        ahead: ahead(ctx, unit),
        losingStart: !ahead(ctx, unit),
      };
      return false;
    case 'next-up': {
      if (!ahead(ctx, unit)) {
        give(ctx, unit, unit, 2);
        const enemy = high(
          ctx,
          board(ctx).filter(
            (u) => u.side !== unit.side && u.lane === unit.lane,
          ),
        );
        if (enemy) ctx.strike(unit, enemy, 1);
        return true;
      }
      if (seat.sportsArmedCards[identity(unit)]) return false;
      seat.sportsArmedCards[identity(unit)] = true;
      data.watchers[unit.id] = {
        ahead: true,
        losingStart: false,
        expiresAt: (pulse(ctx) + 2) * FITNESS_PULSE_MS,
      };
      return true;
    }
    // Ongoing-only bodies have no invented entrance result.
    case 'bodyweight':
    case 'double-dutch':
    case 'one-more-rep':
    case 'no-days-off':
      return false;
  }
  return false;
}
/** Invoke once for an actual lateral lane change, including non-Fitness movers.
 * The old lane is mandatory; repeated notifications for the same lane are ignored. */
export function fitnessMoved(
  ctx: FitnessContext,
  unit: Unit,
  oldLane: Lane,
): void {
  if (oldLane === unit.lane || unit.hands <= 0 || !real(ctx, unit)) return;
  const data = runtime(ctx),
    seat = data.seats[unit.side],
    nowPulse = pulse(ctx);
  rememberRoute(ctx, unit, oldLane);
  for (const ward of data.wards.filter((x) => x.targetId === unit.id)) {
    data.wards = data.wards.filter((x) => x !== ward);
    if (ward.expiresAt > ctx.state.elapsedMs) give(ctx, ward, unit, 1);
  }
  const circuit = seat.circuit;
  if (
    circuit &&
    circuit.targetId === unit.id &&
    circuit.expiresAt > ctx.state.elapsedMs &&
    !circuit.visited.includes(unit.lane)
  ) {
    const trainer = board(ctx).find((u) => u.id === circuit.sourceUnitId);
    if (trainer && ctx.active(trainer)) {
      circuit.visited.push(unit.lane);
      give(ctx, trainer, unit, 3);
      if (circuit.visited.length === 3) {
        delete seat.circuit;
        cover(ctx, trainer, unit);
      }
    }
  }
  if (!athletes(ctx, unit)) return;
  const heldCoach = ctx.state.players[unit.side].hand
    .map((id) => ctx.state.roster.find((c) => c.id === id))
    .find((c) => c?.ability === 'no-equipment-needed');
  if (heldCoach && seat.heldPulse !== nowPulse && seat.heldPayouts < 2) {
    seat.heldPulse = nowPulse;
    seat.heldPayouts++;
    give(
      ctx,
      {
        sourceUnitId: `hand:${unit.side}:${heldCoach.id}`,
        sourceCardId: heldCoach.id,
        sourceSide: unit.side,
        sourceLane: unit.lane,
        sourcePosition: unit.side === 'player' ? 0 : 1,
      },
      unit,
      1,
    );
  }
  if (ctx.definition(unit).ability === 'bodyweight' && ctx.active(unit)) {
    const paid = (data.bodyweight[unit.id] ??= { pulse: -1, payouts: 0 });
    if (paid.pulse !== nowPulse && paid.payouts < 2) {
      paid.pulse = nowPulse;
      paid.payouts++;
      give(ctx, unit, unit, 2);
    }
  }
  if (seat.moverPulse !== nowPulse) {
    seat.moverPulse = nowPulse;
    seat.movers = [];
  }
  if (seat.movers.includes(unit.id)) return;
  seat.movers.push(unit.id);
  const rope = activeSources(ctx, unit.side, 'double-dutch')[0];
  if (!rope) return;
  if (seat.movers.length === 1 && seat.ropeFirstPayouts < 2) {
    seat.ropeFirstPayouts++;
    give(ctx, rope, rope, 2);
  } else if (seat.movers.length === 2 && seat.ropeSecondPayouts < 2) {
    seat.ropeSecondPayouts++;
    give(ctx, rope, rope, 1);
  }
}
export type FitnessBoardSnapshot = Record<
  string,
  { ahead: boolean; lane: Lane }
>;
/** Capture before inserting or moving an entrant. Intermediate effects may change
 * scores, so a later arrival must not compare against an already-mutated cache. */
export function captureFitnessBoard(ctx: FitnessContext): FitnessBoardSnapshot {
  return Object.fromEntries(
    board(ctx)
      .filter((u) =>
        ['one-last-shot', 'next-up'].includes(ctx.definition(u).ability ?? ''),
      )
      .map((u) => [u.id, { ahead: ahead(ctx, u), lane: u.lane }]),
  );
}

/** Observe score changes after each rules mutation and each completed entrance.
 * Pass an arrival only for a real deployment or successful movement arrival.
 * Call this even when no Fitness card is currently active, so disabled watchers
 * cannot retroactively claim a transition that happened while disabled. */
export function fitnessAfterBoardChange(
  ctx: FitnessContext,
  arrival?: Unit,
  beforeArrival?: FitnessBoardSnapshot,
): void {
  const data = runtime(ctx);
  if (data.resolvingBoardChange) return;
  data.resolvingBoardChange = true;
  try {
    for (const watcher of board(ctx)
      .filter((u) =>
        ['one-last-shot', 'next-up'].includes(ctx.definition(u).ability ?? ''),
      )
      .sort((a, b) => a.id.localeCompare(b.id))) {
      const old = data.watchers[watcher.id];
      if (!old) continue;
      const isAhead = ahead(ctx, watcher),
        previousAhead = old.ahead;
      old.ahead = isAhead;
      if (!ctx.active(watcher)) continue;
      const seat = data.seats[watcher.side],
        key = identity(watcher);
      const enemyArrival =
        arrival &&
        real(ctx, arrival) &&
        (!beforeArrival || beforeArrival[watcher.id]?.lane === watcher.lane) &&
        arrival.id !== watcher.id &&
        arrival.side !== watcher.side &&
        arrival.lane === watcher.lane;
      if (ctx.definition(watcher).ability === 'one-last-shot') {
        if (
          !seat.comebackCards[key] &&
          !isAhead &&
          (previousAhead || (old.losingStart && enemyArrival))
        ) {
          seat.comebackCards[key] = true;
          give(ctx, watcher, watcher, 4);
          cover(ctx, watcher, watcher);
          note(ctx, watcher, 'ONE LAST SHOT', watcher);
          old.ahead = ahead(ctx, watcher);
        }
      } else if (
        old.expiresAt !== undefined &&
        old.expiresAt > ctx.state.elapsedMs &&
        (beforeArrival?.[watcher.id]?.ahead ?? previousAhead) &&
        !isAhead &&
        enemyArrival
      ) {
        delete data.watchers[watcher.id];
        give(ctx, watcher, watcher, 2);
        const target = high(
          ctx,
          board(ctx).filter(
            (u) => u.side !== watcher.side && u.lane === watcher.lane,
          ),
        );
        if (target) ctx.strike(watcher, target, 1);
        note(ctx, watcher, 'NEXT UP', watcher);
      }
    }
  } finally {
    data.resolvingBoardChange = false;
  }
}
/** Call for actual enemy damage before removing a defeated fighter. The victim
 * still carries its card identity/lane, but its resolved Hands must be zero. */
export function fitnessEnemyDamage(
  ctx: FitnessContext,
  sourceSide: Side,
  victim: Unit,
  actualDamage: number,
): void {
  if (
    sourceSide === victim.side ||
    actualDamage <= 0 ||
    victim.hands > 0 ||
    !athletes(ctx, victim)
  )
    return;
  const data = runtime(ctx),
    seat = data.seats[victim.side];
  if (data.processedDeaths[victim.id]) return;
  data.processedDeaths[victim.id] = true;
  if (seat.demonPayouts >= 2 || seat.demonPulse === pulse(ctx)) return;
  const demon = activeSources(ctx, victim.side, 'no-days-off').find(
    (u) => u.id !== victim.id,
  );
  if (!demon) return;
  seat.demonPulse = pulse(ctx);
  seat.demonPayouts++;
  give(ctx, demon, demon, 2);
  const enemy = high(
    ctx,
    board(ctx).filter((u) => u.side !== victim.side && u.lane === victim.lane),
  );
  if (enemy) ctx.strike(demon, enemy, 1);
  note(ctx, demon, 'NO DAYS OFF', demon);
}
/** Invoke after authoritative elapsedMs advances, before evaluating match end. */
export function fitnessPulse(ctx: FitnessContext): void {
  const data = runtime(ctx),
    now = pulse(ctx);
  while (data.lastPulse < now) {
    const completed = data.lastPulse++;
    for (const side of SIDES) {
      const seat = data.seats[side];
      if (seat.reps < 3 && seat.repReadyPulse === completed) {
        const bro = activeSources(ctx, side, 'one-more-rep')[0];
        if (bro) {
          seat.reps++;
          give(ctx, bro, bro, 3);
          if (seat.reps === 3) cover(ctx, bro, bro);
          note(ctx, bro, `ONE MORE REP ${seat.reps}/3`, bro);
        }
      }
    }
  }
  const present = new Set(board(ctx).map((u) => u.id));
  data.wards = data.wards.filter(
    (x) => x.expiresAt > ctx.state.elapsedMs && present.has(x.targetId),
  );
  for (const side of SIDES) {
    const seat = data.seats[side];
    if (
      seat.circuit &&
      (seat.circuit.expiresAt <= ctx.state.elapsedMs ||
        !present.has(seat.circuit.targetId))
    )
      delete seat.circuit;
  }
  for (const [id, watcher] of Object.entries(data.watchers))
    if (
      !present.has(id) ||
      (watcher.expiresAt !== undefined &&
        watcher.expiresAt <= ctx.state.elapsedMs)
    )
      delete data.watchers[id];
}
