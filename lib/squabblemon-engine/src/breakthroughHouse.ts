/** Squabblehouse staff rules. Shared clock pulses and source-owned contracts are
 * separate from presentation; no effect delays a legal paid deployment. */
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

export const HOUSE_PULSE_MS = 10000;
export const HOUSE_ABILITY_DESCRIPTIONS = {
  'home-advantage':
    'Deploy: gain+1 if an enemy is here. While active: carry a live+1-Hand aura per other friendly Squabblehouse staff member anywhere; staff leaving or this ability being disabled removes that aura. The first enemy played or moved here each10-second pulse attempts1 damage through normal defenses.',
  'keep-the-peace':
    'Deploy: attempt2 damage against the strongest enemy here. While active: the first enemy played or moved here each10-second pulse attempts1 damage; only actual damage grants Security+1.',
  'run-it-back':
    'Deploy: repeat the latest other active friendly staff On Reveal once in its current lane, once per driver identity per10-second pulse. The first other eligible staff played here each pulse also repeats its On Reveal once. Ongoing-only Janitor, dogs and Teknicians cannot be echoed; echoes never become paid plays or arrivals.',
  'hot-off-the-griddle':
    'Deploy: challenge the strongest enemy here as one defended package: strip its personal Protection, deal3 damage or5 if already burning, then apply1 Burn. Immunity, Side Eye, Janitor and damage prevention still apply.',
  'second-chance':
    'Deploy: gain+2 if another friendly staff member is here. Independently attempt1 damage against the strongest enemy here, through normal defenses.',
  'clear-the-table':
    'Deploy: move the weakest other local friendly staff member to your weakest other lane; only a successful arrival gives+1. At each10-second pulse, attempt one adjacent patrol, reversing direction at edges. After a successful active arrival, clear Weaken from every other friendly fighter there and give its weakest other friendly fighter+1. Normal movement restrictions and counterable exits apply; no population cap.',
  'pay-your-tab':
    'Deploy: through the following10-second interval, attempt a source-owned movement/return Lock on the strongest enemy here. Independently leave one Open Tab here that can stop one otherwise-legal enemy lane departure/return per pulse through that deadline. Arrivals never spend it. Repeats extend expiry and preserve an already-spent pulse.',
  'all-star-hands':
    'Deploy: give the weakest other friendly staff member in every staffed lane+1, or+2 if friendly staff occupy all3 lanes. Warlord is excluded from its own recipients.',
  'turn-it-around':
    'While active: each friendly lane containing a Janitor shares2 independent charges per10-second pulse. Reverse the first actual enemy Hands-loss/new harmful-status package against any local ally, and separately the first enemy-forced move/return/execution against local staff. The saved recipient gains+2. Copies share both charges; ordinary damage deaths use the harm charge. Immunity and existing shields resolve first.',
} as const;
export const HOUSE_ADAPTERS = {
  'squabble-house-manager': {
    ability: 'home-advantage',
    tacticalRoles: ['control'],
  },
  'squabblehouse-security': {
    ability: 'keep-the-peace',
    tacticalRoles: ['control'],
  },
  'squabblehouse-teknician': {
    ability: 'run-it-back',
    tacticalRoles: ['support'],
  },
  'griddle-master': {
    ability: 'hot-off-the-griddle',
    tacticalRoles: ['control'],
  },
  'inmate-reformed': { ability: 'second-chance', tacticalRoles: ['control'] },
  'squabblehouse-bus-boy': {
    ability: 'clear-the-table',
    tacticalRoles: ['support'],
  },
  'squabblehouse-cashier': {
    ability: 'pay-your-tab',
    tacticalRoles: ['control'],
  },
  'waffle-warlord': { ability: 'all-star-hands', tacticalRoles: ['support'] },
  janitor: { ability: 'turn-it-around', tacticalRoles: ['support'] },
} as const;
export type HouseAbility = keyof typeof HOUSE_ABILITY_DESCRIPTIONS;
export type HouseHostileKind = 'harm' | 'staff-exit' | 'departure-stop';
interface HouseTab {
  side: Side;
  lane: Lane;
  expiresAt: number;
  spentPulse: number;
  source: Unit;
}
export interface HouseMatchState {
  history: string[];
  arrivalChecks: Record<string, number>;
  tekRevealPulse: Record<string, number>;
  tekPlayedPulse: Record<string, number>;
  janitorCharges: Record<string, number>;
  patrols: Record<string, { direction: -1 | 1; pulse: number }>;
  managerAuras: Record<string, number>;
  tabs: HouseTab[];
  lastPulse: number;
  syncing: boolean;
  echoing: boolean;
}
type HouseCard = Pick<FighterDefinition, 'id' | 'kind' | 'traits'> & {
  ability?: string;
};
export interface HouseContext {
  state: GameState & { house?: HouseMatchState };
  definition(unit: Unit): HouseCard;
  active(unit: Unit): boolean;
  effectiveHands(unit: Unit): number;
  gain(
    unit: Unit,
    amount: number,
    copied?: boolean,
    source?: EffectSource,
  ): void;
  /** Change derived aura Hands/maxHands together, not damage/healing/earned growth. */
  adjustAura(unit: Unit, delta: number): void;
  cleanse(
    unit: Unit,
    kinds?: readonly TimedStatus['kind'][],
    source?: EffectSource,
  ): void;
  move(unit: Unit, lane: Lane): boolean;
  openForMove(unit: Unit, lane: Lane): boolean;
  strike(source: Unit, target: Unit, amount: number): number;
  /** Normal immunity/shields then the appropriate Janitor charge before apply.
   * departure-stop honors defenses, but blocking a voluntary exit is not an
   * enemy-forced staff removal and must not spend the staff-exit charge. */
  hostile(
    source: Unit,
    target: Unit,
    kind: HouseHostileKind,
    apply: (actualTarget: Unit) => void,
  ): boolean;
  /** One defended package, not separate shield-consuming damage and Burn calls. */
  griddle(source: Unit, target: Unit): boolean;
  /** Repeat a real eligible On Reveal, keeping all once-only receipts spent. */
  echo(unit: Unit): boolean;
  event(event: Omit<BattleEvent, 'id'>): void;
  isToken?(unit: Unit): boolean;
}
const SIDES: readonly Side[] = ['player', 'opponent'];
const LANES: readonly Lane[] = [0, 1, 2];
const ECHO_ABILITIES = new Set<string>([
  'home-advantage',
  'keep-the-peace',
  'hot-off-the-griddle',
  'second-chance',
  'clear-the-table',
  'pay-your-tab',
  'all-star-hands',
]);
function runtime(ctx: HouseContext): HouseMatchState {
  return (ctx.state.house ??= {
    history: [],
    arrivalChecks: {},
    tekRevealPulse: {},
    tekPlayedPulse: {},
    janitorCharges: {},
    patrols: {},
    managerAuras: {},
    tabs: [],
    lastPulse: Math.floor(ctx.state.elapsedMs / HOUSE_PULSE_MS),
    syncing: false,
    echoing: false,
  });
}
export function cloneHouseState(
  value?: HouseMatchState,
): HouseMatchState | undefined {
  if (!value) return undefined;
  return {
    ...value,
    history: [...value.history],
    arrivalChecks: { ...value.arrivalChecks },
    tekRevealPulse: { ...value.tekRevealPulse },
    tekPlayedPulse: { ...value.tekPlayedPulse },
    janitorCharges: { ...value.janitorCharges },
    patrols: Object.fromEntries(
      Object.entries(value.patrols).map(([id, x]) => [id, { ...x }]),
    ),
    managerAuras: { ...value.managerAuras },
    tabs: value.tabs.map((x) => ({ ...x, source: structuredClone(x.source) })),
    syncing: false,
    echoing: false,
  };
}
const pulse = (ctx: HouseContext) =>
  Math.floor(ctx.state.elapsedMs / HOUSE_PULSE_MS);
const identity = (unit: Unit) => `${unit.side}:${unit.cardId}`;
const real = (ctx: HouseContext, unit: Unit) =>
  !ctx.isToken?.(unit) &&
  (ctx.definition(unit).kind ?? 'character') === 'character';
const staff = (ctx: HouseContext, unit: Unit) =>
  real(ctx, unit) && !!ctx.definition(unit).traits?.includes('squabblehouse');
const board = (ctx: HouseContext) =>
  ctx.state.units.filter((u) => u.hands > 0 && real(ctx, u));
const mark = (unit: Unit) => ({
  sourceUnitId: unit.id,
  sourceSide: unit.side,
  sourceLane: unit.lane,
  sourcePosition: unit.position,
});
const sourceOrder = (a: Unit, b: Unit) =>
  (a.arrivalOrder ?? Number.MAX_SAFE_INTEGER) -
    (b.arrivalOrder ?? Number.MAX_SAFE_INTEGER) || a.id.localeCompare(b.id);
const sources = (ctx: HouseContext, side: Side, ability: HouseAbility) =>
  board(ctx)
    .filter(
      (u) =>
        u.side === side &&
        ctx.active(u) &&
        ctx.definition(u).ability === ability,
    )
    .sort(sourceOrder);
function low(ctx: HouseContext, units: readonly Unit[]) {
  return [...units].sort(
    (a, b) =>
      ctx.effectiveHands(a) - ctx.effectiveHands(b) || a.id.localeCompare(b.id),
  )[0];
}
function high(ctx: HouseContext, units: readonly Unit[]) {
  return [...units].sort(
    (a, b) =>
      ctx.effectiveHands(b) - ctx.effectiveHands(a) || a.id.localeCompare(b.id),
  )[0];
}
const allies = (ctx: HouseContext, unit: Unit, local = true) =>
  board(ctx).filter(
    (u) =>
      u.side === unit.side &&
      u.id !== unit.id &&
      (!local || u.lane === unit.lane),
  );
const enemies = (ctx: HouseContext, unit: Unit) =>
  board(ctx).filter((u) => u.side !== unit.side && u.lane === unit.lane);
function attributed(ctx: HouseContext, source: Unit, effect: () => void) {
  const first = ctx.state.nextEventId;
  effect();
  for (const event of ctx.state.events)
    if (event.id >= first && event.sourceUnitId === undefined)
      Object.assign(event, mark(source));
}
function give(
  ctx: HouseContext,
  source: Unit,
  unit: Unit | undefined,
  amount: number,
) {
  if (unit && unit.hands > 0)
    attributed(ctx, source, () => ctx.gain(unit, amount, undefined, source));
}
function note(ctx: HouseContext, source: Unit, text: string, target = source) {
  ctx.event({
    type: 'house',
    side: target.side,
    lane: target.lane,
    position: target.position,
    cardId: target.cardId,
    targetUnitId: target.id,
    ...mark(source),
    text,
  });
}
function weakestOtherLane(ctx: HouseContext, unit: Unit): Lane {
  const score = (lane: Lane) =>
    board(ctx)
      .filter((u) => u.side === unit.side && u.lane === lane)
      .reduce((n, u) => n + ctx.effectiveHands(u), 0);
  return LANES.filter((lane) => lane !== unit.lane).sort(
    (a, b) => score(a) - score(b) || a - b,
  )[0];
}
function echo(ctx: HouseContext, teknician: Unit, target: Unit): boolean {
  const data = runtime(ctx);
  if (
    data.echoing ||
    !ctx.active(teknician) ||
    !ctx.active(target) ||
    target.id === teknician.id ||
    target.side !== teknician.side ||
    !staff(ctx, target) ||
    !ECHO_ABILITIES.has(ctx.definition(target).ability ?? '')
  )
    return false;
  data.echoing = true;
  try {
    ctx.echo(target);
    note(ctx, teknician, 'RUN IT BACK', target);
    return true;
  } finally {
    data.echoing = false;
  }
}
/** Returns undefined only for a card outside this reviewed staff family. */
export function houseEntrance(
  ctx: HouseContext,
  unit: Unit,
  echoed = false,
): boolean | undefined {
  const ability = ctx.definition(unit).ability;
  if (!Object.hasOwn(HOUSE_ABILITY_DESCRIPTIONS, ability ?? ''))
    return undefined;
  if (!ctx.active(unit) || unit.hands <= 0) return false;
  const data = runtime(ctx);
  switch (ability) {
    case 'home-advantage':
      if (!enemies(ctx, unit).length) return false;
      give(ctx, unit, unit, 1);
      return true;
    case 'keep-the-peace': {
      const target = high(ctx, enemies(ctx, unit));
      return !!target && ctx.strike(unit, target, 2) > 0;
    }
    case 'run-it-back': {
      if (echoed || data.tekRevealPulse[identity(unit)] === pulse(ctx))
        return false;
      const target = [...data.history]
        .reverse()
        .map((id) => board(ctx).find((u) => u.id === id))
        .find(
          (u): u is Unit =>
            !!u &&
            u.side === unit.side &&
            u.id !== unit.id &&
            staff(ctx, u) &&
            ctx.active(u) &&
            ECHO_ABILITIES.has(ctx.definition(u).ability ?? ''),
        );
      if (!target) return false;
      data.tekRevealPulse[identity(unit)] = pulse(ctx);
      return echo(ctx, unit, target);
    }
    case 'hot-off-the-griddle': {
      const target = high(ctx, enemies(ctx, unit));
      return !!target && ctx.griddle(unit, target);
    }
    case 'second-chance': {
      const backed = allies(ctx, unit).some((u) => staff(ctx, u));
      if (backed) give(ctx, unit, unit, 2);
      const target = high(ctx, enemies(ctx, unit));
      const hit = !!target && ctx.strike(unit, target, 1) > 0;
      return backed || hit;
    }
    case 'clear-the-table': {
      const target = low(
        ctx,
        allies(ctx, unit).filter((u) => staff(ctx, u)),
      );
      if (!target) return false;
      const lane = weakestOtherLane(ctx, target);
      if (!ctx.openForMove(target, lane) || !ctx.move(target, lane))
        return false;
      give(ctx, unit, target, 1);
      return true;
    }
    case 'pay-your-tab': {
      const target = high(ctx, enemies(ctx, unit));
      const expiresAt = (pulse(ctx) + 2) * HOUSE_PULSE_MS;
      const sourceId = `house-cashier:${identity(unit)}`;
      let locked = false;
      if (
        target &&
        (target.movementLocks?.find((x) => x.sourceId === sourceId)
          ?.expiresAt ?? 0) < expiresAt
      ) {
        ctx.hostile(unit, target, 'harm', (target) => {
          target.movementLocks = [
            ...(target.movementLocks ?? []).filter(
              (x) => x.sourceId !== sourceId,
            ),
            { sourceId, expiresAt },
          ];
          locked = true;
          note(ctx, unit, 'PAY YOUR TAB · LOCKED', target);
        });
      }
      const old = data.tabs.find(
        (x) => x.side === unit.side && x.lane === unit.lane,
      );
      const extended = !old || old.expiresAt < expiresAt;
      if (extended) {
        data.tabs = data.tabs.filter((x) => x !== old);
        data.tabs.push({
          side: unit.side,
          lane: unit.lane,
          source: structuredClone(unit),
          expiresAt,
          spentPulse: old?.spentPulse ?? -1,
        });
        note(ctx, unit, 'OPEN TAB');
      }
      return locked || extended;
    }
    case 'all-star-hands': {
      const crew = board(ctx).filter(
        (u) => u.side === unit.side && staff(ctx, u),
      );
      const amount = LANES.every((lane) => crew.some((u) => u.lane === lane))
        ? 2
        : 1;
      let helped = false;
      for (const lane of LANES) {
        const target = low(
          ctx,
          crew.filter((u) => u.id !== unit.id && u.lane === lane),
        );
        if (target) {
          give(ctx, unit, target, amount);
          helped = true;
        }
      }
      return helped;
    }
    case 'turn-it-around':
      return false;
  }
  return false;
}
/** Call before a real enemy paid/movement entrance resolves, not an echo. */
export function houseArrived(ctx: HouseContext, unit: Unit): void {
  if (unit.hands <= 0 || !real(ctx, unit)) return;
  const data = runtime(ctx),
    other: Side = unit.side === 'player' ? 'opponent' : 'player';
  for (const ability of ['keep-the-peace', 'home-advantage'] as const) {
    const source = sources(ctx, other, ability).find(
      (u) =>
        u.lane === unit.lane &&
        data.arrivalChecks[`${ability}:${identity(u)}`] !== pulse(ctx),
    );
    if (!source || unit.hands <= 0) continue;
    data.arrivalChecks[`${ability}:${identity(source)}`] = pulse(ctx);
    const actual = ctx.strike(source, unit, 1);
    if (actual > 0 && ability === 'keep-the-peace')
      give(ctx, source, source, 1);
  }
}
/** After a real paid staff entrance, record its latest reveal and allow a local
 * Teknician to repeat it. Movements, supports and echoes never call this. */
export function housePlayed(ctx: HouseContext, unit: Unit): void {
  if (
    !staff(ctx, unit) ||
    !ECHO_ABILITIES.has(ctx.definition(unit).ability ?? '')
  )
    return;
  const data = runtime(ctx),
    present = new Set(board(ctx).map((u) => u.id));
  data.history = [
    ...data.history.filter((id) => id !== unit.id && present.has(id)),
    unit.id,
  ];
  if (!ctx.active(unit) || unit.hands <= 0) return;
  const teknician = sources(ctx, unit.side, 'run-it-back').find(
    (u) =>
      u.id !== unit.id &&
      u.lane === unit.lane &&
      data.tekPlayedPulse[identity(u)] !== pulse(ctx),
  );
  if (!teknician) return;
  data.tekPlayedPulse[identity(teknician)] = pulse(ctx);
  echo(ctx, teknician, unit);
}
/** Invoke only for an otherwise-real hostile change after ordinary shields. */
export function housePreventHostile(
  ctx: HouseContext,
  target: Unit,
  sourceSide: Side,
  kind: HouseHostileKind,
): boolean {
  if (
    sourceSide === target.side ||
    target.hands <= 0 ||
    !real(ctx, target) ||
    kind === 'departure-stop' ||
    (kind === 'staff-exit' && !staff(ctx, target))
  )
    return false;
  const data = runtime(ctx),
    key = `${target.side}:${target.lane}:${kind}`;
  if (data.janitorCharges[key] === pulse(ctx)) return false;
  const janitor = sources(ctx, target.side, 'turn-it-around').find(
    (u) => u.lane === target.lane,
  );
  if (!janitor) return false;
  data.janitorCharges[key] = pulse(ctx);
  give(ctx, janitor, target, 2);
  note(
    ctx,
    janitor,
    `TURN IT AROUND · ${kind === 'harm' ? 'HARM' : 'STAFF'}`,
    target,
  );
  return true;
}
/** Call only after the attempted lane departure/return is otherwise legal.
 * Read-only target previews must never spend a Tab or a personal shield. */
export function houseStopDeparture(ctx: HouseContext, target: Unit): boolean {
  if (target.hands <= 0 || !real(ctx, target)) return false;
  const tab = runtime(ctx).tabs.find(
    (x) =>
      x.side !== target.side &&
      x.lane === target.lane &&
      x.expiresAt > ctx.state.elapsedMs &&
      x.spentPulse !== pulse(ctx),
  );
  if (!tab) return false;
  let stopped = false;
  ctx.hostile(tab.source, target, 'departure-stop', (target) => {
    tab.spentPulse = pulse(ctx);
    stopped = true;
    note(ctx, tab.source, 'OPEN TAB · EXIT STOPPED', target);
  });
  return stopped;
}
/** Manager's staff count is a live derived aura, not farmable earned Hands. */
export function houseSyncOngoing(ctx: HouseContext): void {
  const data = runtime(ctx);
  if (data.syncing) return;
  data.syncing = true;
  try {
    const live = board(ctx),
      present = new Set(live.map((u) => u.id));
    for (const unit of live) {
      const old = data.managerAuras[unit.id] ?? 0;
      const next =
        ctx.definition(unit).ability === 'home-advantage' && ctx.active(unit)
          ? live.filter(
              (u) => u.side === unit.side && u.id !== unit.id && staff(ctx, u),
            ).length
          : 0;
      if (next !== old) ctx.adjustAura(unit, next - old);
      if (next) data.managerAuras[unit.id] = next;
      else delete data.managerAuras[unit.id];
    }
    for (const id of Object.keys(data.managerAuras))
      if (!present.has(id)) delete data.managerAuras[id];
  } finally {
    data.syncing = false;
  }
}
/** One adjacent Bus Boy attempt per clock pulse; reversing at edges is based on
 * authored direction, never a random legal-destination fallback. */
export function housePulse(ctx: HouseContext): void {
  const data = runtime(ctx),
    now = pulse(ctx);
  while (data.lastPulse < now) {
    const current = ++data.lastPulse;
    const patrols = board(ctx)
      .filter((u) => ctx.definition(u).ability === 'clear-the-table')
      .sort(sourceOrder);
    for (const bus of patrols) {
      if (!ctx.active(bus)) continue;
      const record = (data.patrols[bus.id] ??= {
        direction: bus.lane === 2 ? -1 : 1,
        pulse: -1,
      });
      if (record.pulse === current) continue;
      let lane = bus.lane + record.direction;
      if (lane < 0 || lane > 2) {
        record.direction = record.direction === 1 ? -1 : 1;
        lane = bus.lane + record.direction;
      }
      record.pulse = current;
      if (
        !ctx.openForMove(bus, lane as Lane) ||
        !ctx.move(bus, lane as Lane) ||
        !ctx.active(bus)
      )
        continue;
      const local = allies(ctx, bus);
      for (const unit of local.filter((u) => u.weakened))
        attributed(ctx, bus, () => ctx.cleanse(unit, ['weaken'], bus));
      give(ctx, bus, low(ctx, local), 1);
    }
  }
  data.tabs = data.tabs.filter((x) => x.expiresAt > ctx.state.elapsedMs);
  for (const unit of ctx.state.units)
    if (unit.movementLocks)
      unit.movementLocks = unit.movementLocks.filter(
        (x) => x.expiresAt > ctx.state.elapsedMs,
      );
  houseSyncOngoing(ctx);
}
