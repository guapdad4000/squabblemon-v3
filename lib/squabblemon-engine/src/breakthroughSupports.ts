/** Explicit support-action rules for the time-based Breakthrough match.
 * This module never charges Motion, removes a held card, creates a marching unit,
 * or waits for presentation. The caller validates and commits the entire command.
 */
import type { Lane, Side, Unit } from './breakthrough';
type EffectSource = Pick<Unit, 'id' | 'cardId' | 'side' | 'lane' | 'position'>;

/** Round-bound support contracts use the shared ten-second game-clock pulse. */
export const SUPPORT_PULSE_MS = 10000;
export const SUPPORT_DESCRIPTIONS = {
  'wrist-check':
    'Action: your weakest friendly fighter here gains+1 and Protection. Only a new Watch ward pays+2 when its own Protection blocks a hostile ability; unrelated shields never cash it.',
  'second-wind': 'Action: restore3 Motion after paying, up to the9-Motion cap.',
  refund:
    'Action: restore1 Motion per friendly fighter here, up to3. With at least3 friendly fighters here, also Protect your weakest local Electric fighter.',
  'emergency-kit':
    'Action: fully cleanse your weakest afflicted friendly fighter here, otherwise your weakest friendly fighter. Store one kit on it: prevent up to2 of its next enemy damage before defeat. Kits do not stack.',
  'turn-it-up':
    'Action: every friendly fighter here gains+1. Leave one Encore here through the next10-second pulse interval: the next friendly lane-movement arrival gains+1, then spends it.',
  'alternate-route':
    'Action: move your weakest friendly fighter here to your weakest other lane; only a successful legal move grants+1. Frozen fighters and enemy positions still restrict movement.',
  'stand-firm':
    'Action: your weakest friendly fighter here gains+2 and Protection from one targeted hostile ability.',
  'side-order':
    'Action: your weakest friendly fighter here gains+2; your strongest enemy here takes2 damage. Protection and immunity block only the hostile half. Requires at least one local fighter.',
  'bad-intentions':
    'Action: your weakest local friendly fighter that has not been fitted gains+1 and Protection. Its next successful lane move before the next10-second pulse grants+1 once. One fitting per friendly card identity per match.',
  'marked-territory':
    'Action: mark this lane until your next character is deployed here. It arrives with+2 and adopts the majority Red or Blue Set already here; ties keep its original colors. One pending mark per friendly lane.',
} as const;
export type SupportAbility = keyof typeof SUPPORT_DESCRIPTIONS;
export const SUPPORT_ADAPTERS = {
  'bust-down-watch': {
    ability: 'wrist-check',
    action: { target: 'weakest-ally', requiresFriendlyFighter: true },
    tacticalRoles: ['support'],
  },
  'energy-drink': {
    ability: 'second-wind',
    action: { target: 'none', requiresFriendlyFighter: false },
    tacticalRoles: ['support'],
  },
  'phone-charger': {
    ability: 'refund',
    action: { target: 'none', requiresFriendlyFighter: false },
    tacticalRoles: ['support'],
  },
  'first-aid-kit': {
    ability: 'emergency-kit',
    action: { target: 'weakest-afflicted-ally', requiresFriendlyFighter: true },
    tacticalRoles: ['support'],
  },
  boombox: {
    ability: 'turn-it-up',
    action: { target: 'none', requiresFriendlyFighter: false },
    tacticalRoles: ['support'],
  },
  'subway-map': {
    ability: 'alternate-route',
    action: { target: 'weakest-ally', requiresFriendlyFighter: true },
    tacticalRoles: ['support'],
  },
  'work-boots': {
    ability: 'stand-firm',
    action: { target: 'weakest-ally', requiresFriendlyFighter: true },
    tacticalRoles: ['support'],
  },
  'a-side-of-hands': {
    ability: 'side-order',
    action: { target: 'weakest-ally', requiresFriendlyFighter: false },
    tacticalRoles: ['support', 'control'],
  },
  'black-air-fade-1s': {
    ability: 'bad-intentions',
    action: { target: 'weakest-ally', requiresFriendlyFighter: true },
    tacticalRoles: ['support'],
  },
  initiation: {
    ability: 'marked-territory',
    action: { target: 'none', requiresFriendlyFighter: false },
    tacticalRoles: ['support'],
  },
} as const;
export type SupportCardId = keyof typeof SUPPORT_ADAPTERS;
export type SupportGangColor = 'blue' | 'red';
export interface SupportCause {
  source?: EffectSource;
  cardId: SupportCardId;
  side: Side;
  lane: Lane;
}
interface TargetContract extends SupportCause {
  targetId: string;
}
interface ExpiringContract extends SupportCause {
  expiresAt: number;
}
export interface SupportRuntime {
  watches: TargetContract[];
  kits: TargetContract[];
  encores: ExpiringContract[];
  fittings: (TargetContract & { expiresAt: number })[];
  /** Card identity is stable across defeat, return, and redeployment. */
  fittedCards: Record<string, true>;
  territory: SupportCause[];
}
export interface SupportView {
  elapsedMs: number;
  units: readonly Unit[];
  element(unit: Unit): string | undefined;
  gangColor(unit: Unit): SupportGangColor | undefined;
  /** Includes Freeze's zero-Hands rule, for canonical lowest/highest picks. */
  effectiveHands(unit: Unit): number;
  isAfflicted(unit: Unit): boolean;
  canMove(unit: Unit, lane: Lane): boolean;
}
export interface SupportTools {
  gain(
    unit: Unit,
    amount: number,
    cause: SupportCause,
    source?: EffectSource,
  ): void;
  /** Return true only when this call creates personal Protection. */
  protect(unit: Unit, cause: SupportCause): boolean;
  cleanse(unit: Unit, cause: SupportCause, source?: EffectSource): void;
  restoreMotion(side: Side, amount: number, cause: SupportCause): void;
  /** Applies normal targeted hostile defenses before enemy damage. */
  strike(unit: Unit, amount: number, cause: SupportCause): void;
  /** Uses normal movement rules and movement reactions; never teleports. */
  move(unit: Unit, lane: Lane, cause: SupportCause): boolean;
  setGangColor(unit: Unit, color: SupportGangColor, cause: SupportCause): void;
  note(text: string, cause: SupportCause, unit?: Unit): void;
}
export interface SupportTargetResult {
  valid: boolean;
  error?: string;
  targetUnitId?: string;
  enemyUnitId?: string;
  destinationLane?: Lane;
}
const lanes: readonly Lane[] = [0, 1, 2];
const sides: readonly Side[] = ['player', 'opponent'];
const cardForAbility = Object.fromEntries(
  Object.entries(SUPPORT_ADAPTERS).map(([id, spec]) => [spec.ability, id]),
) as Record<SupportAbility, SupportCardId>;
export function isSupportAbility(value: unknown): value is SupportAbility {
  return (
    typeof value === 'string' && Object.hasOwn(SUPPORT_DESCRIPTIONS, value)
  );
}
export function createSupportRuntime(): SupportRuntime {
  return {
    watches: [],
    kits: [],
    encores: [],
    fittings: [],
    fittedCards: {},
    territory: [],
  };
}
const cloneCause = <T extends SupportCause>(cause: T): T => ({
  ...cause,
  ...(cause.source ? { source: { ...cause.source } } : {}),
});
export function cloneSupportRuntime(runtime?: SupportRuntime): SupportRuntime {
  if (!runtime) return createSupportRuntime();
  return {
    watches: runtime.watches.map(cloneCause),
    kits: runtime.kits.map(cloneCause),
    encores: runtime.encores.map(cloneCause),
    fittings: runtime.fittings.map(cloneCause),
    fittedCards: { ...runtime.fittedCards },
    territory: runtime.territory.map(cloneCause),
  };
}
const fittedKey = (unit: Unit) => `${unit.side}:${unit.cardId}`;
const localUnits = (view: SupportView, side: Side, lane: Lane) =>
  view.units.filter((u) => u.side === side && u.lane === lane && u.hands > 0);
function weakest(view: SupportView, units: readonly Unit[]) {
  return [...units].sort(
    (a, b) =>
      view.effectiveHands(a) - view.effectiveHands(b) ||
      a.id.localeCompare(b.id),
  )[0];
}
function strongest(view: SupportView, units: readonly Unit[]) {
  return [...units].sort(
    (a, b) =>
      view.effectiveHands(b) - view.effectiveHands(a) ||
      a.id.localeCompare(b.id),
  )[0];
}
/** Legality is read-only and produces the complete authored automatic pick.
 * A selected target may be locked against this plan; it never becomes free choice.
 */
export function legalSupportTarget(
  view: SupportView,
  runtime: SupportRuntime,
  ability: SupportAbility,
  side: Side,
  lane: Lane,
): SupportTargetResult {
  if (
    !sides.includes(side) ||
    !lanes.includes(lane) ||
    !isSupportAbility(ability)
  )
    return { valid: false, error: 'Invalid support action' };
  const local = localUnits(view, side, lane);
  if (ability === 'marked-territory') {
    return runtime.territory.some((x) => x.side === side && x.lane === lane)
      ? {
          valid: false,
          error: 'This lane already has an unused territory mark',
        }
      : { valid: true };
  }
  if (
    ability === 'second-wind' ||
    ability === 'refund' ||
    ability === 'turn-it-up'
  )
    return { valid: true };
  const candidates =
    ability === 'bad-intentions'
      ? local.filter((u) => !runtime.fittedCards[fittedKey(u)])
      : ability === 'emergency-kit' && local.some((u) => view.isAfflicted(u))
        ? local.filter((u) => view.isAfflicted(u))
        : local;
  const target = weakest(view, candidates);
  const enemy =
    ability === 'side-order'
      ? strongest(
          view,
          view.units.filter(
            (u) => u.side !== side && u.lane === lane && u.hands > 0,
          ),
        )
      : undefined;
  if (!target && !enemy)
    return {
      valid: false,
      error:
        ability === 'bad-intentions'
          ? 'This action needs a friendly fighter that has not been fitted this match'
          : ability === 'side-order'
            ? 'This action needs a friendly or enemy fighter in this lane'
            : 'This action needs a friendly fighter in this lane',
    };
  const result: SupportTargetResult = {
    valid: true,
    ...(target ? { targetUnitId: target.id } : {}),
    ...(enemy ? { enemyUnitId: enemy.id } : {}),
  };
  if (ability === 'alternate-route') {
    // The printed target is the weakest other lane, not any convenient open lane.
    // A blocked canonical destination is an invalid action; never route around it.
    const destination = lanes
      .filter((x) => x !== lane)
      .sort(
        (a, b) =>
          localUnits(view, side, a).reduce(
            (n, u) => n + view.effectiveHands(u),
            0,
          ) -
            localUnits(view, side, b).reduce(
              (n, u) => n + view.effectiveHands(u),
              0,
            ) || a - b,
      )[0];
    if (!target || !view.canMove(target, destination))
      return {
        valid: false,
        error: 'The weakest fighter cannot move to your weakest other lane',
      };
    result.destinationLane = destination;
  }
  return result;
}
function sameTarget(a: SupportTargetResult, b: SupportTargetResult) {
  return (
    a.valid === b.valid &&
    a.targetUnitId === b.targetUnitId &&
    a.enemyUnitId === b.enemyUnitId &&
    a.destinationLane === b.destinationLane
  );
}
/** Commit only against a still-current plan. Invalid/stale commands have no effects.
 * GameState cloning, held-card removal and Motion charge remain the caller's job.
 */
export function resolveSupportAction(
  view: SupportView,
  runtime: SupportRuntime,
  ability: SupportAbility,
  side: Side,
  lane: Lane,
  tools: SupportTools,
  expected?: SupportTargetResult,
  source?: EffectSource,
): SupportTargetResult {
  const plan = legalSupportTarget(view, runtime, ability, side, lane);
  if (!plan.valid) return plan;
  if (expected && !sameTarget(expected, plan))
    return {
      valid: false,
      error: 'Support targets changed before the action resolved',
    };
  const cause: SupportCause = {
    cardId: cardForAbility[ability],
    side,
    lane,
    ...(source ? { source: { ...source } } : {}),
  };
  const local = localUnits(view, side, lane);
  const target = view.units.find((u) => u.id === plan.targetUnitId);
  switch (ability) {
    case 'second-wind':
      tools.restoreMotion(side, 3, cause);
      break;
    case 'refund': {
      tools.restoreMotion(side, Math.min(3, local.length), cause);
      if (local.length >= 3) {
        const electric = weakest(
          view,
          local.filter((u) => view.element(u) === 'Electric'),
        );
        if (electric) tools.protect(electric, cause);
      }
      break;
    }
    case 'wrist-check':
      tools.gain(target!, 1, cause, cause.source);
      if (tools.protect(target!, cause)) {
        runtime.watches = runtime.watches.filter(
          (x) => x.targetId !== target!.id,
        );
        runtime.watches.push({ ...cause, targetId: target!.id });
      }
      break;
    case 'emergency-kit':
      tools.cleanse(target!, cause, cause.source);
      if (!runtime.kits.some((x) => x.targetId === target!.id))
        runtime.kits.push({ ...cause, targetId: target!.id });
      tools.note('EMERGENCY KIT READY', cause, target);
      break;
    case 'turn-it-up':
      for (const unit of local) tools.gain(unit, 1, cause, cause.source);
      runtime.encores = runtime.encores.filter(
        (x) => x.side !== side || x.lane !== lane,
      );
      runtime.encores.push({
        ...cause,
        expiresAt:
          (Math.floor(view.elapsedMs / SUPPORT_PULSE_MS) + 2) *
          SUPPORT_PULSE_MS,
      });
      tools.note('ENCORE READY', cause);
      break;
    case 'alternate-route':
      if (tools.move(target!, plan.destinationLane!, cause))
        tools.gain(target!, 1, cause, cause.source);
      break;
    case 'stand-firm':
      tools.gain(target!, 2, cause, cause.source);
      tools.protect(target!, cause);
      break;
    case 'side-order': {
      if (target) tools.gain(target, 2, cause, cause.source);
      const enemy = view.units.find((u) => u.id === plan.enemyUnitId);
      if (enemy) tools.strike(enemy, 2, cause);
      break;
    }
    case 'bad-intentions':
      runtime.fittedCards[fittedKey(target!)] = true;
      tools.gain(target!, 1, cause, cause.source);
      tools.protect(target!, cause);
      runtime.fittings.push({
        ...cause,
        targetId: target!.id,
        expiresAt:
          (Math.floor(view.elapsedMs / SUPPORT_PULSE_MS) + 1) *
          SUPPORT_PULSE_MS,
      });
      break;
    case 'marked-territory':
      runtime.territory.push(cause);
      tools.note('TERRITORY MARKED', cause);
      break;
  }
  return plan;
}
/** Invoke only when personal Protection actually blocks, never for immunity or Side Eye. */
export function supportProtectionConsumed(
  runtime: SupportRuntime,
  target: Unit,
  tools: SupportTools,
): void {
  const watch = runtime.watches.find((x) => x.targetId === target.id);
  if (!watch) return;
  runtime.watches = runtime.watches.filter((x) => x !== watch);
  if (target.hands > 0) tools.gain(target, 2, watch, watch.source);
}
/** Invoke after hostile defenses and before damage/lethal resolution, only for
 * positive damage from the other side. Return the prevented portion, not damage.
 */
export function supportPreventEnemyDamage(
  runtime: SupportRuntime,
  target: Unit,
  incoming: number,
): number {
  if (!Number.isFinite(incoming) || incoming <= 0 || target.hands <= 0)
    return 0;
  const kit = runtime.kits.find((x) => x.targetId === target.id);
  if (!kit) return 0;
  runtime.kits = runtime.kits.filter((x) => x !== kit);
  return Math.min(2, incoming);
}
/** Movement means a successful lateral lane change; deployments/marching do not count. */
export function supportSuccessfulMove(
  view: SupportView,
  runtime: SupportRuntime,
  unit: Unit,
  tools: SupportTools,
): void {
  const fitting = runtime.fittings.find((x) => x.targetId === unit.id);
  if (fitting) {
    runtime.fittings = runtime.fittings.filter((x) => x !== fitting);
    if (fitting.expiresAt > view.elapsedMs && unit.hands > 0)
      tools.gain(unit, 1, fitting, fitting.source);
  }
  const encore = runtime.encores.find(
    (x) =>
      x.side === unit.side &&
      x.lane === unit.lane &&
      x.expiresAt > view.elapsedMs,
  );
  if (encore && unit.hands > 0) {
    runtime.encores = runtime.encores.filter((x) => x !== encore);
    tools.gain(unit, 1, encore, encore.source);
  }
}
/** Run once for the paid character, before its entrance ability. Summons and
 * lateral movement are not paid character deployments and cannot consume this.
 */
export function supportCharacterDeployed(
  view: SupportView,
  runtime: SupportRuntime,
  unit: Unit,
  tools: SupportTools,
): void {
  const mark = runtime.territory.find(
    (x) => x.side === unit.side && x.lane === unit.lane,
  );
  if (!mark || unit.hands <= 0) return;
  runtime.territory = runtime.territory.filter((x) => x !== mark);
  const colors = { blue: 0, red: 0 };
  for (const other of localUnits(view, unit.side, unit.lane)) {
    if (other.id === unit.id) continue;
    const color = view.gangColor(other);
    if (color) colors[color]++;
  }
  if (colors.blue !== colors.red)
    tools.setGangColor(unit, colors.blue > colors.red ? 'blue' : 'red', mark);
  tools.gain(unit, 2, mark, mark.source);
}
/** Dead-target contracts end with that unit; lane contracts survive their source.
 * Per-match fitting receipts deliberately survive death and redeployment.
 */
export function pruneSupportRuntime(
  view: SupportView,
  runtime: SupportRuntime,
): void {
  const present = new Set(
    view.units.filter((u) => u.hands > 0).map((u) => u.id),
  );
  runtime.watches = runtime.watches.filter((x) => present.has(x.targetId));
  runtime.kits = runtime.kits.filter((x) => present.has(x.targetId));
  runtime.fittings = runtime.fittings.filter(
    (x) => present.has(x.targetId) && x.expiresAt > view.elapsedMs,
  );
  runtime.encores = runtime.encores.filter((x) => x.expiresAt > view.elapsedMs);
}
