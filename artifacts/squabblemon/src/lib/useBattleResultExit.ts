import { useEffect, useRef, useState } from 'react';
import { rewardReceipts } from './rewardReceipts';
import { setBattleMusicMode } from '../musicStore';

/** Inspection stays in results; actual exits yield to one pending celebration. */
export function useBattleResultExit() {
  const [celebrating, setCelebrating] = useState(false);
  const cancelExit = useRef<(() => void) | null>(null);
  useEffect(() => () => { cancelExit.current?.(); }, []);

  function leaveResults(action: () => void) {
    if (cancelExit.current) return;
    const cancel = rewardReceipts.leaveBattleResults(() => {
      cancelExit.current = null;
      setCelebrating(false);
      action();
    });
    if (cancel) { cancelExit.current = cancel; setBattleMusicMode(null); setCelebrating(true); }
    else action();
  }

  return { celebrating, leaveResults };
}
