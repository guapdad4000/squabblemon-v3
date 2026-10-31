/** Finite authored summons. Runtime tokens never become collectible deck IDs.
 * Fighters spawn at the home entrance; Mushrooms are stationary lane resources. */
import type {
  BattleEvent,
  FighterDefinition,
  GameState,
  Lane,
  Side,
  Unit,
} from './breakthrough';
type EffectSource = Pick<Unit, 'id' | 'cardId' | 'side' | 'lane' | 'position'>;

export const SUMMON_PULSE_MS = 10000;
export const SUMMON_ABILITY_DESCRIPTIONS = {
  'mean-mug':
    'Deploy: flip seeded 50% chances in a chain. Each success summons one ordinary 1-Hand Shiesty YN at your home entrance here; stop on the first miss, up to eight extra per chain. Copies can fight, score and breach, but never enter your deck or hand.',
  'till-debt-do-us-part':
    'Deploy once per side per match: summon a 1-Hand Fake Marriage here, then Protect your weakest other actual character here. The token fights and marches normally, earns +1 on the first different ally moving into its lane each 10-second pulse, at most twice, and never recycles.',
  'special-delivery':
    'While held at match start and every 10-second pulse, plant one 2-Hand Mushroom in a seeded random legal lane. Deploy: plant one more. Mushrooms remain stationary, add no combat/timeout Hands or breaches, and are consumed by the next friendly paid character here for +2. They never enter a deck or hand.',
  'power-up':
    'Deploy: gain +1, and your weakest other local character gains +1; without one, gain a second +1. Consume at most one local friendly Mushroom for +2. Squabble uses Powered Luigion art: a consumed Mushroom replaces the solo extra +1, then a successful jump to your weakest other legal lane gives +1. Echoes consume no Mushrooms and never jump.',
  'off-with-their-heads':
    'Deploy: attempt to execute the weakest enemy here if its effective Hands are 6 or less. Normal hostile defenses and authored first-lethal survival can prevent execution. Only a true execution summons a 2-Hand Card Guard at your home entrance; the guard can fight, score and breach but never recycles.',
  'red-robber-check-in':
    'Deploy: hit the strongest enemy here for 1. Flip one seeded 50% chance to summon an ordinary Red Robber at your home entrance in a random other legal lane. The copy hits the strongest enemy there for 1, but cannot summon again; generated copies never enter decks or hands.',
  'voice-of-the-west':
    'Deploy: hit each enemy here with positive bonus Hands for 2. Gain +1 for each enemy actually damaged. Summon one ordinary 5-Hand Flying Monkeys here without firing its entrance. The summon can fight, score and breach, but never recycles.',
  'snatch-and-scatter':
    'Deploy: attempt to move the weakest enemy here into its weakest other legal lane. If it truly moves, give it 1 Burn. Protection, immunity, Freeze, or a blocked route can stop the move; no move means no Burn.',
  'shared-account':
    'Summoned only: fight with 1 starting Hand. The first different friendly fighter moving into this lane in each 10-second pulse grants this token +1; at most two such gains per token per match. It can score/breach and never recycles.',
  'royal-guard-token':
    'Summoned only: fight with 2 starting Hands. This guard marches, fights, contributes timeout Hands and can breach. It has no additional entrance and never recycles.',
  'local-power-up':
    'Summoned lane resource: stay at your home side until the next friendly paid character here consumes this Mushroom for +2 Hands. It cannot move, fight, score, breach, or recycle. Luigion consumes at most one on its own reveal; echoes never consume it.',
} as const;
export const SUMMON_ADAPTERS = {
  'shiesty-yn': {
    ability: 'mean-mug',
    triggers: ['entrance'],
    tacticalRoles: ['support'],
  },
  'naija-scammer': {
    ability: 'till-debt-do-us-part',
    triggers: ['entrance'],
    tacticalRoles: ['support'],
  },
  demario: {
    ability: 'special-delivery',
    tacticalRoles: ['support'],
    triggers: ['entrance', 'held'],
  },
  luigion: {
    ability: 'power-up',
    triggers: ['entrance'],
    tacticalRoles: ['support'],
  },
  'queen-of-hearts': {
    ability: 'off-with-their-heads',
    triggers: ['entrance'],
    tacticalRoles: ['control'],
  },
  'red-side-3': {
    ability: 'red-robber-check-in',
    triggers: ['entrance'],
    tacticalRoles: ['control'],
  },
  'wicked-witch': {
    ability: 'voice-of-the-west',
    triggers: ['entrance'],
    tacticalRoles: ['control'],
  },
  'flying-monkeys': {
    ability: 'snatch-and-scatter',
    triggers: ['entrance'],
    tacticalRoles: ['control'],
  },
} as const;
export const SUMMON_ARTWORK = {
  'fake-marriage':
    '/assets/battle-portraits/fake-marriage-a93b3d6a9659-384.webp',
  'card-guard': '/assets/battle-portraits/card-guard-c87aecb02eb3-384.webp',
  'demario-mushroom':
    '/assets/battle-portraits/demario-mushroom-ad98255484cb-384.webp',
  'luigion-powered':
    '/assets/battle-portraits/luigion-powered-ff66c4b50601-384.webp',
} as const;
/** Templates are engine-only, deliberately absent from SUMMON_ADAPTERS and the
 * canonical collectible catalog. Their Unit flags decide combat participation. */
export const SUMMON_TOKEN_DEFINITIONS = [
  {
    id: 'fake-marriage',
    name: 'Fake Marriage',
    element: 'Dark',
    cost: 0,
    hands: 1,
    kind: 'token',
    ability: 'shared-account',
    triggers: ['ongoing'],
    art: SUMMON_ARTWORK['fake-marriage'],
    description: SUMMON_ABILITY_DESCRIPTIONS['shared-account'],
  },
  {
    id: 'card-guard',
    name: 'Card Guard',
    element: 'Dark',
    cost: 0,
    hands: 2,
    kind: 'token',
    ability: 'royal-guard-token',
    triggers: [],
    art: SUMMON_ARTWORK['card-guard'],
    description: SUMMON_ABILITY_DESCRIPTIONS['royal-guard-token'],
  },
  {
    id: 'demario-mushroom',
    name: 'Demario Mushroom',
    element: 'Plant',
    cost: 0,
    hands: 2,
    kind: 'token',
    ability: 'local-power-up',
    triggers: [],
    art: SUMMON_ARTWORK['demario-mushroom'],
    description: SUMMON_ABILITY_DESCRIPTIONS['local-power-up'],
  },
] as const;
export interface SummonSpawnOptions {
  kind: 'fighter' | 'mushroom';
  hands?: number;
  suppressEntrance: true;
}
export interface SummonMatchState {
  marriageUsed: Record<Side, boolean>;
  marriageGrowth: Record<string, { pulse: number; used: number }>;
  mushroomUsed: Record<string, true>;
  lastHandPulse: number;
}
type SummonCard = Pick<
  FighterDefinition,
  'id' | 'hands' | 'kind' | 'element'
> & { ability?: string };
export interface SummonContext {
  state: GameState & { summons?: SummonMatchState };
  definition(unit: Unit): SummonCard;
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
  /** True only after a defended execution really defeats/removes the target. */
  execute(source: Unit, target: Unit, maxHands?: number): boolean;
  move(unit: Unit, lane: Lane): boolean;
  moveEnemy(
    source: Unit,
    target: Unit,
    lane: Lane,
    followUp?: { burn?: number; damage?: number },
  ): boolean;
  openForMove(unit: Unit, lane: Lane): boolean;
  openForSummon(side: Side, lane: Lane): boolean;
  /** Creates the unit at home; never runs paid-play hooks or entrance implicitly. */
  spawn(
    source: Unit,
    cardId: string,
    lane: Lane,
    options: SummonSpawnOptions,
  ): Unit | undefined;
  /** Resource consumption is neither a KO nor a return-to-deck event. */
  consume(unit: Unit): void;
  burn(source: Unit, target: Unit, stacks: number): boolean;
  random(): number;
  setForm(unit: Unit, artworkId: keyof typeof SUMMON_ARTWORK): void;
  event(event: Omit<BattleEvent, 'id'>): void;
}
const LANES: Lane[] = [0, 1, 2];
const TOKEN_IDS = new Set<string>(
  SUMMON_TOKEN_DEFINITIONS.map((token) => token.id),
);
const isResource = (unit: Unit) => unit.cardId === 'demario-mushroom';
function runtime(ctx: SummonContext): SummonMatchState {
  return (ctx.state.summons ??= {
    marriageUsed: { player: false, opponent: false },
    marriageGrowth: {},
    mushroomUsed: {},
    lastHandPulse: -1,
  });
}
export function cloneSummonState(
  state: SummonMatchState | undefined,
): SummonMatchState | undefined {
  return state
    ? {
        ...state,
        marriageUsed: { ...state.marriageUsed },
        marriageGrowth: Object.fromEntries(
          Object.entries(state.marriageGrowth).map(([id, value]) => [
            id,
            { ...value },
          ]),
        ),
        mushroomUsed: { ...state.mushroomUsed },
      }
    : undefined;
}
function fighters(ctx: SummonContext, side?: Side, lane?: Lane): Unit[] {
  return ctx.state.units.filter(
    (unit) =>
      unit.hands > 0 &&
      !isResource(unit) &&
      ['character', 'token'].includes(
        ctx.definition(unit).kind ?? 'character',
      ) &&
      (unit as Unit & { canFight?: boolean }).canFight !== false &&
      (side === undefined || unit.side === side) &&
      (lane === undefined || unit.lane === lane),
  );
}
function weakest(ctx: SummonContext, units: Unit[]) {
  return [...units].sort(
    (a, b) => ctx.power(a) - ctx.power(b) || a.id.localeCompare(b.id),
  )[0];
}
function strongest(ctx: SummonContext, units: Unit[]) {
  return [...units].sort(
    (a, b) => ctx.power(b) - ctx.power(a) || a.id.localeCompare(b.id),
  )[0];
}
function provenance(source: Unit) {
  return {
    sourceUnitId: source.id,
    sourceSide: source.side,
    sourceLane: source.lane,
    sourcePosition: source.position,
  };
}
function gain(
  ctx: SummonContext,
  source: Unit,
  target: Unit,
  amount: number,
  text: string,
) {
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
function randomItem<T>(ctx: SummonContext, items: T[]): T | undefined {
  return items.length
    ? items[
        Math.min(
          items.length - 1,
          Math.floor(Math.max(0, ctx.random()) * items.length),
        )
      ]
    : undefined;
}
function weakestOtherLane(ctx: SummonContext, unit: Unit): Lane | undefined {
  const score = (lane: Lane) =>
    fighters(ctx, unit.side, lane).reduce(
      (sum, ally) => sum + ctx.power(ally),
      0,
    );
  return LANES.filter((lane) => ctx.openForMove(unit, lane)).sort(
    (a, b) => score(a) - score(b) || a - b,
  )[0];
}
function plantMushroom(ctx: SummonContext, source: Unit): Unit | undefined {
  const lane = randomItem(
    ctx,
    LANES.filter((lane) => ctx.openForSummon(source.side, lane)),
  );
  return lane === undefined
    ? undefined
    : ctx.spawn(source, 'demario-mushroom', lane, {
        kind: 'mushroom',
        suppressEntrance: true,
      });
}
function consumeMushroom(ctx: SummonContext, unit: Unit, lane: Lane): boolean {
  const state = runtime(ctx);
  if (state.mushroomUsed[unit.id]) return false;
  const mushroom = ctx.state.units
    .filter(
      (resource) =>
        resource.side === unit.side &&
        resource.lane === lane &&
        resource.cardId === 'demario-mushroom' &&
        resource.hands > 0,
    )
    .sort(
      (a, b) =>
        (a.arrivalOrder ?? 0) - (b.arrivalOrder ?? 0) ||
        a.id.localeCompare(b.id),
    )[0];
  if (!mushroom) return false;
  state.mushroomUsed[unit.id] = true;
  ctx.consume(mushroom);
  gain(ctx, mushroom, unit, 2, 'MUSHROOM +2');
  return true;
}
/** Paid character placement, before its own reveal. Summons and echoes never pass
 * here; Luigion consumes at most one resource inside its own entrance. */
export function summonPlayed(
  ctx: SummonContext,
  unit: Unit,
  paidLane: Lane = unit.lane,
): void {
  if (
    unit.hands <= 0 ||
    ctx.definition(unit).ability === 'power-up' ||
    TOKEN_IDS.has(unit.cardId) ||
    (ctx.definition(unit).kind ?? 'character') !== 'character'
  )
    return;
  consumeMushroom(ctx, unit, paidLane);
}
export function summonMoved(ctx: SummonContext, moved: Unit): void {
  if (moved.hands <= 0 || isResource(moved)) return;
  const state = runtime(ctx),
    pulse = Math.floor(ctx.state.elapsedMs / SUMMON_PULSE_MS);
  for (const marriage of fighters(ctx, moved.side, moved.lane).filter(
    (unit) =>
      unit.id !== moved.id &&
      ctx.definition(unit).ability === 'shared-account' &&
      ctx.active(unit),
  )) {
    const earned = (state.marriageGrowth[marriage.id] ??= {
      pulse: -1,
      used: 0,
    });
    if (earned.used >= 2 || earned.pulse === pulse) continue;
    earned.used++;
    earned.pulse = pulse;
    gain(ctx, marriage, marriage, 1, 'SHARED ACCOUNT +1');
  }
}
export function summonEntrance(
  ctx: SummonContext,
  unit: Unit,
  options: { echo?: boolean } = {},
): void {
  if (!ctx.active(unit)) return;
  const ability = ctx.definition(unit).ability,
    state = runtime(ctx),
    echo = options.echo ?? false;
  const enemy = unit.side === 'player' ? 'opponent' : 'player';
  if (ability === 'mean-mug') {
    // The loop resolves the recursive copies directly; spawn never fires a new
    // entrance, so no recursion escapes the eight-extra chain limit.
    for (let extra = 0; extra < 8; extra++) {
      if (ctx.random() >= 0.5 || !ctx.openForSummon(unit.side, unit.lane))
        break;
      if (
        !ctx.spawn(unit, 'shiesty-yn', unit.lane, {
          kind: 'fighter',
          suppressEntrance: true,
        })
      )
        break;
    }
  } else if (ability === 'till-debt-do-us-part') {
    if (
      !state.marriageUsed[unit.side] &&
      ctx.openForSummon(unit.side, unit.lane)
    ) {
      const token = ctx.spawn(unit, 'fake-marriage', unit.lane, {
        kind: 'fighter',
        suppressEntrance: true,
      });
      if (token) {
        state.marriageUsed[unit.side] = true;
        const ally = weakest(
          ctx,
          fighters(ctx, unit.side, unit.lane).filter(
            (ally) =>
              ally.id !== unit.id &&
              !TOKEN_IDS.has(
                ally.cardId as
                  'fake-marriage' | 'card-guard' | 'demario-mushroom',
              ),
          ),
        );
        if (ally) ctx.protect(ally);
      }
    }
  } else if (ability === 'special-delivery') plantMushroom(ctx, unit);
  else if (ability === 'power-up') {
    const allies = fighters(ctx, unit.side, unit.lane).filter(
      (ally) => ally.id !== unit.id && !TOKEN_IDS.has(ally.cardId),
    );
    const ally = weakest(ctx, allies),
      consumed = !echo && consumeMushroom(ctx, unit, unit.lane),
      powered = unit.squabbled;
    if (powered) ctx.setForm(unit, 'luigion-powered');
    // Mushroom's +2 was applied by consumeMushroom. Powered form replaces only
    // the solo extra +1, preserving the existing burst ceiling.
    gain(
      ctx,
      unit,
      unit,
      1 + (ally || (powered && consumed) ? 0 : 1),
      'POWER-UP',
    );
    if (ally) gain(ctx, unit, ally, 1, 'POWER-UP +1');
    if (powered && !echo) {
      const destination = weakestOtherLane(ctx, unit);
      if (destination !== undefined && ctx.move(unit, destination))
        gain(ctx, unit, unit, 1, 'POWERED JUMP +1');
    }
  } else if (ability === 'off-with-their-heads') {
    const target = weakest(ctx, fighters(ctx, enemy, unit.lane));
    if (target && ctx.power(target) <= 6 && ctx.execute(unit, target, 6))
      ctx.spawn(unit, 'card-guard', unit.lane, {
        kind: 'fighter',
        suppressEntrance: true,
      });
  } else if (ability === 'red-robber-check-in') {
    const target = strongest(ctx, fighters(ctx, enemy, unit.lane));
    if (target) ctx.damage(unit, target, 1);
    const origin = (unit as Unit & { origin?: 'deck' | 'summon' }).origin;
    if (origin === 'summon') return;
    const destinations = LANES.filter(
      (lane) => lane !== unit.lane && ctx.openForSummon(unit.side, lane),
    );
    if (destinations.length && ctx.random() < 0.5) {
      const destination = randomItem(ctx, destinations)!;
      const copy = ctx.spawn(unit, 'red-side-3', destination, {
        kind: 'fighter',
        suppressEntrance: true,
      });
      if (copy) {
        const foe = strongest(ctx, fighters(ctx, enemy, destination));
        if (foe) ctx.damage(copy, foe, 1);
      }
    }
  } else if (ability === 'voice-of-the-west') {
    let affected = 0;
    for (const target of fighters(ctx, enemy, unit.lane).filter(
      (target) =>
        target.maxHands > target.baseHands * (target.squabbled ? 2 : 1),
    ))
      if (ctx.damage(unit, target, 2) > 0) affected++;
    if (affected) gain(ctx, unit, unit, affected, 'VOICE OF THE WEST');
    if (ctx.openForSummon(unit.side, unit.lane))
      ctx.spawn(unit, 'flying-monkeys', unit.lane, {
        kind: 'fighter',
        suppressEntrance: true,
      });
  } else if (ability === 'snatch-and-scatter') {
    const target = weakest(ctx, fighters(ctx, enemy, unit.lane)),
      destination = target ? weakestOtherLane(ctx, target) : undefined;
    if (target && destination !== undefined)
      ctx.moveEnemy(unit, target, destination, { burn: 1 });
  }
}
/** Round-start held delivery includes pulse zero. Call once after initial hands
 * are chosen, then every fixed engine tick. No draw is needed during Last Stand. */
export function summonTick(ctx: SummonContext): void {
  const state = runtime(ctx),
    pulse = Math.floor(ctx.state.elapsedMs / SUMMON_PULSE_MS);
  if (pulse <= state.lastHandPulse) return;
  state.lastHandPulse = pulse;
  for (const side of ['player', 'opponent'] as const) {
    const demario = ctx.state.players[side].hand.find(
      (id) =>
        ctx.state.roster.find((card) => card.id === id)?.ability ===
        'special-delivery',
    );
    if (!demario) continue;
    const source: Unit = {
      id: `hand:${side}:${demario}`,
      cardId: demario,
      side,
      lane: 0,
      position: side === 'player' ? 0 : 1,
      hands: 1,
      baseHands: 1,
      maxHands: 1,
      squabbled: false,
      nextEffectAt: Number.MAX_SAFE_INTEGER,
    };
    plantMushroom(ctx, source);
  }
}
