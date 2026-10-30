/** Explicit color crews, finite periodic routes and bounded hostile interception. */
import type {
  BattleEvent,
  FighterDefinition,
  GameState,
  Lane,
  Side,
  Unit,
} from './breakthrough';
type EffectSource = Pick<Unit, 'id' | 'cardId' | 'side' | 'lane' | 'position'>;
export const FACTION_PULSE_MS = 10000;
export const FACTION_ABILITY_DESCRIPTIONS = {
  'hold-you-down':
    'Deploy: give your weakest other local character +1 and bond to it. Once per card identity per match, while together, intercept its next targeted hostile ability. Afterward the surviving pair tries one legal atomic escape to your weakest other lane; Protect the surviving partner even if escape fails.',
  'he-doesnt-know-you':
    'Deploy: your strongest other character anywhere becomes your idol. While active, intercept its first targeted hostile ability each 10-second pulse. If Fangirl was here when an intercepted packet really damaged, displaced or newly afflicted you, gain +2.',
  'concrete-congregation':
    'Deploy: Protect your weakest other Earth character anywhere and give it +1. While active, once per side per 10-second pulse, block a hostile forced move against an Earth fighter and give that fighter +2 instead. Ordinary shields resolve before this movement ward.',
  'take-the-shortcut':
    'Deploy: move to your weakest other legal lane. Only a successful move grants +1 and arms a one-use 1-Motion discount for your next Red Side card. It does not stack with another next-card discount.',
  'eyes-on-the-crossing':
    'Deploy and at the next two global 10-second pulses: make one attempt to steal 1 actual Hand from the strongest eligible enemy here. Only with no enemies here may you instead take 1 from your strongest other ally with at least 2. Blocked steals grant nothing; echoes cannot repeat an attempt in the same pulse.',
  'blue-side-crossfire':
    'Deploy: hit the strongest enemy in another lane for 3. Gain +1 per friendly Blue Side fighter, including yourself, plus +1 per other lane containing a friendly Blue Set fighter, at most +2 extra. This printed identity cannot lose Hands even while disabled; statuses and legal movement can still affect it.',
  'stand-behind-me':
    'Deploy: gain +1 and prepare Protection for the next other friendly character deployed while this fighter remains active. One pending cover per source; actions and summons never spend it.',
  'clear-the-route':
    'Deploy and each global 10-second pulse: snapshot your weakest other fighter in each lane and try to move each exactly one adjacent lane. Outer lanes enter the center; center tries right then left. One seeded coin flip per route either gives each successful mover +1 or steals 1 actual Hand from a local enemy for that mover. No fighter moves twice in one route.',
  homage:
    'Deploy only in the left lane. If losing here, collect up to +3: other Blue Set characters contribute first without losing Hands, then eligible other characters pay 1 while retaining at least 1. Send the weakest enemy here to your strongest other legal lane and hit it for 1 only if moved. Your weakest Blue Set character in each other lane gains +1 and Protection. This identity cannot lose Hands or be Silenced.',
  'roll-call':
    'Deploy only in the right lane. Other local characters lose 1 actual Hand; up to three strongest touchable enemies take 2 instead. Gain the actual total lost, capped at +6. Untouchable characters are instead asked to move to another legal lane, with hostile movement defenses still applying. This printed ability cannot be Silenced.',
  'spin-the-block':
    'Deploy: put 1 Burn on the strongest enemy here, and leave one source-owned trap here until the third following pulse. The next enemy character actually deployed here consumes the trap and attempts to take 1 Burn. A blocked Burn still consumes that trap; actions and summons do not.',
  'on-point':
    'Deploy: watch the next lane the opponent plays into. On the call, arm a one-use 1-Motion discount for your next card there and give your weakest other Blue Set character +2. Re-arm at each 10-second pulse only with another Blue Set character. Maximum one call per pulse and three calls per card identity per match.',
  'red-line-bodyguard':
    'Deploy and each 10-second pulse: walk one adjacent legal lane toward your earliest Red Triple OG; when together, hit the strongest eligible enemy there for 1 once this pulse. After the OG’s ordinary shields, jump legally from anywhere to tank one counterable targeted ability per pulse. Disabled or movement-locked dogs cannot jump; generated attacks never intercept recursively.',
  'blue-nose-backup':
    'Deploy and each 10-second pulse: walk one adjacent legal lane toward your earliest Blue Triple OG; when together, give it +1 and your weakest remote Blue Set character +2 once this pulse. After the OG’s ordinary shields, jump legally from anywhere to tank one counterable targeted ability per pulse. Blue OG retains immunity to Hands loss.',
  'sign-here':
    'Deploy: bond your weakest other local character to one active Auntie through the second following pulse. Redirect its next targeted hostile ability to Auntie once. Actual damage or a newly harmful status arms one credit through two following pulses: the next Poison character successfully entering a different lane refunds 1 Motion. One Bond and credit per side; blocked packets never arm credit.',
} as const;
export const FACTION_ADAPTERS = {
  stud: {
    ability: 'hold-you-down',
    tacticalRoles: ['support'],
    triggers: ['entrance', 'ongoing'],
  },
  'grown-man-fanboy': {
    ability: 'he-doesnt-know-you',
    tacticalRoles: ['support'],
    triggers: ['entrance', 'ongoing'],
  },
  'asphalt-apostle': {
    ability: 'concrete-congregation',
    tacticalRoles: ['support'],
    triggers: ['entrance', 'ongoing'],
  },
  'red-side-1': {
    ability: 'take-the-shortcut',
    triggers: ['entrance'],
    tacticalRoles: ['support'],
  },
  'red-side-2': {
    ability: 'eyes-on-the-crossing',
    tacticalRoles: ['control'],
    triggers: ['entrance', 'ongoing'],
  },
  'blue-side-1': {
    ability: 'blue-side-crossfire',
    triggers: ['entrance'],
    cannotLoseHands: true,
    tacticalRoles: ['control'],
  },
  'blue-side-2': {
    ability: 'stand-behind-me',
    tacticalRoles: ['support'],
    triggers: ['entrance', 'ongoing'],
  },
  'blue-side-3': {
    ability: 'clear-the-route',
    tacticalRoles: ['support'],
    triggers: ['entrance', 'ongoing'],
  },
  'triple-og-blue': {
    ability: 'homage',
    triggers: ['entrance'],
    cannotLoseHands: true,
    cannotBeSilenced: true,
    allowedLanes: [0],
    tacticalRoles: ['support', 'control'],
  },
  'triple-og-red': {
    ability: 'roll-call',
    triggers: ['entrance'],
    cannotBeSilenced: true,
    allowedLanes: [2],
    tacticalRoles: ['control'],
  },
  'block-spinner': {
    ability: 'spin-the-block',
    triggers: ['entrance'],
    tacticalRoles: ['control'],
  },
  'look-out': {
    ability: 'on-point',
    tacticalRoles: ['support'],
    triggers: ['entrance', 'ongoing'],
  },
  'cane-corso-red': {
    ability: 'red-line-bodyguard',
    tacticalRoles: ['control'],
    triggers: ['entrance', 'ongoing'],
  },
  'blue-nose-pit': {
    ability: 'blue-nose-backup',
    tacticalRoles: ['support'],
    triggers: ['entrance', 'ongoing'],
  },
  'bail-bonds-auntie': {
    ability: 'sign-here',
    tacticalRoles: ['support'],
    triggers: ['entrance', 'ongoing'],
  },
} as const;
interface SourceBond {
  source: Unit;
  targetId: string;
  expiresAt?: number;
}
interface LookoutLedger {
  ready: boolean;
  calls: number;
  pulse: number;
}
interface RedNightLedger {
  started: number;
  pulse: number;
}
interface FactionDiscount {
  id: number;
  kind: 'red-side' | 'called-lane';
  lane?: Lane;
  source: EffectSource;
}
interface FactionSeat {
  bonds: SourceBond[];
  auntie?: SourceBond;
  idols: Record<string, string>;
  studSpent: Record<string, true>;
  interceptPulses: Record<string, number>;
  apostlePulse: number;
  covers: string[];
  lookout: Record<string, LookoutLedger>;
  redNight: Record<string, RedNightLedger>;
  routePulses: Record<string, number>;
  dogPulses: Record<string, number>;
  traps: { source: Unit; lane: Lane; expiresAt: number }[];
  discounts: FactionDiscount[];
  credit?: { source: EffectSource; origin: Lane; expiresAt: number };
}
export interface FactionMatchState {
  seats: Record<Side, FactionSeat>;
  lastPulse: number;
  nextDiscountId: number;
}
export interface FactionInterceptReceipt {
  kind: 'stud' | 'auntie' | 'fan' | 'dog';
  source: Unit;
  partnerId: string;
  firstEventId: number;
  before: {
    hands: number;
    lane: Lane;
    frozen: boolean;
    silenced: boolean;
    weakened: boolean;
    burn: number;
    locks: number;
  };
  fangirlPresent?: boolean;
}
type FactionCard = Pick<
  FighterDefinition,
  'id' | 'kind' | 'element' | 'faction'
> & { ability?: string; cannotLoseHands?: boolean; gangColor?: 'red' | 'blue' };
export interface FactionsContext {
  state: GameState & { factions?: FactionMatchState };
  definition(unit: Unit): FactionCard;
  active(unit: Unit): boolean;
  power(unit: Unit): number;
  gain(
    unit: Unit,
    amount: number,
    copied?: boolean,
    source?: EffectSource,
  ): void;
  protect(unit: Unit): void;
  damage(source: Unit, target: Unit, amount: number): number;
  selfDamage(source: Unit, target: Unit, amount: number): number;
  burn(source: Unit, target: Unit, amount: number): boolean;
  move(unit: Unit, lane: Lane): boolean;
  movePair(first: Unit, second: Unit, lane: Lane): boolean;
  moveEnemy(
    source: Unit,
    target: Unit,
    lane: Lane,
    followUp?: { burn?: number; damage?: number },
  ): boolean;
  openForMove(unit: Unit, lane: Lane): boolean;
  refund(side: Side, amount: number, source: EffectSource): number;
  random(): number;
  event(event: Omit<BattleEvent, 'id'>): void;
}
const LANES: Lane[] = [0, 1, 2];
const other = (side: Side): Side => (side === 'player' ? 'opponent' : 'player');
const pulse = (ctx: FactionsContext) =>
  Math.floor(ctx.state.elapsedMs / FACTION_PULSE_MS);
const identity = (unit: Unit) => `${unit.side}:${unit.cardId}`;
const freshSeat = (): FactionSeat => ({
  bonds: [],
  idols: {},
  studSpent: {},
  interceptPulses: {},
  apostlePulse: -1,
  covers: [],
  lookout: {},
  redNight: {},
  routePulses: {},
  dogPulses: {},
  traps: [],
  discounts: [],
});
function runtime(ctx: FactionsContext): FactionMatchState {
  return (ctx.state.factions ??= {
    seats: { player: freshSeat(), opponent: freshSeat() },
    lastPulse: pulse(ctx),
    nextDiscountId: 1,
  });
}
export function cloneFactionState(
  state?: FactionMatchState,
): FactionMatchState | undefined {
  if (!state) return undefined;
  return {
    ...state,
    seats: Object.fromEntries(
      (['player', 'opponent'] as Side[]).map((side) => {
        const seat = state.seats[side],
          cloneBond = (bond: SourceBond) => ({
            ...bond,
            source: { ...bond.source },
          });
        return [
          side,
          {
            ...seat,
            bonds: seat.bonds.map(cloneBond),
            ...(seat.auntie ? { auntie: cloneBond(seat.auntie) } : {}),
            idols: { ...seat.idols },
            studSpent: { ...seat.studSpent },
            interceptPulses: { ...seat.interceptPulses },
            covers: [...seat.covers],
            lookout: Object.fromEntries(
              Object.entries(seat.lookout).map(([id, value]) => [
                id,
                { ...value },
              ]),
            ),
            redNight: Object.fromEntries(
              Object.entries(seat.redNight).map(([id, value]) => [
                id,
                { ...value },
              ]),
            ),
            routePulses: { ...seat.routePulses },
            dogPulses: { ...seat.dogPulses },
            traps: seat.traps.map((trap) => ({
              ...trap,
              source: { ...trap.source },
            })),
            discounts: seat.discounts.map((discount) => ({
              ...discount,
              source: { ...discount.source },
            })),
            ...(seat.credit
              ? {
                  credit: { ...seat.credit, source: { ...seat.credit.source } },
                }
              : {}),
          },
        ];
      }),
    ) as Record<Side, FactionSeat>,
  };
}
const board = (ctx: FactionsContext) =>
  ctx.state.units.filter((unit) => unit.hands > 0 && unit.canFight !== false);
const real = (ctx: FactionsContext, unit: Unit) =>
  (ctx.definition(unit).kind ?? 'character') === 'character';
const find = (ctx: FactionsContext, id: string) =>
  board(ctx).find((unit) => unit.id === id);
const weak = (ctx: FactionsContext, units: Unit[]) =>
  [...units].sort(
    (a, b) => ctx.power(a) - ctx.power(b) || a.id.localeCompare(b.id),
  )[0];
const strong = (ctx: FactionsContext, units: Unit[]) =>
  [...units].sort(
    (a, b) => ctx.power(b) - ctx.power(a) || a.id.localeCompare(b.id),
  )[0];
const allies = (ctx: FactionsContext, unit: Unit, local = false) =>
  board(ctx).filter(
    (ally) =>
      ally.side === unit.side &&
      ally.id !== unit.id &&
      (!local || ally.lane === unit.lane),
  );
const enemies = (ctx: FactionsContext, unit: Unit, local = true) =>
  board(ctx).filter(
    (enemy) => enemy.side !== unit.side && (!local || enemy.lane === unit.lane),
  );
const canLose = (ctx: FactionsContext, unit: Unit) =>
  !unit.immune && ctx.definition(unit).cannotLoseHands !== true;
const gang = (ctx: FactionsContext, unit: Unit) =>
  unit.gangColor ?? ctx.definition(unit).gangColor;
function sourceMark(source: EffectSource) {
  return {
    sourceUnitId: source.id,
    sourceSide: source.side,
    sourceLane: source.lane,
    sourcePosition: source.position,
  };
}
function give(
  ctx: FactionsContext,
  source: EffectSource,
  target: Unit | undefined,
  amount: number,
  text = `+${amount}`,
): boolean {
  if (!target || target.hands <= 0 || amount <= 0) return false;
  ctx.gain(target, amount, undefined, source);
  ctx.event({
    type: 'ability',
    side: source.side,
    lane: target.lane,
    position: target.position,
    targetUnitId: target.id,
    cardId: target.cardId,
    ...sourceMark(source),
    text,
  });
  return true;
}
function score(ctx: FactionsContext, side: Side, lane: Lane) {
  return board(ctx)
    .filter((unit) => unit.side === side && unit.lane === lane)
    .reduce((sum, unit) => sum + ctx.power(unit), 0);
}
function destinations(ctx: FactionsContext, unit: Unit) {
  return LANES.filter((lane) => ctx.openForMove(unit, lane)).sort(
    (a, b) => score(ctx, unit.side, a) - score(ctx, unit.side, b) || a - b,
  );
}
function discount(
  ctx: FactionsContext,
  source: Unit,
  kind: FactionDiscount['kind'],
  lane?: Lane,
) {
  const state = runtime(ctx),
    seat = state.seats[source.side];
  seat.discounts = seat.discounts.filter(
    (token) =>
      !(token.kind === kind && (kind !== 'called-lane' || token.lane === lane)),
  );
  seat.discounts.push({
    id: state.nextDiscountId++,
    kind,
    ...(lane === undefined ? {} : { lane }),
    source: {
      id: source.id,
      cardId: source.cardId,
      side: source.side,
      lane: source.lane,
      position: source.position,
    },
  });
  ctx.event({
    type: 'discount',
    side: source.side,
    lane: lane ?? source.lane,
    ...sourceMark(source),
    text: 'NEXT CARD −1 MOTION',
  });
}
export function factionsDiscount(
  ctx: FactionsContext,
  side: Side,
  card: { faction?: string },
  lane: Lane,
) {
  return ctx.state.factions?.seats[side].discounts.find((token) =>
    token.kind === 'called-lane'
      ? token.lane === lane
      : card.faction === 'Red Side',
  );
}
export function factionsSpendDiscount(
  ctx: FactionsContext,
  side: Side,
  id: number,
  card: { faction?: string },
  lane: Lane,
): void {
  const quote = factionsDiscount(ctx, side, card, lane);
  if (quote?.id !== id) return;
  ctx.state.factions!.seats[side].discounts = ctx.state.factions!.seats[
    side
  ].discounts.filter((token) => token.id !== id);
}
function redNight(ctx: FactionsContext, source: Unit): boolean {
  const seat = runtime(ctx).seats[source.side],
    time = pulse(ctx),
    ledger = (seat.redNight[source.id] ??= { started: time, pulse: -1 });
  if (!ctx.active(source) || ledger.pulse === time || time > ledger.started + 2)
    return false;
  ledger.pulse = time;
  const foes = enemies(ctx, source);
  const target = foes.length
    ? strong(
        ctx,
        foes.filter((enemy) => canLose(ctx, enemy)),
      )
    : strong(
        ctx,
        allies(ctx, source, true).filter(
          (ally) => ally.hands >= 2 && canLose(ctx, ally),
        ),
      );
  if (!target) return false;
  const lost =
    target.side === source.side
      ? ctx.selfDamage(source, target, 1)
      : ctx.damage(source, target, 1);
  return give(ctx, source, find(ctx, source.id), lost, 'EYES ON THE CROSSING');
}
function blueRoute(ctx: FactionsContext, source: Unit): boolean {
  const seat = runtime(ctx).seats[source.side],
    time = pulse(ctx);
  if (!ctx.active(source) || seat.routePulses[source.id] === time) return false;
  seat.routePulses[source.id] = time;
  const riders = LANES.flatMap((origin) => {
    const rider = weak(
      ctx,
      allies(ctx, source).filter((ally) => ally.lane === origin),
    );
    return rider ? [{ id: rider.id, origin }] : [];
  });
  const steal = ctx.random() >= 0.5;
  let moved = false;
  for (const rider of riders) {
    const current = find(ctx, rider.id);
    if (!current || current.lane !== rider.origin || !ctx.active(source))
      continue;
    const adjacent: Lane[] = rider.origin === 1 ? [2, 0] : [1];
    const to = adjacent.find((lane) => ctx.openForMove(current, lane));
    if (to === undefined || !ctx.move(current, to)) continue;
    moved = true;
    if (!steal) give(ctx, source, current, 1, 'CLEAR THE ROUTE +1');
    else {
      const victim = strong(ctx, enemies(ctx, current));
      if (victim)
        give(
          ctx,
          source,
          current,
          ctx.damage(source, victim, 1),
          'CLEAR THE ROUTE · STOLEN',
        );
    }
  }
  return moved;
}
function earliestOg(ctx: FactionsContext, dog: Unit) {
  const id =
    ctx.definition(dog).ability === 'red-line-bodyguard'
      ? 'triple-og-red'
      : 'triple-og-blue';
  return board(ctx)
    .filter((unit) => unit.side === dog.side && unit.cardId === id)
    .sort(
      (a, b) =>
        (a.arrivalOrder ?? Number.MAX_SAFE_INTEGER) -
          (b.arrivalOrder ?? Number.MAX_SAFE_INTEGER) ||
        a.id.localeCompare(b.id),
    )[0];
}
function dogTurn(ctx: FactionsContext, dog: Unit): boolean {
  if (!ctx.active(dog)) return false;
  const og = earliestOg(ctx, dog);
  if (!og) return false;
  let moved = false;
  if (dog.lane !== og.lane) {
    const step = (dog.lane + (dog.lane < og.lane ? 1 : -1)) as Lane;
    if (ctx.openForMove(dog, step)) moved = ctx.move(dog, step);
  }
  const seat = runtime(ctx).seats[dog.side],
    time = pulse(ctx);
  if (
    dog.lane !== og.lane ||
    seat.dogPulses[dog.id] === time ||
    !ctx.active(dog)
  )
    return moved;
  seat.dogPulses[dog.id] = time;
  if (ctx.definition(dog).ability === 'blue-nose-backup') {
    give(ctx, dog, og, 1, 'BLUE-NOSE BACKUP');
    give(
      ctx,
      dog,
      weak(
        ctx,
        allies(ctx, dog).filter(
          (unit) => unit.lane !== og.lane && gang(ctx, unit) === 'blue',
        ),
      ),
      2,
      'BLUE SET +2',
    );
    return true;
  }
  const target = strong(
    ctx,
    enemies(ctx, dog).filter((enemy) => canLose(ctx, enemy)),
  );
  return (target ? ctx.damage(dog, target, 1) > 0 : false) || moved;
}
export function factionsEntrance(
  ctx: FactionsContext,
  source: Unit,
  options: boolean | { echoed?: boolean } = false,
): boolean | null {
  const echoed = typeof options === 'boolean' ? options : !!options.echoed;
  const ability = ctx.definition(source).ability;
  if (!ability || !Object.hasOwn(FACTION_ABILITY_DESCRIPTIONS, ability))
    return null;
  if (!ctx.active(source)) return false;
  const seat = runtime(ctx).seats[source.side],
    local = allies(ctx, source, true),
    others = allies(ctx, source);
  if (ability === 'hold-you-down') {
    const partner = weak(
      ctx,
      local.filter((unit) => real(ctx, unit)),
    );
    if (!partner || seat.studSpent[identity(source)]) return false;
    give(ctx, source, partner, 1);
    seat.bonds = seat.bonds.filter((bond) => bond.source.id !== source.id);
    seat.bonds.push({ source: { ...source }, targetId: partner.id });
    return true;
  }
  if (ability === 'he-doesnt-know-you') {
    const idol = strong(
      ctx,
      others.filter((unit) => real(ctx, unit)),
    );
    if (!idol) return false;
    seat.idols[source.id] = idol.id;
    return true;
  }
  if (ability === 'concrete-congregation') {
    const target = weak(
      ctx,
      others.filter(
        (unit) => real(ctx, unit) && ctx.definition(unit).element === 'Earth',
      ),
    );
    if (!target) return false;
    ctx.protect(target);
    return give(ctx, source, target, 1);
  }
  if (ability === 'take-the-shortcut') {
    const to = destinations(ctx, source)[0];
    if (to === undefined || !ctx.move(source, to)) return false;
    give(ctx, source, source, 1);
    discount(ctx, source, 'red-side');
    return true;
  }
  if (ability === 'eyes-on-the-crossing') return redNight(ctx, source);
  if (ability === 'blue-side-crossfire') {
    const target = strong(
      ctx,
      enemies(ctx, source, false).filter((enemy) => enemy.lane !== source.lane),
    );
    if (target) ctx.damage(source, target, 3);
    const own = board(ctx).filter((unit) => unit.side === source.side);
    const count = own.filter(
      (unit) => ctx.definition(unit).faction === 'Blue Side',
    ).length;
    const remote = new Set(
      own
        .filter(
          (unit) => unit.lane !== source.lane && gang(ctx, unit) === 'blue',
        )
        .map((unit) => unit.lane),
    ).size;
    return give(ctx, source, source, count + Math.min(2, remote));
  }
  if (ability === 'stand-behind-me') {
    give(ctx, source, source, 1);
    if (!seat.covers.includes(source.id)) seat.covers.push(source.id);
    return true;
  }
  if (ability === 'clear-the-route') return blueRoute(ctx, source);
  if (ability === 'homage') {
    let success = false;
    if (
      score(ctx, source.side, source.lane) <
      score(ctx, other(source.side), source.lane)
    ) {
      let taken = 0;
      const actualCharacters = others.filter((unit) => real(ctx, unit));
      const donors = [
        ...actualCharacters.filter((unit) => gang(ctx, unit) === 'blue'),
        ...actualCharacters.filter((unit) => gang(ctx, unit) !== 'blue'),
      ];
      for (const donor of donors) {
        if (taken >= 3) break;
        if (gang(ctx, donor) === 'blue') taken++;
        else if (donor.hands >= 2 && canLose(ctx, donor))
          taken += Math.min(1, ctx.selfDamage(source, donor, 1));
      }
      success = give(ctx, source, source, taken) || success;
    }
    const victim = weak(ctx, enemies(ctx, source));
    const to = victim
      ? LANES.filter((lane) => ctx.openForMove(victim, lane)).sort(
          (a, b) =>
            score(ctx, source.side, b) - score(ctx, source.side, a) || a - b,
        )[0]
      : undefined;
    if (
      victim &&
      to !== undefined &&
      ctx.moveEnemy(source, victim, to, { damage: 1 })
    ) {
      success = true;
    }
    for (const lane of LANES.filter((lane) => lane !== source.lane)) {
      const ally = weak(
        ctx,
        others.filter(
          (unit) =>
            unit.lane === lane && gang(ctx, unit) === 'blue' && real(ctx, unit),
        ),
      );
      if (ally) {
        give(ctx, source, ally, 1);
        ctx.protect(ally);
        success = true;
      }
    }
    return success;
  }
  if (ability === 'roll-call') {
    const lineup = [...local, ...enemies(ctx, source)].filter((unit) =>
      real(ctx, unit),
    );
    const heavy = new Set(
      [...lineup]
        .filter(
          (unit) =>
            unit.side !== source.side && canLose(ctx, unit) && !unit.protected,
        )
        .sort((a, b) => ctx.power(b) - ctx.power(a) || a.id.localeCompare(b.id))
        .slice(0, 3)
        .map((unit) => unit.id),
    );
    let taken = 0,
      moved = false;
    for (const target of lineup) {
      if (target.protected || !canLose(ctx, target)) {
        const to = LANES.find((lane) => ctx.openForMove(target, lane));
        if (to !== undefined)
          moved =
            (target.side === source.side
              ? ctx.move(target, to)
              : ctx.moveEnemy(source, target, to)) || moved;
      } else
        taken +=
          target.side === source.side
            ? ctx.selfDamage(source, target, 1)
            : ctx.damage(source, target, heavy.has(target.id) ? 2 : 1);
    }
    return give(ctx, source, find(ctx, source.id), Math.min(6, taken)) || moved;
  }
  if (ability === 'spin-the-block') {
    const target = strong(ctx, enemies(ctx, source));
    const hit = target ? ctx.burn(source, target, 1) : false;
    seat.traps = seat.traps.filter((trap) => trap.lane !== source.lane);
    seat.traps.push({
      source: { ...source },
      lane: source.lane,
      expiresAt: (pulse(ctx) + 3) * FACTION_PULSE_MS,
    });
    return hit || true;
  }
  if (ability === 'on-point') {
    const key = identity(source),
      ledger = (seat.lookout[key] ??= { ready: false, calls: 0, pulse: -1 });
    ledger.ready = ledger.calls < 3 && ledger.pulse !== pulse(ctx);
    return ledger.ready;
  }
  if (ability === 'red-line-bodyguard' || ability === 'blue-nose-backup')
    return echoed ? false : dogTurn(ctx, source);
  if (ability === 'sign-here') {
    const target = weak(
      ctx,
      local.filter((unit) => real(ctx, unit)),
    );
    if (!target) return false;
    seat.auntie = {
      source: { ...source },
      targetId: target.id,
      expiresAt: (pulse(ctx) + 2) * FACTION_PULSE_MS,
    };
    return true;
  }
  return false;
}
/** Paid plays before the entrant's reveal. Summons never consume these watches. */
export function factionsPlayed(
  ctx: FactionsContext,
  side: Side,
  card: { kind?: string },
  lane: Lane,
  entrant?: Unit,
): void {
  const state = runtime(ctx),
    own = state.seats[side],
    enemy = state.seats[other(side)],
    time = pulse(ctx);
  if (entrant && (card.kind ?? 'character') === 'character') {
    const cover = own.covers
      .map((id) => find(ctx, id))
      .filter(
        (unit): unit is Unit =>
          !!unit && unit.id !== entrant.id && ctx.active(unit),
      )
      .sort(
        (a, b) =>
          (a.arrivalOrder ?? 0) - (b.arrivalOrder ?? 0) ||
          a.id.localeCompare(b.id),
      )[0];
    if (cover) {
      own.covers = own.covers.filter((id) => id !== cover.id);
      ctx.protect(entrant);
    }
    const trap = enemy.traps.find(
      (trap) => trap.lane === lane && trap.expiresAt > ctx.state.elapsedMs,
    );
    if (trap) {
      enemy.traps = enemy.traps.filter((value) => value !== trap);
      ctx.burn(trap.source, entrant, 1);
    }
  }
  for (const watcher of board(ctx)
    .filter(
      (unit) =>
        unit.side !== side &&
        ctx.active(unit) &&
        ctx.definition(unit).ability === 'on-point',
    )
    .sort((a, b) => a.id.localeCompare(b.id))) {
    const ledger = enemy.lookout[identity(watcher)];
    if (!ledger?.ready || ledger.calls >= 3 || ledger.pulse === time) continue;
    ledger.ready = false;
    ledger.calls++;
    ledger.pulse = time;
    discount(ctx, watcher, 'called-lane', lane);
    give(
      ctx,
      watcher,
      weak(
        ctx,
        allies(ctx, watcher).filter(
          (unit) => gang(ctx, unit) === 'blue' && real(ctx, unit),
        ),
      ),
      2,
      'ON POINT +2',
    );
    ctx.event({
      type: 'called-lane',
      side: watcher.side,
      lane,
      ...sourceMark(watcher),
      text: `LANE ${lane + 1} · CALLED`,
    });
  }
}
export function factionsEntranceResolved(
  ctx: FactionsContext,
  entrant: Unit,
  paidLane: Lane,
  options: { echoed?: boolean } = {},
): void {
  const seat = ctx.state.factions?.seats[entrant.side],
    credit = seat?.credit;
  if (
    !credit ||
    credit.expiresAt <= ctx.state.elapsedMs ||
    options.echoed ||
    entrant.entranceSucceeded !== true ||
    ctx.definition(entrant).element !== 'Poison' ||
    paidLane === credit.origin ||
    !find(ctx, entrant.id)
  )
    return;
  delete seat!.credit;
  ctx.refund(entrant.side, 1, credit.source);
}
function receipt(
  ctx: FactionsContext,
  kind: FactionInterceptReceipt['kind'],
  source: Unit,
  partner: Unit,
): FactionInterceptReceipt {
  return {
    kind,
    source: { ...source },
    partnerId: partner.id,
    firstEventId: ctx.state.nextEventId,
    before: {
      hands: source.hands,
      lane: source.lane,
      frozen: !!source.frozen,
      silenced: !!source.silenced,
      weakened: !!source.weakened,
      burn: source.burnStacks ?? 0,
      locks: source.movementLocks?.length ?? 0,
    },
    ...(kind === 'fan'
      ? {
          fangirlPresent: board(ctx).some(
            (unit) =>
              unit.side === source.side &&
              unit.lane === source.lane &&
              unit.cardId === 'fangirl',
          ),
        }
      : {}),
  };
}
/** One bounded redirect. The caller never re-enters this hook for the interceptor. */
export function factionsRedirectHostile(
  ctx: FactionsContext,
  target: Unit,
  stage: 'early' | 'dog' = 'early',
): { target: Unit; receipt?: FactionInterceptReceipt } {
  const seat = runtime(ctx).seats[target.side],
    time = pulse(ctx);
  if (stage === 'early') {
    for (const bond of seat.bonds) {
      const source = find(ctx, bond.source.id);
      if (
        bond.targetId !== target.id ||
        !source ||
        source.lane !== target.lane ||
        !ctx.active(source) ||
        seat.studSpent[identity(source)]
      )
        continue;
      seat.studSpent[identity(source)] = true;
      seat.bonds = seat.bonds.filter((value) => value !== bond);
      return { target: source, receipt: receipt(ctx, 'stud', source, target) };
    }
    const bond = seat.auntie,
      auntie = bond ? find(ctx, bond.source.id) : undefined;
    if (
      bond &&
      auntie &&
      bond.targetId === target.id &&
      (bond.expiresAt ?? 0) > ctx.state.elapsedMs &&
      ctx.active(auntie)
    ) {
      delete seat.auntie;
      return {
        target: auntie,
        receipt: receipt(ctx, 'auntie', auntie, target),
      };
    }
    const fan = board(ctx)
      .filter(
        (unit) =>
          unit.side === target.side &&
          unit.id !== target.id &&
          ctx.definition(unit).ability === 'he-doesnt-know-you' &&
          seat.idols[unit.id] === target.id &&
          ctx.active(unit) &&
          seat.interceptPulses[identity(unit)] !== time,
      )
      .sort((a, b) => a.id.localeCompare(b.id))[0];
    if (fan) {
      seat.interceptPulses[identity(fan)] = time;
      return { target: fan, receipt: receipt(ctx, 'fan', fan, target) };
    }
  } else if (
    target.cardId === 'triple-og-blue' ||
    target.cardId === 'triple-og-red'
  ) {
    const dogAbility =
      target.cardId === 'triple-og-red'
        ? 'red-line-bodyguard'
        : 'blue-nose-backup';
    for (const dog of board(ctx)
      .filter(
        (unit) =>
          unit.side === target.side &&
          ctx.definition(unit).ability === dogAbility &&
          ctx.active(unit) &&
          seat.interceptPulses[identity(unit)] !== time,
      )
      .sort(
        (a, b) =>
          (a.arrivalOrder ?? Number.MAX_SAFE_INTEGER) -
            (b.arrivalOrder ?? Number.MAX_SAFE_INTEGER) ||
          a.id.localeCompare(b.id),
      )) {
      if (
        dog.lane !== target.lane &&
        (!ctx.openForMove(dog, target.lane) || !ctx.move(dog, target.lane))
      )
        continue;
      if (!ctx.active(dog) || dog.lane !== target.lane) continue;
      seat.interceptPulses[identity(dog)] = time;
      return { target: dog, receipt: receipt(ctx, 'dog', dog, target) };
    }
  }
  return { target };
}
/** After normal defenses, block only a hostile forced move of the actual target. */
export function factionsPreventMove(
  ctx: FactionsContext,
  target: Unit,
): boolean {
  if (ctx.definition(target).element !== 'Earth') return false;
  const seat = runtime(ctx).seats[target.side];
  if (seat.apostlePulse === pulse(ctx)) return false;
  const apostle = board(ctx)
    .filter(
      (unit) =>
        unit.side === target.side &&
        ctx.definition(unit).ability === 'concrete-congregation' &&
        ctx.active(unit),
    )
    .sort((a, b) => a.id.localeCompare(b.id))[0];
  if (!apostle) return false;
  seat.apostlePulse = pulse(ctx);
  give(ctx, apostle, target, 2, 'CONCRETE CONGREGATION +2');
  return true;
}
export function factionsAfterHostile(
  ctx: FactionsContext,
  intercept: FactionInterceptReceipt,
): void {
  const survivor = find(ctx, intercept.source.id),
    partner = find(ctx, intercept.partnerId);
  const damage = ctx.state.events.some(
    (event) =>
      event.id >= intercept.firstEventId &&
      ['damage', 'burn'].includes(event.type) &&
      event.targetUnitId === intercept.source.id &&
      (event.amount ?? 0) > 0,
  );
  const harmed =
    damage ||
    (!!survivor &&
      ((!intercept.before.frozen && survivor.frozen) ||
        (!intercept.before.silenced && survivor.silenced) ||
        (!intercept.before.weakened && survivor.weakened) ||
        (survivor.burnStacks ?? 0) > intercept.before.burn ||
        (survivor.movementLocks?.length ?? 0) > intercept.before.locks));
  if (intercept.kind === 'stud' && partner) {
    if (survivor) {
      const to = destinations(ctx, survivor).find((lane) =>
        ctx.openForMove(partner, lane),
      );
      if (to !== undefined) ctx.movePair(survivor, partner, to);
    }
    ctx.protect(partner);
  } else if (
    intercept.kind === 'fan' &&
    survivor &&
    intercept.fangirlPresent &&
    (harmed || survivor.lane !== intercept.before.lane)
  )
    give(ctx, intercept.source, survivor, 2, 'FAN CLUB +2');
  else if (intercept.kind === 'auntie' && harmed)
    runtime(ctx).seats[intercept.source.side].credit = {
      source: {
        id: intercept.source.id,
        cardId: intercept.source.cardId,
        side: intercept.source.side,
        lane: intercept.source.lane,
        position: intercept.source.position,
      },
      origin: intercept.source.lane,
      expiresAt: (pulse(ctx) + 2) * FACTION_PULSE_MS,
    };
}
export function factionsTick(ctx: FactionsContext): void {
  const state = runtime(ctx),
    time = pulse(ctx);
  for (const side of ['player', 'opponent'] as Side[]) {
    const seat = state.seats[side];
    seat.traps = seat.traps.filter(
      (trap) => trap.expiresAt > ctx.state.elapsedMs,
    );
    if (seat.auntie && (seat.auntie.expiresAt ?? 0) <= ctx.state.elapsedMs)
      delete seat.auntie;
    if (seat.credit && seat.credit.expiresAt <= ctx.state.elapsedMs)
      delete seat.credit;
  }
  if (time <= state.lastPulse) return;
  state.lastPulse = time;
  for (const source of board(ctx).sort((a, b) => a.id.localeCompare(b.id))) {
    if (!ctx.active(source)) continue;
    const ability = ctx.definition(source).ability;
    if (ability === 'eyes-on-the-crossing') redNight(ctx, source);
    else if (ability === 'clear-the-route') blueRoute(ctx, source);
    else if (ability === 'red-line-bodyguard' || ability === 'blue-nose-backup')
      dogTurn(ctx, source);
    else if (ability === 'on-point') {
      const seat = state.seats[source.side],
        ledger = seat.lookout[identity(source)];
      if (
        ledger &&
        ledger.calls < 3 &&
        ledger.pulse !== time &&
        allies(ctx, source).some(
          (ally) => gang(ctx, ally) === 'blue' && real(ctx, ally),
        )
      )
        ledger.ready = true;
    }
  }
}
