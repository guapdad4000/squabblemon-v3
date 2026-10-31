/** Reviewed Network/Electric adaptations. Round references use fixed 10-second
 * engine pulses; no animation, frame rate or wall clock participates in rules. */
import type {
  BattleEvent,
  FighterDefinition,
  GameState,
  Lane,
  Side,
  Unit,
} from './breakthrough';
type EffectSource = Pick<Unit, 'id' | 'cardId' | 'side' | 'lane' | 'position'>;

export const NETWORK_PULSE_MS = 10000;
export const NETWORK_ABILITY_DESCRIPTIONS = {
  'follower-frenzy':
    'Deploy: reset your shared Follower counter. For the next 10 seconds, your next two characters costing 2 or less gain +1 while an active Live Streamer remains on board. New Streamers reset rather than stack the counter.',
  'city-tour':
    'Deploy: the lowest-Hands ally in each other lane gains +2. While active, once per 10-second pulse, newly Silencing or Weakening an enemy gives your lowest-Hands Dark fighter +2. While held, your Dark fighters gain +1 at each 10-second pulse.',
  'compound-interest':
    'While active on board, gain +1 whenever you play another character in any lane. Earned Hands remain after the trigger; actions and movements do not compound.',
  'network-boost':
    'While active, your first two later cards played into other lanes each give this fighter +1. The second arms one discount: your next card with printed cost 4 or more costs 1 less Motion.',
  'burn-rate':
    'Deploy once per side per match: borrow up to 1 Motion, up to 9. At the next 10-second pulse, repay from available Motion; any remainder absorbs future natural Motion refill. Recycling never resets the loan.',
  'flip-season':
    'Deploy: find the highest-Hands enemy across the board, gain its printed Hands up to +3, then attempt to Weaken it for 10 seconds. Protection and immunity still block Weaken.',
  'works-on-my-machine':
    'Deploy: the lowest-Hands ally in another lane with a negative non-damage Hands modifier gains +1 and restores 1 Motion, up to 9. Ordinary damage alone does not qualify.',
  'everybody-on-the-clock':
    'Deploy: post one shared pair of jobs until the second following 10-second pulse. Your next two different other Electric fighters played or moved each gain +1; filling both jobs restores 1 Motion. Reposting replaces the unfinished pair.',
  'actually-it-charges-free':
    'Deploy: your next card played into a different lane costs 1 less Motion. It persists until used; only one eligible next-card discount is spent per play.',
  'switch-carriers':
    'Deploy: move to your weakest other legal lane. If the move succeeds, gain +1 and arm a 1-Motion discount for your next card in a different lane from that destination. If that discounted card is a character, it also gains +1.',
} as const;

export const NETWORK_ADAPTERS = {
  'live-streamer': {
    ability: 'follower-frenzy',
    triggers: ['entrance', 'ongoing'],
    tacticalRoles: ['support'],
  },
  gamer: {
    ability: 'city-tour',
    triggers: ['entrance', 'ongoing', 'held'],
    tacticalRoles: ['support', 'control'],
  },
  stockz: {
    ability: 'compound-interest',
    triggers: ['ongoing'],
    tacticalRoles: [],
  },
  'boss-babe': {
    ability: 'network-boost',
    triggers: ['ongoing'],
    tacticalRoles: ['support'],
  },
  'techbro-rich': {
    ability: 'burn-rate',
    triggers: ['entrance'],
    tacticalRoles: ['support'],
  },
  'sneaker-reseller': {
    ability: 'flip-season',
    triggers: ['entrance'],
    tacticalRoles: ['control'],
  },
  'battery-back': {
    ability: 'works-on-my-machine',
    triggers: ['entrance'],
    tacticalRoles: ['support'],
  },
  'circuit-captain': {
    ability: 'everybody-on-the-clock',
    triggers: ['entrance'],
    tacticalRoles: ['support'],
  },
  wiretap: {
    ability: 'actually-it-charges-free',
    triggers: ['entrance'],
    tacticalRoles: ['support'],
  },
  livewire: {
    ability: 'switch-carriers',
    triggers: ['entrance'],
    tacticalRoles: ['support'],
  },
} as const;

type NetworkAbility = keyof typeof NETWORK_ABILITY_DESCRIPTIONS;
type NetworkCard = Pick<
  FighterDefinition,
  'id' | 'cost' | 'hands' | 'kind' | 'element'
> & {
  ability?: string;
};
export interface NetworkDiscount {
  id: number;
  kind: 'four-plus' | 'other-lane' | 'livewire';
  origin?: Lane;
  sourceUnitId: string;
  sourceSide: Side;
  sourceLane: Lane;
  sourcePosition: number;
}
interface NetworkSeatState {
  followers?: { remaining: number; expiresAt: number };
  bossCounts: Record<string, number>;
  gamerPulses: Record<string, number>;
  discounts: NetworkDiscount[];
  loanUsed: boolean;
  loan?: {
    amount: number;
    dueAt: number;
    sourceUnitId: string;
    sourceLane: Lane;
    sourcePosition: number;
  };
  debt: number;
  jobs?: {
    sourceCardId: string;
    sourceUnitId: string;
    sourceLane: Lane;
    sourcePosition: number;
    expiresAt: number;
    workers: string[];
  };
}
export interface NetworkMatchState {
  seats: Record<Side, NetworkSeatState>;
  lastPulse: number;
  nextDiscountId: number;
}
export interface NetworkContext {
  state: GameState & { network?: NetworkMatchState };
  definition(unit: Unit): NetworkCard;
  active(unit: Unit): boolean;
  power(unit: Unit): number;
  gain(
    unit: Unit,
    amount: number,
    copied?: boolean,
    source?: EffectSource,
  ): void;
  refund(side: Side, amount: number, source: EffectSource): number;
  /** Must pass through normal immunity/Protection/Side Eye and status reactions. */
  weaken(source: Unit, target: Unit): boolean;
  move(unit: Unit, lane: Lane): boolean;
  openForMove(unit: Unit, lane: Lane): boolean;
  event(event: Omit<BattleEvent, 'id'>): void;
}
const board = (ctx: NetworkContext) =>
  ctx.state.units.filter(
    (unit) => (unit as Unit & { canFight?: boolean }).canFight !== false,
  );
const SIDES: Side[] = ['player', 'opponent'];
const LANES: Lane[] = [0, 1, 2];
const byLowest = (ctx: NetworkContext) => (a: Unit, b: Unit) =>
  ctx.power(a) - ctx.power(b) || a.id.localeCompare(b.id);
const byHighest = (ctx: NetworkContext) => (a: Unit, b: Unit) =>
  ctx.power(b) - ctx.power(a) || a.id.localeCompare(b.id);
const freshSeat = (): NetworkSeatState => ({
  bossCounts: {},
  gamerPulses: {},
  discounts: [],
  loanUsed: false,
  debt: 0,
});
function runtime(ctx: NetworkContext): NetworkMatchState {
  return (ctx.state.network ??= {
    seats: { player: freshSeat(), opponent: freshSeat() },
    lastPulse: Math.floor(ctx.state.elapsedMs / NETWORK_PULSE_MS),
    nextDiscountId: 1,
  });
}
export function cloneNetworkState(
  network: NetworkMatchState | undefined,
): NetworkMatchState | undefined {
  if (!network) return undefined;
  return {
    ...network,
    seats: Object.fromEntries(
      SIDES.map((side) => {
        const seat = network.seats[side];
        return [
          side,
          {
            ...seat,
            bossCounts: { ...seat.bossCounts },
            gamerPulses: { ...seat.gamerPulses },
            discounts: seat.discounts.map((discount) => ({ ...discount })),
            ...(seat.followers ? { followers: { ...seat.followers } } : {}),
            ...(seat.loan ? { loan: { ...seat.loan } } : {}),
            ...(seat.jobs
              ? { jobs: { ...seat.jobs, workers: [...seat.jobs.workers] } }
              : {}),
          },
        ];
      }),
    ) as Record<Side, NetworkSeatState>,
  };
}
function provenance(unit: EffectSource) {
  return {
    sourceUnitId: unit.id,
    sourceSide: unit.side,
    sourceLane: unit.lane,
    sourcePosition: unit.position,
  };
}
function taggedGain(
  ctx: NetworkContext,
  source: Unit,
  target: Unit,
  amount: number,
  text: string,
) {
  if (target.hands <= 0 || amount <= 0) return;
  const first = ctx.state.nextEventId;
  ctx.gain(target, amount, undefined, source);
  for (const event of ctx.state.events)
    if (
      event.id >= first &&
      (event.sourceUnitId === undefined ||
        (event.type === 'buff' &&
          event.targetUnitId === target.id &&
          event.sourceUnitId === source.id))
    )
      Object.assign(event, provenance(source), {
        targetUnitId: target.id,
        cardId: target.cardId,
        text,
      });
}
function motion(
  ctx: NetworkContext,
  side: Side,
  amount: number,
  source: EffectSource,
  text: string,
  kind: 'refund' | 'income' = 'refund',
): number {
  const first = ctx.state.nextEventId;
  if (kind === 'refund') {
    const actual = ctx.refund(side, amount, source);
    for (const event of ctx.state.events)
      if (
        event.id >= first &&
        event.type === 'motion' &&
        event.sourceUnitId === source.id
      )
        event.text = text;
    return actual;
  }
  const player = ctx.state.players[side];
  const actual = Math.min(Math.max(0, amount), Math.max(0, 9 - player.motion));
  if (actual <= 0) return 0;
  player.motion = Math.round((player.motion + actual) * 1000) / 1000;
  ctx.event({
    type: 'motion',
    side,
    lane: source.lane,
    position: source.position,
    amount: actual,
    ...provenance(source),
    text,
  });
  return actual;
}

function issueDiscount(
  ctx: NetworkContext,
  source: Unit,
  kind: NetworkDiscount['kind'],
) {
  const state = runtime(ctx),
    seat = state.seats[source.side];
  // Next-card contracts of the same authored kind replace rather than multiply.
  seat.discounts = seat.discounts.filter((discount) => discount.kind !== kind);
  seat.discounts.push({
    id: state.nextDiscountId++,
    kind,
    ...(kind === 'four-plus' ? {} : { origin: source.lane }),
    ...provenance(source),
  });
  ctx.event({
    type: 'discount',
    side: source.side,
    lane: source.lane,
    position: source.position,
    ...provenance(source),
    text: 'NEXT CARD −1 MOTION',
  });
}
/** Pure quote: callers validate the whole command before consuming this token. */
export function networkDiscount(
  ctx: NetworkContext,
  side: Side,
  card: NetworkCard,
  paidLane: Lane,
): NetworkDiscount | undefined {
  return ctx.state.network?.seats[side].discounts.find((discount) =>
    discount.kind === 'four-plus'
      ? card.cost >= 4
      : discount.origin !== paidLane,
  );
}
/** Consume precisely the previously quoted ID only after successful validation.
 * Returns the Livewire character bonus, which the caller applies to that entrant. */
export function networkSpendDiscount(
  ctx: NetworkContext,
  side: Side,
  id: number,
  card: NetworkCard,
  paidLane: Lane,
): number {
  const seat = ctx.state.network?.seats[side];
  const quote = networkDiscount(ctx, side, card, paidLane);
  if (!seat || quote?.id !== id) return 0;
  seat.discounts = seat.discounts.filter((discount) => discount.id !== id);
  return quote.kind === 'livewire' && (card.kind ?? 'character') === 'character'
    ? 1
    : 0;
}
function fillJob(ctx: NetworkContext, unit: Unit) {
  if ((unit as Unit & { canFight?: boolean }).canFight === false) return;
  const seat = ctx.state.network?.seats[unit.side],
    job = seat?.jobs;
  if (
    !job ||
    ctx.state.elapsedMs >= job.expiresAt ||
    unit.id === job.sourceUnitId ||
    unit.hands <= 0 ||
    ctx.definition(unit).element !== 'Electric' ||
    job.workers.includes(unit.id)
  )
    return;
  job.workers.push(unit.id);
  const source = board(ctx).find(
    (candidate) => candidate.id === job.sourceUnitId,
  );
  if (source) taggedGain(ctx, source, unit, 1, 'ON THE CLOCK +1');
  else {
    const first = ctx.state.nextEventId;
    const helper: EffectSource | undefined = job.sourceCardId
      ? {
          id: job.sourceUnitId,
          cardId: job.sourceCardId,
          side: unit.side,
          lane: job.sourceLane,
          position: job.sourcePosition,
        }
      : undefined;
    ctx.gain(unit, 1, undefined, helper);
    for (const event of ctx.state.events)
      if (
        event.id >= first &&
        (event.sourceUnitId === undefined ||
          (event.type === 'buff' &&
            event.targetUnitId === unit.id &&
            event.sourceUnitId === job.sourceUnitId))
      )
        Object.assign(event, {
          sourceUnitId: job.sourceUnitId,
          sourceSide: unit.side,
          sourceLane: job.sourceLane,
          sourcePosition: job.sourcePosition,
          targetUnitId: unit.id,
          cardId: unit.cardId,
          text: 'ON THE CLOCK +1',
        });
  }
  if (job.workers.length === 2) {
    delete seat!.jobs;
    motion(
      ctx,
      unit.side,
      1,
      {
        id: job.sourceUnitId,
        cardId: job.sourceCardId,
        side: unit.side,
        lane: job.sourceLane,
        position: job.sourcePosition,
      },
      'JOBS COMPLETE +1 MOTION',
    );
  }
}
/** Paid plays only. Run before the entrant's own reveal; movement never calls it. */
export function networkPlayed(
  ctx: NetworkContext,
  side: Side,
  card: NetworkCard,
  paidLane: Lane,
  entrant?: Unit,
): void {
  const state = runtime(ctx),
    seat = state.seats[side];
  const watchers = board(ctx)
    .filter(
      (unit) =>
        unit.side === side && unit.id !== entrant?.id && ctx.active(unit),
    )
    .sort((a, b) => a.id.localeCompare(b.id));
  if (entrant && (card.kind ?? 'character') === 'character') {
    for (const watcher of watchers)
      if (ctx.definition(watcher).ability === 'compound-interest')
        taggedGain(ctx, watcher, watcher, 1, 'COMPOUND +1');
    const streamer = watchers.find(
      (unit) => ctx.definition(unit).ability === 'follower-frenzy',
    );
    if (
      streamer &&
      card.cost <= 2 &&
      seat.followers &&
      seat.followers.remaining > 0 &&
      ctx.state.elapsedMs < seat.followers.expiresAt
    ) {
      seat.followers.remaining--;
      taggedGain(ctx, streamer, entrant, 1, 'FOLLOWERS +1');
    }
    fillJob(ctx, entrant);
  }
  for (const boss of watchers) {
    if (
      ctx.definition(boss).ability !== 'network-boost' ||
      boss.lane === paidLane
    )
      continue;
    const used = seat.bossCounts[boss.id] ?? 0;
    if (used >= 2) continue;
    seat.bossCounts[boss.id] = used + 1;
    taggedGain(ctx, boss, boss, 1, 'NETWORK +1');
    if (used === 1) issueDiscount(ctx, boss, 'four-plus');
  }
}
export function networkMoved(ctx: NetworkContext, unit: Unit): void {
  fillJob(ctx, unit);
}
/** Only a genuinely new hostile Silence/Weaken counts, not extension or blocked input. */
export function networkInterrupted(
  ctx: NetworkContext,
  actor: Unit,
  target: Unit,
  kind: 'silence' | 'weaken',
  newlyApplied: boolean,
): void {
  if (
    !newlyApplied ||
    actor.side === target.side ||
    !['silence', 'weaken'].includes(kind)
  )
    return;
  const seat = runtime(ctx).seats[actor.side],
    pulse = Math.floor(ctx.state.elapsedMs / NETWORK_PULSE_MS);
  const gamers = board(ctx)
    .filter(
      (unit) =>
        unit.side === actor.side &&
        ctx.active(unit) &&
        ctx.definition(unit).ability === 'city-tour',
    )
    .sort((a, b) => a.id.localeCompare(b.id));
  for (const gamer of gamers) {
    if (seat.gamerPulses[gamer.id] === pulse) continue;
    const ally = board(ctx)
      .filter(
        (unit) =>
          unit.side === actor.side &&
          unit.hands > 0 &&
          ctx.definition(unit).element === 'Dark',
      )
      .sort(byLowest(ctx))[0];
    if (!ally) continue;
    seat.gamerPulses[gamer.id] = pulse;
    taggedGain(ctx, gamer, ally, 2, 'CITY TOUR +2');
  }
}
export function networkEntrance(ctx: NetworkContext, unit: Unit): void {
  if (!ctx.active(unit)) return;
  const ability = ctx.definition(unit).ability as NetworkAbility | undefined;
  const seat = runtime(ctx).seats[unit.side];
  const allies = board(ctx).filter(
    (target) =>
      target.side === unit.side && target.id !== unit.id && target.hands > 0,
  );
  if (ability === 'follower-frenzy')
    seat.followers = {
      remaining: 2,
      expiresAt: ctx.state.elapsedMs + NETWORK_PULSE_MS,
    };
  else if (ability === 'city-tour') {
    for (const lane of LANES.filter((lane) => lane !== unit.lane)) {
      const target = allies
        .filter((ally) => ally.lane === lane)
        .sort(byLowest(ctx))[0];
      if (target) taggedGain(ctx, unit, target, 2, 'CITY TOUR +2');
    }
  } else if (ability === 'burn-rate' && !seat.loanUsed) {
    seat.loanUsed = true;
    const amount = motion(
      ctx,
      unit.side,
      1,
      unit,
      'BORROWED +1 MOTION',
      'income',
    );
    if (amount > 0)
      seat.loan = {
        amount,
        dueAt:
          (Math.floor(ctx.state.elapsedMs / NETWORK_PULSE_MS) + 1) *
          NETWORK_PULSE_MS,
        sourceUnitId: unit.id,
        sourceLane: unit.lane,
        sourcePosition: unit.position,
      };
  } else if (ability === 'flip-season') {
    const target = board(ctx)
      .filter((enemy) => enemy.side !== unit.side && enemy.hands > 0)
      .sort(byHighest(ctx))[0];
    if (target) {
      taggedGain(
        ctx,
        unit,
        unit,
        Math.max(0, Math.min(3, ctx.definition(target).hands)),
        'FLIP SEASON',
      );
      ctx.weaken(unit, target);
    }
  } else if (ability === 'works-on-my-machine') {
    const target = allies
      .filter(
        (ally) =>
          ally.lane !== unit.lane &&
          ally.maxHands < ally.baseHands * (ally.squabbled ? 2 : 1),
      )
      .sort(byLowest(ctx))[0];
    if (target) {
      taggedGain(ctx, unit, target, 1, 'REPAIRED +1');
      motion(ctx, unit.side, 1, unit, 'REPAIRED +1 MOTION');
    }
  } else if (ability === 'everybody-on-the-clock') {
    seat.jobs = {
      sourceCardId: unit.cardId,
      sourceUnitId: unit.id,
      sourceLane: unit.lane,
      sourcePosition: unit.position,
      expiresAt:
        (Math.floor(ctx.state.elapsedMs / NETWORK_PULSE_MS) + 2) *
        NETWORK_PULSE_MS,
      workers: [],
    };
  } else if (ability === 'actually-it-charges-free')
    issueDiscount(ctx, unit, 'other-lane');
  else if (ability === 'switch-carriers') {
    const power = (lane: Lane) =>
      allies
        .filter((ally) => ally.lane === lane)
        .reduce((sum, ally) => sum + (ally.frozen ? 0 : ally.hands), 0);
    const destination = LANES.filter((lane) =>
      ctx.openForMove(unit, lane),
    ).sort((a, b) => power(a) - power(b) || a - b)[0];
    if (destination !== undefined && ctx.move(unit, destination)) {
      taggedGain(ctx, unit, unit, 1, 'SWITCH CARRIERS +1');
      issueDiscount(ctx, unit, 'livewire');
    }
  }
}
/** Debt consumes only natural refill, never support refunds or a player's inputs. */
export function networkRefill(
  ctx: NetworkContext,
  side: Side,
  amount: number,
): number {
  if (amount <= 0) return 0;
  const seat = ctx.state.network?.seats[side];
  if (!seat || seat.debt <= 0) return amount;
  const repaid = Math.min(amount, seat.debt);
  seat.debt = Math.round((seat.debt - repaid) * 1000) / 1000;
  return Math.round((amount - repaid) * 1000) / 1000;
}
/** Call every engine tick, including Last Stand. Held-card auras are board effects,
 * not draws, and therefore remain active after the draw cutoff. */
export function networkTick(ctx: NetworkContext): void {
  const state = runtime(ctx),
    pulse = Math.floor(ctx.state.elapsedMs / NETWORK_PULSE_MS);
  for (const side of SIDES) {
    const seat = state.seats[side];
    if (seat.followers && ctx.state.elapsedMs >= seat.followers.expiresAt)
      delete seat.followers;
    if (seat.jobs && ctx.state.elapsedMs >= seat.jobs.expiresAt)
      delete seat.jobs;
    if (seat.loan && ctx.state.elapsedMs >= seat.loan.dueAt) {
      const loan = seat.loan,
        player = ctx.state.players[side],
        paid = Math.min(player.motion, loan.amount);
      player.motion = Math.round((player.motion - paid) * 1000) / 1000;
      seat.debt = Math.round((seat.debt + loan.amount - paid) * 1000) / 1000;
      delete seat.loan;
      ctx.event({
        type: 'motion',
        side,
        lane: loan.sourceLane,
        position: loan.sourcePosition,
        amount: -paid,
        sourceSide: side,
        sourceUnitId: loan.sourceUnitId,
        sourceLane: loan.sourceLane,
        sourcePosition: loan.sourcePosition,
        text: 'BURN RATE · REPAYMENT',
      });
    }
  }
  if (pulse <= state.lastPulse) return;
  state.lastPulse = pulse;
  for (const side of SIDES) {
    const ids = [...new Set(ctx.state.players[side].hand)].sort();
    for (const id of ids) {
      const held = ctx.state.roster.find((card) => card.id === id);
      if (held?.ability !== 'city-tour') continue;
      for (const target of board(ctx)
        .filter(
          (unit) =>
            unit.side === side &&
            unit.hands > 0 &&
            ctx.definition(unit).element === 'Dark',
        )
        .sort(byLowest(ctx))) {
        const first = ctx.state.nextEventId;
        const helper: EffectSource = {
          id: `hand:${side}:${id}`,
          cardId: id,
          side,
          lane: target.lane,
          position: side === 'player' ? 0 : 1,
        };
        ctx.gain(target, 1, undefined, helper);
        for (const event of ctx.state.events)
          if (
            event.id >= first &&
            (event.sourceUnitId === undefined ||
              (event.type === 'buff' &&
                event.targetUnitId === target.id &&
                event.sourceUnitId === helper.id))
          )
            Object.assign(event, {
              sourceUnitId: helper.id,
              sourceSide: side,
              sourceLane: target.lane,
              sourcePosition: side === 'player' ? 0 : 1,
              targetUnitId: target.id,
              cardId: target.cardId,
              text: 'GAMER +1',
            });
      }
    }
  }
}
