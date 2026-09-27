import { flushSync } from 'react-dom';
import { guardDeckRouteNavigation } from './deckExitGuard';

type Navigate = Parameters<typeof guardDeckRouteNavigation>[0];
type StartViewTransition = (update: () => void) => unknown;

function reducedMotion() {
  return document.documentElement.dataset.reduceMotion === 'true'
    || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** App-like screen blends where the browser supports View Transitions; plain navigation elsewhere. */
export function viewTransitionNavigation(navigate: Navigate, to: string, options?: Parameters<Navigate>[1]) {
  const start = (document as Document & { startViewTransition?: StartViewTransition }).startViewTransition;
  const current = window.location.pathname + window.location.search;
  if (typeof start !== 'function' || reducedMotion() || document.hidden || to === current) {
    guardDeckRouteNavigation(navigate, to, options);
    return;
  }
  guardDeckRouteNavigation((target, targetOptions) => {
    document.documentElement.dataset.viewTransition = 'true';
    const transition = start.call(document, () => flushSync(() => navigate(target, targetOptions))) as { finished?: Promise<void> };
    const done = () => { delete document.documentElement.dataset.viewTransition; };
    transition?.finished ? transition.finished.then(done, done) : done();
  }, to, options);
}
