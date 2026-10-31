/** Explicit reaction/held-card contracts. Every trigger receives resolved facts;
 * previews, attempted hits, animations and wall-clock timing cannot earn payouts. */
import type {
  BattleEvent,
  FighterDefinition,
  GameState,
  Lane,
  Side,
  TimedStatus,
  Unit,
} from './breakthrough';
export const REACTION_PULSE_MS = 10000;
export const REACTION_ABILITY_DESCRIPTIONS = {
  'last-round':
    'While active: from30 seconds, gain+1 at each10-second pulse, or+2 if losing your lane.',
  'leave-me-alone':
    'While active: at each10-second interval end, if you are the only friendly fighter here, gain+2. Twice per card identity per match.',
  'day-one':
    'Deploy: name the strongest other local ally as your idol. While active, its first genuine Hands gain each10-second pulse gives you+1.',
  'wheel-come-again':
    'Deploy: attempt2 damage on the strongest enemy here. While active: another real character played in a different lane attempts1 damage on its strongest enemy. One encore per10-second pulse,2 per side per match.',
  'spread-the-word':
    'While active: the first genuine non-copied gain by another friendly Plant fighter per10-second pulse copies up to2 onto the weakest friendly Plant fighter in each other lane. Shared copies cannot repeat this trigger.',
  'now-im-up':
    'While active: after an enemy actually damages another friendly fighter here, gain+2 once per card identity per match.',
  'paid-in-blood':
    'While active: the first actual friendly-ability damage against an enemy here in a10-second pulse gives you that much Hands, up to+2. Combat damage cannot pay it.',
  'hands-on-clock':
    'While active: after an enemy ability actually damages another friendly fighter here, attempt2 damage back on its surviving source. Once per10-second pulse; ordinary combat does not count.',
  'fresh-pot':
    'Deploy: remove Burn and Freeze from the weakest affected friendly fighter here. Other harmful statuses remain.',
  'trust-the-cooler':
    'Deploy: attempt10-second Weaken on the strongest enemy here. While held, the weakest friendly Water fighter in each lane gains+1 at each10-second pulse.',
  'boarding-pass':
    'Deploy: give your weakest other local Air ally one Boarding Pass through the following interval. Its next successful lane move grants+2 and Protection once. While held, friendly Air fighters gain+1 each pulse.',
  'fresh-set':
    'Deploy: your weakest other local ally gains+2 and one reinforcement: prevent1 from its next positive enemy Hands reduction. Reinforcements do not stack. While held, friendly Poison fighters gain+1 each pulse.',
  'hold-our-ground':
    'Deploy: pair with your weakest other local Earth ally and Protect it. At the following interval end, or earlier final match pulse, if both remain here and the lane is not losing, each gains+3. One current pair per side. While held, friendly Earth fighters gain+1 each pulse.',
  'rooftop-harvest':
    'Deploy: leave one Seed in this lane per side. At the current interval end the weakest friendly Plant fighter here gains+4; empty plots expire harmlessly. While held, friendly Plant fighters gain+1 each pulse.',
  'citywide-signal':
    'Deploy: the weakest friendly fighter in each other lane gains+1. While held, friendly Electric fighters gain+1 each pulse. While active on board, the second real Electric character played in each interval gains+1.',
  overtime:
    'While held: bank up to3 actual Motion refunded by other cards. Deploy: attempt that banked amount as damage on every enemy here. Natural refill and income never bank; banked credit persists across returns.',
  'fourth-can-no-plan':
    'Deploy: refund up to2 actual Motion once per card identity per match; echoes cannot refund. While held, at each pulse from the start of interval2, earn up to1 Motion and lose1 printed base Hand, minimum1. Only successful income pays, once per side per pulse and3 times per side per match. Base loss and refund receipts persist through returns and Squabble.',
  'show-up-then':
    'Deploy: the weakest other local ally gains+1, or+2 if Plant. Promise it help through the next2 intervals: a different card giving it genuine Hands, cleansing it or healing enemy damage grants it+2,+3 if Plant, and the surviving keeper+1 once. Initial help cannot satisfy its own promise.',
  'must-be-nice':
    'While active: after a local enemy gains new bonus Hands, attempt to trim up to1 of that new bonus; gain+1 only when removal lands. Once per10-second pulse; base Hands and damage healing are never removable new bonus.',
  'lunch-break-loyalty':
    'Deploy: Protect your weakest other local ally and issue one Lunch Bond through the following interval. Its next genuine non-shared Hands gain gives an active surviving Work Hubby+1. One pending bond per side; each Hubby identity issues once per match.',
  'steady-nerves':
    'Deploy: cleanse Freeze and Silence from the weakest affected friendly fighter here and give it+2. Otherwise Protect your weakest unprotected friendly fighter here and gain+1.',
  'measured-strike':
    'Deploy: attempt Weaken on the strongest enemy here; only a newly landed effect gives+1. When destroyed with ability active, store+1 for your next real character deployment. Action cards cannot spend the pending Hands.',
  'raise-the-colors':
    'Deploy: your weakest other Red Set or Red Side ally anywhere gains+3; otherwise your weakest other ally anywhere gains+2. If alone, gain+1 and attempt Weaken on the strongest local enemy.',
  'blue-side-cover':
    'Deploy: the weakest Blue Set ally in another lane gains+4 and Protection, and you gain+1. Otherwise the weakest other remote ally gains+3 and Protection. If no remote ally exists, gain+1.',
  'collection-plate':
    'Deploy: collect1 Hand from each other local ally able to keep at least1, without enemy-damage or healing triggers. Gain+2 per actual donation.',
  'that-aint-it':
    'Deploy: trim up to2 bonus Hands from the strongest boosted enemy here through normal defenses. Only actual removal gives your weakest other local ally+1.',
  'refund-department':
    'Deploy: trim up to2 bonus Hands from the strongest boosted enemy here. Only actual removal gives your weakest other local ally+1 and Protection. One successful entrance per instance per match.',
  blowout:
    'Deploy: fully cleanse your weakest other local ally and give it+1. If an actual harmful effect was removed, its next successful lane move grants+1 once.',
  'fresh-fit':
    'Deploy: your weakest other local ally not previously fitted gains+1 and Protection. Its next successful lane move refreshes Protection once. One fitting per friendly card identity per match.',
  'make-do':
    'Deploy: gain+3 if another local friendly Inmate is present, or a friendly support action resolved here during the current10-second interval. Action cards never become marching fighters.',
  'looking-out':
    'Deploy: your weakest other local ally gains+3; independently your weakest friendly Cellblock fighter in another lane gains+2.',
  'old-head-open-road':
    'Deploy: move to your weakest other legal lane. Only after a successful arrival, gain+1 and give your weakest other ally there+2.',
  'auntie-got-it':
    'Deploy: your weakest other friendly fighter anywhere gains+2 and is fully cleansed. If its lane is still losing after that help, also Protect it.',
  'not-your-family':
    'Deploy: target the strongest enemy Snow Bunny,Wifey,Baby Momma or Suga Mama anywhere. In one defended package, attempt3 damage and Weaken. Without one of those identities, attempt1 damage against the strongest local enemy.',
  'you-aint-ask':
    'Deploy: move to your weakest other legal lane. Only after successful arrival, attempt1 damage against the strongest enemy there.',
} as const;
export const REACTION_ADAPTERS = {
  alchy: { ability: 'last-round', triggers: ['ongoing'] },
  incel: { ability: 'leave-me-alone', triggers: ['ongoing'] },
  fangirl: { ability: 'day-one', triggers: ['entrance', 'ongoing'] },
  counter: { ability: 'wheel-come-again', triggers: ['entrance', 'ongoing'] },
  'street-apostle': { ability: 'spread-the-word', triggers: ['ongoing'] },
  'bonnet-girl': { ability: 'now-im-up', triggers: ['ongoing'] },
  'trap-vamp': { ability: 'paid-in-blood', triggers: ['ongoing'] },
  'squabble-house-male': { ability: 'hands-on-clock', triggers: ['ongoing'] },
  'squabble-house-female': { ability: 'fresh-pot', triggers: ['entrance'] },
  'monsoon-anchor': {
    ability: 'trust-the-cooler',
    triggers: ['entrance', 'held'],
  },
  slipstream: { ability: 'boarding-pass', triggers: ['entrance', 'held'] },
  'nail-tech': { ability: 'fresh-set', triggers: ['entrance', 'held'] },
  torta: { ability: 'hold-our-ground', triggers: ['entrance', 'held'] },
  'rooftop-gardener': {
    ability: 'rooftop-harvest',
    triggers: ['entrance', 'held'],
  },
  'pirate-radio-dj': {
    ability: 'citywide-signal',
    triggers: ['entrance', 'ongoing', 'held'],
  },
  powerhouse: { ability: 'overtime', triggers: ['entrance', 'held'] },
  rainmaker: { ability: 'fourth-can-no-plan', triggers: ['entrance', 'held'] },
  'canopy-keeper': { ability: 'show-up-then', triggers: ['entrance'] },
  hater: { ability: 'must-be-nice', triggers: ['ongoing'] },
  'work-hubby': {
    ability: 'lunch-break-loyalty',
    triggers: ['entrance', 'ongoing'],
  },
  'blue-side-4': { ability: 'steady-nerves', triggers: ['entrance'] },
  'blue-side-5': {
    ability: 'measured-strike',
    triggers: ['entrance', 'ongoing'],
  },
  'red-side-5': { ability: 'raise-the-colors', triggers: ['entrance'] },
  'ganger-blue': { ability: 'blue-side-cover', triggers: ['entrance'] },
  'corrupt-pastor': { ability: 'collection-plate', triggers: ['entrance'] },
  'barbershop-heckler': { ability: 'that-aint-it', triggers: ['entrance'] },
  'indian-scammer': { ability: 'refund-department', triggers: ['entrance'] },
  'hair-stylist': { ability: 'blowout', triggers: ['entrance'] },
  stylist: { ability: 'fresh-fit', triggers: ['entrance'] },
  'inmate-crafty': { ability: 'make-do', triggers: ['entrance'] },
  'inmate-boyfriend': { ability: 'looking-out', triggers: ['entrance'] },
  'og-uncle-harley-davidson': {
    ability: 'old-head-open-road',
    triggers: ['entrance'],
  },
  'suga-mama': { ability: 'auntie-got-it', triggers: ['entrance'] },
  'side-chick': { ability: 'not-your-family', triggers: ['entrance'] },
  'gas-station-window-wiper': {
    ability: 'you-aint-ask',
    triggers: ['entrance'],
  },
} as const;
export type ReactionAbility = keyof typeof REACTION_ABILITY_DESCRIPTIONS;
export interface ReactionSource {
  id: string;
  cardId: string;
  side: Side;
  lane: Lane;
  position: number;
}
type Source = ReactionSource;
interface Contract {
  source: Source;
  targetId: string;
  expiresAt: number;
}
interface MoveGrant extends Contract {
  kind: 'boarding' | 'blowout' | 'fitting';
}
interface Pair {
  source: Source;
  partnerId: string;
  lane: Lane;
  dueAt: number;
}
interface Seed {
  source: Source;
  lane: Lane;
  dueAt: number;
}
export interface ReactionMatchState {
  pulseUses: Record<string, number>;
  used: Record<string, true>;
  counts: Record<string, number>;
  idols: Record<string, string>;
  moves: MoveGrant[];
  nails: Record<string, true>;
  pairs: Partial<Record<Side, Pair>>;
  seeds: Seed[];
  promises: Partial<Record<Side, Contract>>;
  lunches: Partial<Record<Side, Contract>>;
  banked: Record<string, number>;
  rainBaseLost: Record<string, number>;
  supportPresence: Record<string, number>;
  nextBlue: Record<Side, number>;
  electricCounts: Record<Side, { pulse: number; count: number }>;
  destroyed: Record<string, true>;
  lastPulse: number;
}
type Card = Pick<
  FighterDefinition,
  'id' | 'kind' | 'element' | 'engineId' | 'faction' | 'gangColor'
> & { ability?: string };
export interface ReactionDamageSource {
  sourceUnitId?: string;
  sourceSide: Side;
  sourceLane?: Lane;
  sourcePosition?: number;
  sourceCardId?: string;
}
export interface ReactionContext {
  state: GameState & { reactions?: ReactionMatchState };
  definition(unit: Unit): Card;
  active(unit: Unit): boolean;
  effectiveHands(unit: Unit): number;
  isAfflicted(unit: Unit): boolean;
  gain(unit: Unit, amount: number, copied?: boolean, source?: Source): void;
  protect(unit: Unit): void;
  cleanse(
    unit: Unit,
    kinds?: readonly TimedStatus['kind'][],
    source?: Source,
  ): void;
  heal(unit: Unit, cap: number, source?: Source): number;
  weaken(source: Unit, target: Unit): boolean;
  strike(source: Unit, target: Unit, amount: number): number;
  /** One ordinary defended3-damage+Weaken package, including immunity/Janitor. */
  hostilePackage(
    source: Unit,
    target: Unit,
    apply: (actualTarget: Unit) => void,
  ): boolean;
  /** Damage/Weaken inside the defended package, without a second shield attempt. */
  rawDamage(source: Unit, target: Unit, amount: number): number;
  rawWeaken(source: Unit, target: Unit): boolean;
  removableBonus(unit: Unit): number;
  removeBonus(source: Unit, target: Unit, cap: number): number;
  /** Actual capped refund/income; caller notifies reactionRefunded only for refund. */
  motion(
    side: Side,
    amount: number,
    source: Source,
    kind: 'refund' | 'income',
  ): number;
  /** Friendly contribution, no enemy damage/prevention/recovery trigger; leave1. */
  sacrificeHands(unit: Unit, amount: number): number;
  move(unit: Unit, lane: Lane): boolean;
  openForMove(unit: Unit, lane: Lane): boolean;
  event(event: Omit<BattleEvent, 'id'>): void;
  isToken?(unit: Unit): boolean;
}
const SIDES: readonly Side[] = ['player', 'opponent'];
const LANES: readonly Lane[] = [0, 1, 2];
const source = (u: Unit): Source => ({
  id: u.id,
  cardId: u.cardId,
  side: u.side,
  lane: u.lane,
  position: u.position,
});
const mark = (u: Source) => ({
  sourceUnitId: u.id,
  sourceSide: u.side,
  sourceLane: u.lane,
  sourcePosition: u.position,
});
const identity = (u: Source) => `${u.side}:${u.cardId}`;
function runtime(ctx: ReactionContext): ReactionMatchState {
  return (ctx.state.reactions ??= {
    pulseUses: {},
    used: {},
    counts: {},
    idols: {},
    moves: [],
    nails: {},
    pairs: {},
    seeds: [],
    promises: {},
    lunches: {},
    banked: {},
    rainBaseLost: {},
    supportPresence: {},
    nextBlue: { player: 0, opponent: 0 },
    electricCounts: {
      player: { pulse: -1, count: 0 },
      opponent: { pulse: -1, count: 0 },
    },
    destroyed: {},
    lastPulse: Math.floor(ctx.state.elapsedMs / REACTION_PULSE_MS),
  });
}
export function cloneReactionState(
  value?: ReactionMatchState,
): ReactionMatchState | undefined {
  return value ? structuredClone(value) : undefined;
}
const pulse = (ctx: ReactionContext) =>
  Math.floor(ctx.state.elapsedMs / REACTION_PULSE_MS);
const real = (ctx: ReactionContext, u: Unit) =>
  !ctx.isToken?.(u) && (ctx.definition(u).kind ?? 'character') === 'character';
const board = (ctx: ReactionContext) =>
  ctx.state.units.filter((u) => u.hands > 0 && real(ctx, u));
const all = (ctx: ReactionContext, u: Unit, local = true) =>
  board(ctx).filter(
    (x) => x.side === u.side && x.id !== u.id && (!local || x.lane === u.lane),
  );
const enemy = (ctx: ReactionContext, u: Unit, local = true) =>
  board(ctx).filter((x) => x.side !== u.side && (!local || x.lane === u.lane));
const low = (ctx: ReactionContext, xs: readonly Unit[]) =>
  [...xs].sort(
    (a, b) =>
      ctx.effectiveHands(a) - ctx.effectiveHands(b) || a.id.localeCompare(b.id),
  )[0];
const high = (ctx: ReactionContext, xs: readonly Unit[]) =>
  [...xs].sort(
    (a, b) =>
      ctx.effectiveHands(b) - ctx.effectiveHands(a) || a.id.localeCompare(b.id),
  )[0];
const active = (ctx: ReactionContext, side: Side, ability: ReactionAbility) =>
  board(ctx)
    .filter(
      (u) =>
        u.side === side &&
        ctx.active(u) &&
        ctx.definition(u).ability === ability,
    )
    .sort((a, b) => a.id.localeCompare(b.id));
const element = (ctx: ReactionContext, u: Unit) =>
  ctx.definition(u).element === 'Rock' ? 'Earth' : ctx.definition(u).element;
const color = (ctx: ReactionContext, u: Unit) =>
  u.gangColor ?? ctx.definition(u).gangColor;
const isRed = (ctx: ReactionContext, u: Unit) =>
  color(ctx, u) === 'red' || ctx.definition(u).faction === 'Red Side';
const isInmate = (ctx: ReactionContext, u: Unit) =>
  ctx.definition(u).faction === 'Cellblock';
function score(ctx: ReactionContext, side: Side, lane: Lane) {
  return board(ctx)
    .filter((u) => u.side === side && u.lane === lane)
    .reduce((n, u) => n + ctx.effectiveHands(u), 0);
}
const losing = (ctx: ReactionContext, side: Side, lane: Lane) =>
  score(ctx, side, lane) <
  score(ctx, side === 'player' ? 'opponent' : 'player', lane);
function destinations(ctx: ReactionContext, u: Unit) {
  return LANES.filter((l) => l !== u.lane && ctx.openForMove(u, l)).sort(
    (a, b) => score(ctx, u.side, a) - score(ctx, u.side, b) || a - b,
  );
}
function attributed(ctx: ReactionContext, from: Source, effect: () => void) {
  const first = ctx.state.nextEventId;
  effect();
  for (const e of ctx.state.events)
    if (e.id >= first && e.sourceUnitId === undefined)
      Object.assign(e, mark(from));
}
function give(
  ctx: ReactionContext,
  from: Source,
  target: Unit | undefined,
  n: number,
  copied = false,
) {
  if (target && target.hands > 0 && n > 0)
    attributed(ctx, from, () => ctx.gain(target, n, copied, from));
}
function cover(ctx: ReactionContext, from: Source, target?: Unit) {
  if (target && target.hands > 0)
    attributed(ctx, from, () => ctx.protect(target));
}
function usePulse(ctx: ReactionContext, key: string) {
  const d = runtime(ctx);
  if (d.pulseUses[key] === pulse(ctx)) return false;
  d.pulseUses[key] = pulse(ctx);
  return true;
}
function useOnce(ctx: ReactionContext, key: string) {
  const d = runtime(ctx);
  if (d.used[key]) return false;
  d.used[key] = true;
  return true;
}
function promiseHelp(ctx: ReactionContext, target: Unit, from?: Source) {
  const d = runtime(ctx),
    promise = d.promises[target.side];
  if (
    !promise ||
    promise.targetId !== target.id ||
    promise.expiresAt <= ctx.state.elapsedMs ||
    !from ||
    from.id === promise.source.id ||
    from.id === target.id
  )
    return;
  delete d.promises[target.side];
  give(ctx, promise.source, target, element(ctx, target) === 'Plant' ? 3 : 2);
  give(
    ctx,
    promise.source,
    board(ctx).find((u) => u.id === promise.source.id),
    1,
  );
}
/** Read-only normal-form base stats, before Squabble multipliers. */
export function reactionDeploymentBaseHands(
  ctx: ReactionContext,
  side: Side,
  cardId: string,
  printed: number,
): number {
  const card = ctx.state.roster.find((c) => c.id === cardId);
  return card?.ability === 'fourth-can-no-plan'
    ? Math.max(
        1,
        printed - (ctx.state.reactions?.rainBaseLost[`${side}:${cardId}`] ?? 0),
      )
    : printed;
}
export function reactionEntrance(
  ctx: ReactionContext,
  unit: Unit,
  echoed = false,
): boolean | undefined {
  const ability = ctx.definition(unit).ability;
  if (!Object.hasOwn(REACTION_ABILITY_DESCRIPTIONS, ability ?? ''))
    return undefined;
  const d = runtime(ctx),
    from = source(unit);
  if (!ctx.active(unit) || unit.hands <= 0) return false;
  const local = all(ctx, unit),
    foes = enemy(ctx, unit);
  switch (ability) {
    case 'day-one': {
      const target = high(ctx, local);
      if (!target) return false;
      d.idols[unit.id] = target.id;
      return true;
    }
    case 'wheel-come-again': {
      const target = high(ctx, foes);
      return !!target && ctx.strike(unit, target, 2) > 0;
    }
    case 'fresh-pot': {
      const target = low(
        ctx,
        board(ctx).filter(
          (u) =>
            u.side === unit.side &&
            u.lane === unit.lane &&
            (u.frozen || (u.burnStacks ?? 0) > 0),
        ),
      );
      if (!target) return false;
      ctx.cleanse(target, ['freeze', 'burn'], from);
      return true;
    }
    case 'trust-the-cooler':
    case 'measured-strike': {
      const target = high(ctx, foes);
      const success = !!target && ctx.weaken(unit, target);
      if (success && ability === 'measured-strike') give(ctx, from, unit, 1);
      return success;
    }
    case 'boarding-pass': {
      const target = low(
        ctx,
        local.filter((u) => element(ctx, u) === 'Air'),
      );
      if (!target) return false;
      d.moves = d.moves.filter(
        (x) => !(x.kind === 'boarding' && x.targetId === target.id),
      );
      d.moves.push({
        source: from,
        targetId: target.id,
        kind: 'boarding',
        expiresAt: (pulse(ctx) + 2) * REACTION_PULSE_MS,
      });
      return true;
    }
    case 'fresh-set': {
      const target = low(ctx, local);
      if (!target) return false;
      give(ctx, from, target, 2);
      d.nails[target.id] = true;
      return true;
    }
    case 'hold-our-ground': {
      if (d.pairs[unit.side]) return false;
      const partner = low(
        ctx,
        local.filter((u) => element(ctx, u) === 'Earth'),
      );
      if (!partner) return false;
      cover(ctx, from, partner);
      d.pairs[unit.side] = {
        source: from,
        partnerId: partner.id,
        lane: unit.lane,
        dueAt: Math.min(
          (pulse(ctx) + 2) * REACTION_PULSE_MS,
          ctx.state.durationMs,
        ),
      };
      return true;
    }
    case 'rooftop-harvest': {
      if (
        d.seeds.some((x) => x.source.side === unit.side && x.lane === unit.lane)
      )
        return false;
      d.seeds.push({
        source: from,
        lane: unit.lane,
        dueAt: Math.min(
          (pulse(ctx) + 1) * REACTION_PULSE_MS,
          ctx.state.durationMs,
        ),
      });
      return true;
    }
    case 'citywide-signal': {
      let helped = false;
      for (const lane of LANES.filter((l) => l !== unit.lane)) {
        const target = low(
          ctx,
          all(ctx, unit, false).filter((u) => u.lane === lane),
        );
        if (target) {
          give(ctx, from, target, 1);
          helped = true;
        }
      }
      return helped;
    }
    case 'overtime': {
      const bank = d.banked[identity(from)] ?? 0;
      let hit = false;
      for (const target of foes)
        if (bank && ctx.strike(unit, target, bank) > 0) hit = true;
      return hit;
    }
    case 'fourth-can-no-plan': {
      if (echoed || !useOnce(ctx, `rain-refund:${identity(from)}`))
        return false;
      ctx.motion(unit.side, 2, from, 'refund');
      return true;
    }
    case 'show-up-then': {
      const target = low(ctx, local);
      if (!target) return false;
      give(ctx, from, target, element(ctx, target) === 'Plant' ? 2 : 1);
      d.promises[unit.side] = {
        source: from,
        targetId: target.id,
        expiresAt: (pulse(ctx) + 3) * REACTION_PULSE_MS,
      };
      return true;
    }
    case 'lunch-break-loyalty': {
      const target = low(ctx, local);
      if (!target || !useOnce(ctx, `lunch:${identity(from)}`)) return false;
      cover(ctx, from, target);
      d.lunches[unit.side] = {
        source: from,
        targetId: target.id,
        expiresAt: (pulse(ctx) + 2) * REACTION_PULSE_MS,
      };
      return true;
    }
    case 'steady-nerves': {
      const target = low(
        ctx,
        board(ctx).filter(
          (u) =>
            u.side === unit.side &&
            u.lane === unit.lane &&
            (u.frozen || u.silenced),
        ),
      );
      if (target) {
        ctx.cleanse(target, ['freeze', 'silence'], from);
        give(ctx, from, target, 2);
        return true;
      }
      const recipient = low(
        ctx,
        board(ctx).filter(
          (u) => u.side === unit.side && u.lane === unit.lane && !u.protected,
        ),
      );
      if (!recipient) return false;
      cover(ctx, from, recipient);
      give(ctx, from, unit, 1);
      return true;
    }
    case 'raise-the-colors': {
      const crew = all(ctx, unit, false),
        red = low(
          ctx,
          crew.filter((u) => isRed(ctx, u)),
        ),
        target = red ?? low(ctx, crew);
      if (target) give(ctx, from, target, red ? 3 : 2);
      else {
        give(ctx, from, unit, 1);
        const foe = high(ctx, foes);
        if (foe) ctx.weaken(unit, foe);
      }
      return true;
    }
    case 'blue-side-cover': {
      const remote = all(ctx, unit, false).filter((u) => u.lane !== unit.lane),
        blue = low(
          ctx,
          remote.filter((u) => color(ctx, u) === 'blue'),
        ),
        target = blue ?? low(ctx, remote);
      if (target) {
        give(ctx, from, target, blue ? 4 : 3);
        cover(ctx, from, target);
      }
      if (blue || !target) give(ctx, from, unit, 1);
      return true;
    }
    case 'collection-plate': {
      let donations = 0;
      for (const target of local)
        donations += ctx.sacrificeHands(target, 1) > 0 ? 1 : 0;
      give(ctx, from, unit, donations * 2);
      return donations > 0;
    }
    case 'that-aint-it':
    case 'refund-department': {
      const key = `scammer:${unit.id}`;
      if (ability === 'refund-department' && d.used[key]) return false;
      const target = high(
        ctx,
        foes.filter((u) => ctx.removableBonus(u) > 0),
      );
      if (!target || ctx.removeBonus(unit, target, 2) <= 0) return false;
      if (ability === 'refund-department') d.used[key] = true;
      const recipient = low(ctx, local);
      give(ctx, from, recipient, 1);
      if (ability === 'refund-department') cover(ctx, from, recipient);
      return true;
    }
    case 'blowout': {
      const target = low(ctx, local);
      if (!target) return false;
      const dirty = ctx.isAfflicted(target);
      ctx.cleanse(target, undefined, from);
      give(ctx, from, target, 1);
      if (dirty && !ctx.isAfflicted(target)) {
        d.moves = d.moves.filter(
          (x) => !(x.kind === 'blowout' && x.targetId === target.id),
        );
        d.moves.push({
          source: from,
          targetId: target.id,
          kind: 'blowout',
          expiresAt: ctx.state.durationMs,
        });
      }
      return true;
    }
    case 'fresh-fit': {
      const target = low(
        ctx,
        local.filter((u) => !d.used[`fit:${identity(source(u))}`]),
      );
      if (!target) return false;
      d.used[`fit:${identity(source(target))}`] = true;
      give(ctx, from, target, 1);
      cover(ctx, from, target);
      d.moves.push({
        source: from,
        targetId: target.id,
        kind: 'fitting',
        expiresAt: ctx.state.durationMs,
      });
      return true;
    }
    case 'make-do': {
      if (
        !local.some((u) => isInmate(ctx, u)) &&
        d.supportPresence[`${unit.side}:${unit.lane}`] !== pulse(ctx)
      )
        return false;
      give(ctx, from, unit, 3);
      return true;
    }
    case 'looking-out': {
      const target = low(ctx, local),
        remote = low(
          ctx,
          all(ctx, unit, false).filter(
            (u) => u.lane !== unit.lane && isInmate(ctx, u),
          ),
        );
      give(ctx, from, target, 3);
      give(ctx, from, remote, 2);
      return !!target || !!remote;
    }
    case 'old-head-open-road':
    case 'you-aint-ask': {
      const lane = destinations(ctx, unit)[0];
      if (lane === undefined || !ctx.move(unit, lane)) return false;
      if (ability === 'old-head-open-road') {
        give(ctx, from, unit, 1);
        give(ctx, from, low(ctx, all(ctx, unit)), 2);
      } else {
        const target = high(ctx, enemy(ctx, unit));
        if (target) ctx.strike(unit, target, 1);
      }
      return true;
    }
    case 'auntie-got-it': {
      const target = low(ctx, all(ctx, unit, false));
      if (!target) return false;
      give(ctx, from, target, 2);
      ctx.cleanse(target, undefined, from);
      if (losing(ctx, unit.side, target.lane)) cover(ctx, from, target);
      return true;
    }
    case 'not-your-family': {
      const ids = new Set(['snow-bunny', 'wifey', 'baby-momma', 'suga-mama']);
      const preferred = high(
        ctx,
        enemy(ctx, unit, false).filter((u) => ids.has(ctx.definition(u).id)),
      );
      if (preferred) {
        let changed = false;
        ctx.hostilePackage(unit, preferred, (preferred) => {
          changed = ctx.rawDamage(unit, preferred, 3) > 0;
          if (preferred.hands > 0)
            changed = ctx.rawWeaken(unit, preferred) || changed;
        });
        return changed;
      }
      const target = high(ctx, foes);
      return !!target && ctx.strike(unit, target, 1) > 0;
    }
    // These authored passives have no successful entrance to echo.
    case 'last-round':
    case 'leave-me-alone':
    case 'spread-the-word':
    case 'now-im-up':
    case 'paid-in-blood':
    case 'hands-on-clock':
    case 'must-be-nice':
      return false;
  }
  return false;
}
/** Real paid card only, before character On Reveal. Support actions use a
 * non-marching actor after resolution, solely to record their paid lane/pulse. */
export function reactionPlayed(
  ctx: ReactionContext,
  unit: Unit,
  kind: 'character' | 'support' | 'blockbuster' = 'character',
): void {
  const d = runtime(ctx),
    now = pulse(ctx);
  if (kind === 'support') {
    d.supportPresence[`${unit.side}:${unit.lane}`] = now;
    return;
  }
  if (kind !== 'character' || !real(ctx, unit) || unit.hands <= 0) return;
  const pending = d.nextBlue[unit.side];
  if (pending) {
    d.nextBlue[unit.side] = 0;
    give(ctx, source(unit), unit, pending);
  }
  if (element(ctx, unit) === 'Electric') {
    const count = d.electricCounts[unit.side];
    if (count.pulse !== now) {
      count.pulse = now;
      count.count = 0;
    }
    count.count++;
    const dj = active(ctx, unit.side, 'citywide-signal')[0];
    if (count.count === 2 && dj) give(ctx, source(dj), unit, 1);
  }
  const shotta = active(ctx, unit.side, 'wheel-come-again').find(
    (u) => u.id !== unit.id && u.lane !== unit.lane,
  );
  const key = `${unit.side}:encore`;
  if (shotta && (d.counts[key] ?? 0) < 2 && d.pulseUses[key] !== now) {
    const target = high(ctx, enemy(ctx, unit));
    if (target) {
      d.pulseUses[key] = now;
      d.counts[key] = (d.counts[key] ?? 0) + 1;
      ctx.strike(shotta, target, 1);
    }
  }
}
export function reactionMoved(
  ctx: ReactionContext,
  unit: Unit,
  oldLane: Lane,
): void {
  if (unit.hands <= 0 || oldLane === unit.lane || !real(ctx, unit)) return;
  const d = runtime(ctx),
    grants = d.moves.filter((x) => x.targetId === unit.id);
  d.moves = d.moves.filter((x) => x.targetId !== unit.id);
  for (const grant of grants)
    if (grant.expiresAt > ctx.state.elapsedMs) {
      if (grant.kind === 'blowout') give(ctx, grant.source, unit, 1);
      if (grant.kind === 'boarding') give(ctx, grant.source, unit, 2);
      if (grant.kind === 'boarding' || grant.kind === 'fitting')
        cover(ctx, grant.source, unit);
    }
}
/** actual is the positive net Hands added; bonusGained excludes recovery and
 * derived auras, and source identifies the card that genuinely supplied help. */
export function reactionGained(
  ctx: ReactionContext,
  unit: Unit,
  actual: number,
  copied = false,
  from?: Source,
  bonusGained = actual,
): void {
  if (actual <= 0 || unit.hands <= 0 || !real(ctx, unit)) return;
  const d = runtime(ctx),
    now = pulse(ctx);
  for (const fan of active(ctx, unit.side, 'day-one').filter(
    (u) => d.idols[u.id] === unit.id,
  ))
    if (usePulse(ctx, `fan:${identity(source(fan))}`))
      give(ctx, source(fan), fan, 1);
  if (!copied && element(ctx, unit) === 'Plant') {
    const apostle = active(ctx, unit.side, 'spread-the-word').find(
      (u) => u.id !== unit.id,
    );
    if (apostle && usePulse(ctx, `apostle:${unit.side}`))
      for (const lane of LANES.filter((l) => l !== unit.lane))
        give(
          ctx,
          source(apostle),
          low(
            ctx,
            board(ctx).filter(
              (u) =>
                u.side === unit.side &&
                u.lane === lane &&
                element(ctx, u) === 'Plant',
            ),
          ),
          Math.min(2, actual),
          true,
        );
  }
  if (!copied) {
    const lunch = d.lunches[unit.side];
    if (
      lunch &&
      lunch.targetId === unit.id &&
      lunch.expiresAt > ctx.state.elapsedMs
    ) {
      const hubby = board(ctx).find(
        (u) => u.id === lunch.source.id && ctx.active(u),
      );
      if (hubby) {
        delete d.lunches[unit.side];
        give(ctx, lunch.source, hubby, 1, true);
      }
    }
  }
  // Canopy does not exclude copied help; only Apostle and Lunch explicitly do.
  promiseHelp(ctx, unit, from);
  if (bonusGained > 0 && ctx.removableBonus(unit) > 0) {
    const other: Side = unit.side === 'player' ? 'opponent' : 'player';
    const hater = active(ctx, other, 'must-be-nice').find(
      (u) => u.lane === unit.lane,
    );
    if (hater && usePulse(ctx, `hater:${other}`)) {
      const removed = ctx.removeBonus(hater, unit, Math.min(1, bonusGained));
      if (removed > 0) give(ctx, source(hater), hater, 1);
    }
  }
}
export function reactionCleansed(
  ctx: ReactionContext,
  unit: Unit,
  actualRemoved: boolean,
  from?: Source,
): void {
  if (actualRemoved && unit.hands > 0) promiseHelp(ctx, unit, from);
}
export function reactionDamaged(
  ctx: ReactionContext,
  from: ReactionDamageSource,
  victim: Unit,
  actual: number,
  options: { ability: boolean; burn?: boolean },
): void {
  if (actual <= 0 || from.sourceSide === victim.side || !real(ctx, victim))
    return;
  const d = runtime(ctx),
    now = pulse(ctx);
  for (const bonnet of active(ctx, victim.side, 'now-im-up').filter(
    (u) => u.id !== victim.id && u.lane === victim.lane,
  ))
    if (useOnce(ctx, `bonnet:${identity(source(bonnet))}`))
      give(ctx, source(bonnet), bonnet, 2);
  if (!options.ability) return;
  const vamp = active(ctx, from.sourceSide, 'paid-in-blood').find(
    (u) => u.lane === victim.lane,
  );
  if (vamp && usePulse(ctx, `vamp:${from.sourceSide}`))
    give(ctx, source(vamp), vamp, Math.min(2, actual));
  const cook = active(ctx, victim.side, 'hands-on-clock').find(
    (u) => u.id !== victim.id && u.lane === victim.lane,
  );
  const attacker = board(ctx).find((u) => u.id === from.sourceUnitId);
  if (cook && d.pulseUses[`cook:${victim.side}`] !== now) {
    d.pulseUses[`cook:${victim.side}`] = now;
    if (attacker) ctx.strike(cook, attacker, 2);
  }
}
export function reactionRefunded(
  ctx: ReactionContext,
  side: Side,
  actual: number,
  sourceCardId?: string,
): void {
  if (actual <= 0) return;
  const d = runtime(ctx);
  for (const id of ctx.state.players[side].hand) {
    const card = ctx.state.roster.find((c) => c.id === id);
    if (card?.ability === 'overtime' && id !== sourceCardId) {
      const key = `${side}:${id}`;
      d.banked[key] = Math.min(3, (d.banked[key] ?? 0) + actual);
    }
  }
}
export function reactionDestroyed(ctx: ReactionContext, unit: Unit): void {
  if (!real(ctx, unit) || unit.hands > 0) return;
  const d = runtime(ctx);
  if (d.destroyed[unit.id]) return;
  d.destroyed[unit.id] = true;
  if (
    ctx.definition(unit).ability === 'measured-strike' &&
    !unit.frozen &&
    !unit.silenced &&
    !unit.weakened
  )
    d.nextBlue[unit.side]++;
}
/** Called after immunity/ability shields but before actual enemy Hands loss.
 * Consume only for a real positive reduction, never a preview or friendly cost. */
export function reactionPreventEnemyLoss(
  ctx: ReactionContext,
  unit: Unit,
  incoming: number,
): number {
  if (
    incoming <= 0 ||
    !Number.isFinite(incoming) ||
    unit.hands <= 0 ||
    !ctx.state.reactions?.nails[unit.id]
  )
    return 0;
  delete ctx.state.reactions.nails[unit.id];
  return Math.min(1, incoming);
}
export function reactionPulse(ctx: ReactionContext): void {
  const d = runtime(ctx),
    now = pulse(ctx);
  while (d.lastPulse < now) {
    const completed = d.lastPulse++,
      boundary = d.lastPulse * REACTION_PULSE_MS;
    for (const side of SIDES) {
      for (const alchy of active(ctx, side, 'last-round'))
        if (completed >= 2)
          give(
            ctx,
            source(alchy),
            alchy,
            losing(ctx, side, alchy.lane) ? 2 : 1,
          );
      for (const incel of active(ctx, side, 'leave-me-alone')) {
        const key = `alone:${identity(source(incel))}`;
        if (!all(ctx, incel).length && (d.counts[key] ?? 0) < 2) {
          d.counts[key] = (d.counts[key] ?? 0) + 1;
          give(ctx, source(incel), incel, 2);
        }
      }
      const held = ctx.state.players[side].hand
        .map((id) => ctx.state.roster.find((c) => c.id === id))
        .filter((c): c is FighterDefinition => !!c);
      for (const card of held) {
        const from: Source = {
          id: `hand:${side}:${card.id}`,
          cardId: card.id,
          side,
          lane: 0,
          position: side === 'player' ? 0 : 1,
        };
        const bonds: Record<string, string> = {
          'fresh-set': 'Poison',
          'hold-our-ground': 'Earth',
          'rooftop-harvest': 'Plant',
          'citywide-signal': 'Electric',
          'boarding-pass': 'Air',
        };
        const bound = bonds[card.ability ?? ''];
        if (bound)
          for (const target of board(ctx).filter(
            (u) =>
              u.side === side &&
              u.cardId !== card.id &&
              element(ctx, u) === bound,
          ))
            give(ctx, from, target, 1);
        if (card.ability === 'trust-the-cooler')
          for (const lane of LANES)
            give(
              ctx,
              from,
              low(
                ctx,
                board(ctx).filter(
                  (u) =>
                    u.side === side &&
                    u.cardId !== card.id &&
                    u.lane === lane &&
                    element(ctx, u) === 'Water',
                ),
              ),
              1,
            );
        if (
          card.ability === 'fourth-can-no-plan' &&
          (d.counts[`rain:${side}`] ?? 0) < 3 &&
          d.pulseUses[`rain:${side}`] !== completed
        ) {
          const actual = ctx.motion(side, 1, from, 'income');
          if (actual > 0) {
            d.pulseUses[`rain:${side}`] = completed;
            d.counts[`rain:${side}`] = (d.counts[`rain:${side}`] ?? 0) + 1;
            const key = `${side}:${card.id}`;
            d.rainBaseLost[key] = Math.min(
              Math.max(0, card.hands - 1),
              (d.rainBaseLost[key] ?? 0) + 1,
            );
          }
        }
      }
      const pair = d.pairs[side];
      if (pair && pair.dueAt <= boundary) {
        delete d.pairs[side];
        const a = board(ctx).find((u) => u.id === pair.source.id),
          b = board(ctx).find((u) => u.id === pair.partnerId);
        if (
          a &&
          b &&
          a.lane === pair.lane &&
          b.lane === pair.lane &&
          !losing(ctx, side, pair.lane)
        ) {
          give(ctx, pair.source, a, 3);
          give(ctx, pair.source, b, 3);
        }
      }
    }
    for (const seed of d.seeds.filter((x) => x.dueAt <= boundary)) {
      d.seeds = d.seeds.filter((x) => x !== seed);
      give(
        ctx,
        seed.source,
        low(
          ctx,
          board(ctx).filter(
            (u) =>
              u.side === seed.source.side &&
              u.lane === seed.lane &&
              element(ctx, u) === 'Plant',
          ),
        ),
        4,
      );
    }
  }
  // Contracts due at a short final clock boundary still settle before the tally.
  if (ctx.state.elapsedMs >= ctx.state.durationMs) {
    for (const side of SIDES) {
      const pair = d.pairs[side];
      if (!pair) continue;
      delete d.pairs[side];
      const a = board(ctx).find((u) => u.id === pair.source.id),
        b = board(ctx).find((u) => u.id === pair.partnerId);
      if (
        a &&
        b &&
        a.lane === pair.lane &&
        b.lane === pair.lane &&
        !losing(ctx, side, pair.lane)
      ) {
        give(ctx, pair.source, a, 3);
        give(ctx, pair.source, b, 3);
      }
    }
    for (const seed of d.seeds)
      give(
        ctx,
        seed.source,
        low(
          ctx,
          board(ctx).filter(
            (u) =>
              u.side === seed.source.side &&
              u.lane === seed.lane &&
              element(ctx, u) === 'Plant',
          ),
        ),
        4,
      );
    d.seeds = [];
  }
  const present = new Set(board(ctx).map((u) => u.id));
  d.moves = d.moves.filter(
    (x) => x.expiresAt > ctx.state.elapsedMs && present.has(x.targetId),
  );
  for (const id of Object.keys(d.nails))
    if (!present.has(id)) delete d.nails[id];
  for (const side of SIDES)
    for (const store of [d.promises, d.lunches]) {
      const x = store[side];
      if (x && (x.expiresAt <= ctx.state.elapsedMs || !present.has(x.targetId)))
        delete store[side];
    }
}
