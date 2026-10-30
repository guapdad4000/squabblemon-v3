/** Persistent neighborhood contracts. Engine-time pulses replace rounds;
 * contracts never pause deployment, depend on animation, or reset on recycling. */
import type {
  BattleEvent,
  GameState,
  Lane,
  Side,
  TimedStatus,
  Unit,
} from './breakthrough';

export const CONTRACT_ABILITY_DESCRIPTIONS = {
  'neighborhood-route':
    'Deploy and each 10-second pulse: serve your weakest other local ally+2, or leave one Treat for the next friendly character arrival. At pulses move to your weakest legal unvisited lane. Each lane serves once per truck identity; movement locks apply.',
  'from-home-with-love':
    'Deploy: care packages wait in each other lane until the second following 10-second pulse. The next friendly character played or moved there is fully cleansed and gains+1, or+2 if Earth. One parcel per lane per side.',
  'safe-crossing':
    'Deploy: Protect your weakest unprotected other local ally and give it one Safe Crossing. Its next successful move ignores movement Locks, still obeying enemy positions and lane restrictions.',
  'spin-cycle':
    'Deploy: fully cleanse your weakest other local ally and give+1. Its next successful move fully cleanses it again and gives+1 once.',
  'pass-the-hat':
    'While active: first distinct other ally moving here gives your weakest other local ally+1; a second gives+2. One two-visitor payout per 10-second pulse; the same visitor cannot tip twice.',
  'closing-time':
    'Deploy from 30 seconds: leave a Receipt here until the second following pulse. Your next other printed-cost 2-or-less character played here opens a local 1-Motion character discount, minimum 1. In Last Stand that customer gains+2 instead.',
  'my-weekend':
    'Deploy: bring your weakest movable cost 2-or-less ally from another lane here and Protect it. Its first successful move back to its original lane before the second following pulse grants+1. No automatic return; one pending visit per side.',
  'good-company':
    'Deploy: pair your two weakest other allies anywhere until the second following pulse. The first genuine positive Hands gain on one per 10-second pulse shares up to 2 with its surviving partner. Shared gains cannot recursively share.',
  'problem-energy':
    'Deploy: mark the strongest enemy lane until their next character placement or match end. Played there: attempt 2 damage on that character. Played elsewhere: this surviving BBL Demon gains+2. One Drama per side.',
  'floor-sweep':
    'Deploy: move your weakest movable other local ally to its weakest legal other lane. After arrival, leave a mark at the origin until the second following pulse: Weaken the next enemy character entering. One floor mark per lane per side.',
  windmill:
    'Deploy: move through your weakest other occupied friendly lane, then to the remaining legal lane. Gain+1 per successful move, up to+2. Each leg checks current restrictions and enemy positions.',
  'one-more-verse':
    'Deploy: leave one Verse here until the second following pulse. The next different friendly character played or moved here gains+2. Paid characters collect after their entrance; echoes do not collect.',
  'gold-road':
    'Deploy: your weakest other friendly character in each lane gains+1, or+2 if Earth. Your next card in another lane costs 1 less Motion, minimum 1.',
  'lingering-scent':
    'Deploy: leave Scent in this lane until the second following pulse. The first enemy character played or moved here in each 10-second interval receives 2 Burn through defenses. Scent persists after departure.',
  'geographic-arbitrage':
    'Deploy: move your weakest movable other local ally to its weakest legal other lane, then fully cleanse it and give+2. While active, once per 10-second pulse another Water ally leaving a losing lane is fully cleansed and gains+3. Both benefits can apply to one move.',
  'kain-muna':
    'Deploy: invite your weakest movable ally from each other lane here, fully cleanse each arrival and give+1. At the next 10-second boundary guests attempt to return home; only successful returns gain another+1.',
  'tow-and-collect':
    'Deploy: tow the remote enemy with most bonus Hands into this lane through normal hostile-movement defenses. Only after arrival transfer up to 3 actual removable bonus Hands to your weakest local ally. Confiscation is not damage or healing credit.',
  'change-places':
    'Deploy: return your weakest other local ally with current Hands+1 and a next-play 1-Motion discount, minimum 1. Pull your strongest legal remote ally here. The cheaper guest gains another+3; the other gains Protection if still on board. Equal costs:+1 each. Alone here: gain+2.',
  wanted:
    'Deploy: lasso the weakest legal remote enemy here through defenses and mark it Wanted until the second following pulse. If your side destroys it while this Cowboy remains active, gain+3.',
  'no-place-like-home':
    'Deploy: return your weakest other friendly printed-cost 2-or-less character anywhere to hand, carrying current Hands+1. Its next deployment costs 1 less Motion, minimum 1. Returning preserves spent limits.',
  'wrong-turn-right-place':
    'Deploy: swap lanes with your weakest legal remote ally; both gain+1 only after the swap. With no legal swap, move to the first wholly empty legal lane and gain+1.',
  'heart-starter':
    'While active: the first other friendly character arriving here each 10-second pulse gains+1. A movement arrival or Dorothy/Scarecrow/Tin Man/Lion instead gains+2 and Protection.',
  'found-my-courage':
    'Deploy: Protect yourself if you have no other local friendly character. While active, once per 10-second pulse another friendly character leaving your lane gives you+2.',
  'drink-me-eat-me':
    'At a 10-second boundary, return to hand once per card identity per match, carrying current Hands+3 and a next-play 1-Motion discount, minimum 1. Never return automatically during irreversible Last Stand. A full hand or movement Lock blocks the return.',
  'lap-record':
    'Deploy: move to your weakest other legal lane. While active, visiting all 3 lanes grants+3 once per card identity per match. Recorded visits survive recycling.',
  'told-you':
    'Deploy: predict the enemy’s weakest legal lane from the public board until the second following pulse. Their next character played there is Weakened; played elsewhere, your next character in the predicted lane costs 2 less, minimum 1, through the following pulse interval.',
  'follow-my-lead':
    'While active: the first friendly character move in each 10-second pulse sets a destination. The next different friendly character moving there gains+2 and Protection; one payout per interval.',
  'all-clear':
    'Deploy: fully cleanse all other local allies and give the weakest other local Light ally+1, even if healthy. While active, the first friendly Light character genuinely cleansed each 10-second pulse gains+2. Copies share the cleanse payout.',
  'keys-to-the-city':
    'Deploy: nominate your weakest other lane until the second following pulse. The next friendly movement arrival there gains Protection and opens a local 1-Motion character discount, minimum 1. One nomination per side.',
  'the-usual':
    'Deploy: remember your weakest other local ally and give+1. Its first departure grants+1; its first later return grants another+1 and Protection. Each reward once; no forced return.',
  'open-tab-tip':
    'Deploy: open one Tab until the second following pulse. Your next other friendly character played here becomes the guest. Its first actual enemy hit or new harmful status earns a Tip; cash+2 to the surviving guest at the next 10-second boundary.',
  'group-project':
    'Deploy: one Project waits until the second following pulse. Your next two different-element allies with successful genuine entrances gain+1 each. After both contribute, each survivor gains another+2 and an active surviving Dr. Umah gains+1. Echoes cannot contribute.',
  'pending-transfer':
    'Deploy: file one claim until the second following pulse. Divert up to 1 of the enemy’s next actual Motion refund. If unused at expiry, open one local 1-Motion character discount, minimum 1, through the next pulse interval. Theft or fallback, never both.',
  'permanent-ink':
    'Deploy: tattoo your weakest uninked other local ally for+1. Its next successful move grants+1 and Protection. Each character identity can receive the tattoo only once per side per match.',
  'still-got-it':
    'Deploy: move to your weakest other legal lane. After arriving leave a route at your original lane until the second following pulse. The next other friendly character played at the origin follows to that destination only if the move remains legal. One route per origin per side.',
} as const;
export const CONTRACT_ADAPTERS = {
  'ice-cream-truck': {
    ability: 'neighborhood-route',
    tacticalRoles: ['support'],
    triggers: ['entrance', 'ongoing'],
  },
  concrete: {
    ability: 'from-home-with-love',
    tacticalRoles: ['support'],
    triggers: ['entrance'],
  },
  'crossing-guard': {
    ability: 'safe-crossing',
    tacticalRoles: ['support'],
    triggers: ['entrance'],
  },
  'laundromat-regular': {
    ability: 'spin-cycle',
    tacticalRoles: ['support'],
    triggers: ['entrance'],
  },
  'corner-busker': {
    ability: 'pass-the-hat',
    tacticalRoles: ['support'],
    triggers: ['ongoing'],
  },
  'night-cashier': {
    ability: 'closing-time',
    tacticalRoles: ['support'],
    triggers: ['entrance'],
  },
  'divorced-dad': {
    ability: 'my-weekend',
    tacticalRoles: ['support'],
    triggers: ['entrance'],
  },
  'bbl-nice': {
    ability: 'good-company',
    tacticalRoles: ['support'],
    triggers: ['entrance'],
  },
  'bbl-demon': {
    ability: 'problem-energy',
    tacticalRoles: ['control'],
    triggers: ['entrance'],
  },
  'break-dancer': {
    ability: 'floor-sweep',
    tacticalRoles: ['control'],
    triggers: ['entrance'],
  },
  bboy: { ability: 'windmill', tacticalRoles: [], triggers: ['entrance'] },
  'failed-rapper': {
    ability: 'one-more-verse',
    tacticalRoles: ['support'],
    triggers: ['entrance'],
  },
  'mansa-musa': {
    ability: 'gold-road',
    tacticalRoles: ['support'],
    triggers: ['entrance'],
  },
  'cologne-criminal': {
    ability: 'lingering-scent',
    tacticalRoles: ['control'],
    triggers: ['entrance'],
  },
  'passport-bro': {
    ability: 'geographic-arbitrage',
    tacticalRoles: ['support'],
    triggers: ['entrance', 'ongoing'],
  },
  lola: {
    ability: 'kain-muna',
    tacticalRoles: ['support'],
    triggers: ['entrance'],
  },
  'repo-man': {
    ability: 'tow-and-collect',
    tacticalRoles: ['control'],
    triggers: ['entrance'],
  },
  'mad-hatter': {
    ability: 'change-places',
    tacticalRoles: ['support'],
    triggers: ['entrance'],
  },
  'black-cowboy': {
    ability: 'wanted',
    tacticalRoles: ['control'],
    triggers: ['entrance'],
  },
  dorothy: {
    ability: 'no-place-like-home',
    tacticalRoles: ['support'],
    triggers: ['entrance'],
  },
  scarecrow: {
    ability: 'wrong-turn-right-place',
    tacticalRoles: ['support'],
    triggers: ['entrance'],
  },
  'tin-man': {
    ability: 'heart-starter',
    tacticalRoles: ['support'],
    triggers: ['ongoing'],
  },
  lion: {
    ability: 'found-my-courage',
    tacticalRoles: ['support'],
    triggers: ['entrance', 'ongoing'],
  },
  alice: {
    ability: 'drink-me-eat-me',
    tacticalRoles: ['support'],
    triggers: ['ongoing'],
  },
  'yn-gokarter': {
    ability: 'lap-record',
    tacticalRoles: [],
    triggers: ['entrance', 'ongoing'],
  },
  'homeless-wiseman': {
    ability: 'told-you',
    tacticalRoles: ['control'],
    triggers: ['entrance'],
  },
  'dance-circle-captain': {
    ability: 'follow-my-lead',
    tacticalRoles: ['support'],
    triggers: ['ongoing'],
  },
  'night-shift-medic': {
    ability: 'all-clear',
    tacticalRoles: ['support'],
    triggers: ['entrance', 'ongoing'],
  },
  'midnight-mayor': {
    ability: 'keys-to-the-city',
    tacticalRoles: ['support'],
    triggers: ['entrance'],
  },
  ahki: {
    ability: 'the-usual',
    tacticalRoles: ['support'],
    triggers: ['entrance'],
  },
  'mr-trick': {
    ability: 'open-tab-tip',
    tacticalRoles: ['support'],
    triggers: ['entrance'],
  },
  'dr-umah': {
    ability: 'group-project',
    tacticalRoles: ['support'],
    triggers: ['entrance'],
  },
  'atl-scammer': {
    ability: 'pending-transfer',
    tacticalRoles: ['control'],
    triggers: ['entrance'],
  },
  'tattoo-artist': {
    ability: 'permanent-ink',
    tacticalRoles: ['support'],
    triggers: ['entrance'],
  },
  'og-skater': {
    ability: 'still-got-it',
    tacticalRoles: ['support'],
    triggers: ['entrance'],
  },
} as const;
export interface ContractDefinition {
  id: string;
  cost: number;
  ability?: string;
  element?: string;
  kind?: string;
}
export interface ContractReturnOptions {
  bonusHands: number;
  discount: number;
  expiresAt: number;
}
export interface ContractsContext {
  state: GameState & { contracts?: ContractsRuntime };
  definition(unit: Unit): ContractDefinition;
  active(unit: Unit): boolean;
  power(unit: Unit): number;
  gain(
    unit: Unit,
    amount: number,
    copied?: boolean,
    source?: Pick<Unit, 'id' | 'cardId' | 'side' | 'lane' | 'position'>,
  ): void;
  damage(source: Unit, target: Unit, amount: number): number;
  burn(source: Unit, target: Unit, amount: number): boolean;
  weaken(source: Unit, target: Unit): boolean;
  protect(source: Unit, target: Unit): boolean;
  cleanse(
    unit: Unit,
    kinds?: readonly TimedStatus['kind'][],
    source?: Pick<Unit, 'id' | 'cardId' | 'side' | 'lane' | 'position'>,
  ): boolean;
  move(unit: Unit, lane: Lane): boolean;
  openForMove(unit: Unit, lane: Lane): boolean;
  /** Must honor defenses and return false if the final destination was blocked/reversed. */
  enemyMove(
    source: Unit,
    target: Unit,
    lane: Lane,
    afterMoved?: (actualTarget: Unit) => void,
  ): boolean;
  /** Prevalidate both legs before either one moves. Trigger genuine movement hooks. */
  swap(first: Unit, second: Unit): boolean;
  canReturn(unit: Unit): boolean;
  /** Preserve card identity and spent limits. The module owns next-play discounts. */
  returnToHand(
    source: Unit,
    target: Unit,
    options: ContractReturnOptions,
  ): boolean;
  /** Remove only actual bonus without hostile rechecking after an already-passed tow. */
  removeBonus(unit: Unit, amount: number): number;
  refund(side: Side, amount: number, source: Unit): number;
  lastStand(): boolean;
  event(event: Omit<BattleEvent, 'id'>): void;
}
type MarkKind =
  | 'treat'
  | 'parcel'
  | 'crossing'
  | 'laundry'
  | 'receipt'
  | 'visit'
  | 'pair'
  | 'drama'
  | 'floor'
  | 'verse'
  | 'scent'
  | 'dinner'
  | 'wanted'
  | 'prediction'
  | 'nomination'
  | 'loyalty'
  | 'tab'
  | 'project'
  | 'claim'
  | 'ink'
  | 'route';
export interface ContractMark {
  id: number;
  kind: MarkKind;
  side: Side;
  source: Unit;
  lane: Lane;
  expiresAt: number;
  targets: string[];
  origin?: Lane;
  destination?: Lane;
  amount?: number;
  ready?: boolean;
  pulse?: number;
  dueAt?: number;
  seen?: string[];
  elements?: string[];
}
export interface ContractDiscount {
  id: number;
  side: Side;
  source: Unit;
  lane: Lane;
  kind: 'local' | 'other-lane' | 'card';
  cardId?: string;
  amount: number;
  minimum: 1;
  expiresAt: number;
}
interface ContractsSeat {
  used: Record<string, number>;
  pulses: Record<string, number>;
  visitors: Record<string, string[]>;
  visits: Record<string, Lane[]>;
  served: Record<string, Lane[]>;
  inked: Record<string, true>;
  dance: Record<
    string,
    { pulse: number; first: string; lane: Lane; paid: boolean }
  >;
}
export interface ContractsRuntime {
  nextId: number;
  lastPulse: number;
  marks: ContractMark[];
  discounts: ContractDiscount[];
  seats: Record<Side, ContractsSeat>;
}
export interface ContractsMoveSnapshot {
  origin: Lane;
  originLosing: boolean;
}
const LANES: readonly Lane[] = [0, 1, 2];
const PULSE = 10000;
const freshSeat = (): ContractsSeat => ({
  used: {},
  pulses: {},
  visitors: {},
  visits: {},
  served: {},
  inked: {},
  dance: {},
});
function runtime(ctx: ContractsContext): ContractsRuntime {
  return (ctx.state.contracts ??= {
    nextId: 1,
    lastPulse: Math.floor(ctx.state.elapsedMs / PULSE),
    marks: [],
    discounts: [],
    seats: { player: freshSeat(), opponent: freshSeat() },
  });
}
export function cloneContractsRuntime(
  value: ContractsRuntime | undefined,
): ContractsRuntime | undefined {
  return value
    ? (JSON.parse(JSON.stringify(value)) as ContractsRuntime)
    : undefined;
}
const pulse = (ctx: ContractsContext) =>
  Math.floor(ctx.state.elapsedMs / PULSE);
const expiry = (ctx: ContractsContext) => (pulse(ctx) + 2) * PULSE;
const nextBoundary = (ctx: ContractsContext) => (pulse(ctx) + 1) * PULSE;
const forever = Number.MAX_SAFE_INTEGER;
const other = (side: Side): Side => (side === 'player' ? 'opponent' : 'player');
const character = (ctx: ContractsContext, u: Unit) =>
  (ctx.definition(u).kind ?? 'character') === 'character';
const board = (ctx: ContractsContext) =>
  ctx.state.units.filter((u) => u.hands > 0 && character(ctx, u));
const find = (ctx: ContractsContext, id: string) =>
  board(ctx).find((u) => u.id === id);
const kit = (ctx: ContractsContext, u: Unit) => ctx.definition(u).ability ?? '';
const element = (ctx: ContractsContext, u: Unit) =>
  ctx.definition(u).element === 'Rock'
    ? 'Earth'
    : (ctx.definition(u).element ?? 'Normal');
const allies = (ctx: ContractsContext, s: Unit, local = true) =>
  board(ctx).filter(
    (u) => u.side === s.side && u.id !== s.id && (!local || u.lane === s.lane),
  );
const enemies = (ctx: ContractsContext, s: Unit, local = true) =>
  board(ctx).filter((u) => u.side !== s.side && (!local || u.lane === s.lane));
const sorted = (ctx: ContractsContext, units: Unit[], high = false) =>
  [...units].sort(
    (a, b) =>
      (high ? -1 : 1) * (ctx.power(a) - ctx.power(b)) ||
      a.id.localeCompare(b.id),
  );
const weak = (ctx: ContractsContext, units: Unit[]) => sorted(ctx, units)[0];
const strong = (ctx: ContractsContext, units: Unit[]) =>
  sorted(ctx, units, true)[0];
const score = (ctx: ContractsContext, side: Side, lane: Lane) =>
  board(ctx)
    .filter((u) => u.side === side && u.lane === lane)
    .reduce((n, u) => n + ctx.power(u), 0);
const lanesByScore = (ctx: ContractsContext, side: Side, high = false) =>
  [...LANES].sort(
    (a, b) =>
      (high ? -1 : 1) * (score(ctx, side, a) - score(ctx, side, b)) || a - b,
  );
const destinations = (ctx: ContractsContext, u: Unit) =>
  lanesByScore(ctx, u.side).filter(
    (l) => l !== u.lane && ctx.openForMove(u, l),
  );
const liveMarks = (ctx: ContractsContext, kind?: MarkKind) =>
  (ctx.state.contracts?.marks ?? []).filter(
    (m) => m.expiresAt > ctx.state.elapsedMs && (!kind || m.kind === kind),
  );
function note(ctx: ContractsContext, s: Unit, text: string, target?: Unit) {
  ctx.event({
    type: 'ability',
    side: s.side,
    lane: target?.lane ?? s.lane,
    position: target?.position ?? s.position,
    sourceUnitId: s.id,
    sourceSide: s.side,
    sourceLane: s.lane,
    sourcePosition: s.position,
    ...(target ? { targetUnitId: target.id, cardId: target.cardId } : {}),
    text,
  });
}
function gain(
  ctx: ContractsContext,
  s: Unit,
  target: Unit | undefined,
  n: number,
  copied = false,
): boolean {
  if (!target || !find(ctx, target.id) || n <= 0) return false;
  ctx.gain(target, n, copied, s);
  note(ctx, s, `+${n} HANDS`, target);
  return true;
}
function remove(ctx: ContractsContext, mark: ContractMark) {
  const r = ctx.state.contracts;
  if (r) r.marks = r.marks.filter((m) => m.id !== mark.id);
}
function put(
  ctx: ContractsContext,
  s: Unit,
  kind: MarkKind,
  patch: Partial<ContractMark> = {},
  scope: 'side' | 'lane' | 'target' | 'source' = 'side',
): ContractMark {
  const r = runtime(ctx),
    lane = patch.lane ?? s.lane;
  r.marks = r.marks.filter(
    (m) =>
      !(
        m.side === s.side &&
        m.kind === kind &&
        (scope === 'side' ||
          (scope === 'lane' && m.lane === lane) ||
          (scope === 'target' &&
            m.targets.some((id) => patch.targets?.includes(id))) ||
          (scope === 'source' && m.source.id === s.id))
      ),
  );
  const m: ContractMark = {
    id: r.nextId++,
    kind,
    side: s.side,
    source: { ...s },
    lane,
    targets: [],
    expiresAt: expiry(ctx),
    ...patch,
  };
  r.marks.push(m);
  return m;
}
function discount(
  ctx: ContractsContext,
  s: Unit,
  kind: ContractDiscount['kind'],
  amount = 1,
  lane = s.lane,
  cardId?: string,
  expiresAt = expiry(ctx),
  recipientSide: Side = s.side,
) {
  const r = runtime(ctx);
  r.discounts.push({
    id: r.nextId++,
    side: recipientSide,
    source: { ...s },
    kind,
    amount,
    minimum: 1,
    lane,
    cardId,
    expiresAt,
  });
}
function move(ctx: ContractsContext, u: Unit, lane: Lane | undefined): boolean {
  return (
    lane !== undefined &&
    !!find(ctx, u.id) &&
    ctx.openForMove(u, lane) &&
    ctx.move(u, lane)
  );
}
function once(ctx: ContractsContext, side: Side, key: string): boolean {
  const l = runtime(ctx).seats[side];
  if (l.pulses[key] === pulse(ctx)) return false;
  l.pulses[key] = pulse(ctx);
  return true;
}
function returnAlly(
  ctx: ContractsContext,
  s: Unit,
  target: Unit,
  bonusHands: number,
  expiresAt = forever,
): boolean {
  if (
    !ctx.canReturn(target) ||
    !ctx.returnToHand(s, target, { bonusHands, discount: 1, expiresAt })
  )
    return false;
  discount(ctx, s, 'card', 1, s.lane, target.cardId, expiresAt, target.side);
  return true;
}
function serve(ctx: ContractsContext, truck: Unit) {
  const l = runtime(ctx).seats[truck.side],
    seen = (l.served[truck.cardId] ??= []);
  if (seen.includes(truck.lane)) return false;
  seen.push(truck.lane);
  const target = weak(ctx, allies(ctx, truck));
  if (target) return gain(ctx, truck, target, 2);
  put(ctx, truck, 'treat', { expiresAt: forever }, 'lane');
  note(ctx, truck, 'TREAT · +2');
  return true;
}
export function contractsHasSafeCrossing(
  ctx: ContractsContext,
  u: Unit,
): boolean {
  return liveMarks(ctx, 'crossing').some((m) => m.targets.includes(u.id));
}
export function contractsCaptureMove(
  ctx: ContractsContext,
  u: Unit,
): ContractsMoveSnapshot {
  return {
    origin: u.lane,
    originLosing:
      score(ctx, u.side, u.lane) < score(ctx, other(u.side), u.lane),
  };
}

/** Explicit mechanical success. Never replay persistent setups as paid placements. */
export function contractsEntrance(
  ctx: ContractsContext,
  s: Unit,
  options: { echoed?: boolean } = {},
): boolean | null {
  const ability = kit(ctx, s);
  if (!Object.hasOwn(CONTRACT_ABILITY_DESCRIPTIONS, ability)) return null;
  if (!ctx.active(s) || !find(ctx, s.id)) return false;
  const local = () => allies(ctx, s),
    all = () => allies(ctx, s, false),
    self = () => find(ctx, s.id);
  const l = runtime(ctx).seats[s.side];
  if (
    options.echoed &&
    ![
      'windmill',
      'gold-road',
      'no-place-like-home',
      'wrong-turn-right-place',
      'found-my-courage',
      'all-clear',
    ].includes(ability)
  )
    return false;
  if (ability === 'neighborhood-route') return serve(ctx, s);
  if (ability === 'from-home-with-love') {
    for (const lane of LANES.filter((x) => x !== s.lane))
      put(ctx, s, 'parcel', { lane }, 'lane');
    return true;
  }
  if (ability === 'safe-crossing') {
    const target = weak(
      ctx,
      local().filter((u) => !u.protected),
    );
    if (!target) return false;
    ctx.protect(s, target);
    put(
      ctx,
      s,
      'crossing',
      { targets: [target.id], expiresAt: forever },
      'target',
    );
    return true;
  }
  if (ability === 'spin-cycle') {
    const target = weak(ctx, local());
    if (!target) return false;
    ctx.cleanse(target, undefined, s);
    gain(ctx, s, target, 1);
    put(
      ctx,
      s,
      'laundry',
      { targets: [target.id], expiresAt: forever },
      'target',
    );
    return true;
  }
  if (ability === 'closing-time') {
    if (ctx.state.elapsedMs < 30000) return false;
    put(ctx, s, 'receipt', {}, 'lane');
    return true;
  }
  if (ability === 'my-weekend') {
    const target = weak(
      ctx,
      all().filter(
        (u) =>
          u.lane !== s.lane &&
          ctx.definition(u).cost <= 2 &&
          ctx.openForMove(u, s.lane),
      ),
    );
    if (!target) return false;
    const origin = target.lane;
    if (!move(ctx, target, s.lane)) return false;
    const live = find(ctx, target.id);
    if (!live) return true;
    ctx.protect(s, live);
    put(ctx, s, 'visit', { targets: [live.id], origin });
    return true;
  }
  if (ability === 'good-company') {
    const pair = sorted(ctx, all()).slice(0, 2);
    if (pair.length < 2) return false;
    put(ctx, s, 'pair', { targets: pair.map((u) => u.id) });
    return true;
  }
  if (ability === 'problem-energy') {
    put(ctx, s, 'drama', {
      lane: lanesByScore(ctx, other(s.side), true)[0],
      expiresAt: forever,
    });
    return true;
  }
  if (ability === 'floor-sweep') {
    const target = weak(
      ctx,
      local().filter((u) => destinations(ctx, u).length),
    );
    if (!target || !move(ctx, target, destinations(ctx, target)[0]))
      return false;
    put(ctx, s, 'floor', {}, 'lane');
    return true;
  }
  if (ability === 'windmill') {
    const origin = s.lane;
    const through = destinations(ctx, s).filter((lane) =>
      board(ctx).some((u) => u.side === s.side && u.lane === lane),
    )[0];
    if (through === undefined || !move(ctx, s, through)) return false;
    gain(ctx, s, self(), 1);
    const last = LANES.find((lane) => lane !== origin && lane !== through);
    if (self() && move(ctx, s, last)) gain(ctx, s, self(), 1);
    return true;
  }
  if (ability === 'one-more-verse') {
    put(ctx, s, 'verse', {}, 'lane');
    return true;
  }
  if (ability === 'gold-road') {
    for (const lane of LANES) {
      const target = weak(
        ctx,
        all().filter((u) => u.lane === lane),
      );
      if (target)
        gain(ctx, s, target, element(ctx, target) === 'Earth' ? 2 : 1);
    }
    discount(ctx, s, 'other-lane', 1, s.lane, undefined, forever);
    return true;
  }
  if (ability === 'lingering-scent') {
    put(ctx, s, 'scent', {}, 'lane');
    return true;
  }
  if (ability === 'geographic-arbitrage') {
    const target = weak(
      ctx,
      local().filter((u) => destinations(ctx, u).length),
    );
    if (!target || !move(ctx, target, destinations(ctx, target)[0]))
      return false;
    const live = find(ctx, target.id);
    if (live) {
      ctx.cleanse(live, undefined, s);
      gain(ctx, s, find(ctx, target.id), 2);
    }
    return true;
  }
  if (ability === 'kain-muna') {
    let success = false;
    for (const origin of LANES.filter((lane) => lane !== s.lane)) {
      const target = weak(
        ctx,
        all().filter(
          (u) =>
            u.lane === origin &&
            ctx.openForMove(u, s.lane) &&
            !liveMarks(ctx, 'dinner').some((m) => m.targets.includes(u.id)),
        ),
      );
      if (!target || !move(ctx, target, s.lane)) continue;
      success = true;
      const live = find(ctx, target.id);
      if (!live) continue;
      ctx.cleanse(live, undefined, s);
      gain(ctx, s, live, 1);
      put(
        ctx,
        s,
        'dinner',
        { targets: [live.id], origin, dueAt: nextBoundary(ctx) },
        'target',
      );
    }
    return success;
  }
  if (ability === 'tow-and-collect') {
    const target = [...enemies(ctx, s, false)]
      .filter((u) => u.lane !== s.lane && ctx.openForMove(u, s.lane))
      .sort(
        (a, b) =>
          Math.max(0, b.hands - b.baseHands) -
            Math.max(0, a.hands - a.baseHands) ||
          ctx.definition(b).cost - ctx.definition(a).cost ||
          a.id.localeCompare(b.id),
      )[0];
    if (!target) return false;
    return ctx.enemyMove(s, target, s.lane, (actual) => {
      const live = find(ctx, actual.id);
      if (!live) return;
      const amount = ctx.removeBonus(
        live,
        Math.min(3, Math.max(0, live.hands - live.baseHands)),
      );
      if (amount)
        gain(
          ctx,
          s,
          weak(
            ctx,
            board(ctx).filter((u) => u.side === s.side && u.lane === s.lane),
          ),
          amount,
        );
    });
  }
  if (ability === 'change-places') {
    const target = weak(
      ctx,
      local().filter((u) => ctx.canReturn(u)),
    );
    if (!target) return local().length ? false : gain(ctx, s, self(), 2);
    const cost = ctx.definition(target).cost;
    if (!returnAlly(ctx, s, target, 1)) return false;
    const guest = strong(
      ctx,
      all().filter((u) => u.lane !== s.lane && ctx.openForMove(u, s.lane)),
    );
    if (!guest || !move(ctx, guest, s.lane)) return true;
    const live = find(ctx, guest.id);
    if (!live) return true;
    const guestCost = ctx.definition(live).cost;
    ctx.state.players[target.side].returnedHands ??= {};
    if (cost === guestCost) {
      ctx.state.players[target.side].returnedHands![target.cardId] =
        (ctx.state.players[target.side].returnedHands?.[target.cardId] ??
          target.hands + 1) + 1;
      gain(ctx, s, live, 1);
    } else if (cost < guestCost) {
      ctx.state.players[target.side].returnedHands![target.cardId] =
        (ctx.state.players[target.side].returnedHands?.[target.cardId] ??
          target.hands + 1) + 3;
      ctx.protect(s, live);
    } else gain(ctx, s, live, 3);
    return true;
  }
  if (ability === 'wanted') {
    const target = weak(
      ctx,
      enemies(ctx, s, false).filter(
        (u) => u.lane !== s.lane && ctx.openForMove(u, s.lane),
      ),
    );
    if (!target) return false;
    return ctx.enemyMove(s, target, s.lane, (actual) => {
      if (find(ctx, actual.id))
        put(ctx, s, 'wanted', { targets: [actual.id] }, 'target');
    });
  }
  if (ability === 'no-place-like-home') {
    const target = weak(
      ctx,
      all().filter((u) => ctx.definition(u).cost <= 2 && ctx.canReturn(u)),
    );
    return !!target && returnAlly(ctx, s, target, 1);
  }
  if (ability === 'wrong-turn-right-place') {
    const target = weak(
      ctx,
      all().filter(
        (u) =>
          u.lane !== s.lane &&
          ctx.openForMove(u, s.lane) &&
          ctx.openForMove(s, u.lane),
      ),
    );
    if (target) {
      if (!ctx.swap(s, target)) return false;
      gain(ctx, s, self(), 1);
      gain(ctx, s, find(ctx, target.id), 1);
      return true;
    }
    const lane = LANES.find(
      (lane) =>
        lane !== s.lane &&
        !ctx.state.units.some((u) => u.hands > 0 && u.lane === lane) &&
        ctx.openForMove(s, lane),
    );
    if (!move(ctx, s, lane)) return false;
    gain(ctx, s, self(), 1);
    return true;
  }
  if (ability === 'found-my-courage')
    return !local().length && ctx.protect(s, s);
  if (ability === 'lap-record') {
    const visits = (l.visits[s.cardId] ??= []);
    if (!visits.includes(s.lane)) visits.push(s.lane);
    return move(ctx, s, destinations(ctx, s)[0]);
  }
  if (ability === 'told-you') {
    put(ctx, s, 'prediction', { lane: lanesByScore(ctx, other(s.side))[0] });
    return true;
  }
  if (ability === 'all-clear') {
    let changed = false;
    for (const target of local()) {
      const cleaned = ctx.cleanse(target, undefined, s);
      if (cleaned) contractsCleansed(ctx, target);
      changed = cleaned || changed;
    }
    return (
      gain(
        ctx,
        s,
        weak(
          ctx,
          local().filter((u) => element(ctx, u) === 'Light'),
        ),
        1,
      ) || changed
    );
  }
  if (ability === 'keys-to-the-city') {
    put(ctx, s, 'nomination', {
      lane: lanesByScore(ctx, s.side).find((lane) => lane !== s.lane)!,
    });
    return true;
  }
  if (ability === 'the-usual') {
    const target = weak(ctx, local());
    if (!target) return false;
    gain(ctx, s, target, 1);
    put(
      ctx,
      s,
      'loyalty',
      { targets: [target.id], origin: s.lane, expiresAt: forever, amount: 0 },
      'target',
    );
    return true;
  }
  if (ability === 'open-tab-tip') {
    put(ctx, s, 'tab', { ready: false });
    return true;
  }
  if (ability === 'group-project') {
    put(ctx, s, 'project', { targets: [], elements: [] });
    return true;
  }
  if (ability === 'pending-transfer') {
    put(ctx, s, 'claim');
    return true;
  }
  if (ability === 'permanent-ink') {
    const target = weak(
      ctx,
      local().filter((u) => !l.inked[u.cardId]),
    );
    if (!target) return false;
    l.inked[target.cardId] = true;
    gain(ctx, s, target, 1);
    put(ctx, s, 'ink', { targets: [target.id], expiresAt: forever }, 'target');
    return true;
  }
  if (ability === 'still-got-it') {
    const origin = s.lane;
    if (!move(ctx, s, destinations(ctx, s)[0])) return false;
    put(ctx, s, 'route', { lane: origin, destination: s.lane }, 'lane');
    return true;
  }
  return false;
}

/** Genuine paid character play; retain paidLane when its entrance moved it. */
export function contractsPlayed(
  ctx: ContractsContext,
  u: Unit,
  options: { paidLane?: Lane; echoed?: boolean } = {},
) {
  if (options.echoed || !character(ctx, u)) return;
  const paidLane = options.paidLane ?? u.lane;
  for (const m of [...liveMarks(ctx)]) {
    if (!liveMarks(ctx).some((x) => x.id === m.id)) continue;
    if (m.side !== u.side) {
      if (m.kind === 'drama') {
        remove(ctx, m);
        if (paidLane === m.lane) {
          const live = find(ctx, u.id);
          if (live) ctx.damage(m.source, live, 2);
        } else gain(ctx, m.source, find(ctx, m.source.id), 2);
      }
      if (m.kind === 'prediction') {
        remove(ctx, m);
        if (paidLane === m.lane) {
          const live = find(ctx, u.id);
          if (live) ctx.weaken(m.source, live);
        } else
          discount(ctx, m.source, 'local', 2, m.lane, undefined, expiry(ctx));
      }
      continue;
    }
    if (m.source.id === u.id) continue;
    if (
      m.kind === 'receipt' &&
      paidLane === m.lane &&
      ctx.definition(u).cost <= 2
    ) {
      remove(ctx, m);
      if (ctx.lastStand()) gain(ctx, m.source, find(ctx, u.id), 2);
      else discount(ctx, m.source, 'local', 1, m.lane);
    }
    if (m.kind === 'route' && paidLane === m.lane) {
      remove(ctx, m);
      if (m.destination !== undefined) {
        const live = find(ctx, u.id);
        if (live) move(ctx, live, m.destination);
      }
    }
    if (m.kind === 'tab' && !m.targets.length && paidLane === m.lane)
      m.targets = [u.id];
  }
}

/** Successful non-echo entrances contribute, never canceled/queued/passive entries. */
export function contractsEntranceResolved(
  ctx: ContractsContext,
  u: Unit,
  options: { echoed?: boolean } = {},
) {
  if (
    options.echoed ||
    !u.entranceSucceeded ||
    !character(ctx, u) ||
    !find(ctx, u.id)
  )
    return;
  for (const m of liveMarks(ctx, 'project').filter(
    (m) =>
      m.side === u.side &&
      m.source.id !== u.id &&
      !m.targets.includes(u.id) &&
      !(m.elements ?? []).includes(element(ctx, u)),
  )) {
    m.targets.push(u.id);
    (m.elements ??= []).push(element(ctx, u));
    gain(ctx, m.source, find(ctx, u.id), 1);
    if (m.targets.length >= 2) {
      remove(ctx, m);
      for (const id of m.targets) gain(ctx, m.source, find(ctx, id), 2);
      const author = find(ctx, m.source.id);
      if (author && ctx.active(author)) gain(ctx, author, author, 1);
    }
  }
}

function arrivalMarks(ctx: ContractsContext, u: Unit, includeVerse: boolean) {
  for (const m of [...liveMarks(ctx)]) {
    if (
      !liveMarks(ctx).some((x) => x.id === m.id) ||
      m.source.id === u.id ||
      m.lane !== u.lane
    )
      continue;
    if (m.side !== u.side) {
      if (m.kind === 'floor') {
        remove(ctx, m);
        ctx.weaken(m.source, u);
      }
      if (m.kind === 'scent' && m.pulse !== pulse(ctx)) {
        m.pulse = pulse(ctx);
        ctx.burn(m.source, u, 2);
      }
      continue;
    }
    if (
      ['treat', 'parcel', 'verse'].includes(m.kind) &&
      (includeVerse || m.kind !== 'verse')
    ) {
      remove(ctx, m);
      if (m.kind === 'parcel') {
        const cleaned = ctx.cleanse(u, undefined, m.source);
        if (cleaned) contractsCleansed(ctx, u);
      }
      gain(
        ctx,
        m.source,
        find(ctx, u.id),
        m.kind === 'parcel' ? (element(ctx, u) === 'Earth' ? 2 : 1) : 2,
      );
    }
  }
}
/** Resolve entry traps and parcels before ability admission; paid Verse waits. */
export function contractsBeforeEntrance(
  ctx: ContractsContext,
  u: Unit,
  options: { echoed?: boolean } = {},
) {
  if (options.echoed || !character(ctx, u) || !find(ctx, u.id)) return;
  arrivalMarks(ctx, u, false);
}
export function contractsArrived(
  ctx: ContractsContext,
  u: Unit,
  options: { moved?: boolean; echoed?: boolean } = {},
) {
  if (options.echoed || !character(ctx, u) || !find(ctx, u.id)) return;
  arrivalMarks(ctx, u, true);
  for (const watcher of board(ctx).filter(
    (s) =>
      s.side === u.side &&
      s.id !== u.id &&
      s.lane === u.lane &&
      ctx.active(s) &&
      kit(ctx, s) === 'heart-starter',
  )) {
    if (!once(ctx, u.side, `tin:${watcher.cardId}`)) continue;
    const full =
      options.moved ||
      ['dorothy', 'scarecrow', 'tin-man', 'lion'].includes(u.cardId);
    gain(ctx, watcher, find(ctx, u.id), full ? 2 : 1);
    const live = find(ctx, u.id);
    if (full && live) ctx.protect(watcher, live);
  }
}

/** Call only after a genuine lane change; capture origin score before movement. */
export function contractsMoved(
  ctx: ContractsContext,
  u: Unit,
  before: ContractsMoveSnapshot,
) {
  if (before.origin === u.lane || !find(ctx, u.id)) return;
  const l = runtime(ctx).seats[u.side];
  const visits = (l.visits[u.cardId] ??= []);
  for (const lane of [before.origin, u.lane])
    if (!visits.includes(lane)) visits.push(lane);
  if (kit(ctx, u) === 'neighborhood-route' && ctx.active(u)) serve(ctx, u);
  if (
    kit(ctx, u) === 'lap-record' &&
    ctx.active(u) &&
    visits.length === 3 &&
    !l.used[`lap:${u.cardId}`]
  ) {
    l.used[`lap:${u.cardId}`] = 1;
    gain(ctx, u, u, 3);
  }
  for (const m of [...liveMarks(ctx)]) {
    if (!liveMarks(ctx).some((x) => x.id === m.id) || m.side !== u.side)
      continue;
    if (m.targets.includes(u.id)) {
      if (m.kind === 'crossing') remove(ctx, m);
      if (m.kind === 'laundry') {
        remove(ctx, m);
        const cleaned = ctx.cleanse(u, undefined, m.source);
        if (cleaned) contractsCleansed(ctx, u);
        gain(ctx, m.source, find(ctx, u.id), 1);
      }
      if (m.kind === 'ink') {
        remove(ctx, m);
        gain(ctx, m.source, find(ctx, u.id), 1);
        const live = find(ctx, u.id);
        if (live) ctx.protect(m.source, live);
      }
      if (m.kind === 'visit' && u.lane === m.origin) {
        remove(ctx, m);
        gain(ctx, m.source, find(ctx, u.id), 1);
      }
      if (
        m.kind === 'loyalty' &&
        m.amount === 0 &&
        before.origin === m.origin
      ) {
        m.amount = 1;
        gain(ctx, m.source, find(ctx, u.id), 1);
      } else if (
        m.kind === 'loyalty' &&
        m.amount === 1 &&
        u.lane === m.origin
      ) {
        remove(ctx, m);
        gain(ctx, m.source, find(ctx, u.id), 1);
        const live = find(ctx, u.id);
        if (live) ctx.protect(m.source, live);
      }
    }
    if (m.kind === 'nomination' && u.lane === m.lane) {
      remove(ctx, m);
      ctx.protect(m.source, u);
      discount(ctx, m.source, 'local', 1, u.lane);
    }
  }
  for (const watcher of board(ctx)
    .filter((s) => s.side === u.side && s.id !== u.id && ctx.active(s))
    .sort((a, b) => a.id.localeCompare(b.id))) {
    const ability = kit(ctx, watcher);
    if (
      ability === 'found-my-courage' &&
      watcher.lane === before.origin &&
      once(ctx, u.side, `lion:${watcher.cardId}`)
    )
      gain(ctx, watcher, watcher, 2);
    if (
      ability === 'geographic-arbitrage' &&
      before.originLosing &&
      element(ctx, u) === 'Water' &&
      once(ctx, u.side, `passport:${watcher.cardId}`)
    ) {
      const cleaned = ctx.cleanse(u, undefined, watcher);
      if (cleaned) contractsCleansed(ctx, u);
      gain(ctx, watcher, find(ctx, u.id), 3);
    }
    if (ability === 'pass-the-hat' && watcher.lane === u.lane) {
      const key = `busk:${watcher.cardId}:${pulse(ctx)}`,
        seen = (l.visitors[key] ??= []);
      if (!seen.includes(u.cardId) && seen.length < 2) {
        seen.push(u.cardId);
        gain(ctx, watcher, weak(ctx, allies(ctx, watcher)), seen.length);
      }
    }
  }
  for (const dancer of board(ctx).filter(
    (s) =>
      s.side === u.side && ctx.active(s) && kit(ctx, s) === 'follow-my-lead',
  )) {
    let route = l.dance[dancer.cardId];
    if (!route || route.pulse !== pulse(ctx)) {
      route = l.dance[dancer.cardId] = {
        pulse: pulse(ctx),
        first: u.cardId,
        lane: u.lane,
        paid: false,
      };
      continue;
    }
    if (!route.paid && route.first !== u.cardId && route.lane === u.lane) {
      route.paid = true;
      gain(ctx, dancer, find(ctx, u.id), 2);
      const live = find(ctx, u.id);
      if (live) ctx.protect(dancer, live);
    }
  }
  contractsArrived(ctx, u, { moved: true });
}

export function contractsGained(
  ctx: ContractsContext,
  u: Unit,
  amount: number,
  copied = false,
) {
  if (copied || amount <= 0 || !find(ctx, u.id)) return;
  for (const m of liveMarks(ctx, 'pair').filter(
    (m) => m.targets.includes(u.id) && m.pulse !== pulse(ctx),
  )) {
    const partner = m.targets.find((id) => id !== u.id),
      target = partner ? find(ctx, partner) : undefined;
    if (!target) continue;
    m.pulse = pulse(ctx);
    gain(ctx, m.source, target, Math.min(2, amount), true);
  }
}
export function contractsCleansed(ctx: ContractsContext, u: Unit) {
  if (!find(ctx, u.id) || element(ctx, u) !== 'Light') return;
  const medic = board(ctx).find(
    (s) => s.side === u.side && ctx.active(s) && kit(ctx, s) === 'all-clear',
  );
  if (medic && once(ctx, u.side, 'medic-cleanse')) gain(ctx, medic, u, 2);
}
function tip(ctx: ContractsContext, source: Pick<Unit, 'id' | 'side'>) {
  for (const m of liveMarks(ctx, 'tab').filter(
    (m) => m.side === source.side && m.targets.includes(source.id),
  ))
    m.ready = true;
}
export function contractsDamaged(
  ctx: ContractsContext,
  source: Pick<Unit, 'id' | 'side'>,
  victim: Unit,
  actual: number,
) {
  if (actual > 0 && source.side !== victim.side) tip(ctx, source);
}
export function contractsHarmfulStatusApplied(
  ctx: ContractsContext,
  source: Pick<Unit, 'id' | 'side'>,
  victim: Unit,
  isNew: boolean,
) {
  if (isNew && source.side !== victim.side) tip(ctx, source);
}
export function contractsDestroyed(
  ctx: ContractsContext,
  victim: Unit,
  sourceSide: Side | undefined,
  enemyCaused = true,
) {
  for (const m of liveMarks(ctx, 'wanted').filter((m) =>
    m.targets.includes(victim.id),
  )) {
    remove(ctx, m);
    const cowboy = find(ctx, m.source.id);
    if (
      enemyCaused &&
      sourceSide === m.side &&
      sourceSide !== victim.side &&
      cowboy &&
      ctx.active(cowboy)
    )
      gain(ctx, cowboy, cowboy, 3);
  }
}
/** Called after the real capped refund. Returns actual Motion diverted, never a new refund. */
export function contractsRefunded(
  ctx: ContractsContext,
  side: Side,
  actualRefund: number,
): number {
  if (actualRefund <= 0) return 0;
  const m = liveMarks(ctx, 'claim').find((m) => m.side !== side);
  if (!m) return 0;
  const amount = Math.min(1, actualRefund, ctx.state.players[side].motion);
  if (amount <= 0) return 0;
  remove(ctx, m);
  ctx.state.players[side].motion -= amount;
  ctx.state.players[m.side].motion = Math.min(
    9,
    ctx.state.players[m.side].motion + amount,
  );
  note(ctx, m.source, 'PENDING TRANSFER · 1 MOTION');
  return amount;
}
export function contractsDiscount(
  ctx: ContractsContext,
  side: Side,
  card: ContractDefinition,
  lane: Lane,
): ContractDiscount | undefined {
  return (ctx.state.contracts?.discounts ?? [])
    .filter(
      (d) =>
        d.side === side &&
        d.expiresAt > ctx.state.elapsedMs &&
        (d.kind === 'card'
          ? d.cardId === card.id
          : d.kind === 'other-lane'
            ? lane !== d.lane
            : (card.kind ?? 'character') === 'character' && lane === d.lane),
    )
    .sort((a, b) => b.amount - a.amount || a.id - b.id)[0];
}
export function contractsSpendDiscount(
  ctx: ContractsContext,
  side: Side,
  id: number,
): boolean {
  const r = ctx.state.contracts;
  if (
    !r ||
    !r.discounts.some(
      (d) =>
        d.id === id && d.side === side && d.expiresAt > ctx.state.elapsedMs,
    )
  )
    return false;
  r.discounts = r.discounts.filter((d) => d.id !== id);
  return true;
}

export function contractsTick(ctx: ContractsContext) {
  let r = ctx.state.contracts;
  const passive = board(ctx).some((u) =>
    [
      'neighborhood-route',
      'drink-me-eat-me',
      'lap-record',
      'pass-the-hat',
      'follow-my-lead',
    ].includes(kit(ctx, u)),
  );
  if (!r && !passive) return;
  r ??= runtime(ctx);
  const atBoundary = pulse(ctx) > r.lastPulse;
  if (atBoundary) {
    r.lastPulse = pulse(ctx);
    for (const m of [...r.marks]) {
      if (m.kind === 'dinner' && (m.dueAt ?? 0) <= ctx.state.elapsedMs) {
        remove(ctx, m);
        const guest = find(ctx, m.targets[0]);
        if (guest && move(ctx, guest, m.origin))
          gain(ctx, m.source, find(ctx, guest.id), 1);
      }
      if (m.kind === 'tab' && m.ready) {
        remove(ctx, m);
        gain(ctx, m.source, find(ctx, m.targets[0]), 2);
      }
    }
    for (const u of [...board(ctx)].sort((a, b) => a.id.localeCompare(b.id))) {
      if (!ctx.active(u)) continue;
      const ability = kit(ctx, u),
        l = r.seats[u.side];
      if (ability === 'neighborhood-route') {
        const seen = l.served[u.cardId] ?? [];
        const lane = destinations(ctx, u).find((lane) => !seen.includes(lane));
        if (lane !== undefined) move(ctx, u, lane);
      }
      if (
        ability === 'drink-me-eat-me' &&
        !ctx.lastStand() &&
        !l.used[`alice:${u.cardId}`]
      ) {
        l.used[`alice:${u.cardId}`] = 1;
        if (!returnAlly(ctx, u, u, 3)) delete l.used[`alice:${u.cardId}`];
      }
    }
    // Per-pulse visitor history is bounded even in an extended match.
    for (const l of Object.values(r.seats))
      for (const key of Object.keys(l.visitors))
        if (!key.endsWith(`:${pulse(ctx)}`)) delete l.visitors[key];
  }
  for (const m of [...r.marks])
    if (m.expiresAt <= ctx.state.elapsedMs) {
      remove(ctx, m);
      if (m.kind === 'claim')
        discount(ctx, m.source, 'local', 1, m.lane, undefined, expiry(ctx));
    }
  r.discounts = r.discounts.filter((d) => d.expiresAt > ctx.state.elapsedMs);
}
