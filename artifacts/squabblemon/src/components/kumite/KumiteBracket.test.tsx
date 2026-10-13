import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { emptyKumiteRounds, kumiteCountdown, type KumiteTournament } from '../../lib/kumite';
import { KumiteBracket } from './KumiteBracket';
import { KumiteBanner } from './KumiteBanner';

const tournament: KumiteTournament = {
  id: '2026-10-12', weekLabel: 'Week of 2026-10-12', status: 'registration',
  registrationOpensAt: 0, startsAt: 1000, endsAt: 2000, capacity: 8,
  poolCount: 1, poolSize: 8, entrants: [], pools: [], finals: [], champion: null,
};

test('the draw contains only eight entrants and seven single-elimination matches', () => {
  const rounds = emptyKumiteRounds(null);
  assert.deepEqual(rounds.map(round => round.length), [4, 2, 1]);
  assert.equal(rounds.flat().length, 7);
  assert.ok(rounds.flat().every(match => match.entrants.every(entrant => entrant === null)));
  const markup = renderToStaticMarkup(<KumiteBracket tournament={tournament} />);
  assert.equal((markup.match(/class="kumite-match"/g) ?? []).length, 7);
  assert.ok(markup.includes('QUARTERFINALS'));
  assert.ok(markup.includes('SEMIFINALS'));
  assert.ok(markup.includes('0 / 8 entrants registered'));
  assert.ok(!markup.includes('Pool'));
});

test('real bracket winner is shown without invented filler names', () => {
  const winner = { id: 'entrant-one', name: 'Actual winner & crew', hero: 'cornball', seed: 1, pool: null };
  const rounds = emptyKumiteRounds(null);
  rounds[2][0] = { ...rounds[2][0], entrants: [winner, null], winner, status: 'complete', reason: 'bye' };
  const markup = renderToStaticMarkup(<KumiteBracket tournament={{ ...tournament, status: 'complete', finals: rounds, champion: winner }} />);
  assert.ok(markup.includes('Actual winner &amp; crew'));
  assert.ok(markup.includes('Bye'));
  assert.ok(!markup.includes('Your name could be here'));
});

test('countdowns clamp expired schedules and count remaining minutes up', () => {
  assert.equal(kumiteCountdown(0, 1), '0m');
  assert.equal(kumiteCountdown(1, 0), '1m');
  assert.equal(kumiteCountdown(25 * 60 * 60 * 1000 + 60 * 1000, 0), '1d 1h 1m');
});

test('banner text remains accessible and independent of the cloth artwork', () => {
  const markup = renderToStaticMarkup(<KumiteBanner title="KUMITE" subtitle="EIGHT ENTER · ONE STANDS" />);
  assert.ok(markup.includes('KUMITE</span>'));
  assert.ok(markup.includes('EIGHT ENTER · ONE STANDS'));
  assert.ok(markup.includes('alt=""'));
  assert.ok(!markup.toLowerCase().includes('crown'));
});
