/** Authored copying, temporary forms and ownership-only combat contracts.
 * All clocks are reducer time. Animation, private decks and account ownership
 * never decide a rule, and entrance echoes never become paid placements. */
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
export const SPECIAL_ABILITY_DESCRIPTIONS = {
  imposter:
    'Deploy: copy up to 7 base Hands and the printed kit of the strongest active Ongoing enemy here. With no active Ongoing target, copy only the strongest enemy base Hands and gain+1. Preserve your invested/damaged Hands delta; copied entrances never fire.',
  'act-up':
    'Deploy: gain+1, then repeat the last resolved repeatable entrance with Tayaty as source. Otherwise gain Protection. Copying effects and persistent contract setups cannot repeat.',
  'corner-advice':
    'Deploy: coach the weakest eligible other local ally until the second following 10-second pulse. Later different friendly placements retry its failed entrance until one succeeds. With no eligible trainee, weakest other local ally+3.',
  'guyana-drop':
    'Deploy: summon the uncounterable 4-Hand Guyana at your home entrance in your weakest lane. Every other local friendly character+1; strongest enemy anywhere takes1. With Plant characters in two or more lanes, weakest Plant in each occupied lane+2.',
  'send-the-stewards':
    'Deploy: summon two ordinary 2-Hand Stewards here. Each Steward hits a different strongest enemy anywhere for2 and gives your weakest other local Air character+1, excluding Jigga and tokens. Summons do not fire entrances or enter decks.',
  'no-rules':
    'Deploy: move the weakest local enemy into its strongest other legal lane through normal hostile defenses. Gain+1 only if an enemy actually moves.',
  'definitely-not-him':
    'Deploy: fully cleanse and Protect your weakest other local ally. Once per card identity per match, when its personal Protection blocks an enemy ability while this source remains active, hit that attacker for3.',
  'grand-reveal':
    'Deploy once per card identity per match: repeat the latest successful repeatable entrance of another active friendly Oz traveler still on board, otherwise another active character. Its surviving source gains+3 if it moved this 10-second pulse, otherwise+2 if a traveler. No copied ability or persistent contract rearming.',
  'leave-a-grin':
    'While held or active on board: your first real ally return to hand each 10-second pulse leaves a 4-Hand Grin at its old lane home entrance, at most one friendly Grin per lane. Disappearance, KO and recycle are not hand returns.',
  'pocket-watch':
    'While held: other friendly characters really returned to hand receive a one-use 1-Motion deployment discount, minimum1. While active on board: gain+1 for every other friendly character returned to hand. Returned Rabbits cannot trigger retroactively.',
  'contraband-relay':
    'Deploy once per card identity per match: weakest other Inmate anywhere receives Contraband+1, or keep it pending. Later distinct Inmate placements or moves pass it. First three distinct carriers gain+1 each; on the third, each survivor gains another+1. Echoes never rearm the stash.',
  'fifteen-cents':
    'At each 10-second boundary, while active collect3 cents per enemy combat card up to15. At15 disappear once per instance, except during Last Stand. Next boundary return at home in your weakest lane as4-Motion/4-base-Hand Elephant, retaining invested Hands and damage. Ignore lane locks; hit each local enemy for1 through defenses.',
  'say-the-whole-name':
    'While active: once per 10-second pulse attempt to recruit the strongest enemy Snow Bunny anywhere, through defenses and interception. At most two actual recruitments per side per match, shared by copies; each Snow once. Active recruited Snow Freezes its strongest remaining local enemy. Fight ownership only; original decks remain unchanged.',
} as const;
export const SPECIAL_ADAPTERS = {
  scammer: {
    ability: 'imposter',
    triggers: ['entrance'],
    tacticalRoles: ['support'],
  },
  'bad-lil-cousin-tayaty': {
    ability: 'act-up',
    triggers: ['entrance'],
    tacticalRoles: ['support'],
  },
  'corner-coach': {
    ability: 'corner-advice',
    triggers: ['entrance'],
    tacticalRoles: ['support'],
  },
  ashlee: {
    ability: 'guyana-drop',
    triggers: ['entrance'],
    tacticalRoles: ['support'],
  },
  'captain-jigga': {
    ability: 'send-the-stewards',
    triggers: ['entrance'],
    tacticalRoles: ['support', 'control'],
  },
  'lawless-yn': {
    ability: 'no-rules',
    triggers: ['entrance'],
    tacticalRoles: ['control'],
  },
  'lebron-james': {
    ability: 'definitely-not-him',
    triggers: ['entrance'],
    tacticalRoles: ['support', 'control'],
  },
  oz: {
    ability: 'grand-reveal',
    triggers: ['entrance'],
    tacticalRoles: ['support'],
  },
  cheshire: {
    ability: 'leave-a-grin',
    triggers: ['ongoing', 'held'],
    tacticalRoles: ['support'],
  },
  'mr-rabbit': {
    ability: 'pocket-watch',
    triggers: ['ongoing', 'held'],
    tacticalRoles: ['support'],
  },
  'inmate-kingpin': {
    ability: 'contraband-relay',
    triggers: ['entrance'],
    tacticalRoles: ['support'],
  },
  'ms-mary-mack': {
    ability: 'fifteen-cents',
    triggers: ['ongoing'],
    tacticalRoles: ['support', 'control'],
  },
  'pimp-swookie': {
    ability: 'say-the-whole-name',
    triggers: ['ongoing'],
    tacticalRoles: ['control'],
  },
} as const;
export const SPECIAL_ARTWORK = {
  guyana: '/assets/battle-portraits/guyana-a3984f2784f4-384.webp',
  steward: '/assets/battle-portraits/steward-9bb918e8375f-384.webp',
  grin: '/assets/battle-portraits/grin-0333dc05482d-384.webp',
  elephant:
    '/assets/battle-portraits/ms-mary-mack-elephant-4ecc964e742b-384.webp',
} as const;
export const SPECIAL_TOKEN_DEFINITIONS = [
  {
    id: 'guyana',
    name: 'Guyana',
    kind: 'token',
    element: 'Earth',
    cost: 0,
    hands: 4,
    art: SPECIAL_ARTWORK.guyana,
    description:
      'Uncounterable summoned fighter. Can march, fight, score and breach; never joins a deck or hand.',
    triggers: [],
    cannotBeSilenced: true,
  },
  {
    id: 'steward',
    name: 'Steward',
    kind: 'token',
    element: 'Air',
    cost: 0,
    hands: 2,
    art: SPECIAL_ARTWORK.steward,
    description:
      'Summoned fighter. Can march, fight, score and breach; never joins a deck or hand.',
    triggers: [],
  },
  {
    id: 'grin',
    name: 'Grin',
    kind: 'token',
    element: 'Air',
    cost: 0,
    hands: 4,
    art: SPECIAL_ARTWORK.grin,
    description:
      'Summoned fighter. Can march, fight, score and breach; never joins a deck or hand.',
    triggers: [],
  },
] as const;
export interface SpecialDefinition {
  id: string;
  engineId?: string;
  kind?: string;
  cost: number;
  hands: number;
  element?: string;
  ability?: string;
  triggers?: readonly string[];
}
export interface SpecialsContext {
  state: GameState & { specials?: SpecialsRuntime };
  definition(unit: Unit): SpecialDefinition;
  /** Printed canonical definition, including held characters. No copied membership. */
  baseDefinition(cardId: string): SpecialDefinition | undefined;
  active(unit: Unit): boolean;
  power(unit: Unit): number;
  gain(
    unit: Unit,
    amount: number,
    copied?: boolean,
    source?: EffectSource,
  ): void;
  damage(source: Unit, target: Unit, amount: number): number;
  protect(source: Unit, target: Unit): boolean;
  cleanse(
    target: Unit,
    kinds?: TimedStatus['kind'][],
    source?: EffectSource,
  ): boolean;
  freeze(source: Unit, target: Unit): boolean;
  openForMove(unit: Unit, lane: Lane): boolean;
  enemyMove(
    source: Unit,
    target: Unit,
    lane: Lane,
    afterMoved?: (actual: Unit) => void,
  ): boolean;
  /** Home entrance, no entrance/play/arrival hooks; use SPECIAL_TOKEN_DEFINITIONS. */
  spawn(
    source: Unit,
    cardId: 'guyana' | 'steward' | 'grin',
    lane: Lane,
  ): Unit | undefined;
  /** Replace only base Hands/printed kit; preserve own identity, cost and traits. */
  copyOngoing(source: Unit, target: Unit, copyAbility: boolean): boolean;
  /** Entrance only with temporary ability override; no paid observers or cap resets.
   * Coach is a genuine retry on its original trainee, others are echoes. */
  repeat(
    actor: Unit,
    abilityCardId: string,
    options?: { coach?: boolean },
  ): boolean;
  /** Mary disappears without KO, hand return, movement or recycling. */
  disappear(unit: Unit): boolean;
  /** Same id, home entrance; retain signed investment/damage delta, ignore lane locks.
   * Reconcile expired statuses and use form art/cost on later live hand returns. */
  land(
    snapshot: Unit,
    lane: Lane,
    form: { baseHands: 4; cost: 4; art: string },
  ): Unit | undefined;
  /** Single hostile packet; redirect cannot recruit another character. Save original
   * combat owner for later recycle/return, never change account/deck ownership. */
  recruit(source: Unit, target: Unit): boolean;
  lastStand(): boolean;
  event(event: Omit<BattleEvent, 'id'>): void;
}
interface SpecialMark {
  source: Unit;
  side: Side;
  targets: string[];
  expiresAt: number;
  ready?: boolean;
  seen?: string[];
}
interface MaryState {
  cents: number;
  used: boolean;
  lastPulse: number;
  pending?: { snapshot: Unit; dueAt: number };
}
interface SeatState {
  used: Record<string, true>;
  moved: Record<string, number>;
  cheshirePulse: number;
  recruitPulse: number;
  recruits: number;
}
export interface SpecialDiscount {
  id: number;
  side: Side;
  cardId: string;
  source: Unit;
  amount: 1;
  minimum: 1;
}
export interface SpecialsRuntime {
  sequence: number;
  nextId: number;
  lastPulse: number;
  lastResolved?: { cardId: string; sourceId: string };
  history: { unitId: string; cardId: string; sequence: number }[];
  coaches: SpecialMark[];
  revenge: SpecialMark[];
  stashes: SpecialMark[];
  discounts: SpecialDiscount[];
  mary: Record<string, MaryState>;
  recruited: Record<string, true>;
  seats: Record<Side, SeatState>;
}
export interface SpecialReturnSnapshot {
  target: Unit;
  cat?: Unit;
  rabbits: Unit[];
  heldRabbit?: Unit;
}
const PULSE = 10000,
  LANES: readonly Lane[] = [0, 1, 2],
  forever = Number.MAX_SAFE_INTEGER;
const seat = (): SeatState => ({
  used: {},
  moved: {},
  cheshirePulse: -1,
  recruitPulse: -1,
  recruits: 0,
});
const pulse = (ctx: SpecialsContext) => Math.floor(ctx.state.elapsedMs / PULSE);
function runtime(ctx: SpecialsContext): SpecialsRuntime {
  return (ctx.state.specials ??= {
    sequence: 0,
    nextId: 1,
    lastPulse: pulse(ctx),
    history: [],
    coaches: [],
    revenge: [],
    stashes: [],
    discounts: [],
    mary: {},
    recruited: {},
    seats: { player: seat(), opponent: seat() },
  });
}
export function cloneSpecialsRuntime(
  value: SpecialsRuntime | undefined,
): SpecialsRuntime | undefined {
  return value
    ? (JSON.parse(JSON.stringify(value)) as SpecialsRuntime)
    : undefined;
}
const board = (ctx: SpecialsContext) =>
  ctx.state.units.filter((u) => u.hands > 0 && u.canFight !== false);
const find = (ctx: SpecialsContext, id: string) =>
  board(ctx).find((u) => u.id === id);
const character = (ctx: SpecialsContext, u: Unit) =>
  (ctx.definition(u).kind ?? 'character') === 'character';
const kit = (ctx: SpecialsContext, u: Unit) => ctx.definition(u).ability ?? '';
const stable = (u: Unit) => u.cardId;
const sorted = (ctx: SpecialsContext, units: Unit[], high = false) =>
  [...units].sort(
    (a, b) =>
      (high ? -1 : 1) * (ctx.power(a) - ctx.power(b)) ||
      a.id.localeCompare(b.id),
  );
const allies = (ctx: SpecialsContext, s: Unit, local = true) =>
  board(ctx).filter(
    (u) => u.side === s.side && u.id !== s.id && (!local || u.lane === s.lane),
  );
const enemies = (ctx: SpecialsContext, s: Unit, local = true) =>
  board(ctx).filter((u) => u.side !== s.side && (!local || u.lane === s.lane));
const score = (ctx: SpecialsContext, side: Side, lane: Lane) =>
  board(ctx)
    .filter(
      (u) => u.side === side && u.lane === lane && u.countsHands !== false,
    )
    .reduce((n, u) => n + ctx.power(u), 0);
const weakestLane = (ctx: SpecialsContext, side: Side) =>
  [...LANES].sort(
    (a, b) => score(ctx, side, a) - score(ctx, side, b) || a - b,
  )[0];
const other = (s: Side): Side => (s === 'player' ? 'opponent' : 'player');
const isTraveler = (id: string) =>
  ['dorothy', 'scarecrow', 'tin-man', 'lion'].includes(id);
function note(ctx: SpecialsContext, source: Unit, text: string, target?: Unit) {
  ctx.event({
    type: 'ability',
    side: source.side,
    lane: target?.lane ?? source.lane,
    position: target?.position ?? source.position,
    sourceUnitId: source.id,
    sourceSide: source.side,
    sourceLane: source.lane,
    sourcePosition: source.position,
    ...(target ? { targetUnitId: target.id, cardId: target.cardId } : {}),
    text,
  });
}
function gain(
  ctx: SpecialsContext,
  source: Unit,
  target: Unit | undefined,
  n: number,
): boolean {
  if (!target || !find(ctx, target.id) || n <= 0) return false;
  ctx.gain(target, n, false, source);
  note(ctx, source, `+${n} HANDS`, target);
  return true;
}
const snapshot = (u: Unit): Unit => JSON.parse(JSON.stringify(u)) as Unit;
/** Normal creative-wave repeatability, normalized to immutable catalog IDs.
 * Explicitly disallow copy/echo recursion and newer persistent setup kits too. */
const PERSISTENT_OR_COPY = new Set([
  'scammer',
  'bad-lil-cousin-tayaty',
  'oz',
  'techbro-rich',
  'hooper',
  'baby-momma',
  'honest-thot',
  'ice-cream-truck',
  'torta',
  'bust-down-watch',
  'crossing-guard',
  'laundromat-regular',
  'corner-busker',
  'corner-coach',
  'night-cashier',
  'mural-apprentice',
  'chess-regular',
  'rooftop-gardener',
  'dance-circle-captain',
  'midnight-mayor',
  'first-aid-kit',
  'boombox',
  'stud',
  'stoner-sr',
  'divorced-dad',
  'bbl-nice',
  'bbl-demon',
  'break-dancer',
  'failed-rapper',
  'failed-athlete',
  'incel',
  'hair-stylist',
  'stylist',
  'black-cowboy',
  'lebron-james',
  'dmv-worker',
  'yn-gokarter',
  'juneteenth-chair-guy',
  'circuit-captain',
  'canopy-keeper',
  'slipstream',
  'ahki',
  'mr-trick',
  'dr-umah',
  'atl-scammer',
  'hater',
  'tattoo-artist',
  'og-skater',
  'inmate-kingpin',
  'redneck-evil',
  'lawyer',
  'nigerian-father',
  'rent-a-cop',
  'concrete',
  'cologne-criminal',
  'homeless-wiseman',
  'lola',
  'the-opening-act',
  'the-dj',
  'the-hype-man',
  'the-manager-nice',
  'the-janky-promoter',
  'the-manager-evil',
  'the-og-rap-legend',
  'naija-scammer',
]);
export function specialsCanRepeat(
  definition: SpecialDefinition | undefined,
): boolean {
  return (
    !!definition &&
    (definition.kind ?? 'character') === 'character' &&
    !!definition.triggers?.includes('entrance') &&
    !PERSISTENT_OR_COPY.has(definition.id)
  );
}
const COACHABLE = new Set([
  'edgar',
  'nguyen',
  'man-man',
  'racially-ambiguous-transplant',
  'bodega-cat',
  'dog-walker',
  'sports-prodigy',
  'homeless-yn',
  'dragonfly-jones',
  'og-uncle',
  'barber-bro',
  'night-shift-medic',
  'squabble-house-female',
  'the-feds',
]);
function stashPass(ctx: SpecialsContext, mark: SpecialMark, target: Unit) {
  if (
    !find(ctx, target.id) ||
    target.side !== mark.side ||
    !character(ctx, target) ||
    target.id === mark.source.id ||
    !(ctx.baseDefinition(target.cardId)?.engineId ?? target.cardId).startsWith(
      'inmate-',
    ) ||
    mark.seen?.includes(target.id)
  )
    return;
  (mark.seen ??= []).push(target.id);
  mark.targets.push(target.id);
  gain(ctx, mark.source, target, 1);
  note(ctx, mark.source, 'CONTRABAND', target);
  if (mark.seen.length >= 3) {
    const r = runtime(ctx);
    r.stashes = r.stashes.filter((m) => m !== mark);
    for (const id of mark.targets) {
      const survivor = find(ctx, id);
      if (survivor?.side === mark.side) gain(ctx, mark.source, survivor, 1);
    }
  }
}
/** null = outside this module; false is a genuine failed entrance. */
export function specialsEntrance(
  ctx: SpecialsContext,
  s: Unit,
  options: { echoed?: boolean } = {},
): boolean | null {
  const ability = kit(ctx, s);
  if (!Object.hasOwn(SPECIAL_ABILITY_DESCRIPTIONS, ability)) return null;
  if (!find(ctx, s.id) || !ctx.active(s)) return false;
  if (
    options.echoed &&
    [
      'imposter',
      'act-up',
      'corner-advice',
      'definitely-not-him',
      'grand-reveal',
      'contraband-relay',
    ].includes(ability)
  )
    return false;
  const r = runtime(ctx),
    l = r.seats[s.side];
  if (ability === 'imposter') {
    const target =
      sorted(
        ctx,
        enemies(ctx, s).filter(
          (u) =>
            ctx.active(u) && ctx.definition(u).triggers?.includes('ongoing'),
        ),
        true,
      )[0] ?? sorted(ctx, enemies(ctx, s), true)[0];
    if (!target) return false;
    const copyAbility =
      ctx.active(target) &&
      !!ctx.definition(target).triggers?.includes('ongoing');
    const success = ctx.copyOngoing(s, target, copyAbility);
    if (!copyAbility) gain(ctx, s, find(ctx, s.id), 1);
    return success || !copyAbility;
  }
  if (ability === 'act-up') {
    gain(ctx, s, s, 1);
    const previous = r.lastResolved,
      def = previous && ctx.baseDefinition(previous.cardId);
    if (def && specialsCanRepeat(def)) {
      ctx.repeat(s, def.id);
      note(ctx, s, 'ACT UP');
    } else ctx.protect(s, s);
    return true;
  }
  if (ability === 'corner-advice') {
    const local = sorted(
        ctx,
        allies(ctx, s).filter((u) => character(ctx, u)),
      ),
      target = local.find((u) => COACHABLE.has(u.cardId));
    if (!target) return gain(ctx, s, local[0], 3);
    r.coaches = r.coaches.filter((m) => m.side !== s.side);
    r.coaches.push({
      source: snapshot(s),
      side: s.side,
      targets: [target.id],
      expiresAt: (pulse(ctx) + 2) * PULSE,
      ready: target.entranceSucceeded === false,
    });
    note(ctx, s, 'COACHED', target);
    return true;
  }
  if (ability === 'guyana-drop') {
    let changed = false;
    for (const target of [...allies(ctx, s)].filter((u) => character(ctx, u)))
      changed = gain(ctx, s, target, 1) || changed;
    const plants = board(ctx).filter(
        (u) =>
          u.side === s.side &&
          character(ctx, u) &&
          ctx.definition(u).element === 'Plant',
      ),
      occupied = LANES.filter((lane) => plants.some((u) => u.lane === lane));
    if (occupied.length >= 2)
      for (const lane of occupied)
        changed =
          gain(
            ctx,
            s,
            sorted(
              ctx,
              plants.filter((u) => u.lane === lane),
            )[0],
            2,
          ) || changed;
    changed = !!ctx.spawn(s, 'guyana', weakestLane(ctx, s.side)) || changed;
    const target = sorted(ctx, enemies(ctx, s, false), true)[0];
    if (target) changed = ctx.damage(s, target, 1) > 0 || changed;
    return changed;
  }
  if (ability === 'send-the-stewards') {
    const stewards: Unit[] = [];
    for (let n = 0; n < 2; n++) {
      const steward = ctx.spawn(s, 'steward', s.lane);
      if (steward) stewards.push(steward);
    }
    for (const steward of stewards) {
      if (!find(ctx, steward.id)) continue;
      const ally = sorted(
        ctx,
        allies(ctx, s).filter(
          (u) => character(ctx, u) && ctx.definition(u).element === 'Air',
        ),
      )[0];
      gain(ctx, steward, ally, 1);
    }
    const targets = sorted(ctx, enemies(ctx, s, false), true).slice(
      0,
      stewards.length,
    );
    for (let n = 0; n < targets.length; n++) {
      const target = find(ctx, targets[n].id),
        steward = find(ctx, stewards[n].id);
      if (target && steward) ctx.damage(steward, target, 2);
    }
    return stewards.length > 0;
  }
  if (ability === 'no-rules') {
    const targets = sorted(ctx, enemies(ctx, s));
    // The weakest enemy is selected first; a locked target is not skipped.
    const target = targets[0];
    if (!target) return false;
    const destination = [...LANES]
      .filter((lane) => lane !== target.lane && ctx.openForMove(target, lane))
      .sort(
        (a, b) =>
          score(ctx, target.side, b) - score(ctx, target.side, a) || a - b,
      )[0];
    if (destination === undefined || !ctx.enemyMove(s, target, destination))
      return false;
    gain(ctx, s, find(ctx, s.id), 1);
    return true;
  }
  if (ability === 'definitely-not-him') {
    const target = sorted(ctx, allies(ctx, s))[0];
    if (!target) return false;
    const cleaned = ctx.cleanse(target, undefined, s),
      protectedNow = ctx.protect(s, target);
    if (!l.used[`revenge:${stable(s)}`]) {
      r.revenge = r.revenge.filter(
        (m) => !(m.side === s.side && m.targets.includes(target.id)),
      );
      r.revenge.push({
        source: snapshot(s),
        side: s.side,
        targets: [target.id],
        expiresAt: forever,
      });
    }
    return cleaned || protectedNow;
  }
  if (ability === 'grand-reveal') {
    if (l.used[`oz:${stable(s)}`]) return false;
    const historical = [...r.history]
      .sort((a, b) => b.sequence - a.sequence)
      .map((h) => ({ history: h, unit: find(ctx, h.unitId) }))
      .filter(
        (
          entry,
        ): entry is {
          history: SpecialsRuntime['history'][number];
          unit: Unit;
        } =>
          !!entry.unit &&
          entry.unit.side === s.side &&
          entry.unit.id !== s.id &&
          ctx.active(entry.unit) &&
          character(ctx, entry.unit) &&
          specialsCanRepeat(ctx.baseDefinition(entry.history.cardId)),
      );
    const candidate =
      historical.find((h) => isTraveler(h.history.cardId)) ?? historical[0];
    if (!candidate) return false;
    l.used[`oz:${stable(s)}`] = true;
    ctx.repeat(candidate.unit, candidate.history.cardId);
    const live = find(ctx, candidate.unit.id),
      bonus =
        l.moved[candidate.unit.id] === pulse(ctx)
          ? 3
          : isTraveler(candidate.history.cardId)
            ? 2
            : 0;
    if (bonus) gain(ctx, s, live, bonus);
    return true;
  }
  if (ability === 'contraband-relay') {
    if (l.used[`stash:${stable(s)}`]) return false;
    l.used[`stash:${stable(s)}`] = true;
    const mark: SpecialMark = {
      source: snapshot(s),
      side: s.side,
      targets: [],
      seen: [],
      expiresAt: forever,
    };
    r.stashes.push(mark);
    const target = sorted(
      ctx,
      allies(ctx, s, false).filter(
        (u) =>
          character(ctx, u) &&
          (ctx.baseDefinition(u.cardId)?.engineId ?? u.cardId).startsWith(
            'inmate-',
          ),
      ),
    )[0];
    if (target) stashPass(ctx, mark, target);
    note(ctx, s, 'CONTRABAND READY');
    return true;
  }
  // Held/ongoing-only kits never invent a successful entrance.
  return false;
}
/** Call after every genuine resolved entrance, passing actual mechanical success.
 * Failed attempts still become Tayaty's last resolved On Reveal. Echoes do not. */
export function specialsEntranceResolved(
  ctx: SpecialsContext,
  u: Unit,
  success: boolean,
  options: { echoed?: boolean; abilityCardId?: string } = {},
) {
  if (options.echoed) return;
  const def = ctx.baseDefinition(options.abilityCardId ?? u.cardId);
  if (!def?.triggers?.includes('entrance')) return;
  const r = runtime(ctx);
  r.lastResolved = { cardId: def.id, sourceId: u.id };
  for (const mark of r.coaches.filter(
    (m) => m.targets.includes(u.id) && m.expiresAt > ctx.state.elapsedMs,
  ))
    mark.ready = !success;
  if (success) {
    r.sequence++;
    r.history = r.history.filter((h) => h.unitId !== u.id);
    r.history.push({ unitId: u.id, cardId: def.id, sequence: r.sequence });
  }
}
/** Paid placements only; callback must not turn a Coach retry into another placement. */
export function specialsPlayed(
  ctx: SpecialsContext,
  u: Unit,
  options: { echoed?: boolean } = {},
) {
  if (options.echoed || !find(ctx, u.id) || !character(ctx, u)) return;
  const r = ctx.state.specials;
  if (!r) return;
  for (const mark of [...r.coaches]) {
    if (
      mark.side !== u.side ||
      mark.source.id === u.id ||
      mark.targets.includes(u.id) ||
      mark.expiresAt <= ctx.state.elapsedMs ||
      !mark.ready
    )
      continue;
    const trainee = find(ctx, mark.targets[0]);
    if (!trainee || !ctx.active(trainee) || !COACHABLE.has(trainee.cardId))
      continue;
    r.coaches = r.coaches.filter((m) => m !== mark);
    const success = ctx.repeat(trainee, trainee.cardId, { coach: true });
    trainee.entranceSucceeded = success;
    if (
      !success &&
      find(ctx, trainee.id) &&
      mark.expiresAt > ctx.state.elapsedMs
    )
      r.coaches.push({ ...mark, ready: true });
  }
  for (const mark of [...r.stashes])
    if (mark.side === u.side) stashPass(ctx, mark, u);
}
export function specialsMoved(ctx: SpecialsContext, u: Unit) {
  if (!find(ctx, u.id)) return;
  const r = runtime(ctx);
  r.seats[u.side].moved[u.id] = pulse(ctx);
  for (const mark of [...r.stashes])
    if (mark.side === u.side) stashPass(ctx, mark, u);
}
/** Captured BEFORE mutation, so newly returned Rabbit/Cheshire cannot appear in
 * the old hand. Held definitions are canonical and statuses on returned snapshots
 * do not retroactively alter who saw the departure. */
export function specialsCaptureReturn(
  ctx: SpecialsContext,
  u: Unit,
): SpecialReturnSnapshot {
  const held = (id: string): Unit | undefined =>
    ctx.state.players[u.side].hand
      .map((cardId) => ctx.baseDefinition(cardId))
      .filter((d): d is SpecialDefinition => !!d)
      .filter((d) => d.id !== u.cardId && d.ability === id)
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(
        (d) =>
          ({
            id: `hand:${u.side}:${d.id}`,
            cardId: d.id,
            side: u.side,
            lane: u.lane,
            position: u.position,
            hands: d.hands,
            baseHands: d.hands,
            maxHands: d.hands,
            squabbled: false,
            nextEffectAt: 0,
          }) as Unit,
      )[0];
  const active = board(ctx).filter((v) => v.side === u.side && ctx.active(v));
  return {
    target: snapshot(u),
    cat: active.find((v) => kit(ctx, v) === 'leave-a-grin')
      ? snapshot(active.find((v) => kit(ctx, v) === 'leave-a-grin')!)
      : held('leave-a-grin'),
    rabbits: active
      .filter((v) => v.id !== u.id && kit(ctx, v) === 'pocket-watch')
      .map(snapshot),
    heldRabbit: held('pocket-watch'),
  };
}
/** Invoke only after confirmed real hand return, not on KO/recycle/disappearance. */
export function specialsReturned(
  ctx: SpecialsContext,
  before: SpecialReturnSnapshot,
) {
  const u = before.target;
  if (!character(ctx, u)) return;
  const r = runtime(ctx),
    l = r.seats[u.side];
  if (before.heldRabbit) {
    r.discounts = r.discounts.filter(
      (d) => !(d.side === u.side && d.cardId === u.cardId),
    );
    r.discounts.push({
      id: r.nextId++,
      side: u.side,
      cardId: u.cardId,
      source: before.heldRabbit,
      amount: 1,
      minimum: 1,
    });
    note(ctx, before.heldRabbit, 'POCKET WATCH · −1 MOTION', u);
  }
  for (const source of before.rabbits) {
    const live = find(ctx, source.id);
    if (live && ctx.active(live)) gain(ctx, live, live, 1);
  }
  if (before.cat && l.cheshirePulse !== pulse(ctx)) {
    l.cheshirePulse = pulse(ctx);
    if (
      !board(ctx).some(
        (v) => v.side === u.side && v.lane === u.lane && v.cardId === 'grin',
      )
    )
      ctx.spawn(before.cat, 'grin', u.lane);
  }
}
export function specialsDiscount(
  ctx: SpecialsContext,
  side: Side,
  definition: Pick<SpecialDefinition, 'id' | 'kind'>,
): SpecialDiscount | undefined {
  if ((definition.kind ?? 'character') !== 'character') return;
  return (ctx.state.specials?.discounts ?? []).find(
    (d) => d.side === side && d.cardId === definition.id,
  );
}
export function specialsSpendDiscount(
  ctx: SpecialsContext,
  side: Side,
  id: number,
) {
  if (ctx.state.specials)
    ctx.state.specials.discounts = ctx.state.specials.discounts.filter(
      (d) => d.side !== side || d.id !== id,
    );
}
/** Only a personal ward consumed by an enemy ability can cash LeBron's revenge. */
export function specialsProtectionConsumed(
  ctx: SpecialsContext,
  target: Unit,
  attacker: Unit,
  personal = true,
) {
  if (!personal || target.side === attacker.side) return;
  const r = ctx.state.specials;
  if (!r) return;
  const mark = r.revenge.find(
    (m) =>
      m.side === target.side &&
      m.targets.includes(target.id) &&
      !!find(ctx, m.source.id) &&
      ctx.active(find(ctx, m.source.id)!),
  );
  if (!mark) return;
  const source = find(ctx, mark.source.id)!;
  const key = `revenge:${stable(source)}`;
  if (r.seats[source.side].used[key]) return;
  r.seats[source.side].used[key] = true;
  r.revenge = r.revenge.filter((m) => m !== mark);
  const enemy = find(ctx, attacker.id);
  if (enemy) ctx.damage(source, enemy, 3);
}
/** Any true board change may expose a Snow Bunny; shared guards are spent before
 * entering the defended packet so recursive changes cannot recruit twice. */
export function specialsAfterBoardChange(ctx: SpecialsContext) {
  if (
    !board(ctx).some(
      (u) => ctx.active(u) && kit(ctx, u) === 'say-the-whole-name',
    )
  )
    return;
  const r = runtime(ctx);
  for (const side of ['player', 'opponent'] as const) {
    const l = r.seats[side];
    if (l.recruits >= 2 || l.recruitPulse === pulse(ctx)) continue;
    const source = board(ctx)
      .filter(
        (u) =>
          u.side === side &&
          kit(ctx, u) === 'say-the-whole-name' &&
          ctx.active(u),
      )
      .sort(
        (a, b) =>
          (a.arrivalOrder ?? 0) - (b.arrivalOrder ?? 0) ||
          a.id.localeCompare(b.id),
      )[0];
    if (!source) continue;
    const target = sorted(
      ctx,
      board(ctx).filter(
        (u) =>
          u.side !== side && u.cardId === 'snow-bunny' && !r.recruited[u.id],
      ),
      true,
    )[0];
    if (!target) continue;
    l.recruitPulse = pulse(ctx);
    r.recruited[target.id] = true;
    if (!ctx.recruit(source, target)) {
      delete r.recruited[target.id];
      continue;
    }
    const recruited = find(ctx, target.id);
    if (!recruited || recruited.side !== side) {
      delete r.recruited[target.id];
      continue;
    }
    l.recruits++;
    note(ctx, source, 'RECRUITED', recruited);
    if (ctx.active(recruited)) {
      const victim = sorted(ctx, enemies(ctx, recruited), true)[0];
      if (victim) ctx.freeze(recruited, victim);
    }
  }
}
/** Delayed forms land before the settled census. No retroactive pulses accrue for
 * an inactive source; a pending form still lands if Last Stand starts meanwhile. */
export function specialsTick(ctx: SpecialsContext) {
  const hasMary = board(ctx).some((u) => kit(ctx, u) === 'fifteen-cents'),
    hasPimp = board(ctx).some((u) => kit(ctx, u) === 'say-the-whole-name');
  if (!ctx.state.specials && !hasMary && !hasPimp) return;
  const r = runtime(ctx),
    now = pulse(ctx);
  r.coaches = r.coaches.filter(
    (m) => m.expiresAt > ctx.state.elapsedMs && !!find(ctx, m.targets[0]),
  );
  r.revenge = r.revenge.filter((m) => !!find(ctx, m.targets[0]));
  if (now > r.lastPulse) {
    r.lastPulse = now;
    for (const value of Object.values(r.mary)) {
      const pending = value.pending;
      if (!pending || pending.dueAt > ctx.state.elapsedMs) continue;
      const landed = ctx.land(
        snapshot(pending.snapshot),
        weakestLane(ctx, pending.snapshot.side),
        { baseHands: 4, cost: 4, art: SPECIAL_ARTWORK.elephant },
      );
      if (!landed) continue;
      delete value.pending;
      note(ctx, landed, 'ELEPHANT DROP');
      for (const target of [...enemies(ctx, landed)]) {
        if (!find(ctx, landed.id) || !ctx.active(landed)) break;
        const live = find(ctx, target.id);
        if (live) ctx.damage(landed, live, 1);
      }
    }
    const census = {
      player: board(ctx).filter((u) => u.side === 'player').length,
      opponent: board(ctx).filter((u) => u.side === 'opponent').length,
    };
    for (const s of [...board(ctx)].filter(
      (u) => kit(ctx, u) === 'fifteen-cents' && ctx.active(u),
    )) {
      const value = (r.mary[s.id] ??= { cents: 0, used: false, lastPulse: -1 });
      if (value.used || value.lastPulse === now) continue;
      value.lastPulse = now;
      const before = value.cents;
      value.cents = Math.min(15, before + census[other(s.side)] * 3);
      if (value.cents !== before) note(ctx, s, `${value.cents}¢ / 15¢`);
      if (value.cents === 15 && !ctx.lastStand()) {
        if (ctx.disappear(s)) {
          value.used = true;
          value.pending = { snapshot: snapshot(s), dueAt: (now + 1) * PULSE };
          note(ctx, s, '15¢ · DISAPPEAR');
        }
      }
    }
  }
  specialsAfterBoardChange(ctx);
}
