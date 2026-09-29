import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SOCIAL_DESTINATION_KEY,
  clearSocialDestination,
  consumeSocialDestination,
  readSocialDestination,
  rememberSocialDestination,
  safeGameDestination,
  safeSocialDestination,
} from './socialDestinations';

function storage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() { return data.size; },
    key: index => [...data.keys()][index] ?? null,
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => { data.set(key, value); },
    removeItem: key => { data.delete(key); },
    clear: () => data.clear(),
  };
}

const options = { origin: 'https://example.test', base: '/squabblemon', now: 1000 };
const friend = '/game/settings?friend=ABCDEF123456#homies';
const invite = '/game/online?tab=friends&invite=12345678-1234-4234-8234-123456789012';

test('social links are allowlisted, normalized, and base-path aware', () => {
  assert.equal(safeSocialDestination(`/squabblemon${friend}`, options.base, options.origin), friend);
  assert.equal(safeSocialDestination(`https://example.test/squabblemon${friend}`, options.base, options.origin), friend);
  assert.equal(safeSocialDestination('/game/settings?friend=abcdef123456&accept=true#style'), friend);
  assert.equal(safeSocialDestination(invite), invite);
  assert.equal(safeSocialDestination('/game/online/abcdef123456?join=true'), '/game/online/ABCDEF123456');
  assert.equal(safeSocialDestination('/game/settings#homies'), '/game/settings#homies');
  for (const raw of [
    'https://evil.test/game/settings?friend=ABCDEF123456', '//evil.test/game',
    '/game/settings?friend=user_clerk_private', '/game/settings?friend=not-a-code',
    '/game/online?tab=friends&invite=../admin', '/game/online/bad',
    '/game/settings#style', '/game/online?tab=friends&homie=ABCDEF123456',
    '/game\\settings?friend=ABCDEF123456', '/sign-in', 'javascript:alert(1)',
  ]) assert.equal(safeSocialDestination(raw, options.base, options.origin), null, raw);
  assert.equal(safeGameDestination('/squabblemon/game/settings#style', options.base, options.origin), '/game/settings#style');
  assert.equal(safeGameDestination('/squabblemon-other/game', options.base, options.origin), null);
});

test('link survives sign-in and onboarding, binds to account, and is consumed once', () => {
  const s = storage();
  rememberSocialDestination(s, `/squabblemon${friend}`, null, options);
  assert.equal(readSocialDestination(s, null, options), friend);
  assert.equal(readSocialDestination(s, 'new-player', options), friend);
  rememberSocialDestination(s, '/game/onboarding', 'new-player', options);
  assert.equal(readSocialDestination(s, 'new-player', { ...options, now: 2000 }), friend);
  assert.equal(consumeSocialDestination(s, 'new-player', options), friend);
  assert.equal(readSocialDestination(s, 'new-player', options), null);
});

test('account changes, malformed storage and stale links cannot restore another journey', () => {
  const s = storage();
  rememberSocialDestination(s, invite, 'first-player', options);
  assert.equal(readSocialDestination(s, 'other-player', options), null);
  rememberSocialDestination(s, friend, null, options);
  assert.equal(readSocialDestination(s, null, { ...options, now: 86_402_000 }), null);
  s.setItem(SOCIAL_DESTINATION_KEY, '{"path":"https://evil.test"}');
  assert.equal(readSocialDestination(s, 'first-player', options), null);
  s.setItem(SOCIAL_DESTINATION_KEY, 'broken json');
  assert.equal(readSocialDestination(s, 'first-player', options), null);
});

test('old room links upgrade safely and storage denial never blocks navigation', () => {
  const s = storage();
  s.setItem('squabblemon_friend_invite', '/game/online/abcdef123456');
  assert.equal(readSocialDestination(s, 'player', options), '/game/online/ABCDEF123456');
  assert.equal(s.getItem('squabblemon_friend_invite'), null);
  const denied = new Proxy(s, { get() { return () => { throw new Error('Storage denied'); }; } });
  assert.doesNotThrow(() => rememberSocialDestination(denied, friend, null, options));
  assert.equal(readSocialDestination(denied, 'player', options), null);
  assert.doesNotThrow(() => clearSocialDestination(denied));
});