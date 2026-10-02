import { useEffect, useMemo, useState } from 'react';
import { Link } from 'wouter';
import { AlertTriangle, ArrowUpRight, Clock3 } from 'lucide-react';
import type { RoomSummary } from '../../lib/multiplayer';
import { roomActivity } from './roomActivity';

/** Advance the server's snapshot clock, rather than trusting the phone's clock. */
export function FriendlyRoomList({ rooms, serverNow, receivedAt }: {
  rooms: RoomSummary[]; serverNow: number; receivedAt: number;
}) {
  const snapshot = useMemo(() => ({
    startedAt: performance.now(), age: Math.max(0, Date.now() - receivedAt),
  }), [serverNow, receivedAt]);
  const [tick, setTick] = useState(() => performance.now());
  useEffect(() => {
    const update = () => setTick(performance.now());
    const timer = window.setInterval(update, 10_000);
    document.addEventListener('visibilitychange', update);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);
  const now = serverNow + snapshot.age + Math.max(0, tick - snapshot.startedAt);
  return <ul className="sq-list" data-testid="list-rooms">{rooms.map(room =>
    <FriendlyRoomRow key={room.code} room={room} now={now} />)}</ul>;
}

export function FriendlyRoomRow({ room, now }: { room: RoomSummary; now: number }) {
  const activity = roomActivity(room, now);
  const content = <>
    <span className="sq-pill" data-status={activity.expired ? 'closed' : room.status === 'waiting' ? 'pending' : 'accepted'}>
      {activity.expired ? 'Expired' : room.status === 'active' ? 'Live' : room.status === 'complete' ? 'Run it back' : room.status === 'waiting' ? 'Waiting' : 'Final'}</span>
    <strong className="sq-row__name">{room.rival}</strong>
    {(room.series.you + room.series.rival + room.series.draws > 0) && <span className="ff-room__series" data-testid={`room-series-${room.code}`}>
      {room.series.you}–{room.series.rival}{room.series.draws ? ` · ${room.series.draws}D` : ''}</span>}
    <span className="sq-code">{room.code} {!activity.expired && <ArrowUpRight size={14} aria-hidden="true" />}</span>
    <span className="ff-room__activity" data-testid={`room-activity-${room.code}`}>
      <span>{activity.activity}</span>
      <span className="ff-room__expiry">
        {activity.expiringSoon ? <AlertTriangle size={13} aria-hidden="true" /> : <Clock3 size={13} aria-hidden="true" />}
        {activity.expiringSoon && <strong>Expiring soon · </strong>}{activity.expiry}
      </span>
    </span>
  </>;
  return <li className="sq-row ff-room-row" data-expiring={activity.expiringSoon || undefined} data-expired={activity.expired || undefined}>
    {activity.expired
      ? <div className="ff-room">{content}</div>
      : <Link className="ff-room" to={`/game/online/${room.code}`} data-testid={`link-room-${room.code}`}>{content}</Link>}
  </li>;
}