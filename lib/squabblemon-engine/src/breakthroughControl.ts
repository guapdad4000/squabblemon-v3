/** Taxes, arrival traps, status appeals and forced movement. Quotes are read-only;
 * paid deployment remains synchronous even when an entrance ability is deferred. */
import type {
  BattleEvent,
  FighterDefinition,
  GameState,
  Lane,
  Side,
  Unit,
} from './breakthrough';
export const CONTROL_PULSE_MS = 10000;
export const CONTROL_ABILITY_DESCRIPTIONS = {
  'last-call':
    'Deploy: from30 seconds gain+2. Leave one next-Poison-character1-Motion discount, minimum1, through the following10-second interval.',
  'rent-due':
    'While active: the first enemy card paid into this lane per10-second pulse costs+1 Motion. Only actual tax payment spends it and grants Landlord+1. Failed or previewed plays pay nothing.',
  'guest-list':
    'Deploy: privately reveal the first stable enemy held-card identity. If printed cost4+, arm a1-Motion discount for your next paid card in another lane. While active: the first eligible Air,Bottle Girl,Pirate DJ or Dance Captain lane mover per10-second pulse gains+2; copies share the trigger.',
  fork: 'Deploy: mark the strongest enemy in up to2 occupied lanes, by lane order, through the next interval. A single mark waits for a real enemy placement in another lane to complete the Fork. The following enemy placement saves its lane; other marked enemies take2 damage. If damage lands, an active surviving Chess Regular gains+1 once.',
  'dead-air':
    'Deploy: move to the first completely empty legal lane. While you remain active there, the first enemy paid/movement arrival is targeted by Silence before its ability; a defense still spends that first check. If no empty lane is available, attempt Silence on the weakest local enemy costing3 or less.',
  'pass-it-around':
    'Deploy: cleanse the weakest afflicted local friendly fighter and leave a token through the following interval. The next other friendly arrival here gains+4. If a cleanse succeeded, a later different arrival gains+1 once. Tokens never become marching units.',
  'extra-sauce':
    'Deploy: for each enemy here, in one defended package apply2 Burn then detonate all its accumulated Burn as immediate damage and consume it. One Protection blocks the entire package. Burn damage prevention still applies.',
  'pass-the-hose':
    'Deploy: attempt1 Burn on the weakest unburned enemy in another lane. While active: at each pulse, the first actual enemy Burn victim recorded in each lane relays1 Burn to the weakest unburned enemy in the next lane. Relay Burn waits until the next pulse before damaging. If the destination has enemies but every one was already burning, gain+1 at most once per pulse.',
  'express-delivery':
    'While active: the second real friendly Electric character paid in a10-second interval sends a Package to the weakest other lane. Only one Package may wait. The next Electric character paid there costs1 less Motion, minimum1, and arrives with+2. Actions and movement do not count.',
  stakeout:
    'Deploy: watch both other lanes through the following interval. Cancel the first enemy On Reveal attempted in either, then close both. The paid fighter still deploys immediately. If Sherlock is still active, he and the weakest other friendly fighter anywhere gain+2 each.',
  'still-breathing':
    'Deploy: heal up to3 actual damage on the weakest injured friendly fighter here and Protect it; otherwise Protect the weakest other local ally. Also Protect every active friendly Sherlock and give him+2.',
  'asset-seizure':
    'Deploy: in one defended package confiscate up to8 removable bonus Hands from the most-boosted local enemy and apply a10-second movement Lock. If no enemy is boosted, Lock and Weaken the strongest. Confiscation cannot take printed Hands or create healing credit.',
  'take-a-number':
    'Deploy: gain+1 and post one ticket here through the next interval. The next enemy real On Reveal here is deferred only until the next pulse; its paid deployment, movement and subsequent player inputs remain immediate. The ability resolves only if that fighter remains active. No repeat deferral.',
  'belt-check':
    'Deploy: in one defended package attempt3 damage on the strongest local enemy, then move the surviving actual recipient into the next legal lane by lane order. If actual damage landed but a survivor cannot move, gain+2 once for this deployment.',
  'we-outside':
    'While active: after the first actual enemy hit on another local ally per10-second pulse, Protect your weakest movable fighter in another lane, then try to bring it here. Blocked hits do not count; normal exits and movement restrictions still apply.',
  'fold-out-justice':
    'While active, once per card identity per match: after an enemy damages another local ally or its personal Protection blocks an enemy ability, attempt3 damage on the attacker and Protect your weakest surviving other local ally.',
  'chain-reaction':
    'Deploy: attempt2 Burn on the strongest local enemy and, only if new Burn lands, prime it through the following interval. Its next actual Burn damage or earlier defeat by your side consumes the primer and splashes2 on the weakest other enemy in its lane. Splash cannot recursively fire another primer.',
  objection:
    'Deploy: cleanse the weakest other local ally and grant an Appeal through the following interval. Its next new harmful-status package waits until the next pulse. Moving or cleansing that client before then dismisses the pending package and issues one local1-Motion character discount at its current lane, minimum1.',
  'high-expectations':
    'Deploy: the weakest other local untutored ally gains+1. At the following interval end, if its net stored Hands are at least2 above that post-help value, it gains Protection and+2. One current goal per side; each friendly card identity may be tutored once per match.',
  'not-on-list':
    'Deploy: target the strongest active Ongoing enemy here, otherwise the strongest enemy. Through normal hostile defenses, try to move the actual recipient to its weakest other legal lane. No free movement past defenders or movement restrictions.',
  'mall-rules':
    'Deploy: leave one Warning here per side through the following interval. The next enemy real fighter paid here, moving here, or making an otherwise-legal departure takes1 damage. The Warning is spent even if blocked. Only actual damage gives a surviving active Rent-a-Cop+1.',
  'wrong-address':
    'Deploy: once per source card identity per match, leave one shared Decoy here through the following interval. The next enemy real paid/movement arrival takes1 damage. Only actual damage lets an active surviving Boo Boo move to its weakest other legal lane and gain+1 after arrival.',
  violation:
    'Deploy: attempt a source-owned movement-only Curfew on the strongest local enemy through the following interval. Also leave one Check-In here per side: the first enemy movement arrival each10-second pulse takes2 damage. Paid arrivals cannot spend Check-In. Cleansing dismisses Curfew.',
  'he-just-a-friend':
    'Deploy: if the strongest enemy here has more effective Hands than this fighter, try to force it to its weakest other legal lane; gain+1 only if the actual recipient arrives. Otherwise Protect your weakest other local ally.',
  'you-up':
    "Deploy: once per card identity per match, mark the strongest enemy anywhere for one chase at the next pulse. If this fighter remains active, move to that target's current lane if legal and attempt2 only after arriving or if already there. During the final30 seconds, attempt2 on the strongest local enemy immediately instead.",
  'pay-what-you-owe':
    'Deploy: attempt to confiscate up to6 removable bonus Hands from the most-boosted local enemy and gain only what was taken. If nobody is boosted, leave one shared Audit here through the following interval: the next enemy real character paid here costs+2 Motion. No printed Hands or healing credit can be confiscated.',
} as const;
export const CONTROL_ADAPTERS = {
  'bottle-girl': { ability: 'last-call', triggers: ['entrance'] },
  landlord: { ability: 'rent-due', triggers: ['ongoing'] },
  promoter: { ability: 'guest-list', triggers: ['entrance', 'ongoing'] },
  'chess-regular': { ability: 'fork', triggers: ['entrance'] },
  'goth-kid': { ability: 'dead-air', triggers: ['entrance', 'ongoing'] },
  'stoner-sr': { ability: 'pass-it-around', triggers: ['entrance'] },
  'seafood-assassin': { ability: 'extra-sauce', triggers: ['entrance'] },
  'god-of-hookah': {
    ability: 'pass-the-hose',
    triggers: ['entrance', 'ongoing'],
  },
  'the-mailman': { ability: 'express-delivery', triggers: ['ongoing'] },
  sherlock: { ability: 'stakeout', triggers: ['entrance'] },
  watson: { ability: 'still-breathing', triggers: ['entrance'] },
  'the-feds': { ability: 'asset-seizure', triggers: ['entrance'] },
  'dmv-worker': { ability: 'take-a-number', triggers: ['entrance'] },
  'p-tang': { ability: 'belt-check', triggers: ['entrance'] },
  'revolutionary-ronald': { ability: 'we-outside', triggers: ['ongoing'] },
  'juneteenth-chair-guy': {
    ability: 'fold-out-justice',
    triggers: ['ongoing'],
  },
  'redneck-evil': { ability: 'chain-reaction', triggers: ['entrance'] },
  lawyer: { ability: 'objection', triggers: ['entrance'] },
  'nigerian-father': { ability: 'high-expectations', triggers: ['entrance'] },
  bouncer: { ability: 'not-on-list', triggers: ['entrance'] },
  'rent-a-cop': { ability: 'mall-rules', triggers: ['entrance'] },
  'boo-boo-the-fool': { ability: 'wrong-address', triggers: ['entrance'] },
  'parole-officer': { ability: 'violation', triggers: ['entrance'] },
  'he-just-a-friend': { ability: 'he-just-a-friend', triggers: ['entrance'] },
  'crazy-ex-boyfriend': {
    ability: 'you-up',
    triggers: ['entrance', 'ongoing'],
  },
  'uncle-sam': { ability: 'pay-what-you-owe', triggers: ['entrance'] },
} as const;
export type ControlAbility = keyof typeof CONTROL_ABILITY_DESCRIPTIONS;
export interface ControlStatusChange {
  kind: 'burn' | 'freeze' | 'silence' | 'weaken' | 'lock';
  stacks?: number;
  durationMs?: number;
  startsAt?: number;
  stackCap?: number;
  /** Preserve the author of movement-only contracts during an Appeal. */
  sourceId?: string;
}
interface Mark {
  id: number;
  source: Unit;
  expiresAt: number;
}
interface LaneMark extends Mark {
  lane: Lane;
}
interface Discount extends Mark {
  kind: 'poison' | 'other-lane' | 'local-character' | 'electric-package';
  lane: Lane;
}
interface Appeal extends Mark {
  targetId: string;
  pending?: { source: Unit; changes: ControlStatusChange[]; readyAt: number };
}
export interface ControlMatchState {
  nextId: number;
  discounts: Discount[];
  taxes: Record<string, number>;
  audits: LaneMark[];
  forks: (Mark & { targets: string[]; complete: boolean })[];
  goths: LaneMark[];
  stoners: (LaneMark & { seen: string[]; stage: number; smaller: boolean })[];
  stakeouts: (Mark & { lanes: Lane[] })[];
  tickets: LaneMark[];
  deferred: { targetId: string; readyAt: number }[];
  deferredIds: Record<string, true>;
  warnings: LaneMark[];
  decoys: LaneMark[];
  checkins: (LaneMark & { spentPulse: number })[];
  appeals: Appeal[];
  goals: (Mark & { targetId: string; targetHands: number; dueAt: number })[];
  primers: (Mark & { targetId: string })[];
  chases: (Mark & { targetId: string; readyAt: number })[];
  used: Record<string, true>;
  pulses: Record<string, number>;
  electric: Record<Side, { pulse: number; count: number }>;
  burnLanes: Record<string, { side: Side; lane: Lane }>;
  lastPulse: number;
}
type Card = Pick<
  FighterDefinition,
  'id' | 'cost' | 'kind' | 'element' | 'engineId'
> & { ability?: string };
export interface ControlContext {
  state: GameState & { control?: ControlMatchState };
  definition(unit: Unit): Card;
  active(unit: Unit): boolean;
  effectiveHands(unit: Unit): number;
  ongoing(unit: Unit): boolean;
  hasEntrance(unit: Unit): boolean;
  isAfflicted(unit: Unit): boolean;
  gain(unit: Unit, amount: number, copied?: boolean, source?: Unit): void;
  protect(unit: Unit): void;
  cleanse(unit: Unit, source?: Unit): void;
  /** Consume only Burn, preserving Freeze, Silence, Weaken and movement locks. */
  clearBurn(unit: Unit): void;
  heal(unit: Unit, cap: number, source?: Unit): number;
  strike(
    source: Unit,
    target: Unit,
    amount: number,
    options?: { splash?: boolean },
  ): number;
  hostilePackage(
    source: Unit,
    target: Unit,
    apply: (actualTarget: Unit) => void,
    kind?: 'harm' | 'staff-exit',
  ): boolean;
  rawDamage(
    source: Unit,
    target: Unit,
    amount: number,
    options?: { burn?: boolean; splash?: boolean },
  ): number;
  rawBonus(source: Unit, target: Unit, cap: number): number;
  rawStatus(source: Unit, target: Unit, change: ControlStatusChange): boolean;
  burn(
    source: Unit,
    target: Unit,
    stacks: number,
    options?: { startsAt?: number },
  ): boolean;
  removableBonus(unit: Unit): number;
  move(unit: Unit, lane: Lane): boolean;
  openForMove(unit: Unit, lane: Lane): boolean;
  /** Forced move without another ability shield; still checks movement and exits. */
  rawMove(source: Unit, target: Unit, lane: Lane): boolean;
  resolveEntrance(unit: Unit, options: { deferred: true }): boolean;
  event(event: Omit<BattleEvent, 'id'>): void;
  isToken?(unit: Unit): boolean;
}
export interface ControlCostQuote {
  cost: number;
  discountId?: number;
  landlordId?: string;
  auditId?: number;
  bonusHands: number;
}
const SIDES: readonly Side[] = ['player', 'opponent'];
const LANES: readonly Lane[] = [0, 1, 2];
function runtime(ctx: ControlContext): ControlMatchState {
  return (ctx.state.control ??= {
    nextId: 1,
    discounts: [],
    taxes: {},
    audits: [],
    forks: [],
    goths: [],
    stoners: [],
    stakeouts: [],
    tickets: [],
    deferred: [],
    deferredIds: {},
    warnings: [],
    decoys: [],
    checkins: [],
    appeals: [],
    goals: [],
    primers: [],
    chases: [],
    used: {},
    pulses: {},
    electric: {
      player: { pulse: -1, count: 0 },
      opponent: { pulse: -1, count: 0 },
    },
    burnLanes: {},
    lastPulse: Math.floor(ctx.state.elapsedMs / CONTROL_PULSE_MS),
  });
}
export function cloneControlState(
  value?: ControlMatchState,
): ControlMatchState | undefined {
  return value ? structuredClone(value) : undefined;
}
const pulse = (ctx: ControlContext) =>
  Math.floor(ctx.state.elapsedMs / CONTROL_PULSE_MS);
const expiry = (ctx: ControlContext) => (pulse(ctx) + 2) * CONTROL_PULSE_MS;
const identity = (u: Unit) => `${u.side}:${u.cardId}`;
const mark = (u: Unit) => ({
  sourceUnitId: u.id,
  sourceSide: u.side,
  sourceLane: u.lane,
  sourcePosition: u.position,
});
const real = (ctx: ControlContext, u: Unit) =>
  !ctx.isToken?.(u) && (ctx.definition(u).kind ?? 'character') === 'character';
const board = (ctx: ControlContext) =>
  ctx.state.units.filter((u) => u.hands > 0 && real(ctx, u));
const low = (ctx: ControlContext, xs: readonly Unit[]) =>
  [...xs].sort(
    (a, b) =>
      ctx.effectiveHands(a) - ctx.effectiveHands(b) || a.id.localeCompare(b.id),
  )[0];
const high = (ctx: ControlContext, xs: readonly Unit[]) =>
  [...xs].sort(
    (a, b) =>
      ctx.effectiveHands(b) - ctx.effectiveHands(a) || a.id.localeCompare(b.id),
  )[0];
const allies = (ctx: ControlContext, u: Unit, local = true) =>
  board(ctx).filter(
    (x) => x.side === u.side && x.id !== u.id && (!local || x.lane === u.lane),
  );
const enemies = (ctx: ControlContext, u: Unit, local = true) =>
  board(ctx).filter((x) => x.side !== u.side && (!local || x.lane === u.lane));
const sources = (ctx: ControlContext, side: Side, ability: ControlAbility) =>
  board(ctx)
    .filter(
      (u) =>
        u.side === side &&
        ctx.active(u) &&
        ctx.definition(u).ability === ability,
    )
    .sort((a, b) => a.id.localeCompare(b.id));
function laneScore(ctx: ControlContext, side: Side, lane: Lane) {
  return board(ctx)
    .filter((u) => u.side === side && u.lane === lane)
    .reduce((n, u) => n + ctx.effectiveHands(u), 0);
}
function destinations(ctx: ControlContext, u: Unit) {
  return LANES.filter((l) => l !== u.lane && ctx.openForMove(u, l)).sort(
    (a, b) => laneScore(ctx, u.side, a) - laneScore(ctx, u.side, b) || a - b,
  );
}
function snapshotSource(source: Unit): Unit {
  const copy = structuredClone(source);
  // Action actors never tick; keep their saved provenance JSON/replay safe.
  if (!Number.isFinite(copy.nextEffectAt)) copy.nextEffectAt = 0;
  return copy;
}
function makeMark(ctx: ControlContext, source: Unit): Mark {
  return {
    id: runtime(ctx).nextId++,
    source: snapshotSource(source),
    expiresAt: expiry(ctx),
  };
}
function give(
  ctx: ControlContext,
  source: Unit,
  target: Unit | undefined,
  n: number,
) {
  if (target && target.hands > 0 && n > 0) ctx.gain(target, n, false, source);
}
function note(
  ctx: ControlContext,
  source: Unit,
  text: string,
  target = source,
  type = 'control',
) {
  ctx.event({
    type,
    side: target.side,
    lane: target.lane,
    position: target.position,
    targetUnitId: target.id,
    cardId: target.cardId,
    ...mark(source),
    text,
  });
}
function putLane(
  ctx: ControlContext,
  store: 'warnings' | 'tickets' | 'goths' | 'audits',
  source: Unit,
) {
  const d = runtime(ctx);
  d[store] = d[store].filter(
    (x) => x.source.side !== source.side || x.lane !== source.lane,
  );
  d[store].push({ ...makeMark(ctx, source), lane: source.lane });
}
function discount(
  ctx: ControlContext,
  source: Unit,
  kind: Discount['kind'],
  lane: Lane,
  expiresAt = Infinity,
) {
  const d = runtime(ctx);
  d.discounts = d.discounts.filter(
    (x) =>
      !(
        x.source.side === source.side &&
        x.kind === kind &&
        (kind !== 'local-character' || x.lane === lane)
      ),
  );
  d.discounts.push({
    ...makeMark(ctx, source),
    kind,
    lane,
    expiresAt: Number.isFinite(expiresAt) ? expiresAt : ctx.state.durationMs,
  });
}
/** Pure quote: no tax charge, hand mutation, trap use or source reward. */
export function controlQuoteCost(
  ctx: ControlContext,
  side: Side,
  cardId: string,
  lane: Lane,
  baseCost: number,
  allowDiscount = true,
): ControlCostQuote {
  const card = ctx.state.roster.find((c) => c.id === cardId);
  if (!card) return { cost: Infinity, bonusHands: 0 };
  const d = ctx.state.control,
    now = pulse(ctx),
    character = (card.kind ?? 'character') === 'character';
  const token = allowDiscount
    ? d?.discounts
        .filter(
          (x) =>
            x.source.side === side &&
            x.expiresAt > ctx.state.elapsedMs &&
            (x.kind === 'other-lane'
              ? x.lane !== lane
              : x.kind === 'poison'
                ? character && card.element === 'Poison'
                : x.kind === 'local-character'
                  ? character && x.lane === lane
                  : character &&
                    card.element === 'Electric' &&
                    x.lane === lane),
        )
        .sort((a, b) => a.id - b.id)[0]
    : undefined;
  const min = token?.kind === 'other-lane' ? 0 : 1;
  const discounted = token
    ? Math.max(Math.min(baseCost, min), baseCost - 1)
    : baseCost;
  const other: Side = side === 'player' ? 'opponent' : 'player';
  const landlord = sources(ctx, other, 'rent-due').find(
    (u) => u.lane === lane && d?.taxes[identity(u)] !== now,
  );
  const audit = character
    ? d?.audits.find(
        (x) =>
          x.source.side !== side &&
          x.lane === lane &&
          x.expiresAt > ctx.state.elapsedMs,
      )
    : undefined;
  return {
    cost: discounted + (landlord ? 1 : 0) + (audit ? 2 : 0),
    ...(token ? { discountId: token.id } : {}),
    ...(landlord ? { landlordId: landlord.id } : {}),
    ...(audit ? { auditId: audit.id } : {}),
    bonusHands: token?.kind === 'electric-package' ? 2 : 0,
  };
}
/** Call exactly after the quoted total was paid. It never deducts Motion itself. */
export function controlSpendCost(
  ctx: ControlContext,
  quote: ControlCostQuote,
): number {
  const d = runtime(ctx);
  const spentDiscount = d.discounts.find((x) => x.id === quote.discountId);
  if (quote.discountId !== undefined)
    d.discounts = d.discounts.filter((x) => x.id !== quote.discountId);
  if (quote.auditId !== undefined)
    d.audits = d.audits.filter((x) => x.id !== quote.auditId);
  const landlord = board(ctx).find(
    (u) => u.id === quote.landlordId && ctx.active(u),
  );
  if (landlord && d.taxes[identity(landlord)] !== pulse(ctx)) {
    d.taxes[identity(landlord)] = pulse(ctx);
    give(ctx, landlord, landlord, 1);
  }
  return spentDiscount?.kind === 'electric-package' ? 2 : 0;
}
export function controlEntrance(
  ctx: ControlContext,
  unit: Unit,
  echoed = false,
): boolean | undefined {
  const ability = ctx.definition(unit).ability;
  if (!Object.hasOwn(CONTROL_ABILITY_DESCRIPTIONS, ability ?? ''))
    return undefined;
  if (!ctx.active(unit) || unit.hands <= 0) return false;
  const d = runtime(ctx),
    local = allies(ctx, unit),
    foes = enemies(ctx, unit);
  switch (ability) {
    case 'last-call':
      if (ctx.state.elapsedMs >= 30000) give(ctx, unit, unit, 2);
      discount(ctx, unit, 'poison', unit.lane, expiry(ctx));
      return true;
    case 'guest-list': {
      const side: Side = unit.side === 'player' ? 'opponent' : 'player';
      const id = [...ctx.state.players[side].hand].sort()[0],
        card = ctx.state.roster.find((c) => c.id === id);
      if (!card) return false;
      ctx.event({
        type: 'reveal',
        visibleTo: unit.side,
        side: unit.side,
        cardId: card.id,
        ...mark(unit),
        text: `${card.name} · ${card.cost} MOTION`,
      });
      if (card.cost >= 4) discount(ctx, unit, 'other-lane', unit.lane);
      return true;
    }
    case 'fork': {
      const targets = LANES.map((lane) =>
        high(
          ctx,
          enemies(ctx, unit, false).filter((u) => u.lane === lane),
        ),
      )
        .filter((u): u is Unit => !!u)
        .slice(0, 2);
      if (!targets.length) return false;
      d.forks = d.forks.filter((x) => x.source.side !== unit.side);
      d.forks.push({
        ...makeMark(ctx, unit),
        targets: targets.map((u) => u.id),
        complete: targets.length === 2,
      });
      return true;
    }
    case 'dead-air': {
      const lane = LANES.find(
        (l) =>
          l !== unit.lane &&
          !board(ctx).some((u) => u.lane === l) &&
          ctx.openForMove(unit, l),
      );
      if (lane !== undefined && ctx.move(unit, lane)) {
        putLane(ctx, 'goths', unit);
        d.goths.find((x) => x.source.id === unit.id)!.expiresAt =
          ctx.state.durationMs;
        return true;
      }
      const target = low(
        ctx,
        foes.filter((u) => ctx.definition(u).cost <= 3),
      );
      let landed = false;
      if (target)
        ctx.hostilePackage(unit, target, (actual) => {
          landed = ctx.rawStatus(unit, actual, {
            kind: 'silence',
            durationMs: 10000,
          });
        });
      return landed;
    }
    case 'pass-it-around': {
      const target = low(
        ctx,
        board(ctx).filter(
          (u) =>
            u.side === unit.side && u.lane === unit.lane && ctx.isAfflicted(u),
        ),
      );
      let cleansed = false;
      if (target) {
        const dirty = ctx.isAfflicted(target);
        ctx.cleanse(target, unit);
        cleansed = dirty && !ctx.isAfflicted(target);
      }
      d.stoners = d.stoners.filter(
        (x) => x.source.side !== unit.side || x.lane !== unit.lane,
      );
      d.stoners.push({
        ...makeMark(ctx, unit),
        lane: unit.lane,
        seen: [],
        stage: 0,
        smaller: cleansed,
      });
      return true;
    }
    case 'extra-sauce': {
      let changed = false;
      for (const target of foes)
        ctx.hostilePackage(unit, target, (actual) => {
          const added = ctx.rawStatus(unit, actual, {
            kind: 'burn',
            stacks: 2,
            durationMs: 6000,
          });
          const stacks = actual.burnStacks ?? 0;
          if (stacks) {
            ctx.clearBurn(actual);
            changed =
              ctx.rawDamage(unit, actual, stacks, { burn: true }) > 0 ||
              added ||
              changed;
          }
        });
      return changed;
    }
    case 'pass-the-hose': {
      const target = low(
        ctx,
        enemies(ctx, unit, false).filter(
          (u) => u.lane !== unit.lane && !(u.burnStacks ?? 0),
        ),
      );
      return !!target && ctx.burn(unit, target, 1);
    }
    case 'stakeout':
      d.stakeouts = d.stakeouts.filter((x) => x.source.side !== unit.side);
      d.stakeouts.push({
        ...makeMark(ctx, unit),
        lanes: LANES.filter((l) => l !== unit.lane),
      });
      return true;
    case 'still-breathing': {
      const target =
        low(
          ctx,
          board(ctx).filter(
            (u) =>
              u.side === unit.side &&
              u.lane === unit.lane &&
              (u.damageTaken ?? 0) > 0 &&
              u.hands < u.maxHands,
          ),
        ) ?? low(ctx, local);
      if (target) {
        ctx.heal(target, 3, unit);
        ctx.protect(target);
      }
      const detectives = board(ctx).filter(
        (u) =>
          u.side === unit.side &&
          ctx.definition(u).id === 'sherlock' &&
          ctx.active(u),
      );
      for (const detective of detectives) {
        ctx.protect(detective);
        give(ctx, unit, detective, 2);
      }
      return !!target || detectives.length > 0;
    }
    case 'asset-seizure': {
      const boosted = [...foes]
        .filter((u) => ctx.removableBonus(u) > 0)
        .sort(
          (a, b) =>
            ctx.removableBonus(b) - ctx.removableBonus(a) ||
            b.hands - a.hands ||
            a.id.localeCompare(b.id),
        )[0];
      const target = boosted ?? high(ctx, foes);
      let changed = false;
      if (target)
        ctx.hostilePackage(unit, target, (actual) => {
          if (boosted) changed = ctx.rawBonus(unit, actual, 8) > 0;
          changed =
            ctx.rawStatus(unit, actual, { kind: 'lock', durationMs: 10000 }) ||
            changed;
          if (!boosted)
            changed =
              ctx.rawStatus(unit, actual, {
                kind: 'weaken',
                durationMs: 10000,
              }) || changed;
        });
      return changed;
    }
    case 'take-a-number':
      putLane(ctx, 'tickets', unit);
      give(ctx, unit, unit, 1);
      return true;
    case 'belt-check': {
      const target = high(ctx, foes);
      let changed = false;
      if (target)
        ctx.hostilePackage(unit, target, (actual) => {
          const damage = ctx.rawDamage(unit, actual, 3);
          changed = damage > 0;
          if (actual.hands <= 0) return;
          const lane = LANES.find(
            (l) => l !== actual.lane && ctx.openForMove(actual, l),
          );
          if (lane !== undefined && ctx.rawMove(unit, actual, lane)) {
            changed = true;
            return;
          }
          if (damage > 0 && !d.used[`belt:${unit.id}`]) {
            d.used[`belt:${unit.id}`] = true;
            give(ctx, unit, unit, 2);
          }
        });
      return changed;
    }
    case 'chain-reaction': {
      const target = high(ctx, foes);
      let landed = false;
      if (target)
        ctx.hostilePackage(unit, target, (actual) => {
          landed = ctx.rawStatus(unit, actual, {
            kind: 'burn',
            stacks: 2,
            durationMs: 6000,
          });
          if (landed && !d.primers.some((x) => x.targetId === actual.id))
            d.primers.push({ ...makeMark(ctx, unit), targetId: actual.id });
        });
      return landed;
    }
    case 'objection': {
      const target = low(ctx, local);
      if (!target) return false;
      ctx.cleanse(target, unit);
      d.appeals = d.appeals.filter((x) => x.targetId !== target.id);
      d.appeals.push({ ...makeMark(ctx, unit), targetId: target.id });
      return true;
    }
    case 'high-expectations': {
      if (d.goals.some((x) => x.source.side === unit.side)) return false;
      const target = low(
        ctx,
        local.filter((u) => !d.used[`tutor:${identity(u)}`]),
      );
      if (!target) return false;
      d.used[`tutor:${identity(target)}`] = true;
      give(ctx, unit, target, 1);
      d.goals.push({
        ...makeMark(ctx, unit),
        targetId: target.id,
        targetHands: target.hands + 2,
        dueAt: (pulse(ctx) + 2) * CONTROL_PULSE_MS,
      });
      return true;
    }
    case 'not-on-list': {
      const ongoing = high(
          ctx,
          foes.filter((u) => ctx.active(u) && ctx.ongoing(u)),
        ),
        target = ongoing ?? high(ctx, foes);
      let moved = false;
      if (target)
        ctx.hostilePackage(
          unit,
          target,
          (actual) => {
            const lane = destinations(ctx, actual)[0];
            if (lane !== undefined) moved = ctx.rawMove(unit, actual, lane);
          },
          'staff-exit',
        );
      return moved;
    }
    case 'mall-rules':
      putLane(ctx, 'warnings', unit);
      return true;
    case 'wrong-address': {
      const key = `decoy:${identity(unit)}`;
      if (d.used[key]) return false;
      d.used[key] = true;
      d.decoys = d.decoys.filter((x) => x.source.side !== unit.side);
      d.decoys.push({ ...makeMark(ctx, unit), lane: unit.lane });
      return true;
    }
    case 'violation': {
      const target = high(ctx, foes);
      if (target)
        ctx.hostilePackage(unit, target, (actual) => {
          ctx.rawStatus(unit, actual, {
            kind: 'lock',
            durationMs: expiry(ctx) - ctx.state.elapsedMs,
          });
        });
      const old = d.checkins.find(
        (x) => x.source.side === unit.side && x.lane === unit.lane,
      );
      d.checkins = d.checkins.filter((x) => x !== old);
      d.checkins.push({
        ...makeMark(ctx, unit),
        lane: unit.lane,
        spentPulse: old?.spentPulse ?? -1,
      });
      return true;
    }
    case 'he-just-a-friend': {
      const target = high(ctx, foes);
      if (target && ctx.effectiveHands(target) > ctx.effectiveHands(unit)) {
        let moved = false;
        ctx.hostilePackage(
          unit,
          target,
          (actual) => {
            const lane = destinations(ctx, actual)[0];
            if (lane !== undefined) moved = ctx.rawMove(unit, actual, lane);
          },
          'staff-exit',
        );
        if (moved) give(ctx, unit, unit, 1);
        return moved;
      }
      const ally = low(ctx, local);
      if (ally) ctx.protect(ally);
      return !!ally;
    }
    case 'you-up': {
      if (ctx.state.durationMs - ctx.state.elapsedMs <= 30000) {
        const target = high(ctx, foes);
        return !!target && ctx.strike(unit, target, 2) > 0;
      }
      const target = high(ctx, enemies(ctx, unit, false)),
        key = `chase:${identity(unit)}`;
      if (!target || d.used[key]) return false;
      d.used[key] = true;
      d.chases = d.chases.filter((x) => x.source.side !== unit.side);
      d.chases.push({
        ...makeMark(ctx, unit),
        targetId: target.id,
        readyAt: (pulse(ctx) + 1) * CONTROL_PULSE_MS,
      });
      return true;
    }
    case 'pay-what-you-owe': {
      const target = [...foes]
        .filter((u) => ctx.removableBonus(u) > 0)
        .sort(
          (a, b) =>
            ctx.removableBonus(b) - ctx.removableBonus(a) ||
            a.id.localeCompare(b.id),
        )[0];
      if (target) {
        let amount = 0;
        ctx.hostilePackage(unit, target, (actual) => {
          amount = ctx.rawBonus(unit, actual, 6);
        });
        give(ctx, unit, unit, amount);
        return amount > 0;
      }
      d.audits = d.audits.filter((x) => x.source.side !== unit.side);
      d.audits.push({ ...makeMark(ctx, unit), lane: unit.lane });
      return true;
    }
    case 'rent-due':
    case 'express-delivery':
    case 'we-outside':
    case 'fold-out-justice':
      return false;
  }
  return false;
}
export function controlBeforeEntrance(
  ctx: ControlContext,
  unit: Unit,
  deferred = false,
): { cancelled?: boolean; delayUntil?: number } {
  if (
    deferred ||
    !real(ctx, unit) ||
    !ctx.active(unit) ||
    !ctx.hasEntrance(unit)
  )
    return {};
  const d = runtime(ctx);
  const stakeout = d.stakeouts.find(
    (x) =>
      x.source.side !== unit.side &&
      x.lanes.includes(unit.lane) &&
      x.expiresAt > ctx.state.elapsedMs,
  );
  if (stakeout) {
    d.stakeouts = d.stakeouts.filter((x) => x !== stakeout);
    const detective = board(ctx).find(
      (u) => u.id === stakeout.source.id && ctx.active(u),
    );
    if (detective) {
      give(ctx, detective, detective, 2);
      give(ctx, detective, low(ctx, allies(ctx, detective, false)), 2);
    }
    note(
      ctx,
      stakeout.source,
      'STAKEOUT · ENTRANCE CANCELED',
      unit,
      'entrance-cancelled',
    );
    return { cancelled: true };
  }
  const ticket = d.tickets.find(
    (x) =>
      x.source.side !== unit.side &&
      x.lane === unit.lane &&
      x.expiresAt > ctx.state.elapsedMs,
  );
  if (!ticket || d.deferredIds[unit.id]) return {};
  d.tickets = d.tickets.filter((x) => x !== ticket);
  d.deferredIds[unit.id] = true;
  const readyAt = Math.min(
    (pulse(ctx) + 1) * CONTROL_PULSE_MS,
    ctx.state.durationMs,
  );
  d.deferred.push({ targetId: unit.id, readyAt });
  note(
    ctx,
    ticket.source,
    'TAKE A NUMBER · ABILITY WAITS',
    unit,
    'entrance-delayed',
  );
  return { delayUntil: readyAt };
}
function warning(ctx: ControlContext, unit: Unit, lane: Lane) {
  const d = runtime(ctx),
    x = d.warnings.find(
      (x) =>
        x.source.side !== unit.side &&
        x.lane === lane &&
        x.expiresAt > ctx.state.elapsedMs,
    );
  if (!x) return;
  d.warnings = d.warnings.filter((y) => y !== x);
  const actual = ctx.strike(x.source, unit, 1),
    rent = board(ctx).find((u) => u.id === x.source.id && ctx.active(u));
  if (actual > 0 && rent) give(ctx, rent, rent, 1);
}
/** Legal departures only. A fatal warning prevents movement, never retroactively
 * rejects a paid deployment or blocks another player's next command. */
export function controlBeforeMove(
  ctx: ControlContext,
  unit: Unit,
  destination: Lane,
): boolean {
  if (!real(ctx, unit) || unit.hands <= 0 || destination === unit.lane)
    return unit.hands > 0;
  warning(ctx, unit, unit.lane);
  return unit.hands > 0;
}
export function controlArrived(
  ctx: ControlContext,
  unit: Unit,
  kind: 'played' | 'moved' = 'played',
): void {
  if (!real(ctx, unit) || unit.hands <= 0) return;
  const d = runtime(ctx);
  warning(ctx, unit, unit.lane);
  if (unit.hands <= 0) return;
  for (const x of [...d.stoners])
    if (
      x.source.side === unit.side &&
      x.lane === unit.lane &&
      x.source.id !== unit.id &&
      x.expiresAt > ctx.state.elapsedMs &&
      !x.seen.includes(unit.id)
    ) {
      x.seen.push(unit.id);
      const amount = x.stage === 0 ? 4 : 1;
      x.stage++;
      if (!x.smaller || x.stage >= 2)
        d.stoners = d.stoners.filter((y) => y !== x);
      give(ctx, x.source, unit, amount);
    }
  const goth = d.goths.find(
    (x) =>
      x.source.side !== unit.side &&
      x.lane === unit.lane &&
      x.expiresAt > ctx.state.elapsedMs &&
      board(ctx).some(
        (u) => u.id === x.source.id && u.lane === x.lane && ctx.active(u),
      ),
  );
  if (goth) {
    d.goths = d.goths.filter((x) => x !== goth);
    ctx.hostilePackage(goth.source, unit, (actual) => {
      ctx.rawStatus(goth.source, actual, {
        kind: 'silence',
        durationMs: 10000,
      });
    });
  }
  const decoy = d.decoys.find(
    (x) =>
      x.source.side !== unit.side &&
      x.lane === unit.lane &&
      x.expiresAt > ctx.state.elapsedMs,
  );
  if (decoy) {
    d.decoys = d.decoys.filter((x) => x !== decoy);
    const amount = ctx.strike(decoy.source, unit, 1);
    const boo = board(ctx).find(
      (u) => u.id === decoy.source.id && ctx.active(u),
    );
    if (amount > 0 && boo) {
      const lane = destinations(ctx, boo)[0];
      if (lane !== undefined && ctx.move(boo, lane)) give(ctx, boo, boo, 1);
    }
  }
  if (kind === 'moved') {
    const check = d.checkins.find(
      (x) =>
        x.source.side !== unit.side &&
        x.lane === unit.lane &&
        x.expiresAt > ctx.state.elapsedMs &&
        x.spentPulse !== pulse(ctx),
    );
    if (check) {
      check.spentPulse = pulse(ctx);
      ctx.strike(check.source, unit, 2);
    }
  }
}
export function controlMoved(
  ctx: ControlContext,
  unit: Unit,
  oldLane: Lane,
): void {
  if (oldLane === unit.lane || !real(ctx, unit) || unit.hands <= 0) return;
  controlCleansed(ctx, unit);
  controlArrived(ctx, unit, 'moved');
  const d = runtime(ctx),
    eligible =
      ctx.definition(unit).element === 'Air' ||
      ['bottle-girl', 'pirate-radio-dj', 'dance-captain'].includes(
        ctx.definition(unit).id,
      );
  if (eligible && d.pulses[`promoter:${unit.side}`] !== pulse(ctx)) {
    const promoter = sources(ctx, unit.side, 'guest-list')[0];
    if (promoter) {
      d.pulses[`promoter:${unit.side}`] = pulse(ctx);
      give(ctx, promoter, unit, 2);
    }
  }
}
/** Real paid character only, after paid lane is known and before its ability. */
export function controlPlayed(ctx: ControlContext, unit: Unit): void {
  if (!real(ctx, unit) || unit.hands <= 0) return;
  const d = runtime(ctx),
    now = pulse(ctx);
  if (ctx.definition(unit).element === 'Electric') {
    const n = d.electric[unit.side];
    if (n.pulse !== now) {
      n.pulse = now;
      n.count = 0;
    }
    n.count++;
    const mail = sources(ctx, unit.side, 'express-delivery')[0];
    if (
      n.count === 2 &&
      mail &&
      !d.discounts.some(
        (x) =>
          x.kind === 'electric-package' &&
          x.source.side === unit.side &&
          x.expiresAt > ctx.state.elapsedMs,
      )
    ) {
      const lane = LANES.filter((l) => l !== unit.lane).sort(
        (a, b) =>
          laneScore(ctx, unit.side, a) - laneScore(ctx, unit.side, b) || a - b,
      )[0];
      if (lane !== undefined) discount(ctx, mail, 'electric-package', lane);
    }
  }
  for (const fork of [...d.forks].filter(
    (x) => x.source.side !== unit.side && x.expiresAt > ctx.state.elapsedMs,
  )) {
    if (!fork.complete) {
      const first = board(ctx).find((u) => u.id === fork.targets[0]);
      if (first && first.lane !== unit.lane) {
        const second = high(
          ctx,
          board(ctx).filter(
            (u) => u.side === unit.side && u.lane === unit.lane,
          ),
        );
        if (second) {
          fork.targets.push(second.id);
          fork.complete = true;
        }
      }
      continue;
    }
    d.forks = d.forks.filter((x) => x !== fork);
    let hit = false;
    for (const id of fork.targets) {
      const target = board(ctx).find((u) => u.id === id);
      if (
        target &&
        target.lane !== unit.lane &&
        ctx.strike(fork.source, target, 2) > 0
      )
        hit = true;
    }
    const chess = board(ctx).find(
      (u) => u.id === fork.source.id && ctx.active(u),
    );
    if (hit && chess) give(ctx, chess, chess, 1);
  }
}
/** Call after ordinary defenses with the new harmful-status deltas of one
 * package. Defer the complete batch together, never just its first field. */
export function controlDeferStatuses(
  ctx: ControlContext,
  source: Unit,
  target: Unit,
  changes: readonly ControlStatusChange[],
): boolean {
  if (source.side === target.side || !changes.length || target.hands <= 0)
    return false;
  const appeal = runtime(ctx).appeals.find(
    (x) =>
      x.targetId === target.id &&
      !x.pending &&
      x.expiresAt > ctx.state.elapsedMs,
  );
  if (!appeal) return false;
  appeal.pending = {
    source: snapshotSource(source),
    changes: changes.map((x) => ({ ...x })),
    readyAt: Math.min(
      (pulse(ctx) + 1) * CONTROL_PULSE_MS,
      ctx.state.durationMs,
    ),
  };
  note(
    ctx,
    appeal.source,
    'OBJECTION · STATUS PENDING',
    target,
    'status-delayed',
  );
  return true;
}
/** Notify even when no visible status exists: dismissing an already-pending
 * Appeal is a real cleanse, and earns a discount at the client's current lane. */
export function controlCleansed(ctx: ControlContext, unit: Unit): void {
  if (unit.hands <= 0) return;
  const d = runtime(ctx),
    appeal = d.appeals.find((x) => x.targetId === unit.id && x.pending);
  if (!appeal) return;
  d.appeals = d.appeals.filter((x) => x !== appeal);
  discount(ctx, appeal.source, 'local-character', unit.lane);
  note(ctx, appeal.source, 'APPEAL DISMISSED · LOCAL DISCOUNT', unit);
}
function chair(ctx: ControlContext, victim: Unit, source: Unit | undefined) {
  const d = runtime(ctx),
    watcher = sources(ctx, victim.side, 'fold-out-justice').find(
      (u) =>
        u.id !== victim.id &&
        u.lane === victim.lane &&
        !d.used[`chair:${identity(u)}`],
    );
  if (!watcher) return;
  d.used[`chair:${identity(watcher)}`] = true;
  if (source && source.hands > 0) ctx.strike(watcher, source, 3);
  const ally = low(ctx, allies(ctx, watcher));
  if (ally) ctx.protect(ally);
}
function splash(
  ctx: ControlContext,
  victim: Unit,
  sourceSide: Side,
  burn: boolean,
  isSplash = false,
) {
  const d = runtime(ctx),
    primer = d.primers.find(
      (x) => x.targetId === victim.id && x.expiresAt > ctx.state.elapsedMs,
    );
  if (
    !primer ||
    isSplash ||
    (!burn && (victim.hands > 0 || primer.source.side !== sourceSide))
  )
    return;
  d.primers = d.primers.filter((x) => x !== primer);
  const target = low(
    ctx,
    board(ctx).filter(
      (u) =>
        u.side === victim.side && u.lane === victim.lane && u.id !== victim.id,
    ),
  );
  if (target) ctx.strike(primer.source, target, 2, { splash: true });
}
export function controlDamaged(
  ctx: ControlContext,
  sourceSide: Side,
  sourceId: string | undefined,
  victim: Unit,
  actual: number,
  options: { burn?: boolean; splash?: boolean } = {},
): void {
  if (actual <= 0 || sourceSide === victim.side || !real(ctx, victim)) return;
  const d = runtime(ctx),
    attacker = board(ctx).find((u) => u.id === sourceId);
  const ronald = sources(ctx, victim.side, 'we-outside').find(
    (u) => u.id !== victim.id && u.lane === victim.lane,
  );
  if (ronald && d.pulses[`ronald:${victim.side}`] !== pulse(ctx)) {
    d.pulses[`ronald:${victim.side}`] = pulse(ctx);
    const backup = low(
      ctx,
      allies(ctx, ronald, false).filter(
        (u) => u.lane !== ronald.lane && ctx.openForMove(u, ronald.lane),
      ),
    );
    if (backup) {
      ctx.protect(backup);
      ctx.move(backup, ronald.lane);
    }
  }
  chair(ctx, victim, attacker);
  splash(ctx, victim, sourceSide, !!options.burn, !!options.splash);
  if (options.burn && sources(ctx, sourceSide, 'pass-the-hose').length)
    d.burnLanes[`${sourceSide}:${victim.lane}`] ??= {
      side: sourceSide,
      lane: victim.lane,
    };
}
export function controlShieldBlocked(
  ctx: ControlContext,
  sourceSide: Side,
  sourceId: string | undefined,
  target: Unit,
): void {
  if (sourceSide !== target.side)
    chair(
      ctx,
      target,
      board(ctx).find((u) => u.id === sourceId),
    );
}
export function controlDestroyed(
  ctx: ControlContext,
  unit: Unit,
  sourceSide?: Side,
  options: { splash?: boolean } = {},
): void {
  if (unit.hands <= 0 && sourceSide && sourceSide !== unit.side)
    splash(ctx, unit, sourceSide, false, !!options.splash);
}
export function controlPulse(ctx: ControlContext): void {
  const d = runtime(ctx),
    now = pulse(ctx);
  while (d.lastPulse < now) {
    const boundary = ++d.lastPulse * CONTROL_PULSE_MS;
    // Snapshot which destinations were already burning before any relay below.
    const burning = new Set(
      board(ctx)
        .filter((u) => (u.burnStacks ?? 0) > 0)
        .map((u) => u.id),
    );
    for (const side of SIDES) {
      const hookah = sources(ctx, side, 'pass-the-hose')[0];
      if (hookah)
        for (const lane of LANES)
          if (d.burnLanes[`${side}:${lane}`]) {
            const next = ((lane + 1) % 3) as Lane,
              foes = board(ctx).filter(
                (u) => u.side !== side && u.lane === next,
              );
            const target = low(
              ctx,
              foes.filter((u) => !burning.has(u.id)),
            );
            if (target)
              ctx.burn(hookah, target, 1, {
                startsAt: boundary + CONTROL_PULSE_MS,
              });
            else if (foes.length && d.pulses[`hose:${side}`] !== d.lastPulse) {
              d.pulses[`hose:${side}`] = d.lastPulse;
              give(ctx, hookah, hookah, 1);
            }
          }
    }
    d.burnLanes = {};
    for (const chase of d.chases.filter((x) => x.readyAt <= boundary)) {
      d.chases = d.chases.filter((x) => x !== chase);
      const ex = board(ctx).find(
          (u) => u.id === chase.source.id && ctx.active(u),
        ),
        target = board(ctx).find((u) => u.id === chase.targetId);
      if (
        ex &&
        target &&
        (ex.lane === target.lane ||
          (ctx.openForMove(ex, target.lane) && ctx.move(ex, target.lane)))
      )
        ctx.strike(ex, target, 2);
    }
  }
  const clock = ctx.state.elapsedMs;
  for (const delayed of d.deferred.filter((x) => x.readyAt <= clock)) {
    d.deferred = d.deferred.filter((x) => x !== delayed);
    const unit = board(ctx).find(
      (u) => u.id === delayed.targetId && ctx.active(u),
    );
    if (unit) ctx.resolveEntrance(unit, { deferred: true });
  }
  for (const appeal of d.appeals.filter(
    (x) => x.pending && x.pending.readyAt <= clock,
  )) {
    d.appeals = d.appeals.filter((x) => x !== appeal);
    const target = board(ctx).find((u) => u.id === appeal.targetId);
    if (target && appeal.pending)
      for (const change of appeal.pending.changes)
        ctx.rawStatus(appeal.pending.source, target, change);
  }
  for (const goal of d.goals.filter(
    (x) => x.dueAt <= clock || clock >= ctx.state.durationMs,
  )) {
    d.goals = d.goals.filter((x) => x !== goal);
    const target = board(ctx).find((u) => u.id === goal.targetId);
    if (target && ctx.effectiveHands(target) >= goal.targetHands) {
      ctx.protect(target);
      give(ctx, goal.source, target, 2);
    }
  }
  for (const store of [
    'discounts',
    'audits',
    'forks',
    'goths',
    'stoners',
    'stakeouts',
    'tickets',
    'warnings',
    'decoys',
    'checkins',
    'goals',
    'primers',
    'chases',
  ] as const)
    d[store] = d[store].filter((x) => x.expiresAt > clock) as never;
  d.appeals = d.appeals.filter((x) => x.expiresAt > clock || !!x.pending);
}
