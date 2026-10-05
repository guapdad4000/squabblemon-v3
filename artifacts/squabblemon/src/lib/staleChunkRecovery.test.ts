import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installStaleChunkRecovery, staleChunkReloadKey } from './staleChunkRecovery';

class MemoryStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

class RecoveryTarget extends EventTarget {
  readonly sessionStorage = new MemoryStorage();
  reloads = 0;
  readonly location = { reload: () => { this.reloads += 1; } };
}

function preloadError(message: string) {
  const event = new Event('vite:preloadError', { cancelable: true }) as Event & { payload: Error };
  event.payload = new Error(message);
  return event;
}

test('failed chunks never reload an active page, including multiple missing assets', () => {
  const target = new RecoveryTarget();
  const uninstall = installStaleChunkRecovery(target as unknown as Window);
  for (const asset of ['DeckEditor-old.js', 'GangBackdrop-old.js', 'Shop-old.js']) {
    const event = preloadError(`Failed to fetch dynamically imported module: /assets/${asset}`);
    target.dispatchEvent(event);
    assert.equal(event.defaultPrevented, false, 'navigation errors remain available to the boundary');
  }
  assert.equal(target.reloads, 0);
  uninstall();
});

test('reload markers are stable for the same missing chunk', () => {
  const message = 'Failed to fetch dynamically imported module: /assets/DeckEditor-old.js';
  assert.equal(staleChunkReloadKey(new Error(message)), staleChunkReloadKey(message));
});
