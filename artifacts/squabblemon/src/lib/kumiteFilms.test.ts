import assert from 'node:assert/strict';
import { test } from 'node:test';
import { catalogCardById } from '../data';
import { KUMITE_FILMS, ownedKumiteFilms, kumiteFilmAsset } from './kumiteFilms';

test('every film points to a real collection identity', () => {
  assert.equal(KUMITE_FILMS.length, 9);
  assert.equal(new Set(KUMITE_FILMS.map(f => f.key)).size, 9);
  for (const film of KUMITE_FILMS) assert.ok(catalogCardById[film.cardId], film.cardId);
});
test('a selected, discovered, or unrelated owned fighter cannot unlock a replay', () => {
  assert.deepEqual(ownedKumiteFilms('undercova-brotha', []), []);
  assert.deepEqual(ownedKumiteFilms('undercova-brotha', ['bushedo-brown']), []);
  assert.equal(ownedKumiteFilms('undercova-brotha', ['undercova-brotha'])[0]?.key, 'undercova');
  assert.deepEqual(ownedKumiteFilms('yasuke', ['yasuke']), []);
});
test('the Glo uses Leroy ownership and P Tang uses its catalog identity', () => {
  assert.deepEqual(ownedKumiteFilms('leroy', ['leroy']).map(f => f.key), ['leroy', 'glo']);
  assert.equal(ownedKumiteFilms('p-tang', ['p-tang'])[0]?.key, 'ptang');
  assert.deepEqual(ownedKumiteFilms('ptang', ['ptang']), []);
});
test('both edits and poster paths remain versioned and relative', () => {
  for (const film of KUMITE_FILMS) for (const portrait of [false, true]) {
    assert.match(kumiteFilmAsset(film, portrait), /^assets\/kumite\/films\/v1\/unlock-[a-z]+-(portrait|landscape)\.mp4$/);
    assert.ok(kumiteFilmAsset(film, portrait, true).endsWith('.webp'));
  }
});
