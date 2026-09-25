import { useEffect, useRef } from 'react';
import { useLocation, useSearch } from 'wouter';
import { useNotifications } from './Notifications';

/** Read receipts come from visible destinations, never from clicking a bell link. */
export function NotificationArrival() {
  const { notices, seen } = useNotifications();
  const [location] = useLocation();
  const search = useSearch();
  const latest = useRef(notices);
  latest.current = notices;
  const rescan = useRef(() => {});
  const ids = notices.map(n => n.id).join('\n');
  useEffect(() => {
    const requested = new URLSearchParams(search).get('notification');
    const states = new Map<HTMLElement, { id: string; viewed: boolean; inside: boolean; timer?: number }>();
    let jumped = false;
    const acknowledge = (element: HTMLElement) => {
      const state = states.get(element);
      if (!state?.viewed) return;
      seen(state.id);
      if (element.dataset.notificationSection) latest.current.filter(n => n.section === element.dataset.notificationSection && !n.sticky).forEach(n => seen(n.id));
      element.removeAttribute('data-notification-focus');
    };
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const element = entry.target as HTMLElement, state = states.get(element);
        if (!state) continue;
        state.inside = entry.isIntersecting && entry.intersectionRatio >= 0.5;
        window.clearTimeout(state.timer);
        if (state.inside && document.visibilityState === 'visible') {
          state.timer = window.setTimeout(() => {
            if (document.visibilityState !== 'visible' || document.querySelector('dialog.notification-inbox[open]')) return;
            state.viewed = true;
            if (!state.id.startsWith('card:')) acknowledge(element);
          }, 700);
        } else if (!state.inside) acknowledge(element);
      }
    }, { threshold: [0, 0.5] });
    const scan = () => {
      document.querySelectorAll<HTMLElement>('[data-notification-id], [data-notification-section]').forEach(element => {
        const id = element.dataset.notificationId ?? latest.current.find(n => n.section === element.dataset.notificationSection)?.id;
        if (!id) return;
        if (!latest.current.some(n => n.id === id)) return;
        const previous = states.get(element);
        if (previous && previous.id !== id) {
          acknowledge(element); clearTimeout(previous.timer); observer.unobserve(element); states.delete(element);
        }
        if (!states.has(element)) {
          states.set(element, { id, viewed: false, inside: false }); observer.observe(element);
        }
        if (requested === id && !jumped && element.getClientRects().length) {
          jumped = true;
          element.setAttribute('data-notification-focus', 'true');
          // Instant scroll avoids competing with gestures and respects reduced motion.
          element.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
        }
      });
    };
    rescan.current = scan;
    scan();
    const mutations = new MutationObserver(scan);
    mutations.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-notification-id', 'open'] });
    const away = (event: PointerEvent | FocusEvent) => {
      for (const [element, state] of states) {
        if (state.id.startsWith('card:') && event.target instanceof Node && !element.contains(event.target)) acknowledge(element);
      }
    };
    document.addEventListener('pointerdown', away, true);
    document.addEventListener('focusin', away, true);
    return () => {
      rescan.current = () => {};
      mutations.disconnect(); observer.disconnect();
      document.removeEventListener('pointerdown', away, true);
      document.removeEventListener('focusin', away, true);
      for (const [element, state] of states) {
        clearTimeout(state.timer);
        // Leaving a viewed destination counts, but unmounted/unseen cards do not.
        if (state.viewed) seen(state.id);
        element.removeAttribute('data-notification-focus');
      }
    };
  }, [location, search, seen]);
  // Newly loaded content gets observed by the DOM observer; no receipt-effect restart
  // on unrelated query refreshes (which would prematurely acknowledge a focused card).
  useEffect(() => {
    rescan.current();
    for (const element of document.querySelectorAll<HTMLElement>('[data-notification-focus]')) {
      if (!notices.some(n => n.id === element.dataset.notificationId)) element.removeAttribute('data-notification-focus');
    }
  }, [ids]);
  return null;
}
