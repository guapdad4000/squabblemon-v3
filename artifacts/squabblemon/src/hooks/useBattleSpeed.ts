import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BATTLE_SPEED_CHANGE_EVENT,
  BATTLE_SPEED_STORAGE_KEY,
  FAST_BATTLE_SPEED,
  NORMAL_BATTLE_SPEED,
  loadBattleSpeed,
  normalizeBattleSpeed,
  saveBattleSpeed,
  type BattleSpeed,
} from '../battleSpeed';

/** Remembers the PvE presentation speed between battles and sessions. */
export function useBattleSpeed() {
  const [speed, setSpeed] = useState<BattleSpeed>(loadBattleSpeed);
  const current = useRef(speed);
  current.current = speed;
  useEffect(() => {
    const receive = (event: Event) => {
      if (event instanceof StorageEvent && event.key !== null && event.key !== BATTLE_SPEED_STORAGE_KEY) return;
      setSpeed(event instanceof CustomEvent ? normalizeBattleSpeed(event.detail) : loadBattleSpeed());
    };
    window.addEventListener(BATTLE_SPEED_CHANGE_EVENT, receive);
    window.addEventListener('storage', receive);
    return () => {
      window.removeEventListener(BATTLE_SPEED_CHANGE_EVENT, receive);
      window.removeEventListener('storage', receive);
    };
  }, []);
  const toggle = useCallback(() => {
    const next: BattleSpeed = current.current === FAST_BATTLE_SPEED ? NORMAL_BATTLE_SPEED : FAST_BATTLE_SPEED;
    current.current = next;
    setSpeed(next);
    saveBattleSpeed(next);
  }, []);
  return [speed, toggle] as const;
}
