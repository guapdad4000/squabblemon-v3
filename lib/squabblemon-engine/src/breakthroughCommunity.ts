/** Explicit Family / Everybody Eats rules for deterministic real-time matches. */
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

export const COMMUNITY_PULSE_MS = 10000;
export const COMMUNITY_ABILITY_DESCRIPTIONS = {
  'everybody-loves-me':
    'Deploy: move to your weakest other legal lane. Keep progress and obey ordinary movement restrictions.',
  'back-on-the-block':
    'Deploy: move your weakest other local Fire or Family ally to its weakest other legal lane. A successful arrival grants+2 once per side per10-second pulse; further reveals may still move an ally without another payout.',
  'fix-you-a-plate':
    'Deploy: heal up to3 actual lost Hands and remove Burn from your weakest injured other local Fire or Family ally; Protect it if either succeeds. Otherwise cleanse Burn from the weakest eligible burning ally, or give your weakest eligible ally+3. If alone, reserve+3 for the next other Fire/Family arrival here through the next interval while Auntie remains here and active. Echoes cannot reserve a plate.',
  'not-my-baby':
    'Deploy: your weakest other local Fire or Family ally gains+1 and Protection.',
  'everybody-inside':
    'While active: the first other Fire or Family ally moving into this lane in a10-second pulse gains+3. Three payouts per side per match; copies share the limit.',
  'save-me-some':
    'While active: another local Fire or Family ally genuinely gaining Hands gives this fighter+3, once per10-second pulse and twice per side per match. Copied sharing gains never trigger more sharing.',
  'still-hot':
    'Deploy: apply2 Burn to the strongest enemy here through normal defenses. While active: actual friendly-sourced Burn damage to an enemy here grants this fighter+2 once per10-second pulse, twice per side per match. Separately, the first other Fire/Family ally successfully resolving a non-echo entrance here each pulse attempts1 Burn, twice per side per match.',
  'dinners-ready':
    'Deploy: attempt2 damage on the strongest enemy here, or4 if two distinct friendly fighters moved in this10-second pulse. One successful entrance per instance per match; blocked hits do not spend it.',
  'come-outside':
    'Deploy: attempt1 damage on the strongest enemy here. If actual damage lands and two distinct friendly fighters moved this pulse, attempt1 damage on the strongest enemy in another lane.',
  'built-different':
    'While active: survive the first lethal Hands reduction at1, once per friendly card identity per match; returning never resets it. At each10-second pulse boundary, heal up to2 actual damage. Overkill never becomes recoverable damage.',
  'block-crowned':
    'Deploy: attempt1 damage on each of the3 strongest enemies here. Gain+1 per enemy actually damaged, up to+2. Defenses and damage prevention apply separately to every target.',
  'everybody-eats':
    'Deploy: heal up to4 actual damage on your weakest injured other local ally, otherwise give your weakest other local ally+3. A Homeless recipient is also fully cleansed, gains+2 and Protection. Each friendly card identity may receive one meal per side per match; copies and returns share receipts.',
  'whats-crackin':
    'Deploy: fully cleanse every other friendly fighter. The weakest other friendly fighter in each lane gains+2; the weakest Light ally that was actually afflicted before the cleanse gains another+2. Once per side per match, the weakest Homeless ally in each lane also gains+2 and Protection. This serving is spent only when a Homeless ally is present.',
  'last-bus':
    "Deploy: bring your weakest movable ally from another lane here. Only this driver identity's first successful pickup per match gives the passenger+2; recycling never resets it. Breakthrough has no population cap, and normal movement rules remain.",
  contactless:
    'Deploy: move to your weakest other legal lane. Only the first successful move by this instance can give the weakest other ally at the destination+1; an empty arrival spends that delivery too.',
  'you-hear-me':
    'Deploy: remove only Silence from your weakest silenced other local ally. If none is Silenced, Protect your weakest other local ally instead.',
  'five-finger-discount':
    'Deploy: trim up to1 bonus Hand from the strongest enemy here with removable bonus Hands through normal defenses, then gain only what was actually trimmed. One successful steal per instance per match.',
} as const;
export const COMMUNITY_ADAPTERS = {
  'the-favorite-grandchild': {
    ability: 'everybody-loves-me',
    tacticalRoles: ['support'],
  },
  'cousin-back-from-college': {
    ability: 'back-on-the-block',
    tacticalRoles: ['support'],
  },
  'plate-auntie': { ability: 'fix-you-a-plate', tacticalRoles: ['support'] },
  'church-aunties-rival': {
    ability: 'not-my-baby',
    tacticalRoles: ['support'],
  },
  'big-sister': { ability: 'everybody-inside', tacticalRoles: ['support'] },
  'second-plate-cousin': {
    ability: 'save-me-some',
    tacticalRoles: ['support'],
  },
  'grill-uncle': {
    ability: 'still-hot',
    tacticalRoles: ['support', 'control'],
  },
  'grandma-said-sit-down': {
    ability: 'dinners-ready',
    tacticalRoles: ['control'],
  },
  'group-chat-instigator': {
    ability: 'come-outside',
    tacticalRoles: ['control'],
  },
  'homeless-legend': { ability: 'built-different', tacticalRoles: ['support'] },
  'cracked-head': { ability: 'block-crowned', tacticalRoles: ['control'] },
  'community-cook': { ability: 'everybody-eats', tacticalRoles: ['support'] },
  foodz: { ability: 'whats-crackin', tacticalRoles: ['support'] },
  'night-bus-driver': { ability: 'last-bus', tacticalRoles: ['support'] },
  'delivery-app-cyclist': {
    ability: 'contactless',
    tacticalRoles: ['support'],
  },
  'bluetooth-unc': { ability: 'you-hear-me', tacticalRoles: ['support'] },
  booster: { ability: 'five-finger-discount', tacticalRoles: ['control'] },
} as const;
export type CommunityAbility = keyof typeof COMMUNITY_ABILITY_DESCRIPTIONS;
interface CommunitySource {
  sourceCardId?: string;
  sourceUnitId: string;
  sourceSide: Side;
  sourceLane: Lane;
  sourcePosition: number;
}
interface CommunityPlate extends CommunitySource {
  expiresAt: number;
}
interface CommunitySeat {
  cousinPulse: number;
  sisterPulse: number;
  sisterPayouts: number;
  sharePulse: number;
  sharePayouts: number;
  grillDamagePulse: number;
  grillDamagePayouts: number;
  grillEntrancePulse: number;
  grillEntrancePayouts: number;
  moverPulse: number;
  movers: string[];
  foodServed: boolean;
  mealReceipts: Record<string, true>;
  survivalReceipts: Record<string, true>;
  busReceipts: Record<string, true>;
}
export interface CommunityMatchState {
  seats: Record<Side, CommunitySeat>;
  plates: CommunityPlate[];
  cyclistUsed: Record<string, true>;
  grandmaUsed: Record<string, true>;
  boosterUsed: Record<string, true>;
  lastPulse: number;
  sharing: boolean;
}
type CommunityCard = Pick<
  FighterDefinition,
  'id' | 'kind' | 'element' | 'traits'
> & { ability?: string };
export interface CommunityContext {
  state: GameState & { community?: CommunityMatchState };
  definition(unit: Unit): CommunityCard;
  active(unit: Unit): boolean;
  effectiveHands(unit: Unit): number;
  isAfflicted(unit: Unit): boolean;
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
  move(unit: Unit, lane: Lane): boolean;
  openForMove(unit: Unit, lane: Lane): boolean;
  strike(source: Unit, target: Unit, amount: number): number;
  removableBonus(unit: Unit): number;
  /** Applies normal targeted hostile defenses, returning only actually removed bonus. */
  trimBonus(source: Unit, target: Unit, cap: number): number;
  /** Applies normal targeted hostile defenses and the shared Fire-vs-Plant rule. */
  burn(source: Unit, target: Unit, stacks: number): boolean;
  event(event: Omit<BattleEvent, 'id'>): void;
  isToken?(unit: Unit): boolean;
}
const SIDES: readonly Side[] = ['player', 'opponent'];
const LANES: readonly Lane[] = [0, 1, 2];
const freshSeat = (): CommunitySeat => ({
  cousinPulse: -1,
  sisterPulse: -1,
  sisterPayouts: 0,
  sharePulse: -1,
  sharePayouts: 0,
  grillDamagePulse: -1,
  grillDamagePayouts: 0,
  grillEntrancePulse: -1,
  grillEntrancePayouts: 0,
  moverPulse: -1,
  movers: [],
  foodServed: false,
  mealReceipts: {},
  survivalReceipts: {},
  busReceipts: {},
});
function runtime(ctx: CommunityContext): CommunityMatchState {
  return (ctx.state.community ??= {
    seats: { player: freshSeat(), opponent: freshSeat() },
    plates: [],
    cyclistUsed: {},
    grandmaUsed: {},
    boosterUsed: {},
    lastPulse: Math.floor(ctx.state.elapsedMs / COMMUNITY_PULSE_MS),
    sharing: false,
  });
}
export function cloneCommunityState(
  value?: CommunityMatchState,
): CommunityMatchState | undefined {
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
            mealReceipts: { ...s.mealReceipts },
            survivalReceipts: { ...s.survivalReceipts },
            busReceipts: { ...s.busReceipts },
          },
        ];
      }),
    ) as Record<Side, CommunitySeat>,
    plates: value.plates.map((x) => ({ ...x })),
    cyclistUsed: { ...value.cyclistUsed },
    grandmaUsed: { ...value.grandmaUsed },
    boosterUsed: { ...value.boosterUsed },
    sharing: false,
  };
}
const pulse = (ctx: CommunityContext) =>
  Math.floor(ctx.state.elapsedMs / COMMUNITY_PULSE_MS);
const identity = (unit: Unit) => `${unit.side}:${unit.cardId}`;
const mark = (unit: Unit): CommunitySource => ({
  sourceUnitId: unit.id,
  sourceCardId: unit.cardId,
  sourceSide: unit.side,
  sourceLane: unit.lane,
  sourcePosition: unit.position,
});
const real = (ctx: CommunityContext, unit: Unit) =>
  !ctx.isToken?.(unit) &&
  (ctx.definition(unit).kind ?? 'character') === 'character';
const board = (ctx: CommunityContext) =>
  ctx.state.units.filter((u) => u.hands > 0 && real(ctx, u));
const family = (ctx: CommunityContext, unit: Unit) =>
  real(ctx, unit) &&
  (ctx.definition(unit).element === 'Fire' ||
    !!ctx.definition(unit).traits?.includes('family'));
const homeless = (ctx: CommunityContext, unit: Unit) =>
  real(ctx, unit) && !!ctx.definition(unit).traits?.includes('homeless');
const localOther = (ctx: CommunityContext, unit: Unit) =>
  board(ctx).filter(
    (u) => u.side === unit.side && u.lane === unit.lane && u.id !== unit.id,
  );
const enemies = (ctx: CommunityContext, unit: Unit, local = true) =>
  board(ctx).filter(
    (u) => u.side !== unit.side && (!local || u.lane === unit.lane),
  );
function low(ctx: CommunityContext, units: readonly Unit[]) {
  return [...units].sort(
    (a, b) =>
      ctx.effectiveHands(a) - ctx.effectiveHands(b) || a.id.localeCompare(b.id),
  )[0];
}
function high(ctx: CommunityContext, units: readonly Unit[]) {
  return [...units].sort(
    (a, b) =>
      ctx.effectiveHands(b) - ctx.effectiveHands(a) || a.id.localeCompare(b.id),
  )[0];
}
const activeSources = (
  ctx: CommunityContext,
  side: Side,
  ability: CommunityAbility,
) =>
  board(ctx)
    .filter(
      (u) =>
        u.side === side &&
        ctx.active(u) &&
        ctx.definition(u).ability === ability,
    )
    .sort((a, b) => a.id.localeCompare(b.id));
const injured = (u: Unit) => (u.damageTaken ?? 0) > 0 && u.hands < u.maxHands;
function destinations(ctx: CommunityContext, unit: Unit) {
  const score = (lane: Lane) =>
    board(ctx)
      .filter((u) => u.side === unit.side && u.lane === lane)
      .reduce((n, u) => n + ctx.effectiveHands(u), 0);
  return LANES.filter(
    (lane) => lane !== unit.lane && ctx.openForMove(unit, lane),
  ).sort((a, b) => score(a) - score(b) || a - b);
}
function effectSource(
  ctx: CommunityContext,
  source: Unit | CommunitySource,
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
  ctx: CommunityContext,
  source: Unit | CommunitySource,
  effect: () => void,
) {
  const first = ctx.state.nextEventId;
  effect();
  const provenance = 'id' in source ? mark(source) : source;
  for (const event of ctx.state.events)
    if (event.id >= first && event.sourceUnitId === undefined)
      Object.assign(event, provenance);
}
function give(
  ctx: CommunityContext,
  source: Unit | CommunitySource,
  target: Unit | undefined,
  amount: number,
  copied = false,
) {
  if (target && target.hands > 0)
    attributed(ctx, source, () =>
      ctx.gain(target, amount, copied, effectSource(ctx, source)),
    );
}
function cover(
  ctx: CommunityContext,
  source: Unit | CommunitySource,
  target: Unit | undefined,
) {
  if (target && target.hands > 0)
    attributed(ctx, source, () => ctx.protect(target));
}
function note(
  ctx: CommunityContext,
  source: Unit,
  text: string,
  target = source,
) {
  ctx.event({
    type: 'community',
    side: target.side,
    lane: target.lane,
    position: target.position,
    targetUnitId: target.id,
    cardId: target.cardId,
    ...mark(source),
    text,
  });
}
function distinctMovers(ctx: CommunityContext, side: Side) {
  const seat = runtime(ctx).seats[side];
  return seat.moverPulse === pulse(ctx) ? seat.movers.length : 0;
}
/** Returns undefined only for abilities outside this reviewed Family. */
export function communityEntrance(
  ctx: CommunityContext,
  unit: Unit,
  echoed = false,
): boolean | undefined {
  const ability = ctx.definition(unit).ability;
  if (!Object.hasOwn(COMMUNITY_ABILITY_DESCRIPTIONS, ability ?? ''))
    return undefined;
  const data = runtime(ctx),
    seat = data.seats[unit.side];
  if (!ctx.active(unit) || unit.hands <= 0) return false;
  const local = localOther(ctx, unit);
  switch (ability) {
    case 'everybody-loves-me': {
      const destination = destinations(ctx, unit)[0];
      return destination !== undefined && ctx.move(unit, destination);
    }
    case 'back-on-the-block': {
      const target = low(
        ctx,
        local.filter((u) => family(ctx, u)),
      );
      const destination = target && destinations(ctx, target)[0];
      if (
        !target ||
        destination === undefined ||
        !ctx.move(target, destination)
      )
        return false;
      if (seat.cousinPulse !== pulse(ctx)) {
        seat.cousinPulse = pulse(ctx);
        give(ctx, unit, target, 2);
      }
      return true;
    }
    case 'fix-you-a-plate': {
      const eligible = local.filter((u) => family(ctx, u));
      if (!echoed || eligible.length)
        data.plates = data.plates.filter((x) => x.sourceUnitId !== unit.id);
      const patient =
        low(ctx, eligible.filter(injured)) ??
        low(
          ctx,
          eligible.filter((u) => (u.burnStacks ?? 0) > 0),
        );
      if (patient) {
        const burning = (patient.burnStacks ?? 0) > 0;
        let healed = 0;
        attributed(ctx, unit, () => {
          healed = ctx.heal(patient, 3, unit);
          ctx.cleanse(patient, ['burn'], unit);
        });
        if (healed > 0 || burning) cover(ctx, unit, patient);
        return healed > 0 || burning;
      }
      const recipient = low(ctx, eligible);
      if (recipient) {
        give(ctx, unit, recipient, 3);
        return true;
      }
      if (echoed) return false;
      data.plates.push({
        ...mark(unit),
        expiresAt: (pulse(ctx) + 2) * COMMUNITY_PULSE_MS,
      });
      note(ctx, unit, 'SAVED YOU A PLATE');
      return true;
    }
    case 'not-my-baby': {
      const target = low(
        ctx,
        local.filter((u) => family(ctx, u)),
      );
      give(ctx, unit, target, 1);
      cover(ctx, unit, target);
      return !!target;
    }
    case 'still-hot': {
      const target = high(ctx, enemies(ctx, unit));
      return !!target && ctx.burn(unit, target, 2);
    }
    case 'dinners-ready': {
      if (data.grandmaUsed[unit.id]) return false;
      const target = high(ctx, enemies(ctx, unit));
      if (!target) return false;
      // Spend only a successful hit; normal shields or kits cannot burn the finisher.
      const actual = ctx.strike(
        unit,
        target,
        distinctMovers(ctx, unit.side) >= 2 ? 4 : 2,
      );
      if (actual <= 0) return false;
      data.grandmaUsed[unit.id] = true;
      return true;
    }
    case 'come-outside': {
      const target = high(ctx, enemies(ctx, unit));
      if (!target || ctx.strike(unit, target, 1) <= 0) return false;
      if (distinctMovers(ctx, unit.side) >= 2) {
        const remote = high(
          ctx,
          enemies(ctx, unit, false).filter((u) => u.lane !== unit.lane),
        );
        if (remote) ctx.strike(unit, remote, 1);
      }
      return true;
    }
    case 'block-crowned': {
      const targets = enemies(ctx, unit)
        .sort(
          (a, b) =>
            ctx.effectiveHands(b) - ctx.effectiveHands(a) ||
            a.id.localeCompare(b.id),
        )
        .slice(0, 3);
      let damaged = 0;
      for (const target of targets)
        if (ctx.strike(unit, target, 1) > 0) damaged++;
      if (damaged) give(ctx, unit, unit, Math.min(2, damaged));
      return damaged > 0;
    }
    case 'everybody-eats': {
      const eligible = local.filter((u) => !seat.mealReceipts[identity(u)]);
      const target = low(ctx, eligible.filter(injured)) ?? low(ctx, eligible);
      if (!target) return false;
      seat.mealReceipts[identity(target)] = true;
      if (injured(target))
        attributed(ctx, unit, () => {
          ctx.heal(target, 4, unit);
        });
      else give(ctx, unit, target, 3);
      if (homeless(ctx, target)) {
        attributed(ctx, unit, () => ctx.cleanse(target, undefined, unit));
        give(ctx, unit, target, 2);
        cover(ctx, unit, target);
      }
      return true;
    }
    case 'whats-crackin': {
      const crew = board(ctx).filter(
        (u) => u.side === unit.side && u.id !== unit.id,
      );
      // This particular recipient is chosen before the cleanse changes Freeze scores.
      const cleansedLight = low(
        ctx,
        crew.filter(
          (u) => ctx.definition(u).element === 'Light' && ctx.isAfflicted(u),
        ),
      );
      for (const target of crew)
        attributed(ctx, unit, () => ctx.cleanse(target, undefined, unit));
      for (const lane of LANES)
        give(
          ctx,
          unit,
          low(
            ctx,
            crew.filter((u) => u.lane === lane),
          ),
          2,
        );
      give(ctx, unit, cleansedLight, 2);
      if (!seat.foodServed) {
        const recipients = LANES.map((lane) =>
          low(
            ctx,
            crew.filter((u) => u.lane === lane && homeless(ctx, u)),
          ),
        ).filter((u): u is Unit => !!u);
        if (recipients.length) {
          seat.foodServed = true;
          for (const target of recipients) {
            give(ctx, unit, target, 2);
            cover(ctx, unit, target);
          }
        }
      }
      return crew.length > 0;
    }
    case 'last-bus': {
      const target = low(
        ctx,
        board(ctx).filter(
          (u) =>
            u.side === unit.side &&
            u.id !== unit.id &&
            u.lane !== unit.lane &&
            ctx.openForMove(u, unit.lane),
        ),
      );
      if (!target || !ctx.move(target, unit.lane)) return false;
      if (!seat.busReceipts[identity(unit)]) {
        seat.busReceipts[identity(unit)] = true;
        give(ctx, unit, target, 2);
      }
      return true;
    }
    case 'contactless': {
      const destination = destinations(ctx, unit)[0];
      if (destination === undefined || !ctx.move(unit, destination))
        return false;
      if (!data.cyclistUsed[unit.id]) {
        data.cyclistUsed[unit.id] = true;
        give(ctx, unit, low(ctx, localOther(ctx, unit)), 1);
      }
      return true;
    }
    case 'you-hear-me': {
      const silenced = low(
        ctx,
        local.filter((u) => u.silenced),
      );
      if (silenced) {
        attributed(ctx, unit, () => ctx.cleanse(silenced, ['silence'], unit));
        return true;
      }
      const target = low(ctx, local);
      cover(ctx, unit, target);
      return !!target;
    }
    case 'five-finger-discount': {
      if (data.boosterUsed[unit.id]) return false;
      const target = high(
        ctx,
        enemies(ctx, unit).filter((u) => ctx.removableBonus(u) > 0),
      );
      if (!target) return false;
      const actual = ctx.trimBonus(unit, target, 1);
      if (actual <= 0) return false;
      data.boosterUsed[unit.id] = true;
      give(ctx, unit, unit, actual);
      return true;
    }
    // Passive bodies do not acquire an invented successful reveal.
    case 'everybody-inside':
    case 'save-me-some':
    case 'built-different':
      return false;
  }
  return false;
}
/** Notify once before a real paid character's entrance, and on movement arrival.
 * Tokens and echoed reveals cannot pretend to be new arrivals. */
export function communityArrived(ctx: CommunityContext, unit: Unit): void {
  if (unit.hands <= 0 || !family(ctx, unit)) return;
  const data = runtime(ctx);
  for (const plate of data.plates.filter(
    (x) =>
      x.sourceSide === unit.side &&
      x.sourceLane === unit.lane &&
      x.sourceUnitId !== unit.id &&
      x.expiresAt > ctx.state.elapsedMs,
  )) {
    const auntie = board(ctx).find(
      (u) =>
        u.id === plate.sourceUnitId &&
        u.lane === plate.sourceLane &&
        ctx.definition(u).ability === 'fix-you-a-plate' &&
        ctx.active(u),
    );
    if (!auntie) continue;
    data.plates = data.plates.filter((x) => x !== plate);
    give(ctx, auntie, unit, 3);
  }
}
/** Movement hooks own the arrival notification; do not also call communityArrived
 * for the same move. Paid deployments call communityArrived directly. */
export function communityMoved(
  ctx: CommunityContext,
  unit: Unit,
  oldLane: Lane,
): void {
  if (oldLane === unit.lane || unit.hands <= 0 || !real(ctx, unit)) return;
  const seat = runtime(ctx).seats[unit.side],
    now = pulse(ctx);
  if (seat.moverPulse !== now) {
    seat.moverPulse = now;
    seat.movers = [];
  }
  if (!seat.movers.includes(unit.id)) seat.movers.push(unit.id);
  communityArrived(ctx, unit);
  if (!family(ctx, unit) || seat.sisterPulse === now || seat.sisterPayouts >= 3)
    return;
  const sister = activeSources(ctx, unit.side, 'everybody-inside').find(
    (u) => u.id !== unit.id && u.lane === unit.lane,
  );
  if (!sister) return;
  seat.sisterPulse = now;
  seat.sisterPayouts++;
  give(ctx, sister, unit, 3);
}
/** Notify only the real, non-echo entrance outcome after its own ability resolves. */
export function communityResolvedEntrance(
  ctx: CommunityContext,
  unit: Unit,
  succeeded: boolean,
  echoed = false,
): void {
  if (echoed || !succeeded || unit.hands <= 0 || !family(ctx, unit)) return;
  const seat = runtime(ctx).seats[unit.side],
    now = pulse(ctx);
  if (seat.grillEntrancePulse === now || seat.grillEntrancePayouts >= 2) return;
  const grill = activeSources(ctx, unit.side, 'still-hot').find(
    (u) => u.id !== unit.id && u.lane === unit.lane,
  );
  if (!grill) return;
  const target = high(ctx, enemies(ctx, grill));
  if (!target) return;
  seat.grillEntrancePulse = now;
  seat.grillEntrancePayouts++;
  ctx.burn(grill, target, 1);
}
/** Positive actual gain only. Root calls this from both gain and actual healing.
 * Second Plate responses are copied=true and cannot trigger another response. */
export function communityGained(
  ctx: CommunityContext,
  unit: Unit,
  actual: number,
  copied = false,
): void {
  if (actual <= 0 || copied || unit.hands <= 0 || !family(ctx, unit)) return;
  const data = runtime(ctx),
    seat = data.seats[unit.side],
    now = pulse(ctx);
  if (data.sharing || seat.sharePulse === now || seat.sharePayouts >= 2) return;
  const cousin = activeSources(ctx, unit.side, 'save-me-some').find(
    (u) => u.id !== unit.id && u.lane === unit.lane,
  );
  if (!cousin) return;
  seat.sharePulse = now;
  seat.sharePayouts++;
  data.sharing = true;
  try {
    give(ctx, cousin, cousin, 3, true);
  } finally {
    data.sharing = false;
  }
}
/** Only actual damage from the other side can pay the active Grill watcher. */
export function communityEnemyDamage(
  ctx: CommunityContext,
  sourceSide: Side,
  victim: Unit,
  actual: number,
  burn = false,
): void {
  if (!burn || actual <= 0 || sourceSide === victim.side || !real(ctx, victim))
    return;
  const seat = runtime(ctx).seats[sourceSide],
    now = pulse(ctx);
  if (seat.grillDamagePulse === now || seat.grillDamagePayouts >= 2) return;
  const grill = activeSources(ctx, sourceSide, 'still-hot').find(
    (u) => u.lane === victim.lane,
  );
  if (!grill) return;
  seat.grillDamagePulse = now;
  seat.grillDamagePayouts++;
  give(ctx, grill, grill, 2);
}
/** Invoke after defenses/kits but before applying a positive Hands reduction.
 * Returns the prevented portion, including overkill, so only actual lost Hands
 * enter recoverable-damage accounting. Direct sacrifice/removal bypasses this. */
export function communityPreventLethal(
  ctx: CommunityContext,
  unit: Unit,
  incoming: number,
): number {
  if (
    !Number.isFinite(incoming) ||
    incoming <= 0 ||
    unit.hands <= 0 ||
    incoming < unit.hands ||
    ctx.definition(unit).ability !== 'built-different' ||
    !ctx.active(unit) ||
    !real(ctx, unit)
  )
    return 0;
  const seat = runtime(ctx).seats[unit.side],
    key = identity(unit);
  if (seat.survivalReceipts[key]) return 0;
  seat.survivalReceipts[key] = true;
  const prevented = incoming - Math.max(0, unit.hands - 1);
  note(ctx, unit, 'BUILT DIFFERENT · 1 HAND', unit);
  return prevented;
}
/** Called after authoritative game time advances, before timeout tallies. */
export function communityPulse(ctx: CommunityContext): void {
  const data = runtime(ctx),
    now = pulse(ctx);
  while (data.lastPulse < now) {
    data.lastPulse++;
    for (const side of SIDES)
      for (const legend of activeSources(ctx, side, 'built-different'))
        attributed(ctx, legend, () => {
          ctx.heal(legend, 2, legend);
        });
  }
  const present = new Set(board(ctx).map((u) => u.id));
  data.plates = data.plates.filter(
    (x) => x.expiresAt > ctx.state.elapsedMs && present.has(x.sourceUnitId),
  );
}
