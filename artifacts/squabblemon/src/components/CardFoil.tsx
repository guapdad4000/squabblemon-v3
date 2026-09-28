import { useEffect, useRef } from 'react';
import { getAssetUrl } from '../lib/assets';
import { cardMotionReduced } from '../lib/cardFinish';
import { detectGPUQuality, startFrameGuard, subscribeQuality, type GPUQuality } from '../lib/gpuQuality';
import type { CardVariantKind } from './CardVariantTreatment';

type FoilModule = { mountFoil: (host: HTMLElement, tier: number, variant: CardVariantKind | null | undefined, quality: GPUQuality) => () => void };
let modulePromise: Promise<FoilModule> | undefined;
const waiting = new Map<Element, (visible: boolean) => void>();
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
/** Tracks viewport membership continuously so offscreen GPU foils are paused, not just deferred. */
function watch(element: Element, onChange: (visible: boolean) => void) {
  visibility ??= new IntersectionObserver(entries => {
    for (const entry of entries) (waiting.get(entry.target) as ((visible: boolean) => void) | undefined)?.(entry.isIntersecting);
  }, { rootMargin: '48px' });
  waiting.set(element, onChange);
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

/**
 * Effect priority: only featured cards (inspector, selected, special-move sources)
 * run the live GPU foil. Every other card keeps the baked CSS finish layers
 * underneath, which read the same at a glance. Live foils pause offscreen.
 */
export function CardFoil({ tier, variant, live = false }: { tier: number; variant?: CardVariantKind | null; live?: boolean }) {
  const host = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    element.dataset.foilRenderer = 'css';
    if (!live) return;
    let disposed = false, generation = 0, visible = false;
    let cleanup: (() => void) | undefined;
    let fallback = true;
    const unmount = () => { generation++; cleanup?.(); cleanup = undefined; element.dataset.foilRenderer = 'css'; };
    const mount = () => {
      if (cleanup || fallback || !visible || disposed) return;
      const current = ++generation;
      detectGPUQuality().then(quality => {
        if (quality.tier === 'static' || disposed || current !== generation) return;
        // Version the public module independently of application chunks / service worker.
        const url = new URL(getAssetUrl('scenes/cards/foil.js?v=shared-atlas-gpu-1'), window.location.href).href;
        modulePromise ??= import(/* @vite-ignore */ url).catch(error => { modulePromise = undefined; throw error; });
        return modulePromise.then(module => {
          if (!disposed && current === generation && visible && !cardMotionReduced() && !lowEndDevice()) {
            cleanup = module.mountFoil(element, tier, variant, quality);
            startFrameGuard();
          }
        });
      }).catch((error: unknown) => {
        if (import.meta.env.DEV) console.debug('Card foil fallback:', error);
      });
    };
    const sync = () => {
      fallback = cardMotionReduced() || lowEndDevice();
      if (fallback) unmount(); else mount();
    };
    const unwatch = watch(element, next => { visible = next; if (next) mount(); else unmount(); });
    const unsubscribe = subscribeSettings(sync);
    const unquality = subscribeQuality(() => { unmount(); mount(); });
    sync();
    return () => { disposed = true; unmount(); unwatch(); unsubscribe(); unquality(); };
  }, [tier, variant, live]);
  return <span ref={host} className="collector-webgl" aria-hidden="true" />;
}
