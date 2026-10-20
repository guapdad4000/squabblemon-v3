/* Squabblemon offline shell: instant revisits for code and art; the API is never cached. */
// A new namespace retires potentially damaged caches from the previous worker.
const VERSION = 'sq-v3';
const CODE = `${VERSION}-code`;
const ART = `${VERSION}-art`;
const SHELL = `${VERSION}-shell`;
const CURRENT_CACHES = new Set([CODE, ART, SHELL]);
const ART_LIMIT = 240;
// Large media and range requests belong to the browser's HTTP cache.
const ART_EXT = /\.(?:png|jpe?g|webp|avif|gif|svg|woff2?)$/i;
const MEDIA_EXT = /\.(?:mp4|webm|mov|mp3|ogg|wav|m4a)$/i;
const revalidated = new Set();
const failedReads = new Set();
const failedWrites = new Set();
const writeQueues = new Map();

async function readCache(name, request) {
  if (failedReads.has(name)) return;
  try {
    return await (await caches.open(name)).match(request);
  } catch {
    // Storage is optional. Avoid repeatedly hitting a broken database this lifetime.
    failedReads.add(name);
    failedWrites.add(name);
  }
}

function writeCache(name, request, response) {
  if (failedWrites.has(name)) return Promise.resolve();
  // Concurrent requests must not race put/trim on the same cache database.
  const write = (writeQueues.get(name) || Promise.resolve()).then(async () => {
    if (failedWrites.has(name)) return;
    try {
      const cache = await caches.open(name);
      await cache.put(request, response);
      if (name === ART) {
        const keys = await cache.keys();
        for (let i = 0; i < keys.length - ART_LIMIT; i++) await cache.delete(keys[i]);
      }
    } catch {
      // Quota, duplicate-entry and internal storage errors must never reject a fetch.
      // Keep existing cache reads available for offline use; retry writes next lifetime.
      failedWrites.add(name);
    }
  });
  writeQueues.set(name, write);
  return write;
}

// Register the lifetime promise synchronously. A cached art response may finish
// before its refresh has fetched and scheduled a write; include those writes too.
function serve(event, handler) {
  const background = [];
  const response = handler(task => background.push(task));
  event.respondWith(response);
  event.waitUntil((async () => {
    try { await response; } catch { /* Network failures still reach respondWith. */ }
    for (let i = 0; i < background.length; i++) await background[i];
  })());
}

async function fetchAndCache(request, name, key, keepAlive) {
  const response = await fetch(request);
  if (response.status === 200) keepAlive(writeCache(name, key, response.clone()));
  return response;
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    try {
      const response = await fetch(new Request(new URL('/', self.location.origin), { cache: 'reload' }));
      if (response.status === 200) await writeCache(SHELL, '/', response);
    } catch { /* Installing must also work offline or without available storage. */ }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    try {
      for (const key of await caches.keys()) {
        if (/^sq-v\d+-(?:code|art|shell)$/.test(key) && !CURRENT_CACHES.has(key)) {
          try { await caches.delete(key); } catch { /* Leave inaccessible old caches alone. */ }
        }
      }
    } catch { /* Claim clients even when Cache Storage is unavailable. */ }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api') || url.pathname.startsWith('/.netlify')) return;
  if (request.headers.has('range') || MEDIA_EXT.test(url.pathname)) return;

  if (request.mode === 'navigate') {
    serve(event, async keepAlive => {
      try {
        return await fetchAndCache(request, SHELL, '/', keepAlive);
      } catch {
        return (await readCache(SHELL, '/')) || Response.error();
      }
    });
    return;
  }

  if (url.pathname.startsWith('/assets/') && /-[A-Za-z0-9_-]{8,}\.(?:js|mjs|css)$/.test(url.pathname)) {
    serve(event, async keepAlive => {
      const cached = await readCache(CODE, request);
      return cached || fetchAndCache(request, CODE, request, keepAlive);
    });
    return;
  }

  if (ART_EXT.test(url.pathname)) {
    serve(event, async keepAlive => {
      const cached = await readCache(ART, request);
      const refresh = () => fetchAndCache(request, ART, request, keepAlive)
        .catch(() => cached || Response.error());
      if (cached) {
        if (!revalidated.has(request.url) && !failedWrites.has(ART)) {
          // Bound this bookkeeping as well as the stored artwork.
          if (revalidated.size >= ART_LIMIT) revalidated.delete(revalidated.values().next().value);
          revalidated.add(request.url);
          keepAlive(refresh());
        }
        return cached;
      }
      return refresh();
    });
  }
});
