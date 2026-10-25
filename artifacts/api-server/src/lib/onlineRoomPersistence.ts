import { compactMatchReplay, restoreMatchReplay } from '@workspace/squabblemon-engine/gameEngine';
import type { OnlineRoom } from '@workspace/squabblemon-engine/multiplayer';

/** Rolling rollout: deploy decoding everywhere before enabling compact writes.
 * Default remains readable by an older API. Legacy full snapshots always decode. */
export const storeOnlineRoom = (state: OnlineRoom): Record<string, unknown> =>
  (process.env.ONLINE_COMPACT_REPLAY === '1' && state.match
    ? { ...state, match: compactMatchReplay(state.match) } : state) as unknown as Record<string, unknown>;
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
