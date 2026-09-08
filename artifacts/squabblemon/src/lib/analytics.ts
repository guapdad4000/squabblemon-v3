export type AnalyticsData = Record<string, string | number | boolean>;

type AnalyticsValue = AnalyticsData[string];
type ValueValidator = (value: AnalyticsValue) => boolean;

const isFiniteNumber: ValueValidator = value => typeof value === 'number' && Number.isFinite(value);
const isBoolean: ValueValidator = value => typeof value === 'boolean';
const oneOf = <T extends AnalyticsValue>(...allowed: T[]): ValueValidator =>
  value => allowed.includes(value as T);

const decisionTime = oneOf('under_3s', '3_to_8s', '8_to_15s', '15s_or_more');

const battleEventSchemas = {
  battle_card_selection_backed_out: {
    round: isFiniteNumber,
    action: oneOf('deselect', 'replace'),
    had_district: isBoolean,
    squabble_armed: isBoolean,
    decision_time: decisionTime,
  },
  battle_unavailable_card_selected: {
    round: isFiniteNumber,
    motion: isFiniteNumber,
    locked_districts: isFiniteNumber,
    reason: oneOf('all_districts_locked', 'insufficient_motion'),
    decision_time: decisionTime,
  },
  battle_district_selected: {
    round: isFiniteNumber,
    district: isFiniteNumber,
    changed: isBoolean,
    decision_time: decisionTime,
  },
  battle_squabble_toggled: {
    round: isFiniteNumber,
    action: oneOf('arm', 'cancel'),
    decision_time: decisionTime,
  },
  battle_history_opened: {
    round: isFiniteNumber,
    entries: isFiniteNumber,
    decision_time: decisionTime,
  },
  battle_turn_committed: {
    round: isFiniteNumber,
    action: oneOf('lock_in', 'pass'),
    automatic: isBoolean,
    squabble: isBoolean,
    decision_time: decisionTime,
    district: isFiniteNumber,
  },
  battle_fast_forwarded: {
    round: isFiniteNumber,
    phase: oneOf(
      'versus', 'countdown-3', 'countdown-2', 'countdown-1', 'squabble', 'deal',
      'round-intro', 'lock-in', 'player-ready', 'player-travel', 'player-reveal',
      'player-focus', 'player-slam', 'player-impact', 'effects', 'player-pass',
      'rival-thinking', 'rival-travel', 'rival-reveal', 'rival-focus', 'rival-slam',
      'rival-impact', 'rival-pass', 'district-flipped', 'round-result', 'match-finish',
    ),
  },
} satisfies Record<string, Record<string, ValueValidator>>;

export type BattleAnalyticsEventName = keyof typeof battleEventSchemas;

/**
 * Replit injects Umami into published website artifacts when Project Analytics
 * is enabled in Publishing settings. The app must not ship its own tracker
 * script, website ID, endpoint, or analytics environment variables.
 */
declare global {
  interface Window {
    umami?: {
      track(name: string, data?: AnalyticsData): void;
    };
  }
}

export function decisionTimeBucket(startedAt: number, now = Date.now()): string {
  const elapsedSeconds = Math.max(0, now - startedAt) / 1000;
  if (elapsedSeconds < 3) return 'under_3s';
  if (elapsedSeconds < 8) return '3_to_8s';
  if (elapsedSeconds < 15) return '8_to_15s';
  return '15s_or_more';
}

export function trackEvent(name: BattleAnalyticsEventName, data?: AnalyticsData): void {
  if (typeof window === 'undefined') return;

  try {
    const schema: Record<string, ValueValidator> = battleEventSchemas[name];
    const sanitized = data && Object.fromEntries(
      Object.entries(data).filter(([key, value]) => schema[key]?.(value)),
    );
    window.umami?.track(name, sanitized);
  } catch {
    // Analytics is optional and must never affect gameplay.
  }
}