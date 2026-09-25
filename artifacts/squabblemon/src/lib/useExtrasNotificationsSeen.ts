import { useEffect } from 'react';
import { useNotifications } from '../components/Notifications';

/** Viewing Extras acknowledges its collection, without opening every cosmetic tab. */
export function useExtrasNotificationsSeen(cardId?: string, enabled = true) {
  const { notices, seen } = useNotifications();
  const unread = notices.filter(notice => !notice.sticky && notice.section === 'style'
    && (cardId
      ? notice.href.split('?')[0] === `/game/style/${cardId}`
      : notice.href.startsWith('/game/style/'))).map(notice => notice.id).join('\n');

  useEffect(() => {
    if (!enabled || !unread) return;
    let timer: number | undefined;
    const visible = () => document.visibilityState === 'visible' && !document.querySelector('dialog[open]');
    const schedule = () => {
      window.clearTimeout(timer);
      if (!visible()) return;
      timer = window.setTimeout(() => {
        if (visible()) unread.split('\n').forEach(seen);
      }, 700);
    };
    // A foreground return or closing the bell should resume the viewing interval.
    const dialogs = new MutationObserver(schedule);
    dialogs.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['open'] });
    document.addEventListener('visibilitychange', schedule);
    schedule();
    return () => {
      window.clearTimeout(timer);
      dialogs.disconnect();
      document.removeEventListener('visibilitychange', schedule);
    };
  }, [enabled, unread, seen]);
}
