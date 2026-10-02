/**
 * Player-chosen presentation speed for solo (PvE) battles. Online battles are
 * server paced, so they always present at normal speed.
 */
export type BattleSpeed = 1 | 1.5;

export const BATTLE_SPEED_STORAGE_KEY = 'squabblemon_battle_speed';
export const BATTLE_SPEED_CHANGE_EVENT = 'squabblemon:battle-speed-change';
export const FAST_BATTLE_SPEED = 1.5 as const;
export const NORMAL_BATTLE_SPEED = 1 as const;

export function normalizeBattleSpeed(value: unknown): BattleSpeed {
  return Number(value) === FAST_BATTLE_SPEED ? FAST_BATTLE_SPEED : NORMAL_BATTLE_SPEED;
}

export function loadBattleSpeed(): BattleSpeed {
  try {
    return normalizeBattleSpeed(localStorage.getItem(BATTLE_SPEED_STORAGE_KEY));
  } catch {
    return NORMAL_BATTLE_SPEED;
  }
}

export function saveBattleSpeed(speed: BattleSpeed) {
  try { localStorage.setItem(BATTLE_SPEED_STORAGE_KEY, String(speed)); } catch { /* Private browsing can disable storage. */ }
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent !== 'undefined') {
    window.dispatchEvent(new CustomEvent(BATTLE_SPEED_CHANGE_EVENT, { detail: speed }));
  }
}

/**
 * Shorten a presentation beat. Reading holds and the decision timer never pass
 * through here: only the broadcast choreography reacts to the speed choice.
 */
export function scaleBattleBeat(delayMs: number, speed: BattleSpeed): number {
  if (speed === NORMAL_BATTLE_SPEED || delayMs <= 0) return delayMs;
  return Math.round(delayMs / speed);
}
