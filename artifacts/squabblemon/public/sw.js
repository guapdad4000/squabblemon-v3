/* Squabblemon offline shell: instant revisits for code and art; the API is never cached. */
// Bumping VERSION clears the old oversized art/media cache on activate.
const VERSION = 'sq-v2';
const CODE = `${VERSION}-code`;
const ART = `${VERSION}-art`;
const SHELL = `${VERSION}-shell`;
const ART_LIMIT = 240;
// Images and fonts only. Video/audio stay with the browser HTTP cache so large
// special-move clips are never duplicated into Cache Storage or re-downloaded
// in the background during play.
const ART_EXT = /\.(?:png|jpe?g|webp|avif|gif|svg|woff2?)$/i;
const MEDIA_EXT = /\.(?:mp4|webm|mov|mp3|ogg|wav|m4a)$/i;

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

const revalidated = new Set();

async function trim(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - ART_LIMIT; i++) await cache.delete(keys[i]);
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api') || url.pathname.startsWith('/.netlify')) return;
  if (request.headers.has('range') || MEDIA_EXT.test(url.pathname)) return;

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
    // Art: cached only once actually requested. Serve from cache and revalidate
    // each URL at most once per worker lifetime instead of on every request.
    event.respondWith((async () => {
      const cache = await caches.open(ART);
      const cached = await cache.match(request);
      const refresh = () => fetch(request).then(response => {
        if (response.ok && response.status === 200) cache.put(request, response.clone()).then(() => trim(cache));
        return response;
      }).catch(() => cached || Response.error());
      if (cached) {
        if (!revalidated.has(request.url)) { revalidated.add(request.url); event.waitUntil(refresh()); }
        return cached;
      }
      return refresh();
    })());
  }
});
