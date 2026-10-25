/** Lossless JSON replay snapshots. Deltas are private persistence/worker data;
 * presentation consumers always receive the original before/after contract. */
type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type Delta = [0, Json] | [1, Record<string, Delta>, string[], number?];
const defineJsonKey = (object: object, key: string, value: unknown) => {
  if (key === '__proto__') Object.defineProperty(object, key, { value, enumerable: true, configurable: true, writable: true });
  else (object as Record<string, unknown>)[key] = value;
};

/** Defensive JSON clone which shares equal subtrees only with a prior snapshot.
 * Never shares mutable engine inputs, including when a caller mutates in place. */
export function shareReplaySnapshot<T>(value: T, previous?: T): T {
  if (typeof value === 'bigint') throw new TypeError('Replay snapshots require JSON values');
  if (typeof value === 'number') return (Number.isFinite(value) ? (value === 0 ? 0 : value) : null) as T;
  if (value === null || typeof value !== 'object') return value;
  if (typeof (value as any).toJSON === 'function') return shareReplaySnapshot((value as any).toJSON(), previous);
  const array = Array.isArray(value);
  const old = previous && typeof previous === 'object' && Array.isArray(previous) === array ? previous : undefined;
  const keys = array ? Array.from({ length: (value as any[]).length }, (_, index) => String(index))
    : Object.keys(value as object).filter(key => !['undefined', 'function', 'symbol'].includes(typeof (value as any)[key]));
  let result: any = old;
  if (!old || Object.keys(old).length !== keys.length || keys.some(key => !Object.hasOwn(old, key))) result = array ? [] : {};
  for (const key of keys) {
    const raw = (value as any)[key];
    const next = shareReplaySnapshot(array && ['undefined', 'function', 'symbol'].includes(typeof raw) ? null : raw, (old as any)?.[key]);
    if (result === old && next !== (old as any)[key]) result = array ? [...(old as any)] : { ...old };
    if (result !== old) defineJsonKey(result, key, next);
  }
  return result as T;
}

function diff(previous: any, value: any): Delta | undefined {
  if (previous === value) return;
  if (value === null || typeof value !== 'object' || previous === null || typeof previous !== 'object' || Array.isArray(value) !== Array.isArray(previous)) return [0, value];
  const changes: Record<string, Delta> = Object.create(null);
  const removed = Object.keys(previous).filter(key => !Object.hasOwn(value, key));
  for (const key of Object.keys(value)) {
    if (value[key] === undefined) continue;
    const delta = diff(Object.hasOwn(previous, key) ? previous[key] : undefined, value[key]);
    if (delta) changes[key] = delta;
  }
  return Object.keys(changes).length || removed.length || (Array.isArray(value) && previous.length !== value.length)
    ? [1, changes, removed, ...(Array.isArray(value) ? [value.length] : [])] as Delta : undefined;
}
function apply(previous: any, delta: Delta | null): any {
  if (!delta) return previous;
  if (delta[0] === 0) return delta[1];
  const value = delta[3] === undefined ? { ...previous } : [...previous];
  for (const key of delta[2]) delete value[key];
  for (const [key, change] of Object.entries(delta[1])) defineJsonKey(value, key, apply(Object.hasOwn(previous ?? {}, key) ? previous[key] : undefined, change));
  if (delta[3] !== undefined) value.length = delta[3];
  return value;
}

type ReplayMatch = { effectLog: { replay: { before: any; after: any }; [key: string]: any }[] };
export type CompactReplayMatch<T> = Omit<T, 'effectLog'> & {
  effectLog: Omit<ReplayMatch['effectLog'][number], 'replay'>[];
  replayArchive: { version: 1; frames: (Delta | null)[] };
};
export function compactMatchReplay<T extends ReplayMatch>(match: T): CompactReplayMatch<T> {
  let previous: any = {};
  const frames: (Delta | null)[] = [];
  const effectLog = match.effectLog.map(({ replay, ...event }) => {
    for (const value of [replay.before, replay.after]) {
      frames.push(diff(previous, value) ?? null);
      previous = value;
    }
    return event;
  });
  return { ...match, effectLog, replayArchive: { version: 1, frames } };
}
/** Existing full snapshots remain valid. Unknown archive versions fail closed. */
export function restoreMatchReplay<T extends ReplayMatch>(input: T | CompactReplayMatch<T>): T {
  if (!('replayArchive' in input)) return input as T;
  const { replayArchive, ...match } = input as CompactReplayMatch<T>;
  if (replayArchive.version !== 1 || replayArchive.frames.length !== match.effectLog.length * 2) throw new Error('Unsupported replay archive');
  let previous: any = {};
  const effectLog = match.effectLog.map((event, index) => {
    const before = apply(previous, replayArchive.frames[index * 2]);
    const after = apply(before, replayArchive.frames[index * 2 + 1]);
    previous = after;
    return { ...event, replay: { before, after } };
  });
  return { ...match, effectLog } as unknown as T;
}
