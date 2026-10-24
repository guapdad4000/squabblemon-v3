/** Mirror of public/scenes/gym/finale.js; the scene and UI contract has a parity test. */
export const PACK_GYM_FINALE_TIMING = { compression: 0, contact: 90, release: 230, flight: 350, pov: 1250, impact: 2650, settle: 5317, single: 5317, ten: 5317, reduced: 220 } as const;
/** Mirror of the public scene contract; colors are verified against the card catalog. */
export const PACK_GYM_RARITY_FLIGHT = {
  SuperCommon: { distance: 16, color: '#cbb99c', label: 'Super Common' },
  Common: { distance: 20, color: '#a8ada9', label: 'Common' },
  Uncommon: { distance: 23, color: '#4ade80', label: 'Uncommon' },
  Rare: { distance: 26, color: '#3b82f6', label: 'Rare' },
  Epic: { distance: 30, color: '#a855f7', label: 'Super Rare' },
  Legendary: { distance: 34, color: '#eab308', label: 'Legendary' },
  Mythical: { distance: 38, color: '#ef4444', label: 'Mythical' },
} as const;
export type PackGymRarity = keyof typeof PACK_GYM_RARITY_FLIGHT;
export function normalizePackGymRarity(value: unknown): PackGymRarity {
  return typeof value === 'string' && Object.hasOwn(PACK_GYM_RARITY_FLIGHT, value) ? value as PackGymRarity : 'Common';
}
/** Only the selected opening's media is requested when a pull is armed. */
export function packGymFinaleArt(pullCount: number) {
  const base = 'brand/gacha/cinematic-v2/', beats = 'brand/gacha/rarity-flight-v1/';
  return { compression: `${beats}compression.webp`, contact: `${base}contact.webp`, release: `${beats}release.webp`,
    arrival: `${base}single-arrival-wall-v2.webp`,
    foreground: pullCount === 10 ? `${base}burst-foreground.webp` : null };
}
/** These are curated fixed-bottom POV cuts, never the detached-ball sections. */
export function packGymFinaleMedia(rarity: unknown) {
  const colors = { SuperCommon: 'neutral', Common: 'neutral', Uncommon: 'green', Rare: 'blue', Epic: 'purple', Legendary: 'yellow', Mythical: 'red' } as const;
  const base = 'brand/gacha/video-flight-v1/';
  const pov = `${base}pov-${colors[normalizePackGymRarity(rarity)]}`;
  return { pov: { src: `${pov}.mp4`, poster: `${pov}.webp`, start: PACK_GYM_FINALE_TIMING.pov, duration: 1.4 },
    landing: { src: `${base}landing.mp4`, poster: 'brand/gacha/cinematic-v2/single-arrival-wall-v2.webp', start: PACK_GYM_FINALE_TIMING.impact, duration: 80 / 30 } };
}
export type PackGymFinaleStage = 'compression' | 'contact' | 'release' | 'flight' | 'flight-pov' | 'impact' | 'settle' | 'done';
export function packGymFinaleSpeed(speed: number) { return Number.isFinite(speed) ? Math.max(.5, Math.min(1.25, speed)) : 1; }
export function packGymFinaleDuration(pullCount: number, reduced = false) { return reduced ? PACK_GYM_FINALE_TIMING.reduced : pullCount === 10 ? PACK_GYM_FINALE_TIMING.ten : PACK_GYM_FINALE_TIMING.single; }
export type FinaleClock = { now: () => number; schedule: (callback: () => void, delay: number) => unknown; cancel: (handle: unknown) => void };
/** Finite stage timers only; no React or DOM work runs on animation frames. */
export function startPackGymFinale({ pullCount, reduced = false, speed = 1, clock, onStage, onComplete }: {
  pullCount: number; reduced?: boolean; speed?: number; clock: FinaleClock;
  onStage: (stage: PackGymFinaleStage) => void; onComplete: () => void;
}) {
  const rate = packGymFinaleSpeed(speed), duration = packGymFinaleDuration(pullCount, reduced);
  const timing = PACK_GYM_FINALE_TIMING;
  const stages: [number, PackGymFinaleStage][] = reduced ? [[0, 'settle'], [duration, 'done']] : [
    [0, 'compression'], [timing.contact, 'contact'], [timing.release, 'release'], [timing.flight, 'flight'],
    [timing.pov, 'flight-pov'], [timing.impact, 'impact'], [timing.settle, 'settle'], [duration, 'done'],
  ];
  let elapsed = 0, started = clock.now(), paused = false, stopped = false, next = 0, timer: unknown;
  const current = () => elapsed + (paused ? 0 : Math.max(0, clock.now() - started) * rate);
  const tick = () => {
    timer = undefined;
    if (paused || stopped) return;
    const now = current();
    while (next < stages.length && stages[next][0] <= now) {
      const stage = stages[next++][1]; onStage(stage);
      if (stage === 'done') { stopped = true; onComplete(); return; }
    }
    timer = clock.schedule(tick, Math.max(0, (stages[next][0] - now) / rate));
  };
  tick();
  return {
    elapsed: current,
    pause() { if (stopped || paused) return; elapsed = current(); paused = true; if (timer !== undefined) clock.cancel(timer); timer = undefined; },
    resume() { if (stopped || !paused) return; paused = false; started = clock.now(); tick(); },
    cancel() { stopped = true; if (timer !== undefined) clock.cancel(timer); timer = undefined; },
  };
}
