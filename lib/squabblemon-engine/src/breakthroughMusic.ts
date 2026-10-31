/** Reviewed real-time Music kits. These hooks resolve gameplay immediately;
 * presentation never schedules or delays deployment. Only type imports prevent
 * a circular dependency on the owning Breakthrough reducer. */
import type { BattleEvent, GameState, Lane, Side, Unit } from './breakthrough';

export const MUSIC_PULSE_MS = 10000;
export const MUSIC_ABILITY_DESCRIPTIONS = {
  'next-stop':
    'Deploy: bring your weakest movable Music ally from another lane here. Both gain +2 only after arrival. One successful pickup per side per 10-second pulse.',
  'second-stage':
    'Deploy: send your weakest movable local Music ally to your weakest legal other lane. After arrival it gains +2 and this gains +1. One successful transfer per side per 10-second pulse.',
  'tour-money':
    'While active, the first different Music character successfully resolving an entrance here per 10-second pulse earns one local Music discount of 1 Motion, minimum 1. Two discounts per side per match; echoes do not count.',
  'wake-up-bro':
    'Deploy: your weakest other local Music fighter gains +3 Hands.',
  'whole-set':
    'While held, your first different successful Music entrance per 10-second pulse gains +2, twice per side per match. Deploy once per side: if Music occupies all three lanes give the weakest Music fighter in each +3; otherwise your weakest other local Music ally gains +4.',
  soundcheck:
    'Deploy: prepare your weakest other legal lane until the second following 10-second pulse. The next different Music character with a successful entrance there refunds 1 Motion. One refund per side per match.',
  spinback:
    'Deploy: return your weakest other movable local Music fighter costing 3 or less to hand, carrying its current Hands +2. Its next deployment costs 1 less, minimum 1, until the second following 10-second pulse. One successful return per side per match; spent limits stay spent.',
  'say-it-back':
    'Deploy: call your weakest other active Music ally until the second following 10-second pulse. Your next different Music character played in another lane gives caller and responder +3 each and Protects the caller. Caller and Hype Man must remain active; one call per side.',
  'read-the-contract':
    'Deploy: insure your next other Music deployment until the second following 10-second pulse. An enemy-canceled or queued entrance refunds 1 Motion; otherwise the artist gains +1 and Protection after its entrance. The next deployment spends the rider either way; manager must remain active.',
  'sixteen-bars':
    'While active, once per 10-second pulse a different successful Music entrance here hits the strongest local enemy for 3. Independently once per pulse, a successful Music entrance elsewhere gives the weakest ally there +3. Copies share limits; echoes do not count.',
  'wrong-address-booking':
    'Deploy: post a public bogus booking in the enemy’s weakest other legal lane until the second following 10-second pulse. Their next character played or moved there takes 1 damage; only actual damage can Weaken it. Spent even if blocked; one booking per side.',
  'everybody-watching':
    'While active, once per 10-second pulse after an enemy actually damages a different Music ally in another lane, try to move there. Gain +1 only after arrival. Copies share the trigger; blocked and friendly hits do not count.',
  'diss-track':
    'Deploy: trim up to 4 removable bonus Hands from the strongest enemy here, or hit it for 4 if it has no bonus. Only a changed surviving target receives a Receipt until the second following pulse: its next positive Hands gain remains but draws one Silence attempt. Defenses apply.',
  '360-deal':
    'Deploy: give your strongest unsigned other local Music ally +3 and a source-owned movement restriction until the second following pulse. At expiry, transfer up to 2 remaining bonus Hands to this active surviving Manager. Cleanse cancels only this contract. One contract per side; each client signs once per match.',
  'pass-the-torch':
    'Deploy once per side: repeat your weakest other active Music fighter’s successful entrance, printed cost 3 or less, then Protect it. Give the weakest Music ally in each other lane +4. Echoes never become paid plays or arrivals, never reset limits, and cannot recursively repeat Torch.',
} as const;

export const MUSIC_ADAPTERS = {
  'tour-van-driver': { ability: 'next-stop', tacticalRoles: ['support'] },
  'mixtape-cousin': { ability: 'second-stage', tacticalRoles: ['support'] },
  'merch-table-hustler': { ability: 'tour-money', tacticalRoles: ['support'] },
  'studio-couch-yn': { ability: 'wake-up-bro', tacticalRoles: ['support'] },
  'one-man-band': { ability: 'whole-set', tacticalRoles: ['support'] },
  'the-opening-act': { ability: 'soundcheck', tacticalRoles: ['support'] },
  'the-dj': { ability: 'spinback', tacticalRoles: ['support'] },
  'the-hype-man': { ability: 'say-it-back', tacticalRoles: ['support'] },
  'the-manager-nice': {
    ability: 'read-the-contract',
    tacticalRoles: ['support'],
  },
  'the-rapper': {
    ability: 'sixteen-bars',
    tacticalRoles: ['support', 'control'],
  },
  'the-janky-promoter': {
    ability: 'wrong-address-booking',
    tacticalRoles: ['control'],
  },
  'the-local-celebrity': {
    ability: 'everybody-watching',
    tacticalRoles: ['support'],
  },
  'the-battle-rapper': { ability: 'diss-track', tacticalRoles: ['control'] },
  'the-manager-evil': { ability: '360-deal', tacticalRoles: ['support'] },
  'the-og-rap-legend': {
    ability: 'pass-the-torch',
    tacticalRoles: ['support'],
  },
} as const;

export interface MusicDefinition {
  id: string;
  cost: number;
  hands: number;
  kind?: string;
  ability?: string;
  traits?: readonly string[];
  triggers?: readonly string[];
}
export interface MusicReturnOptions {
  /** Add to actual current Hands, not printed Hands. */
  carriedHands: number;
  discount: number;
  expiresAt: number;
}
export interface MusicContext {
  state: GameState & { music?: BreakthroughMusicRuntime };
  definition(unit: Unit): MusicDefinition;
  active(unit: Unit): boolean;
  /** Effective scoring Hands, including Freeze=0. */
  power(unit: Unit): number;
  gain(
    unit: Unit,
    amount: number,
    copied?: boolean,
    source?: Pick<Unit, 'id' | 'cardId' | 'side' | 'lane' | 'position'>,
  ): void;
  damage(source: Unit, target: Unit, amount: number): number;
  weaken(source: Unit, target: Unit): boolean;
  silence(source: Unit, target: Unit): boolean;
  protect(source: Unit, target: Unit): boolean;
  /** Hostile confiscation: immunity, shields and actual removable bonus apply. */
  trim(source: Unit, target: Unit, amount: number): number;
  /** Friendly contract royalty: remove actual bonus without damage/healing credit. */
  removeBonus(target: Unit, amount: number): number;
  move(unit: Unit, lane: Lane): boolean;
  openForMove(unit: Unit, lane: Lane): boolean;
  /** Preserve identity, shared ledgers and spent caps. Must reject a full hand. */
  returnAllyToHand(
    source: Unit,
    target: Unit,
    options: MusicReturnOptions,
  ): boolean;
  refund(side: Side, amount: number, source: Unit): number;
  /** Only entrance resolution; no play/arrival/paid observers and no recursive copy. */
  echo(source: Unit, target: Unit): boolean;
  event(event: Omit<BattleEvent, 'id'>): void;
}
type MusicMarkKind =
  'soundcheck' | 'call' | 'rider' | 'booking' | 'diss' | 'contract';
export interface MusicMark {
  id: number;
  kind: MusicMarkKind;
  side: Side;
  source: Unit;
  lane: Lane;
  expiresAt: number;
  targetId?: string;
}
export interface MusicDiscount {
  id: number;
  kind: 'local' | 'return';
  source: Unit;
  side: Side;
  lane: Lane;
  expiresAt: number;
  targetCardId?: string;
  amount: 1;
  minimum: 1;
}
export interface MusicSeatLedger {
  used: Record<string, number>;
  pulses: Record<string, number>;
  signedClients: string[];
}
export interface BreakthroughMusicRuntime {
  seats: Record<Side, MusicSeatLedger>;
  marks: MusicMark[];
  discounts: MusicDiscount[];
  nextId: number;
}
export interface MusicDeploymentSnapshot {
  marks: MusicMark[];
}
export interface MusicPlayedOptions {
  outcome: 'resolved' | 'cancelled' | 'queued' | 'none';
  echoed?: boolean;
  /** Original paid lane, before an entrance move. */
  paidLane?: Lane;
  snapshot?: MusicDeploymentSnapshot;
}

const LANES: readonly Lane[] = [0, 1, 2];
const pulse = (ctx: MusicContext) =>
  Math.floor(ctx.state.elapsedMs / MUSIC_PULSE_MS);
const expiry = (ctx: MusicContext) => (pulse(ctx) + 2) * MUSIC_PULSE_MS;
const freshSeat = (): MusicSeatLedger => ({
  used: {},
  pulses: {},
  signedClients: [],
});
export function createMusicRuntime(): BreakthroughMusicRuntime {
  return {
    seats: { player: freshSeat(), opponent: freshSeat() },
    marks: [],
    discounts: [],
    nextId: 1,
  };
}
export function cloneMusicRuntime(
  value: BreakthroughMusicRuntime | undefined,
): BreakthroughMusicRuntime | undefined {
  return value
    ? (JSON.parse(JSON.stringify(value)) as BreakthroughMusicRuntime)
    : undefined;
}
function runtime(ctx: MusicContext): BreakthroughMusicRuntime {
  return (ctx.state.music ??= createMusicRuntime());
}
function ledger(ctx: MusicContext, side: Side): MusicSeatLedger {
  return runtime(ctx).seats[side];
}
function ability(ctx: MusicContext, unit: Unit): string {
  return ctx.definition(unit).ability ?? '';
}
function character(ctx: MusicContext, unit: Unit): boolean {
  return (ctx.definition(unit).kind ?? 'character') === 'character';
}
function musical(ctx: MusicContext, unit: Unit): boolean {
  return (
    character(ctx, unit) &&
    (ctx.definition(unit).traits?.includes('music') ?? false)
  );
}
function board(ctx: MusicContext): Unit[] {
  return ctx.state.units.filter((u) => u.hands > 0 && character(ctx, u));
}
function find(ctx: MusicContext, id: string): Unit | undefined {
  return board(ctx).find((u) => u.id === id);
}
const weak = (ctx: MusicContext, units: Unit[]) =>
  [...units].sort(
    (a, b) => ctx.power(a) - ctx.power(b) || a.id.localeCompare(b.id),
  )[0];
const strong = (ctx: MusicContext, units: Unit[]) =>
  [...units].sort(
    (a, b) => ctx.power(b) - ctx.power(a) || a.id.localeCompare(b.id),
  )[0];
function otherMusic(ctx: MusicContext, source: Unit, local = false): Unit[] {
  return board(ctx).filter(
    (u) =>
      u.side === source.side &&
      u.id !== source.id &&
      musical(ctx, u) &&
      (!local || u.lane === source.lane),
  );
}
function foes(ctx: MusicContext, source: Unit, lane = source.lane): Unit[] {
  return board(ctx).filter((u) => u.side !== source.side && u.lane === lane);
}
function provenance(source: Unit) {
  return {
    sourceUnitId: source.id,
    sourceSide: source.side,
    sourceLane: source.lane,
    sourcePosition: source.position,
  };
}
function note(ctx: MusicContext, source: Unit, text: string, target?: Unit) {
  ctx.event({
    type: 'ability',
    side: source.side,
    lane: target?.lane ?? source.lane,
    position: target?.position ?? source.position,
    ...provenance(source),
    ...(target ? { targetUnitId: target.id, cardId: target.cardId } : {}),
    text,
  });
}
function gain(
  ctx: MusicContext,
  source: Unit,
  target: Unit | undefined,
  amount: number,
  text: string,
): boolean {
  if (!target || target.hands <= 0 || amount <= 0) return false;
  const first = ctx.state.nextEventId;
  // A real positive gain precedes synchronous confiscation/rebuttal reactions.
  // A later loss cannot retroactively turn that entrance into a failed gain.
  ctx.gain(target, amount, false, source);
  for (const event of ctx.state.events)
    if (event.id >= first && event.targetUnitId === target.id)
      Object.assign(event, provenance(source), {
        targetUnitId: target.id,
        cardId: target.cardId,
        text,
      });
  note(ctx, source, text, target);
  return true;
}
function legalOtherLane(
  ctx: MusicContext,
  unit: Unit,
  controller = unit.side,
): Lane | undefined {
  return LANES.filter((l) => l !== unit.lane && ctx.openForMove(unit, l)).sort(
    (a, b) =>
      board(ctx)
        .filter((u) => u.side === controller && u.lane === a)
        .reduce((n, u) => n + ctx.power(u), 0) -
        board(ctx)
          .filter((u) => u.side === controller && u.lane === b)
          .reduce((n, u) => n + ctx.power(u), 0) || a - b,
  )[0];
}
function preparedLane(ctx: MusicContext, side: Side, origin: Lane): Lane {
  return [...LANES]
    .filter((l) => l !== origin)
    .sort(
      (a, b) =>
        board(ctx)
          .filter((u) => u.side === side && u.lane === a)
          .reduce((n, u) => n + ctx.power(u), 0) -
          board(ctx)
            .filter((u) => u.side === side && u.lane === b)
            .reduce((n, u) => n + ctx.power(u), 0) || a - b,
    )[0];
}
function put(
  ctx: MusicContext,
  source: Unit,
  kind: MusicMarkKind,
  lane = source.lane,
  targetId?: string,
): MusicMark {
  const r = runtime(ctx);
  // Receipts are per target; all other authored marks are one per side/kind.
  r.marks = r.marks.filter(
    (m) =>
      !(
        m.side === source.side &&
        m.kind === kind &&
        (kind !== 'diss' || m.targetId === targetId)
      ),
  );
  const mark: MusicMark = {
    id: r.nextId++,
    kind,
    side: source.side,
    source: { ...source },
    lane,
    targetId,
    expiresAt: expiry(ctx),
  };
  r.marks.push(mark);
  return mark;
}
function removeMark(ctx: MusicContext, mark: MusicMark) {
  const r = runtime(ctx);
  r.marks = r.marks.filter((m) => m.id !== mark.id);
  if (mark.kind === 'contract' && mark.targetId) {
    const client = find(ctx, mark.targetId);
    if (client)
      client.movementLocks = client.movementLocks?.filter(
        (lock) => lock.sourceId !== `music:${mark.id}`,
      );
  }
}
function liveMarks(ctx: MusicContext, kind?: MusicMarkKind): MusicMark[] {
  return (ctx.state.music?.marks ?? []).filter(
    (m) => m.expiresAt > ctx.state.elapsedMs && (!kind || m.kind === kind),
  );
}
function oncePulse(
  ctx: MusicContext,
  side: Side,
  key: string,
  maximum = Infinity,
): boolean {
  const l = ledger(ctx, side);
  if (l.pulses[key] === pulse(ctx) || (l.used[key] ?? 0) >= maximum)
    return false;
  l.pulses[key] = pulse(ctx);
  l.used[key] = (l.used[key] ?? 0) + 1;
  return true;
}
function discount(
  ctx: MusicContext,
  source: Unit,
  kind: MusicDiscount['kind'],
  targetCardId?: string,
  recipient = source.side,
) {
  const r = runtime(ctx);
  r.discounts.push({
    id: r.nextId++,
    kind,
    source: { ...source },
    side: recipient,
    lane: source.lane,
    expiresAt: expiry(ctx),
    targetCardId,
    amount: 1,
    minimum: 1,
  });
}

/** Capture before an entrance can move a card or arm a new contract. */
export function musicCaptureDeployment(
  ctx: MusicContext,
): MusicDeploymentSnapshot {
  return {
    marks: liveMarks(ctx).map((m) => ({ ...m, source: { ...m.source } })),
  };
}

/** Returns null for a kit owned elsewhere, false for a passive/no-payoff entrance. */
export function musicEntrance(
  ctx: MusicContext,
  source: Unit,
  options: { echoed?: boolean } = {},
): boolean | null {
  const kit = ability(ctx, source);
  if (!Object.hasOwn(MUSIC_ABILITY_DESCRIPTIONS, kit)) return null;
  if (!ctx.active(source) || source.hands <= 0) return false;
  const l = ledger(ctx, source.side);
  if (kit === 'next-stop') {
    if (l.pulses.pickup === pulse(ctx)) return false;
    const target = weak(
      ctx,
      otherMusic(ctx, source).filter(
        (u) => u.lane !== source.lane && ctx.openForMove(u, source.lane),
      ),
    );
    if (!target || !ctx.move(target, source.lane)) return false;
    oncePulse(ctx, source.side, 'pickup');
    gain(ctx, source, find(ctx, target.id), 2, 'Next Stop · +2');
    gain(ctx, source, find(ctx, source.id), 2, 'Next Stop · +2');
    return true;
  }
  if (kit === 'second-stage') {
    if (l.pulses.transfer === pulse(ctx)) return false;
    const target = weak(
      ctx,
      otherMusic(ctx, source, true).filter(
        (u) => legalOtherLane(ctx, u) !== undefined,
      ),
    );
    if (!target) return false;
    const lane = legalOtherLane(ctx, target);
    if (lane === undefined || !ctx.move(target, lane)) return false;
    oncePulse(ctx, source.side, 'transfer');
    gain(ctx, source, find(ctx, target.id), 2, 'Second Stage · +2');
    gain(ctx, source, find(ctx, source.id), 1, 'Second Stage · +1');
    return true;
  }
  if (kit === 'wake-up-bro')
    return gain(
      ctx,
      source,
      weak(ctx, otherMusic(ctx, source, true)),
      3,
      'Wake Up Bro · +3',
    );
  if (kit === 'whole-set') {
    if (l.used.wholeSet) return false;
    const all = board(ctx).filter(
      (u) => u.side === source.side && musical(ctx, u),
    );
    const targets = LANES.every((lane) => all.some((u) => u.lane === lane))
      ? LANES.map((lane) =>
          weak(
            ctx,
            all.filter((u) => u.lane === lane),
          ),
        )
      : [weak(ctx, otherMusic(ctx, source, true))];
    let success = false;
    for (const target of targets)
      success =
        gain(ctx, source, target, targets.length === 3 ? 3 : 4, 'Whole Set') ||
        success;
    if (success) l.used.wholeSet = 1;
    return success;
  }
  if (kit === 'soundcheck') {
    if (l.used.soundcheck) return false;
    const lane = preparedLane(ctx, source.side, source.lane);
    put(ctx, source, 'soundcheck', lane);
    note(ctx, source, 'Soundcheck · stage prepared');
    return true;
  }
  if (kit === 'spinback') {
    if (l.used.spinback) return false;
    const target = weak(
      ctx,
      otherMusic(ctx, source, true).filter(
        (u) =>
          ctx.definition(u).cost <= 3 &&
          !u.frozen &&
          !(u.movementLocks ?? []).some(
            (lock) => lock.expiresAt > ctx.state.elapsedMs,
          ),
      ),
    );
    if (
      !target ||
      !ctx.returnAllyToHand(source, target, {
        carriedHands: 2,
        discount: 1,
        expiresAt: expiry(ctx),
      })
    )
      return false;
    l.used.spinback = 1;
    discount(ctx, source, 'return', target.cardId, target.side);
    note(ctx, source, 'Spinback · returned with +2', target);
    return true;
  }
  if (kit === 'say-it-back') {
    const target = weak(
      ctx,
      otherMusic(ctx, source).filter((u) => ctx.active(u)),
    );
    if (!target) return false;
    put(ctx, source, 'call', target.lane, target.id);
    note(ctx, source, 'Say It Back · caller ready', target);
    return true;
  }
  if (kit === 'read-the-contract') {
    put(ctx, source, 'rider');
    note(ctx, source, 'Read the Contract · insured');
    return true;
  }
  if (kit === 'wrong-address-booking') {
    const enemy = source.side === 'player' ? 'opponent' : 'player';
    put(ctx, source, 'booking', preparedLane(ctx, enemy, source.lane));
    note(ctx, source, 'Wrong Address · public booking');
    return true;
  }
  if (kit === 'diss-track') {
    const target = strong(ctx, foes(ctx, source));
    if (!target) return false;
    const bonus = Math.max(0, target.hands - target.baseHands);
    const changed =
      bonus > 0
        ? ctx.trim(source, target, Math.min(4, bonus))
        : ctx.damage(source, target, 4);
    if (changed <= 0) return false;
    const survivor = find(ctx, target.id);
    if (survivor) put(ctx, source, 'diss', survivor.lane, survivor.id);
    return true;
  }
  if (kit === '360-deal') {
    if (liveMarks(ctx, 'contract').some((m) => m.side === source.side))
      return false;
    const target = strong(
      ctx,
      otherMusic(ctx, source, true).filter(
        (u) => !l.signedClients.includes(u.cardId),
      ),
    );
    if (!target) return false;
    l.signedClients.push(target.cardId);
    const mark = put(ctx, source, 'contract', target.lane, target.id);
    target.movementLocks = [
      ...(target.movementLocks ?? []),
      { sourceId: `music:${mark.id}`, expiresAt: mark.expiresAt },
    ];
    gain(ctx, source, target, 3, '360 Deal · +3');
    return true;
  }
  if (kit === 'pass-the-torch') {
    if (options.echoed || l.used.torch) return false;
    // Spend before the callback, including reentrant/copied callbacks.
    l.used.torch = 1;
    const apprentice = weak(
      ctx,
      otherMusic(ctx, source).filter(
        (u) =>
          ctx.active(u) &&
          ctx.definition(u).cost <= 3 &&
          u.entranceSucceeded === true &&
          ctx.definition(u).triggers?.includes('entrance') &&
          ability(ctx, u) !== 'pass-the-torch',
      ),
    );
    let success = false;
    if (apprentice) {
      success = ctx.echo(source, apprentice);
      const live = find(ctx, apprentice.id);
      if (live) success = ctx.protect(source, live) || success;
    }
    for (const lane of LANES.filter((lane) => lane !== source.lane))
      success =
        gain(
          ctx,
          source,
          weak(
            ctx,
            otherMusic(ctx, source).filter((u) => u.lane === lane),
          ),
          4,
          'Pass the Torch · +4',
        ) || success;
    if (!success) delete l.used.torch;
    return success;
  }
  return false;
}

function bookingArrival(
  ctx: MusicContext,
  entrant: Unit,
  candidates = liveMarks(ctx, 'booking'),
) {
  if (!character(ctx, entrant) || entrant.hands <= 0) return;
  for (const mark of candidates.filter(
    (m) =>
      m.kind === 'booking' &&
      m.side !== entrant.side &&
      m.lane === entrant.lane &&
      m.expiresAt > ctx.state.elapsedMs,
  )) {
    if (!runtime(ctx).marks.some((m) => m.id === mark.id)) continue;
    removeMark(ctx, mark); // blocked traps are still spent; callbacks cannot recurse into it.
    const target = find(ctx, entrant.id);
    if (!target) continue;
    const actual = ctx.damage(mark.source, target, 1);
    const survivor = find(ctx, entrant.id);
    if (actual > 0 && survivor) ctx.weaken(mark.source, survivor);
    note(
      ctx,
      mark.source,
      actual > 0 ? 'Wrong Address · hit' : 'Wrong Address · blocked',
      target,
    );
  }
}

/** Call once after a genuine paid character deployment, including denied entrances. */
export function musicPlayed(
  ctx: MusicContext,
  source: Unit,
  options: MusicPlayedOptions,
) {
  if (options.echoed || !character(ctx, source)) return;
  const marks = options.snapshot?.marks ?? liveMarks(ctx);
  if (musical(ctx, source)) {
    for (const mark of marks.filter(
      (m) =>
        m.side === source.side &&
        m.source.id !== source.id &&
        m.expiresAt > ctx.state.elapsedMs,
    )) {
      if (mark.kind === 'rider') {
        removeMark(ctx, mark);
        const manager = find(ctx, mark.source.id);
        if (!manager || !ctx.active(manager)) continue;
        if (options.outcome === 'cancelled' || options.outcome === 'queued')
          ctx.refund(source.side, 1, manager);
        else {
          const artist = find(ctx, source.id);
          if (artist) {
            ctx.protect(manager, artist);
            gain(ctx, manager, artist, 1, 'Read the Contract · +1');
          }
        }
      } else if (
        mark.kind === 'call' &&
        mark.targetId !== source.id &&
        mark.lane !== (options.paidLane ?? source.lane)
      ) {
        const caller = mark.targetId ? find(ctx, mark.targetId) : undefined,
          hype = find(ctx, mark.source.id),
          responder = find(ctx, source.id);
        if (
          !caller ||
          !hype ||
          !responder ||
          !ctx.active(caller) ||
          !ctx.active(hype)
        )
          continue;
        removeMark(ctx, mark);
        gain(ctx, hype, caller, 3, 'Say It Back · +3');
        gain(ctx, hype, responder, 3, 'Say It Back · +3');
        const survivor = find(ctx, caller.id);
        if (survivor) ctx.protect(hype, survivor);
      }
    }
  }
  bookingArrival(ctx, source, marks);
}

/** A mechanical success, never an echo, is required for all performance observers. */
export function musicEntranceResolved(
  ctx: MusicContext,
  source: Unit,
  options: { echoed?: boolean } = {},
) {
  const artist = find(ctx, source.id);
  if (
    options.echoed ||
    !artist ||
    !ctx.active(artist) ||
    !musical(ctx, artist) ||
    artist.entranceSucceeded !== true
  )
    return;
  const l = ledger(ctx, artist.side);
  for (const mark of liveMarks(ctx, 'soundcheck').filter(
    (m) =>
      m.side === artist.side &&
      m.source.id !== artist.id &&
      m.lane === artist.lane,
  )) {
    removeMark(ctx, mark);
    if (!l.used.soundcheck) {
      l.used.soundcheck = 1;
      ctx.refund(artist.side, 1, mark.source);
    }
  }
  const heldBand = ctx.state.players[artist.side].hand
    .map((id) => ctx.state.roster.find((c) => c.id === id))
    .find((c) => String(c?.ability) === 'whole-set' && c?.id !== artist.cardId);
  if (heldBand && oncePulse(ctx, artist.side, 'heldBand', 2))
    gain(
      ctx,
      {
        ...artist,
        id: `hand:${artist.side}:${heldBand.id}`,
        cardId: heldBand.id,
      },
      artist,
      2,
      'Whole Set · in hand +2',
    );
  for (const watcher of board(ctx)
    .filter(
      (u) => u.side === artist.side && u.id !== artist.id && ctx.active(u),
    )
    .sort((a, b) => a.id.localeCompare(b.id))) {
    const kit = ability(ctx, watcher);
    if (
      kit === 'tour-money' &&
      watcher.lane === artist.lane &&
      oncePulse(ctx, watcher.side, 'merch', 2)
    ) {
      discount(ctx, watcher, 'local');
      note(ctx, watcher, 'Tour Money · local Music discount', artist);
    }
    if (kit === 'sixteen-bars') {
      const local = watcher.lane === artist.lane;
      const target = local
        ? strong(ctx, foes(ctx, watcher))
        : weak(
            ctx,
            board(ctx).filter(
              (u) => u.side === artist.side && u.lane === artist.lane,
            ),
          );
      if (
        !target ||
        !oncePulse(ctx, watcher.side, local ? 'barsLocal' : 'barsWide')
      )
        continue;
      if (local) ctx.damage(watcher, target, 3);
      else gain(ctx, watcher, target, 3, 'Sixteen Bars · +3');
    }
  }
}

export function musicMoved(ctx: MusicContext, unit: Unit, origin: Lane) {
  if (origin !== unit.lane) bookingArrival(ctx, unit);
}
export function musicDamaged(
  ctx: MusicContext,
  hit: { source: Pick<Unit, 'side'>; victim: Unit; amount: number },
) {
  if (
    hit.amount <= 0 ||
    hit.source.side === hit.victim.side ||
    !musical(ctx, hit.victim)
  )
    return;
  for (const celebrity of board(ctx)
    .filter(
      (u) =>
        u.side === hit.victim.side &&
        u.id !== hit.victim.id &&
        u.lane !== hit.victim.lane &&
        ctx.active(u) &&
        ability(ctx, u) === 'everybody-watching',
    )
    .sort((a, b) => a.id.localeCompare(b.id))) {
    if (!oncePulse(ctx, celebrity.side, 'celebrity')) continue;
    if (
      ctx.openForMove(celebrity, hit.victim.lane) &&
      ctx.move(celebrity, hit.victim.lane)
    )
      gain(
        ctx,
        celebrity,
        find(ctx, celebrity.id),
        1,
        'Everybody Watching · +1',
      );
  }
}
export function musicGained(ctx: MusicContext, target: Unit, amount: number) {
  if (amount <= 0 || target.hands <= 0) return;
  for (const mark of liveMarks(ctx, 'diss').filter(
    (m) => m.targetId === target.id,
  )) {
    removeMark(ctx, mark);
    const survivor = find(ctx, target.id);
    if (survivor) ctx.silence(mark.source, survivor);
  }
}
export function musicCleansed(ctx: MusicContext, unit: Unit) {
  for (const mark of (ctx.state.music?.marks ?? []).filter(
    (m) => m.kind === 'contract' && m.targetId === unit.id,
  ))
    removeMark(ctx, mark);
}
export function musicMovementRestricted(
  ctx: MusicContext,
  unit: Unit,
): boolean {
  return liveMarks(ctx, 'contract').some((m) => m.targetId === unit.id);
}
export function musicTick(ctx: MusicContext) {
  const r = ctx.state.music;
  if (!r) return;
  for (const mark of [...r.marks]) {
    if (mark.targetId && !find(ctx, mark.targetId)) {
      removeMark(ctx, mark);
      continue;
    }
    if (mark.expiresAt > ctx.state.elapsedMs) continue;
    removeMark(ctx, mark);
    if (mark.kind !== 'contract' || !mark.targetId) continue;
    const client = find(ctx, mark.targetId),
      manager = find(ctx, mark.source.id);
    if (!client || !manager || !ctx.active(manager)) continue;
    const actual = ctx.removeBonus(
      client,
      Math.min(2, Math.max(0, client.hands - client.baseHands)),
    );
    if (actual > 0) gain(ctx, manager, manager, actual, '360 Deal · royalties');
  }
  r.discounts = r.discounts.filter((d) => d.expiresAt > ctx.state.elapsedMs);
}
export function musicDiscount(
  ctx: MusicContext,
  side: Side,
  definition: MusicDefinition,
  lane: Lane,
): MusicDiscount | undefined {
  if ((definition.kind ?? 'character') !== 'character') return undefined;
  return (ctx.state.music?.discounts ?? [])
    .filter(
      (d) =>
        d.side === side &&
        d.expiresAt > ctx.state.elapsedMs &&
        (d.kind === 'return'
          ? d.targetCardId === definition.id
          : d.lane === lane && definition.traits?.includes('music')),
    )
    .sort((a, b) => a.id - b.id)[0];
}
export function musicSpendDiscount(
  ctx: MusicContext,
  side: Side,
  id: number,
): boolean {
  const r = runtime(ctx),
    found = r.discounts.some(
      (d) =>
        d.id === id && d.side === side && d.expiresAt > ctx.state.elapsedMs,
    );
  if (found) r.discounts = r.discounts.filter((d) => d.id !== id);
  return found;
}
