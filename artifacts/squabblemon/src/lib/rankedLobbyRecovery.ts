import type { OnlineRoomView } from '@workspace/squabblemon-engine/multiplayer';
import { isTransientOnlineError } from './multiplayer';

export type RankedRecovery = { kind: 'search' | 'cancel'; until: number };

/** A lost write acknowledgement does not mean the queue operation failed. */
export function rankedRecoveryResolved(recovery: RankedRecovery, room: OnlineRoomView | null) {
  return recovery.kind === 'search'
    ? !!room && ['waiting', 'active', 'complete'].includes(room.status)
    : room?.status !== 'waiting';
}

export function rankedLobbyPollInterval(
  room: OnlineRoomView | null | undefined,
  error: unknown,
  recovery: RankedRecovery | null,
  now = Date.now(),
): number | false {
  if (error && !isTransientOnlineError(error)) return false;
  if (room?.status === 'waiting' || (recovery && now < recovery.until)) return 1000;
  // Initial failures also recover: there may be no cached queue to enable polling yet.
  return error ? 3000 : false;
}
