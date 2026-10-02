import type { OnlineCommand } from '@workspace/squabblemon-engine/multiplayer';

export type RoomExitIntent = 'lobby' | 'leave';
export type RoomExitOutcome = { navigate: boolean; failed: RoomExitIntent | null };

/**
 * Decides what an exit from a finished fade does.
 *
 * Ranked results have no room to keep, so they just navigate. A friendly room
 * only counts as closed once the server confirms it: navigating on an
 * unconfirmed "leave" would leave the rival waiting in a room nobody is in.
 * Returning to the lobby never navigates — the room stays open and the page
 * follows the room's own status.
 */
export async function resolveRoomExit(
  intent: RoomExitIntent,
  options: { ranked: boolean; send: (command: OnlineCommand) => unknown },
): Promise<RoomExitOutcome> {
  if (options.ranked) return { navigate: intent === 'leave', failed: null };
  try {
    if ((await options.send({ type: intent })) === false) return { navigate: false, failed: intent };
  } catch {
    return { navigate: false, failed: intent };
  }
  return { navigate: intent === 'leave', failed: null };
}
