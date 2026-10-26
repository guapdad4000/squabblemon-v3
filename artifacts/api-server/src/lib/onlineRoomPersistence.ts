import { compactMatchReplay, restoreMatchReplay } from '@workspace/squabblemon-engine/gameEngine';
import type { OnlineRoom } from '@workspace/squabblemon-engine/multiplayer';

/** Rolling rollout: deploy decoding everywhere before enabling compact writes.
 * Default remains readable by an older API. Legacy full snapshots always decode. */
export const storeOnlineRoom = (state: OnlineRoom): Record<string, unknown> =>
  (process.env.ONLINE_COMPACT_REPLAY === '1' && compactable(state.match)
    ? { ...state, match: compactMatchReplay(state.match) } : state) as unknown as Record<string, unknown>;
/** Legacy/retired snapshots can lack a replay log; keep those in their stored
 * form rather than failing the write that closes or retires the room. */
function compactable(match: OnlineRoom['match']): match is NonNullable<OnlineRoom['match']> {
  return !!match && !('replayArchive' in match) && Array.isArray(match.effectLog) &&
    match.effectLog.every(event => !!event?.replay && typeof event.replay === 'object');
}
const decoded = new WeakMap<object, OnlineRoom>();
export function restoreOnlineRoom(state: Record<string, unknown>): OnlineRoom {
  const room = state as unknown as OnlineRoom;
  if (!room.match || !('replayArchive' in room.match)) return room;
  const cached = decoded.get(state);
  if (cached) return cached;
  const restored = { ...room, match: restoreMatchReplay(room.match) };
  decoded.set(state, restored);
  return restored;
}
