/** Ancient Tablets are persistent lane resources, never fighters. Round effects use
 * global 10-second engine boundaries. All damage and gains use shared defenses. */
import type {
  BattleEvent,
  FighterDefinition,
  GameState,
  Lane,
  Side,
  Unit,
} from './breakthrough';
export const ANUNAKI_ABILITY_DESCRIPTIONS = {
  'ancient-receipts':
    'Deploy: place one friendly Ancient Tablet here. Tablets do not stack.',
  'ancient-blueprint':
    'Deploy: place a Tablet here and give your weakest other local character +2 Hands.',
  'ancient-light':
    'Deploy: hit the strongest local enemy for 1; consume your local Tablet first to hit for 2. With no enemy, place a Tablet.',
  'makers-touch':
    'Deploy: place a Tablet here. While active, each friendly Tablet consumed here gives you +2 and fully cleanses your weakest afflicted other local character.',
  'divine-hands':
    'Deploy: consume your local Tablet for +4 Hands, or gain +1 without one.',
  'ancient-text':
    'Deploy: summon one free Caucus Mountaineer without its entrance, or two when Squabbled. Entrance echoes summon one.',
  'ancient-storm':
    'Deploy: hit the strongest local enemy for 2; consume your local Tablet first to hit for 4. No enemy preserves the Tablet.',
  'ancient-underworld':
    'Deploy: hit the weakest local enemy for 2. Independently consume your local Tablet for +3 Hands.',
  'lab-accident':
    'Deploy: hit the strongest local enemy for 1. A landed hit has a seeded 35% chance to summon another Caucus repeating this effect, up to 8 extras. Each global 10-second pulse with your local Tablet gives +1.',
  'original-plan':
    'Pay: spend a friendly Tablet, paid lane first, for a non-stacking 2-Motion discount only when cheaper than other discounts. Deploy: consume all remaining friendly Tablets for +3 each, or +2 with none.',
} as const;
export const ANUNAKI_ADAPTERS = {
  nabu: { ability: 'ancient-receipts', triggers: ['entrance'] },
  enki: { ability: 'ancient-blueprint', triggers: ['entrance'] },
  utu: { ability: 'ancient-light', triggers: ['entrance'] },
  ninhursag: { ability: 'makers-touch', triggers: ['entrance', 'ongoing'] },
  inanna: { ability: 'divine-hands', triggers: ['entrance'] },
  yakub: { ability: 'ancient-text', triggers: ['entrance'] },
  enlil: { ability: 'ancient-storm', triggers: ['entrance'] },
  ereshkigal: { ability: 'ancient-underworld', triggers: ['entrance'] },
  'caucus-mountaineer': {
    ability: 'lab-accident',
    triggers: ['entrance', 'ongoing'],
  },
  anu: { ability: 'original-plan', triggers: ['entrance'] },
} as const;
export interface AnunakiRuntime {
  tablets: Record<Side, Lane[]>;
  lastPulse: number;
}
export function cloneAnunakiRuntime(r: AnunakiRuntime): AnunakiRuntime {
  return {
    tablets: {
      player: [...r.tablets.player],
      opponent: [...r.tablets.opponent],
    },
    lastPulse: r.lastPulse,
  };
}
export interface AnunakiContext {
  state: GameState;
  definition(u: Unit): FighterDefinition;
  active(u: Unit): boolean;
  power(u: Unit): number;
  gain(u: Unit, amount: number, source: Unit): void;
  damage(source: Unit, target: Unit, amount: number): number;
  cleanse(u: Unit, source: Unit): void;
  spawn(source: Unit): Unit | undefined;
  random(): number;
  emit(e: Omit<BattleEvent, 'id'>): void;
}
function runtime(ctx: AnunakiContext): AnunakiRuntime {
  return (ctx.state.anunaki ??= {
    tablets: { player: [], opponent: [] },
    lastPulse: Math.floor(ctx.state.elapsedMs / 10000),
  });
}
function characters(ctx: AnunakiContext): Unit[] {
  return ctx.state.units.filter(
    (u) =>
      u.hands > 0 &&
      (ctx.definition(u).kind ?? 'character') === 'character' &&
      u.canFight !== false,
  );
}
function ordered(
  ctx: AnunakiContext,
  units: Unit[],
  strongest = false,
): Unit[] {
  return units.sort(
    (a, b) =>
      (strongest ? -1 : 1) * (ctx.power(a) - ctx.power(b)) ||
      a.id.localeCompare(b.id),
  );
}
function note(ctx: AnunakiContext, source: Unit, lane: Lane, used: boolean) {
  ctx.emit({
    type: used ? 'resource-used' : 'ability',
    side: source.side,
    lane,
    position: source.position,
    sourceUnitId: source.id,
    sourceSide: source.side,
    sourceLane: source.lane,
    sourcePosition: source.position,
    cardId: source.cardId,
    text: used ? 'TABLET CONSUMED' : 'ANCIENT TABLET',
  });
}
export function anunakiTabletLane(
  state: GameState,
  side: Side,
  lane: Lane,
): Lane | undefined {
  const tablets = state.anunaki?.tablets[side] ?? [];
  return tablets.includes(lane) ? lane : [...tablets].sort((a, b) => a - b)[0];
}
function place(ctx: AnunakiContext, source: Unit): boolean {
  const tablets = runtime(ctx).tablets[source.side];
  if (tablets.includes(source.lane)) return false;
  tablets.push(source.lane);
  tablets.sort((a, b) => a - b);
  note(ctx, source, source.lane, false);
  return true;
}
export function anunakiConsume(
  ctx: AnunakiContext,
  source: Unit,
  lane: Lane,
): boolean {
  const tablets = ctx.state.anunaki?.tablets[source.side];
  if (!tablets?.includes(lane)) return false;
  tablets.splice(tablets.indexOf(lane), 1);
  note(ctx, source, lane, true);
  for (const observer of characters(ctx)
    .filter(
      (u) =>
        u.side === source.side &&
        u.lane === lane &&
        ctx.active(u) &&
        ctx.definition(u).ability === 'makers-touch',
    )
    .sort((a, b) => a.id.localeCompare(b.id))) {
    ctx.gain(observer, 2, observer);
    const afflicted = ordered(
      ctx,
      characters(ctx).filter(
        (u) =>
          u.side === source.side &&
          u.lane === lane &&
          u.id !== observer.id &&
          (u.frozen ||
            u.silenced ||
            u.weakened ||
            (u.burnStacks ?? 0) > 0 ||
            u.movementLocks?.some((l) => l.expiresAt > ctx.state.elapsedMs)),
      ),
    )[0];
    if (afflicted) ctx.cleanse(afflicted, observer);
  }
  return true;
}
export function anunakiEntrance(
  ctx: AnunakiContext,
  source: Unit,
  echoed: boolean,
): boolean | null {
  const definition = ctx.definition(source);
  if (source.copiedAbility && !definition.triggers?.includes('entrance'))
    return false;
  const ability = definition.ability;
  if (!ability || !(ability in ANUNAKI_ABILITY_DESCRIPTIONS)) return null;
  const enemies = () =>
    characters(ctx).filter(
      (u) => u.side !== source.side && u.lane === source.lane,
    );
  const consume = () => anunakiConsume(ctx, source, source.lane);
  if (ability === 'ancient-receipts' || ability === 'makers-touch')
    return place(ctx, source);
  if (ability === 'ancient-blueprint') {
    const placed = place(ctx, source);
    const ally = ordered(
      ctx,
      characters(ctx).filter(
        (u) =>
          u.side === source.side &&
          u.lane === source.lane &&
          u.id !== source.id,
      ),
    )[0];
    if (ally) ctx.gain(ally, 2, source);
    return placed || !!ally;
  }
  if (ability === 'ancient-light' || ability === 'ancient-storm') {
    const target = ordered(ctx, enemies(), true)[0];
    if (!target)
      return ability === 'ancient-light' ? place(ctx, source) : false;
    const used = consume(),
      amount = (ability === 'ancient-light' ? 1 : 2) * (used ? 2 : 1);
    return ctx.damage(source, target, amount) > 0 || used;
  }
  if (ability === 'divine-hands') {
    ctx.gain(source, consume() ? 4 : 1, source);
    return true;
  }
  if (ability === 'ancient-underworld') {
    const target = ordered(ctx, enemies())[0];
    const hit = target ? ctx.damage(source, target, 2) : 0;
    const used = consume();
    if (used) ctx.gain(source, 3, source);
    return hit > 0 || used;
  }
  if (ability === 'ancient-text') {
    let spawned = false;
    for (let i = 0; i < (source.squabbled && !echoed ? 2 : 1); i++)
      spawned = !!ctx.spawn(source) || spawned;
    return spawned;
  }
  if (ability === 'original-plan') {
    let consumed = 0;
    for (const lane of [...(ctx.state.anunaki?.tablets[source.side] ?? [])])
      if (anunakiConsume(ctx, source, lane)) consumed++;
    ctx.gain(source, consumed ? consumed * 3 : 2, source);
    return true;
  }
  if (ability === 'lab-accident') {
    let current = source,
      changed = false;
    for (let extra = 0; extra <= 8; extra++) {
      if (
        !ctx.active(current) ||
        !ctx.state.units.some((u) => u.id === current.id && u.hands > 0)
      )
        break;
      const target = ordered(
        ctx,
        characters(ctx).filter(
          (u) => u.side !== current.side && u.lane === current.lane,
        ),
        true,
      )[0];
      if (!target || ctx.damage(current, target, 1) <= 0) break;
      changed = true;
      if (extra === 8 || ctx.random() >= 0.35) break;
      const next = ctx.spawn(current);
      if (!next) break;
      current = next;
    }
    return changed;
  }
  return false;
}
export function anunakiTick(ctx: AnunakiContext): void {
  // Initialize even without Tablets so a later placement never backdates a pulse.
  const r = runtime(ctx),
    pulse = Math.floor(ctx.state.elapsedMs / 10000);
  if (pulse <= r.lastPulse) return;
  r.lastPulse = pulse;
  for (const u of characters(ctx).sort((a, b) => a.id.localeCompare(b.id)))
    if (
      ctx.active(u) &&
      ctx.definition(u).ability === 'lab-accident' &&
      r.tablets[u.side].includes(u.lane)
    )
      ctx.gain(u, 1, u);
}
