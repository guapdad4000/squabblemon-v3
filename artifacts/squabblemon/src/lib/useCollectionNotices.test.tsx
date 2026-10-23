import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useCollectionNotices } from './useCollectionNotices';
import type { CollectionNotice } from './notificationCatalog';
import { CosmeticProvider, useCosmeticProfile } from '../components/cosmeticState';
import { CosmeticProvider as compatibleProvider } from '../components/CosmeticContext';
import { rewardReceipts } from './rewardReceiptStore';
import { rewardReceipts as compatibleReceipts } from './rewardReceipts';
import type { PlayerBootstrap } from '@workspace/api-client-react';

type Profile = Parameters<typeof useCollectionNotices>[0];
type Catalog = { collectionNotifications: (profile: Profile) => CollectionNotice[] };
const profile = (id: string): Profile => ({ ownedCardIds: [id], unlockedCosmeticIds: [], ownedVariants: [] });
const notices = (p: Profile): CollectionNotice[] => p.ownedCardIds.map(id => ({ id, section: 'cards', title: id, href: '/game/collection' }));
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function environment(t: TestContext) {
  const previous = Object.fromEntries(['window', 'IS_REACT_ACT_ENVIRONMENT'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const events = new EventTarget();
  Object.defineProperty(globalThis, 'window', { configurable: true, value: events });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, value: true });
  t.after(() => {
    for (const [key, descriptor] of Object.entries(previous)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  });
  return events;
}
function Probe({ current, load }: { current: Profile; load: () => Promise<Catalog> }) {
  return <output>{JSON.stringify(useCollectionNotices(current, load))}</output>;
}
function result(renderer: ReactTestRenderer) { return JSON.parse(renderer.root.findByType('output').children.join('')); }

test('collection metadata loads after mount and is reused for unrelated profile refreshes', async t => {
  environment(t);
  const pending = deferred<Catalog>(), current = profile('buddy');
  let loads = 0;
  const load = () => { loads++; return pending.promise; };
  let renderer!: ReactTestRenderer;
  await act(async () => { renderer = create(<Probe current={current} load={load}/>); });
  assert.deepEqual(result(renderer), []);
  await act(async () => pending.resolve({ collectionNotifications: notices }));
  assert.deepEqual(result(renderer), notices(current));
  await act(async () => renderer.update(<Probe current={{ ...current }} load={load}/>));
  assert.equal(loads, 1);
  assert.deepEqual(result(renderer), notices(current));
  await act(async () => renderer.unmount());
});

test('ownership changes discard stale results and canceled responses cannot overwrite the new profile', async t => {
  environment(t);
  const first = deferred<Catalog>(), second = deferred<Catalog>();
  let loads = 0;
  const load = () => (++loads === 1 ? first : second).promise;
  let renderer!: ReactTestRenderer;
  await act(async () => { renderer = create(<Probe current={profile('buddy')} load={load}/>); });
  await act(async () => renderer.update(<Probe current={profile('kyle')} load={load}/>));
  await act(async () => second.resolve({ collectionNotifications: notices }));
  assert.deepEqual(result(renderer), notices(profile('kyle')));
  await act(async () => first.resolve({ collectionNotifications: notices }));
  assert.deepEqual(result(renderer), notices(profile('kyle')));
  await act(async () => renderer.update(<Probe current={profile('guap')} load={() => new Promise(() => {})}/>));
  assert.deepEqual(result(renderer), [], 'previous ownership never leaks while the next lookup is pending');
  await act(async () => renderer.unmount());
});

test('failed optional metadata loads retry on reconnect and remove listeners on unmount', async t => {
  const events = environment(t);
  let loads = 0;
  const current = profile('buddy');
  const load = async () => { if (++loads === 1) throw new Error('offline'); return { collectionNotifications: notices }; };
  let renderer!: ReactTestRenderer;
  await act(async () => { renderer = create(<Probe current={current} load={load}/>); });
  assert.deepEqual(result(renderer), []);
  await act(async () => { events.dispatchEvent(new Event('online')); });
  assert.deepEqual(result(renderer), notices(current));
  await act(async () => { events.dispatchEvent(new Event('focus')); });
  assert.equal(loads, 2, 'successful metadata is not reloaded on focus');
  await act(async () => renderer.unmount());
  await act(async () => { events.dispatchEvent(new Event('online')); });
  assert.equal(loads, 2);
});

test('thin shell exports keep the same cosmetic provider and reward queue singleton', async t => {
  environment(t);
  assert.equal(compatibleProvider, CosmeticProvider);
  assert.equal(compatibleReceipts, rewardReceipts);
  const current = { ...profile('buddy'), id: 'same-context' } as PlayerBootstrap['profile'];
  function Consumer() { return <output>{useCosmeticProfile()?.id}</output>; }
  let renderer!: ReactTestRenderer;
  await act(async () => { renderer = create(<CosmeticProvider profile={current}><Consumer/></CosmeticProvider>); });
  assert.deepEqual(renderer.root.findByType('output').children, ['same-context']);
  await act(async () => renderer.unmount());
});
