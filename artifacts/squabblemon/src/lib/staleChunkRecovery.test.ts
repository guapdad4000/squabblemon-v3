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

test('a stale deployment chunk reloads once for each failed asset', () => {
  const target = new RecoveryTarget();
  const uninstall = installStaleChunkRecovery(target as unknown as Window);
  const first = preloadError('Failed to fetch dynamically imported module: /assets/DeckEditor-old.js');
  target.dispatchEvent(first);
  assert.equal(first.defaultPrevented, true);
  assert.equal(target.reloads, 1);

  const duplicate = preloadError('Failed to fetch dynamically imported module: /assets/DeckEditor-old.js');
  target.dispatchEvent(duplicate);
  assert.equal(duplicate.defaultPrevented, false);
  assert.equal(target.reloads, 1);

  target.dispatchEvent(preloadError('Failed to fetch dynamically imported module: /assets/GangBackdrop-old.js'));
  assert.equal(target.reloads, 2);
  uninstall();
  target.dispatchEvent(preloadError('Failed to fetch dynamically imported module: /assets/Another-old.js'));
  assert.equal(target.reloads, 2);
});

test('reload markers are stable for the same missing chunk', () => {
  const message = 'Failed to fetch dynamically imported module: /assets/DeckEditor-old.js';
  assert.equal(staleChunkReloadKey(new Error(message)), staleChunkReloadKey(message));
});
