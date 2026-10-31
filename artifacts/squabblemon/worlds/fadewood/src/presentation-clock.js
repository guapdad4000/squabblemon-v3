/** Cinematics follow monotonic wall time; movement keeps its fixed-step budget.
 * Reset on the actual travel intent so a slow preceding frame is never charged
 * to a trip that had not started yet. Hidden/paused trips are cancelled by host. */
export function createPresentationClock() {
  let previous = null;
  return {
    reset(now) { previous = Number.isFinite(now) ? now : null; },
    sample(now) {
      if (!Number.isFinite(now)) return 0;
      if (previous === null) { previous = now; return 0; }
      const elapsed = Math.max(0, (now - previous) / 1000);
      previous = Math.max(previous, now);
      return elapsed;
    },
  };
}
