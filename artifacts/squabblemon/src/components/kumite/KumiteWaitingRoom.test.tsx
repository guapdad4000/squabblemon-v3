import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { Router } from 'wouter';
import { createOnlineRoom, joinOnlineRoom, onlineRoomView } from '@workspace/squabblemon-engine/multiplayer';
import { starterRecipes } from '../../data';
import { KumiteWaitingRoom } from './KumiteWaitingRoom';

function waitingRoom() {
  const now = Date.UTC(2026, 9, 17, 18);
  const recipe = starterRecipes[0];
  const deck = { id: recipe.id, name: 'Locked tournament gang', hero: recipe.hero, cards: recipe.catalogCardIds };
  const member = (userId: string, name: string) => ({ userId, name, deck, ready: false });
  const room = joinOnlineRoom(createOnlineRoom(member('player-one', 'First fighter'), 'player', now), member('player-two', 'Assigned opponent'), now);
  room.kumite = { tournamentId: 'weekly-review', matchId: 'quarterfinal-one', roundDeadline: now + 6 * 3600000 };
  return onlineRoomView(room, 'ABCDEF123456', 'player-one', now);
}

test('Kumite waiting room names assigned fighters and locked deck without private invitations', () => {
  const room = waitingRoom();
  const html = renderToStaticMarkup(<Router ssrPath="/game/online/ABCDEF123456"><KumiteWaitingRoom room={room} connected busy={false} onLeave={() => {}} send={() => {}} /></Router>);
  assert.ok(html.includes('Weekly Kumite'));
  assert.ok(html.includes('First fighter'));
  assert.ok(html.includes('Assigned opponent'));
  assert.ok(html.includes('Locked tournament gang'));
  assert.ok(html.includes('Round deadline'));
  assert.match(html, /datetime=/i);
  assert.ok(html.includes('Forfeit tournament match'));
  assert.ok(html.includes('aria-label="Back to Kumite"'));
  assert.ok(html.includes('data-testid="kumite-versus"'));
  assert.ok(html.includes('assets/kumite/vs-backdrop.webp'));
  assert.ok(!/Copy invite|ROOM CODE|PRIVATE ROOM|Close room|Friendly Fade|Moonline Rooftop/.test(html));
  assert.ok(!html.includes(room.code), 'assignment codes are not shown as invitations');
});

test('unknown fighter art keeps assigned names and stable white-logo portrait slots', () => {
  const room = waitingRoom();
  room.members.player!.hero = 'unavailable-review-hero';
  room.members.cpu!.hero = 'another-unavailable-hero';
  const html = renderToStaticMarkup(<Router ssrPath="/game/online/ABCDEF123456"><KumiteWaitingRoom room={room} connected busy={false} onLeave={() => {}} send={() => {}} /></Router>);
  assert.equal((html.match(/data-art-fallback="true"/g) ?? []).length, 2);
  assert.ok(html.includes('First fighter'));
  assert.ok(html.includes('Assigned opponent'));
  assert.ok(html.includes('assets/kumite/squabblemon-wordmark.webp'));
  assert.ok(!html.includes('assets/characters/unavailable-review-hero'));
  assert.ok(!html.toLowerCase().includes('crown'));
});

test('ready action is disabled while disconnected, busy, or already ready', () => {
  const room = waitingRoom();
  const readyButton = (html: string) => html.match(/<button[^>]*class="kumite-button"[^>]*>[\s\S]*?<\/button>/)?.[0] ?? '';
  const render = (connected: boolean, busy: boolean) => renderToStaticMarkup(<Router ssrPath="/game/online/ABCDEF123456"><KumiteWaitingRoom room={room} connected={connected} busy={busy} onLeave={() => {}} send={() => {}} /></Router>);
  assert.ok(!readyButton(render(true, false)).includes('disabled'));
  assert.ok(readyButton(render(false, false)).includes('disabled'));
  assert.ok(readyButton(render(true, true)).includes('disabled'));
  room.members.player!.ready = true;
  assert.ok(readyButton(render(true, false)).includes('disabled'));
  assert.ok(render(true, false).includes('Ready. Waiting for your opponent'));
});

test('connection failures are announced while the safe return remains available', () => {
  const html = renderToStaticMarkup(<Router ssrPath="/game/online/ABCDEF123456"><KumiteWaitingRoom room={waitingRoom()} connected={false} busy={false} error="Tournament connection interrupted" onLeave={() => {}} send={() => {}} /></Router>);
  assert.ok(html.includes('role="alert">Tournament connection interrupted'));
  assert.ok(html.includes('Reconnecting to your tournament match'));
  const back = html.match(/<button[^>]*aria-label="Back to Kumite"[^>]*>/)?.[0] ?? '';
  assert.ok(back.length > 0);
  assert.ok(!back.includes('disabled'));
});
