import { useEffect, type RefObject } from 'react';

/** Keep keyboard navigation inside a story overlay and return focus to its opener. */
export function useStoryModalFocus(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const host = ref.current;
    if (!host) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    host.querySelector<HTMLElement>('button:not(:disabled)')?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const targets = [...host.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], video[controls], input, [tabindex="0"]')]
        .filter(element => element.getClientRects().length > 0);
      const first = targets[0], last = targets.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && (document.activeElement === first || !host.contains(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !host.contains(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    };
    host.addEventListener('keydown', trap);
    return () => { document.body.style.overflow = overflow; host.removeEventListener('keydown', trap); if (previous?.isConnected) previous.focus(); };
  }, [ref]);
}
