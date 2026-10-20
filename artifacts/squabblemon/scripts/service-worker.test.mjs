import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
const origin = 'https://squabblemon.test';
const keyOf = key => new URL(typeof key === 'string' ? key : key.url, origin).href;
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};
function harness({ fail, beforePut, network = async () => new Response('network') } = {}) {
  const listeners = {}, stores = new Map(), calls = { fetch: 0, put: 0, claim: 0, skip: 0, activeWrites: 0, maxWrites: 0 };
  function failure(operation) { if (fail?.(operation)) throw new DOMException('Storage failed', 'UnknownError'); }
  const cache = name => {
    if (!stores.has(name)) stores.set(name, new Map());
    const entries = stores.get(name);
    return {
      async match(key) { failure('match'); return entries.get(keyOf(key))?.clone(); },
      async put(key, response) {
        calls.put++; calls.activeWrites++; calls.maxWrites = Math.max(calls.maxWrites, calls.activeWrites);
        try {
          await beforePut?.(); failure('put');
          entries.set(keyOf(key), response.clone());
        } finally { calls.activeWrites--; }
      },
      async keys() { failure('cache.keys'); return [...entries.keys()]; },
      async delete(key) { failure('cache.delete'); return entries.delete(keyOf(key)); },
    };
  };
  const context = vm.createContext({ URL, Request, Response, console,
    fetch: async request => { calls.fetch++; return network(request); },
    caches: {
      async open(name) { failure('open'); return cache(name); },
      async keys() { failure('storage.keys'); return [...stores.keys()]; },
      async delete(name) { failure('storage.delete'); return stores.delete(name); },
    },
    self: {
      location: { origin },
      addEventListener(type, listener) { listeners[type] = listener; },
      async skipWaiting() { calls.skip++; },
      clients: { async claim() { calls.claim++; } },
    },
  });
  vm.runInContext(source, context);
  function dispatch(type, request) {
    let response, synchronous = true;
    const lifetime = [];
    listeners[type]({ request,
      respondWith(value) { assert.ok(synchronous); response = value; },
      waitUntil(value) { assert.ok(synchronous, 'lifetime registered during event dispatch'); lifetime.push(value); },
    });
    synchronous = false;
    return { response, done: Promise.all(lifetime) };
  }
  return { calls, stores, dispatch, cache,
    request(path, options = {}) {
      return dispatch('fetch', { url: new URL(path, origin).href, method: 'GET', mode: 'cors', headers: new Headers(), ...options });
    },
  };
}

for (const failure of ['open', 'match', 'put', 'cache.keys', 'cache.delete']) {
  test(`art remains available when Cache.${failure} rejects`, async () => {
    const h = harness({ fail: method => method === failure });
    // Force trimming so its failure path runs too.
    h.stores.set('sq-v3-art', new Map(Array.from({ length: 240 }, (_, i) => [keyOf(`/old-${i}.webp`), new Response('old')])));
    const event = h.request('/new.webp');
    assert.equal(await (await event.response).text(), 'network');
    await event.done;
    const writes = h.calls.put;
    const retry = h.request('/another.webp');
    assert.equal(await (await retry.response).text(), 'network');
    await retry.done;
    assert.equal(h.calls.put, writes, 'failed storage is not hammered with more writes');
  });
}

for (const [path, options] of [['/battle', { mode: 'navigate' }], ['/assets/index-Abc12345.js', {}]]) {
  test(`${path} returns the original network response despite failed storage`, async () => {
    const h = harness({ fail: method => ['open', 'put'].includes(method) });
    const event = h.request(path, options);
    assert.equal(await (await event.response).text(), 'network');
    await event.done;
  });
}

test('simultaneous cache writes are serialized and tracked through completion', async () => {
  const gate = deferred();
  const h = harness({ beforePut: () => gate.promise });
  const events = Array.from({ length: 12 }, (_, i) => h.request(`/fighter-${i % 3}.webp`));
  const responses = await Promise.all(events.map(event => event.response));
  assert.equal(responses.length, 12, 'network is not held up by blocked writes');
  let settled = false;
  const done = Promise.all(events.map(event => event.done)).then(() => { settled = true; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(settled, false, 'worker stays alive until writes finish');
  gate.resolve(); await done;
  assert.equal(h.calls.maxWrites, 1);
  assert.equal(h.stores.get('sq-v3-art').size, 3);
});

test('cached art returns immediately while refresh and its later write stay alive', async () => {
  const networkGate = deferred(), putGate = deferred();
  const h = harness({ network: () => networkGate.promise, beforePut: () => putGate.promise });
  h.stores.set('sq-v3-art', new Map([[keyOf('/buddy.webp'), new Response('cached')]]));
  const event = h.request('/buddy.webp');
  assert.equal(await (await event.response).text(), 'cached');
  let settled = false;
  event.done.then(() => { settled = true; });
  networkGate.resolve(new Response('updated'));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(settled, false, 'write added after response is still tracked');
  putGate.resolve(); await event.done;
  const again = h.request('/buddy.webp');
  assert.equal(await (await again.response).text(), 'updated'); await again.done;
  assert.equal(h.calls.fetch, 1, 'repeat cache hit does not revalidate again');
});

test('bounded artwork cache evicts the oldest entry', async () => {
  const h = harness();
  h.stores.set('sq-v3-art', new Map(Array.from({ length: 240 }, (_, i) => [keyOf(`/old-${i}.webp`), new Response('old')])));
  const event = h.request('/latest.webp'); await event.response; await event.done;
  assert.equal(h.stores.get('sq-v3-art').size, 240);
  assert.equal(h.stores.get('sq-v3-art').has(keyOf('/old-0.webp')), false);
  assert.equal(h.stores.get('sq-v3-art').has(keyOf('/latest.webp')), true);
});

test('content-hashed assets remain cache-first', async () => {
  const h = harness();
  h.stores.set('sq-v3-code', new Map([[keyOf('/assets/index-Abc12345.js'), new Response('cached-code')]]));
  const event = h.request('/assets/index-Abc12345.js');
  assert.equal(await (await event.response).text(), 'cached-code'); await event.done;
  assert.equal(h.calls.fetch, 0);
});

test('offline navigation can still read shell after writes fail', async () => {
  let offline = false;
  const h = harness({ fail: method => method === 'put', network: async () => { if (offline) throw Error('offline'); return new Response('online'); } });
  h.stores.set('sq-v3-shell', new Map([[keyOf('/'), new Response('offline-shell')]]));
  const online = h.request('/battle', { mode: 'navigate' }); await online.response; await online.done;
  offline = true;
  const event = h.request('/battle', { mode: 'navigate' });
  assert.equal(await (await event.response).text(), 'offline-shell'); await event.done;
});

test('offline missing storage resolves to a network-error response without rejecting background work', async () => {
  const h = harness({ fail: () => true, network: async () => { throw Error('offline'); } });
  for (const [path, options] of [['/battle', { mode: 'navigate' }], ['/buddy.webp', {}]]) {
    const event = h.request(path, options);
    assert.equal((await event.response).type, 'error'); await event.done;
  }
});

test('HTTP errors and partial responses are never saved', async () => {
  for (const status of [404, 500, 206]) {
    const h = harness({ network: async () => new Response('response', { status }) });
    const event = h.request('/battle', { mode: 'navigate' });
    assert.equal((await event.response).status, status); await event.done;
    assert.equal(h.calls.put, 0);
  }
});

test('activation deletes only old owned caches and keeps current and unrelated caches', async () => {
  const h = harness();
  for (const name of ['sq-v1-art', 'sq-v2-shell', 'sq-v3-art', 'other-app-cache', 'sq-v2-unrelated']) h.stores.set(name, new Map());
  await h.dispatch('activate').done;
  assert.deepEqual([...h.stores.keys()], ['sq-v3-art', 'other-app-cache', 'sq-v2-unrelated']);
  assert.equal(h.calls.claim, 1);
});

for (const failure of ['storage.keys', 'storage.delete']) {
  test(`activation claims clients even when ${failure} fails`, async () => {
    const h = harness({ fail: method => method === failure });
    h.stores.set('sq-v2-shell', new Map());
    await h.dispatch('activate').done;
    assert.equal(h.calls.claim, 1);
  });
}

test('install completes with full storage or unavailable network', async () => {
  for (const offline of [true, false]) {
    const h = harness({ fail: () => true, network: async () => { if (offline) throw Error('offline'); return new Response('shell'); } });
    await h.dispatch('install').done;
    assert.equal(h.calls.skip, 1);
  }
});

test('API, cross-origin, non-GET and media/range requests bypass the worker', async () => {
  const h = harness();
  for (const [path, options] of [
    ['/api/player/matches', {}], ['/.netlify/functions/api', {}], ['https://other.test/a.webp', {}],
    ['/image.webp', { method: 'POST' }], ['/image.webp', { headers: new Headers({ range: 'bytes=0-10' }) }],
    ...['mp4', 'webm', 'mov', 'mp3', 'ogg', 'wav', 'm4a'].map(ext => [`/clip.${ext}?v=123`, {}]),
  ]) {
    const event = h.request(path, options); assert.equal(event.response, undefined); await event.done;
  }
  assert.equal(h.calls.fetch, 0); assert.equal(h.calls.put, 0);
});
