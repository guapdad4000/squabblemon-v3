type ExitGuard = (proceed: () => void, stay: () => void) => void;
type Navigate = (to: string, options?: { replace?: boolean; state?: unknown; transition?: boolean }) => void;

let activeGuard: ExitGuard | null = null;
let bypassNextTraversal = false;
let bypassRouteGuard = 0;
const HISTORY_INDEX = '__squabblemonHistoryIndex';
let currentIndex = 0;
let restoring: { delta: number } | null = null;

if (typeof window !== 'undefined') {
  const originalPushState = history.pushState.bind(history);
  const originalReplaceState = history.replaceState.bind(history);
  const initialIndex = Number(history.state?.[HISTORY_INDEX]);
  currentIndex = Number.isFinite(initialIndex) ? initialIndex : 0;
  if (!Number.isFinite(initialIndex)) {
    originalReplaceState({ ...history.state, [HISTORY_INDEX]: currentIndex }, '', window.location.href);
  }
  history.pushState = (state, unused, url) => {
    currentIndex += 1;
    originalPushState({ ...state, [HISTORY_INDEX]: currentIndex }, unused, url);
  };
  history.replaceState = (state, unused, url) => {
    originalReplaceState({ ...state, [HISTORY_INDEX]: currentIndex }, unused, url);
  };

  window.addEventListener('popstate', (event) => {
    const nextIndex = Number(event.state?.[HISTORY_INDEX]);
    if (!Number.isFinite(nextIndex)) return;
    if (bypassNextTraversal) {
      bypassNextTraversal = false;
      currentIndex = nextIndex;
      return;
    }
    if (restoring) {
      const { delta } = restoring;
      restoring = null;
      currentIndex = nextIndex;
      activeGuard?.(
        () => {
          bypassNextTraversal = true;
          history.go(delta);
        },
        () => {},
      );
      return;
    }
    if (!activeGuard) {
      currentIndex = nextIndex;
      return;
    }
    const delta = nextIndex - currentIndex;
    if (!delta) return;
    event.stopImmediatePropagation();
    restoring = { delta };
    history.go(-delta);
  });
}

export function guardDeckRouteNavigation(navigate: Navigate, to: string, options?: Parameters<Navigate>[1]) {
  if (!activeGuard || bypassRouteGuard > 0) {
    navigate(to, options);
    return;
  }
  activeGuard(() => navigate(to, options), () => {});
}

export function runWithoutDeckExitGuard(action: () => void) {
  bypassRouteGuard += 1;
  try {
    action();
  } finally {
    bypassRouteGuard -= 1;
  }
}

export function setDeckExitGuard(guard: ExitGuard | null) {
  activeGuard = guard;
  return () => {
    if (activeGuard === guard) activeGuard = null;
  };
}