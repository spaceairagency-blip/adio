/* ============================================================
   sw.js — Ayah Audio Service Worker
   ↑ Bump APP_VERSION to trigger an update notification banner
============================================================ */

const APP_VERSION = '1.0.0';
const CACHE_NAME  = `ayah-audio-v${APP_VERSION}`;

/* Assets to pre-cache on install */
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './privacy-policy.html'
];

/* ── Install: cache shell ───────────────────────────────── */
self.addEventListener('install', event => {
  self.skipWaiting(); // activate immediately
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_ASSETS))
  );
});

/* ── Activate: delete old caches ───────────────────────── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key.startsWith('ayah-audio-') && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => {
      self.clients.claim();
      /* Notify all open tabs that a new version is live */
      self.clients.matchAll({ type: 'window' }).then(clients => {
        clients.forEach(client =>
          client.postMessage({ type: 'NEW_VERSION', version: APP_VERSION })
        );
      });
    })
  );
});

/* ── Fetch: network-first for API, cache-first for assets ─ */
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  /* Always go to network for API calls */
  if (url.hostname === 'api.alquran.cloud' || url.hostname === 'cdn.islamic.network') {
    event.respondWith(fetch(event.request).catch(() => new Response('', { status: 503 })));
    return;
  }

  /* Cache-first for everything else */
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      });
    })
  );
});
