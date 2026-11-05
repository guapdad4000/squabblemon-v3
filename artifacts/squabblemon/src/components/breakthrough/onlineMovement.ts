/** Bridge sparse live snapshots with bounded CSS interpolation. No prediction, simulation,
 * frame-level React renders or extra network requests. Bursts do not collapse the tween;
 * a reconnect snaps to current truth instead of animating several seconds of catch-up. */
export class OnlineMovementCadence {
  private elapsed: number | null = null;
  private arrived = 0;
  private duration = 200;
  receive(elapsed: number, arrived: number): number {
    if (this.elapsed === elapsed) return this.duration;
    const serverGap = this.elapsed === null ? 200 : elapsed - this.elapsed;
    const arrivalGap = this.elapsed === null ? 200 : arrived - this.arrived;
    this.elapsed = elapsed;
    this.arrived = arrived;
    this.duration = serverGap < 0 || serverGap > 1000 || arrivalGap > 1000
      ? 0 : Math.max(200, Math.min(400, Math.max(serverGap, arrivalGap)));
    return this.duration;
  }
}
