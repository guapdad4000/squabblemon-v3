import { useCallback, useEffect, useRef, useState, type ComponentType } from 'react';
import type { DeferredModule } from '../lib/deferredModule';

// Intent loads code only. Opening mounts the content once and keeps it mounted
// on later closes so pending claims, receipts, and animations keep their state.
export function useDeferredPopup<P>(module: DeferredModule<ComponentType<P>>, open: boolean) {
  const [Component, setComponent] = useState<ComponentType<P> | undefined>(() => module.peek());
  const [opened, setOpened] = useState(open);
  const [failed, setFailed] = useState(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const preload = useCallback(() => {
    setFailed(false);
    void module.load().then(component => {
      if (mounted.current) setComponent(() => component);
    }, () => {
      if (mounted.current) setFailed(true);
    });
  }, [module]);
  useEffect(() => {
    if (open) {
      setOpened(true);
      preload();
    }
  }, [open, preload]);
  return { Component: open || opened ? Component : undefined, failed, preload };
}
