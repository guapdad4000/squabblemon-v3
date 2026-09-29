export const HOMIES_CATEGORIES = [
  'menu_refresh',
  'social_read',
  'social_write',
  'social_throttle',
  'joined_room',
  'unclaimed_room',
  'room_access',
] as const;

export type HomiesCategory = (typeof HOMIES_CATEGORIES)[number];

export const HOMIES_OPERATIONS = [
  'menu_refresh',
  'lookup',
  'throttle_lookup',
  'throttle_mutate',
  'relationship_write',
  'invitation_send',
  'invitation_read',
  'invitation_write',
  'room_read',
  'room_join',
  'room_command',
] as const;

export type HomiesOperation = (typeof HOMIES_OPERATIONS)[number];
export type HomiesOutcome = 'ok' | 'rejected' | 'error';

export interface HomiesMeasurement {
  category: HomiesCategory;
  operation: HomiesOperation;
  outcome: HomiesOutcome;
  operationMs: number;
  transactions: number;
  retries: number;
  checkoutCount: number;
  checkoutErrors: number;
  checkoutTotalMs: number;
  checkoutMaxMs: number;
  poolWaitingPeak: number;
  socialLockAttempts: number;
  socialLockAcquired: number;
  socialLockWaitTotalMs: number;
  socialLockWaitMaxMs: number;
  socialLockHoldTotalMs: number;
  socialLockHoldMaxMs: number;
}

export const HOMIES_DIAGNOSTIC_WINDOW_MS = 60_000;
export const HOMIES_WARNING_THRESHOLDS = {
  checkoutMs: 100,
  socialLockWaitMs: 100,
  socialLockHoldMs: 100,
  joinedOperationMs: 400,
  otherOperationMs: 750,
} as const;

export type HomiesWarning = 'checkout' | 'social_lock_wait' | 'social_lock_hold' | 'operation';

export interface HomiesDiagnosticEvent extends HomiesMeasurement {
  event: 'homies_diagnostic';
  schemaVersion: 1;
  sampleRate: number;
  warnings: HomiesWarning[];
  suppressedNormal: number;
  suppressedWarnings: number;
}

export function parseHomiesSampleRate(value: string | undefined): number {
  if (value === undefined || value.trim() === '') return 0;
  const rate = Number(value);
  return Number.isFinite(rate) && rate >= 0 && rate <= 1 ? rate : 0;
}

const categories: ReadonlySet<string> = new Set(HOMIES_CATEGORIES);
const operations: ReadonlySet<string> = new Set(HOMIES_OPERATIONS);
const outcomes: ReadonlySet<string> = new Set(['ok', 'rejected', 'error']);

const numericFields = [
  'operationMs',
  'transactions',
  'retries',
  'checkoutCount',
  'checkoutErrors',
  'checkoutTotalMs',
  'checkoutMaxMs',
  'poolWaitingPeak',
  'socialLockAttempts',
  'socialLockAcquired',
  'socialLockWaitTotalMs',
  'socialLockWaitMaxMs',
  'socialLockHoldTotalMs',
  'socialLockHoldMaxMs',
] as const satisfies readonly (keyof HomiesMeasurement)[];

type WindowState = {
  start: number | undefined;
  normal: number;
  warning: number;
  suppressedNormal: number;
  suppressedWarnings: number;
};

export function createHomiesDiagnosticsReporter(options: {
  sampleRate: number;
  emit: (level: 'info' | 'warn', event: HomiesDiagnosticEvent) => void;
  now?: () => number;
}): { record(sample: HomiesMeasurement): void } {
  const states = new Map<HomiesCategory, WindowState>(
    HOMIES_CATEGORIES.map(category => [category, {
      start: undefined,
      normal: 0,
      warning: 0,
      suppressedNormal: 0,
      suppressedWarnings: 0,
    }]),
  );
  const sampleRate = options.sampleRate;
  const now = options.now ?? (() => performance.now());

  return {
    record(sample) {
      try {
        if (!Number.isFinite(sampleRate) || sampleRate <= 0 || sampleRate > 1) return;
        if (typeof sample !== 'object' || sample === null) return;
        const category = sample.category;
        const operation = sample.operation;
        const outcome = sample.outcome;
        if (!categories.has(category) || !operations.has(operation) || !outcomes.has(outcome)) return;

        // Snapshot only known scalar fields. Never forward the caller's object to a sink.
        const values = {} as Pick<HomiesMeasurement, (typeof numericFields)[number]>;
        for (const field of numericFields) {
          const value = sample[field];
          if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return;
          values[field] = value;
        }
        const timestamp = now();
        if (!Number.isFinite(timestamp)) return;
        const state = states.get(category);
        if (!state) return;
        if (state.start === undefined || timestamp - state.start >= HOMIES_DIAGNOSTIC_WINDOW_MS) {
          state.start = timestamp;
          state.normal = 0;
          state.warning = 0;
        }

        const warnings: HomiesWarning[] = [];
        if (values.checkoutMaxMs >= HOMIES_WARNING_THRESHOLDS.checkoutMs) warnings.push('checkout');
        if (values.socialLockWaitMaxMs >= HOMIES_WARNING_THRESHOLDS.socialLockWaitMs) warnings.push('social_lock_wait');
        if (values.socialLockHoldMaxMs >= HOMIES_WARNING_THRESHOLDS.socialLockHoldMs) warnings.push('social_lock_hold');
        if (values.operationMs >= (category === 'joined_room'
          ? HOMIES_WARNING_THRESHOLDS.joinedOperationMs
          : HOMIES_WARNING_THRESHOLDS.otherOperationMs)) warnings.push('operation');

        const warning = warnings.length > 0;
        if (warning ? state.warning >= 2 : state.normal >= 2) {
          if (warning) state.suppressedWarnings++;
          else state.suppressedNormal++;
          return;
        }
        // Spend the budget before invoking user code, even if the sink throws.
        if (warning) state.warning++;
        else state.normal++;

        const event: HomiesDiagnosticEvent = {
          event: 'homies_diagnostic',
          schemaVersion: 1,
          category,
          operation,
          outcome,
          operationMs: values.operationMs,
          transactions: values.transactions,
          retries: values.retries,
          checkoutCount: values.checkoutCount,
          checkoutErrors: values.checkoutErrors,
          checkoutTotalMs: values.checkoutTotalMs,
          checkoutMaxMs: values.checkoutMaxMs,
          poolWaitingPeak: values.poolWaitingPeak,
          socialLockAttempts: values.socialLockAttempts,
          socialLockAcquired: values.socialLockAcquired,
          socialLockWaitTotalMs: values.socialLockWaitTotalMs,
          socialLockWaitMaxMs: values.socialLockWaitMaxMs,
          socialLockHoldTotalMs: values.socialLockHoldTotalMs,
          socialLockHoldMaxMs: values.socialLockHoldMaxMs,
          sampleRate,
          warnings,
          suppressedNormal: state.suppressedNormal,
          suppressedWarnings: state.suppressedWarnings,
        };
        options.emit(warning ? 'warn' : 'info', event);
        state.suppressedNormal = 0;
        state.suppressedWarnings = 0;
      } catch {
        // Diagnostics must never affect the request they observe.
      }
    },
  };
}