import { cardMotionReduced } from './cardFinish';

/**
 * One device-wide depth budget for card tilt, reveal flips and lobby parallax.
 * `off` for reduced motion, `lite` for low-power hardware, `full` otherwise.
 * Exposed as `html[data-depth]` so CSS can scale without React re-renders.
 */
export type DepthQuality = 'off' | 'lite' | 'full';

export function detectDepthQuality(): DepthQuality {
  if (typeof window === 'undefined') return 'off';
  if (cardMotionReduced()) return 'off';
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  const cores = nav.hardwareConcurrency ?? 8;
  const memory = nav.deviceMemory ?? 8;
  if (nav.connection?.saveData || cores <= 4 || memory <= 3) return 'lite';
  return 'full';
}

let started = false;
const listeners = new Set<(quality: DepthQuality) => void>();

export function currentDepthQuality(): DepthQuality {
  return (document.documentElement.dataset.depth as DepthQuality | undefined) ?? detectDepthQuality();
}

export function subscribeDepthQuality(listener: (quality: DepthQuality) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Installs the depth budget and the shared gyroscope feed once per page. */
export function startDepthSystem() {
  if (started || typeof window === 'undefined') return;
  started = true;
  const root = document.documentElement;
  const apply = () => {
    const next = detectDepthQuality();
    if (root.dataset.depth === next) return;
    root.dataset.depth = next;
    listeners.forEach((listener) => listener(next));
    if (next !== 'full') stopGyro();
  };
  apply();
  window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', apply);
  new MutationObserver(apply).observe(root, { attributes: true, attributeFilter: ['data-reduce-motion', 'data-reduced-motion'] });
  // Frame-time watchdog: a sustained slow first few seconds demotes full → lite.
  let frames = 0, slow = 0, previous = performance.now();
  const sample = (now: number) => {
    const delta = now - previous; previous = now;
    if (!document.hidden) { frames += 1; if (delta > 34) slow += 1; }
    if (frames < 150) requestAnimationFrame(sample);
    else if (slow / frames > 0.3 && root.dataset.depth === 'full') {
      root.dataset.depth = 'lite';
      stopGyro();
      listeners.forEach((listener) => listener('lite'));
    }
  };
  requestAnimationFrame(sample);
  tryStartGyro(false);
}

let gyroOn = false;
let gyroFrame = 0;
let pending: { x: number; y: number } | null = null;
let lastGyro = { x: '', y: '' };
/** Latest quantized device angle for canvas consumers (not written to <html>). */
export const currentGyro = () => ({ x: parseFloat(lastGyro.x) || 0, y: parseFloat(lastGyro.y) || 0 });
const orient = (event: DeviceOrientationEvent) => {
  if (event.beta == null || event.gamma == null) return;
  // Relative to a comfortable ~40° reading angle; clamp to ±1.
  const x = Math.max(-1, Math.min(1, event.gamma / 25));
  const y = Math.max(-1, Math.min(1, (event.beta - 40) / 25));
  pending = { x, y };
  if (!gyroFrame) gyroFrame = requestAnimationFrame(() => {
    gyroFrame = 0;
    if (!pending) return;
    const root = document.documentElement;
    // Quantize and scope: writing custom properties on <html> restyles the entire
    // document every frame (very costly on iPad). Only live, featured cards follow
    // the device angle; background cards keep their resting finish.
    const x = pending.x.toFixed(2), y = pending.y.toFixed(2);
    root.dataset.gyro = 'on';
    if (x === lastGyro.x && y === lastGyro.y) return;
    lastGyro = { x, y };
    document.querySelectorAll<HTMLElement>('.collector-card[data-live-finish]').forEach(card => {
      card.style.setProperty('--gyro-x', x);
      card.style.setProperty('--gyro-y', y);
    });
  });
};

function stopGyro() {
  if (!gyroOn) return;
  gyroOn = false;
  window.removeEventListener('deviceorientation', orient);
  cancelAnimationFrame(gyroFrame); gyroFrame = 0;
  delete document.documentElement.dataset.gyro;
}

type PermissionedOrientation = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<'granted' | 'denied'> };

/** iOS requires a user gesture; call with `fromGesture` from a tap on a card. */
export function tryStartGyro(fromGesture: boolean) {
  if (gyroOn || typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) return;
  if (document.documentElement.dataset.depth !== 'full') return;
  if (!window.matchMedia('(pointer: coarse)').matches) return;
  const ctor = window.DeviceOrientationEvent as PermissionedOrientation;
  const listen = () => { gyroOn = true; window.addEventListener('deviceorientation', orient); };
  if (typeof ctor.requestPermission === 'function') {
    if (!fromGesture) return;
    ctor.requestPermission().then((state) => { if (state === 'granted') listen(); }).catch(() => {});
  } else listen();
}
