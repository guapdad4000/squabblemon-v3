import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { Router } from 'wouter';
import { emptyKumiteRounds, type KumiteTournament } from '../../lib/kumite';
import { KumiteScoreboard, kumiteMatchTiming } from './KumiteScoreboard';
import { KumiteRewards } from './KumiteRewards';

const tournament: KumiteTournament = { id: 'review', weekLabel: 'Review week', status: 'registration', registrationOpensAt: 0, startsAt: 1000, endsAt: 2000, capacity: 8, poolCount: 1, poolSize: 8, entrants: [], pools: [], finals: emptyKumiteRounds(null), champion: null };

test('the live board has eight seats and no image-supplied player names', () => {
  const markup = renderToStaticMarkup(<KumiteScoreboard tournament={tournament} now={0} />);
  assert.equal((markup.match(/class="kumite-scoreboard__seat /g) ?? []).length, 8);
  assert.ok(markup.includes('Awaiting draw'));
  assert.ok(markup.includes('scoreboard.webp'));
  assert.ok(!markup.includes('Bruce Leroy'));
  assert.ok(!markup.includes('Frank Dux'));
});

test('server event timestamps produce live elapsed and completed duration text', () => {
  const match = emptyKumiteRounds(null)[0][0];
  assert.equal(kumiteMatchTiming({ ...match, startedAt: 0 }, 95000), 'Fighting · 1:35 elapsed');
  assert.ok(kumiteMatchTiming({ ...match, completedAt: 95000, durationMs: 95000, reason: 'played' }, 200000).endsWith(' · 1:35'));
  assert.equal(kumiteMatchTiming(match, 200000), 'Draw pending');
});

test('a completed fight labels the actual winner and eliminated opponent', () => {
  const winner = { id: 'winner', name: 'Winner Crew', hero: 'leroy', seed: 1, pool: null };
  const loser = { id: 'loser', name: 'Rival Crew', hero: 'sho-nuff', seed: 2, pool: null };
  const rounds = emptyKumiteRounds(null);
  rounds[0][0] = { ...rounds[0][0], entrants: [winner, loser], winner, status: 'complete', reason: 'played', checkedIn: [true, true] };
  const markup = renderToStaticMarkup(<KumiteScoreboard tournament={{ ...tournament, finals: rounds }} now={0} />);
  assert.ok(markup.includes('WINNER</small>'));
  assert.ok(markup.includes('OUT</small>'));
  assert.ok(!markup.includes('CHECKED IN</small>'));
});

test('fighter rewards only mark earned cards from server receipts', () => {
  const progression = { completedMatches: 1, matchWins: 0, championships: 0, rewards: [
    { id: 'participation', cardId: 'bushedo-brown', name: 'Bushedo Brown', requirement: 'Complete a Kumite fight', required: 1, progress: 1, claimed: true },
    { id: 'first-win', cardId: 'franklin-duke', name: 'Franklin Duke', requirement: 'Win a Kumite fight', required: 1, progress: 0, claimed: false },
    { id: 'champion', cardId: 'chonk-lee', name: 'Chonk Lee', requirement: 'Become champion', required: 1, progress: 0, claimed: false },
  ] };
  const markup = renderToStaticMarkup(<Router hook={() => ['/', () => {}]}><KumiteRewards progression={progression} /></Router>);
  assert.equal((markup.match(/data-earned="true"/g) ?? []).length, 1);
  assert.equal((markup.match(/data-earned="false"/g) ?? []).length, 2);
  assert.ok(markup.includes('Unlocked'));
  assert.equal(renderToStaticMarkup(<KumiteRewards progression={null} />), '');
});
