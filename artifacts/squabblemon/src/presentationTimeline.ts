export type TimerHandle = ReturnType<typeof setTimeout>;
type Schedule = (callback: () => void, delay: number) => TimerHandle;
type Cancel = (handle: TimerHandle) => void;

/**
 * Owns every presentation delay so a skip, replay, navigation, or unmount can
 * invalidate the complete sequence without leaving unresolved callbacks.
 */
export class PresentationTimeline {
  private generation = 0;
  private pending = new Map<TimerHandle, (completed: boolean) => void>();

  constructor(
    private readonly schedule: Schedule = (callback, delay) => setTimeout(callback, delay),
    private readonly cancel: Cancel = handle => clearTimeout(handle),
  ) {}

  get id() {
    return this.generation;
  }

  wait(delay: number, id = this.generation): Promise<boolean> {
    return new Promise(resolve => {
      const handle = this.schedule(() => {
        this.pending.delete(handle);
        resolve(id === this.generation);
      }, delay);
      this.pending.set(handle, resolve);
    });
  }

  cancelAll() {
    this.generation += 1;
    for (const [handle, resolve] of this.pending) {
      this.cancel(handle);
      resolve(false);
    }
    this.pending.clear();
    return this.generation;
  }
}