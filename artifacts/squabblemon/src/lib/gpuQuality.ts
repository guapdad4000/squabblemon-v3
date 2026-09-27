import { getAssetUrl } from './assets';

export type GPUTier = 'static' | 'low' | 'medium' | 'high';
export type GPUQuality = { tier: GPUTier; pixelRatio: number; shadows: boolean; outlines: boolean; particleDensity: number; fps: number };
type Detector = { detectGPUQuality: () => Promise<GPUQuality>; gpuQuality: (tier?: GPUTier) => GPUQuality };
let modulePromise: Promise<Detector> | undefined;
function detector() {
  return modulePromise ??= import(/* @vite-ignore */ new URL(getAssetUrl('scenes/shared/gpu-quality.js'), window.location.href).href) as Promise<Detector>;
}
export async function detectGPUQuality() { return (await detector()).detectGPUQuality(); }
export async function currentGPUQuality() { return (await detector()).gpuQuality(); }