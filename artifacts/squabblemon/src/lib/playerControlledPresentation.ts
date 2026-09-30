/** Reading is a player decision, not an animation timer. */
export class PresentationReadingGate {
  private pending: { key: string; resolve: (continued: boolean) => void } | null = null;

  hold(key: string): Promise<boolean> {
    this.cancel();
    return new Promise(resolve => { this.pending = { key, resolve }; });
  }

  continue(key: string): boolean {
    if (this.pending?.key !== key) return false;
    const { resolve } = this.pending;
    this.pending = null;
    resolve(true);
    return true;
  }

  cancel(): void {
    const pending = this.pending;
    this.pending = null;
    pending?.resolve(false);
  }
}

/**
 * Share pending and successful submissions. A failed save may be retried with
 * the same server match ID; server-side reward idempotency remains authoritative.
 */
export class MatchCompletionGate {
  private submissions = new Map<string, Promise<void>>();

  run(matchId: string, submit: () => Promise<void>): Promise<void> {
    const existing = this.submissions.get(matchId);
    if (existing) return existing;
    const submission = Promise.resolve().then(submit).catch(error => {
      if (this.submissions.get(matchId) === submission) this.submissions.delete(matchId);
      throw error;
    });
    this.submissions.set(matchId, submission);
    return submission;
  }
}

export type GuidedReadingCue = {
  key: string;
  kind: 'event' | 'round';
  title: string;
  body: string;
  continueLabel: string;
};

/** Reduced motion changes animation, never the time available to read a note. */
export function guidedNoteDuration(note: string, animationMs: number): number {
  const words = note.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(animationMs, Math.min(6500, 1400 + words * 180));
}