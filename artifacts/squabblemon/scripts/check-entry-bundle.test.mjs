import assert from 'node:assert/strict';
import test from 'node:test';

import {
  checkEntryBundle,
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