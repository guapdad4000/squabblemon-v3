import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { Router } from 'wouter';
import type { RoomSummary } from '../../lib/multiplayer';
import { FriendlyRoomRow } from './FriendlyRoomList';
import { roomActivity } from './roomActivity';

const now = Date.UTC(2026, 8, 30, 12);
const minute = 60_000;
const room: RoomSummary = {
  code: 'ABCDEF123456', status: 'complete', rival: 'A very long rival name',
  gameNumber: 1, series: { you: 2, rival: 1, draws: 1 },
  lastActivityAt: now - minute, lastPlayedAt: now - 8 * minute,
  expiresAt: now + 22 * minute,
};

test('activity uses actual gameplay rather than a more recent lobby update', () => {
  assert.deepEqual(roomActivity(room, now), {
    activity: 'Last played 8m ago', expiry: '~22m left', expiringSoon: false, expired: false,
  });
  assert.equal(roomActivity({ ...room, lastPlayedAt: now + minute }, now).activity, 'Last played just now');
  assert.equal(roomActivity({ ...room, lastPlayedAt: now - 90 * minute }, now).activity, 'Last played 1h ago');
  assert.equal(roomActivity({ ...room, lastPlayedAt: now - 2 * 24 * 60 * minute }, now).activity, 'Last played 2d ago');
});

test('expiry is driven only by the stored expiry, including warning boundaries', () => {
  assert.equal(roomActivity({ ...room, expiresAt: now + 5 * minute + 1 }, now).expiringSoon, false);
  const expiring = roomActivity({ ...room, expiresAt: now + 5 * minute }, now);
  assert.equal(expiring.expiringSoon, true);
  assert.equal(expiring.expiry, '~5m left');
  assert.equal(roomActivity({ ...room, expiresAt: now + 30_000 }, now).expiry, 'Less than 1m left');
  for (const expiresAt of [now, now - minute]) {
    const expired = roomActivity({ ...room, expiresAt }, now);
    assert.equal(expired.expiry, 'Expired');
    assert.equal(expired.expiringSoon, false);
    assert.equal(expired.expired, true);
  }
});

test('unplayed and legacy rows describe their known activity without fabricating a fade', () => {
  assert.equal(roomActivity({ ...room, lastPlayedAt: null }, now).activity, 'Last active 1m ago');
  const waiting = { ...room, status: 'waiting' as const, series: { you: 0, rival: 0, draws: 0 }, lastPlayedAt: null };
  assert.equal(roomActivity(waiting, now).activity, 'Not played yet · Last active 1m ago');
  assert.equal(roomActivity({ ...waiting, gameNumber: 2 }, now).activity, 'Last active 1m ago');
});

function render(item: RoomSummary) {
  return renderToStaticMarkup(<Router ssrPath="/game/online"><FriendlyRoomRow room={item} now={now} /></Router>);
}
test('rows keep the room link and series, with an explicit non-color expiry warning', () => {
  const markup = render({ ...room, expiresAt: now + 3 * minute });
  assert.match(markup, /href="\/game\/online\/ABCDEF123456"/);
  assert.match(markup, /room-series-ABCDEF123456/);
  assert.match(markup, /2–1 · 1D/);
  assert.match(markup, /Last played 8m ago/);
  assert.match(markup, /data-expiring="true"/);
  assert.match(markup, /Expiring soon · /);
  assert.match(markup, /~3m left/);
  assert.doesNotMatch(render(room), /data-expiring|Expiring soon/);
});

test('expired rows cannot lead players into a stale room', () => {
  const markup = render({ ...room, expiresAt: now });
  assert.match(markup, /Expired/);
  assert.match(markup, /data-expired="true"/);
  assert.doesNotMatch(markup, /href=|link-room-/);
});