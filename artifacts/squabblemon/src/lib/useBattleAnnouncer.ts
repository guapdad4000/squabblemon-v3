import { useEffect, useRef } from 'react';
import { createBattleAnnouncer, type AnnouncementState } from './battleAnnouncer';

export function useBattleAnnouncer({ round, roundLimit, active, roundReady, yourTurn }: AnnouncementState) {
  const announcer = useRef<ReturnType<typeof createBattleAnnouncer> | null>(null);
  useEffect(() => {
    const channel = createBattleAnnouncer();
    announcer.current = channel;
    return () => { channel.dispose(); announcer.current = null; };
  }, []);
  useEffect(() => {
    // Defer the first playback so StrictMode's probe cannot announce twice.
    const timer = setTimeout(() => announcer.current?.update({ round, roundLimit, active, roundReady, yourTurn }), 0);
    return () => clearTimeout(timer);
  }, [round, roundLimit, active, roundReady, yourTurn]);
}
