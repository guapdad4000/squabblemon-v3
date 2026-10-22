const subscribers = new Set<() => void>();
let query: MediaQueryList | undefined;
let preferenceObserver: MutationObserver | undefined;
const notify = () => subscribers.forEach(listener => listener());
function animationAllowed() {
  if (typeof window === 'undefined') return false;
  const root = document.documentElement;
  return !document.hidden && !(query ?? window.matchMedia('(prefers-reduced-motion: reduce)')).matches
    && root.dataset.reduceMotion !== 'true' && root.dataset.reducedMotion !== 'true';
}
function subscribe(listener: () => void) {
  subscribers.add(listener);
  if (subscribers.size === 1) {
    query = window.matchMedia('(prefers-reduced-motion: reduce)');
    query.addEventListener('change', notify);
    document.addEventListener('visibilitychange', notify);
    preferenceObserver = new MutationObserver(notify);
    preferenceObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-reduce-motion', 'data-reduced-motion'] });
  }
  return () => {
    subscribers.delete(listener);
    if (!subscribers.size) {
      query?.removeEventListener('change', notify);
      document.removeEventListener('visibilitychange', notify);
      preferenceObserver?.disconnect(); preferenceObserver = undefined; query = undefined;
    }
  };
}

const visibilityCallbacks = new Map<Element, (visible: boolean) => void>();
let visibility: IntersectionObserver | undefined;
function observeVisibility(node: Element, update: (visible: boolean) => void) {
  if (typeof IntersectionObserver === 'undefined') { update(true); return () => {}; }
  visibility ??= new IntersectionObserver(entries => {
    entries.forEach(entry => visibilityCallbacks.get(entry.target)?.(entry.isIntersecting));
  });
  visibilityCallbacks.set(node, update); visibility.observe(node);
  return () => {
    visibility?.unobserve(node); visibilityCallbacks.delete(node);
    if (!visibilityCallbacks.size) { visibility?.disconnect(); visibility = undefined; }
  };
}

export function observePlayback(node: Element, update: (moving: boolean) => void) {
  let visible = false;
  const refresh = () => update(visible && animationAllowed());
  const stopPreferences = subscribe(refresh);
  const stopVisibility = observeVisibility(node, value => { visible = value; refresh(); });
  refresh();
  return () => { stopVisibility(); stopPreferences(); };
}
