import { useEffect, useRef } from 'react';
import { getAssetUrl } from '../lib/assets';
import { cardMotionReduced } from '../lib/cardFinish';
import { detectGPUQuality, type GPUQuality } from '../lib/gpuQuality';
import type { CardVariantKind } from './CardVariantTreatment';

type FoilModule = { mountFoil: (host: HTMLElement, tier: number, variant: CardVariantKind | null | undefined, quality: GPUQuality) => () => void };
let modulePromise: Promise<FoilModule> | undefined;
const waiting = new Map<Element, () => void>();
let visibility: IntersectionObserver | undefined;
const settingsListeners = new Set<() => void>();
let settingsObserver: MutationObserver | undefined;
let motionMedia: MediaQueryList | undefined;
const updateSettings = () => settingsListeners.forEach(listener => listener());
function subscribeSettings(listener: () => void) {
  if (!settingsListeners.size) {
    motionMedia = window.matchMedia('(prefers-reduced-motion: reduce)');
    motionMedia.addEventListener('change', updateSettings);
    settingsObserver = new MutationObserver(updateSettings);
    settingsObserver.observe(document.documentElement, {
      attributes: true, attributeFilter: ['data-reduce-motion', 'data-reduced-motion', 'data-depth'],
    });
  }
  settingsListeners.add(listener);
  return () => {
    settingsListeners.delete(listener);
    if (!settingsListeners.size) {
      settingsObserver?.disconnect(); settingsObserver = undefined;
      motionMedia?.removeEventListener('change', updateSettings); motionMedia = undefined;
    }
  };
}
function watch(element: Element, onVisible: () => void) {
  visibility ??= new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) {
      const callback = waiting.get(entry.target);
      if (callback) {
        visibility?.unobserve(entry.target);
        waiting.delete(entry.target);
        callback();
      }
    }
  });
  waiting.set(element, onVisible);
  visibility.observe(element);
  return () => {
    waiting.delete(element);
    visibility?.unobserve(element);
    if (!waiting.size) { visibility?.disconnect(); visibility = undefined; }
  };
}

function lowEndDevice() {
  // An explicit light-depth preference overrides the session GPU tier.
  return document.documentElement.dataset.depth === 'lite';
}

/** Visible cards share one lazily imported GPU renderer; CSS is always the fallback. */
export function CardFoil({ tier, variant }: { tier: number; variant?: CardVariantKind | null }) {
  const host = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let disposed = false, generation = 0;
    let cleanup: (() => void) | undefined;
    let unwatch: (() => void) | undefined;
    let fallback: boolean | undefined;
    const sync = () => {
      const next = cardMotionReduced() || lowEndDevice();
      if (next === fallback) return;
      fallback = next;
      const current = ++generation;
      unwatch?.(); unwatch = undefined;
      cleanup?.(); cleanup = undefined;
      element.dataset.foilRenderer = 'css';
      if (next) return;
      unwatch = watch(element, () => {
        detectGPUQuality().then(quality => {
          if (quality.tier === 'static' || disposed || current !== generation) return;
          // Version the public module independently of application chunks / service worker.
          const url = new URL(getAssetUrl('scenes/cards/foil.js?v=shared-atlas-gpu-1'), window.location.href).href;
          modulePromise ??= import(/* @vite-ignore */ url).catch(error => { modulePromise = undefined; throw error; });
          return modulePromise.then(module => {
            if (!disposed && current === generation && !cardMotionReduced() && !lowEndDevice())
              cleanup = module.mountFoil(element, tier, variant, quality);
          });
        }).catch((error: unknown) => {
          if (import.meta.env.DEV) console.debug('Card foil fallback:', error);
        });
      });
    };
    const unsubscribe = subscribeSettings(sync);
    sync();
    return () => { disposed = true; generation++; unwatch?.(); cleanup?.(); unsubscribe(); };
  }, [tier, variant]);
  return <span ref={host} className="collector-webgl" aria-hidden="true" />;
}
