/* Squabblemon offline shell: instant revisits for code and art; the API is never cached. */
const VERSION = 'sq-v1';
const CODE = `${VERSION}-code`;
const ART = `${VERSION}-art`;
const SHELL = `${VERSION}-shell`;
const ART_LIMIT = 600;
const ART_EXT = /\.(?:png|jpe?g|webp|avif|gif|svg|mp4|webm|mp3|ogg|wav|woff2?)$/i;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(SHELL).then(cache => cache.add(new Request('/', { cache: 'reload' }))).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (!key.startsWith(VERSION)) await caches.delete(key);
    await self.clients.claim();
  })());
});

async function trim(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - ART_LIMIT; i++) await cache.delete(keys[i]);
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api') || url.pathname.startsWith('/.netlify')) return;
  if (request.headers.has('range')) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) { const cache = await caches.open(SHELL); cache.put('/', response.clone()); }
        return response;
      } catch {
        return (await caches.match('/')) || Response.error();
      }
    })());
    return;
  }

  if (url.pathname.startsWith('/assets/') && /-[A-Za-z0-9_-]{8,}\.(?:js|mjs|css)$/.test(url.pathname)) {
    // Content-hashed build files never change: cache-first.
    event.respondWith((async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) (await caches.open(CODE)).put(request, response.clone());
      return response;
    })());
    return;
  }

  if (ART_EXT.test(url.pathname)) {
    // Art: serve instantly from cache, refresh quietly in the background.
    event.respondWith((async () => {
      const cache = await caches.open(ART);
      const cached = await cache.match(request);
      const refresh = fetch(request).then(response => {
        if (response.ok && response.status === 200) cache.put(request, response.clone()).then(() => trim(cache));
        return response;
      }).catch(() => cached);
      if (cached) { event.waitUntil(refresh); return cached; }
      return refresh;
    })());
  }
});
