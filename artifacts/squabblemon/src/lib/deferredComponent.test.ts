import { test } from 'node:test';
import assert from 'node:assert/strict';
import { optionalImportRetryUrl } from './deferredComponent';

test('retry uses a fresh URL for the same expected feature in development and production', () => {
  for (const path of ['/src/components/BuddyGrowthLab.tsx?t=12', '/assets/BuddyGrowthLab-aBcd_123.js']) {
    const failure = new TypeError(`Failed to fetch dynamically imported module: https://game.example${path}`);
    const first = new URL(optionalImportRetryUrl(failure, 'BuddyGrowthLab', 'https://game.example')!);
    const second = new URL(optionalImportRetryUrl(failure, 'BuddyGrowthLab', 'https://game.example')!);
    assert.equal(first.pathname, path.split('?')[0]);
    assert.ok(first.searchParams.has('popupRetry'));
    assert.notEqual(first.href, second.href);
  }
});

test('retry refuses another origin, an unrelated dependency, and errors without a module URL', () => {
  for (const message of [
    'Failed to fetch dynamically imported module: https://other.example/assets/BuddyGrowthLab-aBcd.js',
    'Failed to fetch dynamically imported module: https://game.example/assets/shared-aBcd.js',
    'Network unavailable',
  ]) assert.equal(optionalImportRetryUrl(new Error(message), 'BuddyGrowthLab', 'https://game.example'), undefined);
});
