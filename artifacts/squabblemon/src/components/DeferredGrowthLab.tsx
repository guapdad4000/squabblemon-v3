import { useEffect, useRef, type ComponentProps } from 'react';
import type { BuddyGrowthLab } from './BuddyGrowthLab';
import { createDeferredComponent } from '../lib/deferredComponent';
import { useDeferredPopup } from './useDeferredPopup';

const growthLab = createDeferredComponent('BuddyGrowthLab', 'BuddyGrowthLab', () => import('./BuddyGrowthLab'));
export function preloadGrowthLab() { void growthLab.load().catch(() => { /* Opening exposes a retry. */ }); }

export function DeferredGrowthLab(props: ComponentProps<typeof BuddyGrowthLab>) {
  const { Component, failed, preload } = useDeferredPopup(growthLab, props.open);
  const loadingDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!props.open || Component) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = loadingDialog.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
      // The full dialog captures this same opener when it replaces loading.
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [props.open, Component]);
  if (Component) return <Component {...props} />;
  return props.open ? <dialog ref={loadingDialog} className="street-dialog" aria-labelledby="growth-loading-title" onCancel={() => props.onOpenChange(false)}>
    <h2 id="growth-loading-title">Buddy’s Growth Lab</h2>
    <p role={failed ? 'alert' : 'status'}>{failed ? 'Couldn’t open the Growth Lab. Try again.' : 'Opening the Growth Lab…'}</p>
    {failed && <button type="button" onClick={preload}>Retry</button>}
    <button autoFocus type="button" onClick={() => props.onOpenChange(false)}>Close</button>
  </dialog> : null;
}
