/** Canonical neighborhood and elemental entrances. Authoritative helpers own
 * defenses, damage provenance, legal movement and cleanup; animation is never a gate. */
import type {
  BattleEvent,
  GameState,
  Lane,
  Side,
  TimedStatus,
  Unit,
} from './breakthrough';

export const NEIGHBORHOOD_ABILITY_DESCRIPTIONS = {
  grounded: 'Deploy: give your lowest-Hands other local ally +1 Hand.',
  'counter-claim':
    'Deploy: if you have no other friendly cards in this lane, gain +1 Hand.',
  'walk-the-pack':
    'Deploy: if at least two other friendly characters are here, gain +3 Hands. Tokens and actions are not characters.',
  sideshow:
    'Deploy: move to your weakest other legal lane. Only after arrival, its lowest-Hands other ally gains +1.',
  'drop-off':
    'Deploy: move your weakest movable other local card with printed cost 1 or 2 to its weakest other legal lane.',
  'now-you-see-me':
    'Deploy: attempt to Weaken the strongest enemy here, then move to your weakest other legal lane. A blocked status does not block an otherwise legal move.',
  'block-shortcut':
    'Deploy: move to your weakest other legal lane. Gain +2 only after arriving.',
  'last-stop':
    'Deploy: move your weakest movable other local ally to its weakest other legal lane. Only after arrival, fully cleanse it and give +2 Hands, or +3 if Water.',
  'one-more':
    'Deploy: if an enemy is here, gain +1 Hand. If at least two enemies are here, also attempt 1 Burn on the strongest. Normal elemental Burn bonuses and defenses apply.',
  'chill-out':
    'Deploy: fully cleanse your weakest other local character affected by Freeze or Silence. Only a successful cleanse gives that ally +1 Hand.',
  'chest-pop':
    'Deploy: if an enemy is here, gain +2 Hands and attempt 2 damage on the strongest local enemy. Protection and immunity can block the hostile half.',
  'side-hustle':
    'Deploy: if a friendly character occupies another lane, restore 1 Motion, up to 9.',
  'echo-chamber':
    'Deploy: Weaken the strongest local enemy. If already Weakened, attempt Silence instead; a landed Silence package gives you +2 Hands.',
  heartbreak:
    'Deploy: attempt 3 damage on the strongest local enemy and give your weakest other local character +2 Hands. The friendly benefit remains available if the hit is blocked.',
  'for-the-hood':
    'Deploy: give up to three weakest other local characters +1 Hand each. Restore 1 Motion only if all three actually gained Hands.',
  'sweet-weakness':
    'Deploy: attempt to Weaken the strongest enemy here. If it was already Weakened and the hostile package lands, gain +1 Hand.',
  'emotional-support-gator':
    'Deploy: attempt 1 damage on the strongest local enemy. Gain +1 only if actual damage lands.',
  'soak-your-problems':
    'Deploy: fully cleanse your weakest other local ally affected by Freeze or Silence and give it +1. Only actual cleansing also gives you +1.',
  'i-brought-my-own-plate':
    'Deploy: your weakest other local Plant ally gains +2 Hands. If one exists, you also gain +1.',
  'ceremonial-grade-crashout':
    'Deploy: with at least 4 Motion remaining after payment, gain +2. Otherwise fully cleanse your weakest other frozen or silenced ally anywhere and give it +3. With no patient, give your weakest other Plant ally anywhere +3; if none exists, gain +2.',
  'personal-space-is-seasonal':
    'Deploy: attempt 2 damage on the strongest enemy in another lane; independently give your weakest other local ally +1 and weakest Plant ally in another lane +1.',
  'run-your-breadcrumbs':
    'Deploy: move to your weakest other legal lane. Only after arrival, attempt 1 damage on its weakest enemy.',
  'no-quiet-section':
    'Deploy: attempt to Weaken the strongest local enemy. Move your weakest movable other local ally to its weakest legal other lane; only arrival grants it +2.',
  'wrong-gate-great-lighting':
    'Deploy: move to your weakest other legal lane. Only after arrival gain +1, then give your weakest ally left in the original lane +2, or +3 if Air, and Protection.',
  'bad-omen':
    'Deploy: attempt to Weaken the strongest local enemy. Personal Protection, lane defenses and immunity apply.',
  'clean-work':
    'Deploy: fully cleanse your weakest other local ally and give it +2 Hands, including a healthy ally.',
  'your-side-of-the-fridge':
    'Deploy: if another friendly ally is here, gain +1 Hand.',
  'raid-the-chat':
    'Deploy: gain +1 for each other local friendly character costing 2 or less, up to +2. Actions and tokens do not count.',
  'fix-it-yourself':
    'Deploy: fully cleanse your weakest other local ally. A healthy ally produces no invented entrance success.',
  'quiet-tip':
    'Deploy: attempt 3 damage on the strongest local enemy through normal defenses.',
  'hidden-stash':
    'Deploy: if another friendly character is here, restore 1 Motion, up to 9. Actions and tokens do not qualify.',
  'loose-lips':
    'Deploy: Silence the strongest local enemy. If already Silenced, attempt Weaken instead. Defenses apply to the complete status package.',
  'red-side-retaliation':
    'Deploy: target the strongest local enemy legally capable of losing Hands and attempt 2 damage. Only actual damage gives you +1.',
  'meet-me-there':
    'Deploy: nominate your weakest other lane until the second following 10-second pulse. Your next other Air character played or moved there gains +2. One welcome per side; echoes are not arrivals.',
  'fresh-color':
    'Deploy: paint this lane with your element until the second following 10-second pulse. The next other friendly character of a different element played or moved here gains +2. One paint per lane per side; echoes are not arrivals.',
} as const;

export const NEIGHBORHOOD_ADAPTERS = {
  'earthy-sugar-foot': { ability: 'grounded', tacticalRoles: ['support'] },
  'bodega-cat': { ability: 'counter-claim', tacticalRoles: [] },
  'dog-walker': { ability: 'walk-the-pack', tacticalRoles: [] },
  'car-meet-kid': { ability: 'sideshow', tacticalRoles: ['support'] },
  'delivery-demon': { ability: 'drop-off', tacticalRoles: ['support'] },
  'subway-magician': { ability: 'now-you-see-me', tacticalRoles: ['control'] },
  'og-dominican': { ability: 'block-shortcut', tacticalRoles: [] },
  'last-train-conductor': { ability: 'last-stop', tacticalRoles: ['support'] },
  fein: { ability: 'one-more', tacticalRoles: ['control'] },
  'stoner-jr': { ability: 'chill-out', tacticalRoles: ['support'] },
  'krump-dancer': { ability: 'chest-pop', tacticalRoles: ['control'] },
  'yung-hustle': { ability: 'side-hustle', tacticalRoles: ['support'] },
  'red-pill': { ability: 'echo-chamber', tacticalRoles: ['control'] },
  simmy: { ability: 'heartbreak', tacticalRoles: ['support', 'control'] },
  tron: { ability: 'for-the-hood', tacticalRoles: ['support'] },
  sugarfoot: { ability: 'sweet-weakness', tacticalRoles: ['control'] },
  'riptide-bruiser': {
    ability: 'emotional-support-gator',
    tacticalRoles: ['control'],
  },
  'stillwater-medic': {
    ability: 'soak-your-problems',
    tacticalRoles: ['support'],
  },
  sprout: { ability: 'i-brought-my-own-plate', tacticalRoles: ['support'] },
  'root-nurse': {
    ability: 'ceremonial-grade-crashout',
    tacticalRoles: ['support'],
  },
  'garden-wall': {
    ability: 'personal-space-is-seasonal',
    tacticalRoles: ['support', 'control'],
  },
  gust: { ability: 'run-your-breadcrumbs', tacticalRoles: ['control'] },
  crosswind: {
    ability: 'no-quiet-section',
    tacticalRoles: ['support', 'control'],
  },
  cloudbreak: {
    ability: 'wrong-gate-great-lighting',
    tacticalRoles: ['support'],
  },
  'red-side-4': { ability: 'bad-omen', tacticalRoles: ['control'] },
  'miami-surgeon': { ability: 'clean-work', tacticalRoles: ['support'] },
  roommate: { ability: 'your-side-of-the-fridge', tacticalRoles: [] },
  'live-streamer-male': { ability: 'raid-the-chat', tacticalRoles: [] },
  redneck: { ability: 'fix-it-yourself', tacticalRoles: ['support'] },
  'inmate-informant': { ability: 'quiet-tip', tacticalRoles: ['control'] },
  'inmate-contraband': { ability: 'hidden-stash', tacticalRoles: ['support'] },
  snitch: { ability: 'loose-lips', tacticalRoles: ['control'] },
  'ganger-red': { ability: 'red-side-retaliation', tacticalRoles: ['control'] },
  'honest-thot': { ability: 'meet-me-there', tacticalRoles: ['support'] },
  'mural-apprentice': { ability: 'fresh-color', tacticalRoles: ['support'] },
} as const;

export interface NeighborhoodDefinition {
  id: string;
  cost: number;
  kind?: string;
  hazard?: boolean;
  element?: string;
  ability?: string;
}
export interface NeighborhoodContext {
  state: GameState & { neighborhood?: NeighborhoodRuntime };
  definition(unit: Unit): NeighborhoodDefinition;
  active(unit: Unit): boolean;
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
  /** Omitted mask means full canonical Cleanse, including owned movement contracts. */
  cleanse(
    target: Unit,
    kinds?: readonly TimedStatus['kind'][],
    source?: Pick<Unit, 'id' | 'cardId' | 'side' | 'lane' | 'position'>,
  ): boolean;
  burn(source: Unit, target: Unit, stacks: number): boolean;
  move(unit: Unit, lane: Lane): boolean;
  openForMove(unit: Unit, lane: Lane): boolean;
  refund(side: Side, amount: number, source: Unit): number;
  canLoseHands(unit: Unit): boolean;
  event(event: Omit<BattleEvent, 'id'>): void;
}
export interface NeighborhoodMark {
  id: number;
  kind: 'welcome' | 'paint';
  side: Side;
  source: Unit;
  sourceElement: string;
  lane: Lane;
  expiresAt: number;
}
export interface NeighborhoodRuntime {
  nextId: number;
  marks: NeighborhoodMark[];
}
export function cloneNeighborhoodRuntime(
  runtime: NeighborhoodRuntime | undefined,
): NeighborhoodRuntime | undefined {
  return runtime
    ? (JSON.parse(JSON.stringify(runtime)) as NeighborhoodRuntime)
    : undefined;
}
const LANES: readonly Lane[] = [0, 1, 2];
const element = (ctx: NeighborhoodContext, unit: Unit) => {
  const value = ctx.definition(unit).element ?? 'Normal';
  return value === 'Rock' ? 'Earth' : value;
};
function board(ctx: NeighborhoodContext): Unit[] {
  return ctx.state.units.filter(
    (u) =>
      u.hands > 0 &&
      !ctx.definition(u).hazard &&
      !['support', 'blockbuster'].includes(
        ctx.definition(u).kind ?? 'character',
      ),
  );
}
function character(ctx: NeighborhoodContext, unit: Unit): boolean {
  return (
    !ctx.definition(unit).hazard &&
    (ctx.definition(unit).kind ?? 'character') === 'character'
  );
}
function find(ctx: NeighborhoodContext, id: string): Unit | undefined {
  return board(ctx).find((u) => u.id === id);
}
function allies(ctx: NeighborhoodContext, source: Unit, local = true): Unit[] {
  return board(ctx).filter(
    (u) =>
      u.side === source.side &&
      u.id !== source.id &&
      (!local || u.lane === source.lane),
  );
}
function enemies(ctx: NeighborhoodContext, source: Unit, local = true): Unit[] {
  return board(ctx).filter(
    (u) => u.side !== source.side && (!local || u.lane === source.lane),
  );
}
function sorted(
  ctx: NeighborhoodContext,
  units: Unit[],
  highest = false,
): Unit[] {
  return [...units].sort(
    (a, b) =>
      (highest ? -1 : 1) * (ctx.power(a) - ctx.power(b)) ||
      a.id.localeCompare(b.id),
  );
}
const weak = (ctx: NeighborhoodContext, units: Unit[]) => sorted(ctx, units)[0];
const strong = (ctx: NeighborhoodContext, units: Unit[]) =>
  sorted(ctx, units, true)[0];
function score(ctx: NeighborhoodContext, side: Side, lane: Lane): number {
  return board(ctx)
    .filter((u) => u.side === side && u.lane === lane)
    .reduce((total, u) => total + ctx.power(u), 0);
}
function destination(ctx: NeighborhoodContext, target: Unit): Lane | undefined {
  return LANES.filter(
    (l) => l !== target.lane && ctx.openForMove(target, l),
  ).sort(
    (a, b) => score(ctx, target.side, a) - score(ctx, target.side, b) || a - b,
  )[0];
}
function grant(
  ctx: NeighborhoodContext,
  source: Unit,
  target: Unit | undefined,
  amount: number,
): boolean {
  if (!target || !find(ctx, target.id) || target.hands <= 0 || amount <= 0)
    return false;
  // A living recipient really gains before synchronous steal/rebuttal reactions.
  // Net Hands after those reactions are not the gain receipt.
  ctx.gain(target, amount, false, source);
  ctx.event({
    type: 'ability',
    side: source.side,
    lane: target.lane,
    position: target.position,
    sourceUnitId: source.id,
    sourceSide: source.side,
    sourceLane: source.lane,
    sourcePosition: source.position,
    targetUnitId: target.id,
    cardId: target.cardId,
    text: `+${amount} HANDS`,
  });
  return true;
}
function travel(ctx: NeighborhoodContext, target: Unit): boolean {
  const current = find(ctx, target.id);
  if (!current) return false;
  const lane = destination(ctx, current);
  return lane !== undefined && ctx.move(current, lane);
}
function putMark(
  ctx: NeighborhoodContext,
  source: Unit,
  kind: NeighborhoodMark['kind'],
  lane: Lane,
): boolean {
  const runtime = (ctx.state.neighborhood ??= { nextId: 1, marks: [] });
  runtime.marks = runtime.marks.filter(
    (m) =>
      !(
        m.side === source.side &&
        m.kind === kind &&
        (kind !== 'paint' || m.lane === lane)
      ),
  );
  runtime.marks.push({
    id: runtime.nextId++,
    kind,
    side: source.side,
    source: { ...source },
    sourceElement: element(ctx, source),
    lane,
    expiresAt: (Math.floor(ctx.state.elapsedMs / 10000) + 2) * 10000,
  });
  ctx.event({
    type: 'lane-mark',
    side: source.side,
    lane,
    position: source.position,
    sourceUnitId: source.id,
    sourceSide: source.side,
    sourceLane: source.lane,
    sourcePosition: source.position,
    text: kind === 'paint' ? 'FRESH COLOR' : 'MEET ME THERE',
  });
  return true;
}

/** Null means the source is outside this module; false is a genuinely failed entrance. */
export function neighborhoodEntrance(
  ctx: NeighborhoodContext,
  source: Unit,
): boolean | null {
  const ability = ctx.definition(source).ability ?? '';
  if (!Object.hasOwn(NEIGHBORHOOD_ABILITY_DESCRIPTIONS, ability)) return null;
  if (!ctx.active(source) || !find(ctx, source.id)) return false;
  const local = () => allies(ctx, source),
    all = () => allies(ctx, source, false),
    foes = () => enemies(ctx, source);
  const self = () => find(ctx, source.id);
  if (ability === 'grounded') return grant(ctx, source, weak(ctx, local()), 1);
  if (ability === 'counter-claim')
    return !local().length && grant(ctx, source, self(), 1);
  if (ability === 'walk-the-pack')
    return (
      local().filter((u) => character(ctx, u)).length >= 2 &&
      grant(ctx, source, self(), 3)
    );
  if (ability === 'sideshow') {
    if (!travel(ctx, source)) return false;
    const live = self();
    if (live) grant(ctx, source, weak(ctx, allies(ctx, live)), 1);
    return true;
  }
  if (ability === 'drop-off') {
    const target = weak(
      ctx,
      local().filter(
        (u) =>
          ctx.definition(u).cost >= 1 &&
          ctx.definition(u).cost <= 2 &&
          destination(ctx, u) !== undefined,
      ),
    );
    return !!target && travel(ctx, target);
  }
  if (ability === 'now-you-see-me') {
    const target = strong(ctx, foes());
    const applied = target ? ctx.weaken(source, target) : false;
    return travel(ctx, source) || applied;
  }
  if (ability === 'block-shortcut') {
    if (!travel(ctx, source)) return false;
    grant(ctx, source, self(), 2);
    return true;
  }
  if (ability === 'last-stop') {
    const target = weak(
      ctx,
      local().filter((u) => destination(ctx, u) !== undefined),
    );
    if (!target || !travel(ctx, target)) return false;
    const live = find(ctx, target.id);
    if (live) {
      ctx.cleanse(live, undefined, source);
      grant(
        ctx,
        source,
        find(ctx, target.id),
        element(ctx, live) === 'Water' ? 3 : 2,
      );
    }
    return true;
  }
  if (ability === 'one-more') {
    const targets = foes();
    if (!targets.length) return false;
    let changed = grant(ctx, source, self(), 1);
    const target = strong(ctx, targets);
    if (targets.length >= 2 && target && self())
      changed = ctx.burn(source, target, 1) || changed;
    return changed;
  }
  if (ability === 'chill-out' || ability === 'soak-your-problems') {
    const target = weak(
      ctx,
      local().filter(
        (u) =>
          (ability !== 'chill-out' || character(ctx, u)) &&
          (u.frozen || u.silenced),
      ),
    );
    if (!target || !ctx.cleanse(target, undefined, source)) return false;
    grant(ctx, source, find(ctx, target.id), 1);
    if (ability === 'soak-your-problems') grant(ctx, source, self(), 1);
    return true;
  }
  if (ability === 'chest-pop') {
    const target = strong(ctx, foes());
    if (!target) return false;
    const gained = grant(ctx, source, self(), 2);
    return (self() ? ctx.damage(source, target, 2) > 0 : false) || gained;
  }
  if (ability === 'side-hustle')
    return (
      all().some((u) => character(ctx, u) && u.lane !== source.lane) &&
      ctx.refund(source.side, 1, source) > 0
    );
  if (ability === 'echo-chamber') {
    const target = strong(ctx, foes());
    if (!target) return false;
    if (!target.weakened) return ctx.weaken(source, target);
    const landed = ctx.silence(source, target);
    if (landed) grant(ctx, source, self(), 2);
    return landed;
  }
  if (ability === 'heartbreak') {
    const target = strong(ctx, foes());
    const hit = target ? ctx.damage(source, target, 3) > 0 : false;
    const live = self();
    return (
      (live
        ? grant(
            ctx,
            source,
            weak(
              ctx,
              allies(ctx, live).filter((u) => character(ctx, u)),
            ),
            2,
          )
        : false) || hit
    );
  }
  if (ability === 'for-the-hood') {
    const targets = sorted(
      ctx,
      local().filter((u) => character(ctx, u)),
    ).slice(0, 3);
    let successes = 0;
    for (const target of targets)
      if (grant(ctx, source, find(ctx, target.id), 1)) successes++;
    if (successes === 3 && self()) ctx.refund(source.side, 1, source);
    return successes > 0;
  }
  if (ability === 'sweet-weakness') {
    const target = strong(ctx, foes());
    if (!target) return false;
    const already = !!target.weakened,
      landed = ctx.weaken(source, target);
    if (already && landed) grant(ctx, source, self(), 1);
    return landed;
  }
  if (
    ability === 'emotional-support-gator' ||
    ability === 'red-side-retaliation'
  ) {
    const target = strong(
      ctx,
      foes().filter(
        (u) => ability !== 'red-side-retaliation' || ctx.canLoseHands(u),
      ),
    );
    if (
      !target ||
      ctx.damage(source, target, ability === 'red-side-retaliation' ? 2 : 1) <=
        0
    )
      return false;
    grant(ctx, source, self(), 1);
    return true;
  }
  if (ability === 'i-brought-my-own-plate') {
    const target = weak(
      ctx,
      local().filter((u) => element(ctx, u) === 'Plant'),
    );
    if (!target) return false;
    const changed = grant(ctx, source, target, 2);
    return grant(ctx, source, self(), 1) || changed;
  }
  if (ability === 'ceremonial-grade-crashout') {
    if (ctx.state.players[source.side].motion >= 4)
      return grant(ctx, source, self(), 2);
    const patient = weak(
      ctx,
      all().filter((u) => u.frozen || u.silenced),
    );
    if (patient) {
      const changed = ctx.cleanse(patient, undefined, source);
      return grant(ctx, source, find(ctx, patient.id), 3) || changed;
    }
    return grant(
      ctx,
      source,
      weak(
        ctx,
        all().filter((u) => element(ctx, u) === 'Plant'),
      ) ?? self(),
      all().some((u) => element(ctx, u) === 'Plant') ? 3 : 2,
    );
  }
  if (ability === 'personal-space-is-seasonal') {
    const target = strong(
      ctx,
      enemies(ctx, source, false).filter((u) => u.lane !== source.lane),
    );
    let changed = target ? ctx.damage(source, target, 2) > 0 : false;
    if (!self()) return changed;
    changed = grant(ctx, source, weak(ctx, local()), 1) || changed;
    return (
      grant(
        ctx,
        source,
        weak(
          ctx,
          all().filter(
            (u) => u.lane !== source.lane && element(ctx, u) === 'Plant',
          ),
        ),
        1,
      ) || changed
    );
  }
  if (ability === 'run-your-breadcrumbs') {
    if (!travel(ctx, source)) return false;
    const live = self(),
      target = live ? weak(ctx, enemies(ctx, live)) : undefined;
    if (target && live) ctx.damage(live, target, 1);
    return true;
  }
  if (ability === 'no-quiet-section') {
    const target = strong(ctx, foes());
    let changed = target ? ctx.weaken(source, target) : false;
    if (!self()) return changed;
    const traveler = weak(
      ctx,
      local().filter((u) => destination(ctx, u) !== undefined),
    );
    if (traveler && travel(ctx, traveler)) {
      grant(ctx, source, find(ctx, traveler.id), 2);
      changed = true;
    }
    return changed;
  }
  if (ability === 'wrong-gate-great-lighting') {
    const origin = source.lane;
    if (!travel(ctx, source)) return false;
    grant(ctx, source, self(), 1);
    if (!self()) return true;
    const target = weak(
      ctx,
      all().filter((u) => u.lane === origin),
    );
    if (target) {
      grant(ctx, source, target, element(ctx, target) === 'Air' ? 3 : 2);
      const live = find(ctx, target.id);
      if (live) ctx.protect(source, live);
    }
    return true;
  }
  if (ability === 'bad-omen') {
    const target = strong(ctx, foes());
    return !!target && ctx.weaken(source, target);
  }
  if (ability === 'clean-work' || ability === 'fix-it-yourself') {
    const target = weak(ctx, local());
    if (!target) return false;
    const changed = ctx.cleanse(target, undefined, source);
    return (
      (ability === 'clean-work'
        ? grant(ctx, source, find(ctx, target.id), 2)
        : false) || changed
    );
  }
  if (ability === 'your-side-of-the-fridge')
    return local().length > 0 && grant(ctx, source, self(), 1);
  if (ability === 'raid-the-chat')
    return grant(
      ctx,
      source,
      self(),
      Math.min(
        2,
        local().filter((u) => character(ctx, u) && ctx.definition(u).cost <= 2)
          .length,
      ),
    );
  if (ability === 'quiet-tip') {
    const target = strong(ctx, foes());
    return !!target && ctx.damage(source, target, 3) > 0;
  }
  if (ability === 'hidden-stash')
    return (
      local().some((u) => character(ctx, u)) &&
      ctx.refund(source.side, 1, source) > 0
    );
  if (ability === 'loose-lips') {
    const target = strong(ctx, foes());
    return (
      !!target &&
      (target.silenced
        ? ctx.weaken(source, target)
        : ctx.silence(source, target))
    );
  }
  if (ability === 'meet-me-there') {
    const lane = [...LANES]
      .filter((l) => l !== source.lane)
      .sort(
        (a, b) =>
          score(ctx, source.side, a) - score(ctx, source.side, b) || a - b,
      )[0];
    return putMark(ctx, source, 'welcome', lane);
  }
  if (ability === 'fresh-color')
    return putMark(ctx, source, 'paint', source.lane);
  return false;
}

/** Call for genuine placement after its entrance, or after a successful lateral move. */
export function neighborhoodArrived(
  ctx: NeighborhoodContext,
  entrant: Unit,
  options: { moved?: boolean; echoed?: boolean } = {},
) {
  const runtime = ctx.state.neighborhood;
  if (
    !runtime ||
    options.echoed ||
    !character(ctx, entrant) ||
    !find(ctx, entrant.id)
  )
    return;
  for (const mark of [...runtime.marks]) {
    if (
      mark.expiresAt <= ctx.state.elapsedMs ||
      mark.side !== entrant.side ||
      mark.lane !== entrant.lane ||
      mark.source.id === entrant.id
    )
      continue;
    const eligible =
      mark.kind === 'welcome'
        ? element(ctx, entrant) === 'Air'
        : element(ctx, entrant) !== mark.sourceElement;
    if (!eligible || !runtime.marks.some((m) => m.id === mark.id)) continue;
    runtime.marks = runtime.marks.filter((m) => m.id !== mark.id); // consume before gain reactions
    grant(ctx, mark.source, find(ctx, entrant.id), 2);
  }
}
export function neighborhoodTick(ctx: NeighborhoodContext) {
  if (ctx.state.neighborhood)
    ctx.state.neighborhood.marks = ctx.state.neighborhood.marks.filter(
      (m) => m.expiresAt > ctx.state.elapsedMs,
    );
}
