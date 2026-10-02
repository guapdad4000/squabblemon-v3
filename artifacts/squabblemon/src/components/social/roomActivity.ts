import type { RoomSummary } from '../../lib/multiplayer';

const MINUTE = 60_000;
export const ROOM_EXPIRY_WARNING_MS = 5 * MINUTE;

function ago(timestamp: number, now: number) {
  const elapsed = Math.max(0, now - timestamp);
  if (elapsed < MINUTE) return 'just now';
  if (elapsed < 60 * MINUTE) return `${Math.floor(elapsed / MINUTE)}m ago`;
  if (elapsed < 24 * 60 * MINUTE) return `${Math.floor(elapsed / (60 * MINUTE))}h ago`;
  return `${Math.floor(elapsed / (24 * 60 * MINUTE))}d ago`;
}

export function roomActivity(room: RoomSummary, now: number) {
  const remaining = room.expiresAt - now;
  const expired = remaining <= 0;
  const hasPlayed = room.status === 'active' || room.status === 'complete' || room.gameNumber > 1
    || room.series.you + room.series.rival + room.series.draws > 0;
  return {
    activity: room.lastPlayedAt !== null
      ? `Last played ${ago(room.lastPlayedAt, now)}`
      : `${hasPlayed ? '' : 'Not played yet · '}Last active ${ago(room.lastActivityAt, now)}`,
    expiry: expired ? 'Expired'
      : remaining < MINUTE ? 'Less than 1m left' : `~${Math.ceil(remaining / MINUTE)}m left`,
    expiringSoon: !expired && remaining <= ROOM_EXPIRY_WARNING_MS,
    expired,
  };
}