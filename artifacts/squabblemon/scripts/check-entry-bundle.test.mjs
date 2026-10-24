import assert from 'node:assert/strict';
import test from 'node:test';

import {
  checkEntryBundle,
  checkGameBundle,
  checkSoundtrackBundle,
  ENTRY_BUDGET_BYTES,
} from './check-entry-bundle.mjs';

function report(chunks) {
  return { chunks };
}

const entry = {
  fileName: 'assets/index-hash.js',
  facadeModuleId: '/workspace/index.html',
  isEntry: true,
  imports: [],
  dynamicImports: ['assets/game-hash.js'],
  modules: ['/workspace/src/main.tsx', '/workspace/src/App.tsx'],
  bytes: 1000,
};

test('ignores lazy route chunks when measuring the public entry', () => {
  const result = checkEntryBundle(
    report([
      entry,
      {
        fileName: 'assets/game-hash.js',
        facadeModuleId: '/workspace/src/pages/game/GameApp.tsx',
        isEntry: false,
        imports: [],
        dynamicImports: [],
        modules: ['/workspace/src/pages/game/GameApp.tsx'],
        bytes: ENTRY_BUDGET_BYTES,
      },
    ]),
  );

  assert.equal(result.bytes, 1000);
});

const shell = { ...entry, fileName: 'shell.js', modules: ['/workspace/src/pages/game/GameApp.tsx'], dynamicImports: ['home.js', 'shop.js'] };
const home = { ...entry, fileName: 'home.js', modules: ['/workspace/src/pages/game/Home.tsx'], imports: ['shell.js'] };
const shop = { ...entry, fileName: 'shop.js', modules: ['/workspace/src/pages/game/Shop.tsx'] };

test('game budget ignores unvisited routes but catches eager routes in shared dependencies', () => {
  assert.equal(checkGameBundle(report([shell, home, shop]))[1].bytes, 2000);
  const shared = { ...entry, fileName: 'shared.js', imports: ['shop.js'], modules: [] };
  assert.throws(() => checkGameBundle(report([{ ...shell, imports: ['shared.js'] }, home, shop, shared])), /unrelated game routes/);
});

test('game budget includes the size of shared dependencies', () => {
  const large = { ...entry, fileName: 'large.js', modules: [], bytes: 901 * 1024 };
  assert.throws(() => checkGameBundle(report([{ ...shell, imports: ['large.js'] }, home, large])), /budget is 900 KiB/);
});

test('fails when a game module enters the static entry graph', () => {
  assert.throws(
    () =>
      checkEntryBundle(
        report([
          { ...entry, imports: ['assets/vendor-hash.js'] },
          {
            fileName: 'assets/vendor-hash.js',
            facadeModuleId: null,
            isEntry: false,
            imports: [],
            dynamicImports: [],
            modules: ['/workspace/src/components/Battle.tsx'],
            bytes: 1000,
          },
        ]),
      ),
    /eagerly includes game modules/,
  );
});

test('fails when the static public entry exceeds its budget', () => {
  assert.throws(
    () =>
      checkEntryBundle(
        report([{ ...entry, bytes: ENTRY_BUDGET_BYTES + 1 }]),
      ),
    /budget is 475 KiB/,
  );
});

// The shell can accidentally retain a large catalog through a harmless image
// helper or a shared context, even while its byte budget happens to pass.
test('game shell rejects transitive optional catalogs but lets visited routes load them', () => {
  for (const module of ['/workspace/lib/squabblemon-engine/src/data.ts', '/workspace/lib/squabblemon-engine/src/cosmetics.ts',
    '/workspace/lib/squabblemon-engine/src/playerMats.ts', '/workspace/lib/squabblemon-engine/src/story.ts',
    '/workspace/src/story.ts', '/workspace/src/data.ts', '/workspace/src/lib/notificationCatalog.ts']) {
    const catalog = { ...entry, fileName: 'catalog.js', imports: [], modules: [module], bytes: 100 };
    const shared = { ...entry, fileName: 'shared.js', imports: ['catalog.js'], modules: [], bytes: 100 };
    assert.throws(() => checkGameBundle(report([{ ...shell, imports: ['shared.js'] }, home, shared, catalog])), /optional catalogs/);
    assert.equal(checkGameBundle(report([shell, { ...home, imports: ['shell.js', 'catalog.js'] }, catalog]))[1].bytes, 2100);
  }
});


test('game shell allows compact Story music metadata while the full catalog stays lazy', () => {
  const metadata = { ...entry, fileName: 'music-metadata.js', modules: ['/workspace/src/storyMusicRoutes.json'], imports: [], bytes: 100 };
  const catalog = { ...entry, fileName: 'story-catalog.js', modules: ['/workspace/lib/squabblemon-engine/src/story.ts'], imports: [], bytes: 600_000 };
  const result = checkGameBundle(report([
    { ...shell, imports: ['music-metadata.js'], dynamicImports: ['home.js', 'story-catalog.js'] },
    home, metadata, catalog,
  ]));
  assert.equal(result[0].bytes, 1100);
  assert.equal(result[1].bytes, 2100);
});


const music = { ...entry, fileName: 'music.js', modules: ['/workspace/src/components/GameSoundtrack.tsx'], imports: [], dynamicImports: [] };

test('lazy soundtrack has its own transitive guard against optional catalogs', () => {
  for (const module of ['/workspace/lib/squabblemon-engine/src/story.ts', '/workspace/src/story.ts',
    '/workspace/lib/squabblemon-engine/src/data.ts', '/workspace/lib/squabblemon-engine/src/cosmetics.ts',
    '/workspace/lib/squabblemon-engine/src/playerMats.ts', '/workspace/src/data.ts', '/workspace/src/lib/notificationCatalog.ts']) {
    const catalog = { ...entry, fileName: 'catalog.js', imports: [], modules: [module], bytes: 100 };
    const helper = { ...entry, fileName: 'music-helper.js', imports: ['catalog.js'], modules: ['/workspace/src/musicModes.ts'], bytes: 100 };
    const bundle = report([shell, home, { ...music, imports: ['music-helper.js'] }, helper, catalog]);
    assert.doesNotThrow(() => checkGameBundle(bundle), 'GameApp does not statically reach the independently mounted soundtrack');
    assert.throws(() => checkSoundtrackBundle(bundle), /GameSoundtrack eagerly includes optional catalogs/);
  }
});

test('soundtrack allows compact metadata and ignores full catalogs behind a lazy boundary', () => {
  const metadata = { ...entry, fileName: 'metadata.js', modules: ['/workspace/src/storyMusicRoutes.json'], imports: [], bytes: 100 };
  const catalog = { ...entry, fileName: 'story.js', modules: ['/workspace/lib/squabblemon-engine/src/story.ts'], imports: [], bytes: 600_000 };
  const result = checkSoundtrackBundle(report([{ ...music, imports: ['metadata.js'], dynamicImports: ['story.js'] }, metadata, catalog]));
  assert.equal(result.bytes, 1100);
  assert.deepEqual(result.chunks, ['music.js', 'metadata.js']);
});
