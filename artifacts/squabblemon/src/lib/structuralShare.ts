/**
 * Returns `next`, reusing any subtree of `previous` that is deeply equal.
 * Presentation frames are rebuilt from JSON snapshots; without sharing, every
 * card object is new on every event step and every memoized card re-renders.
 */
export function shareEqual<T>(previous: unknown, next: T): T {
  if (Object.is(previous, next)) return next;
  if (typeof previous !== 'object' || typeof next !== 'object' || previous === null || next === null) return next;
  if (Array.isArray(previous) !== Array.isArray(next)) return next;
  if (Array.isArray(next)) {
    const prior = previous as unknown[];
    let same = prior.length === next.length;
    const merged = next.map((value, index) => {
      const shared = shareEqual(prior[index], value);
      if (shared !== prior[index]) same = false;
      return shared;
    });
    return (same ? prior : merged) as T;
  }
  const prior = previous as Record<string, unknown>;
  const source = next as Record<string, unknown>;
  const keys = Object.keys(source);
  let same = keys.length === Object.keys(prior).length;
  const merged: Record<string, unknown> = {};
  for (const key of keys) {
    const shared = shareEqual(prior[key], source[key]);
    if (!(key in prior) || shared !== prior[key]) same = false;
    merged[key] = shared;
  }
  return (same ? prior : merged) as T;
}
