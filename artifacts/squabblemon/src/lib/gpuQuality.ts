import { getAssetUrl } from './assets';

export type GPUTier = 'static' | 'low' | 'medium' | 'high';
export type GPUQuality = { tier: GPUTier; pixelRatio: number; shadows: boolean; outlines: boolean; particleDensity: number; fps: number };
type Detector = { detectGPUQuality: () => Promise<GPUQuality>; gpuQuality: (tier?: GPUTier) => GPUQuality };
let modulePromise: Promise<Detector> | undefined;
function detector() {
  return modulePromise ??= import(/* @vite-ignore */ new URL(getAssetUrl('scenes/shared/gpu-quality.js'), window.location.href).href) as Promise<Detector>;
}
export async function detectGPUQuality() { try { return await (await detector()).detectGPUQuality(); } catch (error) { modulePromise = undefined; throw error; } }
export async function currentGPUQuality() { return (await detector()).gpuQuality(); }
type DetectorWithDowngrade = Detector & { downgradeGPUQuality?: () => GPUQuality | null };
const qualityListeners = new Set<() => void>();
export function subscribeQuality(listener: () => void) {
  qualityListeners.add(listener);
  return () => { qualityListeners.delete(listener); };
}

let guardRunning = false;
let lastGuardAt = -Infinity;
/**
 * Devices (notably iPads) start at their detected tier and only step down when
 * frames actually drop while live effects run. One sample per 15 s at most.
 */
export function startFrameGuard() {
  if (guardRunning || typeof requestAnimationFrame !== 'function') return;
  const now = performance.now();
  if (now - lastGuardAt < 15000) return;
  guardRunning = true;
  lastGuardAt = now;
  const intervals: number[] = [];
  let previous = 0;
  const tick = (time: number) => {
    if (document.hidden) { guardRunning = false; return; }
    if (previous) intervals.push(time - previous);
    previous = time;
    if (intervals.length < 90) { requestAnimationFrame(tick); return; }
    guardRunning = false;
    const slow = intervals.filter(interval => interval > 34).length / intervals.length;
    if (slow < 0.25) return;
    void (detector() as Promise<DetectorWithDowngrade>).then(module => {
      if (module.downgradeGPUQuality?.()) qualityListeners.forEach(listener => listener());
    });
  };
  requestAnimationFrame(tick);
}
