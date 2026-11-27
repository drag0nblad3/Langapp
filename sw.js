// Offline support: network-first so new content shows up immediately; the cache is the offline fallback.
const VERSION = 'hibi-v8';
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/core/app.js', 'js/core/store.js', 'js/core/srs.js', 'js/core/speech.js', 'js/core/content.js',
  'js/langs/index.js',
  // Language packs are cached the first time they load (see fetch handler).
  'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.open(VERSION).then(async (cache) => {
    try {
      const res = await fetch(e.request, { cache: 'no-cache' });
      if (res.ok) cache.put(e.request, res.clone());
      return res;
    } catch (err) {
      const cached = await cache.match(e.request, { ignoreSearch: true });
      if (cached) return cached;
      throw err;
    }
  }));
});
