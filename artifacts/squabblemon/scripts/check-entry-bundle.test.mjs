import assert from 'node:assert/strict';
import test from 'node:test';

import {
  checkEntryBundle,
  checkGameBundle,
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
